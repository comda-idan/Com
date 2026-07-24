namespace Comsign.PersonalArea.Web.Services;

/// <summary>
/// בדיקת תקינות של מספר תעודת זהות ישראלית לפי ספרת ביקורת (אלגוריתם לון).
/// המספר מרופד באפסים משמאל עד 9 ספרות, כמקובל.
/// </summary>
public static class IsraeliIdValidator
{
    public static bool IsValid(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return false;

        var digits = value.Trim();
        foreach (var c in digits)
        {
            if (!char.IsAsciiDigit(c)) return false;
        }

        if (digits.Length is < 5 or > 9) return false;

        digits = digits.PadLeft(9, '0');

        var sum = 0;
        for (var i = 0; i < 9; i++)
        {
            var digit = digits[i] - '0';
            var step = digit * ((i % 2) + 1);
            if (step > 9) step -= 9;
            sum += step;
        }

        return sum % 10 == 0;
    }

    public static string Normalize(string value) => value.Trim().PadLeft(9, '0');
}
