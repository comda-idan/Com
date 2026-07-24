/**
 * נתוני הזרעה לדמו.
 * במעבר ל-MySQL הנתונים יגיעו מ-/api/portal ולא מכאן — המבנה זהה.
 */
export const SEED = Object.freeze({
  customer: {
    customerId: 'cust-0001',
    nationalId: '111111118',
    givenName: 'ישראל',
    surname: 'ישראלי',
    phoneNumber: '',
    corporateName: 'קומסיין בע״מ',
    corporateNumber: '123456789'
  },

  credentials: [
    {
      credentialId: 'cred-sc-01',
      medium: 'SmartCard',
      displayName: 'כרטיס חכם — תעודה מאושרת',
      serialNumber: 'SC-8842-1190-4471',
      nationalId: '111111118',
      corporateNumber: '123456789',
      issuedOn: '2022-08-20',
      expiresOn: '2026-08-20',
      status: 'Active',
      renewalPaid: false,
      image: '/assets/smartcard.png'
    },
    {
      credentialId: 'cred-tk-01',
      medium: 'Token',
      displayName: 'טוקן — תעודה מאושרת',
      serialNumber: 'TK-5521-8830-1027',
      nationalId: '111111118',
      corporateNumber: null,
      issuedOn: '2024-06-20',
      expiresOn: '2028-06-20',
      status: 'Active',
      renewalPaid: false,
      image: '/assets/token.png'
    },
    {
      credentialId: 'cred-sc-00',
      medium: 'SmartCard',
      displayName: 'כרטיס חכם (דור קודם)',
      serialNumber: 'SC-4410-2231-8890',
      nationalId: '111111118',
      corporateNumber: '123456789',
      issuedOn: '2018-08-20',
      expiresOn: '2022-08-20',
      status: 'Expired',
      renewalPaid: false,
      image: '/assets/smartcard.png'
    },
    {
      credentialId: 'cred-tk-00',
      medium: 'Token',
      displayName: 'טוקן (דור קודם)',
      serialNumber: 'TK-9903-1122-4456',
      nationalId: '111111118',
      corporateNumber: null,
      issuedOn: '2020-06-20',
      expiresOn: '2024-06-20',
      status: 'Expired',
      renewalPaid: false,
      image: '/assets/token.png'
    }
  ],

  invoices: [
    {
      invoiceId: 'inv-0003',
      invoiceNumber: '2024-004431',
      issuedOn: '2024-06-20',
      kind: 'NewCredential',
      description: 'הנפקת טוקן חתימה מאושרת ל-4 שנים',
      amountIls: 1200,
      credentialId: 'cred-tk-01'
    },
    {
      invoiceId: 'inv-0002',
      invoiceNumber: '2022-002218',
      issuedOn: '2022-08-20',
      kind: 'Renewal',
      description: 'חידוש תעודה על גבי כרטיס חכם ל-4 שנים',
      amountIls: 1200,
      credentialId: 'cred-sc-01'
    },
    {
      invoiceId: 'inv-0001',
      invoiceNumber: '2018-000917',
      issuedOn: '2018-08-20',
      kind: 'NewCredential',
      description: 'הנפקת כרטיס חכם וקורא כרטיסים',
      amountIls: 980,
      credentialId: 'cred-sc-00'
    }
  ]
});
