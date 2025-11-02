// src/controllers/admin/adminManagementController.ts
import { Response } from 'express';
import User from '../models/User';
import { AuthRequest } from '../middleware/auth';
import { getPermissionsForRole } from '../utils/permissions';

// List all admins (super admin only)
export const listAdmins = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { status, adminRole, search } = req.query;

    // Build filter
    const filter: any = { role: 'admin' };

    // Filter by active status
    if (status === 'active') {
      filter.isActive = true;
    } else if (status === 'inactive') {
      filter.isActive = false;
    }

    // Filter by admin role
    if (adminRole) {
      filter.adminRole = adminRole;
    }

    // Search by name or email
    if (search) {
      filter.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    const admins = await User.find(filter)
      .select('-password -verificationCode -resetPasswordCode')
      .populate('invitedBy', 'firstName lastName email')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: {
        admins,
        total: admins.length
      }
    });
  } catch (error) {
    console.error('List admins error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch admins'
    });
  }
};

// Get single admin details (super admin only)
export const getAdminById = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;

    const admin = await User.findOne({ _id: id, role: 'admin' })
      .select('-password -verificationCode -resetPasswordCode')
      .populate('invitedBy', 'firstName lastName email');

    if (!admin) {
      res.status(404).json({
        success: false,
        message: 'Admin not found'
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: admin
    });
  } catch (error) {
    console.error('Get admin error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch admin'
    });
  }
};

// Update admin role/permissions (super admin only)
export const updateAdminRole = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;
    const { adminRole } = req.body;

    if (!adminRole) {
      res.status(400).json({
        success: false,
        message: 'Admin role is required'
      });
      return;
    }

    // Validate admin role
  const validRoles = ['inventory_officer', 'operations_officer', 'logistics', 
             'customer_support', 'finance', 'admin', 'rider'];
    if (!validRoles.includes(adminRole)) {
      res.status(400).json({
        success: false,
        message: 'Invalid admin role'
      });
      return;
    }

    const admin = await User.findOne({ _id: id, role: 'admin' });

    if (!admin) {
      res.status(404).json({
        success: false,
        message: 'Admin not found'
      });
      return;
    }

    // Cannot change super admin role
    if (admin.adminRole === 'super_admin') {
      res.status(403).json({
        success: false,
        message: 'Cannot modify super admin role'
      });
      return;
    }

    // Update role and permissions
    admin.adminRole = adminRole as any;
    admin.permissions = getPermissionsForRole(adminRole);
    await admin.save();

    res.status(200).json({
      success: true,
      message: 'Admin role updated successfully',
      data: {
        id: admin._id,
        email: admin.email,
        adminRole: admin.adminRole,
        permissions: admin.permissions
      }
    });
  } catch (error) {
    console.error('Update admin role error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update admin role'
    });
  }
};

// Toggle admin active status (super admin only)
export const toggleAdminStatus = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;

    if (typeof isActive !== 'boolean') {
      res.status(400).json({
        success: false,
        message: 'isActive must be a boolean'
      });
      return;
    }

    const admin = await User.findOne({ _id: id, role: 'admin' });

    if (!admin) {
      res.status(404).json({
        success: false,
        message: 'Admin not found'
      });
      return;
    }

    // Cannot deactivate super admin
    if (admin.adminRole === 'super_admin') {
      res.status(403).json({
        success: false,
        message: 'Cannot deactivate super admin'
      });
      return;
    }

    // Cannot deactivate yourself
    if (String(admin._id) === String(req.user?._id)) {
      res.status(403).json({
        success: false,
        message: 'Cannot deactivate your own account'
      });
      return;
    }

    admin.isActive = isActive;
    await admin.save();

    res.status(200).json({
      success: true,
      message: `Admin ${isActive ? 'activated' : 'deactivated'} successfully`,
      data: {
        id: admin._id,
        email: admin.email,
        isActive: admin.isActive
      }
    });
  } catch (error) {
    console.error('Toggle admin status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update admin status'
    });
  }
};


export const updateAdminPermissions = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;
    const { permissions } = req.body;

    if (!permissions || !Array.isArray(permissions)) {
      res.status(400).json({
        success: false,
        message: 'Permissions must be an array'
      });
      return;
    }

    // Validate permissions - import PERMISSIONS from utils
    const { PERMISSIONS } = require('../utils/permissions');
    const validPermissions = Object.values(PERMISSIONS);

    // Check if all provided permissions are valid
    const invalidPermissions = permissions.filter(
      (perm: string) => !validPermissions.includes(perm)
    );

    if (invalidPermissions.length > 0) {
      res.status(400).json({
        success: false,
        message: `Invalid permissions: ${invalidPermissions.join(', ')}`
      });
      return;
    }

    const admin = await User.findOne({ _id: id, role: 'admin' });

    if (!admin) {
      res.status(404).json({
        success: false,
        message: 'Admin not found'
      });
      return;
    }

    // Cannot modify super admin permissions
    if (admin.adminRole === 'super_admin') {
      res.status(403).json({
        success: false,
        message: 'Cannot modify super admin permissions'
      });
      return;
    }

    // Update permissions
    admin.permissions = permissions;
    await admin.save();

    res.status(200).json({
      success: true,
      message: 'Admin permissions updated successfully',
      data: {
        id: admin._id,
        email: admin.email,
        adminRole: admin.adminRole,
        permissions: admin.permissions
      }
    });
  } catch (error) {
    console.error('Update admin permissions error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update admin permissions'
    });
  }
};

// Delete admin (super admin only - use with caution)
export const deleteAdmin = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;

    const admin = await User.findOne({ _id: id, role: 'admin' });

    if (!admin) {
      res.status(404).json({
        success: false,
        message: 'Admin not found'
      });
      return;
    }

    // Cannot delete super admin
    if (admin.adminRole === 'super_admin') {
      res.status(403).json({
        success: false,
        message: 'Cannot delete super admin'
      });
      return;
    }

    // Cannot delete yourself
    if (String(admin._id) === String(req.user?._id)) {
      res.status(403).json({
        success: false,
        message: 'Cannot delete your own account'
      });
      return;
    }

    await User.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: 'Admin deleted successfully'
    });
  } catch (error) {
    console.error('Delete admin error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete admin'
    });
  }
};

