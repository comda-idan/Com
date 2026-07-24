using System.Globalization;
using Comsign.PersonalArea.Web.Abstractions;
using Comsign.PersonalArea.Web.Domain;
using Comsign.PersonalArea.Web.Options;
using Comsign.PersonalArea.Web.Services;
using Microsoft.Extensions.Options;

namespace Comsign.PersonalArea.Web.Endpoints;

public static class ApiEndpoints
{
    private const string SessionCustomerKey = "customerId";
    private const string SessionChallengeKey = "challengeId";
    private const string SessionPhoneKey = "phone";

    public static IEndpointRouteBuilder MapComsignApi(this IEndpointRouteBuilder app)
    {
        var api = app.MapGroup("/api").DisableAntiforgery();

        MapSystem(api);
        MapAuth(api);
        MapPortal(api);

        return app;
    }

    // ---------------------------------------------------------------- מערכת

    private static void MapSystem(RouteGroupBuilder api)
    {
        api.MapGet("/version", (IWebHostEnvironment env) =>
        {
            var informational = typeof(ApiEndpoints).Assembly
                .GetCustomAttributes(typeof(System.Reflection.AssemblyInformationalVersionAttribute), false)
                .Cast<System.Reflection.AssemblyInformationalVersionAttribute>()
                .FirstOrDefault()?.InformationalVersion ?? "0.0.0.0";

            return Results.Ok(new
            {
                version = informational.Split('+')[0],
                environment = env.EnvironmentName,
                utc = DateTimeOffset.UtcNow
            });
        }).WithName("GetVersion");

        api.MapGet("/health", () => Results.Ok(new { status = "healthy" })).WithName("Health");
    }

    // ---------------------------------------------------------------- הזדהות

    private static void MapAuth(RouteGroupBuilder api)
    {
        var auth = api.MapGroup("/auth").RequireRateLimiting("auth");

        auth.MapPost("/start", async (
            StartLoginRequest request,
            HttpContext http,
            ICustomerRepository customers,
            IOtpService otp,
            IOptions<AuthOptions> authOptions,
            CancellationToken ct) =>
        {
            if (!IsraeliIdValidator.IsValid(request.NationalId))
                return Results.BadRequest(new ApiError("invalid_national_id", "מספר תעודת הזהות אינו תקין."));

            if (!IsValidIsraeliPhone(request.PhoneNumber))
                return Results.BadRequest(new ApiError("invalid_phone", "מספר הטלפון אינו תקין."));

            var nationalId = IsraeliIdValidator.Normalize(request.NationalId);
            var customer = await customers.FindByNationalIdAsync(nationalId, ct);

            // תשובה אחידה גם כאשר הלקוח אינו קיים, כדי למנוע מניית משתמשים.
            var (challengeId, ttl) = await otp.IssueAsync(nationalId, request.PhoneNumber, ct);

            http.Session.SetString(SessionChallengeKey, challengeId);
            http.Session.SetString(SessionPhoneKey, request.PhoneNumber);
            if (customer is not null)
                http.Session.SetString("pendingCustomerId", customer.CustomerId);

            return Results.Ok(new
            {
                challengeId,
                ttlSeconds = (int)ttl.TotalSeconds,
                demoMode = authOptions.Value.DemoMode,
                maskedPhone = MaskPhone(request.PhoneNumber)
            });
        }).WithName("StartLogin");

        auth.MapPost("/verify", async (
            VerifyOtpRequest request,
            HttpContext http,
            IOtpService otp,
            ICustomerRepository customers,
            CancellationToken ct) =>
        {
            var challengeId = http.Session.GetString(SessionChallengeKey);
            if (string.IsNullOrEmpty(challengeId))
                return Results.BadRequest(new ApiError("no_challenge", "תוקף תהליך ההזדהות פג. יש להתחיל מחדש."));

            if (!await otp.ValidateAsync(challengeId, request.Code, ct))
                return Results.BadRequest(new ApiError("invalid_code", "הקוד שהוזן שגוי או שפג תוקפו."));

            var customerId = http.Session.GetString("pendingCustomerId");
            if (customerId is null)
                return Results.BadRequest(new ApiError("no_customer", "לא נמצאו תעודות המשויכות לפרטים שהוזנו."));

            // מחזור מזהה ה-Session לאחר הזדהות מוצלחת (מניעת Session Fixation).
            http.Session.Remove(SessionChallengeKey);
            http.Session.Remove("pendingCustomerId");
            http.Session.SetString(SessionCustomerKey, customerId);

            var customer = await customers.GetAsync(customerId, ct);
            return Results.Ok(new { customer });
        }).WithName("VerifyOtp");

        auth.MapPost("/logout", (HttpContext http) =>
        {
            http.Session.Clear();
            http.Response.Cookies.Delete(".Comsign.Session");
            return Results.Ok(new { loggedOut = true });
        }).WithName("Logout");

        auth.MapGet("/session", (HttpContext http, IOptions<AuthOptions> options) =>
        {
            var customerId = http.Session.GetString(SessionCustomerKey);
            return Results.Ok(new
            {
                authenticated = customerId is not null,
                idleTimeoutMinutes = options.Value.IdleTimeoutMinutes
            });
        }).WithName("GetSession");
    }

    // ---------------------------------------------------------------- אזור אישי

