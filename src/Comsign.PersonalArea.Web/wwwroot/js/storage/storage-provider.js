/**
 * חוזה אחיד לשכבת האחסון של האזור האישי.
 * כל ה-UI עובד מול הממשק הזה בלבד, ולכן החלפת הדמו (Local Storage)
 * במימוש מבוסס API/MySQL אינה דורשת שינוי בקוד התצוגה.
 */
export class StorageProvider {
  /** @returns {Promise<object>} מצב מלא: {customer, credentials, invoices} */
  async loadState() { throw new Error('loadState not implemented'); }

  /** @param {object} state */
  async saveState(state) { throw new Error('saveState not implemented'); }

  /** מסמן שהחידוש שולם ומוסיף חשבונית מתאימה. */
  async payRenewal(credentialId, plan) { throw new Error('payRenewal not implemented'); }

  /** היסטוריית הצ׳אט עם התמיכה. */
  async getChatMessages() { throw new Error('getChatMessages not implemented'); }

  /** הוספת הודעה להיסטוריית הצ׳אט. */
  async appendChatMessage(message) { throw new Error('appendChatMessage not implemented'); }

  /** איפוס נתוני הדמו. */
  async reset() { throw new Error('reset not implemented'); }
}

/** מזהה חשבונית ומספר חשבונית חדשים. */
export function newInvoiceIdentity(date = new Date()) {
  const serial = Math.floor(100000 + Math.random() * 899999);
  return {
    invoiceId: `inv-${date.getTime().toString(36)}`,
    invoiceNumber: `${date.getFullYear()}-${serial}`
  };
}
