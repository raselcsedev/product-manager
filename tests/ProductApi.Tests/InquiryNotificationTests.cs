using System.Net;
using System.Net.Http.Json;
using Microsoft.EntityFrameworkCore;
using ProductApi.Models;
using ProductApi.Services;

namespace ProductApi.Tests;

[Collection(ApiCollection.Name)]
public class InquiryNotificationTests
{
    private readonly ApiFactory _factory;

    public InquiryNotificationTests(ApiFactory factory) => _factory = factory;

    private static string NewEmail() => $"visitor-{Guid.NewGuid():N}@example.test";

    private static bool IsNotification(EmailMessage mail, string to) =>
        mail.To == to && mail.Subject.Contains("New message", StringComparison.OrdinalIgnoreCase);

    private static async Task<Product> CreateProductAsync(HttpClient client, string name, bool published = true)
    {
        var response = await client.PostAsJsonAsync("/api/products", new { name, price = 10m, quantity = 5, isPublished = published });
        await response.EnsureSuccessWithBodyAsync();
        return await response.ReadAsync<Product>();
    }

    private Task<HttpResponseMessage> SendAsync(
        int productId, string? email = null, string message = "Is this still available, please?", string name = "Visitor") =>
        _factory.CreateClient().PostAsJsonAsync($"/api/public/products/{productId}/inquiries",
            new { name, email = email ?? NewEmail(), message });

    [Fact]
    public async Task ANewMessage_EmailsTheSeller_WithNothingTheVisitorWrote()
    {
        var seller = await _factory.RegisterUserAsync("Seller Sam");
        var product = await CreateProductAsync(seller.Client, "Lamp");
        var visitorEmail = NewEmail();

        Assert.Equal(HttpStatusCode.Created,
            (await SendAsync(product.Id, visitorEmail, "A very private secret from the visitor.", "Mallory Visitor")).StatusCode);

        var mail = Assert.Single(await _factory.Emails.WaitForAsync(m => IsNotification(m, seller.Email)));
        Assert.Contains("/inbox", mail.Body);
        Assert.Contains("Lamp", mail.Body);               // the seller's own product name
        Assert.Contains("1 unread message", mail.Body);
        Assert.Contains("/profile", mail.Body);           // how to switch the emails off

        // Nothing the visitor typed may appear in an email sent from OUR server
        Assert.DoesNotContain("Mallory Visitor", mail.Body);
        Assert.DoesNotContain(visitorEmail, mail.Body);
        Assert.DoesNotContain("private secret", mail.Body);
        Assert.DoesNotContain("Lamp", mail.Subject);      // and the subject is fixed text
    }

    [Fact]
    public async Task OnlyOneEmailPerWindow_ButEveryMessageIsStored()
    {
        var seller = await _factory.RegisterUserAsync();
        var product = await CreateProductAsync(seller.Client, "Target");

        await SendAsync(product.Id, message: "First message to the seller.");
        await SendAsync(product.Id, message: "Second message to the seller.");
        await SendAsync(product.Id, message: "Third message to the seller.");

        await _factory.Emails.WaitForAsync(m => IsNotification(m, seller.Email));
        await Task.Delay(600); // give a possible second email time to (wrongly) arrive

        Assert.Single(await _factory.Emails.WaitForAsync(m => IsNotification(m, seller.Email), count: 99, timeout: TimeSpan.Zero));
        var inbox = await (await seller.Client.GetAsync("/api/inquiries")).ReadAsync<PagedResult<InquiryDto>>();
        Assert.Equal(3, inbox.TotalCount);
    }

