using System.Collections.Concurrent;
using Comsign.PersonalArea.Web.Abstractions;
using Comsign.PersonalArea.Web.Domain;

namespace Comsign.PersonalArea.Web.Data.Demo;

/// <summary>
/// מאגר דמו בזיכרון. מחזיק את אותם נתוני הזרעה שהלקוח שומר ב-Local Storage,
/// כדי שהמעבר ל-MySQL בעתיד יהיה החלפת מימוש בלבד (ראו Data/MySql).
/// </summary>
public sealed class DemoDataStore
{
    private static readonly DateOnly Today = DateOnly.FromDateTime(DateTime.UtcNow);

    public Customer Customer { get; } = new(
        CustomerId: "cust-0001",
        NationalId: "111111118",
        GivenName: "ישראל",
        Surname: "ישראלי",
        PhoneNumber: "0501234567",
        CorporateName: "קומסיין בע\"מ",
        CorporateNumber: "123456789");

    public ConcurrentDictionary<string, Credential> Credentials { get; } = new(
        new[]
        {
            MakeCredential("cred-sc-01", CredentialMedium.SmartCard, "כרטיס חכם – חתימה מאושרת",
                "SC-8842-1190-4471", "123456789", new DateOnly(2022, 8, 20), CredentialStatus.Active),
            MakeCredential("cred-tk-01", CredentialMedium.Token, "טוקן – חתימה מאושרת",
                "TK-5521-8830-1027", null, new DateOnly(2024, 6, 20), CredentialStatus.Active),
            MakeCredential("cred-sc-00", CredentialMedium.SmartCard, "כרטיס חכם (דור קודם)",
                "SC-4410-2231-8890", "123456789", new DateOnly(2018, 8, 20), CredentialStatus.Expired),
            MakeCredential("cred-tk-00", CredentialMedium.Token, "טוקן (דור קודם)",
                "TK-9903-1122-4456", null, new DateOnly(2020, 6, 20), CredentialStatus.Expired)
        }.ToDictionary(c => c.CredentialId));

    public ConcurrentBag<Invoice> Invoices { get; } = new(new Invoice[]
    {
        new("inv-0003", "cust-0001", "2024-004431", new DateOnly(2024, 6, 20), PurchaseKind.NewCredential,
            "הנפקת טוקן חתימה מאושרת ל-4 שנים", 1200m, "cred-tk-01", "/api/invoices/inv-0003/document"),
        new("inv-0002", "cust-0001", "2022-002218", new DateOnly(2022, 8, 20), PurchaseKind.Renewal,
            "חידוש תעודה על גבי כרטיס חכם ל-4 שנים", 1200m, "cred-sc-01", "/api/invoices/inv-0002/document"),
        new("inv-0001", "cust-0001", "2018-000917", new DateOnly(2018, 8, 20), PurchaseKind.NewCredential,
            "הנפקת כרטיס חכם וקורא כרטיסים", 980m, "cred-sc-00", "/api/invoices/inv-0001/document")
    });

    private static Credential MakeCredential(string id, CredentialMedium medium, string name, string serial,
        string? corporateNumber, DateOnly issued, CredentialStatus status) =>
        new(id, "cust-0001", medium, name, serial, "111111118", corporateNumber,
            issued, issued.AddYears(4), status, RenewalPaid: false);
}

public sealed class DemoCustomerRepository(DemoDataStore store) : ICustomerRepository
{
    /// <summary>
    /// בדמו כל ת"ז תקינה מחוברת ללקוח הדוגמה. במימוש האמיתי יש להחזיר null
    /// כאשר הלקוח אינו קיים, ולהחזיר תשובה גנרית למשתמש כדי למנוע מניית משתמשים.
    /// </summary>
    public Task<Customer?> FindByNationalIdAsync(string nationalId, CancellationToken ct = default) =>
        Task.FromResult<Customer?>(store.Customer);

    public Task<Customer?> GetAsync(string customerId, CancellationToken ct = default) =>
        Task.FromResult<Customer?>(store.Customer.CustomerId == customerId ? store.Customer : null);
}

public sealed class DemoCredentialRepository(DemoDataStore store) : ICredentialRepository
{
    public Task<IReadOnlyList<Credential>> ListByCustomerAsync(string customerId, CancellationToken ct = default) =>
        Task.FromResult<IReadOnlyList<Credential>>(
            store.Credentials.Values
                .Where(c => c.CustomerId == customerId)
                .OrderByDescending(c => c.ExpiresOn)
                .ToList());

    public Task<Credential?> GetAsync(string credentialId, CancellationToken ct = default) =>
        Task.FromResult(store.Credentials.TryGetValue(credentialId, out var c) ? c : null);

    public Task MarkRenewalPaidAsync(string credentialId, CancellationToken ct = default)
    {
        if (store.Credentials.TryGetValue(credentialId, out var c))
            store.Credentials[credentialId] = c with { RenewalPaid = true };
        return Task.CompletedTask;
    }
}

public sealed class DemoInvoiceRepository(DemoDataStore store) : IInvoiceRepository
{
    public Task<IReadOnlyList<Invoice>> ListByCustomerAsync(string customerId, CancellationToken ct = default) =>
        Task.FromResult<IReadOnlyList<Invoice>>(
            store.Invoices.Where(i => i.CustomerId == customerId)
                .OrderByDescending(i => i.IssuedOn)
                .ToList());

    public Task<Invoice> AddAsync(Invoice invoice, CancellationToken ct = default)
    {
        store.Invoices.Add(invoice);
        return Task.FromResult(invoice);
    }
}
