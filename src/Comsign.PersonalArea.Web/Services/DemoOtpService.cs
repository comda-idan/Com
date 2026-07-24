using System.Collections.Concurrent;
using System.Security.Cryptography;
using Comsign.PersonalArea.Web.Abstractions;
using Comsign.PersonalArea.Web.Options;
using Microsoft.Extensions.Options;

namespace Comsign.PersonalArea.Web.Services;

/// <summary>
/// מימוש דמו של שליחת קוד חד-פעמי: הקוד קבוע (123456) ותקף לשלוש דקות.
/// בפרודקשן יש להחליף במימוש מול ספק SMS, ולשמור את האתגרים ב-Redis/MySQL
/// כדי לתמוך בריבוי שרתים. ההשוואה מתבצעת בזמן קבוע כדי למנוע דליפת מידע.
/// </summary>
public sealed class DemoOtpService : IOtpService
{
    private readonly record struct Challenge(string Code, string PhoneNumber, DateTimeOffset ExpiresAt, int Attempts);

    private readonly ConcurrentDictionary<string, Challenge> _challenges = new();
    private readonly AuthOptions _options;
    private readonly ILogger<DemoOtpService> _logger;
    private readonly TimeProvider _clock;

    public DemoOtpService(IOptions<AuthOptions> options, ILogger<DemoOtpService> logger, TimeProvider clock)
    {
        _options = options.Value;
        _logger = logger;
        _clock = clock;
    }

    public Task<(string ChallengeId, TimeSpan Ttl)> IssueAsync(string nationalId, string phoneNumber, CancellationToken ct = default)
    {
        Cleanup();

        var challengeId = Convert.ToHexString(RandomNumberGenerator.GetBytes(16));
        var ttl = TimeSpan.FromSeconds(_options.OtpTtlSeconds);
        var code = _options.DemoMode ? _options.DemoOtpCode : RandomNumberGenerator.GetInt32(100000, 999999).ToString();

        _challenges[challengeId] = new Challenge(code, phoneNumber, _clock.GetUtcNow().Add(ttl), 0);

        // לעולם לא מתעדים את הקוד עצמו בלוג בסביבת פרודקשן.
        _logger.LogInformation("OTP challenge issued {ChallengeId} for phone ending {Tail}",
            challengeId, phoneNumber.Length >= 4 ? phoneNumber[^4..] : "****");

        return Task.FromResult((challengeId, ttl));
    }

    public Task<bool> ValidateAsync(string challengeId, string code, CancellationToken ct = default)
    {
        Cleanup();

        if (!_challenges.TryGetValue(challengeId, out var challenge))
            return Task.FromResult(false);

        if (challenge.ExpiresAt <= _clock.GetUtcNow())
        {
            _challenges.TryRemove(challengeId, out _);
            return Task.FromResult(false);
        }

        if (challenge.Attempts >= _options.MaxOtpAttempts)
        {
            _challenges.TryRemove(challengeId, out _);
            return Task.FromResult(false);
        }

        var ok = CryptographicOperations.FixedTimeEquals(
            System.Text.Encoding.UTF8.GetBytes(challenge.Code),
            System.Text.Encoding.UTF8.GetBytes(code ?? string.Empty));

        if (ok)
        {
            _challenges.TryRemove(challengeId, out _);
        }
        else
        {
            _challenges[challengeId] = challenge with { Attempts = challenge.Attempts + 1 };
        }

        return Task.FromResult(ok);
    }

    private void Cleanup()
    {
        var now = _clock.GetUtcNow();
        foreach (var pair in _challenges)
        {
            if (pair.Value.ExpiresAt <= now)
                _challenges.TryRemove(pair.Key, out _);
        }
    }
}