    [Fact]
    public async Task AfterTheWaitingTime_TheNextMessageEmailsAgain()
    {
        var seller = await _factory.RegisterUserAsync();
        var product = await CreateProductAsync(seller.Client, "Target");

        await SendAsync(product.Id, message: "First message to the seller.");
        await _factory.Emails.WaitForAsync(m => IsNotification(m, seller.Email));

        // pretend the last email was sent 11 minutes ago
        await _factory.QueryDbAsync(db => db.Users
            .Where(u => u.Id == seller.Id)
            .ExecuteUpdateAsync(s => s.SetProperty(u => u.LastInquiryEmailAt, (DateTime?)DateTime.UtcNow.AddMinutes(-11))));

        await SendAsync(product.Id, message: "Second message, much later.");

        var mails = await _factory.Emails.WaitForAsync(m => IsNotification(m, seller.Email), count: 2);
        Assert.Equal(2, mails.Count);
        Assert.Contains("2 unread messages", mails[1].Body);
    }

    [Fact]
    public async Task ANewAccount_HasNotificationsOn_AndSellersCanSwitchThemOffAndOn()
    {
        var seller = await _factory.RegisterUserAsync();
        var product = await CreateProductAsync(seller.Client, "Target");
        Assert.True((await (await seller.Client.GetAsync("/api/auth/me")).ReadAsync<UserDto>()).NotifyOnInquiry);

        // switch off
        var off = await seller.Client.PutAsJsonAsync("/api/auth/notification-settings", new { notifyOnInquiry = false });
        Assert.Equal(HttpStatusCode.OK, off.StatusCode);
        Assert.False((await off.ReadAsync<UserDto>()).NotifyOnInquiry);
        Assert.False((await (await seller.Client.GetAsync("/api/auth/me")).ReadAsync<UserDto>()).NotifyOnInquiry);

        await SendAsync(product.Id, message: "A message while notifications are off.");
        Assert.Empty(await _factory.Emails.WaitForAsync(m => IsNotification(m, seller.Email), timeout: TimeSpan.FromMilliseconds(600)));

        // the message is still in the inbox
        var inbox = await (await seller.Client.GetAsync("/api/inquiries")).ReadAsync<PagedResult<InquiryDto>>();
        Assert.Equal(1, inbox.TotalCount);

        // switch on again
        await seller.Client.PutAsJsonAsync("/api/auth/notification-settings", new { notifyOnInquiry = true });
        await SendAsync(product.Id, message: "A message after switching them on.");
        Assert.Single(await _factory.Emails.WaitForAsync(m => IsNotification(m, seller.Email)));
    }

    [Fact]
    public async Task NotificationSettings_RequireALogin()
    {
        var response = await _factory.CreateClient().PutAsJsonAsync("/api/auth/notification-settings", new { notifyOnInquiry = false });

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task RefusedOrIgnoredMessages_SendNoEmail()
    {
        var seller = await _factory.RegisterUserAsync();
        var published = await CreateProductAsync(seller.Client, "Public one");
        var hidden = await CreateProductAsync(seller.Client, "Hidden one", published: false);
        var anonymous = _factory.CreateClient();

        // a bot (the hidden "honeypot" field is filled in)
        await anonymous.PostAsJsonAsync($"/api/public/products/{published.Id}/inquiries",
            new { name = "Bot", email = NewEmail(), message = "Buy cheap pills here please.", companyWebsite = "http://bot.example" });
        // an unpublished product
        await SendAsync(hidden.Id, message: "Message to a private product.");
        // an invalid message
        await SendAsync(published.Id, message: "short");

        Assert.Empty(await _factory.Emails.WaitForAsync(m => IsNotification(m, seller.Email), timeout: TimeSpan.FromMilliseconds(700)));
    }

    [Fact]
    public async Task TheEmailGoesOnlyToTheSellerOfThatProduct()
    {
        var sellerA = await _factory.RegisterUserAsync();
        var sellerB = await _factory.RegisterUserAsync();
        var productA = await CreateProductAsync(sellerA.Client, "A's product");
        await CreateProductAsync(sellerB.Client, "B's product");

        await SendAsync(productA.Id, message: "A question about the product of seller A.");

        Assert.Single(await _factory.Emails.WaitForAsync(m => IsNotification(m, sellerA.Email)));
        Assert.Empty(await _factory.Emails.WaitForAsync(m => IsNotification(m, sellerB.Email), timeout: TimeSpan.FromMilliseconds(600)));
    }
}
