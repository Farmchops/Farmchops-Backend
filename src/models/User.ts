import mongoose, { Document, Schema} from 'mongoose';
import bcrypt from 'bcryptjs'

export interface IUser extends Document {
    email: string;
    password: string;
    fullName: string;
    phone: string;
    role: 'customer' | 'admin';
    profile: {
        address?: string;
        dateOfBirth?: Date;
        isVerified: boolean
    };
    wallet: {
        balance: number;
    };
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;

    comparePassword(candidatePassword: string): Promise<boolean>;
    toJSON(): any;
}

const UserSchema = new Schema<IUser>({
    email: {
        type: String,
        required: [ true, 'Email is required'],
        unique: true,
        lowercase: true,
        trim: true,
        match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
    },
    
    password: {
        type: String,
        required: [true, 'Password is required'],
        minlength: [6, 'Password must be at least 6 characters'],
        select: false
    },

    fullName: {
        type: String,
        required: [true, 'Full name is required'],
        trim: true,
     },

     phone: {
        type: String,
        required: [true, 'Phone number is required'],
        trim: true,
        match: [/^(\+234|0)[789][01]\d{8}$/, 'Please enter a valid Nigerian phone number']
     },
     
     role: {
        type: String,
        enum: [ 'customer', 'admin'],
        default: 'customer'
     },

     profile: {
        address: {
            type: String,
            trim: true,
            maxlength: [200, 'Address cannot exceed 200 characters ']
        },

        dateOfBirth: {
            type: Date
        },

        isVerified: {
            type: Boolean,
            default: false
        }
     },

     wallet: {
        balance: {
            type: Number,
            default: 0,
            min: [0, 'Wallet balance cannot be negative']
        }
     },

     isActive: {
        type: Boolean,
        default: true
     }
}, {
    timestamps: true,
    toJSON: { virtuals: true},
    toObject: { virtuals: true}
});

UserSchema.index({ email: 1 });
UserSchema.index({ phone: 1 });
UserSchema.index({ role: 1 });
UserSchema.index({ createdAt: -1});
