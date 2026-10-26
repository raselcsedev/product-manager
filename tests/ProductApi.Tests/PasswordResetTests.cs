using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using ProductApi.Models;
using ProductApi.Services;

namespace ProductApi.Tests;

[Collection(ApiCollection.Name)]
public class PasswordResetTests
{
    private const string NewPassword = "BrandNewPass456!";

    private readonly ApiFactory _factory;

    public PasswordResetTests(ApiFactory factory) => _factory = factory;

    private static string NewEmail() => $"nobody-{Guid.NewGuid():N}@example.test";

    private static bool IsResetMail(EmailMessage mail, string to) =>
        mail.To == to && mail.Subject.Contains("Reset", StringComparison.OrdinalIgnoreCase);

    private static string ExtractToken(EmailMessage mail)
    {
        var match = Regex.Match(mail.Body, @"#token=([A-Za-z0-9_-]+)");
        Assert.True(match.Success, "The email should contain a reset link.");
        return match.Groups[1].Value;
    }

    private Task<HttpResponseMessage> ForgotAsync(string email) =>
        _factory.CreateClient().PostAsJsonAsync("/api/auth/forgot-password", new { email });

    private Task<HttpResponseMessage> ResetAsync(string token, string newPassword = NewPassword) =>
        _factory.CreateClient().PostAsJsonAsync("/api/auth/reset-password", new { token, newPassword });

    private Task<HttpResponseMessage> LoginAsync(string email, string password) =>
        _factory.CreateClient().PostAsJsonAsync("/api/auth/login", new { email, password });

    private async Task<string> RequestTokenAsync(TestUser user)
    {
        Assert.Equal(HttpStatusCode.OK, (await ForgotAsync(user.Email)).StatusCode);
        var mails = await _factory.Emails.WaitForAsync(m => IsResetMail(m, user.Email));
        return ExtractToken(mails[^1]);
    }

    [Fact]
    public async Task ForgotPassword_GivesTheSameAnswer_ForKnownAndUnknownEmails()
    {
        var user = await _factory.RegisterUserAsync();
        var unknown = NewEmail();

        var known = await ForgotAsync(user.Email);
        var missing = await ForgotAsync(unknown);

        Assert.Equal(HttpStatusCode.OK, known.StatusCode);
        Assert.Equal(HttpStatusCode.OK, missing.StatusCode);
        // identical answers: this form cannot be used to find out who has an account
        Assert.Equal(await known.Content.ReadAsStringAsync(), await missing.Content.ReadAsStringAsync());

        Assert.Single(await _factory.Emails.WaitForAsync(m => IsResetMail(m, user.Email)));
        Assert.Empty(await _factory.Emails.WaitForAsync(m => m.To == unknown, timeout: TimeSpan.FromMilliseconds(600)));
    }

