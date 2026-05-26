export const adminInviteTemplate = (otp: string, adminRole: string, signupLink: string) => {
  const roleName = adminRole.replace(/_/g, ' ').toUpperCase();
  return {
    subject: 'Admin Invitation - Farmchops',
    text: `Hello,\n\nYou've been invited to join the Farmchops admin team as ${roleName}.\n\nYour verification code is: ${otp}\n\nSignup link: ${signupLink}\n\nThank you for choosing Farmchops`,
    html: `
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
    .role { background-color:#f0f0f0; padding:10px; border-radius:5px; text-align:center; font-weight:bold; margin:20px 0; }
    .code { background-color:#f8f8f8; border:1px solid #e0e0e0; padding:20px; text-align:center; font-size:32px; font-weight:bold; letter-spacing:8px; margin:30px 0; }
    .button { display:inline-block; background-color:#28a745; color:#ffffff; padding:15px 30px; text-decoration:none; border-radius:5px; margin:20px 0; }
    .footer { color:#999; font-size:12px; line-height:1.6; margin-top:30px; }
    .footer-brand { color:#28a745; font-weight:bold; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header"><div class="logo">Farmchops</div></div>
    <div class="content">
      <p>Hello,</p>
      <p>You've been invited to join the Farmchops admin team.</p>
      <div class="role">Role: ${roleName}</div>
      <p>Your verification code:</p>
      <div class="code">${otp}</div>
      <div style="text-align:center;">
        <a href="${signupLink}" class="button">Complete Signup</a>
      </div>
      <div class="footer">
        If you didn't expect this invitation, please ignore this email.<br><br>
        Thank you for choosing <span class="footer-brand">Farmchops</span>
      </div>
    </div>
  </div>
</body>
</html>`
  };
};
