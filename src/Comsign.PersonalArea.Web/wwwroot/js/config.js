/**
 * הגדרות צד-לקוח.
 * זהו המקום היחיד שצריך לשנות כאשר עוברים מדמו (Local Storage) לעבודה מול ה-API/MySQL.
 */
export const APP_CONFIG = Object.freeze({
  /** "local" = Local Storage (דמו) | "api" = קריאות ל-/api/portal (עתידי, מגובה MySQL) */
  storageProvider: 'local',

  apiBaseUrl: '/api',

  auth: {
    /** בדמו הקוד קבוע. במעבר לפרודקשן יש להעביר את האימות לשרת בלבד. */
    demoMode: true,
    demoOtpCode: '123456',
    otpTtlSeconds: 180,
    maxOtpAttempts: 5,
    idleTimeoutMinutes: 10,
    idleWarningSeconds: 60
  },

  renewal: {
    /** התראה על פקיעת תוקף מתחילה כאשר נותרו פחות מכך ימים (חודשיים). */
    warningDays: 60,
    plans: [
      { years: 2, priceIls: 800 },
      { years: 4, priceIls: 1200 }
    ],
    /** יעד ה-Redirect לתיאום זימון מרחוק. יש להחליף בכתובת הסופית. */
    bookingUrl: 'https://www.comsign.co.il/'
  },

  support: {
    company: 'קומסיין בע״מ',
    address: 'פארק עתידים, בניין 4, קומה 11, תל אביב 61580, ת.ד. 58007',
    phone: '03-6443620',
    shortPhone: '*8770',
    fax: '03-6491092',
    website: 'www.comsign.co.il'
  },

  storageKeys: {
    state: 'comsign.portal.state.v1',
    session: 'comsign.portal.session.v1',
    chat: 'comsign.portal.chat.v1'
  }
});
