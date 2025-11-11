import { Request, Response } from 'express';
import mongoose from 'mongoose';
import Vendor from '../models/Vendor';
import { VendorAudit, VendorContact, VendorRequest, VendorNote } from '../models/VendorAdminModels';
import { validationResult } from 'express-validator';

// PUT /admin/vendors/:id/status
export const changeVendorStatusAdmin = async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

    const { id } = req.params;
    if (!id || !mongoose.Types.ObjectId.isValid(String(id))) return res.status(400).json({ success: false, message: 'Invalid id' });

    const { status, reason, metadata, notify } = req.body;
    const allowed = ['partnered', 'pending', 'needs_info', 'contacted', 'declined'];
    if (!allowed.includes(status)) return res.status(400).json({ success: false, message: 'Invalid status' });

    const admin = (req as any).user;
    if (!admin || !admin._id) return res.status(403).json({ success: false, message: 'Forbidden' });

    const vendor = await Vendor.findById(id);
    if (!vendor) return res.status(404).json({ success: false, message: 'Vendor not found' });

    // Idempotency: setting same status is ok
    const prevStatus = vendor.status;
    vendor.status = status as any;
    await vendor.save();

    // Record audit
    await VendorAudit.create({ vendor: vendor._id, admin: admin._id, action: 'change_status', payload: { status, reason, metadata, prevStatus } });

    // Queue notification - for now we just log and create an audit entry; real queue/send omitted
    if (notify) {
      await VendorAudit.create({ vendor: vendor._id, admin: admin._id, action: 'notify_requested', payload: { status, reason } });
      console.log(`Notification queued for vendor ${vendor._id} by admin ${admin._id}`);
    }

    return res.status(200).json({ success: true, vendor });
  } catch (err) {
    console.error('changeVendorStatusAdmin error:', err);
    return res.status(500).json({ success: false, message: 'Failed to change vendor status' });
  }
};

// POST /admin/vendors/:id/contact
export const postVendorContact = async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

    const { id } = req.params;
    const { note, channel, date, assignedRep, idempotencyKey } = req.body;
    if (!note || typeof note !== 'string') return res.status(400).json({ success: false, message: 'Note is required' });

    const admin = (req as any).user;
    if (!admin || !admin._id) return res.status(403).json({ success: false, message: 'Forbidden' });

    if (!id || !mongoose.Types.ObjectId.isValid(String(id))) return res.status(400).json({ success: false, message: 'Invalid id' });
    const vendor = await Vendor.findById(id);
    if (!vendor) return res.status(404).json({ success: false, message: 'Vendor not found' });

    // Dedup if idempotencyKey provided
    if (idempotencyKey) {
      const existing = await VendorContact.findOne({ vendor: vendor._id, idempotencyKey });
      if (existing) return res.status(200).json({ success: true, contactRecord: existing });
    }

    const contact = await VendorContact.create({ vendor: vendor._id, admin: admin._id, note, channel, date: date ? new Date(date) : undefined, assignedRep, idempotencyKey });

    // Audit
    await VendorAudit.create({ vendor: vendor._id, admin: admin._id, action: 'contact_recorded', payload: { contactId: contact._id } });

    return res.status(201).json({ success: true, contactRecord: contact });
  } catch (err) {
    console.error('postVendorContact error:', err);
    return res.status(500).json({ success: false, message: 'Failed to record contact' });
  }
};

// POST /admin/vendors/:id/request-info
export const postVendorRequestInfo = async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

    const { id } = req.params;
    const { message, fieldsRequested, notify } = req.body;
    if (!message || typeof message !== 'string') return res.status(400).json({ success: false, message: 'Message is required' });

    const admin = (req as any).user;
    if (!admin || !admin._id) return res.status(403).json({ success: false, message: 'Forbidden' });

    if (!id || !mongoose.Types.ObjectId.isValid(String(id))) return res.status(400).json({ success: false, message: 'Invalid id' });
    const vendor = await Vendor.findById(id);
    if (!vendor) return res.status(404).json({ success: false, message: 'Vendor not found' });

    const reqDoc = await VendorRequest.create({ vendor: vendor._id, admin: admin._id, message, fieldsRequested, notify: !!notify });

    // Optionally set vendor.status to needs_info
    vendor.status = 'needs_info' as any;
    await vendor.save();

    await VendorAudit.create({ vendor: vendor._id, admin: admin._id, action: 'request_info_created', payload: { requestId: reqDoc._id, fieldsRequested } });

    if (notify) {
      console.log(`Notification queued to vendor ${vendor._id} for request ${reqDoc._id}`);
    }

    return res.status(201).json({ success: true, requestRecord: reqDoc });
  } catch (err) {
    console.error('postVendorRequestInfo error:', err);
    return res.status(500).json({ success: false, message: 'Failed to create request' });
  }
};

