using Comsign.PersonalArea.Web.Domain;

namespace Comsign.PersonalArea.Web.Abstractions;

/// <summary>
/// שכבת הגישה לנתונים. בדמו ממומשת בזיכרון (והלקוח שומר מצב ב-Local Storage),
/// ובעתיד תמומש מול MySQL ללא שינוי בשכבות שמעליה.
/// </summary>
public interface ICustomerRepository
{
    Task<Customer?> FindByNationalIdAsync(string nationalId, CancellationToken ct = default);
    Task<Customer?> GetAsync(string customerId, CancellationToken ct = default);
}

public interface ICredentialRepository
{
    Task<IReadOnlyList<Credential>> ListByCustomerAsync(string customerId, CancellationToken ct = default);
    Task<Credential?> GetAsync(string credentialId, CancellationToken ct = default);
    Task MarkRenewalPaidAsync(string credentialId, CancellationToken ct = default);
}

public interface IInvoiceRepository
{
    Task<IReadOnlyList<Invoice>> ListByCustomerAsync(string customerId, CancellationToken ct = default);
    Task<Invoice> AddAsync(Invoice invoice, CancellationToken ct = default);
}

/// <summary>שליחת קוד חד-פעמי. בדמו הקוד קבוע; בפרודקשן יוחלף בספק SMS.</summary>
public interface IOtpService
{
    /// <summary>מנפיק אתגר OTP ומחזיר את מזהה האתגר ואת משך התוקף.</summary>
    Task<(string ChallengeId, TimeSpan Ttl)> IssueAsync(string nationalId, string phoneNumber, CancellationToken ct = default);

    /// <summary>מאמת קוד מול אתגר קיים.</summary>
    Task<bool> ValidateAsync(string challengeId, string code, CancellationToken ct = default);
}
