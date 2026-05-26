import { simpleTemplate } from './base';

export const groupReadyTemplate = (data: { productName: string; checkoutDeadline: string; amount: number; checkoutLink: string }) => {
  const amountFormatted = `₦${(data.amount / 100).toFixed(2)}`;
  const deadline = new Date(data.checkoutDeadline).toLocaleString();
  return {
    subject: 'Group Ready - Checkout Now!',
    text: `Hello,\n\nYour group for ${data.productName} is ready!\n\nCheckout deadline: ${deadline}\nYour amount: ${amountFormatted}\n\nCheckout link: ${data.checkoutLink}\n\nThank you for choosing Farmchops`,
    html: simpleTemplate('', `Your group for <strong>${data.productName}</strong> is ready!<br><br>Checkout deadline: ${deadline}<br>Your amount: ${amountFormatted}<br><br><a href="${data.checkoutLink}" style="background:#28a745;color:#fff;padding:12px 24px;text-decoration:none;border-radius:5px;display:inline-block;">Checkout Now</a>`)
  };
};
