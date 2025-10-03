// src/controllers/productController.ts
import { Request, Response } from 'express';
import { Product, IProduct } from '../models/Product';
import { Category } from '../models/Category';
import { validationResult } from 'express-validator';
import { deleteMultipleImages } from '../utils/imageHelper';



// VALIDATION HELPER
const validateProductImages = (images: string[] | undefined): { valid: boolean; message?: string } => {
  if (!images) return { valid: true }; // Images are optional
  
  if (!Array.isArray(images)) {
    return { valid: false, message: 'Images must be an array' };
  }
  
  if (images.length > 5) {
    return { valid: false, message: 'Maximum 5 images allowed' };
  }
  
  // Check file extensions (assuming URLs end with file extensions)
  const validExtensions = ['.jpg', '.jpeg', '.png', '.JPG', '.JPEG', '.PNG'];
  for (const image of images) {
    if (typeof image !== 'string') {
      return { valid: false, message: 'Image URLs must be strings' };
    }
    
    const hasValidExtension = validExtensions.some(ext => image.endsWith(ext));
    if (!hasValidExtension) {
      return { valid: false, message: 'Only JPG and PNG images are allowed' };
    }
  }
  
  return { valid: true };
};

// GET /api/products - List products with filters
export const getProducts = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      category,
      status,
      search,
      minPrice,
      maxPrice,
      tags,
      sort = 'createdAt',
      order = 'desc',
      page = 1,
      limit = 20
    } = req.query;

    // Build filter object
    const filter: any = {};

    // Only show active products for non-admin users
    if (req.user?.role !== 'admin') {
      filter.status = 'active';
    } else if (status) {
      filter.status = status;
    }

    // Category filter
    if (category) {
      const categoryDoc = await Category.findOne({ slug: category });
      if (categoryDoc) {
        filter.category = categoryDoc._id;
      }
    }

    // Price range filter (using retail price)
    if (minPrice || maxPrice) {
      filter['pricing.retail.price'] = {};
      if (minPrice) filter['pricing.retail.price'].$gte = Number(minPrice) * 100; // Convert to kobo
      if (maxPrice) filter['pricing.retail.price'].$lte = Number(maxPrice) * 100;
    }

    // Tags filter
    if (tags) {
      const tagArray = Array.isArray(tags) ? tags : [tags];
      filter.tags = { $in: tagArray };
    }

    // Search filter
    if (search) {
      filter.$text = { $search: search as string };
    }

    // Pagination
    const pageNum = Math.max(1, Number(page));
    const limitNum = Math.max(1, Math.min(50, Number(limit))); // Max 50 items per page
    const skip = (pageNum - 1) * limitNum;

    // Sort options
    const sortOptions: any = {};
    const validSorts = ['createdAt', 'name', 'pricing.retail.price', 'stats.viewCount', 'stats.orderCount'];
    const sortField = validSorts.includes(sort as string) ? (sort as string) : 'createdAt';
    sortOptions[sortField] = order === 'asc' ? 1 : -1;

    // Execute query with population
    const products = await Product.find(filter)
      .populate('category', 'name slug')
      .select('-__v')
      .sort(sortOptions)
      .skip(skip)
      .limit(limitNum)
      .lean();

    // Get total count for pagination
    const totalProducts = await Product.countDocuments(filter);
    const totalPages = Math.ceil(totalProducts / limitNum);

    res.json({
      success: true,
      data: {
        products,
        pagination: {
          currentPage: pageNum,
          totalPages,
          totalProducts,
          hasNextPage: pageNum < totalPages,
          hasPrevPage: pageNum > 1
        }
      }
    });
  } catch (error) {
    console.error('Get products error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch products'
    });
  }
};

// GET /api/products/:slug - Get single product
export const getProductBySlug = async (req: Request, res: Response): Promise<void> => {
  try {
    const { slug } = req.params;

    const product = await Product.findOne({ 
      slug,
      ...(req.user?.role !== 'admin' && { status: 'active' })
    }).populate('category', 'name slug description');

    if (!product) {
      res.status(404).json({
        success: false,
        message: 'Product not found'
      });
      return;
    }

    // Increment view count (don't await to avoid slowing response)
    Product.findByIdAndUpdate(
      product._id,
      { $inc: { 'stats.viewCount': 1 } }
    ).catch(err => console.error('Failed to increment view count:', err));

    res.json({
      success: true,
      data: product
    });
  } catch (error) {
    console.error('Get product by slug error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch product'
    });
  }
};

