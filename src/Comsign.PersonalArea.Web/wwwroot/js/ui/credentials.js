import { APP_CONFIG } from '../config.js';
import { daysUntil, formatDate, escapeHtml } from '../services/format.js';

const MEDIUM_LABELS = { SmartCard: 'כרטיס חכם', Token: 'טוקן' };

/** האם התעודה בתוקף היום. */
export function isActive(credential) {
  return credential.status === 'Active' && daysUntil(credential.expiresOn) >= 0;
}

/** האם נותרו פחות מחודשיים לפקיעת התוקף. */
export function isExpiringSoon(credential) {
  const days = daysUntil(credential.expiresOn);
  return isActive(credential) && days >= 0 && days <= APP_CONFIG.renewal.warningDays;
}

function detailRow(term, value, className = '') {
  return `
    <div class="detail-row">
      <dt>${escapeHtml(term)}</dt>
      <dd class="${className}">${escapeHtml(value)}</dd>
    </div>`;
}

function activeCardMarkup(credential) {
  const days = daysUntil(credential.expiresOn);
  const soon = isExpiringSoon(credential);
  const paid = Boolean(credential.renewalPaid);

  const details = [
    detailRow('מספר ת.ז.', credential.nationalId),
    credential.corporateNumber ? detailRow('מספר ח״פ', credential.corporateNumber) : '',
    detailRow('תאריך הנפקה', formatDate(credential.issuedOn)),
    detailRow('תאריך פקיעת תוקף', formatDate(credential.expiresOn), soon ? 'is-warning' : '')
  ].join('');

  const renewalBlock = soon ? `
    <div class="note note--warn">
      התעודה תפוג בעוד ${days} ימים (${formatDate(credential.expiresOn)}). נדרש חידוש בהקדם כדי למנוע הפסקת שירות.
    </div>

    <div class="note ${paid ? 'note--info' : 'note--pay'}">
      ${paid
        ? 'התשלום התקבל. ניתן לתאם זימון לחידוש מול נציג מרחוק.'
        : 'חידוש התעודה כרוך בתשלום. לאחר התשלום ייפתח תיאום זימון לחידוש מרחוק.'}
    </div>

    <div class="credential__actions">
      ${paid
        ? '<p class="paid-mark">התשלום עבור החידוש בוצע</p>'
        : `<button class="btn btn--primary" data-action="pay" data-credential="${escapeHtml(credential.credentialId)}">ביצוע תשלום עבור חידוש</button>`}
      <button class="btn btn--ghost" data-action="book" data-credential="${escapeHtml(credential.credentialId)}" ${paid ? '' : 'disabled'}>
        תיאום זימון לחידוש מרחוק
      </button>
      ${paid ? '' : '<p class="fine">תיאום הזימון ייפתח לאחר השלמת התשלום.</p>'}
    </div>` : '';

  return `
    <article class="credential ${credential.medium === 'Token' ? 'credential--token' : ''}" data-credential="${escapeHtml(credential.credentialId)}">
      <span class="credential__badge credential__badge--active">בתוקף</span>
      <div class="credential__glow" aria-hidden="true"></div>

      <div class="credential__stage">
        <div class="credential__art">
          <img src="${escapeHtml(credential.image)}" alt="${escapeHtml(MEDIUM_LABELS[credential.medium] ?? '')}" loading="lazy" />
        </div>
      </div>

      <h3 class="credential__title">${escapeHtml(credential.displayName)}</h3>
      <p class="credential__serial">${escapeHtml(credential.serialNumber)}</p>

      <dl class="detail-list">${details}</dl>
      ${renewalBlock}
    </article>`;
}

function inactiveCardMarkup(credential) {
  const details = [
    detailRow('מספר ת.ז.', credential.nationalId),
    credential.corporateNumber ? detailRow('מספר ח״פ', credential.corporateNumber) : '',
    detailRow('תאריך הנפקה', formatDate(credential.issuedOn)),
    detailRow('פג תוקף בתאריך', formatDate(credential.expiresOn), 'is-expired')
  ].join('');

  return `
    <article class="credential ${credential.medium === 'Token' ? 'credential--token' : ''}">
      <span class="credential__badge credential__badge--expired">פג תוקף</span>

      <div class="credential__stage">
        <div class="credential__art">
          <img src="${escapeHtml(credential.image)}" alt="${escapeHtml(MEDIUM_LABELS[credential.medium] ?? '')}" loading="lazy" />
        </div>
      </div>

      <h3 class="credential__title">${escapeHtml(credential.displayName)}</h3>
      <p class="credential__serial">${escapeHtml(credential.serialNumber)}</p>

      <dl class="detail-list">${details}</dl>
    </article>`;
}

/** מצייר את שתי הקטגוריות ומחזיר את החלוקה. */
export function renderCredentials(credentials, { activeHost, inactiveHost, activeCount, inactiveCount }) {
  const active = credentials.filter(isActive);
  const inactive = credentials.filter((c) => !isActive(c));

  activeHost.innerHTML = active.length
    ? active.map(activeCardMarkup).join('')
    : '<p class="empty-state">אין כרטיסים או טוקנים בתוקף. לרכישת תעודה חדשה ניתן לפנות לתמיכה.</p>';

  inactiveHost.innerHTML = inactive.length
    ? inactive.map(inactiveCardMarkup).join('')
    : '<p class="empty-state">אין כרטיסים שפג תוקפם.</p>';

  activeCount.textContent = `${active.length} תעודות בתוקף`;
  inactiveCount.textContent = `${inactive.length} תעודות שפג תוקפן`;

  attachTilt(activeHost);
  return { active, inactive };
}

/** הטיה עדינה של הכרטיס בעקבות הסמן — מבוטלת כאשר המשתמש ביקש פחות תנועה. */
function attachTilt(host) {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (!window.matchMedia('(hover: hover)').matches) return;

  for (const stage of host.querySelectorAll('.credential__stage')) {
    const art = stage.querySelector('.credential__art');
    if (!art) continue;

    stage.addEventListener('pointermove', (event) => {
      const rect = stage.getBoundingClientRect();
      const x = (event.clientX - rect.left) / rect.width - 0.5;
      const y = (event.clientY - rect.top) / rect.height - 0.5;
      art.style.animation = 'none';
      art.style.transform = `rotateY(${x * 16}deg) rotateX(${-y * 14}deg) translateY(-6px) scale(1.03)`;
    });

    stage.addEventListener('pointerleave', () => {
      art.style.transform = '';
      art.style.animation = '';
    });
  }
}
