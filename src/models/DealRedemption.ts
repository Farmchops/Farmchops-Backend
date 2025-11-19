import mongoose, { Document, Schema } from 'mongoose';

export interface IDealRedemption extends Document {
  deal: mongoose.Types.ObjectId;
  user: mongoose.Types.ObjectId;
  order?: mongoose.Types.ObjectId;
  quantity: number;
  redeemedAt: Date;
}

const DealRedemptionSchema = new Schema<IDealRedemption>({
  deal: {
    type: Schema.Types.ObjectId,
    ref: 'Deal',
    required: true,
    index: true
  },
  user: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  order: {
    type: Schema.Types.ObjectId,
    ref: 'Order'
  },
  quantity: {
    type: Number,
    required: true,
    min: [1, 'Quantity must be at least 1']
  },
  redeemedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: false
});

DealRedemptionSchema.index({ deal: 1, user: 1 }, { unique: false });

export const DealRedemption = mongoose.model<IDealRedemption>('DealRedemption', DealRedemptionSchema);