    [Fact]
    public async Task TheEmailedLink_ResetsThePassword_ExactlyOnce()
    {
        var user = await _factory.RegisterUserAsync();
        var token = await RequestTokenAsync(user);

        var reset = await ResetAsync(token);

        Assert.Equal(HttpStatusCode.NoContent, reset.StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await LoginAsync(user.Email, NewPassword)).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await LoginAsync(user.Email, user.Password)).StatusCode);

        // the link is used up
        Assert.Equal(HttpStatusCode.BadRequest, (await ResetAsync(token, "AnotherPass789!")).StatusCode);
    }

    [Fact]
    public async Task TheResetLink_IsInTheFragment_AndOnlyAFingerprintIsStored()
    {
        var user = await _factory.RegisterUserAsync();
        var token = await RequestTokenAsync(user);

        var mails = await _factory.Emails.WaitForAsync(m => IsResetMail(m, user.Email));
        Assert.Contains($"/reset-password#token={token}", mails[^1].Body); // after "#": never sent to a server

        var stored = await _factory.QueryDbAsync(db =>
            db.PasswordResetTokens.Where(t => t.UserId == user.Id).Select(t => t.TokenHash).ToListAsync());

        var hash = Assert.Single(stored);
        Assert.NotEqual(token, hash);          // the secret itself is not in the database
        Assert.Equal(64, hash.Length);         // SHA-256 as hex
    }

    [Fact]
    public async Task ResettingThePassword_EndsEverySession()
    {
        var user = await _factory.RegisterUserAsync();
        Assert.Equal(HttpStatusCode.OK, (await user.Client.GetAsync("/api/auth/me")).StatusCode);
        var token = await RequestTokenAsync(user);

        await ResetAsync(token);

        // the token this user (or a thief) already had is dead
        Assert.Equal(HttpStatusCode.Unauthorized, (await user.Client.GetAsync("/api/auth/me")).StatusCode);
    }

    [Fact]
    public async Task InvalidOrTamperedLinks_AreRefused()
    {
        var user = await _factory.RegisterUserAsync();
        var token = await RequestTokenAsync(user);
        var tampered = token[..^1] + (token.EndsWith("A") ? "B" : "A");

        Assert.Equal(HttpStatusCode.BadRequest, (await ResetAsync("not-a-real-token")).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await ResetAsync(tampered)).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await LoginAsync(user.Email, user.Password)).StatusCode); // nothing changed
    }

    [Fact]
    public async Task AnExpiredLink_IsRefused()
    {
        var user = await _factory.RegisterUserAsync();
        var token = await RequestTokenAsync(user);

        await _factory.QueryDbAsync(db => db.PasswordResetTokens
            .Where(t => t.UserId == user.Id)
            .ExecuteUpdateAsync(s => s.SetProperty(t => t.ExpiresAt, DateTime.UtcNow.AddMinutes(-5))));

        Assert.Equal(HttpStatusCode.BadRequest, (await ResetAsync(token)).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await LoginAsync(user.Email, user.Password)).StatusCode);
    }

    [Fact]
    public async Task ANewRequest_CancelsTheOlderLink()
    {
        var user = await _factory.RegisterUserAsync();
        var first = await RequestTokenAsync(user);
        Assert.Equal(HttpStatusCode.OK, (await ForgotAsync(user.Email)).StatusCode);
        var mails = await _factory.Emails.WaitForAsync(m => IsResetMail(m, user.Email), count: 2);
        var second = ExtractToken(mails[^1]);

        Assert.NotEqual(first, second);
        Assert.Equal(HttpStatusCode.BadRequest, (await ResetAsync(first)).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await ResetAsync(second)).StatusCode);
    }

    [Fact]
    public async Task AWeakNewPassword_IsRefused_AndTheLinkStaysUsable()
    {
        var user = await _factory.RegisterUserAsync();
        var token = await RequestTokenAsync(user);

        var weak = await ResetAsync(token, "short");

        Assert.Equal(HttpStatusCode.BadRequest, weak.StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await ResetAsync(token)).StatusCode); // still works with a good password
    }

    [Fact]
    public async Task AResetAlsoLiftsALoginLockout()
    {
        var user = await _factory.RegisterUserAsync();
        for (var i = 0; i < 5; i++) await LoginAsync(user.Email, "WrongPassword!");
        Assert.Equal(HttpStatusCode.TooManyRequests, (await LoginAsync(user.Email, user.Password)).StatusCode);

        var token = await RequestTokenAsync(user);
        await ResetAsync(token);

        Assert.Equal(HttpStatusCode.OK, (await LoginAsync(user.Email, NewPassword)).StatusCode);
    }

    [Fact]
    public async Task ManyRequestsForOneAddress_StopSendingEmails()
    {
        var user = await _factory.RegisterUserAsync();

        for (var i = 0; i < 7; i++)
            Assert.Equal(HttpStatusCode.OK, (await ForgotAsync(user.Email)).StatusCode); // always the same polite answer

        await _factory.Emails.WaitForAsync(m => IsResetMail(m, user.Email), count: 5);
        await Task.Delay(600); // give a possible 6th email time to (wrongly) arrive

        Assert.Equal(5, _factory.Emails.WaitForAsync(m => IsResetMail(m, user.Email), count: 99, timeout: TimeSpan.Zero).Result.Count);
    }

    [Fact]
    public async Task APasswordChange_EndsOtherSessions_ButNotTheOneYouAreUsing_AndSendsAWarningEmail()
    {
        var user = await _factory.RegisterUserAsync();
        var otherDevice = _factory.CreateClient();
        var login = await (await LoginAsync(user.Email, user.Password)).ReadAsync<AuthResponse>();
        otherDevice.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", login.Token);
        Assert.Equal(HttpStatusCode.OK, (await otherDevice.GetAsync("/api/auth/me")).StatusCode);

        var change = await user.Client.PutAsJsonAsync("/api/auth/password",
            new { currentPassword = user.Password, newPassword = NewPassword });
        var fresh = await change.ReadAsync<AuthResponse>();

        Assert.Equal(HttpStatusCode.OK, change.StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await otherDevice.GetAsync("/api/auth/me")).StatusCode); // other device: out
        Assert.Equal(HttpStatusCode.Unauthorized, (await user.Client.GetAsync("/api/auth/me")).StatusCode); // old token: out

        var current = _factory.CreateClient();
        current.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", fresh.Token);
        Assert.Equal(HttpStatusCode.OK, (await current.GetAsync("/api/auth/me")).StatusCode); // the fresh token works

        var warning = await _factory.Emails.WaitForAsync(m => m.To == user.Email && m.Subject.Contains("was changed"));
        Assert.Single(warning);
        Assert.Contains("/forgot-password", warning[0].Body);
        Assert.DoesNotContain(NewPassword, warning[0].Body); // never put a password in an email
    }
}
