import { simpleTemplate } from './base';

export const paymentSuccessTemplate = (data: { orderNumber: string; amount: number }) => {
  const amountFormatted = `₦${(data.amount / 100).toFixed(2)}`;
  return {
    subject: `Payment Confirmed - ${data.orderNumber}`,
    text: `Hello,\n\nYour payment has been confirmed!\n\nOrder Number: ${data.orderNumber}\nAmount Paid: ${amountFormatted}\n\nThank you for choosing Farmchops`,
    html: simpleTemplate(amountFormatted, `Your payment has been confirmed!<br><br>Order Number: ${data.orderNumber}`)
  };
};
