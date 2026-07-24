using System.Globalization;
using System.Text;

namespace Comsign.PersonalArea.Web.Services;

/// <summary>
/// כותב PDF מינימלי ללא תלויות חיצוניות, המשמש כמסמך חלופי (placeholder)
/// לחשבוניות בצד השרת. בדמו החשבונית מיוצרת בצד הלקוח ותומכת בעברית מלאה.
/// במעבר לפרודקשן יוחלף בשליפת ה-PDF החתום ממערכת החיוב.
/// </summary>
public static class SimplePdfWriter
{
    public static byte[] CreateTextDocument(string title, IEnumerable<string> lines)
    {
        var content = new StringBuilder();
        content.Append("BT\n/F1 18 Tf\n60 780 Td\n(").Append(Escape(title)).Append(") Tj\nET\n");

        var y = 740;
        content.Append("BT\n/F1 12 Tf\n");
        var first = true;
        foreach (var line in lines)
        {
            content.Append(first ? $"60 {y} Td\n" : "0 -22 Td\n");
            content.Append('(').Append(Escape(line)).Append(") Tj\n");
            first = false;
            y -= 22;
        }
        content.Append("ET\n");

        var stream = Encoding.ASCII.GetBytes(content.ToString());

        var objects = new List<string>
        {
            "<< /Type /Catalog /Pages 2 0 R >>",
            "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
            "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
            $"<< /Length {stream.Length} >>\nstream\n{content}\nendstream",
            "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"
        };

        var pdf = new StringBuilder();
        pdf.Append("%PDF-1.4\n");
        var offsets = new List<int>();
        foreach (var (body, index) in objects.Select((b, i) => (b, i + 1)))
        {
            offsets.Add(Encoding.ASCII.GetByteCount(pdf.ToString()));
            pdf.Append(index.ToString(CultureInfo.InvariantCulture)).Append(" 0 obj\n").Append(body).Append("\nendobj\n");
        }

        var xrefOffset = Encoding.ASCII.GetByteCount(pdf.ToString());
        pdf.Append("xref\n0 ").Append(objects.Count + 1).Append('\n');
        pdf.Append("0000000000 65535 f \n");
        foreach (var offset in offsets)
            pdf.Append(offset.ToString("D10", CultureInfo.InvariantCulture)).Append(" 00000 n \n");

        pdf.Append("trailer\n<< /Size ").Append(objects.Count + 1).Append(" /Root 1 0 R >>\nstartxref\n")
           .Append(xrefOffset).Append("\n%%EOF");

        return Encoding.ASCII.GetBytes(pdf.ToString());
    }

    private static string Escape(string value)
    {
        var sb = new StringBuilder();
        foreach (var c in value)
        {
            if (c is '(' or ')' or '\\') sb.Append('\\');
            sb.Append(c <= 127 ? c : '?');
        }
        return sb.ToString();
    }
}
