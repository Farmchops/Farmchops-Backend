import mongoose, { Document, Schema } from 'mongoose';

export interface IContactMessage extends Document {
  email: string;
  fullName: string;
  message: string;
  status: 'new' | 'read' | 'responded';
  createdAt: Date;
  updatedAt: Date;
}

const contactMessageSchema = new Schema<IContactMessage>(
  {
    email: {
      type: String,
      required: [true, 'Email is required'],
      trim: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email address']
    },
    fullName: {
      type: String,
      required: [true, 'Full name is required'],
      trim: true,
      minlength: [2, 'Full name must be at least 2 characters']
    },
    message: {
      type: String,
      required: [true, 'Message is required'],
      trim: true,
      minlength: [10, 'Message must be at least 10 characters']
    },
    status: {
      type: String,
      enum: ['new', 'read', 'responded'],
      default: 'new'
    }
  },
  {
    timestamps: true
  }
);

// Index for faster queries
contactMessageSchema.index({ status: 1, createdAt: -1 });
contactMessageSchema.index({ email: 1 });

export const ContactMessage = mongoose.model<IContactMessage>('ContactMessage', contactMessageSchema);
