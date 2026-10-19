using System.Net;
using System.Net.Http.Json;
using ProductApi.Models;

namespace ProductApi.Tests;

[Collection(ApiCollection.Name)]
public class HardeningTests
{
    private readonly ApiFactory _factory;

    public HardeningTests(ApiFactory factory) => _factory = factory;

    private static string NewEmail() => $"lock-{Guid.NewGuid():N}@example.test";

    private static Task<HttpResponseMessage> LoginAsync(HttpClient client, string email, string password) =>
        client.PostAsJsonAsync("/api/auth/login", new { email, password });

    // ---------- security headers ----------

    [Fact]
    public async Task EveryResponseCarriesTheSecurityHeaders()
    {
        var client = _factory.CreateClient();

        foreach (var url in new[] { "/api/public/products", "/api/auth/me", "/health" }) // a 200, a 401 and a health check
        {
            var response = await client.GetAsync(url);

            Assert.Equal("nosniff", response.Headers.GetValues("X-Content-Type-Options").Single());
            Assert.Equal("DENY", response.Headers.GetValues("X-Frame-Options").Single());
            Assert.Equal("no-referrer", response.Headers.GetValues("Referrer-Policy").Single());
            Assert.Contains("default-src 'none'", response.Headers.GetValues("Content-Security-Policy").Single());
        }
    }

    // ---------- health checks ----------

    [Fact]
    public async Task TheHealthChecksAnswerWithoutLogin_AndShowNothingInternal()
    {
        var client = _factory.CreateClient();

        var live = await client.GetAsync("/health");
        var ready = await client.GetAsync("/health/ready");

        Assert.Equal(HttpStatusCode.OK, live.StatusCode);
        Assert.Equal(HttpStatusCode.OK, ready.StatusCode);
        Assert.Equal("{\"status\":\"ready\"}", await ready.Content.ReadAsStringAsync());
    }

    // ---------- lockout ----------

    [Fact]
    public async Task TooManyWrongPasswords_LockTheAccount_EvenForTheRightPassword()
    {
        var user = await _factory.RegisterUserAsync();
        var anonymous = _factory.CreateClient();

        for (var i = 0; i < 5; i++)
            Assert.Equal(HttpStatusCode.Unauthorized, (await LoginAsync(anonymous, user.Email, "WrongPassword!")).StatusCode);

        var locked = await LoginAsync(anonymous, user.Email, user.Password); // the CORRECT password

        Assert.Equal(HttpStatusCode.TooManyRequests, locked.StatusCode);
        Assert.Contains("Too many failed login attempts", await locked.Content.ReadAsStringAsync());
        Assert.True(locked.Headers.Contains("Retry-After"));
    }

    [Fact]
    public async Task AnUnknownEmailLocksTheSameWay_SoTheLockRevealsNothing()
    {
        var anonymous = _factory.CreateClient();
        var email = NewEmail(); // no such account

        for (var i = 0; i < 5; i++)
            Assert.Equal(HttpStatusCode.Unauthorized, (await LoginAsync(anonymous, email, "WrongPassword!")).StatusCode);

        Assert.Equal(HttpStatusCode.TooManyRequests, (await LoginAsync(anonymous, email, "WrongPassword!")).StatusCode);
    }

    [Fact]
    public async Task ALockOnOneAccount_DoesNotAffectOthers()
    {
        var locked = await _factory.RegisterUserAsync();
        var other = await _factory.RegisterUserAsync();
        var anonymous = _factory.CreateClient();

        for (var i = 0; i < 5; i++) await LoginAsync(anonymous, locked.Email, "WrongPassword!");

        Assert.Equal(HttpStatusCode.OK, (await LoginAsync(anonymous, other.Email, other.Password)).StatusCode);
    }

    [Fact]
    public async Task ASuccessfulLogin_ResetsTheFailureCounter()
    {
        var user = await _factory.RegisterUserAsync();
        var anonymous = _factory.CreateClient();

        for (var i = 0; i < 4; i++) await LoginAsync(anonymous, user.Email, "WrongPassword!");
        Assert.Equal(HttpStatusCode.OK, (await LoginAsync(anonymous, user.Email, user.Password)).StatusCode); // counter cleared

        for (var i = 0; i < 4; i++)
            Assert.Equal(HttpStatusCode.Unauthorized, (await LoginAsync(anonymous, user.Email, "WrongPassword!")).StatusCode);

        // four failures again, but the account is not locked, because the counter started from zero
        Assert.Equal(HttpStatusCode.OK, (await LoginAsync(anonymous, user.Email, user.Password)).StatusCode);
    }

    [Fact]
    public async Task GuessingTheCurrentPassword_WithAStolenToken_IsLimitedToo()
    {
        var user = await _factory.RegisterUserAsync();

        for (var i = 0; i < 5; i++)
        {
            var wrong = await user.Client.PutAsJsonAsync("/api/auth/password",
                new { currentPassword = $"Guess{i}Password!", newPassword = "BrandNewPass456!" });
            Assert.Equal(HttpStatusCode.BadRequest, wrong.StatusCode);
        }

        var locked = await user.Client.PutAsJsonAsync("/api/auth/password",
            new { currentPassword = user.Password, newPassword = "BrandNewPass456!" }); // even the right one is refused now

        Assert.Equal(HttpStatusCode.TooManyRequests, locked.StatusCode);
    }
}
