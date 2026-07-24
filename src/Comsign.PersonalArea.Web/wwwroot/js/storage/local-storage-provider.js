import { StorageProvider, newInvoiceIdentity } from './storage-provider.js';
import { SEED } from '../data/seed.js';
import { APP_CONFIG } from '../config.js';

/**
 * מימוש דמו: כל המצב נשמר ב-Local Storage של הדפדפן.
 * זהו המימוש הפעיל כרגע (APP_CONFIG.storageProvider === 'local').
 */
export class LocalStorageProvider extends StorageProvider {
  constructor(key) {
    super();
    this.key = key;
  }

  async loadState() {
    try {
      const raw = localStorage.getItem(this.key);
      if (raw) return JSON.parse(raw);
    } catch {
      // מצב פגום — נטען מחדש מנתוני ההזרעה
    }
    const seeded = structuredClone(SEED);
    await this.saveState(seeded);
    return seeded;
  }

  async saveState(state) {
    localStorage.setItem(this.key, JSON.stringify(state));
    return state;
  }

  async payRenewal(credentialId, plan) {
    const state = await this.loadState();
    const credential = state.credentials.find(c => c.credentialId === credentialId);
    if (!credential) throw new Error('התעודה לא נמצאה');

    credential.renewalPaid = true;
    credential.renewalPlanYears = plan.years;

    const today = new Date();
    const { invoiceId, invoiceNumber } = newInvoiceIdentity(today);
    const invoice = {
      invoiceId,
      invoiceNumber,
      issuedOn: today.toISOString().slice(0, 10),
      kind: 'Renewal',
      description: `חידוש תעודה ל-${plan.years} שנים — ${credential.displayName}`,
      amountIls: plan.priceIls,
      credentialId
    };

    state.invoices.unshift(invoice);
    await this.saveState(state);
    return { credential, invoice };
  }

  async getChatMessages() {
    try {
      return JSON.parse(localStorage.getItem(APP_CONFIG.storageKeys.chat) ?? '[]');
    } catch {
      return [];
    }
  }

  async appendChatMessage(message) {
    const messages = await this.getChatMessages();
    messages.push(message);
    localStorage.setItem(APP_CONFIG.storageKeys.chat, JSON.stringify(messages.slice(-200)));
    return message;
  }

  async reset() {
    localStorage.removeItem(APP_CONFIG.storageKeys.chat);
    localStorage.removeItem(this.key);
    return this.loadState();
  }
}
