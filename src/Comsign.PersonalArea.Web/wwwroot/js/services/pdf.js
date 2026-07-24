import { APP_CONFIG } from '../config.js';
import { formatDate, formatMoney } from './format.js';

/**
 * הפקת חשבונית כקובץ PDF בצד הלקוח.
 * החשבונית מצוירת על Canvas (כדי לקבל תמיכה מלאה בעברית ו-RTL) ומוטמעת
 * כתמונת JPEG בתוך מסמך PDF תקני. במעבר לפרודקשן יש להחליף את הפונקציה
 * openInvoicePdf בהורדת ה-PDF החתום ממערכת החיוב (‎/api/invoices/{id}/document).
 */

const PAGE_W = 1240;
const PAGE_H = 1754;

const KIND_LABELS = {
  NewCredential: 'הנפקת כרטיס/טוקן חדש',
  Renewal: 'חידוש תעודה'
};

let logoPromise = null;
function loadLogo() {
  logoPromise ??= new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = '/assets/comsign-logo.png';
  });
  return logoPromise;
}

async function renderInvoiceCanvas(invoice, customer) {
  const canvas = document.createElement('canvas');
  canvas.width = PAGE_W;
  canvas.height = PAGE_H;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, PAGE_W, PAGE_H);

  // פס עליון בצבע המותג
  ctx.fillStyle = '#D8232A';
  ctx.fillRect(0, 0, PAGE_W, 18);

  const logo = await loadLogo();
  if (logo) {
    const w = 320;
    const h = (logo.height / logo.width) * w;
    ctx.drawImage(logo, 90, 70, w, h);
  }

  ctx.direction = 'rtl';
  ctx.textAlign = 'right';
  const right = PAGE_W - 90;

  ctx.fillStyle = '#0A0A0E';
  ctx.font = '700 54px Heebo, Arial, sans-serif';
  ctx.fillText('חשבונית מס / קבלה', right, 140);

  ctx.font = '400 26px Assistant, Arial, sans-serif';
  ctx.fillStyle = '#5A5A66';
  ctx.fillText(`מספר חשבונית ${invoice.invoiceNumber}`, right, 186);
  ctx.fillText(`תאריך הפקה ${formatDate(invoice.issuedOn)}`, right, 224);

  // פרטי הלקוח
  let y = 380;
  ctx.fillStyle = '#0A0A0E';
  ctx.font = '700 32px Heebo, Arial, sans-serif';
  ctx.fillText('פרטי לקוח', right, y);

  ctx.font = '400 26px Assistant, Arial, sans-serif';
  ctx.fillStyle = '#33333D';
  y += 48;
  ctx.fillText(`${customer.givenName} ${customer.surname}`, right, y);
  y += 38;
  ctx.fillText(`מספר ת.ז. ${customer.nationalId}`, right, y);
  if (customer.corporateName) {
    y += 38;
    ctx.fillText(`${customer.corporateName} · ח.פ. ${customer.corporateNumber ?? '—'}`, right, y);
  }

  // פירוט
  y += 90;
  ctx.strokeStyle = '#E2E2E8';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(90, y);
  ctx.lineTo(right, y);
  ctx.stroke();

  y += 56;
  ctx.fillStyle = '#0A0A0E';
  ctx.font = '700 32px Heebo, Arial, sans-serif';
  ctx.fillText('פירוט', right, y);

  y += 52;
  ctx.font = '400 26px Assistant, Arial, sans-serif';
  ctx.fillStyle = '#33333D';
  ctx.fillText(invoice.description, right, y);
  y += 38;
  ctx.fillStyle = '#5A5A66';
  ctx.fillText(`סוג רכישה: ${KIND_LABELS[invoice.kind] ?? invoice.kind}`, right, y);

  // סכום
  y += 90;
  ctx.fillStyle = '#F6F6F9';
  ctx.fillRect(90, y - 50, right - 90, 110);
  ctx.fillStyle = '#0A0A0E';
  ctx.font = '700 34px Heebo, Arial, sans-serif';
  ctx.fillText('סה״כ לתשלום (כולל מע״מ)', right, y + 12);

  ctx.textAlign = 'left';
  ctx.fillStyle = '#D8232A';
  ctx.font = '900 44px Heebo, Arial, sans-serif';
  ctx.fillText(formatMoney(invoice.amountIls), 120, y + 14);

  // כותרת תחתונה
  ctx.textAlign = 'right';
  ctx.fillStyle = '#8A8A96';
  ctx.font = '400 22px Assistant, Arial, sans-serif';
  const support = APP_CONFIG.support;
  ctx.fillText(`${support.company} · ${support.address}`, right, PAGE_H - 150);
  ctx.fillText(`טלפון ${support.phone} · ${support.shortPhone} · פקס ${support.fax}`, right, PAGE_H - 112);
  ctx.fillText(support.website, right, PAGE_H - 74);

  ctx.fillStyle = '#D8232A';
  ctx.fillRect(0, PAGE_H - 18, PAGE_W, 18);

  return canvas;
}

function latin1Bytes(text) {
  const bytes = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i++) bytes[i] = text.charCodeAt(i) & 0xff;
  return bytes;
}

function base64ToBytes(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** עוטף תמונת JPEG במסמך PDF בגודל A4. */
function buildPdf(jpegBytes, widthPx, heightPx) {
  const parts = [];
  let length = 0;
  const offsets = [];

  const push = (bytes) => {
    parts.push(bytes);
    length += bytes.length;
  };
  const pushText = (text) => push(latin1Bytes(text));

  pushText('%PDF-1.4\n');

  const startObject = () => offsets.push(length);

  startObject();
  pushText('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');

  startObject();
  pushText('2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n');

  startObject();
  pushText('3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] '
    + '/Resources << /XObject << /Im0 5 0 R >> >> /Contents 4 0 R >>\nendobj\n');

  const content = 'q 595 0 0 842 0 0 cm /Im0 Do Q\n';
  startObject();
  pushText(`4 0 obj\n<< /Length ${content.length} >>\nstream\n${content}endstream\nendobj\n`);

  startObject();
  pushText(`5 0 obj\n<< /Type /XObject /Subtype /Image /Width ${widthPx} /Height ${heightPx} `
    + `/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpegBytes.length} >>\nstream\n`);
  push(jpegBytes);
  pushText('\nendstream\nendobj\n');

  const xrefOffset = length;
  let xref = `xref\n0 ${offsets.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) xref += `${String(offset).padStart(10, '0')} 00000 n \n`;
  xref += `trailer\n<< /Size ${offsets.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  pushText(xref);

  const pdf = new Uint8Array(length);
  let cursor = 0;
  for (const part of parts) {
    pdf.set(part, cursor);
    cursor += part.length;
  }
  return new Blob([pdf], { type: 'application/pdf' });
}

/** מייצר את קובץ ה-PDF ומחזיר Blob. */
export async function createInvoicePdf(invoice, customer) {
  const canvas = await renderInvoiceCanvas(invoice, customer);
  const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
  const jpegBytes = base64ToBytes(dataUrl.split(',')[1]);
  return buildPdf(jpegBytes, canvas.width, canvas.height);
}

/** פותח את החשבונית בלשונית חדשה (ובמובייל — מוריד את הקובץ). */
export async function openInvoicePdf(invoice, customer) {
  const blob = await createInvoicePdf(invoice, customer);
  const url = URL.createObjectURL(blob);
  const opened = window.open(url, '_blank', 'noopener');

  if (!opened) {
    const link = document.createElement('a');
    link.href = url;
    link.download = `${invoice.invoiceNumber}.pdf`;
    link.click();
  }

  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
