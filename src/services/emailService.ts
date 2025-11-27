import nodemailer from "nodemailer";
import type SMTPTransport from "nodemailer/lib/smtp-transport";

// Email transporter configuration
const createTransporter = () => {
  // Try port 587 with STARTTLS instead of 465 with SSL
  const port = parseInt(process.env.EMAIL_PORT || "587");

  const config: SMTPTransport.Options = {
    host: process.env.EMAIL_HOST || "smtp.hostinger.com",
    port: port,
    secure: false, // Use STARTTLS instead of direct SSL
    requireTLS: true, // Force TLS upgrade
    auth: {
      user: process.env.EMAIL_USER || "",
      pass: process.env.EMAIL_PASS || "",
    },
    tls: {
      rejectUnauthorized: false,
    },
    debug: true, // Enable debug output
    logger: true, // Log to console
    connectionTimeout: 60000,
    greetingTimeout: 30000,
    socketTimeout: 60000,
  };

  return nodemailer.createTransport(config);
};

// Email templates
const createVerificationEmailTemplate = (verificationCode: string) => {
  return {
    subject: "Verify Your Farmchops Account",
    text: `
Welcome to Farmchops!

Your verification code is: ${verificationCode}

This code will expire in 15 minutes.

If you didn't request this, please ignore this email.

Best regards,
The Farmchops Team
    `,
    html: `
<!DOCTYPE html>
<html>
<head>
    <style>
        .container { max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif; }
        .header { background-color: #28a745; color: white; padding: 20px; text-align: center; }
        .content { padding: 30px 20px; }
        .code { background-color: #f8f9fa; border: 2px solid #28a745; padding: 15px; font-size: 24px; font-weight: bold; text-align: center; margin: 20px 0; letter-spacing: 2px; }
        .footer { background-color: #f8f9fa; padding: 15px; text-align: center; color: #6c757d; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Welcome to Farmchops!</h1>
        </div>
        <div class="content">
            <h2>Verify Your Email Address</h2>
            <p>Thank you for signing up with Farmchops. To complete your registration, please use the verification code below:</p>
            
            <div class="code">${verificationCode}</div>
            
            <p><strong>This code will expire in 15 minutes.</strong></p>
            
            <p>If you didn't request this verification, please ignore this email.</p>
            
            <p>Best regards,<br>The Farmchops Team</p>
        </div>
        <div class="footer">
            <p>&copy; 2024 Farmchops. All rights reserved.</p>
        </div>
    </div>
</body>
</html>
    `,
  };
};

const createPasswordResetTemplate = (resetCode: string) => {
  return {
    subject: "Reset Your Farmchops Password",
    text: `
Password Reset Request

Your password reset code is: ${resetCode}

This code will expire in 15 minutes.

If you didn't request this, please ignore this email.

Best regards,
The Farmchops Team
    `,
    html: `
<!DOCTYPE html>
<html>
<head>
    <style>
        .container { max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif; }
        .header { background-color: #dc3545; color: white; padding: 20px; text-align: center; }
        .content { padding: 30px 20px; }
        .code { background-color: #f8f9fa; border: 2px solid #dc3545; padding: 15px; font-size: 24px; font-weight: bold; text-align: center; margin: 20px 0; letter-spacing: 2px; }
        .footer { background-color: #f8f9fa; padding: 15px; text-align: center; color: #6c757d; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Password Reset</h1>
        </div>
        <div class="content">
            <h2>Reset Your Password</h2>
            <p>You requested to reset your Farmchops account password. Use the code below to proceed:</p>
            
            <div class="code">${resetCode}</div>
            
            <p><strong>This code will expire in 15 minutes.</strong></p>
            
            <p>If you didn't request this password reset, please ignore this email.</p>
            
            <p>Best regards,<br>The Farmchops Team</p>
        </div>
        <div class="footer">
            <p>&copy; 2024 Farmchops. All rights reserved.</p>
        </div>
    </div>
</body>
</html>
    `,
  };
};

