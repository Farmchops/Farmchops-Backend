import { Request, Response } from 'express';
import mongoose from 'mongoose';
import Vendor from '../models/Vendor';
import { validationResult } from 'express-validator';

const USER_UPDATABLE = ['firstName', 'lastName', 'gender', 'address', 'nationality', 'items', 'phone', 'email'];

export const createVendor = async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const arr = errors.array();
      // Return a concise message plus the array for debugging
      const message = arr.map(e => e.msg).join('; ');
      return res.status(400).json({ success: false, message, errors: arr });
    }
  const { firstName, lastName, gender, address, nationality, items, nin, phone, email } = req.body;

    if (!firstName || !address) {
      return res.status(400).json({ success: false, message: 'First name and address are required' });
    }

    // NIN validated by route validators; normalize it for any server-side checks.
    const ninTrimmed = typeof nin === 'string' ? nin.trim() : '';
    const ninPattern = /^[A-Za-z0-9]{6,20}$/; // basic alphanumeric check and length
    if (!ninPattern.test(ninTrimmed)) {
      return res.status(400).json({ success: false, message: 'Invalid NIN format' });
    }

    // Do NOT accept or store NIN from the public submission. If identity verification
    // is needed at a later stage, handle it outside this application flow.
    const vendor = new Vendor({
      firstName: String(firstName).trim(),
      lastName: lastName ? String(lastName).trim() : undefined,
      gender,
      address: String(address).trim(),
      nationality,
      phone: phone ? String(phone).trim() : undefined,
      email: email ? String(email).trim() : undefined,
      items: Array.isArray(items) ? items : []
    });

    // If authenticated, attach the user
    if ((req as any).user) {
      vendor.user = (req as any).user._id;
    }

  // Intentionally NOT storing NIN anywhere. If you need to persist verification
  // evidence, upload an ID document via POST /api/vendors/:id/doc instead.
  await vendor.save();
    return res.status(201).json({ success: true, data: vendor });
  } catch (err) {
    console.error('createVendor error:', err);
    return res.status(500).json({ success: false, message: 'Failed to create vendor' });
  }
};

export const getVendors = async (req: Request, res: Response) => {
  try {
    const q: any = {};
    if (req.query.status) q.status = req.query.status;
    const vendors = await Vendor.find(q).sort({ createdAt: -1 }).lean();
    return res.json({ success: true, data: vendors });
  } catch (err) {
    console.error('getVendors error:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch vendors' });
  }
};

export const getVendorById = async (req: Request, res: Response) => {
  try {
  const { id } = req.params;
  if (!id || !mongoose.Types.ObjectId.isValid(String(id))) return res.status(400).json({ success: false, message: 'Invalid id' });
    const vendor = await Vendor.findById(id);
    if (!vendor) return res.status(404).json({ success: false, message: 'Vendor not found' });

    // If requester is not admin, allow owner only
    const reqUser = (req as any).user;
    if (reqUser?.role !== 'admin' && vendor.user && vendor.user.toString() !== reqUser?._id?.toString()) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    return res.json({ success: true, data: vendor });
  } catch (err) {
    console.error('getVendorById error:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch vendor' });
  }
};

export const updateVendor = async (req: Request, res: Response) => {
  try {
  const { id } = req.params;
  if (!id || !mongoose.Types.ObjectId.isValid(String(id))) return res.status(400).json({ success: false, message: 'Invalid id' });

    const vendor = await Vendor.findById(id);
    if (!vendor) return res.status(404).json({ success: false, message: 'Vendor not found' });

    const reqUser = (req as any).user;
    const isAdmin = reqUser?.role === 'admin';

    if (!isAdmin) {
      if (!vendor.user) return res.status(403).json({ success: false, message: 'Only admin can modify this vendor' });
      if (vendor.user.toString() !== reqUser._id.toString()) return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    const updates: any = {};
    if (isAdmin) {
      Object.assign(updates, req.body);
    } else {
      for (const key of USER_UPDATABLE) {
        if (req.body[key] !== undefined) updates[key] = req.body[key];
      }
    }

    // Prevent non-admin from changing status/adminNotes
    if (!isAdmin && ('status' in req.body || 'adminNotes' in req.body)) {
      return res.status(403).json({ success: false, message: 'Cannot change status or admin notes' });
    }

    const updated = await Vendor.findByIdAndUpdate(id, updates, { new: true });
    return res.json({ success: true, data: updated });
  } catch (err) {
    console.error('updateVendor error:', err);
    return res.status(500).json({ success: false, message: 'Failed to update vendor' });
  }
};

// Upload ID document for vendor (owner or admin)
export const uploadVendorDoc = async (req: any, res: Response) => {
  try {
    const { id } = req.params;
    if (!id || !mongoose.Types.ObjectId.isValid(String(id))) return res.status(400).json({ success: false, message: 'Invalid id' });

    const vendor = await Vendor.findById(id);
    if (!vendor) return res.status(404).json({ success: false, message: 'Vendor not found' });

    const reqUser = (req as any).user;
    const isAdmin = reqUser?.role === 'admin';
    if (!isAdmin) {
      if (!vendor.user) return res.status(403).json({ success: false, message: 'Only admin can upload document for this vendor' });
      if (vendor.user.toString() !== reqUser._id.toString()) return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });

    const file = req.file as any;
    vendor.idDoc = {
      url: file.path || file.secure_url || file.url,
      publicId: file.filename || file.public_id || undefined,
      format: file.mimetype || file.format || undefined,
      bytes: file.size || file.bytes || undefined,
      uploadedAt: new Date()
    };

    await vendor.save();
    return res.json({ success: true, data: { idDoc: vendor.idDoc } });
  } catch (err) {
    console.error('uploadVendorDoc error:', err);
    return res.status(500).json({ success: false, message: 'Failed to upload document' });
  }
};

export const changeVendorStatus = async (req: Request, res: Response) => {
  try {
    const reqUser = (req as any).user;
    if (!reqUser || reqUser.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    const { id } = req.params;
    const { status, adminNotes } = req.body;
    if (!['pending', 'approved', 'rejected'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }

    const vendor = await Vendor.findByIdAndUpdate(id, { status, adminNotes }, { new: true });
    if (!vendor) return res.status(404).json({ success: false, message: 'Vendor not found' });
    return res.json({ success: true, data: vendor });
  } catch (err) {
    console.error('changeVendorStatus error:', err);
    return res.status(500).json({ success: false, message: 'Failed to change vendor status' });
  }
};

export default {
  createVendor,
  getVendors,
  getVendorById,
  updateVendor,
  changeVendorStatus,
  uploadVendorDoc
};
