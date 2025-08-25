import mongoose, { Document, Schema } from 'mongoose';

export interface ICategory extends Document {
    name: String;
    description?: string;
    slug: String;
    isActive: boolean;
    productCount: number; // for admin dashboard
    createdAt: Date;
    updatedAt: Date;
}

const CategorySchema: Schema = new Schema({
    name: {
        type: String,
        required: [ true, 'Category name is required'],
        trim: true,
        unique: true,
        maxlength: [50, 'Category name cannot exceed 50 characters']
    },

    description: {
        type: String,
        trim: true,
        maxlength: [200, 'Description cannot exceed 200 characters']
    },

   slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true
  },

  isActive: {
    type: Boolean,
    default: true
  },

  productCount: {
    type: Number,
    default: 0,
    min: 0
  }

}, {
    timestamps: true,
    toJSON: { virtuals: true},
    toObject: { virtuals: true}
});

CategorySchema.index({ slug:1 });
CategorySchema.index({ isActive: 1})

CategorySchema.pre<ICategory>('save', function(next) {
    if (this.isModified('name')) {
        this.slug = this.name
          .toLowerCase()
          .replace(/[^\w\s-]/g, '')
           .replace(/\s+/g, '-')
           .trim()
    }
    next()
})

CategorySchema.methods.updateProductCount = async function() {
  const Product = mongoose.model('Product');
  this.productCount = await Product.countDocuments({ 
    category: this._id, 
    status: { $ne: 'inactive' } 
  });
  return this.save();
};

export const Category = mongoose.model<ICategory>('Category', CategorySchema);