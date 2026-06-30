import { resolveSupportEmail } from './base';

const normalizeAmount = (value: any): number => {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return parseFloat(value) || 0;
  if (value && typeof value === 'object') {
    const parsed = parseFloat(value.toString());
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  return 0;
};

const formatAmount = (value: any) =>
  `₦${normalizeAmount(value).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const toTitleCase = (value: string) =>
  value.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.slice(1).toLowerCase());

export const orderConfirmationTemplate = (orderData: any) => {
  const supportEmail = resolveSupportEmail();
  const customerName = orderData.customerName || 'there';
  const readablePaymentMethod = toTitleCase((orderData.paymentMethod || 'wallet').toString().replace(/_/g, ' '));

  const itemsList = (orderData.items || [])
    .map((item: any) => `- ${item.productName} x${item.quantity}: ${formatAmount(item.price)}`)
    .join('\n');

  const text = `
Hello ${customerName},

Your order ${orderData.orderNumber} has been confirmed!

Items:
${itemsList || '- Order details are available in the app.'}

Subtotal: ${formatAmount(orderData.subtotal)}
Delivery Fee: ${formatAmount(orderData.deliveryFee)} (cash on delivery)
Tax: ${formatAmount(orderData.tax)}
Total: ${formatAmount(orderData.totalAmount)}
Payment Method: ${readablePaymentMethod}
Delivery Address: ${orderData.deliveryAddress || 'Abuja, Nigeria'}

Need help? Contact ${supportEmail}.

Thank you for choosing Farmchops
  `;

  const itemRows = (orderData.items || []).length
    ? orderData.items.map((item: any) => `
      <tr>
        <td style="padding:12px;border-top:1px solid #f0f0f0;font-size:14px;">${item.productName} <span style="color:#888;">×${item.quantity}</span></td>
        <td style="padding:12px;border-top:1px solid #f0f0f0;font-size:14px;text-align:right;font-weight:600;">${formatAmount(item.price)}</td>
      </tr>`).join('')
    : '<tr><td colspan="2" style="padding:12px;font-size:14px;">Order details are available in the app.</td></tr>';

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
    .status-tag { margin-top:8px; display:inline-block; padding:6px 16px; border-radius:999px; border:1px solid rgba(255,255,255,0.6); font-size:13px; text-transform:uppercase; letter-spacing:1px; }
    .content { padding:32px; }
    .section { margin-top:24px; }
    .section-title { font-size:14px; text-transform:uppercase; letter-spacing:1.5px; color:#28a745; font-weight:700; margin-bottom:12px; }
    .items-table { width:100%; border-collapse:collapse; border:1px solid #f0f0f0; border-radius:8px; overflow:hidden; }
    .items-table th { background:#f9f9f9; text-align:left; padding:12px; font-size:12px; color:#777; text-transform:uppercase; }
    .summary-row { display:flex; justify-content:space-between; padding:8px 0; font-size:14px; }
    .total-row { font-size:16px; font-weight:700; border-top:1px solid #e8e8e8; padding-top:12px; margin-top:8px; }
    .delivery-card { border:1px solid #e7f4ea; background:#f6fff8; border-radius:10px; padding:16px; line-height:1.6; }
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
      <div class="status-tag">Order Confirmed</div>
    </div>
    <div class="content">
      <p style="font-size:16px;">Hello ${customerName},</p>
      <p style="color:#666;">Thanks for placing your order. We're getting everything ready and will notify you when it's on the way.</p>

      <div class="section">
        <div class="section-title">Order Summary</div>
        <p style="font-size:18px;font-weight:bold;margin:0 0 12px;">Order ${orderData.orderNumber}</p>
        <table class="items-table">
          <tr><th>Item</th><th style="text-align:right;">Total</th></tr>
          ${itemRows}
        </table>
      </div>

      <div class="section">
        <div class="section-title">Payment Breakdown</div>
        <div class="summary-row"><span>Subtotal</span><span>${formatAmount(orderData.subtotal)}</span></div>
        <div class="summary-row"><span>Delivery Fee <span style="color:#888;font-size:12px;">(cash on delivery)</span></span><span>${formatAmount(orderData.deliveryFee)}</span></div>
        <div class="summary-row"><span>Tax &amp; Charges</span><span>${formatAmount(orderData.tax)}</span></div>
        <div class="summary-row total-row"><span>Total Paid</span><span>${formatAmount(orderData.totalAmount)}</span></div>
      </div>

      <div class="section">
        <div class="section-title">Delivery Details</div>
        <div class="delivery-card">
          <strong>Address</strong>
          <p style="margin:4px 0 12px;">${orderData.deliveryAddress || 'Abuja, Nigeria'}</p>
          <strong>Payment Method</strong>
          <p style="margin:4px 0;">${readablePaymentMethod}</p>
        </div>
      </div>


      <p class="help-text">Questions? Reply to this email or contact <a href="mailto:${supportEmail}">${supportEmail}</a>.</p>
      <p class="signoff">Thank you for choosing <span>Farmchops</span>.</p>
    </div>
  </div>
</body>
</html>`;

  return { subject: `Order Confirmation - ${orderData.orderNumber}`, text, html };
};
