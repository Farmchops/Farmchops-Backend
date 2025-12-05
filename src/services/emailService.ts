import nodemailer from "nodemailer";
import type SMTPTransport from "nodemailer/lib/smtp-transport";

// Email transporter configuration
const createTransporter = () => {
  const port = parseInt(process.env.EMAIL_PORT || "465");

  // Port 465 uses SSL (secure: true), port 587 uses STARTTLS (secure: false)
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

  // Only add requireTLS for port 587 (STARTTLS)
  if (!isSSL) {
    config.requireTLS = true;
  }

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
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Verify Your Account</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f7fa; padding: 20px; line-height: 1.6; }
        .email-wrapper { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.08); }
        .header { background: linear-gradient(135deg, #28a745 0%, #20c997 100%); padding: 50px 30px; text-align: center; }
        .header-icon { font-size: 64px; margin-bottom: 15px; }
        .header h1 { color: #ffffff; font-size: 32px; font-weight: 700; margin: 0; }
        .header p { color: rgba(255,255,255,0.95); font-size: 16px; margin-top: 10px; }
        .content { padding: 40px 30px; }
        .welcome-text { font-size: 18px; color: #212529; font-weight: 600; margin-bottom: 20px; text-align: center; }
        .instruction { color: #495057; font-size: 15px; text-align: center; margin-bottom: 30px; line-height: 1.8; }
        .code-container { background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%); border: 3px solid #28a745; border-radius: 12px; padding: 30px; margin: 30px 0; text-align: center; box-shadow: 0 4px 12px rgba(40, 167, 69, 0.15); }
        .code-label { font-size: 14px; color: #6c757d; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 15px; }
        .code { font-size: 42px; font-weight: 700; color: #28a745; letter-spacing: 8px; font-family: 'Courier New', monospace; margin: 15px 0; text-shadow: 2px 2px 4px rgba(0,0,0,0.1); }
        .expiry-badge { display: inline-block; background-color: #fff3cd; color: #856404; padding: 10px 20px; border-radius: 20px; font-size: 13px; font-weight: 600; margin-top: 15px; }
        .info-box { background-color: #e7f3ff; border-left: 4px solid #2196F3; border-radius: 8px; padding: 20px; margin: 25px 0; }
        .info-box p { color: #0d47a1; font-size: 14px; margin: 0; line-height: 1.6; }
        .security-note { background-color: #fff3cd; border-left: 4px solid #ffc107; border-radius: 8px; padding: 20px; margin: 25px 0; }
        .security-note p { color: #856404; font-size: 14px; margin: 0; line-height: 1.6; }
        .security-note strong { display: block; margin-bottom: 8px; }
        .cta-section { text-align: center; margin: 30px 0; }
        .footer { background-color: #f8f9fa; padding: 30px; text-align: center; border-top: 1px solid #e9ecef; }
        .footer-logo { font-size: 24px; font-weight: 700; color: #28a745; margin-bottom: 10px; }
        .footer p { color: #6c757d; font-size: 13px; margin: 8px 0; }
        .footer a { color: #28a745; text-decoration: none; font-weight: 600; }
        .divider { height: 1px; background: linear-gradient(to right, transparent, #e9ecef, transparent); margin: 30px 0; }
        @media only screen and (max-width: 600px) {
            .email-wrapper { border-radius: 0; }
            .header, .content, .footer { padding: 30px 20px; }
            .code { font-size: 32px; letter-spacing: 4px; }
        }
    </style>
</head>
<body>
    <div class="email-wrapper">
        <div class="header">
            <img src="${process.env.LOGO_URL || 'https://farmchops.com/logo.png'}" alt="FarmChops Logo" style="max-width: 180px; height: auto; margin-bottom: 20px;" />
            <div class="header-icon">🎉</div>
            <h1>Welcome to FarmChops!</h1>
            <p>Fresh produce delivered to your doorstep</p>
        </div>
        <div class="content">
            <p class="welcome-text">One More Step to Get Started</p>

            <p class="instruction">
                Thank you for signing up with FarmChops! We're excited to have you on board.
                To complete your registration and start shopping, please verify your email address using the code below:
            </p>

            <div class="code-container">
                <div class="code-label">Your Verification Code</div>
                <div class="code">${verificationCode}</div>
                <span class="expiry-badge">⏰ Expires in 15 minutes</span>
            </div>

            <div class="info-box">
                <p>
                    <strong>📱 Enter this code on the verification page</strong><br>
                    Simply copy the code above and paste it in the verification field to activate your account.
                </p>
            </div>

            <div class="divider"></div>

            <div class="security-note">
                <p>
                    <strong>🔒 Security Notice</strong>
                    If you didn't create an account with FarmChops, please ignore this email.
                    Your security is important to us.
                </p>
            </div>

            <div class="divider"></div>

            <p style="color: #495057; font-size: 14px; text-align: center; line-height: 1.8;">
                Once verified, you'll have access to:<br>
                ✓ Fresh produce from local farms<br>
                ✓ Group buying discounts<br>
                ✓ Fast delivery to your doorstep<br>
                ✓ Secure payment options
            </p>

            <p style="margin-top: 30px; color: #495057; text-align: center;">
                Welcome aboard!<br>
                <strong style="color: #28a745;">The FarmChops Team</strong>
            </p>
        </div>
        <div class="footer">
            <div class="footer-logo">🌱 FarmChops</div>
            <p style="font-weight: 600; color: #495057;">Fresh Produce Delivered to Your Doorstep</p>
            <p style="margin-top: 15px;">
                <a href="${process.env.FRONTEND_URL || 'https://farmchops.com'}">Visit Website</a> •
                <a href="${process.env.FRONTEND_URL || 'https://farmchops.com'}/contact">Contact Us</a>
            </p>
            <p style="margin-top: 20px; font-size: 12px; color: #6c757d;">
                &copy; ${new Date().getFullYear()} FarmChops. All rights reserved.<br>
                Plot 24 I.T Igbani Street, Off Awolowo Road, Jabi District, Abuja
            </p>
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
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Reset Your Password</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f7fa; padding: 20px; line-height: 1.6; }
        .email-wrapper { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.08); }
        .header { background: linear-gradient(135deg, #dc3545 0%, #c82333 100%); padding: 50px 30px; text-align: center; }
        .header-icon { font-size: 64px; margin-bottom: 15px; }
        .header h1 { color: #ffffff; font-size: 32px; font-weight: 700; margin: 0; }
        .header p { color: rgba(255,255,255,0.95); font-size: 16px; margin-top: 10px; }
        .content { padding: 40px 30px; }
        .alert-badge { display: inline-flex; align-items: center; background-color: #f8d7da; color: #721c24; padding: 10px 20px; border-radius: 25px; font-size: 14px; font-weight: 600; margin-bottom: 25px; }
        .alert-badge::before { content: "⚠️"; margin-right: 10px; font-size: 18px; }
        .instruction { color: #495057; font-size: 15px; margin-bottom: 30px; line-height: 1.8; }
        .code-container { background: linear-gradient(135deg, #fff5f5 0%, #ffe5e5 100%); border: 3px solid #dc3545; border-radius: 12px; padding: 30px; margin: 30px 0; text-align: center; box-shadow: 0 4px 12px rgba(220, 53, 69, 0.15); }
        .code-label { font-size: 14px; color: #6c757d; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 15px; }
        .code { font-size: 42px; font-weight: 700; color: #dc3545; letter-spacing: 8px; font-family: 'Courier New', monospace; margin: 15px 0; text-shadow: 2px 2px 4px rgba(0,0,0,0.1); }
        .expiry-badge { display: inline-block; background-color: #fff3cd; color: #856404; padding: 10px 20px; border-radius: 20px; font-size: 13px; font-weight: 600; margin-top: 15px; }
        .info-box { background-color: #e7f3ff; border-left: 4px solid #2196F3; border-radius: 8px; padding: 20px; margin: 25px 0; }
        .info-box p { color: #0d47a1; font-size: 14px; margin: 0; line-height: 1.6; }
        .security-warning { background-color: #fff3cd; border: 2px solid #ffc107; border-radius: 10px; padding: 20px; margin: 25px 0; }
        .security-warning-title { color: #856404; font-weight: 700; font-size: 16px; margin-bottom: 12px; display: flex; align-items: center; }
        .security-warning-title::before { content: "🔒"; margin-right: 10px; font-size: 20px; }
        .security-warning p { color: #856404; font-size: 14px; margin: 8px 0; line-height: 1.6; }
        .footer { background-color: #f8f9fa; padding: 30px; text-align: center; border-top: 1px solid #e9ecef; }
        .footer-logo { font-size: 24px; font-weight: 700; color: #28a745; margin-bottom: 10px; }
        .footer p { color: #6c757d; font-size: 13px; margin: 8px 0; }
        .footer a { color: #28a745; text-decoration: none; font-weight: 600; }
        .divider { height: 1px; background: linear-gradient(to right, transparent, #e9ecef, transparent); margin: 30px 0; }
        @media only screen and (max-width: 600px) {
            .email-wrapper { border-radius: 0; }
            .header, .content, .footer { padding: 30px 20px; }
            .code { font-size: 32px; letter-spacing: 4px; }
        }
    </style>
</head>
<body>
    <div class="email-wrapper">
        <div class="header">
            <img src="${process.env.LOGO_URL || 'https://farmchops.com/logo.png'}" alt="FarmChops Logo" style="max-width: 180px; height: auto; margin-bottom: 20px;" />
            <div class="header-icon">🔐</div>
            <h1>Password Reset Request</h1>
            <p>Secure your FarmChops account</p>
        </div>
        <div class="content">
            <span class="alert-badge">Security Alert</span>

            <p class="instruction">
                We received a request to reset the password for your FarmChops account.
                If you made this request, use the verification code below to proceed with resetting your password:
            </p>

            <div class="code-container">
                <div class="code-label">Your Reset Code</div>
                <div class="code">${resetCode}</div>
                <span class="expiry-badge">⏰ Expires in 15 minutes</span>
            </div>

            <div class="info-box">
                <p>
                    <strong>📱 How to reset your password:</strong><br>
                    1. Return to the password reset page<br>
                    2. Enter the code above<br>
                    3. Create your new password<br>
                    4. Confirm and save
                </p>
            </div>

            <div class="divider"></div>

            <div class="security-warning">
                <div class="security-warning-title">Important Security Information</div>
                <p>
                    <strong>❗ Didn't request this reset?</strong><br>
                    If you did not request a password reset, please ignore this email. Your password will remain unchanged.
                </p>
                <p style="margin-top: 12px;">
                    <strong>🛡️ Keep your account safe:</strong><br>
                    • Never share your password or reset code with anyone<br>
                    • FarmChops will never ask for your password via email<br>
                    • If you're concerned about your account security, contact us immediately
                </p>
            </div>

            <div class="divider"></div>

            <p style="color: #495057; font-size: 14px; text-align: center; line-height: 1.8;">
                Need help? Contact our support team at<br>
                <a href="mailto:${process.env.SUPPORT_EMAIL || 'support@farmchops.com'}" style="color: #28a745; text-decoration: none; font-weight: 600;">${process.env.SUPPORT_EMAIL || 'support@farmchops.com'}</a>
            </p>

            <p style="margin-top: 30px; color: #495057; text-align: center;">
                Stay secure,<br>
                <strong style="color: #28a745;">The FarmChops Team</strong>
            </p>
        </div>
        <div class="footer">
            <div class="footer-logo">🌱 FarmChops</div>
            <p style="font-weight: 600; color: #495057;">Fresh Produce Delivered to Your Doorstep</p>
            <p style="margin-top: 15px;">
                <a href="${process.env.FRONTEND_URL || 'https://farmchops.com'}">Visit Website</a> •
                <a href="${process.env.FRONTEND_URL || 'https://farmchops.com'}/contact">Contact Us</a>
            </p>
            <p style="margin-top: 20px; font-size: 12px; color: #6c757d;">
                &copy; ${new Date().getFullYear()} FarmChops. All rights reserved.<br>
                Plot 24 I.T Igbani Street, Off Awolowo Road, Jabi District, Abuja
            </p>
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

  // Test email connection
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
      console.error("Error sending verification email:", error.message);
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
    tax?: number;
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
            <div class="handover-box">
                <h4>Delivery Verification Code</h4>
                <p>Please share this code with the FarmChops rider when your order arrives. The rider will enter it to confirm delivery.</p>
                <div class="handover-code">${orderData.handoverCode}</div>
                <p style="margin-top: 15px; font-size: 12px;">Keep this code safe and ready for delivery</p>
            </div>
      ` : '';

      const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Order Confirmed</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f7fa; padding: 20px; line-height: 1.6; }
        .email-wrapper { max-width: 650px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.08); }
        .header { background: linear-gradient(135deg, #28a745 0%, #20c997 100%); padding: 50px 30px; text-align: center; position: relative; }
        .header-icon { font-size: 64px; margin-bottom: 15px; animation: scaleIn 0.5s ease; }
        @keyframes scaleIn { from { transform: scale(0); } to { transform: scale(1); } }
        .header h1 { color: #ffffff; font-size: 32px; font-weight: 700; margin: 0; }
        .header p { color: rgba(255,255,255,0.95); font-size: 16px; margin-top: 10px; }
        .content { padding: 40px 30px; }
        .success-badge { display: inline-flex; align-items: center; background-color: #d4edda; color: #155724; padding: 12px 24px; border-radius: 25px; font-size: 15px; font-weight: 600; margin-bottom: 25px; box-shadow: 0 2px 8px rgba(21, 87, 36, 0.2); }
        .success-badge::before { content: "✓"; margin-right: 10px; font-size: 20px; }
        .order-number-card { background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%); border: 3px dashed #28a745; padding: 20px; border-radius: 12px; text-align: center; margin: 25px 0; }
        .order-number-label { font-size: 14px; color: #6c757d; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px; }
        .order-number-value { font-size: 28px; color: #28a745; font-weight: 700; font-family: 'Courier New', monospace; }
        .section-title { font-size: 18px; color: #212529; font-weight: 700; margin: 30px 0 15px 0; padding-bottom: 10px; border-bottom: 2px solid #e9ecef; display: flex; align-items: center; }
        .section-title::before { content: "📦"; margin-right: 10px; font-size: 20px; }
        .items-table { width: 100%; border-collapse: collapse; margin: 20px 0; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.05); }
        .items-table thead { background: linear-gradient(135deg, #28a745 0%, #20c997 100%); }
        .items-table th { padding: 14px 12px; text-align: left; color: #ffffff; font-weight: 600; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px; }
        .items-table td { padding: 14px 12px; border-bottom: 1px solid #f0f0f0; color: #495057; }
        .items-table tbody tr:hover { background-color: #f8f9fa; }
        .items-table tbody tr:last-child td { border-bottom: none; }
        .summary-row { background-color: #f8f9fa !important; font-weight: 500; }
        .total-row { background: linear-gradient(135deg, #e8f5e9 0%, #f1f8f4 100%) !important; font-weight: 700; font-size: 16px; color: #28a745 !important; }
        .info-card { background-color: #f8f9fa; border-radius: 10px; padding: 24px; margin: 25px 0; border-left: 4px solid #28a745; }
        .info-card h4 { color: #212529; font-size: 16px; margin-bottom: 15px; display: flex; align-items: center; }
        .info-card h4::before { content: "📍"; margin-right: 10px; font-size: 18px; }
        .info-card p { color: #495057; margin: 10px 0; line-height: 1.8; }
        .handover-box { background: linear-gradient(135deg, #fff3cd 0%, #fff8e1 100%); border: 2px solid #ffc107; border-radius: 12px; padding: 24px; margin: 25px 0; text-align: center; }
        .handover-box h4 { color: #856404; font-size: 16px; margin-bottom: 12px; display: flex; align-items: center; justify-content: center; }
        .handover-box h4::before { content: "��"; margin-right: 10px; font-size: 20px; }
        .handover-box p { color: #856404; font-size: 14px; margin-bottom: 15px; line-height: 1.6; }
        .handover-code { background-color: #ffffff; border: 3px dashed #ffc107; padding: 20px; border-radius: 8px; font-size: 32px; font-weight: 700; color: #856404; font-family: 'Courier New', monospace; letter-spacing: 4px; margin-top: 15px; }
        .cta-button { display: inline-block; background: linear-gradient(135deg, #28a745 0%, #20c997 100%); color: #ffffff; padding: 16px 40px; text-decoration: none; border-radius: 8px; font-weight: 600; margin: 25px 0; box-shadow: 0 4px 12px rgba(40, 167, 69, 0.3); font-size: 15px; }
        .cta-button:hover { box-shadow: 0 6px 18px rgba(40, 167, 69, 0.4); transform: translateY(-2px); }
        .timeline { margin: 30px 0; }
        .timeline-item { display: flex; align-items: flex-start; margin-bottom: 20px; }
        .timeline-icon { background: linear-gradient(135deg, #28a745 0%, #20c997 100%); color: white; width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 700; margin-right: 15px; flex-shrink: 0; box-shadow: 0 2px 8px rgba(40, 167, 69, 0.3); }
        .timeline-content { flex: 1; }
        .timeline-title { font-weight: 600; color: #212529; margin-bottom: 4px; }
        .timeline-desc { font-size: 14px; color: #6c757d; }
        .footer { background-color: #f8f9fa; padding: 35px 30px; text-align: center; border-top: 1px solid #e9ecef; }
        .footer-logo { font-size: 24px; font-weight: 700; color: #28a745; margin-bottom: 12px; }
        .footer p { color: #6c757d; font-size: 13px; margin: 8px 0; }
        .footer a { color: #28a745; text-decoration: none; font-weight: 600; }
        .divider { height: 1px; background: linear-gradient(to right, transparent, #e9ecef, transparent); margin: 35px 0; }
        @media only screen and (max-width: 600px) {
            .email-wrapper { border-radius: 0; }
            .header, .content, .footer { padding: 30px 20px; }
            .items-table { font-size: 13px; }
            .items-table th, .items-table td { padding: 10px 8px; }
            .order-number-value { font-size: 20px; }
            .handover-code { font-size: 24px; letter-spacing: 2px; }
        }
    </style>
</head>
<body>
    <div class="email-wrapper">
        <div class="header">
            <img src="${process.env.LOGO_URL || 'https://farmchops.com/logo.png'}" alt="FarmChops Logo" style="max-width: 180px; height: auto; margin-bottom: 20px;" />
            <div class="header-icon">✅</div>
            <h1>Order Confirmed!</h1>
            <p>Your order has been successfully placed</p>
        </div>
        <div class="content">
            <span class="success-badge">Payment Confirmed</span>

            <p style="color: #495057; font-size: 16px; margin-bottom: 20px;">
                Hi <strong>${orderData.customerName}</strong>,
            </p>

            <p style="color: #495057; font-size: 15px; margin-bottom: 25px;">
                Thank you for your order! We've received your payment and our team is already preparing your fresh produce for delivery.
            </p>

            <div class="order-number-card">
                <div class="order-number-label">Order Number</div>
                <div class="order-number-value">${orderData.orderNumber}</div>
            </div>

            <div class="section-title">Order Summary</div>
            <table class="items-table">
                <thead>
                    <tr>
                        <th>Item</th>
                        <th style="text-align: center; width: 80px;">Qty</th>
                        <th style="text-align: right; width: 120px;">Price</th>
                    </tr>
                </thead>
                <tbody>
                    ${itemsList}
                    <tr class="summary-row">
                        <td colspan="2" style="text-align: right; padding-right: 12px;">Subtotal</td>
                        <td style="text-align: right;">₦${(orderData.subtotal / 100).toLocaleString('en-NG', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                    </tr>
                    <tr class="summary-row">
                        <td colspan="2" style="text-align: right; padding-right: 12px;">Delivery Fee</td>
                        <td style="text-align: right;">₦${(orderData.deliveryFee / 100).toLocaleString('en-NG', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                    </tr>
                    <tr class="summary-row">
                        <td colspan="2" style="text-align: right; padding-right: 12px;">Tax (7.5%)</td>
                        <td style="text-align: right;">₦${((orderData.tax || 0) / 100).toLocaleString('en-NG', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                    </tr>
                    <tr class="total-row">
                        <td colspan="2" style="text-align: right; padding-right: 12px; font-size: 16px;">Total Amount</td>
                        <td style="text-align: right; font-size: 18px;">₦${(orderData.totalAmount / 100).toLocaleString('en-NG', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                    </tr>
                </tbody>
            </table>

            <div class="info-card">
                <h4>Delivery Details</h4>
                <p><strong>📍 Delivery Address:</strong><br>${orderData.deliveryAddress}</p>
                <p><strong>💳 Payment Method:</strong> ${orderData.paymentMethod.replace('_', ' ').toUpperCase()}</p>
            </div>

            ${handoverCodeSection}

            <div class="divider"></div>

            <div style="margin: 30px 0;">
                <h3 style="color: #212529; font-size: 18px; margin-bottom: 20px;">What Happens Next?</h3>
                <div class="timeline">
                    <div class="timeline-item">
                        <div class="timeline-icon">1</div>
                        <div class="timeline-content">
                            <div class="timeline-title">Order Processing</div>
                            <div class="timeline-desc">We're picking the freshest produce for your order</div>
                        </div>
                    </div>
                    <div class="timeline-item">
                        <div class="timeline-icon">2</div>
                        <div class="timeline-content">
                            <div class="timeline-title">Quality Check</div>
                            <div class="timeline-desc">Each item is carefully inspected before packing</div>
                        </div>
                    </div>
                    <div class="timeline-item">
                        <div class="timeline-icon">3</div>
                        <div class="timeline-content">
                            <div class="timeline-title">Out for Delivery</div>
                            <div class="timeline-desc">Your order will be on its way soon</div>
                        </div>
                    </div>
                    <div class="timeline-item">
                        <div class="timeline-icon">4</div>
                        <div class="timeline-content">
                            <div class="timeline-title">Delivered!</div>
                            <div class="timeline-desc">Enjoy your fresh produce</div>
                        </div>
                    </div>
                </div>
            </div>

            <div style="text-align: center; margin: 30px 0;">
                <a href="${process.env.FRONTEND_URL || 'https://farmchops.com'}/orders/${orderData.orderNumber}" class="cta-button">Track Your Order</a>
            </div>

            <div class="divider"></div>

            <p style="color: #495057; font-size: 14px; text-align: center; line-height: 1.8;">
                Need help? Contact us at <a href="mailto:${process.env.SUPPORT_EMAIL || 'support@farmchops.com'}" style="color: #28a745; text-decoration: none; font-weight: 600;">${process.env.SUPPORT_EMAIL || 'support@farmchops.com'}</a>
            </p>

            <p style="margin-top: 35px; color: #495057; text-align: center;">
                Thank you for choosing FarmChops!<br>
                <strong style="color: #28a745;">The FarmChops Team</strong>
            </p>
        </div>
        <div class="footer">
            <div class="footer-logo">🌱 FarmChops</div>
            <p style="font-weight: 600; color: #495057;">Fresh Produce Delivered to Your Doorstep</p>
            <p style="margin-top: 15px;">
                <a href="${process.env.FRONTEND_URL || 'https://farmchops.com'}">Shop Again</a> •
                <a href="${process.env.FRONTEND_URL || 'https://farmchops.com'}/orders">My Orders</a> •
                <a href="${process.env.FRONTEND_URL || 'https://farmchops.com'}/contact">Contact Us</a>
            </p>
            <p style="margin-top: 20px; font-size: 12px; color: #6c757d;">
                &copy; ${new Date().getFullYear()} FarmChops. All rights reserved.<br>
                Plot 24 I.T Igbani Street, Off Awolowo Road, Jabi District, Abuja
            </p>
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

  // Send contact form notification to support team
  async sendContactNotificationToSupport(data: {
    email: string;
    fullName: string;
    message: string;
    submittedAt: Date;
  }): Promise<boolean> {
    try {
      const supportEmail = process.env.SUPPORT_EMAIL || 'support@farmchops.com';

      const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>New Contact Form Submission</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f7fa; padding: 20px; line-height: 1.6; }
        .email-wrapper { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.08); }
        .header { background: linear-gradient(135deg, #28a745 0%, #20c997 100%); padding: 40px 30px; text-align: center; }
        .header h1 { color: #ffffff; font-size: 24px; font-weight: 600; margin: 0; }
        .header p { color: rgba(255,255,255,0.9); font-size: 14px; margin-top: 8px; }
        .content { padding: 40px 30px; }
        .alert-badge { display: inline-block; background-color: #fef3cd; color: #856404; padding: 8px 16px; border-radius: 20px; font-size: 13px; font-weight: 600; margin-bottom: 20px; }
        .info-card { background-color: #f8f9fa; border-radius: 10px; padding: 24px; margin: 24px 0; border: 1px solid #e9ecef; }
        .info-row { display: flex; padding: 12px 0; border-bottom: 1px solid #e9ecef; }
        .info-row:last-child { border-bottom: none; }
        .info-label { font-weight: 600; color: #495057; min-width: 100px; }
        .info-value { color: #212529; flex: 1; }
        .message-section { margin-top: 20px; padding-top: 20px; border-top: 2px solid #e9ecef; }
        .message-label { font-weight: 600; color: #495057; font-size: 14px; margin-bottom: 12px; display: block; }
        .message-content { background-color: #ffffff; padding: 20px; border-radius: 8px; border-left: 4px solid #28a745; color: #212529; line-height: 1.8; }
        .action-button { display: inline-block; background: linear-gradient(135deg, #28a745 0%, #20c997 100%); color: #ffffff; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; margin-top: 24px; box-shadow: 0 4px 10px rgba(40, 167, 69, 0.3); }
        .action-button:hover { box-shadow: 0 6px 16px rgba(40, 167, 69, 0.4); }
        .footer { background-color: #f8f9fa; padding: 30px; text-align: center; border-top: 1px solid #e9ecef; }
        .footer p { color: #6c757d; font-size: 13px; margin: 5px 0; }
        .footer a { color: #28a745; text-decoration: none; }
        .divider { height: 1px; background: linear-gradient(to right, transparent, #e9ecef, transparent); margin: 30px 0; }
        @media only screen and (max-width: 600px) {
            .email-wrapper { border-radius: 0; }
            .header, .content, .footer { padding: 30px 20px; }
            .info-row { flex-direction: column; }
            .info-label { margin-bottom: 4px; }
        }
    </style>
</head>
<body>
    <div class="email-wrapper">
        <div class="header">
            <img src="${process.env.LOGO_URL || 'https://farmchops.com/logo.png'}" alt="FarmChops Logo" style="max-width: 180px; height: auto; margin-bottom: 20px;" />
            <h1>📬 New Contact Message</h1>
            <p>Someone reached out through your website</p>
        </div>
        <div class="content">
            <span class="alert-badge">⚡ ACTION REQUIRED</span>

            <p style="color: #495057; font-size: 15px; margin-bottom: 20px;">
                A new message has been submitted through the FarmChops contact form. Please review and respond promptly.
            </p>

            <div class="info-card">
                <div class="info-row">
                    <span class="info-label">👤 Name:</span>
                    <span class="info-value">${data.fullName}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">✉️ Email:</span>
                    <span class="info-value"><a href="mailto:${data.email}" style="color: #28a745; text-decoration: none;">${data.email}</a></span>
                </div>
                <div class="info-row">
                    <span class="info-label">🕒 Time:</span>
                    <span class="info-value">${data.submittedAt.toLocaleString('en-US', { dateStyle: 'full', timeStyle: 'short' })}</span>
                </div>

                <div class="message-section">
                    <span class="message-label">💬 Message:</span>
                    <div class="message-content">${data.message}</div>
                </div>
            </div>

            <div style="text-align: center;">
                <a href="mailto:${data.email}" class="action-button">Reply to Customer</a>
            </div>

            <div class="divider"></div>

            <p style="color: #6c757d; font-size: 13px; text-align: center;">
                💡 <strong>Pro Tip:</strong> Respond within 24 hours to maintain customer satisfaction
            </p>
        </div>
        <div class="footer">
            <p style="font-weight: 600; color: #495057;">FarmChops Support System</p>
            <p>Automated notification • Do not reply to this email</p>
            <p style="margin-top: 15px;">
                <a href="${process.env.FRONTEND_URL || 'https://farmchops.com'}">Visit Dashboard</a>
            </p>
        </div>
    </div>
</body>
</html>
      `;

      const text = `
New Contact Form Submission

Name: ${data.fullName}
Email: ${data.email}
Submitted: ${data.submittedAt.toLocaleString()}

Message:
${data.message}

Please respond to the customer at ${data.email}
      `;

      const info = await this.getTransporter().sendMail({
        from: process.env.EMAIL_FROM || `"Farmchops Contact" <${process.env.EMAIL_USER}>`,
        to: supportEmail,
        subject: `New Contact Form Message from ${data.fullName}`,
        text,
        html,
      });

      console.log("Contact notification sent to support:", info.messageId);
      return true;
    } catch (error) {
      console.error("Error sending contact notification to support:", error);
      return false;
    }
  }

  // Send confirmation email to user who submitted contact form
  async sendContactConfirmationEmail(
    email: string,
    data: {
      fullName: string;
      message: string;
    }
  ): Promise<boolean> {
    try {
      const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Thank You for Contacting Us</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f7fa; padding: 20px; line-height: 1.6; }
        .email-wrapper { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.08); }
        .header { background: linear-gradient(135deg, #28a745 0%, #20c997 100%); padding: 50px 30px; text-align: center; position: relative; }
        .header-icon { font-size: 48px; margin-bottom: 15px; }
        .header h1 { color: #ffffff; font-size: 26px; font-weight: 600; margin: 0; }
        .header p { color: rgba(255,255,255,0.95); font-size: 15px; margin-top: 10px; }
        .content { padding: 40px 30px; }
        .greeting { font-size: 18px; color: #212529; font-weight: 600; margin-bottom: 20px; }
        .success-badge { display: inline-flex; align-items: center; background-color: #d4edda; color: #155724; padding: 10px 20px; border-radius: 25px; font-size: 14px; font-weight: 600; margin-bottom: 25px; }
        .success-badge::before { content: "✓"; margin-right: 8px; font-size: 18px; }
        .message-recap { background-color: #f8f9fa; border-radius: 10px; padding: 24px; margin: 25px 0; border-left: 4px solid #28a745; }
        .message-recap-title { font-weight: 600; color: #495057; font-size: 14px; margin-bottom: 12px; display: flex; align-items: center; }
        .message-recap-title::before { content: "💬"; margin-right: 8px; font-size: 18px; }
        .message-recap-content { color: #212529; line-height: 1.8; background-color: #ffffff; padding: 16px; border-radius: 6px; font-style: italic; }
        .info-box { background: linear-gradient(135deg, #e8f5e9 0%, #f1f8f4 100%); border-radius: 10px; padding: 20px; margin: 25px 0; border: 1px solid #c8e6c9; }
        .info-box-title { font-weight: 600; color: #2e7d32; margin-bottom: 10px; display: flex; align-items: center; }
        .info-box-title::before { content: "⏱️"; margin-right: 8px; font-size: 18px; }
        .info-box p { color: #1b5e20; font-size: 14px; margin: 5px 0; }
        .contact-card { background-color: #fff; border: 2px solid #e9ecef; border-radius: 10px; padding: 20px; margin: 25px 0; text-align: center; }
        .contact-card p { color: #495057; font-size: 14px; margin: 8px 0; }
        .contact-email { color: #28a745; font-weight: 600; font-size: 15px; }
        .cta-button { display: inline-block; background: linear-gradient(135deg, #28a745 0%, #20c997 100%); color: #ffffff; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; margin: 25px 0; box-shadow: 0 4px 10px rgba(40, 167, 69, 0.3); }
        .cta-button:hover { box-shadow: 0 6px 16px rgba(40, 167, 69, 0.4); }
        .footer { background-color: #f8f9fa; padding: 30px; text-align: center; border-top: 1px solid #e9ecef; }
        .footer-logo { font-size: 20px; font-weight: 700; color: #28a745; margin-bottom: 10px; }
        .footer p { color: #6c757d; font-size: 13px; margin: 8px 0; }
        .footer a { color: #28a745; text-decoration: none; font-weight: 600; }
        .social-links { margin-top: 20px; }
        .social-links a { display: inline-block; margin: 0 10px; color: #6c757d; text-decoration: none; font-size: 14px; }
        .divider { height: 1px; background: linear-gradient(to right, transparent, #e9ecef, transparent); margin: 30px 0; }
        @media only screen and (max-width: 600px) {
            .email-wrapper { border-radius: 0; }
            .header, .content, .footer { padding: 30px 20px; }
        }
    </style>
</head>
<body>
    <div class="email-wrapper">
        <div class="header">
            <img src="${process.env.LOGO_URL || 'https://farmchops.com/logo.png'}" alt="FarmChops Logo" style="max-width: 180px; height: auto; margin-bottom: 20px;" />
            <div class="header-icon">✉️</div>
            <h1>We Got Your Message!</h1>
            <p>Thank you for reaching out to FarmChops</p>
        </div>
        <div class="content">
            <p class="greeting">Hi ${data.fullName},</p>

            <span class="success-badge">Message Received Successfully</span>

            <p style="color: #495057; font-size: 15px; margin-bottom: 20px;">
                Thank you for contacting us! We've received your message and our team is reviewing it.
                We typically respond within <strong>24 hours</strong> during business days.
            </p>

            <div class="message-recap">
                <div class="message-recap-title">Your Message</div>
                <div class="message-recap-content">${data.message}</div>
            </div>

            <div class="info-box">
                <div class="info-box-title">What Happens Next?</div>
                <p>📧 Our support team is reviewing your message</p>
                <p>⏰ We'll respond within 24 hours (usually faster!)</p>
                <p>📬 Watch your inbox at <strong>${email}</strong></p>
            </div>

            <div class="divider"></div>

            <div class="contact-card">
                <p style="font-weight: 600; color: #212529; font-size: 15px; margin-bottom: 12px;">Need Immediate Help?</p>
                <p>For urgent matters, you can reach us at:</p>
                <p class="contact-email">${process.env.SUPPORT_EMAIL || 'support@farmchops.com'}</p>
            </div>

            <div style="text-align: center;">
                <a href="${process.env.FRONTEND_URL || 'https://farmchops.com'}" class="cta-button">Continue Shopping</a>
            </div>

            <div class="divider"></div>

            <p style="color: #495057; font-size: 14px; text-align: center;">
                We appreciate your patience and look forward to assisting you!
            </p>

            <p style="margin-top: 30px; color: #495057;">
                Best regards,<br>
                <strong style="color: #28a745;">The FarmChops Team</strong>
            </p>
        </div>
        <div class="footer">
            <div class="footer-logo">🌱 FarmChops</div>
            <p style="font-weight: 600; color: #495057;">Fresh Produce Delivered to Your Doorstep</p>
            <p style="margin-top: 15px;">
                <a href="${process.env.FRONTEND_URL || 'https://farmchops.com'}">Visit Website</a> •
                <a href="${process.env.FRONTEND_URL || 'https://farmchops.com'}/about">About Us</a> •
                <a href="${process.env.FRONTEND_URL || 'https://farmchops.com'}/faq">FAQs</a>
            </p>
            <p style="margin-top: 20px; font-size: 12px;">
                This is an automated confirmation. Please do not reply to this email.<br>
                For support, contact us at ${process.env.SUPPORT_EMAIL || 'support@farmchops.com'}
            </p>
        </div>
    </div>
</body>
</html>
      `;

      const text = `
Thank You for Contacting FarmChops!

Hi ${data.fullName},

We've received your message and will get back to you within 24 hours.

Your message:
${data.message}

Our support team reviews all messages and will respond to you at ${email} as soon as possible.

If you have any urgent concerns, please feel free to reach out to us directly.

Best regards,
FarmChops Support Team

---
FarmChops - Fresh Produce Delivered
This is an automated confirmation email. Please do not reply directly to this message.
      `;

      const info = await this.getTransporter().sendMail({
        from: process.env.EMAIL_FROM || `"Farmchops" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: 'We received your message - FarmChops',
        text,
        html,
      });

      console.log("Contact confirmation email sent:", info.messageId);
      return true;
    } catch (error) {
      console.error("Error sending contact confirmation email:", error);
      return false;
    }
  }
}

// Export singleton instance
export const emailService = new EmailService();
export default emailService;