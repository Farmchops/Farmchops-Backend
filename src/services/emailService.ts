import nodemailer from 'nodemailer';
import type SMTPTransport from 'nodemailer/lib/smtp-transport';
import { verificationTemplate } from '../templates/emails/verification';
import { passwordResetTemplate } from '../templates/emails/passwordReset';
import { adminInviteTemplate } from '../templates/emails/adminInvite';
import { orderConfirmationTemplate } from '../templates/emails/orderConfirmation';
import { paymentSuccessTemplate } from '../templates/emails/paymentSuccess';
import { groupReadyTemplate } from '../templates/emails/groupReady';
import { waitlistPromotionTemplate } from '../templates/emails/waitlistPromotion';
import { contactSupportTemplate, contactConfirmationTemplate } from '../templates/emails/contactNotification';
import { marketerWelcomeTemplate } from '../templates/emails/marketerWelcome';
import { newOrderNotificationTemplate } from '../templates/emails/newOrderNotification';

const NOTIFY_EMAILS = ['admin@farmchops.com', 'mercyemmanuel@farmchops.com'];

const createTransporter = () => {
  const port = parseInt(process.env.EMAIL_PORT || '465');
  const isSSL = port === 465;
  const config: SMTPTransport.Options = {
    host: process.env.EMAIL_HOST || 'smtp.hostinger.com',
    port,
    secure: true,
    auth: { user: process.env.EMAIL_USER || '', pass: process.env.EMAIL_PASS || '' },
    authMethod: 'LOGIN',
    tls: { rejectUnauthorized: false }
  };
  if (!isSSL) config.requireTLS = true;
  return nodemailer.createTransport(config);
};

class EmailService {
  private transporter: any;

