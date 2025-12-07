import nodemailer from "nodemailer";
import type SMTPTransport from "nodemailer/lib/smtp-transport";

// Email transporter configuration
const createTransporter = () => {
  const port = parseInt(process.env.EMAIL_PORT || "465");
  const isSSL = port === 465;

  const config: SMTPTransport.Options = {
    host: process.env.EMAIL_HOST || "smtp.hostinger.com",
    port: port,
    secure: true,
    auth: {
      user: process.env.EMAIL_USER || "",
      pass: process.env.EMAIL_PASS || "",
    },
    authMethod: 'LOGIN',
    tls: {
      rejectUnauthorized: false,
    },
  };

  if (!isSSL) {
    config.requireTLS = true;
  }

  return nodemailer.createTransport(config);
};

// Simple base template
const resolveSupportEmail = () => {
  return process.env.SUPPORT_EMAIL || process.env.EMAIL_USER || 'support@farmchops.com';
};

const createSimpleEmailTemplate = (code: string, message: string) => {
  const supportEmail = resolveSupportEmail();
  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body { margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f5f5f5; }
        .container { max-width: 600px; margin: 40px auto; background-color: #ffffff; }
        .header { background-color: #28a745; padding: 30px; text-align: center; }
        .logo { color: #ffffff; font-size: 24px; font-weight: bold; }
        .content { padding: 40px 30px; }
        .greeting { color: #333; font-size: 16px; margin-bottom: 20px; }
        .message { color: #666; font-size: 14px; line-height: 1.6; margin-bottom: 30px; }
        .code { background-color: #f8f8f8; border: 1px solid #e0e0e0; padding: 20px; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 8px; margin: 30px 0; }
        .footer { color: #999; font-size: 12px; line-height: 1.6; margin-top: 30px; }
        .footer-brand { color: #28a745; font-weight: bold; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="logo">Farmchops</div>
        </div>
        <div class="content">
            <div class="greeting">Hello,</div>
            <div class="message">${message}</div>
            ${code ? `<div class="code">${code}</div>` : ''}
            <div class="footer">
            If you didn't initiate this request, please ignore this message and contact our support team immediately via our in-app chat or via email at ${supportEmail}
                <br><br>
                Thank you for choosing <span class="footer-brand">Farmchops</span>
            </div>
        </div>
    </div>
</body>
</html>
  `;
};

// Email templates
const createVerificationEmailTemplate = (verificationCode: string) => {
  return {
    subject: "Verify Your Farmchops Account",
    text: `Hello,\n\nPlease enter the code below to complete your login:\n\n${verificationCode}\n\nIf you didn't initiate this login attempt, please ignore this message.\n\nThank you for choosing Farmchops`,
    html: createSimpleEmailTemplate(verificationCode, "Please enter the code below to complete your login:"),
  };
};

const createPasswordResetTemplate = (resetCode: string) => {
  return {
    subject: "Reset Your Farmchops Password",
    text: `Hello,\n\nPlease enter the code below to reset your password:\n\n${resetCode}\n\nIf you didn't initiate this password reset request, please ignore this message.\n\nThank you for choosing Farmchops`,
    html: createSimpleEmailTemplate(resetCode, "Please enter the code below to reset your password:"),
  };
};

const createAdminInviteTemplate = (otp: string, adminRole: string, signupLink: string) => {
  const roleName = adminRole.replace(/_/g, ' ').toUpperCase();
  return {
    subject: "Admin Invitation - Farmchops",
    text: `Hello,\n\nYou've been invited to join the Farmchops admin team as ${roleName}.\n\nYour verification code is: ${otp}\n\nSignup link: ${signupLink}\n\nThank you for choosing Farmchops`,
    html: `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body { margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f5f5f5; }
        .container { max-width: 600px; margin: 40px auto; background-color: #ffffff; }
        .header { background-color: #28a745; padding: 30px; text-align: center; }
        .logo { color: #ffffff; font-size: 24px; font-weight: bold; }
        .content { padding: 40px 30px; }
        .greeting { color: #333; font-size: 16px; margin-bottom: 20px; }
        .message { color: #666; font-size: 14px; line-height: 1.6; margin-bottom: 20px; }
        .role { background-color: #f0f0f0; padding: 10px; border-radius: 5px; text-align: center; font-weight: bold; margin: 20px 0; }
        .code { background-color: #f8f8f8; border: 1px solid #e0e0e0; padding: 20px; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 8px; margin: 30px 0; }
        .button { display: inline-block; background-color: #28a745; color: #ffffff; padding: 15px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
        .footer { color: #999; font-size: 12px; line-height: 1.6; margin-top: 30px; }
        .footer-brand { color: #28a745; font-weight: bold; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="logo">Farmchops</div>
        </div>
        <div class="content">
            <div class="greeting">Hello,</div>
            <div class="message">You've been invited to join the Farmchops admin team.</div>
            <div class="role">Role: ${roleName}</div>
            <div class="message">Your verification code:</div>
            <div class="code">${otp}</div>
            <div style="text-align: center;">
                <a href="${signupLink}" class="button">Complete Signup</a>
            </div>
            <div class="footer">
                If you didn't expect this invitation, please ignore this email.
                <br><br>
                Thank you for choosing <span class="footer-brand">Farmchops</span>
            </div>
        </div>
    </div>
</body>
</html>
    `,
  };
};

// Email service class
class EmailService {
  private transporter: any;

  constructor() {
    this.transporter = null;
  }

  private getTransporter() {
    if (!this.transporter) {
      this.transporter = createTransporter();
    }
    return this.transporter;
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.getTransporter().verify();
      console.log("Email service connected successfully");
      return true;
    } catch (error: any) {
      console.error("Email service connection failed:", error.message);
      return false;
    }
  }

  async sendVerificationEmail(email: string, verificationCode: string): Promise<boolean> {
    try {
      const template = createVerificationEmailTemplate(verificationCode);
      const info = await this.getTransporter().sendMail({
        from: process.env.EMAIL_FROM || `"Farmchops" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: template.subject,
        text: template.text,
        html: template.html,
      });
      console.log("Verification email sent:", info.messageId);
      return true;
    } catch (error: any) {
      console.error("Error sending verification email:", error.message);
      return false;
    }
  }

  async sendPasswordResetEmail(email: string, resetCode: string): Promise<boolean> {
    try {
      const template = createPasswordResetTemplate(resetCode);
      const info = await this.getTransporter().sendMail({
        from: process.env.EMAIL_FROM || `"Farmchops" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: template.subject,
        text: template.text,
        html: template.html,
      });
      console.log("Password reset email sent:", info.messageId);
      return true;
    } catch (error) {
      console.error("Error sending password reset email:", error);
      return false;
    }
  }

  async sendAdminInviteEmail(email: string, otp: string, adminRole: string): Promise<boolean> {
    try {
      const adminSignupUrl = process.env.ADMIN_SIGNUP_URL || 'https://staging.farmchops.com/admin/signup';
      const signupLink = `${adminSignupUrl}?email=${encodeURIComponent(email)}`;
      const template = createAdminInviteTemplate(otp, adminRole, signupLink);
      const info = await this.getTransporter().sendMail({
        from: process.env.EMAIL_FROM || `"Farmchops Admin" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: template.subject,
        text: template.text,
        html: template.html,
      });
      console.log("Admin invite email sent:", info.messageId);
      return true;
    } catch (error) {
      console.error("Error sending admin invite email:", error);
      return false;
    }
  }

  // Simplified order confirmation - just essential info
  async sendOrderConfirmationEmail(email: string, orderData: any): Promise<boolean> {
    try {
      const itemsList = orderData.items.map((item: any) => `${item.productName} x${item.quantity}: ₦${(item.price / 100).toFixed(2)}`).join('\n');

      const text = `
Hello,

Your order has been confirmed!

Order Number: ${orderData.orderNumber}

Items:
${itemsList}

Total: ₦${(orderData.totalAmount / 100).toFixed(2)}

${orderData.handoverCode ? `Delivery Code: ${orderData.handoverCode}\n\n` : ''}Thank you for choosing Farmchops
      `;

      const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body { margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f5f5f5; }
        .container { max-width: 600px; margin: 40px auto; background-color: #ffffff; }
        .header { background-color: #000000; padding: 30px; text-align: center; }
        .logo { color: #28a745; font-size: 24px; font-weight: bold; }
        .content { padding: 40px 30px; }
        .order-number { background-color: #f0f0f0; padding: 15px; text-align: center; font-size: 20px; font-weight: bold; margin: 20px 0; }
        .items { margin: 20px 0; }
        .item { padding: 10px 0; border-bottom: 1px solid #eee; }
        .total { font-size: 18px; font-weight: bold; margin: 20px 0; padding: 15px; background-color: #f8f8f8; text-align: center; }
        ${orderData.handoverCode ? '.code { background-color: #fff3cd; border: 2px solid #ffc107; padding: 20px; text-align: center; font-size: 28px; font-weight: bold; letter-spacing: 4px; margin: 20px 0; }' : ''}
        .footer-brand { color: #28a745; font-weight: bold; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="logo">Farmchops</div>
        </div>
        <div class="content">
            <p>Hello,</p>
            <p>Your order has been confirmed!</p>
            <div class="order-number">Order: ${orderData.orderNumber}</div>
            <div class="items">
                ${orderData.items.map((item: any) => `<div class="item">${item.productName} x${item.quantity}: ₦${(item.price / 100).toFixed(2)}</div>`).join('')}
            </div>
            <div class="total">Total: ₦${(orderData.totalAmount / 100).toFixed(2)}</div>
            ${orderData.handoverCode ? `
            <p style="margin-top: 20px;">Please share this code with the rider when your order arrives:</p>
            <div class="code">${orderData.handoverCode}</div>
            ` : ''}
            <p style="margin-top: 30px; font-size: 12px; color: #999;">
                Thank you for choosing <span class="footer-brand">Farmchops</span>
            </p>
        </div>
    </div>
</body>
</html>
      `;

      const info = await this.getTransporter().sendMail({
        from: process.env.EMAIL_FROM || `"Farmchops" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: `Order Confirmation - ${orderData.orderNumber}`,
        text,
        html,
      });

      console.log("Order confirmation email sent:", info.messageId);
      return true;
    } catch (error) {
      console.error("Error sending order confirmation email:", error);
      return false;
    }
  }

  // Simplified payment success
  async sendPaymentSuccessEmail(email: string, data: any): Promise<boolean> {
    try {
      const text = `
Hello,

Your payment has been confirmed!

Order Number: ${data.orderNumber}
Amount Paid: ₦${(data.amount / 100).toFixed(2)}

Thank you for choosing Farmchops
      `;

      const html = createSimpleEmailTemplate(
        `₦${(data.amount / 100).toFixed(2)}`,
        `Your payment has been confirmed!<br><br>Order Number: ${data.orderNumber}`
      );

      const info = await this.getTransporter().sendMail({
        from: process.env.EMAIL_FROM || `"Farmchops" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: `Payment Confirmed - ${data.orderNumber}`,
        text,
        html,
      });

      console.log("Payment success email sent:", info.messageId);
      return true;
    } catch (error) {
      console.error("Error sending payment success email:", error);
      return false;
    }
  }

  // Simple group emails
  async sendGroupReadyEmail(email: string, data: any): Promise<boolean> {
    try {
      const text = `
Hello,

Your group for ${data.productName} is ready!

Checkout deadline: ${new Date(data.checkoutDeadline).toLocaleString()}
Your amount: ₦${(data.amount / 100).toFixed(2)}

Checkout link: ${data.checkoutLink}

Thank you for choosing Farmchops
      `;

      const info = await this.getTransporter().sendMail({
        from: process.env.EMAIL_FROM || `"Farmchops" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: `Group Ready - Checkout Now!`,
        text,
        html: createSimpleEmailTemplate('', `Your group for <strong>${data.productName}</strong> is ready!<br><br>Checkout deadline: ${new Date(data.checkoutDeadline).toLocaleString()}<br>Your amount: ₦${(data.amount / 100).toFixed(2)}<br><br><a href="${data.checkoutLink}" style="background-color: #28a745; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">Checkout Now</a>`),
      });

      console.log("Group ready email sent:", info.messageId);
      return true;
    } catch (error) {
      console.error("Error sending group ready email:", error);
      return false;
    }
  }

  async sendWaitlistPromotionEmail(email: string, data: any): Promise<boolean> {
    try {
      const text = `
Hello,

A spot opened up! You've been promoted from the waitlist for ${data.productName}.

Checkout deadline: ${new Date(data.checkoutDeadline).toLocaleString()}
Your amount: ₦${(data.amount / 100).toFixed(2)}

Checkout link: ${data.checkoutLink}

Thank you for choosing Farmchops
      `;

      const info = await this.getTransporter().sendMail({
        from: process.env.EMAIL_FROM || `"Farmchops" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: `Promoted from Waitlist - Checkout Now!`,
        text,
        html: createSimpleEmailTemplate('', `A spot opened up! You've been promoted from the waitlist for <strong>${data.productName}</strong>.<br><br>Checkout deadline: ${new Date(data.checkoutDeadline).toLocaleString()}<br>Your amount: ₦${(data.amount / 100).toFixed(2)}<br><br><a href="${data.checkoutLink}" style="background-color: #28a745; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">Checkout Now</a>`),
      });

      console.log("Waitlist promotion email sent:", info.messageId);
      return true;
    } catch (error) {
      console.error("Error sending waitlist promotion email:", error);
      return false;
    }
  }

  // Simple contact form notifications
  async sendContactNotificationToSupport(data: any): Promise<boolean> {
    try {
      const supportEmail = process.env.SUPPORT_EMAIL || 'support@farmchops.com';
      const text = `
New Contact Message

From: ${data.fullName} (${data.email})
Time: ${data.submittedAt.toLocaleString()}

Message:
${data.message}
      `;

      const info = await this.getTransporter().sendMail({
        from: process.env.EMAIL_FROM || `"Farmchops Contact" <${process.env.EMAIL_USER}>`,
        to: supportEmail,
        subject: `New Contact Form Message from ${data.fullName}`,
        text,
        html: createSimpleEmailTemplate('', `<strong>New Contact Message</strong><br><br>From: ${data.fullName} (${data.email})<br>Time: ${data.submittedAt.toLocaleString()}<br><br>Message:<br>${data.message}`),
      });

      console.log("Contact notification sent to support:", info.messageId);
      return true;
    } catch (error) {
      console.error("Error sending contact notification to support:", error);
      return false;
    }
  }

  async sendContactConfirmationEmail(email: string, data: any): Promise<boolean> {
    try {
      const text = `
Hello ${data.fullName},

Thank you for contacting us! We've received your message and will get back to you within 24 hours.

Your message:
${data.message}

Thank you for choosing Farmchops
      `;

      const info = await this.getTransporter().sendMail({
        from: process.env.EMAIL_FROM || `"Farmchops" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: 'We received your message - FarmChops',
        text,
        html: createSimpleEmailTemplate('', `Thank you for contacting us! We've received your message and will get back to you within 24 hours.<br><br><em>"${data.message}"</em>`),
      });

      console.log("Contact confirmation email sent:", info.messageId);
      return true;
    } catch (error) {
      console.error("Error sending contact confirmation email:", error);
      return false;
    }
  }
}

export const emailService = new EmailService();
export default emailService;