// GET /api/products/search - Search products
export const searchProducts = async (req: Request, res: Response): Promise<void> => {
  try {
    const { q, category, limit = 10 } = req.query;

    if (!q || typeof q !== 'string') {
      res.status(400).json({
        success: false,
        message: 'Search query is required'
      });
      return;
    }

    const filter: any = {
      $text: { $search: q },
      ...(req.user?.role !== 'admin' && { status: 'active' })
    };

    // Category filter
    if (category) {
      const categoryDoc = await Category.findOne({ slug: category });
      if (categoryDoc) {
        filter.category = categoryDoc._id;
      }
    }

    const products = await Product.find(filter)
      .populate('category', 'name slug')
      .select('name slug pricing.retail.price images category tags')
      .sort({ score: { $meta: 'textScore' } })
      .limit(Math.min(50, Number(limit)));

    res.json({
      success: true,
      data: {
        products,
        count: products.length,
        query: q
      }
    });
  } catch (error) {
    console.error('Search products error:', error);
    res.status(500).json({
      success: false,
      message: 'Search failed'
    });
  }
};

// POST /api/products - Create product (admin only)
export const createProduct = async (req: Request, res: Response): Promise<void> => {
   console.log('✅ CreateProduct function hit!');
  console.log('Files:', req.files);
  console.log('Body:', req.body);
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
      return;
    }

    const uploadedImages = req.files as Express.Multer.File[];
    const images = uploadedImages?.map(file => file.path) || [];

    if (images.length === 0){
      res.status(400).json({
      success: false,
      message: 'At least one product image is required'
      })
      return;
    }

    let {
      name,
      description,
      category,
      pricing,
      inventory,
      tags,
      status = 'draft'
    } = req.body;

     if (typeof pricing === 'string') {
      pricing = JSON.parse(pricing);
    }
    if (typeof inventory === 'string') {
      inventory = JSON.parse(inventory);
    }
    if (typeof tags === 'string') {
      tags = JSON.parse(tags);
    }
      // Validate bulk price < retail price
    if (pricing?.bulk && pricing?.retail) {
      if (pricing.bulk.price >= pricing.retail.price) {
        // Delete uploaded images
        if (images.length > 0) await deleteMultipleImages(images);
        
        res.status(400).json({
          success: false,
          message: 'Bulk price must be less than retail price'
        });
        return;
      }
    }

    //Image validation
    const imageValidation = validateProductImages(images);
    if (!imageValidation.valid) {

      if (images.length > 0) await deleteMultipleImages(images);
      res.status(400).json({
        success: false,
        message: imageValidation.message
      });
      return;
    }
 
     // BULK PRICE VALIDATION HERE
    if (pricing?.bulk && pricing?.retail) {
      if (pricing.bulk.price >= pricing.retail.price) {

        if (images.length > 0) await deleteMultipleImages
        res.status(400).json({
          success: false,
          message: 'Bulk price must be less than retail price'
        });
        return;
      }
    }

    // Verify category exists
    const categoryDoc = await Category.findById(category);
    if (!categoryDoc) {

      if (images.length > 0) await deleteMultipleImages
      res.status(400).json({
        success: false,
        message: 'Invalid category ID'
      });
      return;
    }

    // Check if product name already exists
    const existingProduct = await Product.findOne({
      name: { $regex: new RegExp(`^${name}$`, 'i') }
    });

    if (existingProduct) {

      if (images.length > 0) await deleteMultipleImages(images);
      res.status(409).json({
        success: false,
        message: 'Product with this name already exists'
      });
      return;
    }

    const product = new Product({
      name: name.trim(),
      description: description?.trim(),
      images: images,
      category,
      pricing,
      inventory,
      tags: tags || [],
      status
    });

    await product.save();

    // Update category product count
    await Category.findByIdAndUpdate(
      category,
      { $inc: { productCount: 1 } }
    );

    // Populate category for response
    await product.populate('category', 'name slug');

    res.status(201).json({
      success: true,
      message: 'Product created successfully',
      data: product
    });
  } catch (error) {

    const uploadedImages = req.files as Express.Multer.File[];
    if (uploadedImages.length > 0) {
      await deleteMultipleImages(uploadedImages.map(f => f.path))
    }
    console.error('Create product error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create product'
    });
  }
};

