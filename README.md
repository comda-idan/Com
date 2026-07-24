# קומסיין — האזור האישי (דמו)

אזור אישי ללקוחות קומסיין: הזדהות דו-שלבית, צפייה בכרטיסים החכמים ובטוקנים,
התראות פקיעת תוקף, תשלום וחידוש תעודה, חשבוניות להורדה כ-PDF, וצ׳אט תמיכה.
נבנה ב-ASP.NET Core (net10.0) עם צד לקוח בטכנולוגיות סטנדרטיות (ES Modules, ללא תלויות חיצוניות),
תמיכת PWA להתקנה בנייד, והתאמה מלאה למובייל ולדסקטופ.

> **גרסת דמו:** כל הנתונים שנשמרים נשמרים כרגע ב-Local Storage של הדפדפן.
> שכבת הנתונים מופרדת מאחורי ממשקים, כך שהמעבר ל-MySQL הוא החלפת מימוש בלבד.

---

## הפעלה מהירה

```bash
dotnet restore
dotnet run --project src/Comsign.PersonalArea.Web
```

ואז נכנסים אל `https://localhost:7181`.

### נתוני הדמו

| שדה | ערך |
|---|---|
| תעודת זהות | `111111118` (כל ת"ז ישראלית תקינה תתקבל) |
| טלפון | כל מספר נייד ישראלי תקין, לדוגמה `0501234567` |
| קוד חד-פעמי | `123456`, תקף 3 דקות |

---

## מבנה הפרויקט

```
comsign-personal-area/
├─ version.json                 ← מקור האמת לגרסה
├─ build/Version.targets        ← הגדלת מספר Build אוטומטית בכל בנייה
├─ scripts/bump-version.*       ← העלאת major/minor/patch ידנית
├─ src/Comsign.PersonalArea.Web/
│  ├─ Program.cs                ← הרכבת האפליקציה, אבטחה, בחירת ספק אחסון
│  ├─ Abstractions/             ← חוזי שכבת הנתונים (ICustomerRepository וכו')
│  ├─ Data/Demo/                ← מימוש דמו בזיכרון
│  ├─ Data/MySql/               ← תשתית EF Core מוכנה למעבר (ראו README שם)
│  ├─ Endpoints/ApiEndpoints.cs ← /api/auth, /api/portal, /api/version
│  ├─ Security/                 ← כותרות אבטחה ו-CSP
│  └─ wwwroot/
│     ├─ index.html             ← מסך הזדהות + האזור האישי
│     ├─ css/app.css
│     ├─ js/
│     │  ├─ config.js           ← נקודת ההגדרה היחידה של הלקוח
│     │  ├─ storage/index.js    ← StorageProvider: Local Storage או API
│     │  ├─ services/           ← ת"ז, פורמט, OTP וסשן, הפקת PDF
│     │  └─ ui/                 ← כרטיסים, תשלום, חשבוניות, צ׳אט, התראות
│     ├─ sw.js, manifest.webmanifest, icons/
└─ Dockerfile, .github/workflows/ci.yml
```

---

## ניהול גרסאות

- `version.json` הוא מקור האמת: `major.minor.patch.build`.
- **בכל `dotnet build` מספר ה-build עולה אוטומטית**, נכתב ל-Assembly ומועתק אל
  `wwwroot/version.json`. הגרסה מוצגת בתחתית מסך ההזדהות ובתחתית האזור האישי,
  וזמינה גם בכתובת `/api/version`.
- להעלאת גרסה משמעותית:
  ```bash
  ./scripts/bump-version.sh minor      # או major / patch
  # Windows: .\scripts\bump-version.ps1 -Part minor
  ```
- לבנייה בלי להגדיל את מספר ה-build (למשל ב-CI): `dotnet build -p:AutoIncrementBuild=false`.

---

## מעבר מ-Local Storage ל-MySQL

1. בצד השרת: לפי ההוראות ב-`src/Comsign.PersonalArea.Web/Data/MySql/README.md`
   (הוספת חבילות Pomelo, רישום ה-Repositories, שינוי `Storage:Provider` ל-`MySql`).
2. בצד הלקוח: ב-`wwwroot/js/config.js` משנים `storageProvider` מ-`'local'` ל-`'api'`.

אף רכיב UI אינו יודע מאיפה מגיעים הנתונים — הכול עובר דרך `StorageProvider`.

---

## אבטחה

בצד השרת:
- HTTPS כפוי + HSTS (כולל תת-דומיינים ו-preload) בסביבות שאינן פיתוח.
- Content-Security-Policy קשיח, `X-Content-Type-Options`, `X-Frame-Options`,
  `Referrer-Policy`, `Permissions-Policy`, `Cross-Origin-*` — ב-`Security/SecurityHeadersMiddleware.cs`.
- עוגיות סשן `HttpOnly` + `Secure` + `SameSite=Strict`, ו-Idle Timeout של 10 דקות.
- Anti-forgery מבוסס Header (`X-CSRF-TOKEN`) עם עוגיית `__Host-`.
- Rate Limiting: 10 בקשות/דקה לכתובת IP על נתיבי ההזדהות, 240 בקשות/דקה גלובלית.
- אימות ת"ז ישראלית וטלפון גם בשרת, לא רק בדפדפן.
- קוד ה-OTP מושווה בזמן קבוע, עם הגבלת ניסיונות ותוקף של 3 דקות.
- תשובה אחידה בשלב ההזדהות כדי למנוע מניית משתמשים, ומיסוך מספרי טלפון בלוגים.
- `UseForwardedHeaders` לעבודה תקינה מאחורי Reverse Proxy / WAF של האתר הראשי.
- Docker: הרצה כמשתמש לא-root.

לפני עלייה לפרודקשן:
- להעביר את יצירת ה-OTP ואימותו לשרת בלבד (המימוש כבר קיים ב-`/api/auth`),
  ולחבר ספק SMS אמיתי במקום `DemoOtpService`.
- להחליף את ה-Distributed Memory Cache ב-Redis משותף, ולהוסיף Data Protection מתמיד.
- לחבר סליקה אמיתית (PCI-DSS) — בדמו אין שידור של פרטי אשראי לשום מקום.
- לאחסן מחרוזות חיבור וסודות ב-Key Vault / משתני סביבה, לא בקבצים.
- להוסיף ניטור, תיעוד ביקורת (audit log) לכניסות ולתשלומים, וסריקות תלויות.

---

## תמיכה ב-PWA

`manifest.webmanifest` + `sw.js` מאפשרים התקנה במסך הבית בנייד ובדסקטופ.
כפתור "התקנת האפליקציה" מופיע אוטומטית בדפדפנים תומכים.
קבצי `/api` ו-`version.json` לעולם אינם נשמרים במטמון, כדי שגרסה חדשה תיכנס מיד.

---

## יצירת קשר (מוצג באתר)

קומסיין בע״מ · פארק עתידים, בניין 4, קומה 11, תל אביב 61580 · ת.ד. 58007
טלפון 03-6443620 · ‎*8770 · פקס 03-6491092
