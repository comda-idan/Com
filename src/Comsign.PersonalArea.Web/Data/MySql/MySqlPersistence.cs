// -----------------------------------------------------------------------------
// תשתית מוכנה למעבר ל-MySQL. הקובץ אינו נכלל בקומפילציה בגרסת הדמו
// (ראו Compile Remove בקובץ הפרויקט). להפעלה ראו Data/MySql/README.md.
// -----------------------------------------------------------------------------

using Comsign.PersonalArea.Web.Abstractions;
using Comsign.PersonalArea.Web.Domain;
using Microsoft.EntityFrameworkCore;

namespace Comsign.PersonalArea.Web.Data.MySql;

public sealed class PortalDbContext(DbContextOptions<PortalDbContext> options) : DbContext(options)
{
    public DbSet<CustomerEntity> Customers => Set<CustomerEntity>();
    public DbSet<CredentialEntity> Credentials => Set<CredentialEntity>();
    public DbSet<InvoiceEntity> Invoices => Set<InvoiceEntity>();

    protected override void OnModelCreating(ModelBuilder b)
    {
        b.Entity<CustomerEntity>(e =>
        {
            e.ToTable("customers");
            e.HasKey(x => x.CustomerId);
            e.Property(x => x.CustomerId).HasMaxLength(36);
            e.Property(x => x.NationalId).HasMaxLength(9).IsRequired();
            e.HasIndex(x => x.NationalId).IsUnique();
            e.Property(x => x.PhoneNumber).HasMaxLength(20);
        });

        b.Entity<CredentialEntity>(e =>
        {
            e.ToTable("credentials");
            e.HasKey(x => x.CredentialId);
            e.Property(x => x.CredentialId).HasMaxLength(36);
            e.HasIndex(x => x.CustomerId);
            e.Property(x => x.SerialNumber).HasMaxLength(64);
            e.Property(x => x.Medium).HasConversion<int>();
            e.Property(x => x.Status).HasConversion<int>();
        });

        b.Entity<InvoiceEntity>(e =>
        {
            e.ToTable("invoices");
            e.HasKey(x => x.InvoiceId);
            e.Property(x => x.InvoiceId).HasMaxLength(36);
            e.HasIndex(x => x.CustomerId);
            e.Property(x => x.AmountIls).HasPrecision(10, 2);
            e.Property(x => x.Kind).HasConversion<int>();
        });
    }
}

public sealed class CustomerEntity
{
    public string CustomerId { get; set; } = default!;
    public string NationalId { get; set; } = default!;
    public string GivenName { get; set; } = default!;
    public string Surname { get; set; } = default!;
    public string PhoneNumber { get; set; } = default!;
    public string? CorporateName { get; set; }
    public string? CorporateNumber { get; set; }
}

public sealed class CredentialEntity
{
    public string CredentialId { get; set; } = default!;
    public string CustomerId { get; set; } = default!;
    public CredentialMedium Medium { get; set; }
    public string DisplayName { get; set; } = default!;
    public string SerialNumber { get; set; } = default!;
    public string NationalId { get; set; } = default!;
    public string? CorporateNumber { get; set; }
    public DateOnly IssuedOn { get; set; }
    public DateOnly ExpiresOn { get; set; }
    public CredentialStatus Status { get; set; }
    public bool RenewalPaid { get; set; }
}

public sealed class InvoiceEntity
{
    public string InvoiceId { get; set; } = default!;
    public string CustomerId { get; set; } = default!;
    public string InvoiceNumber { get; set; } = default!;
    public DateOnly IssuedOn { get; set; }
    public PurchaseKind Kind { get; set; }
    public string Description { get; set; } = default!;
    public decimal AmountIls { get; set; }
    public string? CredentialId { get; set; }
    public string DocumentUrl { get; set; } = default!;
}

public sealed class MySqlCustomerRepository(PortalDbContext db) : ICustomerRepository
{
    public async Task<Customer?> FindByNationalIdAsync(string nationalId, CancellationToken ct = default) =>
        Map(await db.Customers.AsNoTracking().FirstOrDefaultAsync(c => c.NationalId == nationalId, ct));

    public async Task<Customer?> GetAsync(string customerId, CancellationToken ct = default) =>
        Map(await db.Customers.AsNoTracking().FirstOrDefaultAsync(c => c.CustomerId == customerId, ct));

    private static Customer? Map(CustomerEntity? e) => e is null
        ? null
        : new Customer(e.CustomerId, e.NationalId, e.GivenName, e.Surname, e.PhoneNumber, e.CorporateName, e.CorporateNumber);
}

public sealed class MySqlCredentialRepository(PortalDbContext db) : ICredentialRepository
{
    public async Task<IReadOnlyList<Credential>> ListByCustomerAsync(string customerId, CancellationToken ct = default) =>
        (await db.Credentials.AsNoTracking()
            .Where(c => c.CustomerId == customerId)
            .OrderByDescending(c => c.ExpiresOn)
            .ToListAsync(ct))
        .Select(Map).ToList();

    public async Task<Credential?> GetAsync(string credentialId, CancellationToken ct = default)
    {
        var entity = await db.Credentials.AsNoTracking().FirstOrDefaultAsync(c => c.CredentialId == credentialId, ct);
        return entity is null ? null : Map(entity);
    }

    public async Task MarkRenewalPaidAsync(string credentialId, CancellationToken ct = default)
    {
        await db.Credentials.Where(c => c.CredentialId == credentialId)
            .ExecuteUpdateAsync(s => s.SetProperty(c => c.RenewalPaid, true), ct);
    }

    private static Credential Map(CredentialEntity e) =>
        new(e.CredentialId, e.CustomerId, e.Medium, e.DisplayName, e.SerialNumber, e.NationalId,
            e.CorporateNumber, e.IssuedOn, e.ExpiresOn, e.Status, e.RenewalPaid);
}

public sealed class MySqlInvoiceRepository(PortalDbContext db) : IInvoiceRepository
{
    public async Task<IReadOnlyList<Invoice>> ListByCustomerAsync(string customerId, CancellationToken ct = default) =>
        (await db.Invoices.AsNoTracking()
            .Where(i => i.CustomerId == customerId)
            .OrderByDescending(i => i.IssuedOn)
            .ToListAsync(ct))
        .Select(e => new Invoice(e.InvoiceId, e.CustomerId, e.InvoiceNumber, e.IssuedOn, e.Kind,
            e.Description, e.AmountIls, e.CredentialId, e.DocumentUrl))
        .ToList();

    public async Task<Invoice> AddAsync(Invoice invoice, CancellationToken ct = default)
    {
        db.Invoices.Add(new InvoiceEntity
        {
            InvoiceId = invoice.InvoiceId,
            CustomerId = invoice.CustomerId,
            InvoiceNumber = invoice.InvoiceNumber,
            IssuedOn = invoice.IssuedOn,
            Kind = invoice.Kind,
            Description = invoice.Description,
            AmountIls = invoice.AmountIls,
            CredentialId = invoice.CredentialId,
            DocumentUrl = invoice.DocumentUrl
        });
        await db.SaveChangesAsync(ct);
        return invoice;
    }
}
