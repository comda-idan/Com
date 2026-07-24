namespace Comsign.PersonalArea.Web.Options;

public sealed class AuthOptions
{
    public const string SectionName = "Auth";

    /// <summary>במצב דמו הקוד קבוע ואין שליחת SMS אמיתית.</summary>
    public bool DemoMode { get; set; } = true;

    public string DemoOtpCode { get; set; } = "123456";

    /// <summary>תוקף הקוד החד-פעמי בשניות (ברירת מחדל: 3 דקות).</summary>
    public int OtpTtlSeconds { get; set; } = 180;

    public int MaxOtpAttempts { get; set; } = 5;

    /// <summary>ניתוק אוטומטי לאחר חוסר פעילות (ברירת מחדל: 10 דקות).</summary>
    public int IdleTimeoutMinutes { get; set; } = 10;
}

public sealed class StorageOptions
{
    public const string SectionName = "Storage";

    /// <summary>"LocalStorage" בדמו, "MySql" בפרודקשן.</summary>
    public string Provider { get; set; } = "LocalStorage";

    /// <summary>מחרוזת חיבור. בפרודקשן נטענת מ-Secrets/Key Vault ולא מקובץ.</summary>
    public string? MySqlConnectionString { get; set; }
}

public sealed class SecurityOptions
{
    public const string SectionName = "Security";

    public bool EnableHsts { get; set; } = true;
    public int HstsMaxAgeDays { get; set; } = 365;
    public string[] AllowedOrigins { get; set; } = [];

    /// <summary>מקורות נוספים ל-CSP (למשל דומיין CDN של האתר הראשי).</summary>
    public string[] ExtraConnectSources { get; set; } = [];
}
