import { resolveSupportEmail } from './base';

export const marketerWelcomeTemplate = (data: {
  firstName: string;
  lastName: string;
  marketingCode: string;
  commissionRate: number;
}) => {
  const supportEmail = resolveSupportEmail();
  const { firstName, lastName, marketingCode, commissionRate } = data;

  const text = `
Welcome to Farmchops Marketing Team!

Dear ${firstName} ${lastName},

Congratulations! You've been added to the Farmchops marketing team.

Your Marketing Details:
Marketing Code: ${marketingCode}
Commission Rate: ${commissionRate}%
Status: Active

How to Use Your Marketing Code:
1. Share your code "${marketingCode}" with potential customers
2. Ask them to enter it during signup at farmchops.com
3. When they sign up, they'll be linked to you
4. You earn ${commissionRate}% commission on their FIRST order

Example for Customers:
"Sign up at farmchops.com and use referral code ${marketingCode} to get 10% off your first order!"

Commission Details:
- Commission rate: ${commissionRate}%
- Earned on first order only from each customer
- Calculated on order subtotal before discounts
- Payments processed monthly

For questions, contact ${supportEmail}

Thank you for choosing Farmchops!
  `;

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { margin:0; padding:0; font-family:Arial,sans-serif; background-color:#f5f5f5; }
    .container { max-width:600px; margin:40px auto; background-color:#ffffff; border-radius:8px; overflow:hidden; }
    .header { background-color:#28a745; padding:30px; text-align:center; }
    .logo { color:#ffffff; font-size:28px; font-weight:bold; }
    .content { padding:40px 30px; }
    .greeting { color:#333; font-size:18px; margin-bottom:20px; font-weight:bold; }
    .message { color:#666; font-size:14px; line-height:1.6; margin-bottom:20px; }
    .info-box { background-color:#f8f9fa; border-left:4px solid #28a745; padding:20px; margin:30px 0; }
    .info-title { color:#28a745; font-weight:bold; margin-bottom:15px; font-size:16px; }
    .info-item { margin:10px 0; font-size:14px; }
    .code-box { background-color:#28a745; color:white; padding:20px; text-align:center; font-size:32px; font-weight:bold; letter-spacing:4px; margin:20px 0; border-radius:5px; }
    .section { margin:30px 0; }
    .section-title { color:#28a745; font-weight:bold; margin-bottom:15px; font-size:16px; }
    .instruction-item { margin:10px 0; padding-left:20px; position:relative; font-size:14px; color:#555; }
    .instruction-item:before { content:"•"; position:absolute; left:0; color:#28a745; font-weight:bold; }
    .instructions { background-color:#fff3cd; border-left:4px solid #ffc107; padding:15px; margin:20px 0; font-size:14px; }
    .footer { color:#999; font-size:12px; line-height:1.6; margin-top:40px; padding-top:20px; border-top:1px solid #e0e0e0; }
    .footer-brand { color:#28a745; font-weight:bold; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header"><div class="logo">Farmchops</div></div>
    <div class="content">
      <div class="greeting">Welcome to the Team, ${firstName}!</div>
      <div class="message">Congratulations! You've been added to the Farmchops marketing team. We're excited to have you on board.</div>

      <div class="info-box">
        <div class="info-title">Your Marketing Details</div>
        <div class="info-item"><strong>Name:</strong> ${firstName} ${lastName}</div>
        <div class="info-item"><strong>Commission Rate:</strong> ${commissionRate}%</div>
        <div class="info-item"><strong>Status:</strong> Active</div>
      </div>

      <div class="section">
        <div class="section-title">Your Marketing Code</div>
        <div class="code-box">${marketingCode}</div>
        <div class="message" style="text-align:center;font-style:italic;">Share this code with your customers</div>
      </div>

      <div class="section">
        <div class="section-title">How to Use Your Marketing Code</div>
        <div class="instruction-item">Share your code "${marketingCode}" with potential customers</div>
        <div class="instruction-item">Ask them to enter it during signup at farmchops.com</div>
        <div class="instruction-item">When they sign up, they'll be automatically linked to you</div>
        <div class="instruction-item">You earn ${commissionRate}% commission on their FIRST order only</div>
      </div>

      <div class="instructions">
        <strong>Example for Customers:</strong><br>
        <em>"Sign up at farmchops.com and use referral code <strong>${marketingCode}</strong> to get 10% off your first order! Fresh farm produce delivered to your doorstep."</em>
      </div>

      <div class="section">
        <div class="section-title">Commission Details</div>
        <div class="instruction-item">Commission rate: <strong>${commissionRate}%</strong></div>
        <div class="instruction-item">Earned on the customer's <strong>first order only</strong></div>
        <div class="instruction-item">Calculated on the order subtotal before any discounts</div>
        <div class="instruction-item">Payments are processed monthly</div>
      </div>

      <div class="footer">
        Need help? Contact us at <strong>${supportEmail}</strong><br><br>
        Thank you for being part of the <span class="footer-brand">Farmchops</span> family!
      </div>
    </div>
  </div>
</body>
</html>`;

  return { subject: 'Welcome to Farmchops Marketing Team', text, html };
};