    private static void MapPortal(RouteGroupBuilder api)
    {
        var portal = api.MapGroup("/portal").AddEndpointFilter(RequireSession);

        portal.MapGet("/credentials", async (HttpContext http, ICredentialRepository credentials, CancellationToken ct) =>
        {
            var customerId = http.Session.GetString(SessionCustomerKey)!;
            var items = await credentials.ListByCustomerAsync(customerId, ct);
            var today = DateOnly.FromDateTime(DateTime.UtcNow);

            return Results.Ok(items.Select(c => new
            {
                c.CredentialId,
                medium = c.Medium.ToString(),
                c.DisplayName,
                c.SerialNumber,
                c.NationalId,
                c.CorporateNumber,
                issuedOn = c.IssuedOn.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
                expiresOn = c.ExpiresOn.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
                status = c.Status.ToString(),
                c.RenewalPaid,
                expiringSoon = c.IsExpiringSoon(today),
                daysToExpiry = c.DaysToExpiry(today)
            }));
        });

        portal.MapGet("/invoices", async (HttpContext http, IInvoiceRepository invoices, CancellationToken ct) =>
        {
            var customerId = http.Session.GetString(SessionCustomerKey)!;
            var items = await invoices.ListByCustomerAsync(customerId, ct);
            return Results.Ok(items);
        });

        portal.MapPost("/renewals/{credentialId}/pay", async (
            string credentialId,
            PayRenewalRequest request,
            HttpContext http,
            ICredentialRepository credentials,
            IInvoiceRepository invoices,
            CancellationToken ct) =>
        {
            var customerId = http.Session.GetString(SessionCustomerKey)!;
            var credential = await credentials.GetAsync(credentialId, ct);
            if (credential is null || credential.CustomerId != customerId)
                return Results.NotFound(new ApiError("not_found", "התעודה לא נמצאה."));

            var plan = RenewalPlans.FirstOrDefault(p => p.Years == request.Years);
            if (plan is null)
                return Results.BadRequest(new ApiError("invalid_plan", "יש לבחור מסלול חידוש תקין."));

            await credentials.MarkRenewalPaidAsync(credentialId, ct);

            var invoice = new Invoice(
                InvoiceId: $"inv-{Guid.NewGuid():N}"[..12],
                CustomerId: customerId,
                InvoiceNumber: $"{DateTime.UtcNow:yyyy}-{Random.Shared.Next(100000, 999999)}",
                IssuedOn: DateOnly.FromDateTime(DateTime.UtcNow),
                Kind: PurchaseKind.Renewal,
                Description: $"חידוש תעודה ל-{plan.Years} שנים ({credential.DisplayName})",
                AmountIls: plan.PriceIls,
                CredentialId: credentialId,
                DocumentUrl: string.Empty);

            invoice = invoice with { DocumentUrl = $"/api/invoices/{invoice.InvoiceId}/document" };
            await invoices.AddAsync(invoice, ct);
            return Results.Ok(new { paid = true, invoice });
        });

        portal.MapGet("/renewal-plans", () => Results.Ok(RenewalPlans));

        api.MapGet("/invoices/{invoiceId}/document", async (
            string invoiceId,
            HttpContext http,
            IInvoiceRepository invoices,
            CancellationToken ct) =>
        {
            var customerId = http.Session.GetString(SessionCustomerKey);
            if (customerId is null) return Results.Unauthorized();

            var invoice = (await invoices.ListByCustomerAsync(customerId, ct))
                .FirstOrDefault(i => i.InvoiceId == invoiceId);
            if (invoice is null) return Results.NotFound();

            var pdf = SimplePdfWriter.CreateTextDocument("ComSign Ltd. - Tax Invoice", new[]
            {
                $"Invoice number: {invoice.InvoiceNumber}",
                $"Date: {invoice.IssuedOn:dd/MM/yyyy}",
                $"Amount: {invoice.AmountIls:0.00} ILS (incl. VAT)",
                "ComSign Ltd., Atidim Park, Building 4, Floor 11, Tel Aviv",
                "Phone: 03-6443620  |  www.comsign.co.il"
            });

            return Results.File(pdf, "application/pdf", $"{invoice.InvoiceNumber}.pdf");
        });
    }

    public static readonly RenewalPlan[] RenewalPlans =
    [
        new("plan-2y", 2, 800m, "תעודה ל-2 שנים"),
        new("plan-4y", 4, 1200m, "תעודה ל-4 שנים")
    ];

    private static async ValueTask<object?> RequireSession(EndpointFilterInvocationContext context, EndpointFilterDelegate next)
    {
        var customerId = context.HttpContext.Session.GetString(SessionCustomerKey);
        if (string.IsNullOrEmpty(customerId))
            return Results.Json(new ApiError("unauthenticated", "יש להזדהות מחדש."), statusCode: StatusCodes.Status401Unauthorized);

        return await next(context);
    }

    private static bool IsValidIsraeliPhone(string? phone)
    {
        if (string.IsNullOrWhiteSpace(phone)) return false;
        var digits = new string(phone.Where(char.IsAsciiDigit).ToArray());
        return digits.Length == 10 && digits.StartsWith("05", StringComparison.Ordinal);
    }

    private static string MaskPhone(string phone)
    {
        var digits = new string(phone.Where(char.IsAsciiDigit).ToArray());
        return digits.Length < 4 ? "****" : $"{digits[..3]}-***{digits[^2..]}";
    }

    public sealed record StartLoginRequest(string NationalId, string PhoneNumber);
    public sealed record VerifyOtpRequest(string Code);
    public sealed record PayRenewalRequest(int Years, string Method);
    public sealed record ApiError(string Code, string Message);
}
