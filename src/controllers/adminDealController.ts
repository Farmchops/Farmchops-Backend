import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { Deal, IDeal, DealStatus } from '../models/Deal';
import { Product } from '../models/Product';
import { DealRedemption } from '../models/DealRedemption';
import { AuthRequest } from '../middleware/auth';
const toNumber = (value: unknown) => {
  if (value === undefined || value === null) {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const normalizeStatus = (deal: IDeal): DealStatus => {
  const next = Deal.determineStatus({
    startAt: deal.startAt,
    endAt: deal.endAt,
    soldUnits: deal.soldUnits,
    maxUnits: deal.maxUnits,
    status: deal.status
  });
  if (next !== deal.status) {
    deal.status = next;
  }
  return deal.status;
};

const attachProduct = async (deal: IDeal) => {
  await deal.populate({ path: 'product', select: 'name images pricing stock status' });
  return deal;
};

export const createDeal = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const {
      title,
      productId,
      dealPrice,
      discountPercentage,
      maxUnits,
      perUserLimit,
      startAt,
      endAt,
      description,
      heroImage,
      isFeatured
    } = req.body;

    if (!title || !productId || !maxUnits || !startAt || !endAt) {
      return res.status(400).json({ success: false, message: 'title, productId, maxUnits, startAt, and endAt are required' });
    }

    const start = new Date(startAt);
    const end = new Date(endAt);

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return res.status(400).json({ success: false, message: 'startAt and endAt must be valid dates' });
    }

    if (start >= end) {
      return res.status(400).json({ success: false, message: 'startAt must be earlier than endAt' });
    }

    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({ success: false, message: 'Invalid productId' });
    }

    const product = await Product.findById(productId).select('name');
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    const parsedDealPrice = toNumber(dealPrice);
    const parsedDiscount = toNumber(discountPercentage);

    const numericMaxUnits = Number(maxUnits);
    const numericPerUserLimit = perUserLimit ? Number(perUserLimit) : 1;

    if (!Number.isFinite(numericMaxUnits) || numericMaxUnits < 1) {
      return res.status(400).json({ success: false, message: 'maxUnits must be a positive number' });
    }

    if (!Number.isFinite(numericPerUserLimit) || numericPerUserLimit < 1) {
      return res.status(400).json({ success: false, message: 'perUserLimit must be a positive number' });
    }

    if (parsedDealPrice === undefined && parsedDiscount === undefined) {
      return res.status(400).json({ success: false, message: 'Provide dealPrice or discountPercentage' });
    }

    const deal = await Deal.create({
      title,
      product: product._id,
      dealPrice: parsedDealPrice,
      discountPercentage: parsedDiscount,
  maxUnits: numericMaxUnits,
  perUserLimit: numericPerUserLimit,
      startAt: start,
      endAt: end,
      status: 'scheduled',
      description,
      heroImage,
      isFeatured: Boolean(isFeatured),
      createdBy: req.user._id
    });

    normalizeStatus(deal);
    await deal.save();
    await attachProduct(deal);

    return res.status(201).json({ success: true, data: deal });
  } catch (error) {
    return res.status(500).json({ success: false, message: error instanceof Error ? error.message : 'Failed to create deal' });
  }
};

export const updateDeal = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const { id } = req.params as { id: string };
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid deal id' });
    }

    const deal = await Deal.findById(id);
    if (!deal) {
      return res.status(404).json({ success: false, message: 'Deal not found' });
    }

    if (deal.status === 'cancelled') {
      return res.status(400).json({ success: false, message: 'Cancelled deals cannot be edited' });
    }

    const updates: Partial<IDeal> = {};
    const parsedDealPrice = toNumber(req.body.dealPrice);
    const parsedDiscount = toNumber(req.body.discountPercentage);

    if (req.body.title) {
      updates.title = req.body.title;
    }
    if (req.body.description !== undefined) {
      updates.description = req.body.description;
    }
    if (req.body.heroImage !== undefined) {
      updates.heroImage = req.body.heroImage;
    }
    if (req.body.isFeatured !== undefined) {
      updates.isFeatured = Boolean(req.body.isFeatured);
    }
    if (parsedDealPrice !== undefined) {
      updates.dealPrice = parsedDealPrice;
    }
    if (parsedDiscount !== undefined) {
      updates.discountPercentage = parsedDiscount;
    }
    if (req.body.maxUnits !== undefined) {
      const numeric = Number(req.body.maxUnits);
      if (!Number.isFinite(numeric) || numeric < 1) {
        return res.status(400).json({ success: false, message: 'maxUnits must be a positive number' });
      }
      updates.maxUnits = numeric;
    }
    if (req.body.perUserLimit !== undefined) {
      const numeric = Number(req.body.perUserLimit);
      if (!Number.isFinite(numeric) || numeric < 1) {
        return res.status(400).json({ success: false, message: 'perUserLimit must be a positive number' });
      }
      updates.perUserLimit = numeric;
    }
    if (req.body.startAt) {
      const start = new Date(req.body.startAt);
      if (Number.isNaN(start.getTime())) {
        return res.status(400).json({ success: false, message: 'startAt must be a valid date' });
      }
      updates.startAt = start;
    }
    if (req.body.endAt) {
      const end = new Date(req.body.endAt);
      if (Number.isNaN(end.getTime())) {
        return res.status(400).json({ success: false, message: 'endAt must be a valid date' });
      }
      updates.endAt = end;
    }

    const effectiveStart = updates.startAt ?? deal.startAt;
    const effectiveEnd = updates.endAt ?? deal.endAt;
    if (effectiveStart >= effectiveEnd) {
      return res.status(400).json({ success: false, message: 'startAt must be earlier than endAt' });
    }

    Object.assign(deal, updates);
    normalizeStatus(deal);
    await deal.save();
    await attachProduct(deal);

    return res.json({ success: true, data: deal });
  } catch (error) {
    return res.status(500).json({ success: false, message: error instanceof Error ? error.message : 'Failed to update deal' });
  }
};

