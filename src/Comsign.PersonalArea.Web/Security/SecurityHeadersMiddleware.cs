using Comsign.PersonalArea.Web.Options;
using Microsoft.Extensions.Options;

namespace Comsign.PersonalArea.Web.Security;

/// <summary>
/// כותרות אבטחה תשתיתיות לכל תגובה: CSP קשיח, מניעת clickjacking,
/// מניעת MIME sniffing, בקרת Referrer והגבלת הרשאות דפדפן.
/// </summary>
public sealed class SecurityHeadersMiddleware(RequestDelegate next, IOptions<SecurityOptions> options)
{
    private readonly SecurityOptions _options = options.Value;

    public async Task InvokeAsync(HttpContext context)
    {
        var headers = context.Response.Headers;

        var connectSources = string.Join(' ', new[] { "'self'" }.Concat(_options.ExtraConnectSources));

        headers["Content-Security-Policy"] = string.Join("; ",
            "default-src 'self'",
            "base-uri 'self'",
            "object-src 'none'",
            "frame-ancestors 'self'",
            "form-action 'self'",
            "script-src 'self'",
            "style-src 'self' https://fonts.googleapis.com",
            "font-src 'self' https://fonts.gstatic.com data:",
            "img-src 'self' data: blob:",
            $"connect-src {connectSources}",
            "worker-src 'self'",
            "manifest-src 'self'",
            "upgrade-insecure-requests");

        headers["X-Content-Type-Options"] = "nosniff";
        headers["X-Frame-Options"] = "SAMEORIGIN";
        headers["Referrer-Policy"] = "strict-origin-when-cross-origin";
        headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=(), payment=(self), usb=(), interest-cohort=()";
        headers["Cross-Origin-Opener-Policy"] = "same-origin";
        headers["Cross-Origin-Resource-Policy"] = "same-origin";
        headers["X-Permitted-Cross-Domain-Policies"] = "none";
        headers.Remove("Server");
        headers.Remove("X-Powered-By");

        await next(context);
    }
}

public static class SecurityHeadersExtensions
{
    public static IApplicationBuilder UseComsignSecurityHeaders(this IApplicationBuilder app) =>
        app.UseMiddleware<SecurityHeadersMiddleware>();
}
