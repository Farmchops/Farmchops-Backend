import nodemailer from "nodemailer";

// Email transporter configuration
const createTransporter = () => {
  const port = parseInt(process.env.EMAIL_PORT || "587");
  
  return nodemailer.createTransport({
    host: process.env.EMAIL_HOST || "mail.privateemail.com",
    port: port,
    secure: port === 465, // true for 465 (SSL), false for 587 (TLS)
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
    tls: {
      // Don't fail on invalid certs (helpful for testing)
      rejectUnauthorized: false,
      minVersion: 'TLSv1', // Try older version
      maxVersion: 'TLSv1.2',
      ciphers: 'DEFAULT:!DH' // Try different cipher suite
    },
    // Add connection timeout
    connectionTimeout: 60000, 
    greetingTimeout: 30000,  
    socketTimeout: 60000,   
  });
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
    } catch (error) {
      console.error("Error sending verification email:", error);
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
}

// Export singleton instance
export const emailService = new EmailService();
export default emailService;