// POST /admin/vendors/:id/notes
export const postVendorNote = async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

    const { id } = req.params;
    const { text } = req.body;
    if (!text || typeof text !== 'string') return res.status(400).json({ success: false, message: 'Text is required' });

    const admin = (req as any).user;
    if (!admin || !admin._id) return res.status(403).json({ success: false, message: 'Forbidden' });

    if (!id || !mongoose.Types.ObjectId.isValid(String(id))) return res.status(400).json({ success: false, message: 'Invalid id' });
    const vendor = await Vendor.findById(id);
    if (!vendor) return res.status(404).json({ success: false, message: 'Vendor not found' });

    const note = await VendorNote.create({ vendor: vendor._id, admin: admin._id, text });
    await VendorAudit.create({ vendor: vendor._id, admin: admin._id, action: 'note_created', payload: { noteId: note._id } });

    return res.status(201).json({ success: true, note: note });
  } catch (err) {
    console.error('postVendorNote error:', err);
    return res.status(500).json({ success: false, message: 'Failed to create note' });
  }
};

// GET /admin/vendors
export const listVendorsAdmin = async (req: Request, res: Response) => {
  try {
    const { page = 1, perPage = 20, status, search, sortBy = 'createdAt', order = 'desc', assignedRep, createdAfter, createdBefore } = req.query as any;
    const filter: any = {};
    if (status) filter.status = status;
    if (search) filter.$text = { $search: String(search) };
    if (createdAfter || createdBefore) filter.createdAt = {};
    if (createdAfter) filter.createdAt.$gte = new Date(String(createdAfter));
    if (createdBefore) filter.createdAt.$lte = new Date(String(createdBefore));

    // assignedRep is a vendor-level field inside metadata; we skip complex joins for now

    const pageNum = Math.max(1, Number(page));
    const perPageNum = Math.max(1, Math.min(200, Number(perPage)));
    const skip = (pageNum - 1) * perPageNum;

    const sort: any = {};
    sort[String(sortBy)] = order === 'asc' ? 1 : -1;

    const vendors = await Vendor.find(filter).sort(sort).skip(skip).limit(perPageNum).lean();
    const total = await Vendor.countDocuments(filter);

  // Return multiple shapes for compatibility: keep top-level `vendors`, and
  // set `data` to an object containing `vendors` and `meta` so frontends
  // expecting either `data` (array) or `data.vendors` work correctly.
  const metaObj = { page: pageNum, perPage: perPageNum, total };
  return res.status(200).json({ success: true, vendors, data: { vendors, meta: metaObj }, meta: metaObj });
  } catch (err) {
    console.error('listVendorsAdmin error:', err);
    return res.status(500).json({ success: false, message: 'Failed to list vendors' });
  }
};

// GET /admin/vendors/:id (detailed)
export const getVendorDetailAdmin = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (!id || !mongoose.Types.ObjectId.isValid(String(id))) return res.status(400).json({ success: false, message: 'Invalid id' });
    const vendor = await Vendor.findById(id).lean();
    if (!vendor) return res.status(404).json({ success: false, message: 'Vendor not found' });

    const contacts = await VendorContact.find({ vendor: vendor._id }).sort({ createdAt: -1 }).lean();
    const requests = await VendorRequest.find({ vendor: vendor._id }).sort({ createdAt: -1 }).lean();
    const notes = await VendorNote.find({ vendor: vendor._id }).sort({ createdAt: -1 }).lean();

    return res.status(200).json({ success: true, vendor, contacts, requests, notes });
  } catch (err) {
    console.error('getVendorDetailAdmin error:', err);
    return res.status(500).json({ success: false, message: 'Failed to get vendor detail' });
  }
};

export default {
  changeVendorStatusAdmin,
  postVendorContact,
  postVendorRequestInfo,
  postVendorNote,
  listVendorsAdmin,
  getVendorDetailAdmin
};
