import { APP_CONFIG } from '../config.js';
import { isValidIsraeliId, isValidIsraeliMobile, normalizeIsraeliId } from './israeli-id.js';

/**
 * שירות הזדהות.
 * בדמו האתגר נוצר בדפדפן והקוד קבוע. במעבר לפרודקשן יש להעביר את
 * IssueChallenge/Verify לקריאות /api/auth (המימוש בשרת כבר קיים), כך ש-
 * הקוד לעולם אינו מגיע ללקוח.
 */
export class AuthService {
  #challenge = null;

  get challenge() { return this.#challenge; }

  validateIdentity(nationalId, phone) {
    const errors = {};
    if (!isValidIsraeliId(nationalId)) errors.nationalId = 'מספר תעודת הזהות אינו תקין. יש להזין 9 ספרות כולל ספרת ביקורת.';
    if (!isValidIsraeliMobile(phone)) errors.phone = 'יש להזין מספר נייד ישראלי תקין, לדוגמה 050-1234567.';
    return errors;
  }

  /** יוצר אתגר OTP חדש ומחזיר את מועד הפקיעה. */
  issueChallenge(nationalId, phone) {
    const ttlMs = APP_CONFIG.auth.otpTtlSeconds * 1000;
    this.#challenge = {
      nationalId: normalizeIsraeliId(nationalId),
      phone,
      expiresAt: Date.now() + ttlMs,
      attempts: 0
    };
    return this.#challenge;
  }

  secondsLeft() {
    if (!this.#challenge) return 0;
    return Math.max(0, Math.ceil((this.#challenge.expiresAt - Date.now()) / 1000));
  }

  verify(code) {
    if (!this.#challenge) return { ok: false, error: 'תוקף תהליך ההזדהות פג. יש להתחיל מחדש.' };
    if (this.secondsLeft() <= 0) return { ok: false, error: 'תוקף הקוד פג. יש לבקש קוד חדש.' };

    this.#challenge.attempts += 1;
    if (this.#challenge.attempts > APP_CONFIG.auth.maxOtpAttempts) {
      this.#challenge = null;
      return { ok: false, error: 'בוצעו יותר מדי ניסיונות. יש להתחיל את ההזדהות מחדש.' };
    }

    if (String(code).trim() !== APP_CONFIG.auth.demoOtpCode) {
      return { ok: false, error: 'הקוד שהוזן שגוי.' };
    }

    const identity = { nationalId: this.#challenge.nationalId, phone: this.#challenge.phone };
    this.#challenge = null;
    return { ok: true, identity };
  }

  clear() { this.#challenge = null; }
}

/** ניהול סשן פעיל + ניתוק אוטומטי לאחר חוסר פעילות. */
export class SessionManager {
  #key = APP_CONFIG.storageKeys.session;
  #timer = null;
  #warningTimer = null;
  #countdown = null;
  #onWarn;
  #onExpire;
  #onReset;

  constructor({ onWarn, onExpire, onReset }) {
    this.#onWarn = onWarn;
    this.#onExpire = onExpire;
    this.#onReset = onReset;
    this.touch = this.touch.bind(this);
  }

  start(identity) {
    sessionStorage.setItem(this.#key, JSON.stringify({ ...identity, startedAt: Date.now() }));
    this.#attachActivityListeners();
    this.touch();
  }

  restore() {
    try {
      const raw = sessionStorage.getItem(this.#key);
      if (!raw) return null;
      const identity = JSON.parse(raw);
      this.#attachActivityListeners();
      this.touch();
      return identity;
    } catch {
      return null;
    }
  }

  end() {
    sessionStorage.removeItem(this.#key);
    this.#clearTimers();
    this.#detachActivityListeners();
  }

  /** מאפס את שעון חוסר הפעילות. */
  touch() {
    this.#clearTimers();
    this.#onReset?.();

    const idleMs = APP_CONFIG.auth.idleTimeoutMinutes * 60 * 1000;
    const warnMs = APP_CONFIG.auth.idleWarningSeconds * 1000;

    this.#warningTimer = setTimeout(() => {
      let secondsLeft = APP_CONFIG.auth.idleWarningSeconds;
      this.#onWarn?.(secondsLeft);
      this.#countdown = setInterval(() => {
        secondsLeft -= 1;
        this.#onWarn?.(secondsLeft);
        if (secondsLeft <= 0) clearInterval(this.#countdown);
      }, 1000);
    }, Math.max(0, idleMs - warnMs));

    this.#timer = setTimeout(() => this.#onExpire?.(), idleMs);
  }

  #clearTimers() {
    clearTimeout(this.#timer);
    clearTimeout(this.#warningTimer);
    clearInterval(this.#countdown);
  }

  #attachActivityListeners() {
    for (const event of ['pointerdown', 'keydown', 'wheel', 'touchstart', 'visibilitychange']) {
      window.addEventListener(event, this.touch, { passive: true });
    }
  }

  #detachActivityListeners() {
    for (const event of ['pointerdown', 'keydown', 'wheel', 'touchstart', 'visibilitychange']) {
      window.removeEventListener(event, this.touch);
    }
  }
}
