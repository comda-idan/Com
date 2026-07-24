import { escapeHtml, formatDate, formatMoney } from '../services/format.js';
import { openInvoicePdf } from '../services/pdf.js';
import { toast } from './toast.js';

const KIND_LABELS = {
  NewCredential: 'כרטיס/טוקן חדש',
  Renewal: 'חידוש תעודה'
};

/** מצייר את רשימת החשבוניות. */
export function renderInvoices(invoices, host) {
  if (!invoices.length) {
    host.innerHTML = '<p class="empty-state">עדיין אין חשבוניות להצגה.</p>';
    return;
  }

  host.innerHTML = invoices.map((invoice) => `
    <article class="invoice">
      <span class="invoice__kind ${invoice.kind === 'Renewal' ? 'invoice__kind--renewal' : ''}">
        ${escapeHtml(KIND_LABELS[invoice.kind] ?? invoice.kind)}
      </span>

      <div class="invoice__main">
        <p class="invoice__desc">${escapeHtml(invoice.description)}</p>
        <p class="invoice__meta">חשבונית ${escapeHtml(invoice.invoiceNumber)} · הופקה ב-${formatDate(invoice.issuedOn)}</p>
      </div>

      <span class="invoice__amount">${formatMoney(invoice.amountIls)}</span>

      <button class="btn btn--quiet" data-action="open-invoice" data-invoice="${escapeHtml(invoice.invoiceId)}">
        פתיחת PDF
      </button>
    </article>`).join('');
}

/** מטפל בלחיצה על "פתיחת PDF". */
export async function handleInvoiceClick(event, state) {
  const button = event.target.closest('[data-action="open-invoice"]');
  if (!button) return;

  const invoice = state.invoices.find((i) => i.invoiceId === button.dataset.invoice);
  if (!invoice) return;

  button.disabled = true;
  try {
    await openInvoicePdf(invoice, state.customer);
  } catch {
    toast('הפקת החשבונית נכשלה. נסו שוב או פנו לתמיכה.');
  } finally {
    button.disabled = false;
  }
}
