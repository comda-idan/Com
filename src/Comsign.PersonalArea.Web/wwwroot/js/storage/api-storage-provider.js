import { StorageProvider } from './storage-provider.js';

/**
 * מימוש עתידי מול השרת (ומשם ל-MySQL).
 * להפעלה: APP_CONFIG.storageProvider = 'api'. אין צורך בשינוי ב-UI.
 */
export class ApiStorageProvider extends StorageProvider {
  constructor(baseUrl) {
    super();
    this.baseUrl = baseUrl;
  }

  async #get(path) {
    const res = await fetch(`${this.baseUrl}${path}`, {
      credentials: 'same-origin',
      headers: { Accept: 'application/json' }
    });
    if (!res.ok) throw new Error(`בקשה נכשלה (${res.status})`);
    return res.json();
  }

  async loadState() {
    const [credentials, invoices] = await Promise.all([
      this.#get('/portal/credentials'),
      this.#get('/portal/invoices')
    ]);
    return { customer: null, credentials, invoices };
  }

  async saveState() {
    // בשרת המצב נשמר לכל פעולה בנפרד; אין שמירה גורפת.
    return null;
  }

  async payRenewal(credentialId, plan) {
    const res = await fetch(`${this.baseUrl}/portal/renewals/${encodeURIComponent(credentialId)}/pay`, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ years: plan.years, method: plan.method ?? 'card' })
    });
    if (!res.ok) throw new Error('התשלום נכשל');
    return res.json();
  }

  async getChatMessages() {
    // בפרודקשן: שליפת ההתכתבות ממערכת התמיכה (‎/api/support/messages).
    return [];
  }

  async appendChatMessage(message) {
    // בפרודקשן: שליחת ההודעה למערכת התמיכה.
    return message;
  }

  async reset() {
    throw new Error('איפוס אינו נתמך מול השרת');
  }
}
