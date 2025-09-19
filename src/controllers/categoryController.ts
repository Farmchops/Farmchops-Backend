// src/controllers/categoryController.ts
/// <reference path="../types/express/index.d.ts" />
import { Request, Response } from 'express'
import { Category, ICategory } from '../models/Category';
import { Product } from '../models/Product'
import { validationResult } from 'express-validator'
import { IUser } from '../models/User'

//GET /api/categories
export const getCategories = async (req: Request, res: Response): Promise<void> => {
    try {
        const { includeInactive } = req.query;
        if (!req.user) {
            res.status(401).json({
                success: false,
                message: 'Authentication required'
            });
            return;
        }
        const isAdmin = req.user.role === 'admin'

        // Only admins can see inactive categories
        const filter = isAdmin && includeInactive === 'true'
        ?{}
        : { isActive: true };

        const categories = await Category.find(filter)
        .sort({ name: 1 })
        .select('name description slug isActive productCount createdAt')

        res.json({
            success: true,
            data: {
                categories,
                count: categories.length
            }
        })
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching categories',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}

export const getCategoryBySlug = async (req: Request, res: Response): Promise<void> => {
   try {
    const {slug} = req.params
    const { includeProducts } = req.query;

    const category = await Category.findOne({
        slug,
        ...(req.user?.role !== 'admin' && { isActive: true})
    });

    if (!category){
        res.status(404).json({
            success: false,
            message: 'Category not found'
        })
        return
    }

    let responseData: any = category.toObject();

    if (includeProducts === 'true'){
        const products = await Product.find({
            category: category._id,
            status: 'active'
        }).select('name slug pricing.retail.price image status')

        responseData.products = products
      }

      res.json({
        success: true,
        data: responseData
      })
   }  catch (error) {
    console.error('Get category by slug error:', error);
    res.status(500).json({
        success: false,
        message:'Failed to fetch category'
    });
  }
};

//POST /api/admin/categories - create category (admin only)
export const createCategory = async (req: Request, res: Response): Promise<void> => {
    try{
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          res.status(400).json({
            success: false,
            message: 'Validation failed',
            errors: errors.array()
          });
           return;
        }

        const {name, description, isActive = true} = req.body

        const existingCategory = await Category.findOne({
            name: { $regex: new RegExp(`^${name}$`, 'i')}
        })

        if (existingCategory) {
            res.status(409).json({
                success: false,
                message: 'Category with this name already exists'
              });
              return
            }

            const category = new Category({
                name: name.trim(),
                description: description?.trim(),
                isActive
            });

            await category.save()

            res.status(201).json({
                success: true,
                message: 'Category created successfully',
                data: category
            });
        } catch (error) {
            console.error('Create category error:', error)
            res.status(500).json({
                success: false,
                message: 'Failed to create category'
            });
          }
        };

// PUT /api/admin/categories/:id - Update category (admin only)
export const updateCategory = async (req: Request, res: Response): Promise<void> => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            res.status(400).json({
                success: false,
                message: 'Validation failed',
                errors: errors.array()
            });
            return
        }

        const { id } = req.params;
        const { name, description, isActive} = req.body

        const category = await Category.findById(id);
        if (!category) {
            res.status(404).json({
                success: false,
                message: 'Category not found'
            });
            return;
        }

        if (name && name !== category.name){
            const existingCategory = await Category.findOne({
                _id: { $ne: id },
                name:  { $regex: new RegExp(`^${name}$`, 'i') }
            });

            if (existingCategory) {
                res.status(409).json({
                    success:false,
                    message: 'Category with this name already exists'
                })
                return;
            }
        }

        //update fields
        if (name) category.name = name.trim();
        if (description !== undefined) category.description = description?.trim()
        if (isActive !== undefined) category.isActive = isActive;

        await category.save()

        res.json({
            success: true,
            message: 'Category updated successfully',
            data: category
        })
      }  catch (error) {
        console.error('Update category error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update category'
        });
      }
    };

// DELETE /api/admin/categories/:id - Delete category (admin only)
export const deleteCategory = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { force } = req.query;

    const category = await Category.findById(id);
    if (!category) {
      res.status(404).json({
        success: false,
        message: 'Category not found'
      });
      return;
    }

    // Check if category has products
    const productCount = await Product.countDocuments({ category: id });
    
    if (productCount > 0 && force !== 'true') {
      res.status(400).json({
        success: false,
        message: `Cannot delete category with ${productCount} products. Use force=true to delete anyway.`,
        data: { productCount }
      });
      return;
    }

    if (force === 'true' && productCount > 0) {
      // Remove category reference from products
      await Product.updateMany(
        { category: id },
        { $unset: { category: 1 } }
      );
    }

    await Category.findByIdAndDelete(id);

    res.json({
      success: true,
      message: 'Category deleted successfully',
      data: { deletedProductReferences: productCount }
    });
  } catch (error) {
    console.error('Delete category error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete category'
    });
  }
};

// GET /api/admin/categories/stats - Get category statistics (admin only)
export const getCategoryStats = async (req: Request, res: Response): Promise<void> => {
  try {
    const totalCategories = await Category.countDocuments();
    const activeCategories = await Category.countDocuments({ isActive: true });
    const inactiveCategories = totalCategories - activeCategories;

    // Get categories with product counts
    const categoriesWithProducts = await Category.aggregate([
      {
        $lookup: {
          from: 'products',
          localField: '_id',
          foreignField: 'category',
          as: 'products'
        }
      },
      {
        $project: {
          name: 1,
          slug: 1,
          isActive: 1,
          productCount: { $size: '$products' },
          createdAt: 1
        }
      },
      { $sort: { productCount: -1 } }
    ]);

    res.json({
      success: true,
      data: {
        summary: {
          total: totalCategories,
          active: activeCategories,
          inactive: inactiveCategories
        },
        categories: categoriesWithProducts
      }
    });
  } catch (error) {
    console.error('Get category stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch category statistics'
    });
  }
};
