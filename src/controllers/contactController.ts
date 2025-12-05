import { Request, Response } from 'express';
import { ContactMessage } from '../models/ContactMessage';
import emailService from '../services/emailService';

/**
 * POST /api/contact
 * Submit a contact form message
 */
export const submitContactForm = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { email, fullName, message } = req.body;

    // Validation
    if (!email || typeof email !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Valid email is required'
      });
    }

    if (!fullName || typeof fullName !== 'string' || fullName.trim().length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Full name is required and must be at least 2 characters'
      });
    }

    if (!message || typeof message !== 'string' || message.trim().length < 10) {
      return res.status(400).json({
        success: false,
        message: 'Message is required and must be at least 10 characters'
      });
    }

    // Email format validation
    const emailRegex = /^\S+@\S+\.\S+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid email format'
      });
    }

    // Save to database
    const contactMessage = await ContactMessage.create({
      email: email.trim().toLowerCase(),
      fullName: fullName.trim(),
      message: message.trim(),
      status: 'new'
    });

    // Send notification email to support team
    try {
      await emailService.sendContactNotificationToSupport({
        email: contactMessage.email,
        fullName: contactMessage.fullName,
        message: contactMessage.message,
        submittedAt: contactMessage.createdAt
      });
    } catch (emailError) {
      console.error('Failed to send support notification email:', emailError);
      // Don't fail the request if email fails - message is already saved in DB
    }

    // Send confirmation email to user
    try {
      await emailService.sendContactConfirmationEmail(contactMessage.email, {
        fullName: contactMessage.fullName,
        message: contactMessage.message
      });
    } catch (emailError) {
      console.error('Failed to send confirmation email to user:', emailError);
      // Don't fail the request if email fails
    }

    return res.status(200).json({
      success: true,
      message: 'Contact message received successfully'
    });
  } catch (error) {
    console.error('Contact form submission error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to process contact request'
    });
  }
};