const createAdminInviteTemplate = (otp: string, adminRole: string, signupLink: string) => {
  const roleName = adminRole.replace(/_/g, ' ').toUpperCase();
  
  return {
    subject: "Admin Invitation - Farmchops",
    text: `
Admin Invitation

You've been invited to join the Farmchops admin team!

Your assigned role: ${roleName}

Your verification code is: ${otp}

Signup link: ${signupLink}

This code will expire in 15 minutes.

What to do next:
1. Click the signup link above
2. Enter your email, verification code, Full-Name and Password 
3. Create a strong password
4. Complete your profile information

If you didn't expect this invitation, please ignore this email.

Welcome to the team!

Best regards,
The Farmchops Team
    `,
    html: `
<!DOCTYPE html>
<html>
<head>
    <style>
        .container { max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif; }
        .header { background-color: #28a745; color: white; padding: 20px; text-align: center; }
        .content { padding: 30px 20px; }
        .code { background-color: #f8f9fa; border: 2px solid #28a745; padding: 15px; font-size: 24px; font-weight: bold; text-align: center; margin: 20px 0; letter-spacing: 5px; }
        .button { display: inline-block; padding: 15px 30px; background-color: #28a745; color: white; text-decoration: none; border-radius: 5px; font-weight: bold; margin: 20px 0; }
        .role-badge { display: inline-block; padding: 5px 15px; background-color: #007bff; color: white; border-radius: 20px; font-size: 14px; margin: 10px 0; }
        .warning { background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; border-radius: 5px; }
        .footer { background-color: #f8f9fa; padding: 15px; text-align: center; color: #6c757d; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🎉 Admin Invitation</h1>
        </div>
        <div class="content">
            <p>Hello,</p>
            
            <p>You've been invited to join the Farmchops admin team!</p>
            
            <p><strong>Your assigned role:</strong></p>
            <div class="role-badge">${roleName}</div>
            
            <p><strong>Your verification code:</strong></p>
            <div class="code">${otp}</div>
            
            <p style="text-align: center;">
                <a href="${signupLink}" class="button">Complete Signup</a>
            </p>
            
            <div class="warning">
                <strong>⚠️ Important:</strong>
                <ul>
                    <li>This code expires in <strong>15 minutes</strong></li>
                    <li>You'll need to create a password during signup</li>
                    <li>Keep your credentials secure</li>
                </ul>
            </div>
            
            <p><strong>What to do next:</strong></p>
            <ol>
                <li>Click the button above to go to the admin signup page</li>
                <li>Enter your email and the verification code</li>
                <li>Create a strong password</li>
                <li>Complete your profile information</li>
            </ol>
            
            <p>If you didn't expect this invitation, please ignore this email or contact the system administrator.</p>
            
            <p>Welcome to the team! 🚀</p>
            
            <p>Best regards,<br>The Farmchops Team</p>
        </div>
        <div class="footer">
            <p>&copy; ${new Date().getFullYear()} Farmchops. All rights reserved.</p>
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
    // Don't create transporter in constructor - create it when needed
    this.transporter = null;
  }

  private getTransporter() {
    if (!this.transporter) {
      this.transporter = createTransporter();
    }
    return this.transporter;
  }

  // Test email connection with better error handling
  async testConnection(): Promise<boolean> {
    try {
      await this.getTransporter().verify();
      console.log("Email service connected successfully");
      return true;
    } catch (error: any) {
      console.error("Email service connection failed:", error.message);
      console.error("Error code:", error.code);
      console.error("Error details:", error);
      return false;
    }
  }

  // Send verification email
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
      console.error("Error sending verification email:", error);
      console.error("Error code:", error.code);
      console.error("Error message:", error.message);
      console.error("Email config:", {
        host: process.env.EMAIL_HOST,
        port: process.env.EMAIL_PORT,
        user: process.env.EMAIL_USER,
        from: process.env.EMAIL_FROM
      });
      return false;
    }
  }

  // Send password reset email
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

  // Send admin invite email
  async sendAdminInviteEmail(email: string, otp: string, adminRole: string): Promise<boolean> {
    try {
      // Get the admin signup URL from environment or use default
      const adminSignupUrl = process.env.ADMIN_SIGNUP_URL || 'https://staging.farmchops.com/admin/signup';

      // Create signup link with email pre-filled
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

  // Send order confirmation email
  async sendOrderConfirmationEmail(email: string, orderData: {
    orderNumber: string;
    customerName: string;
    items: Array<{ productName: string; quantity: number; price: number }>;
    subtotal: number;
    deliveryFee: number;
    totalAmount: number;
    deliveryAddress: string;
    paymentMethod: string;
    handoverCode?: string;
  }): Promise<boolean> {
    try {
      const itemsList = orderData.items.map(item =>
        `<tr>
          <td style="padding: 10px; border-bottom: 1px solid #ddd;">${item.productName}</td>
          <td style="padding: 10px; border-bottom: 1px solid #ddd; text-align: center;">${item.quantity}</td>
          <td style="padding: 10px; border-bottom: 1px solid #ddd; text-align: right;">₦${(item.price / 100).toFixed(2)}</td>
        </tr>`
      ).join('');

      const handoverCodeSection = orderData.handoverCode ? `
            <div class="info-box">
                <h4>Delivery Verification Code</h4>
                <p>Please share this code with the Farmchops rider when your order arrives. The rider will enter it to confirm delivery.</p>
                <div class="order-number" style="margin-top: 10px;">${orderData.handoverCode}</div>
            </div>
      ` : '';

      const html = `
<!DOCTYPE html>
<html>
<head>
    <style>
        .container { max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif; }
        .header { background-color: #28a745; color: white; padding: 20px; text-align: center; }
        .content { padding: 30px 20px; }
        .order-number { background-color: #f8f9fa; border: 2px solid #28a745; padding: 15px; font-size: 20px; font-weight: bold; text-align: center; margin: 20px 0; }
        .items-table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        .items-table th { background-color: #f8f9fa; padding: 10px; text-align: left; border-bottom: 2px solid #ddd; }
        .total-row { font-weight: bold; background-color: #f8f9fa; }
        .info-box { background-color: #f8f9fa; padding: 15px; margin: 20px 0; border-radius: 5px; }
        .footer { background-color: #f8f9fa; padding: 15px; text-align: center; color: #6c757d; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Order Confirmed!</h1>
        </div>
        <div class="content">
            <p>Dear ${orderData.customerName},</p>

            <p>Thank you for your order! We've received it and will start processing it shortly.</p>

            <div class="order-number">
                Order Number: ${orderData.orderNumber}
            </div>

            <h3>Order Summary</h3>
            <table class="items-table">
                <thead>
                    <tr>
                        <th>Item</th>
                        <th style="text-align: center;">Quantity</th>
                        <th style="text-align: right;">Price</th>
                    </tr>
                </thead>
                <tbody>
                    ${itemsList}
                    <tr>
                        <td colspan="2" style="padding: 10px; text-align: right;">Subtotal:</td>
                        <td style="padding: 10px; text-align: right;">₦${(orderData.subtotal / 100).toFixed(2)}</td>
                    </tr>
                    <tr>
                        <td colspan="2" style="padding: 10px; text-align: right;">Delivery Fee:</td>
                        <td style="padding: 10px; text-align: right;">₦${(orderData.deliveryFee / 100).toFixed(2)}</td>
                    </tr>
                    <tr class="total-row">
                        <td colspan="2" style="padding: 10px; text-align: right;">Total:</td>
                        <td style="padding: 10px; text-align: right;">₦${(orderData.totalAmount / 100).toFixed(2)}</td>
                    </tr>
                </tbody>
            </table>

            <div class="info-box">
                <h4>Delivery Information</h4>
                <p><strong>Address:</strong> ${orderData.deliveryAddress}</p>
                <p><strong>Payment Method:</strong> ${orderData.paymentMethod.replace('_', ' ').toUpperCase()}</p>
            </div>

            ${handoverCodeSection}

            <p>We'll send you another email when your order ships.</p>

            <p>If you have any questions, please don't hesitate to contact us.</p>

            <p>Best regards,<br>The Farmchops Team</p>
        </div>
        <div class="footer">
            <p>&copy; ${new Date().getFullYear()} Farmchops. All rights reserved.</p>
        </div>
    </div>
</body>
</html>
      `;

      const text = `
Order Confirmed!

Dear ${orderData.customerName},

Thank you for your order! We've received it and will start processing it shortly.

Order Number: ${orderData.orderNumber}

Order Summary:
${orderData.items.map(item => `- ${item.productName} x${item.quantity}: ₦${(item.price / 100).toFixed(2)}`).join('\n')}

Subtotal: ₦${(orderData.subtotal / 100).toFixed(2)}
Delivery Fee: ₦${(orderData.deliveryFee / 100).toFixed(2)}
Total: ₦${(orderData.totalAmount / 100).toFixed(2)}

Delivery Address: ${orderData.deliveryAddress}
Payment Method: ${orderData.paymentMethod.replace('_', ' ').toUpperCase()}

We'll send you another email when your order ships.

Best regards,
The Farmchops Team
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

  // Send payment success email
  async sendPaymentSuccessEmail(email: string, data: {
    orderNumber: string;
    customerName: string;
    amount: number;
    paymentMethod: string;
  }): Promise<boolean> {
    try {
      const html = `
<!DOCTYPE html>
<html>
<head>
    <style>
        .container { max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif; }
        .header { background-color: #28a745; color: white; padding: 20px; text-align: center; }
        .content { padding: 30px 20px; }
        .success-icon { font-size: 48px; text-align: center; margin: 20px 0; }
        .amount-box { background-color: #d4edda; border: 2px solid #28a745; padding: 20px; text-align: center; margin: 20px 0; border-radius: 5px; }
        .amount { font-size: 32px; font-weight: bold; color: #28a745; }
        .footer { background-color: #f8f9fa; padding: 15px; text-align: center; color: #6c757d; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Payment Successful!</h1>
        </div>
        <div class="content">
            <div class="success-icon">✓</div>

            <p>Dear ${data.customerName},</p>

            <p>Your payment has been successfully processed!</p>

            <div class="amount-box">
                <div style="font-size: 16px; color: #666; margin-bottom: 10px;">Amount Paid</div>
                <div class="amount">₦${(data.amount / 100).toFixed(2)}</div>
            </div>

            <p><strong>Order Number:</strong> ${data.orderNumber}</p>
            <p><strong>Payment Method:</strong> ${data.paymentMethod.replace('_', ' ').toUpperCase()}</p>

            <p>Your order is now being processed and will be shipped soon. We'll keep you updated on its progress.</p>

            <p>Thank you for shopping with Farmchops!</p>

            <p>Best regards,<br>The Farmchops Team</p>
        </div>
        <div class="footer">
            <p>&copy; ${new Date().getFullYear()} Farmchops. All rights reserved.</p>
        </div>
    </div>
</body>
</html>
      `;

      const text = `
Payment Successful!

Dear ${data.customerName},

Your payment has been successfully processed!

Amount Paid: ₦${(data.amount / 100).toFixed(2)}
Order Number: ${data.orderNumber}
Payment Method: ${data.paymentMethod.replace('_', ' ').toUpperCase()}

Your order is now being processed and will be shipped soon. We'll keep you updated on its progress.

Thank you for shopping with Farmchops!

Best regards,
The Farmchops Team
      `;

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

  // GROUP ORDER EMAILS

  async sendGroupReadyEmail(
    email: string,
    data: {
      groupId: string;
      productName: string;
      quantity: number;
      amount: number;
      checkoutDeadline: string;
      checkoutLink: string;
    }
  ): Promise<boolean> {
    try {
      const deadlineDate = new Date(data.checkoutDeadline);
      const html = `
<!DOCTYPE html>
<html>
<head>
    <style>
        .container { max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif; }
        .header { background-color: #28a745; color: white; padding: 20px; text-align: center; }
        .content { padding: 30px 20px; }
        .alert-box { background-color: #fff3cd; border: 2px solid #ffc107; padding: 20px; margin: 20px 0; border-radius: 5px; }
        .group-details { background-color: #f8f9fa; padding: 20px; margin: 20px 0; border-radius: 5px; }
        .cta-button { display: inline-block; background-color: #28a745; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; font-weight: bold; }
        .footer { background-color: #f8f9fa; padding: 15px; text-align: center; color: #6c757d; }
        .deadline { font-size: 18px; font-weight: bold; color: #dc3545; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Group is Full! Checkout Now</h1>
        </div>
        <div class="content">
            <div class="alert-box">
                <h2>Action Required - Checkout Deadline!</h2>
                <p>Your group buying session for <strong>${data.productName}</strong> has reached minimum participants!</p>
                <p class="deadline">Checkout Deadline: ${deadlineDate.toLocaleString()}</p>
            </div>

            <div class="group-details">
                <p><strong>Group ID:</strong> ${data.groupId}</p>
                <p><strong>Product:</strong> ${data.productName}</p>
                <p><strong>Your Quantity:</strong> ${data.quantity} units</p>
                <p><strong>Your Amount:</strong> ₦${(data.amount / 100).toFixed(2)}</p>
            </div>

            <p><strong>What happens next?</strong></p>
            <ol>
                <li>Click the button below to checkout</li>
                <li>Enter your delivery information</li>
                <li>Complete payment within 48 hours</li>
                <li>Your order will be created and processed</li>
            </ol>

            <p style="text-align: center;">
                <a href="${data.checkoutLink}" class="cta-button">Checkout Now</a>
            </p>

            <p><strong>Important:</strong> If you don't checkout within 48 hours, your reservation will be cancelled.</p>

            <p>Best regards,<br>The Farmchops Team</p>
        </div>
        <div class="footer">
            <p>&copy; 2024 Farmchops. All rights reserved.</p>
        </div>
    </div>
</body>
</html>
      `;

      const text = `
Group is Full! Checkout Now

Your group buying session for ${data.productName} has reached minimum participants!

Group ID: ${data.groupId}
Product: ${data.productName}
Your Quantity: ${data.quantity} units
Your Amount: ₦${(data.amount / 100).toFixed(2)}

CHECKOUT DEADLINE: ${deadlineDate.toLocaleString()}

What happens next?
1. Visit the checkout link
2. Enter your delivery information
3. Complete payment within 48 hours
4. Your order will be created and processed

Checkout Link: ${data.checkoutLink}

Important: If you don't checkout within 48 hours, your reservation will be cancelled.

Best regards,
The Farmchops Team
      `;

      const info = await this.getTransporter().sendMail({
        from: process.env.EMAIL_FROM || `"Farmchops" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: `Group Ready - Checkout Now! (${data.groupId})`,
        text,
        html,
      });

      console.log("Group ready email sent:", info.messageId);
      return true;
    } catch (error) {
      console.error("Error sending group ready email:", error);
      return false;
    }
  }

  async sendWaitlistPromotionEmail(
    email: string,
    data: {
      groupId: string;
      productName: string;
      quantity: number;
      amount: number;
      checkoutDeadline: string;
      checkoutLink: string;
    }
  ): Promise<boolean> {
    try {
      const deadlineDate = new Date(data.checkoutDeadline);
      const html = `
<!DOCTYPE html>
<html>
<head>
    <style>
        .container { max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif; }
        .header { background-color: #28a745; color: white; padding: 20px; text-align: center; }
        .content { padding: 30px 20px; }
        .alert-box { background-color: #d1ecf1; border: 2px solid #17a2b8; padding: 20px; margin: 20px 0; border-radius: 5px; }
        .group-details { background-color: #f8f9fa; padding: 20px; margin: 20px 0; border-radius: 5px; }
        .cta-button { display: inline-block; background-color: #28a745; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; font-weight: bold; }
        .footer { background-color: #f8f9fa; padding: 15px; text-align: center; color: #6c757d; }
        .deadline { font-size: 18px; font-weight: bold; color: #dc3545; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>You've Been Promoted from Waitlist!</h1>
        </div>
        <div class="content">
            <div class="alert-box">
                <h2>A Spot Opened Up - Checkout Now!</h2>
                <p>Great news! A spot has opened up in the group for <strong>${data.productName}</strong> and you've been promoted!</p>
                <p class="deadline">Checkout Deadline: ${deadlineDate.toLocaleString()}</p>
                <p><strong>You have 24 hours to complete checkout.</strong></p>
            </div>

            <div class="group-details">
                <p><strong>Group ID:</strong> ${data.groupId}</p>
                <p><strong>Product:</strong> ${data.productName}</p>
                <p><strong>Your Quantity:</strong> ${data.quantity} units</p>
                <p><strong>Your Amount:</strong> ₦${(data.amount / 100).toFixed(2)}</p>
            </div>

            <p><strong>What to do now:</strong></p>
            <ol>
                <li>Click the button below to checkout</li>
                <li>Enter your delivery information</li>
                <li>Complete payment within 24 hours</li>
                <li>Your order will be created</li>
            </ol>

            <p style="text-align: center;">
                <a href="${data.checkoutLink}" class="cta-button">Checkout Now</a>
            </p>

            <p><strong>Important:</strong> If you don't checkout within 24 hours, this spot will be offered to the next person.</p>

            <p>Best regards,<br>The Farmchops Team</p>
        </div>
        <div class="footer">
            <p>&copy; 2024 Farmchops. All rights reserved.</p>
        </div>
    </div>
</body>
</html>
      `;

      const text = `
You've Been Promoted from Waitlist!

Great news! A spot has opened up in the group for ${data.productName}!

Group ID: ${data.groupId}
Product: ${data.productName}
Your Quantity: ${data.quantity} units
Your Amount: ₦${(data.amount / 100).toFixed(2)}

CHECKOUT DEADLINE: ${deadlineDate.toLocaleString()}
You have 24 hours to complete checkout.

What to do now:
1. Visit the checkout link
2. Enter your delivery information
3. Complete payment within 24 hours

Checkout Link: ${data.checkoutLink}

Important: If you don't checkout within 24 hours, this spot will be offered to the next person.

Best regards,
The Farmchops Team
      `;

      const info = await this.getTransporter().sendMail({
        from: process.env.EMAIL_FROM || `"Farmchops" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: `Promoted from Waitlist - Checkout Now! (${data.groupId})`,
        text,
        html,
      });

      console.log("Waitlist promotion email sent:", info.messageId);
      return true;
    } catch (error) {
      console.error("Error sending waitlist promotion email:", error);
      return false;
    }
  }
}

// Export singleton instance
export const emailService = new EmailService();
export default emailService;