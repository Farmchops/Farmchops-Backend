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
      rejectUnauthorized: false
    },
    // Add connection timeout
    connectionTimeout: 60000, // 60 seconds
    greetingTimeout: 30000,   // 30 seconds
    socketTimeout: 60000      // 60 seconds
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
      // console.log("Testing email connection...");
      // console.log("Host:", process.env.EMAIL_HOST || "mail.privateemail.com");
      // console.log("Port:", process.env.EMAIL_PORT || "587");
      // console.log("User:", process.env.EMAIL_USER);
      // console.log("Pass:", process.env.EMAIL_PASS ? "***SET***" : "MISSING");
      // console.log("Secure:", process.env.EMAIL_SECURE);
      
      await this.getTransporter().verify();
      console.log("Email service connected successfully");
      return true;
    } catch (error: any) {
      console.error("Email service connection failed:", error.message);
      console.error("Error code:", error.code);
      console.error("Error details:", error);
      
      // Suggest fixes based on error type
      if (error.code === 'ESOCKET' || error.code === 'ECONNRESET') {
        // console.log("💡 Try these fixes:");
        // console.log("1. Check if EMAIL_HOST=mail.privateemail.com (not smtp)");
        // console.log("2. Try port 465 with SSL instead of 587");
        // console.log("3. Verify your email credentials are correct");
        // console.log("4. Check if your hosting provider blocks SMTP");
      }
      
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
}

// Export singleton instance
export const emailService = new EmailService();
export default emailService;