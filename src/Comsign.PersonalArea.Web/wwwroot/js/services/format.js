/** עזרי תצוגה: תאריכים, מטבע וטקסטים. */

export function formatDate(iso) {
  if (!iso) return '—';
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}

export function formatCurrency(amount) {
  return `₪${Number(amount).toLocaleString('he-IL')}`;
}

export function daysUntil(iso, today = new Date()) {
  const target = new Date(iso + 'T00:00:00');
  const base = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((target - base) / 86400000);
}

export function formatDaysLeft(days) {
  if (days < 0) return 'פג תוקף';
  if (days === 0) return 'פג היום';
  if (days === 1) return 'נותר יום אחד';
  if (days < 31) return `נותרו ${days} ימים`;
  const months = Math.round(days / 30);
  return `נותרו כ-${months} חודשים`;
}

export function mediumLabel(medium) {
  return medium === 'Token' ? 'טוקן' : 'כרטיס חכם';
}

export function kindLabel(kind) {
  return kind === 'Renewal' ? 'חידוש תעודה' : 'הנפקה חדשה';
}

export function nowTime() {
  return new Date().toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
}

/** כינוי תואם-אחורה לשימוש במחולל ה-PDF. */
export const formatMoney = formatCurrency;

/** מנטרל תווי HTML בטקסט שמגיע מהנתונים (הגנה מפני XSS). */
export function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

/** שעה קצרה לתצוגה בבועות הצ׳אט. */
export function formatTime(date = new Date()) {
  return date.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
}
