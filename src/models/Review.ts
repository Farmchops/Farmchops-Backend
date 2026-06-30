import mongoose, { Document, Schema } from 'mongoose';

export interface IReview extends Document {
  orderId: mongoose.Types.ObjectId;
  buyerId: mongoose.Types.ObjectId;
  token: string;
  tokenExpiresAt: Date;
  rating?: number;
  comment?: string;
  isSubmitted: boolean;
  submittedAt?: Date;
  reminderCount: number;
  lastReminderSentAt?: Date;
}

const ReviewSchema = new Schema<IReview>(
  {
    orderId: { type: Schema.Types.ObjectId, ref: 'Order', required: true, unique: true },
    buyerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    token: { type: String, required: true, unique: true, index: true },
    tokenExpiresAt: { type: Date, required: true },
    rating: { type: Number, min: 1, max: 5 },
    comment: { type: String, trim: true, maxlength: 1000 },
    isSubmitted: { type: Boolean, default: false },
    submittedAt: { type: Date },
    reminderCount: { type: Number, default: 0 },
    lastReminderSentAt: { type: Date },
  },
  { timestamps: true }
);

export const Review = mongoose.model<IReview>('Review', ReviewSchema);
