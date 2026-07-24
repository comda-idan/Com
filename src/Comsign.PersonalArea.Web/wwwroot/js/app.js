import { APP_CONFIG } from './config.js';
import { AuthService, SessionManager } from './services/auth.js';
import { maskPhone } from './services/israeli-id.js';
import { createStorageProvider } from './storage/index.js';
import { renderCredentials } from './ui/credentials.js';
import { renderInvoices, handleInvoiceClick } from './ui/invoices.js';
import { PaymentDialog } from './ui/payment.js';
import { SupportChat } from './ui/chat.js';
import { toast } from './ui/toast.js';

/**
 * מנצח האפליקציה: הזדהות דו-שלבית, טעינת מצב, ציור הלשוניות,
 * תשלום חידוש, צ׳אט תמיכה, ניתוק אוטומטי, גרסה ו-PWA.
 */

const storage = createStorageProvider();
const auth = new AuthService();
const el = (id) => document.getElementById(id);

let state = null;
let otpInterval = null;
let deferredInstallPrompt = null;

const session = new SessionManager({
  onWarn: (secondsLeft) => showIdleWarning(secondsLeft),
  onExpire: () => logout('נותקת אוטומטית לאחר 10 דקות ללא פעילות.')
});

const payment = new PaymentDialog({
  onPaid: async ({ credential, years, amountIls, method }) => {
    try {
      const plan = { years, priceIls: amountIls, method };
      await storage.payRenewal(credential.credentialId, plan);
      state = await storage.loadState();
      renderPortal();
      toast(`התשלום התקבל. נוספה חשבונית וניתן לתאם זימון לחידוש מרחוק.`, 'ok');
    } catch (error) {
      toast(error.message ?? 'התשלום נכשל.');
    }
  }
});

const chat = new SupportChat(storage);

/* ------------------------------------------------------------------ הזדהות */

function bindLogin() {
  el('form-identify').addEventListener('submit', (event) => {
    event.preventDefault();

    const nationalId = el('nationalId').value.trim();
    const phone = el('phone').value.trim();
    const errors = auth.validateIdentity(nationalId, phone);

    el('nationalId-error').textContent = errors.nationalId ?? '';
    el('phone-error').textContent = errors.phone ?? '';
    el('nationalId').setAttribute('aria-invalid', String(Boolean(errors.nationalId)));
    el('phone').setAttribute('aria-invalid', String(Boolean(errors.phone)));
    if (errors.nationalId || errors.phone) return;

    startOtpStage(nationalId, phone);
  });

  el('btn-back-identify').addEventListener('click', () => {
    stopOtpCountdown();
    auth.clear();
    el('form-otp').classList.add('is-hidden');
    el('form-identify').classList.remove('is-hidden');
  });

  el('btn-resend').addEventListener('click', () => {
    const challenge = auth.challenge;
    startOtpStage(challenge?.nationalId ?? el('nationalId').value, challenge?.phone ?? el('phone').value);
    toast('נשלח קוד חדש. בסביבת הדמו הקוד הוא 123456.');
  });

  el('form-otp').addEventListener('submit', async (event) => {
    event.preventDefault();
    const result = auth.verify(el('otp').value);

    if (!result.ok) {
      el('otp-error').textContent = result.error;
      el('otp').setAttribute('aria-invalid', 'true');
      return;
    }

    el('otp-error').textContent = '';
    stopOtpCountdown();
    session.start(result.identity);
    await enterPortal();
  });

  el('nationalId').addEventListener('input', (event) => {
    event.target.value = event.target.value.replace(/\D/g, '').slice(0, 9);
  });
  el('phone').addEventListener('input', (event) => {
    event.target.value = event.target.value.replace(/[^\d-]/g, '').slice(0, 11);
  });
  el('otp').addEventListener('input', (event) => {
    event.target.value = event.target.value.replace(/\D/g, '').slice(0, 6);
  });
}

function startOtpStage(nationalId, phone) {
  auth.issueChallenge(nationalId, phone);

  el('form-identify').classList.add('is-hidden');
  el('form-otp').classList.remove('is-hidden');
  el('otp').value = '';
  el('otp-error').textContent = '';
  el('otp').removeAttribute('aria-invalid');
  el('otp-target').textContent = `נשלח קוד בן 6 ספרות למספר ${maskPhone(phone)}`;
  el('otp').focus();

  startOtpCountdown();
}

function startOtpCountdown() {
  stopOtpCountdown();
  el('otp-timer').classList.remove('is-expired');
  el('btn-resend').disabled = true;
  el('btn-verify').disabled = false;

  const tick = () => {
    const seconds = auth.secondsLeft();
    const mm = String(Math.floor(seconds / 60)).padStart(2, '0');
    const ss = String(seconds % 60).padStart(2, '0');
    el('otp-countdown').textContent = `${mm}:${ss}`;

    if (seconds <= 0) {
      stopOtpCountdown();
      el('otp-timer').classList.add('is-expired');
      el('otp-countdown').textContent = 'פג תוקף';
      el('btn-resend').disabled = false;
      el('btn-verify').disabled = true;
      el('otp-error').textContent = 'תוקף הקוד פג. יש לבקש קוד חדש.';
    }
  };

  tick();
  otpInterval = setInterval(tick, 1000);
}

