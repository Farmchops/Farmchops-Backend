import mongoose, { Document, Schema } from 'mongoose';

export interface IOrderAudit extends Document {
  order: mongoose.Types.ObjectId;
  admin?: mongoose.Types.ObjectId;
  action: string;
  note?: string;
  payload?: Record<string, unknown>;
  previousStatus?: string;
  createdAt: Date;
}

const OrderAuditSchema = new Schema<IOrderAudit>({
  order: { type: Schema.Types.ObjectId, ref: 'Order', required: true },
  admin: { type: Schema.Types.ObjectId, ref: 'User' },
  action: { type: String, required: true },
  note: { type: String },
  payload: { type: Schema.Types.Mixed },
  previousStatus: { type: String },
  createdAt: { type: Date, default: () => new Date() }
});

export const OrderAudit = mongoose.model<IOrderAudit>('OrderAudit', OrderAuditSchema);
