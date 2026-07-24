using System.Threading.RateLimiting;
using Comsign.PersonalArea.Web.Abstractions;
using Comsign.PersonalArea.Web.Data.Demo;
using Comsign.PersonalArea.Web.Endpoints;
using Comsign.PersonalArea.Web.Options;
using Comsign.PersonalArea.Web.Security;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.Extensions.Options;

var builder = WebApplication.CreateBuilder(args);

// ----------------------------------------------------------------- הגדרות
builder.Services.Configure<AuthOptions>(builder.Configuration.GetSection(AuthOptions.SectionName));
builder.Services.Configure<StorageOptions>(builder.Configuration.GetSection(StorageOptions.SectionName));
builder.Services.Configure<SecurityOptions>(builder.Configuration.GetSection(SecurityOptions.SectionName));

builder.Services.AddSingleton(TimeProvider.System);
builder.Services.AddProblemDetails();
builder.Services.AddResponseCompression(o => o.EnableForHttps = false);

// ----------------------------------------------------------------- שכבת נתונים
// החלפת ספק האחסון מתבצעת כאן בלבד. שאר המערכת עובדת מול ה-Abstractions.
var storageProvider = builder.Configuration["Storage:Provider"] ?? "LocalStorage";
switch (storageProvider)
{
    case "MySql":
        // ראו Data/MySql/README.md — יש להוסיף את חבילות ה-NuGet, להסיר את
        // ה-Compile Remove בקובץ הפרויקט ולרשום כאן את המימושים מבוססי EF Core.
        throw new InvalidOperationException(
            "ספק האחסון MySql אינו מופעל בגרסת הדמו. ראו Data/MySql/README.md להוראות הפעלה.");

    default:
        builder.Services.AddSingleton<DemoDataStore>();
        builder.Services.AddSingleton<ICustomerRepository, DemoCustomerRepository>();
        builder.Services.AddSingleton<ICredentialRepository, DemoCredentialRepository>();
        builder.Services.AddSingleton<IInvoiceRepository, DemoInvoiceRepository>();
        break;
}

builder.Services.AddSingleton<IOtpService, Comsign.PersonalArea.Web.Services.DemoOtpService>();

// ----------------------------------------------------------------- אבטחה
var idleTimeout = builder.Configuration.GetValue("Auth:IdleTimeoutMinutes", 10);

builder.Services.AddDistributedMemoryCache(); // בפרודקשן: Redis משותף לכל השרתים
builder.Services.AddSession(options =>
{
    options.Cookie.Name = ".Comsign.Session";
    options.Cookie.HttpOnly = true;
    options.Cookie.IsEssential = true;
    options.Cookie.SameSite = SameSiteMode.Strict;
    options.Cookie.SecurePolicy = CookieSecurePolicy.Always;
    options.IdleTimeout = TimeSpan.FromMinutes(idleTimeout); // ניתוק אוטומטי לאחר חוסר פעילות
});

builder.Services.AddAntiforgery(options =>
{
    options.HeaderName = "X-CSRF-TOKEN";
    options.Cookie.Name = "__Host-Comsign.Csrf";
    options.Cookie.SameSite = SameSiteMode.Strict;
    options.Cookie.SecurePolicy = CookieSecurePolicy.Always;
});

builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;

    options.AddPolicy("auth", context => RateLimitPartition.GetFixedWindowLimiter(
        partitionKey: context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
        factory: _ => new FixedWindowRateLimiterOptions
        {
            PermitLimit = 10,
            Window = TimeSpan.FromMinutes(1),
            QueueLimit = 0
        }));

    options.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(context =>
        RateLimitPartition.GetFixedWindowLimiter(
            context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 240,
                Window = TimeSpan.FromMinutes(1),
                QueueLimit = 0
            }));
});

builder.Services.Configure<ForwardedHeadersOptions>(options =>
{
    // נדרש כאשר האתר יושב מאחורי Reverse Proxy / WAF של האתר הראשי.
    options.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
    options.KnownNetworks.Clear();
    options.KnownProxies.Clear();
});

builder.Services.AddHsts(options =>
{
    options.Preload = true;
    options.IncludeSubDomains = true;
    options.MaxAge = TimeSpan.FromDays(builder.Configuration.GetValue("Security:HstsMaxAgeDays", 365));
});

var app = builder.Build();

// ----------------------------------------------------------------- Pipeline
app.UseForwardedHeaders();

if (!app.Environment.IsDevelopment())
{
    app.UseExceptionHandler("/error.html");
    if (app.Services.GetRequiredService<IOptions<SecurityOptions>>().Value.EnableHsts)
        app.UseHsts();
}

app.UseHttpsRedirection();
app.UseComsignSecurityHeaders();
app.UseResponseCompression();

app.UseDefaultFiles();
app.UseStaticFiles(new StaticFileOptions
{
    OnPrepareResponse = ctx =>
    {
        var path = ctx.File.Name;
        var headers = ctx.Context.Response.Headers;

        // Service Worker וקובץ הגרסה תמיד טריים; שאר הנכסים נשמרים במטמון.
        if (path is "sw.js" or "version.json" or "manifest.webmanifest")
            headers.CacheControl = "no-cache, no-store, must-revalidate";
        else
            headers.CacheControl = "public, max-age=604800";
    }
});

app.UseRateLimiter();
app.UseSession();

app.MapComsignApi();

app.MapFallbackToFile("index.html");

app.Run();
