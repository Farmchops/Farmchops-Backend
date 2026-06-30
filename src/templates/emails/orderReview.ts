import { resolveSupportEmail } from './base';

export const orderReviewTemplate = (data: {
  customerName: string;
  orderNumber: string;
  reviewUrl: string;
}) => {
  const supportEmail = resolveSupportEmail();
  const { customerName, orderNumber, reviewUrl } = data;

  const text = `
Hello ${customerName},

Thank you for your recent order ${orderNumber} with Farmchops! We hope everything arrived fresh and exactly as expected.

We'd love to hear about your experience. Your feedback helps us keep our quality high and helps other shoppers make great choices.

Leave a review here: ${reviewUrl}

This link expires in 30 days.

Questions? Contact us at ${supportEmail}.

Thank you for choosing Farmchops!
  `;

  const ratings = [
    { emoji: '😞', label: 'Terrible', value: 1 },
    { emoji: '😕', label: 'Bad',      value: 2 },
    { emoji: '😐', label: 'Okay',     value: 3 },
    { emoji: '😊', label: 'Good',     value: 4 },
    { emoji: '🤩', label: 'Amazing',  value: 5 },
  ];

  const emojiButtons = ratings.map(r => `
    <a href="${reviewUrl}&rating=${r.value}" style="text-decoration:none;display:inline-block;margin:0 8px;text-align:center;">
      <div style="font-size:36px;line-height:1;">${r.emoji}</div>
      <div style="font-size:12px;color:#555;margin-top:6px;font-family:Arial,sans-serif;">${r.label}</div>
    </a>`).join('');

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { margin:0; padding:0; font-family:Arial,sans-serif; background-color:#f5f5f5; color:#333; }
    .container { max-width:640px; margin:32px auto; background:#fff; border-radius:12px; overflow:hidden; box-shadow:0 10px 30px rgba(0,0,0,0.07); }
    .header { background:#28a745; padding:32px 24px; text-align:center; color:#fff; }
    .logo { font-size:26px; font-weight:700; letter-spacing:0.5px; }
    .tag { margin-top:8px; display:inline-block; padding:6px 16px; border-radius:999px; border:1px solid rgba(255,255,255,0.6); font-size:13px; text-transform:uppercase; letter-spacing:1px; }
    .content { padding:32px; }
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
      <div class="tag">Order Complete</div>
    </div>
    <div class="content">
      <p style="font-size:16px;">Hello ${customerName},</p>
      <p style="color:#666;line-height:1.6;">
        Thank you for your order <strong>${orderNumber}</strong>! We hope everything arrived fresh and exactly as expected.
      </p>
      <p style="color:#666;line-height:1.6;">How would you rate your experience?</p>
      <div style="text-align:center;margin:32px 0;">
        ${emojiButtons}
        <p style="font-size:12px;color:#999;margin-top:20px;">Tap an emoji to leave your review. This link is valid for 30 days.</p>
      </div>
      <p class="help-text">Questions? Contact us at <a href="mailto:${supportEmail}">${supportEmail}</a>.</p>
      <p class="signoff">Thank you for choosing <span>Farmchops</span>.</p>
    </div>
  </div>
</body>
</html>`;

  return {
    subject: `How was your Farmchops order ${orderNumber}? Share your experience`,
    text,
    html,
  };
};
