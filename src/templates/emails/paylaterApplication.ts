import { resolveSupportEmail } from './base';

export const paylaterApprovedTemplate = (data: {
  firstName: string;
  lastName: string;
  creditLimit: number;
}) => {
  const supportEmail = resolveSupportEmail();
  const { firstName, lastName, creditLimit } = data;
  const formattedLimit = `₦${creditLimit.toLocaleString()}`;

  const text = `
Hello ${firstName} ${lastName},

Great news! Your Farmchops PayLater application has been approved.

Your Credit Limit: ${formattedLimit}

You can now shop and pay later. Log in to the app to start shopping with your PayLater credit.

Need help? Contact ${supportEmail}.

Thank you for choosing Farmchops!
  `;

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { margin:0; padding:0; font-family:Arial,sans-serif; background-color:#f5f5f5; color:#333; }
    .container { max-width:600px; margin:32px auto; background:#fff; border-radius:12px; overflow:hidden; box-shadow:0 10px 30px rgba(0,0,0,0.07); }
    .header { background:#28a745; padding:32px 24px; text-align:center; color:#fff; }
    .logo { font-size:26px; font-weight:700; letter-spacing:0.5px; }
    .status-tag { margin-top:8px; display:inline-block; padding:6px 16px; border-radius:999px; border:1px solid rgba(255,255,255,0.6); font-size:13px; text-transform:uppercase; letter-spacing:1px; }
    .content { padding:32px; }
    .credit-box { background:#28a745; color:#fff; padding:20px; text-align:center; font-size:28px; font-weight:700; border-radius:8px; margin:24px 0; }
    .help-text { font-size:13px; color:#666; margin-top:24px; }
    .help-text a { color:#28a745; text-decoration:none; }
    .signoff { margin-top:30px; font-size:14px; color:#777; }
    .signoff span { color:#28a745; font-weight:700; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">Farmchops</div>
      <div class="status-tag">PayLater Approved</div>
    </div>
    <div class="content">
      <p style="font-size:16px;">Hello ${firstName} ${lastName},</p>
      <p style="color:#666;">Great news! Your Farmchops PayLater application has been approved. You can now shop and pay later.</p>

      <div class="credit-box">${formattedLimit} credit limit</div>

      <p style="color:#666;">Log in to the app to start shopping with your PayLater credit.</p>

      <p class="help-text">Questions? Reply to this email or contact <a href="mailto:${supportEmail}">${supportEmail}</a>.</p>
      <p class="signoff">Thank you for choosing <span>Farmchops</span>.</p>
    </div>
  </div>
</body>
</html>`;

  return { subject: 'Your Farmchops PayLater Application Has Been Approved', text, html };
};

export const paylaterRejectedTemplate = (data: {
  firstName: string;
  lastName: string;
  rejectionReason: string;
}) => {
  const supportEmail = resolveSupportEmail();
  const { firstName, lastName, rejectionReason } = data;

  const text = `
Hello ${firstName} ${lastName},

We've reviewed your Farmchops PayLater application and unfortunately we're unable to approve it at this time.

Reason: ${rejectionReason}

If you believe this is a mistake or would like more information, please contact ${supportEmail}.

Thank you for your interest in Farmchops.
  `;

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { margin:0; padding:0; font-family:Arial,sans-serif; background-color:#f5f5f5; color:#333; }
    .container { max-width:600px; margin:32px auto; background:#fff; border-radius:12px; overflow:hidden; box-shadow:0 10px 30px rgba(0,0,0,0.07); }
    .header { background:#6c757d; padding:32px 24px; text-align:center; color:#fff; }
    .logo { font-size:26px; font-weight:700; letter-spacing:0.5px; }
    .status-tag { margin-top:8px; display:inline-block; padding:6px 16px; border-radius:999px; border:1px solid rgba(255,255,255,0.6); font-size:13px; text-transform:uppercase; letter-spacing:1px; }
    .content { padding:32px; }
    .reason-box { background:#f8f9fa; border-left:4px solid #6c757d; padding:16px; margin:24px 0; font-size:14px; }
    .help-text { font-size:13px; color:#666; margin-top:24px; }
    .help-text a { color:#28a745; text-decoration:none; }
    .signoff { margin-top:30px; font-size:14px; color:#777; }
    .signoff span { color:#28a745; font-weight:700; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">Farmchops</div>
      <div class="status-tag">PayLater Application Update</div>
    </div>
    <div class="content">
      <p style="font-size:16px;">Hello ${firstName} ${lastName},</p>
      <p style="color:#666;">We've reviewed your Farmchops PayLater application and unfortunately we're unable to approve it at this time.</p>

      <div class="reason-box"><strong>Reason:</strong> ${rejectionReason}</div>

      <p style="color:#666;">If you believe this is a mistake or would like more information, please get in touch.</p>

      <p class="help-text">Contact <a href="mailto:${supportEmail}">${supportEmail}</a>.</p>
      <p class="signoff">Thank you for your interest in <span>Farmchops</span>.</p>
    </div>
  </div>
</body>
</html>`;

  return { subject: 'Update on Your Farmchops PayLater Application', text, html };
};