  private getTransporter() {
    if (!this.transporter) this.transporter = createTransporter();
    return this.transporter;
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.getTransporter().verify();
      console.log('Email service connected successfully');
      return true;
    } catch (error: any) {
      console.error('Email service connection failed:', error.message);
      return false;
    }
  }

  async sendVerificationEmail(email: string, code: string): Promise<boolean> {
    try {
      const t = verificationTemplate(code);
      const info = await this.getTransporter().sendMail({
        from: process.env.EMAIL_FROM || `"Farmchops" <${process.env.EMAIL_USER}>`,
        to: email, subject: t.subject, text: t.text, html: t.html
      });
      console.log('Verification email sent:', info.messageId);
      return true;
    } catch (error) {
      console.error('Error sending verification email:', error);
      return false;
    }
  }

  async sendPasswordResetEmail(email: string, code: string): Promise<boolean> {
    try {
      const t = passwordResetTemplate(code);
      const info = await this.getTransporter().sendMail({
        from: process.env.EMAIL_FROM || `"Farmchops" <${process.env.EMAIL_USER}>`,
        to: email, subject: t.subject, text: t.text, html: t.html
      });
      console.log('Password reset email sent:', info.messageId);
      return true;
    } catch (error) {
      console.error('Error sending password reset email:', error);
      return false;
    }
  }

  async sendAdminInviteEmail(email: string, otp: string, adminRole: string): Promise<boolean> {
    try {
      const adminSignupUrl = process.env.ADMIN_SIGNUP_URL ||
        (process.env.NODE_ENV === 'production'
          ? 'https://farmchops.com/admin/signup'
          : 'https://staging.farmchops.com/admin/signup');
      const signupLink = `${adminSignupUrl}?email=${encodeURIComponent(email)}`;
      const t = adminInviteTemplate(otp, adminRole, signupLink);
      const info = await this.getTransporter().sendMail({
        from: process.env.EMAIL_FROM || `"Farmchops Admin" <${process.env.EMAIL_USER}>`,
        to: email, subject: t.subject, text: t.text, html: t.html
      });
      console.log('Admin invite email sent:', info.messageId);
      return true;
    } catch (error) {
      console.error('Error sending admin invite email:', error);
      return false;
    }
  }

  async sendOrderConfirmationEmail(email: string, orderData: any): Promise<boolean> {
    try {
      const t = orderConfirmationTemplate(orderData);
      const info = await this.getTransporter().sendMail({
        from: process.env.EMAIL_FROM || `"Farmchops" <${process.env.EMAIL_USER}>`,
        to: email, subject: t.subject, text: t.text, html: t.html
      });
      console.log('Order confirmation email sent:', info.messageId);
      return true;
    } catch (error) {
      console.error('Error sending order confirmation email:', error);
      return false;
    }
  }

  async sendPaymentSuccessEmail(email: string, data: any): Promise<boolean> {
    try {
      const t = paymentSuccessTemplate(data);
      const info = await this.getTransporter().sendMail({
        from: process.env.EMAIL_FROM || `"Farmchops" <${process.env.EMAIL_USER}>`,
        to: email, subject: t.subject, text: t.text, html: t.html
      });
      console.log('Payment success email sent:', info.messageId);
      return true;
    } catch (error) {
      console.error('Error sending payment success email:', error);
      return false;
    }
  }

  async sendGroupReadyEmail(email: string, data: any): Promise<boolean> {
    try {
      const t = groupReadyTemplate(data);
      const info = await this.getTransporter().sendMail({
        from: process.env.EMAIL_FROM || `"Farmchops" <${process.env.EMAIL_USER}>`,
        to: email, subject: t.subject, text: t.text, html: t.html
      });
      console.log('Group ready email sent:', info.messageId);
      return true;
    } catch (error) {
      console.error('Error sending group ready email:', error);
      return false;
    }
  }

  async sendWaitlistPromotionEmail(email: string, data: any): Promise<boolean> {
    try {
      const t = waitlistPromotionTemplate(data);
      const info = await this.getTransporter().sendMail({
        from: process.env.EMAIL_FROM || `"Farmchops" <${process.env.EMAIL_USER}>`,
        to: email, subject: t.subject, text: t.text, html: t.html
      });
      console.log('Waitlist promotion email sent:', info.messageId);
      return true;
    } catch (error) {
      console.error('Error sending waitlist promotion email:', error);
      return false;
    }
  }

  async sendContactNotificationToSupport(data: any): Promise<boolean> {
    try {
      const supportEmail = process.env.SUPPORT_EMAIL || 'support@farmchops.com';
      const t = contactSupportTemplate(data);
      const info = await this.getTransporter().sendMail({
        from: process.env.EMAIL_FROM || `"Farmchops Contact" <${process.env.EMAIL_USER}>`,
        to: supportEmail, subject: t.subject, text: t.text, html: t.html
      });
      console.log('Contact notification sent to support:', info.messageId);
      return true;
    } catch (error) {
      console.error('Error sending contact notification to support:', error);
      return false;
    }
  }

  async sendContactConfirmationEmail(email: string, data: any): Promise<boolean> {
    try {
      const t = contactConfirmationTemplate(data);
      const info = await this.getTransporter().sendMail({
        from: process.env.EMAIL_FROM || `"Farmchops" <${process.env.EMAIL_USER}>`,
        to: email, subject: t.subject, text: t.text, html: t.html
      });
      console.log('Contact confirmation email sent:', info.messageId);
      return true;
    } catch (error) {
      console.error('Error sending contact confirmation email:', error);
      return false;
    }
  }

  async sendMarketerWelcomeEmail(email: string, marketerData: {
    firstName: string; lastName: string; marketingCode: string; commissionRate: number;
  }): Promise<boolean> {
    try {
      const t = marketerWelcomeTemplate(marketerData);
      const info = await this.getTransporter().sendMail({
        from: `"Farmchops Marketing" <${process.env.EMAIL_USER}>`,
        to: email, subject: t.subject, text: t.text, html: t.html
      });
      console.log(`Marketer welcome email sent to ${email}:`, info.messageId);
      return true;
    } catch (error) {
      console.error('Error sending marketer welcome email:', error);
      return false;
    }
  }

  async sendNewOrderNotificationEmail(orderData: {
    orderNumber: string;
    customerName: string;
    customerEmail: string;
    totalAmount: number;
    deliveryAddress: string;
    items: { productName: string; quantity: number; price: number }[];
  }): Promise<boolean> {
    try {
      const t = newOrderNotificationTemplate(orderData);
      await this.getTransporter().sendMail({
        from: `"Farmchops Orders" <${process.env.EMAIL_USER}>`,
        to: NOTIFY_EMAILS.join(', '),
        subject: t.subject,
        html: t.html
      });
      return true;
    } catch (error) {
      console.error('Error sending new order notification email:', error);
      return false;
    }
  }
}

export const emailService = new EmailService();
export default emailService;