// PUT /api/products/:id - Update product (admin only)
export const updateProduct = async (req: Request, res: Response): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
      return;
    }

    const { id } = req.params;
    const {
      name,
      description,
      images,
      category,
      pricing,
      inventory,
      tags,
      status
    } = req.body;

     // IMAGE VALIDATION HERE
    if (images !== undefined) {
      const imageValidation = validateProductImages(images);
      if (!imageValidation.valid) {
        res.status(400).json({
          success: false,
          message: imageValidation.message
        });
        return;
      }
    }

    // BULK PRICE VALIDATION HERE
    if (pricing) {
      if (pricing.bulk && pricing.retail) {
        if (pricing.bulk.price >= pricing.retail.price) {
          res.status(400).json({
            success: false,
            message: 'Bulk price must be less than retail price'
          });
          return;
        }
      }
    }

    const product = await Product.findById(id);
    if (!product) {
      res.status(404).json({
        success: false,
        message: 'Product not found'
      });
      return;
    }

    // Check if new name conflicts with existing product
    if (name && name !== product.name) {
      const existingProduct = await Product.findOne({
        _id: { $ne: id },
        name: { $regex: new RegExp(`^${name}$`, 'i') }
      });

      if (existingProduct) {
        res.status(409).json({
          success: false,
          message: 'Product with this name already exists'
        });
        return;
      }
    }

    // Verify new category if provided
    if (category && category !== product.category?.toString()) {
      const categoryDoc = await Category.findById(category);
      if (!categoryDoc) {
        res.status(400).json({
          success: false,
          message: 'Invalid category ID'
        });
        return;
      }

      // Update product counts
      if (product.category) {
        await Category.findByIdAndUpdate(
          product.category,
          { $inc: { productCount: -1 } }
        );
      }
      await Category.findByIdAndUpdate(
        category,
        { $inc: { productCount: 1 } }
      );
    }

    // Update fields
    if (name) product.name = name.trim();
    if (description !== undefined) product.description = description?.trim();
    if (images) product.images = images;
    if (category) product.category = category;
    if (pricing) product.pricing = pricing;
    if (inventory) product.inventory = inventory;
    if (tags) product.tags = tags;
    if (status) product.status = status;

    await product.save();
    await product.populate('category', 'name slug');

    res.json({
      success: true,
      message: 'Product updated successfully',
      data: product
    });
  } catch (error) {
    console.error('Update product error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update product'
    });
  }
};

// DELETE /api/products/:id - Delete product (admin only)
export const deleteProduct = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const product = await Product.findById(id);
    if (!product) {
      res.status(404).json({
        success: false,
        message: 'Product not found'
      });
      return;
    }

    // Update category product count
    if (product.category) {
      await Category.findByIdAndUpdate(
        product.category,
        { $inc: { productCount: -1 } }
      );
    }

    await Product.findByIdAndDelete(id);

    res.json({
      success: true,
      message: 'Product deleted successfully'
    });
  } catch (error) {
    console.error('Delete product error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete product'
    });
  }
};

// GET /api/admin/products/stats - Get product statistics (admin only)
export const getProductStats = async (req: Request, res: Response): Promise<void> => {
  try {
    const totalProducts = await Product.countDocuments();
    const activeProducts = await Product.countDocuments({ status: 'active' });
    const inactiveProducts = await Product.countDocuments({ status: 'inactive' });
    const outOfStockProducts = await Product.countDocuments({ status: 'out_of_stock' });

    // Low stock products
    const lowStockProducts = await Product.find({
      $expr: {
        $lte: ['$inventory.availableStock', '$inventory.lowStockThreshold']
      },
      status: 'active'
    }).select('name inventory.availableStock inventory.lowStockThreshold');

    // Most viewed products
    const mostViewed = await Product.find({ status: 'active' })
      .populate('category', 'name')
      .select('name stats.viewCount category')
      .sort({ 'stats.viewCount': -1 })
      .limit(10);

    // Most ordered products
    const mostOrdered = await Product.find({ status: 'active' })
      .populate('category', 'name')
      .select('name stats.orderCount category')
      .sort({ 'stats.orderCount': -1 })
      .limit(10);

    res.json({
      success: true,
      data: {
        summary: {
          total: totalProducts,
          active: activeProducts,
          inactive: inactiveProducts,
          outOfStock: outOfStockProducts,
          lowStock: lowStockProducts.length
        },
        lowStockProducts,
        mostViewed,
        mostOrdered
      }
    });
  } catch (error) {
    console.error('Get product stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch product statistics'
    });
  }
};