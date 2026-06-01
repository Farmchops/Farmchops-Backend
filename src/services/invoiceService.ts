import PDFDocument from 'pdfkit';
import { Response } from 'express';

const formatAmount = (v: number) =>
  `N${v.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const green = '#28a745';
const dark = '#1a1a1a';
const grey = '#666666';
const lightGrey = '#f5f5f5';

function drawInvoice(doc: PDFKit.PDFDocument, order: any): void {
  const pageWidth = doc.page.width - 100;

  // Header bar
  doc.rect(50, 45, pageWidth, 70).fill(green);
  doc.fillColor('#ffffff').fontSize(22).font('Helvetica-Bold').text('Farmchops', 65, 62);
  doc.fontSize(10).font('Helvetica').text('Fresh Farm Produce Delivered', 65, 90);

  // INVOICE label top right
  doc.fontSize(28).font('Helvetica-Bold').text('INVOICE', 50, 65, { align: 'right', width: pageWidth });
  doc.fontSize(10).font('Helvetica').text(order.orderNumber, 50, 98, { align: 'right', width: pageWidth });

  doc.fillColor(dark);

  // Bill To + Order Details
  const col1X = 50;
  const col2X = 350;
  let y = 140;

  doc.fontSize(9).font('Helvetica-Bold').fillColor(grey).text('BILL TO', col1X, y);
  doc.fontSize(9).font('Helvetica-Bold').fillColor(grey).text('ORDER DETAILS', col2X, y);

  y += 16;
  const customer = order.user
    ? `${order.user.firstName || ''} ${order.user.lastName || ''}`.trim()
    : 'Customer';
  const email = order.user?.email || '';
  const phone = order.deliveryInfo?.phoneNumber || '';

  doc.fontSize(11).font('Helvetica-Bold').fillColor(dark).text(customer, col1X, y);
  doc.fontSize(10).font('Helvetica').fillColor(grey);
  if (email) doc.text(email, col1X, y + 16);
  if (phone) doc.text(phone, col1X, y + (email ? 30 : 16));

  doc.fontSize(10).font('Helvetica').fillColor(grey);
  const orderDate = order.createdAt
    ? new Date(order.createdAt).toLocaleDateString('en-NG', { day: 'numeric', month: 'long', year: 'numeric' })
    : '-';
  doc.text(`Date: ${orderDate}`, col2X, y);
  doc.text(`Status: ${order.orderStatus || order.status || '-'}`, col2X, y + 16);
  doc.text(`Payment: ${order.paymentStatus || '-'}`, col2X, y + 32);
  if (order.paymentReference || order.paystackReference) {
    doc.text(`Txn ID: ${order.paymentReference || order.paystackReference}`, col2X, y + 48);
  }

  // Delivery address
  y += 80;
  doc.fontSize(9).font('Helvetica-Bold').fillColor(grey).text('DELIVERY ADDRESS', col1X, y);
  y += 14;
  doc.fontSize(10).font('Helvetica').fillColor(dark).text(order.deliveryInfo?.address || '-', col1X, y, { width: 260 });

  y += 50;

  // Items table header
  doc.rect(50, y, pageWidth, 24).fill(green);
  doc.fillColor('#ffffff').fontSize(10).font('Helvetica-Bold');
  doc.text('ITEM', 60, y + 7);
  doc.text('QTY', 300, y + 7, { width: 50, align: 'center' });
  doc.text('UNIT PRICE', 355, y + 7, { width: 90, align: 'right' });
  doc.text('TOTAL', 450, y + 7, { width: 95, align: 'right' });

  y += 24;

  const items = order.items || [];
  items.forEach((item: any, index: number) => {
    const rowY = y + index * 28;
    if (index % 2 === 0) {
      doc.rect(50, rowY, pageWidth, 28).fill(lightGrey);
    }
    const unitPrice = item.unitPrice || item.price || 0;
    const qty = item.quantity || 1;
    const total = unitPrice * qty;

    doc.fillColor(dark).fontSize(10).font('Helvetica');
    doc.text(item.productName || '-', 60, rowY + 9, { width: 265 });
    doc.text(String(qty), 300, rowY + 9, { width: 50, align: 'center' });
    doc.text(formatAmount(unitPrice), 355, rowY + 9, { width: 90, align: 'right' });
    doc.text(formatAmount(total), 450, rowY + 9, { width: 95, align: 'right' });
  });

  y += items.length * 28 + 16;

  // Totals
  const totalsX = 370;
  const totalsValueX = 400;
  const totalsWidth = 145;

  doc.moveTo(50, y).lineTo(50 + pageWidth, y).strokeColor('#e0e0e0').lineWidth(1).stroke();
  y += 12;

  const subtotal = order.subtotal || order.totalAmount || 0;
  const deliveryFee = order.deliveryFee || 0;
  const total = order.totalAmount || subtotal + deliveryFee;

  doc.fontSize(10).font('Helvetica').fillColor(grey);
  doc.text('Subtotal', totalsX, y);
  doc.text(formatAmount(subtotal), totalsValueX, y, { width: totalsWidth, align: 'right' });

  y += 18;
  doc.text('Delivery Fee', totalsX, y);
  doc.text(formatAmount(deliveryFee), totalsValueX, y, { width: totalsWidth, align: 'right' });

  y += 20;
  doc.rect(totalsX - 10, y, 50 + pageWidth - totalsX + 10, 32).fill(green);
  doc.fillColor('#ffffff').fontSize(12).font('Helvetica-Bold');
  doc.text('TOTAL', totalsX, y + 10);
  doc.text(formatAmount(total), totalsValueX, y + 10, { width: totalsWidth, align: 'right' });

  // Footer
  y += 60;
  doc.moveTo(50, y).lineTo(50 + pageWidth, y).strokeColor('#e0e0e0').lineWidth(1).stroke();
  y += 12;
  doc.fontSize(9).font('Helvetica').fillColor(grey)
    .text('Thank you for shopping with Farmchops. For support, contact support@farmchops.com', 50, y, { align: 'center', width: pageWidth });
}

export function generateInvoicePDF(order: any, res: Response): void {
  const doc = new PDFDocument({ margin: 50, size: 'A4' });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="invoice-${order.orderNumber}.pdf"`);
  doc.pipe(res);

  drawInvoice(doc, order);
  doc.end();
}

export function generateBulkInvoicePDF(orders: any[], res: Response, filename = 'invoices-bulk.pdf'): void {
  const doc = new PDFDocument({ margin: 50, size: 'A4' });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  doc.pipe(res);

  orders.forEach((order, index) => {
    if (index > 0) doc.addPage();
    drawInvoice(doc, order);
  });

  doc.end();
}
