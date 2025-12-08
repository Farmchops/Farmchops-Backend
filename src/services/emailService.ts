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
      const adminSignupUrl =
        process.env.ADMIN_SIGNUP_URL ||
        (process.env.NODE_ENV === 'production'
          ? 'https://farmchops.com/admin/signup'
          : 'https://staging.farmchops.com/admin/signup');
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
      const supportEmail = resolveSupportEmail();
      const normalizeAmount = (value: any) => {
      if (typeof value === 'number') return value;
      if (typeof value === 'string') return parseFloat(value) || 0;
      if (value && typeof value === 'object' && typeof value.toString === 'function') {
        const parsed = parseFloat(value.toString());
        return Number.isNaN(parsed) ? 0 : parsed;
      }
      return 0;
      };
      const formatAmount = (value: any) => `₦${normalizeAmount(value).toLocaleString('en-NG', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
      })}`;

      const toTitleCase = (value: string) => value.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.slice(1).toLowerCase());
      const readablePaymentMethod = toTitleCase((orderData.paymentMethod || 'wallet').toString().replace(/_/g, ' '));
      const companyLocation = 'Abuja, Nigeria';
      const customerName = orderData.customerName || 'there';
      const hasHandoverCode = Boolean(orderData.handoverCode);

      const itemsList = (orderData.items || [])
      .map((item: any) => `- ${item.productName} x${item.quantity}: ${formatAmount(item.price)}`)
      .join('\n');

      const text = `
  Hello ${customerName},

  Your order ${orderData.orderNumber} has been confirmed!

  Items:
  ${itemsList || '- Order details are available in the app.'}

  Subtotal: ${formatAmount(orderData.subtotal)}
  Delivery Fee: ${formatAmount(orderData.deliveryFee)}
  Tax: ${formatAmount(orderData.tax)}
  Total: ${formatAmount(orderData.totalAmount)}
  Payment Method: ${readablePaymentMethod}
  Delivery Address: ${companyLocation}

  ${hasHandoverCode ? `Delivery Code: ${orderData.handoverCode}\nPlease share this code with the rider when your order arrives.\n\n` : ''}Need help? Reply to this email or contact ${supportEmail}.

  Thank you for choosing Farmchops
      `;

      const html = `
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
      body { margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f5f5f5; color: #333333; }
      .container { max-width: 640px; margin: 32px auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 30px rgba(0, 0, 0, 0.07); }
      .header { background-color: #28a745; padding: 32px 24px; text-align: center; color: #ffffff; }
      .logo { font-size: 26px; font-weight: 700; letter-spacing: 0.5px; }
      .status-tag { margin-top: 8px; display: inline-block; padding: 6px 16px; border-radius: 999px; border: 1px solid rgba(255,255,255,0.6); font-size: 13px; text-transform: uppercase; letter-spacing: 1px; }
      .content { padding: 32px; }
      .greeting { font-size: 16px; margin-bottom: 12px; }
      .section { margin-top: 24px; }
      .section-title { font-size: 14px; text-transform: uppercase; letter-spacing: 1.5px; color: #28a745; font-weight: 700; margin-bottom: 12px; }
      .order-number { font-size: 18px; font-weight: bold; margin-bottom: 8px; }
      .items-table { width: 100%; border-collapse: collapse; border: 1px solid #f0f0f0; border-radius: 8px; overflow: hidden; }
      .items-table th { background-color: #f9f9f9; text-align: left; padding: 12px; font-size: 12px; color: #777; text-transform: uppercase; }
      .items-table td { padding: 12px; border-top: 1px solid #f0f0f0; font-size: 14px; }
      .items-table tr:last-child td { border-bottom: none; }
      .items-table .amount { text-align: right; font-weight: 600; }
      .summary-row { display: flex; justify-content: space-between; padding: 8px 0; font-size: 14px; }
      .total-row { font-size: 16px; font-weight: 700; border-top: 1px solid #e8e8e8; padding-top: 12px; margin-top: 8px; }
      .delivery-card { border: 1px solid #e7f4ea; background-color: #f6fff8; border-radius: 10px; padding: 16px; line-height: 1.6; }
      .code-block { background-color: #fff7e6; border: 1px solid #ffc166; border-radius: 10px; padding: 20px; text-align: center; margin-top: 16px; }
      .code-label { font-size: 12px; text-transform: uppercase; letter-spacing: 1px; color: #b26b00; }
      .code-value { font-size: 28px; font-weight: 700; letter-spacing: 6px; margin: 12px 0; color: #b26b00; }
      .code-note { font-size: 13px; color: #8a5b00; }
      .help-text { font-size: 13px; color: #666; margin-top: 24px; }
      .help-text a { color: #28a745; text-decoration: none; }
      .signoff { margin-top: 30px; font-size: 14px; color: #777; }
      .signoff span { color: #28a745; font-weight: 700; }
      @media (max-width: 480px) {
        .content { padding: 24px 20px; }
        .code-value { letter-spacing: 4px; font-size: 24px; }
      }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header">
        <div class="logo">Farmchops</div>
        <div class="status-tag">Order Confirmed</div>
      </div>
      <div class="content">
        <p class="greeting">Hello ${customerName},</p>
        <p>Thanks for placing your order. We're getting everything ready and will notify you when a rider is on the way.</p>

        <div class="section">
          <div class="section-title">Order Summary</div>
          <div class="order-number">Order ${orderData.orderNumber}</div>
          <table class="items-table">
            <tr>
              <th>Item</th>
              <th style="text-align:right;">Total</th>
            </tr>
            ${(orderData.items || []).length
              ? orderData.items.map((item: any) => `
            <tr>
              <td>${item.productName} <span style="color:#888;">×${item.quantity}</span></td>
              <td class="amount">${formatAmount(item.price)}</td>
            </tr>`).join('')
              : '<tr><td colspan="2">Order details are available in the app.</td></tr>'}
          </table>
        </div>

        <div class="section">
          <div class="section-title">Payment Breakdown</div>
          <div class="summary-row"><span>Subtotal</span><span>${formatAmount(orderData.subtotal)}</span></div>
          <div class="summary-row"><span>Delivery Fee</span><span>${formatAmount(orderData.deliveryFee)}</span></div>
          <div class="summary-row"><span>Tax & Charges</span><span>${formatAmount(orderData.tax)}</span></div>
          <div class="summary-row total-row"><span>Total Paid</span><span>${formatAmount(orderData.totalAmount)}</span></div>
        </div>

        <div class="section">
          <div class="section-title">Delivery Details</div>
          <div class="delivery-card">
                    <strong>Address</strong>
                    <p style="margin: 4px 0 12px;">${companyLocation}</p>
            <strong>Payment Method</strong>
            <p style="margin: 4px 0;">${readablePaymentMethod}</p>
          </div>
        </div>

        ${hasHandoverCode ? `
        <div class="section">
          <div class="section-title">Your Rider Code</div>
          <div class="code-block">
            <div class="code-label">Share this code only with the Farmchops rider</div>
            <div class="code-value">${orderData.handoverCode}</div>
            <div class="code-note">Use this to confirm delivery. Keep it handy and do not share it until your rider arrives.</div>
          </div>
        </div>
        ` : ''}

        <p class="help-text">Questions about your order? Reply to this email or contact us at <a href="mailto:${supportEmail}">${supportEmail}</a>.</p>
        <p class="signoff">Thank you for choosing <span>Farmchops</span>.</p>
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