function stopOtpCountdown() {
  clearInterval(otpInterval);
  otpInterval = null;
}

/* ------------------------------------------------------------------ האזור האישי */

async function enterPortal() {
  state = await storage.loadState();

  el('view-login').classList.add('is-hidden');
  el('view-app').classList.remove('is-hidden');

  el('who-name').textContent = `${state.customer.givenName} ${state.customer.surname}`;
  el('who-id').textContent = `ת.ז. ${state.customer.nationalId}`;

  renderPortal();
}

function renderPortal() {
  renderCredentials(state.credentials, {
    activeHost: el('active-cards'),
    inactiveHost: el('inactive-cards'),
    activeCount: el('active-count'),
    inactiveCount: el('inactive-count')
  });

  renderInvoices(state.invoices, el('invoice-list'));
}

function bindPortal() {
  // לשוניות
  for (const tab of document.querySelectorAll('.tab')) {
    tab.addEventListener('click', () => {
      for (const other of document.querySelectorAll('.tab')) {
        const active = other === tab;
        other.classList.toggle('is-active', active);
        other.setAttribute('aria-selected', String(active));
      }
      for (const panel of ['credentials', 'invoices', 'contact']) {
        el(`tab-${panel}`).classList.toggle('is-hidden', panel !== tab.dataset.tab);
      }
    });
  }

  // פעולות על כרטיסים
  el('tab-credentials').addEventListener('click', (event) => {
    const button = event.target.closest('[data-action]');
    if (!button) return;

    const credential = state.credentials.find((c) => c.credentialId === button.dataset.credential);
    if (!credential) return;

    if (button.dataset.action === 'pay') payment.open(credential);
    if (button.dataset.action === 'book') {
      window.location.assign(APP_CONFIG.renewal.bookingUrl);
    }
  });

  el('tab-invoices').addEventListener('click', (event) => handleInvoiceClick(event, state));

  el('btn-logout').addEventListener('click', () => logout('התנתקת בהצלחה.'));
  el('btn-stay').addEventListener('click', () => {
    hideIdleWarning();
    session.touch();
  });
}

function logout(message) {
  session.end();
  auth.clear();
  stopOtpCountdown();
  hideIdleWarning();
  chat.close();

  el('view-app').classList.add('is-hidden');
  el('view-login').classList.remove('is-hidden');
  el('form-otp').classList.add('is-hidden');
  el('form-identify').classList.remove('is-hidden');
  el('form-identify').reset();

  if (message) toast(message, 'ok');
}

/* ------------------------------------------------------------------ ניתוק אוטומטי */

function showIdleWarning(secondsLeft) {
  const box = el('idle-warning');
  if (secondsLeft <= 0) return hideIdleWarning();
  box.hidden = false;
  el('idle-seconds').textContent = String(secondsLeft);
}

function hideIdleWarning() {
  el('idle-warning').hidden = true;
}

/* ------------------------------------------------------------------ גרסה ו-PWA */

async function showVersion() {
  let version = '—';
  try {
    const response = await fetch('version.json', { cache: 'no-store' });
    const data = await response.json();
    version = `${data.major}.${data.minor}.${data.patch}.${data.build}`;
  } catch {
    try {
      const response = await fetch(`${APP_CONFIG.apiBaseUrl}/version`, { cache: 'no-store' });
      version = (await response.json()).version;
    } catch {
      version = 'לא זמינה';
    }
  }

  const label = `גרסה ${version}`;
  el('version-chip-login').textContent = label;
  el('version-chip-app').textContent = label;
  document.documentElement.dataset.appVersion = version;
}

function bindPwa() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      // נתיב יחסי לבסיס הנוכחי — עובד גם תחת תת-נתיב (GitHub Pages) וגם בשורש (.NET).
      const base = new URL('.', document.baseURI);
      navigator.serviceWorker.register(new URL('sw.js', base), { scope: base.pathname })
        .catch(() => { /* ללא מצב לא-מקוון */ });
    });
  }

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredInstallPrompt = event;
    el('btn-install').hidden = false;
  });

  el('btn-install').addEventListener('click', async () => {
    if (!deferredInstallPrompt) return;
    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
    el('btn-install').hidden = true;
  });
}

/* ------------------------------------------------------------------ אתחול */

async function boot() {
  bindLogin();
  bindPortal();
  bindPwa();
  await showVersion();

  const identity = session.restore();
  if (identity) await enterPortal();
}

boot();