export const cancelDeal = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const { id } = req.params as { id: string };
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid deal id' });
    }

    const deal = await Deal.findById(id);
    if (!deal) {
      return res.status(404).json({ success: false, message: 'Deal not found' });
    }

    if (deal.status === 'cancelled') {
      return res.status(400).json({ success: false, message: 'Deal already cancelled' });
    }

    deal.status = 'cancelled';
    deal.cancelledAt = new Date();
    await deal.save();

    return res.json({ success: true, message: 'Deal cancelled' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error instanceof Error ? error.message : 'Failed to cancel deal' });
  }
};

export const pauseDeal = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const { id } = req.params as { id: string };
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid deal id' });
    }

    const deal = await Deal.findById(id);
    if (!deal) {
      return res.status(404).json({ success: false, message: 'Deal not found' });
    }

    if (deal.status === 'cancelled') {
      return res.status(400).json({ success: false, message: 'Cancelled deals cannot be paused' });
    }

    if (deal.status === 'ended') {
      return res.status(400).json({ success: false, message: 'Ended deals cannot be paused' });
    }

    if (deal.status === 'sold_out') {
      return res.status(400).json({ success: false, message: 'Sold out deals cannot be paused' });
    }

    if (deal.status === 'paused') {
      await attachProduct(deal);
      return res.json({ success: true, data: deal });
    }

    deal.status = 'paused';
    await deal.save();
    await attachProduct(deal);

    return res.json({ success: true, data: deal });
  } catch (error) {
    return res.status(500).json({ success: false, message: error instanceof Error ? error.message : 'Failed to pause deal' });
  }
};

export const resumeDeal = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const { id } = req.params as { id: string };
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid deal id' });
    }

    const deal = await Deal.findById(id);
    if (!deal) {
      return res.status(404).json({ success: false, message: 'Deal not found' });
    }

    if (deal.status !== 'paused') {
      return res.status(400).json({ success: false, message: 'Only paused deals can be resumed' });
    }

    const now = new Date();
    if (now > deal.endAt) {
      deal.status = 'ended';
      await deal.save();
      return res.status(400).json({ success: false, message: 'Deal end time has passed' });
    }

    if (deal.soldUnits >= deal.maxUnits) {
      deal.status = 'sold_out';
      await deal.save();
      return res.status(400).json({ success: false, message: 'Deal is already sold out' });
    }

    const nextStatus = Deal.determineStatus({
      startAt: deal.startAt,
      endAt: deal.endAt,
      soldUnits: deal.soldUnits,
      maxUnits: deal.maxUnits
    });

    deal.status = nextStatus;
    if (deal.cancelledAt) {
      deal.cancelledAt = undefined;
    }

    await deal.save();
    await attachProduct(deal);

    return res.json({ success: true, data: deal });
  } catch (error) {
    return res.status(500).json({ success: false, message: error instanceof Error ? error.message : 'Failed to resume deal' });
  }
};

