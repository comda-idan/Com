/**
 * אימות מספר תעודת זהות ישראלית לפי ספרת ביקורת (אלגוריתם לון).
 * המספר מרופד באפסים משמאל ל-9 ספרות.
 */
export function isValidIsraeliId(value) {
  if (!value) return false;
  const digits = String(value).trim();
  if (!/^\d{5,9}$/.test(digits)) return false;

  const padded = digits.padStart(9, '0');
  let sum = 0;

  for (let i = 0; i < 9; i++) {
    let step = Number(padded[i]) * ((i % 2) + 1);
    if (step > 9) step -= 9;
    sum += step;
  }

  return sum % 10 === 0;
}

export function normalizeIsraeliId(value) {
  return String(value).trim().padStart(9, '0');
}

/** אימות מספר טלפון נייד ישראלי. */
export function isValidIsraeliMobile(value) {
  const digits = String(value || '').replace(/\D/g, '');
  return /^05\d{8}$/.test(digits);
}

export function maskPhone(value) {
  const digits = String(value || '').replace(/\D/g, '');
  if (digits.length < 4) return '****';
  return `${digits.slice(0, 3)}-***${digits.slice(-2)}`;
}
