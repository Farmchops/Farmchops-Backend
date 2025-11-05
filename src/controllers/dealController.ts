import { Request, Response } from 'express';
import { Deal } from '../models/Deal';

const decorateDeal = async (deal: any) => {
  await deal.populate({ path: 'product', select: 'name images pricing stock slug' });
  const remainingUnits = Math.max(deal.maxUnits - deal.soldUnits, 0);
  const now = Date.now();
  const countdownSeconds = Math.max(Math.floor((deal.endAt.getTime() - now) / 1000), 0);
  return {
    deal: {
      dealId: deal._id,
      title: deal.title,
      description: deal.description,
      heroImage: deal.heroImage,
      startAt: deal.startAt,
      endAt: deal.endAt,
      status: deal.status,
      maxUnits: deal.maxUnits,
      perUserLimit: deal.perUserLimit,
      soldUnits: deal.soldUnits,
      product: deal.product,
      dealPrice: deal.dealPrice ?? null,
      discountPercentage: deal.discountPercentage ?? null
    },
    metrics: {
      remainingUnits,
      countdownSeconds,
      soldOut: deal.status === 'sold_out' || remainingUnits === 0
    }
  };
};

export const getActiveDeal = async (_req: Request, res: Response) => {
  try {
    const now = new Date();
      const deal = await Deal.findOne({
        status: { $in: ['active', 'scheduled'] },
        startAt: { $lte: now },
        endAt: { $gte: now }
      }).sort({ startAt: 1 });

    if (!deal) {
      return res.json({ success: true, data: { deal: null } });
    }

      const computedStatus = Deal.determineStatus({
        startAt: deal.startAt,
        endAt: deal.endAt,
        soldUnits: deal.soldUnits,
        maxUnits: deal.maxUnits,
        status: deal.status
      });

      if (computedStatus !== deal.status) {
        deal.status = computedStatus;
        await deal.save();
      }

  const summary = await decorateDeal(deal);
  return res.json({ success: true, data: summary });
  } catch (error) {
    return res.status(500).json({ success: false, message: error instanceof Error ? error.message : 'Failed to fetch active deal' });
  }
};

export const getUpcomingDeals = async (_req: Request, res: Response) => {
  try {
    const now = new Date();
    const deals = await Deal.find({
      status: { $in: ['scheduled'] },
      startAt: { $gt: now }
    })
      .sort({ startAt: 1 })
      .limit(5);

    const summaries = await Promise.all(deals.map(async (deal) => {
      const computedStatus = Deal.determineStatus({
        startAt: deal.startAt,
        endAt: deal.endAt,
        soldUnits: deal.soldUnits,
        maxUnits: deal.maxUnits,
        status: deal.status
      });
      if (computedStatus !== deal.status) {
        deal.status = computedStatus;
        await deal.save();
      }
      return decorateDeal(deal);
    }));
    return res.json({ success: true, data: { deals: summaries } });
  } catch (error) {
    return res.status(500).json({ success: false, message: error instanceof Error ? error.message : 'Failed to fetch upcoming deals' });
  }
};