export const listDeals = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const {
      status,
      productId,
      page = 1,
      limit = 20,
      search
    } = req.query;

    const query: Record<string, unknown> = {};

    if (status && typeof status === 'string') {
      query.status = status;
    }

    if (productId && typeof productId === 'string' && mongoose.Types.ObjectId.isValid(productId)) {
      query.product = new mongoose.Types.ObjectId(productId);
    }

    if (search && typeof search === 'string' && search.trim().length) {
      query.title = { $regex: new RegExp(search.trim(), 'i') };
    }

    const numericLimit = Math.min(Number(limit) || 20, 100);
    const numericPage = Math.max(Number(page) || 1, 1);

    const deals = await Deal.find(query)
      .sort({ startAt: -1 })
      .skip((numericPage - 1) * numericLimit)
      .limit(numericLimit)
      .populate({ path: 'product', select: 'name images pricing' });

    const total = await Deal.countDocuments(query);

    const refreshed = deals.map((deal) => {
      normalizeStatus(deal);
      return deal;
    });

    await Promise.all(refreshed.map((deal) => deal.isModified() ? deal.save() : Promise.resolve()));

    return res.json({
      success: true,
      data: {
        deals: refreshed,
        total,
        page: numericPage,
        pageSize: numericLimit
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error instanceof Error ? error.message : 'Failed to fetch deals' });
  }
};

export const getDeal = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const { id } = req.params as { id: string };
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid deal id' });
    }

    const deal = await Deal.findById(id).populate({ path: 'product', select: 'name images pricing stock status' });
    if (!deal) {
      return res.status(404).json({ success: false, message: 'Deal not found' });
    }

    normalizeStatus(deal);
    if (deal.isModified()) {
      await deal.save();
    }

    return res.json({ success: true, data: deal });
  } catch (error) {
    return res.status(500).json({ success: false, message: error instanceof Error ? error.message : 'Failed to fetch deal' });
  }
};

export const getDealStats = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const { id } = req.params as { id: string };
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid deal id' });
    }

    const deal = await Deal.findById(id);
    if (!deal) {
      return res.status(404).json({ success: false, message: 'Deal not found' });
    }

    const stats = await DealRedemption.aggregate([
      { $match: { deal: deal._id } },
      {
        $group: {
          _id: null,
          totalUnits: { $sum: '$quantity' },
          uniqueBuyers: { $addToSet: '$user' }
        }
      }
    ]);

    const summary = stats[0] || { totalUnits: 0, uniqueBuyers: [] };

    return res.json({
      success: true,
      data: {
        dealId: deal._id,
        totalUnitsSold: summary.totalUnits || 0,
        uniqueBuyers: Array.isArray(summary.uniqueBuyers) ? summary.uniqueBuyers.length : 0,
        soldUnits: deal.soldUnits,
        reservedUnits: deal.reservedUnits,
        remainingUnits: Math.max(deal.maxUnits - deal.soldUnits, 0)
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error instanceof Error ? error.message : 'Failed to fetch deal stats' });
  }
};

export const updateDealStatus = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const { id } = req.params as { id: string };
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid deal id' });
    }

    const { status } = req.body as { status?: DealStatus };
    if (!status || typeof status !== 'string') {
      return res.status(400).json({ success: false, message: 'status is required' });
    }

  const allowedStatuses: DealStatus[] = ['draft', 'scheduled', 'active', 'paused', 'sold_out', 'ended', 'cancelled'];
    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status value' });
    }

    const deal = await Deal.findById(id);
    if (!deal) {
      return res.status(404).json({ success: false, message: 'Deal not found' });
    }

    if (deal.status === 'cancelled' && status !== 'cancelled') {
      return res.status(400).json({ success: false, message: 'Cancelled deals cannot be reactivated' });
    }

    deal.status = status;
    if (status === 'cancelled') {
      deal.cancelledAt = new Date();
    } else if (deal.cancelledAt) {
      deal.cancelledAt = undefined;
    }

    await deal.save();
    await attachProduct(deal);

    return res.json({ success: true, data: deal });
  } catch (error) {
    return res.status(500).json({ success: false, message: error instanceof Error ? error.message : 'Failed to update deal status' });
  }
};

export const activateDeal = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const { id } = req.params as { id: string };
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid deal id' });
    }

    const deal = await Deal.findById(id);
    if (!deal) {
      return res.status(404).json({ success: false, message: 'Deal not found' });
    }

    if (deal.status === 'cancelled') {
      return res.status(400).json({ success: false, message: 'Cancelled deals cannot be activated' });
    }

    const now = new Date();
    if (deal.endAt <= now) {
      return res.status(400).json({ success: false, message: 'Deal end time has passed' });
    }

    if (deal.soldUnits >= deal.maxUnits) {
      return res.status(400).json({ success: false, message: 'Deal is already sold out' });
    }

    if (deal.startAt > now) {
      deal.startAt = now;
    }

    deal.status = 'active';
    if (deal.cancelledAt) {
      deal.cancelledAt = undefined;
    }

    await deal.save();
    await attachProduct(deal);

    return res.json({ success: true, data: deal });
  } catch (error) {
    return res.status(500).json({ success: false, message: error instanceof Error ? error.message : 'Failed to activate deal' });
  }
};
