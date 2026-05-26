export const resolveSupportEmail = () =>
  process.env.SUPPORT_EMAIL || process.env.EMAIL_USER || 'support@farmchops.com';

export const simpleTemplate = (code: string, message: string): string => {
  const supportEmail = resolveSupportEmail();
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { margin:0; padding:0; font-family:Arial,sans-serif; background-color:#f5f5f5; }
    .container { max-width:600px; margin:40px auto; background-color:#ffffff; }
    .header { background-color:#28a745; padding:30px; text-align:center; }
    .logo { color:#ffffff; font-size:24px; font-weight:bold; }
    .content { padding:40px 30px; }
    .greeting { color:#333; font-size:16px; margin-bottom:20px; }
    .message { color:#666; font-size:14px; line-height:1.6; margin-bottom:30px; }
    .code { background-color:#f8f8f8; border:1px solid #e0e0e0; padding:20px; text-align:center; font-size:32px; font-weight:bold; letter-spacing:8px; margin:30px 0; }
    .footer { color:#999; font-size:12px; line-height:1.6; margin-top:30px; }
    .footer-brand { color:#28a745; font-weight:bold; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header"><div class="logo">Farmchops</div></div>
    <div class="content">
      <div class="greeting">Hello,</div>
      <div class="message">${message}</div>
      ${code ? `<div class="code">${code}</div>` : ''}
      <div class="footer">
        If you didn't initiate this request, contact us at ${supportEmail}.<br><br>
        Thank you for choosing <span class="footer-brand">Farmchops</span>
      </div>
    </div>
  </div>
</body>
</html>`;
};
