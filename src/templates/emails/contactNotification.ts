import { simpleTemplate } from './base';

export const contactSupportTemplate = (data: { fullName: string; email: string; message: string; submittedAt: Date }) => ({
  subject: `New Contact Form Message from ${data.fullName}`,
  text: `New Contact Message\n\nFrom: ${data.fullName} (${data.email})\nTime: ${data.submittedAt.toLocaleString()}\n\nMessage:\n${data.message}`,
  html: simpleTemplate('', `<strong>New Contact Message</strong><br><br>From: ${data.fullName} (${data.email})<br>Time: ${data.submittedAt.toLocaleString()}<br><br>Message:<br>${data.message}`)
});

export const contactConfirmationTemplate = (data: { fullName: string; message: string }) => ({
  subject: 'We received your message - Farmchops',
  text: `Hello ${data.fullName},\n\nThank you for contacting us! We've received your message and will get back to you within 24 hours.\n\nYour message:\n${data.message}\n\nThank you for choosing Farmchops`,
  html: simpleTemplate('', `Thank you for contacting us, <strong>${data.fullName}</strong>!<br><br>We've received your message and will get back to you within 24 hours.<br><br><em>"${data.message}"</em>`)
});
