import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { Review } from '../models/Review';
import { AuthRequest } from '../middleware/auth';

export const validateToken = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { token } = req.params;

    const review = await Review.findOne({ token })
      .populate('orderId', 'orderNumber')
      .populate('buyerId', 'firstName lastName');

    if (!review) {
      return res.status(404).json({ success: false, message: 'Review link is invalid.' });
    }

    if (review.isSubmitted) {
      return res.status(400).json({ success: false, message: 'You have already submitted a review for this order.' });
    }

    if (new Date() > review.tokenExpiresAt) {
      return res.status(400).json({ success: false, message: 'This review link has expired.' });
    }

    const order = review.orderId as any;
    const buyer = review.buyerId as any;

    return res.json({
      success: true,
      data: {
        orderNumber: order?.orderNumber,
        customerName: (buyer?.firstName as string || '').trim() || 'there',
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const submitReview = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { token, rating, comment } = req.body;

    if (!token) {
      return res.status(400).json({ success: false, message: 'Token is required.' });
    }

    const parsedRating = Number(rating);
    if (!parsedRating || parsedRating < 1 || parsedRating > 5) {
      return res.status(400).json({ success: false, message: 'Rating must be a number between 1 and 5.' });
    }

    const review = await Review.findOne({ token });

    if (!review) {
      return res.status(404).json({ success: false, message: 'Review link is invalid.' });
    }

    if (review.isSubmitted) {
      return res.status(400).json({ success: false, message: 'You have already submitted a review for this order.' });
    }

    if (new Date() > review.tokenExpiresAt) {
      return res.status(400).json({ success: false, message: 'This review link has expired.' });
    }

    review.rating = parsedRating;
    review.comment = comment?.trim() || undefined;
    review.isSubmitted = true;
    review.submittedAt = new Date();
    await review.save();

    return res.json({ success: true, message: 'Thank you for your review!' });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const listReviews = async (req: AuthRequest, res: Response): Promise<Response> => {
  try {
    const { page = 1, limit = 20, rating, submitted } = req.query as any;

    const query: any = {};
    if (rating) query.rating = Number(rating);
    if (submitted !== undefined) query.isSubmitted = submitted === 'true';

    const reviews = await Review.find(query)
      .populate('orderId', 'orderNumber totalAmount createdAt')
      .populate('buyerId', 'firstName lastName email')
      .sort('-createdAt')
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit));

    const total = await Review.countDocuments(query);

    return res.json({
      success: true,
      data: { reviews, total, page: Number(page), pageSize: Number(limit) },
    });
  } catch (error) {
    console.error('[REVIEWS] listReviews error:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const getReview = async (req: AuthRequest, res: Response): Promise<Response> => {
  try {
    const id = req.params.id as string;

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid review ID' });
    }

    const review = await Review.findById(id)
      .populate('orderId', 'orderNumber totalAmount items createdAt')
      .populate('buyerId', 'firstName lastName email phone');

    if (!review) {
      return res.status(404).json({ success: false, message: 'Review not found' });
    }

    return res.json({ success: true, data: { review } });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const deleteReview = async (req: AuthRequest, res: Response): Promise<Response> => {
  try {
    const id = req.params.id as string;

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid review ID' });
    }

    const review = await Review.findByIdAndDelete(id);

    if (!review) {
      return res.status(404).json({ success: false, message: 'Review not found' });
    }

    return res.json({ success: true, message: 'Review deleted successfully' });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};
