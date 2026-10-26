using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using ProductApi.Models;

namespace ProductApi.Tests;

[Collection(ApiCollection.Name)]
public class AuthTests
{
    private readonly ApiFactory _factory;

    public AuthTests(ApiFactory factory) => _factory = factory;

    [Fact]
    public async Task Register_ReturnsATokenAndTheNewUser()
    {
        var client = _factory.CreateClient();
        var email = $"new-{Guid.NewGuid():N}@example.test";

        var response = await client.PostAsJsonAsync("/api/auth/register", new { name = "Rasel", email, password = "Password123!" });

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var auth = await response.ReadAsync<AuthResponse>();
        Assert.False(string.IsNullOrWhiteSpace(auth.Token));
        Assert.Equal("Rasel", auth.User.Name);
        Assert.Equal(email, auth.User.Email);
    }

    [Fact]
    public async Task Register_RejectsAnEmailThatIsAlreadyTaken_EvenInDifferentCase()
    {
        var existing = await _factory.RegisterUserAsync();

        var response = await _factory.CreateClient().PostAsJsonAsync("/api/auth/register",
            new { name = "Copycat", email = existing.Email.ToUpperInvariant(), password = "Password123!" });

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
    }

    [Fact]
    public async Task Register_RejectsAWeakPassword()
    {
        var response = await _factory.CreateClient().PostAsJsonAsync("/api/auth/register",
            new { name = "Weak", email = $"weak-{Guid.NewGuid():N}@example.test", password = "short" });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Contains("between 8 and 72", await response.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task Login_WorksWithTheRightPassword()
    {
        var user = await _factory.RegisterUserAsync();

        var response = await _factory.CreateClient().PostAsJsonAsync("/api/auth/login",
            new { email = user.Email, password = user.Password });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.False(string.IsNullOrWhiteSpace((await response.ReadAsync<AuthResponse>()).Token));
    }

    [Fact]
    public async Task Login_GivesTheSameAnswerForAWrongPasswordAndAnUnknownEmail()
    {
        var user = await _factory.RegisterUserAsync();
        var client = _factory.CreateClient();

        var wrongPassword = await client.PostAsJsonAsync("/api/auth/login", new { email = user.Email, password = "WrongPassword1!" });
        var unknownEmail = await client.PostAsJsonAsync("/api/auth/login", new { email = "nobody@example.test", password = "Password123!" });

        Assert.Equal(HttpStatusCode.Unauthorized, wrongPassword.StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, unknownEmail.StatusCode);
        // Identical message, so an attacker cannot learn which emails have accounts.
        Assert.Equal(await wrongPassword.Content.ReadAsStringAsync(), await unknownEmail.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task Me_RequiresALogin()
    {
        var response = await _factory.CreateClient().GetAsync("/api/auth/me");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Me_ReturnsTheLoggedInUser()
    {
        var user = await _factory.RegisterUserAsync("Rasel");

        var me = await (await user.Client.GetAsync("/api/auth/me")).ReadAsync<UserDto>();

        Assert.Equal(user.Id, me.Id);
        Assert.Equal("Rasel", me.Name);
        Assert.Equal(Roles.User, me.Role);
    }

    [Fact]
    public async Task ATamperedTokenIsRejected()
    {
        var user = await _factory.RegisterUserAsync();
        var client = _factory.CreateClient();
        var tampered = user.Token[..^3] + (user.Token.EndsWith("abc") ? "xyz" : "abc");
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", tampered);

        var response = await client.GetAsync("/api/auth/me");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task UpdateProfile_ChangesTheName()
    {
        var user = await _factory.RegisterUserAsync("Old Name");

        var update = await user.Client.PutAsJsonAsync("/api/auth/profile", new { name = "New Name" });
        var me = await (await user.Client.GetAsync("/api/auth/me")).ReadAsync<UserDto>();

        Assert.Equal(HttpStatusCode.OK, update.StatusCode);
        Assert.Equal("New Name", me.Name);
    }

    [Fact]
    public async Task ChangePassword_WithAWrongCurrentPassword_Is400_AndDoesNotLogYouOut()
    {
        var user = await _factory.RegisterUserAsync();

        var response = await user.Client.PutAsJsonAsync("/api/auth/password",
            new { currentPassword = "NotMyPassword1!", newPassword = "BrandNewPass456!" });

        // 400, not 401: a 401 would make the frontend think the session expired.
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await user.Client.GetAsync("/api/auth/me")).StatusCode);
    }

    [Fact]
    public async Task ChangePassword_ReplacesTheOldPassword()
    {
        var user = await _factory.RegisterUserAsync();

        var change = await user.Client.PutAsJsonAsync("/api/auth/password",
            new { currentPassword = user.Password, newPassword = "BrandNewPass456!" });
        var anonymous = _factory.CreateClient();
        var withNew = await anonymous.PostAsJsonAsync("/api/auth/login", new { email = user.Email, password = "BrandNewPass456!" });
        var withOld = await anonymous.PostAsJsonAsync("/api/auth/login", new { email = user.Email, password = user.Password });

        Assert.Equal(HttpStatusCode.OK, change.StatusCode);
        Assert.Equal(HttpStatusCode.OK, withNew.StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, withOld.StatusCode);
    }

    [Fact]
    public async Task ADeletedUsersTokenStopsWorkingImmediately()
    {
        var admin = await _factory.RegisterUserAsync(admin: true);
        var user = await _factory.RegisterUserAsync();
        Assert.Equal(HttpStatusCode.OK, (await user.Client.GetAsync("/api/auth/me")).StatusCode);

        var delete = await admin.Client.DeleteAsync($"/api/admin/users/{user.Id}");
        var after = await user.Client.GetAsync("/api/auth/me");

        Assert.Equal(HttpStatusCode.NoContent, delete.StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, after.StatusCode);
    }
}
