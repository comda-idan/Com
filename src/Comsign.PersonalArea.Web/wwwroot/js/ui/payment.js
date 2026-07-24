import { APP_CONFIG } from '../config.js';
import { formatMoney } from '../services/format.js';

/**
 * חלון התשלום עבור חידוש תעודה.
 * onPaid מקבל את פרטי התשלום; שמירת המצב מתבצעת בשכבת האחסון (Local Storage/API).
 */
export class PaymentDialog {
  #dialog = document.getElementById('modal-payment');
  #form = document.getElementById('form-payment');
  #subject = document.getElementById('payment-subject');
  #total = document.getElementById('payment-total');
  #error = document.getElementById('payment-error');
  #credential = null;
  #onPaid;

  constructor({ onPaid }) {
    this.#onPaid = onPaid;
    this.#bind();
  }

  open(credential) {
    this.#credential = credential;
    this.#error.textContent = '';
    this.#form.reset();
    this.#dialog.querySelector('input[name="plan"][value="4"]').checked = true;
    this.#subject.textContent = `${credential.displayName} · ${credential.serialNumber}`;
    this.#updateTotal();
    this.#dialog.showModal();
  }

  #selectedPlan() {
    const years = Number(this.#dialog.querySelector('input[name="plan"]:checked')?.value ?? 4);
    return APP_CONFIG.renewal.plans.find((p) => p.years === years) ?? APP_CONFIG.renewal.plans.at(-1);
  }

  #updateTotal() {
    this.#total.textContent = formatMoney(this.#selectedPlan().priceIls);
  }

  #bind() {
    for (const radio of this.#dialog.querySelectorAll('input[name="plan"]')) {
      radio.addEventListener('change', () => this.#updateTotal());
    }

    // תשלום מה-Wallet של המכשיר (בדמו: אישור מיידי)
    for (const wallet of this.#dialog.querySelectorAll('.wallet')) {
      wallet.addEventListener('click', () => this.#complete(wallet.dataset.method));
    }

    // עיצוב קלט של מספר כרטיס ותוקף
    const number = document.getElementById('cc-number');
    number.addEventListener('input', () => {
      number.value = number.value.replace(/\D/g, '').slice(0, 16).replace(/(.{4})/g, '$1 ').trim();
    });

    const exp = document.getElementById('cc-exp');
    exp.addEventListener('input', () => {
      const digits = exp.value.replace(/\D/g, '').slice(0, 4);
      exp.value = digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits;
    });

    const cvv = document.getElementById('cc-cvv');
    cvv.addEventListener('input', () => { cvv.value = cvv.value.replace(/\D/g, '').slice(0, 4); });

    this.#form.addEventListener('submit', (event) => {
      event.preventDefault();
      const validationError = this.#validateCard();
      if (validationError) {
        this.#error.textContent = validationError;
        return;
      }
      this.#complete('credit-card');
    });
  }

  #validateCard() {
    const holder = document.getElementById('cc-holder').value.trim();
    const number = document.getElementById('cc-number').value.replace(/\s/g, '');
    const exp = document.getElementById('cc-exp').value;
    const cvv = document.getElementById('cc-cvv').value;

    if (holder.length < 2) return 'יש להזין את שם בעל הכרטיס.';
    if (number.length < 15) return 'מספר הכרטיס אינו תקין.';
    if (!/^\d{2}\/\d{2}$/.test(exp)) return 'יש להזין תוקף בפורמט MM/YY.';
    if (Number(exp.slice(0, 2)) < 1 || Number(exp.slice(0, 2)) > 12) return 'חודש התוקף אינו תקין.';
    if (cvv.length < 3) return 'קוד ה-CVV אינו תקין.';
    return null;
  }

  #complete(method) {
    const plan = this.#selectedPlan();
    const credential = this.#credential;
    this.#dialog.close();
    this.#onPaid?.({ credential, years: plan.years, amountIls: plan.priceIls, method });
  }
}
