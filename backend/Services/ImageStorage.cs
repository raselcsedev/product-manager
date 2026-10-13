namespace ProductApi.Services;

// Saves uploaded product images to disk (backend/uploads/products) and deletes them again.
public class ImageStorage
{
    public const long MaxBytes = 2 * 1024 * 1024; // 2 MB

    private readonly string _folder;

    public ImageStorage(IWebHostEnvironment env)
    {
        _folder = Path.Combine(env.ContentRootPath, "uploads", "products");
        Directory.CreateDirectory(_folder);
    }

    // Returns the new file name, or an error message the client can show.
    public async Task<(string? FileName, string? Error)> SaveAsync(IFormFile file)
    {
        if (file.Length == 0)
            return (null, "The file is empty.");
        if (file.Length > MaxBytes)
            return (null, "Image must be 2 MB or smaller.");

        // Never trust the file name or the Content-Type the browser sends: look at the real bytes.
        var header = new byte[12];
        int read;
        await using (var stream = file.OpenReadStream())
        {
            read = await stream.ReadAtLeastAsync(header, header.Length, throwOnEndOfStream: false);
        }

        var extension = DetectExtension(header.AsSpan(0, read));
        if (extension is null)
            return (null, "Only JPG, PNG or WebP images are allowed.");

        // A random name: users cannot guess other file names, and uploads can never overwrite each other.
        var fileName = $"{Guid.NewGuid():N}{extension}";
        await using (var target = new FileStream(Path.Combine(_folder, fileName), FileMode.CreateNew))
        {
            await file.CopyToAsync(target);
        }

        return (fileName, null);
    }

    public void Delete(string? fileName)
    {
        if (string.IsNullOrWhiteSpace(fileName)) return;

        // GetFileName strips any folder parts, so a bad value can never point outside the uploads folder.
        var path = Path.Combine(_folder, Path.GetFileName(fileName));
        if (File.Exists(path)) File.Delete(path);
    }

    // "Magic numbers": the first bytes of every real image file identify its type.
    private static string? DetectExtension(ReadOnlySpan<byte> b)
    {
        // JPEG: FF D8 FF
        if (b.Length >= 3 && b[0] == 0xFF && b[1] == 0xD8 && b[2] == 0xFF) return ".jpg";

        // PNG: 89 50 4E 47 0D 0A 1A 0A
        if (b.Length >= 8 && b[0] == 0x89 && b[1] == 0x50 && b[2] == 0x4E && b[3] == 0x47 &&
            b[4] == 0x0D && b[5] == 0x0A && b[6] == 0x1A && b[7] == 0x0A) return ".png";

        // WebP: "RIFF" .... "WEBP"
        if (b.Length >= 12 &&
            b[0] == 0x52 && b[1] == 0x49 && b[2] == 0x46 && b[3] == 0x46 &&
            b[8] == 0x57 && b[9] == 0x45 && b[10] == 0x42 && b[11] == 0x50) return ".webp";

        return null;
    }
}
