using System.Text;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.FileProviders;
using ProductApi.Services;

namespace ProductApi.Tests;

public sealed class ImageStorageTests : IDisposable
{
    private readonly string _root = Path.Combine(Path.GetTempPath(), "imagestorage-" + Guid.NewGuid().ToString("N"));
    private readonly ImageStorage _storage;

    public ImageStorageTests()
    {
        Directory.CreateDirectory(_root);
        _storage = new ImageStorage(new FakeEnvironment(_root));
    }

    public void Dispose()
    {
        try { Directory.Delete(_root, recursive: true); } catch { /* best effort */ }
    }

    private string ProductsFolder => Path.Combine(_root, "uploads", "products");

    private static FormFile MakeFile(byte[] bytes, string fileName = "photo.jpg") =>
        new(new MemoryStream(bytes), 0, bytes.Length, "file", fileName);

    // A real image file starts with a few "magic" bytes. We build just enough of them.
    private static byte[] WithHeader(byte[] header, int totalLength = 64)
    {
        var bytes = new byte[totalLength];
        header.CopyTo(bytes, 0);
        return bytes;
    }

    private static readonly byte[] Jpeg = WithHeader(new byte[] { 0xFF, 0xD8, 0xFF, 0xE0 });
    private static readonly byte[] Png = WithHeader(new byte[] { 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A });
    private static readonly byte[] WebP = WithHeader(new byte[] { 0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50 });

    [Theory]
    [MemberData(nameof(ValidImages))]
    public async Task SaveAsync_AcceptsRealImages_AndUsesTheDetectedExtension(byte[] bytes, string extension)
    {
        var (fileName, error) = await _storage.SaveAsync(MakeFile(bytes, "whatever.bin"));

        Assert.Null(error);
        Assert.NotNull(fileName);
        Assert.EndsWith(extension, fileName);
        Assert.True(File.Exists(Path.Combine(ProductsFolder, fileName!)));
    }

    public static IEnumerable<object[]> ValidImages()
    {
        yield return new object[] { Jpeg, ".jpg" };
        yield return new object[] { Png, ".png" };
        yield return new object[] { WebP, ".webp" };
    }

    [Fact]
    public async Task SaveAsync_RejectsATextFileRenamedToJpg()
    {
        var bytes = Encoding.UTF8.GetBytes("<?php echo 'not an image'; ?>");

        var (fileName, error) = await _storage.SaveAsync(MakeFile(bytes, "cat.jpg"));

        Assert.Null(fileName);
        Assert.Contains("JPG, PNG or WebP", error);
        Assert.Empty(Directory.GetFiles(ProductsFolder));
    }

    [Fact]
    public async Task SaveAsync_RejectsAProgramFile()
    {
        var exe = WithHeader(new byte[] { 0x4D, 0x5A }); // "MZ" = Windows program

        var (fileName, _) = await _storage.SaveAsync(MakeFile(exe, "photo.png"));

        Assert.Null(fileName);
    }

    [Fact]
    public async Task SaveAsync_RejectsFilesOverTwoMegabytes()
    {
        var big = new byte[ImageStorage.MaxBytes + 1];
        Jpeg.AsSpan(0, 4).CopyTo(big);

        var (fileName, error) = await _storage.SaveAsync(MakeFile(big));

        Assert.Null(fileName);
        Assert.Contains("2 MB", error);
    }

    [Fact]
    public async Task SaveAsync_RejectsAnEmptyFile()
    {
        var (fileName, error) = await _storage.SaveAsync(MakeFile(Array.Empty<byte>()));

        Assert.Null(fileName);
        Assert.Contains("empty", error);
    }

    [Fact]
    public async Task SaveAsync_GivesEveryUploadItsOwnRandomName()
    {
        var (first, _) = await _storage.SaveAsync(MakeFile(Jpeg, "same-name.jpg"));
        var (second, _) = await _storage.SaveAsync(MakeFile(Jpeg, "same-name.jpg"));

        Assert.NotEqual(first, second);
        Assert.DoesNotContain("same-name", first);
    }

    [Fact]
    public async Task Delete_RemovesTheFile()
    {
        var (fileName, _) = await _storage.SaveAsync(MakeFile(Jpeg));
        var path = Path.Combine(ProductsFolder, fileName!);

        _storage.Delete(fileName);

        Assert.False(File.Exists(path));
    }

    [Fact]
    public void Delete_CanNeverReachOutsideTheUploadsFolder()
    {
        var outside = Path.Combine(_root, "secret.txt");
        File.WriteAllText(outside, "do not delete me");

        _storage.Delete("../../secret.txt");
        _storage.Delete(null);
        _storage.Delete("");

        Assert.True(File.Exists(outside));
    }

    // Just enough of IWebHostEnvironment for ImageStorage, pointing at a temporary folder.
    private sealed class FakeEnvironment : IWebHostEnvironment
    {
        public FakeEnvironment(string contentRoot) => ContentRootPath = contentRoot;

        public string ApplicationName { get; set; } = "Tests";
        public IFileProvider WebRootFileProvider { get; set; } = new NullFileProvider();
        public string WebRootPath { get; set; } = string.Empty;
        public string EnvironmentName { get; set; } = "Testing";
        public string ContentRootPath { get; set; }
        public IFileProvider ContentRootFileProvider { get; set; } = new NullFileProvider();
    }
}
