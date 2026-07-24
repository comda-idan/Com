namespace Comsign.PersonalArea.Web.Domain;

/// <summary>סוג האמצעי הפיזי שעליו נצרבה התעודה הדיגיטלית.</summary>
public enum CredentialMedium
{
    SmartCard = 1,
    Token = 2
}

/// <summary>מצב התעודה כפי שמוצג ללקוח באזור האישי.</summary>
public enum CredentialStatus
{
    Active = 1,
    Expired = 2,
    Revoked = 3
}

/// <summary>מטרת החיוב בחשבונית.</summary>
public enum PurchaseKind
{
    NewCredential = 1,
    Renewal = 2
}

/// <summary>לקוח מזוהה באזור האישי.</summary>
public sealed record Customer(
    string CustomerId,
    string NationalId,
    string GivenName,
    string Surname,
    string PhoneNumber,
    string? CorporateName,
    string? CorporateNumber);

/// <summary>תעודה דיגיטלית על גבי כרטיס חכם או טוקן.</summary>
public sealed record Credential(
    string CredentialId,
    string CustomerId,
    CredentialMedium Medium,
    string DisplayName,
    string SerialNumber,
    string NationalId,
    string? CorporateNumber,
    DateOnly IssuedOn,
    DateOnly ExpiresOn,
    CredentialStatus Status,
    bool RenewalPaid)
{
    public int DaysToExpiry(DateOnly today) => ExpiresOn.DayNumber - today.DayNumber;

    /// <summary>תעודה נחשבת "לקראת פקיעה" בטווח של פחות מחודשיים.</summary>
    public bool IsExpiringSoon(DateOnly today) =>
        Status == CredentialStatus.Active &&
        ExpiresOn <= today.AddMonths(2) &&
        ExpiresOn >= today;
}

/// <summary>חשבונית היסטורית.</summary>
public sealed record Invoice(
    string InvoiceId,
    string CustomerId,
    string InvoiceNumber,
    DateOnly IssuedOn,
    PurchaseKind Kind,
    string Description,
    decimal AmountIls,
    string? CredentialId,
    string DocumentUrl);

/// <summary>מסלול חידוש ומחירו.</summary>
public sealed record RenewalPlan(string PlanId, int Years, decimal PriceIls, string Label);
