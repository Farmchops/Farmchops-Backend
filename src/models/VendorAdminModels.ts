import mongoose, { Document, Schema } from 'mongoose';

export interface IVendorAudit extends Document {
  vendor: mongoose.Types.ObjectId;
  admin: mongoose.Types.ObjectId;
  action: string;
  payload: any;
  createdAt: Date;
}

const VendorAuditSchema = new Schema<IVendorAudit>({
  vendor: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor', required: true, index: true },
  admin: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  action: { type: String, required: true },
  payload: { type: mongoose.Schema.Types.Mixed, default: {} },
}, { timestamps: { createdAt: true, updatedAt: false } });

export const VendorAudit = mongoose.model<IVendorAudit>('VendorAudit', VendorAuditSchema);

export interface IVendorContact extends Document {
  vendor: mongoose.Types.ObjectId;
  admin: mongoose.Types.ObjectId;
  note: string;
  channel?: string;
  date?: Date;
  assignedRep?: string;
  idempotencyKey?: string;
  createdAt: Date;
}

const VendorContactSchema = new Schema<IVendorContact>({
  vendor: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor', required: true, index: true },
  admin: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  note: { type: String, required: true },
  channel: { type: String, trim: true },
  date: Date,
  assignedRep: { type: String, trim: true },
  idempotencyKey: { type: String, trim: true, index: true, sparse: true }
}, { timestamps: { createdAt: true, updatedAt: false } });

export const VendorContact = mongoose.model<IVendorContact>('VendorContact', VendorContactSchema);

export interface IVendorRequest extends Document {
  vendor: mongoose.Types.ObjectId;
  admin: mongoose.Types.ObjectId;
  message: string;
  fieldsRequested?: string[];
  notify?: boolean;
  createdAt: Date;
}

const VendorRequestSchema = new Schema<IVendorRequest>({
  vendor: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor', required: true, index: true },
  admin: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  message: { type: String, required: true },
  fieldsRequested: [{ type: String }],
  notify: { type: Boolean, default: false }
}, { timestamps: { createdAt: true, updatedAt: false } });

export const VendorRequest = mongoose.model<IVendorRequest>('VendorRequest', VendorRequestSchema);

export interface IVendorNote extends Document {
  vendor: mongoose.Types.ObjectId;
  admin: mongoose.Types.ObjectId;
  text: string;
  createdAt: Date;
}

const VendorNoteSchema = new Schema<IVendorNote>({
  vendor: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor', required: true, index: true },
  admin: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  text: { type: String, required: true }
}, { timestamps: { createdAt: true, updatedAt: false } });

export const VendorNote = mongoose.model<IVendorNote>('VendorNote', VendorNoteSchema);

export default {};
