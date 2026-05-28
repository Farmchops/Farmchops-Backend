interface NewOrderNotificationData {
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  totalAmount: number;
  deliveryAddress: string;
  items: { productName: string; quantity: number; price: number }[];
}

const formatAmount = (v: number) =>
  `₦${v.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const newOrderNotificationTemplate = (data: NewOrderNotificationData): { subject: string; html: string } => {
  const itemRows = data.items
    .map(
      (i) => `
      <tr>
        <td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;font-size:14px;">${i.productName}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;font-size:14px;text-align:center;">${i.quantity}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;font-size:14px;text-align:right;font-weight:600;">${formatAmount(i.price)}</td>
      </tr>`
    )
    .join('');

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;font-family:Arial,sans-serif;background:#f5f5f5;">
  <div style="max-width:600px;margin:32px auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.08);">

    <div style="background:#28a745;padding:28px 32px;text-align:center;">
      <div style="color:#ffffff;font-size:24px;font-weight:700;letter-spacing:0.5px;">Farmchops</div>
      <div style="color:#d4edda;font-size:13px;margin-top:6px;text-transform:uppercase;letter-spacing:1px;">New Order Received</div>
    </div>

    <div style="padding:32px;">
      <p style="font-size:16px;color:#333;margin:0 0 24px;">
        A new order has been placed. Please log in to the admin dashboard to process it.
      </p>

      <div style="background:#f6fff8;border:1px solid #e7f4ea;border-radius:10px;padding:20px;margin-bottom:24px;">
        <table style="width:100%;border-collapse:collapse;">
          <tr>
            <td style="padding:6px 0;font-size:14px;color:#666;">Order Number</td>
            <td style="padding:6px 0;font-size:14px;font-weight:700;text-align:right;color:#28a745;">${data.orderNumber}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;font-size:14px;color:#666;">Customer</td>
            <td style="padding:6px 0;font-size:14px;text-align:right;">${data.customerName}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;font-size:14px;color:#666;">Email</td>
            <td style="padding:6px 0;font-size:14px;text-align:right;">${data.customerEmail}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;font-size:14px;color:#666;">Delivery Address</td>
            <td style="padding:6px 0;font-size:14px;text-align:right;">${data.deliveryAddress}</td>
          </tr>
          <tr>
            <td style="padding:10px 0 0;font-size:15px;font-weight:700;color:#333;border-top:1px solid #e7f4ea;">Order Total</td>
            <td style="padding:10px 0 0;font-size:18px;font-weight:700;color:#28a745;text-align:right;border-top:1px solid #e7f4ea;">${formatAmount(data.totalAmount)}</td>
          </tr>
        </table>
      </div>

      <p style="font-size:13px;text-transform:uppercase;letter-spacing:1.5px;color:#28a745;font-weight:700;margin:0 0 12px;">Order Items</p>
      <table style="width:100%;border-collapse:collapse;border:1px solid #f0f0f0;border-radius:8px;overflow:hidden;">
        <thead>
          <tr style="background:#f9f9f9;">
            <th style="padding:10px 12px;text-align:left;font-size:12px;color:#777;text-transform:uppercase;font-weight:600;">Item</th>
            <th style="padding:10px 12px;text-align:center;font-size:12px;color:#777;text-transform:uppercase;font-weight:600;">Qty</th>
            <th style="padding:10px 12px;text-align:right;font-size:12px;color:#777;text-transform:uppercase;font-weight:600;">Price</th>
          </tr>
        </thead>
        <tbody>${itemRows}</tbody>
      </table>
    </div>

    <div style="padding:0 32px 32px;text-align:center;">
      <a href="${process.env.ADMIN_URL || 'https://farmchops.com/admin'}/orders"
        style="display:inline-block;background:#28a745;color:#ffffff;font-size:15px;font-weight:600;padding:14px 32px;border-radius:8px;text-decoration:none;letter-spacing:0.3px;">
        View Order in Dashboard
      </a>
    </div>

    <div style="background:#f9f9f9;padding:16px 32px;text-align:center;font-size:12px;color:#999;border-top:1px solid #f0f0f0;">
      This is an automated notification from Farmchops. Do not reply to this email.
    </div>

  </div>
</body>
</html>`;

  return {
    subject: `New Order ${data.orderNumber} — ${data.customerName}`,
    html
  };
};
