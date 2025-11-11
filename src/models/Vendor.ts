import mongoose, { Document, Schema } from 'mongoose';

export interface IVendorItem {
  name: string;
  description?: string;
  unit?: string;
  available?: boolean;
}

export interface IVendor extends Document {
  firstName: string;
  lastName?: string;
  gender?: 'male' | 'female' | 'other';
  address: string;
  nationality?: string;
  items: IVendorItem[];
  user?: mongoose.Types.ObjectId;
  status: 'pending' | 'approved' | 'rejected';
  adminNotes?: string;
  // ID document metadata (if vendor uploaded an ID document)
  idDoc?: {
    url: string;
    publicId?: string;
    format?: string;
    bytes?: number;
    uploadedAt?: Date;
  };
}

const VendorItemSchema = new Schema<IVendorItem>({
  name: { type: String, required: true, trim: true },
  description: { type: String, trim: true },
  unit: { type: String, trim: true },
  available: { type: Boolean, default: true }
}, { _id: false });

const VendorSchema = new Schema<IVendor>({
  firstName: { type: String, required: true, trim: true },
  lastName: { type: String, trim: true },
  gender: { type: String, enum: ['male', 'female', 'other'] },
  address: { type: String, required: true, trim: true },
  nationality: { type: String, trim: true },
  items: { type: [VendorItemSchema], default: [] },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  adminNotes: { type: String, trim: true },
  idDoc: {
    url: { type: String, trim: true },
    publicId: { type: String, trim: true },
    format: { type: String, trim: true },
    bytes: { type: Number },
    uploadedAt: { type: Date }
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

export const Vendor = mongoose.model<IVendor>('Vendor', VendorSchema);

export default Vendor;
