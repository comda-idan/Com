# מעבר מ-Local Storage ל-MySQL

הדמו שומר את מצב המשתמש ב-Local Storage של הדפדפן. כל הקוד שמעל שכבת הנתונים
עובד מול הממשקים ב-`Abstractions/Repositories.cs`, ולכן המעבר ל-MySQL אינו דורש
שינוי בלוגיקה או ב-UI.

## שלבי המעבר

1. הוסיפו לקובץ הפרויקט את החבילות:
   ```xml
   <PackageReference Include="Pomelo.EntityFrameworkCore.MySql" Version="10.0.0" />
   <PackageReference Include="Microsoft.EntityFrameworkCore.Design" Version="10.0.0" PrivateAssets="all" />
   ```
2. הסירו מקובץ הפרויקט את השורה `<Compile Remove="Data\MySql\**\*.cs" />`.
3. ב-`Program.cs`, בענף `case "MySql"`, רשמו את השירותים:
   ```csharp
   builder.Services.AddDbContext<PortalDbContext>(o =>
       o.UseMySql(connectionString, ServerVersion.AutoDetect(connectionString),
                  my => my.EnableRetryOnFailure()));
   builder.Services.AddScoped<ICustomerRepository, MySqlCustomerRepository>();
   builder.Services.AddScoped<ICredentialRepository, MySqlCredentialRepository>();
   builder.Services.AddScoped<IInvoiceRepository, MySqlInvoiceRepository>();
   ```
4. שנו ב-`appsettings.json`: `"Storage:Provider": "MySql"`, ואת מחרוזת החיבור
   שמרו ב-User Secrets / משתנה סביבה / Key Vault — לא בקובץ שנכנס ל-Git.
5. בצד הלקוח שנו ב-`wwwroot/js/config.js` את `storageProvider` ל-`"api"`.
   מאותו רגע ה-UI קורא ל-`/api/portal/...` במקום ל-Local Storage.

## סכימה מומלצת

```sql
CREATE DATABASE comsign_portal CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE customers (
  CustomerId       VARCHAR(36)  NOT NULL PRIMARY KEY,
  NationalId       VARCHAR(9)   NOT NULL,
  GivenName        VARCHAR(100) NOT NULL,
  Surname          VARCHAR(100) NOT NULL,
  PhoneNumber      VARCHAR(20)  NOT NULL,
  CorporateName    VARCHAR(200) NULL,
  CorporateNumber  VARCHAR(20)  NULL,
  UNIQUE KEY ux_customers_nationalid (NationalId)
) ENGINE=InnoDB;

CREATE TABLE credentials (
  CredentialId    VARCHAR(36)  NOT NULL PRIMARY KEY,
  CustomerId      VARCHAR(36)  NOT NULL,
  Medium          INT          NOT NULL,
  DisplayName     VARCHAR(200) NOT NULL,
  SerialNumber    VARCHAR(64)  NOT NULL,
  NationalId      VARCHAR(9)   NOT NULL,
  CorporateNumber VARCHAR(20)  NULL,
  IssuedOn        DATE         NOT NULL,
  ExpiresOn       DATE         NOT NULL,
  Status          INT          NOT NULL,
  RenewalPaid     TINYINT(1)   NOT NULL DEFAULT 0,
  KEY ix_credentials_customer (CustomerId),
  CONSTRAINT fk_credentials_customer FOREIGN KEY (CustomerId) REFERENCES customers (CustomerId)
) ENGINE=InnoDB;

CREATE TABLE invoices (
  InvoiceId     VARCHAR(36)   NOT NULL PRIMARY KEY,
  CustomerId    VARCHAR(36)   NOT NULL,
  InvoiceNumber VARCHAR(40)   NOT NULL,
  IssuedOn      DATE          NOT NULL,
  Kind          INT           NOT NULL,
  Description   VARCHAR(400)  NOT NULL,
  AmountIls     DECIMAL(10,2) NOT NULL,
  CredentialId  VARCHAR(36)   NULL,
  DocumentUrl   VARCHAR(400)  NOT NULL,
  KEY ix_invoices_customer (CustomerId),
  CONSTRAINT fk_invoices_customer FOREIGN KEY (CustomerId) REFERENCES customers (CustomerId)
) ENGINE=InnoDB;
```

## הנחיות אבטחה למסד הנתונים

- משתמש ייעודי לאפליקציה עם הרשאות `SELECT/INSERT/UPDATE` בלבד על הסכימה הזו.
- חיבור מוצפן בלבד (`SslMode=Required`) ורשימת IP מורשית ברמת ה-DB.
- אין להעביר קלט משתמש למחרוזות SQL — EF Core מייצר שאילתות פרמטריות.
- הצפנת נתונים במנוחה (InnoDB tablespace encryption) וגיבוי יומי מוצפן.
- מיסוך מספרי ת"ז בלוגים ובכלי ניטור.
