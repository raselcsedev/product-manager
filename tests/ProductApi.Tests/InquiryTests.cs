using System.Net;
using System.Net.Http.Json;
using ProductApi.Models;

namespace ProductApi.Tests;

[Collection(ApiCollection.Name)]
public class InquiryTests
{
    private readonly ApiFactory _factory;

    public InquiryTests(ApiFactory factory) => _factory = factory;

    private static string NewEmail() => $"visitor-{Guid.NewGuid():N}@example.test";

    private static async Task<Product> CreateProductAsync(HttpClient client, string name, bool published)
    {
        var response = await client.PostAsJsonAsync("/api/products", new { name, price = 10m, quantity = 5, isPublished = published });
        await response.EnsureSuccessWithBodyAsync();
        return await response.ReadAsync<Product>();
    }

    private static Task<HttpResponseMessage> SendAsync(
        HttpClient client, int productId, string? email = null, string message = "Is this still available? I would like to buy it.",
        string name = "Visitor", string? companyWebsite = null) =>
        client.PostAsJsonAsync($"/api/public/products/{productId}/inquiries",
            new { name, email = email ?? NewEmail(), message, companyWebsite });

    private static async Task<PagedResult<InquiryDto>> InboxAsync(HttpClient client, string query = "")
    {
        var response = await client.GetAsync($"/api/inquiries?{query}");
        await response.EnsureSuccessWithBodyAsync();
        return await response.ReadAsync<PagedResult<InquiryDto>>();
    }

    private static async Task<int> UnreadAsync(HttpClient client) =>
        (await (await client.GetAsync("/api/inquiries/unread-count")).ReadAsync<UnreadCountDto>()).Count;

    [Fact]
    public async Task AVisitorCanMessageTheSeller_AboutAPublishedProduct()
    {
        var seller = await _factory.RegisterUserAsync("Private Seller Name");
        var product = await CreateProductAsync(seller.Client, "Lamp", published: true);
        var email = NewEmail();

        var response = await SendAsync(_factory.CreateClient(), product.Id, email, "Does it come with a bulb?", "Rasel");
        var raw = await response.Content.ReadAsStringAsync();

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        // The answer says nothing about who the seller is
        Assert.DoesNotContain(seller.Email, raw);
        Assert.DoesNotContain("Private Seller Name", raw);

        var inbox = await InboxAsync(seller.Client);
        var inquiry = Assert.Single(inbox.Items);
        Assert.Equal("Rasel", inquiry.SenderName);
        Assert.Equal(email, inquiry.SenderEmail);
        Assert.Equal("Does it come with a bulb?", inquiry.Message);
        Assert.Equal(product.Id, inquiry.ProductId);
        Assert.Equal("Lamp", inquiry.ProductName);
        Assert.False(inquiry.IsRead);
    }

    [Fact]
    public async Task UnpublishedAndUnknownProducts_AcceptNoMessages_WithTheSame404()
    {
        var seller = await _factory.RegisterUserAsync();
        var hidden = await CreateProductAsync(seller.Client, "Hidden", published: false);
        var anonymous = _factory.CreateClient();

        var unpublished = await SendAsync(anonymous, hidden.Id);
        var unknown = await SendAsync(anonymous, 99999999);

        Assert.Equal(HttpStatusCode.NotFound, unpublished.StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, unknown.StatusCode);
        Assert.Equal(await unpublished.Content.ReadAsStringAsync(), await unknown.Content.ReadAsStringAsync());
        Assert.Empty((await InboxAsync(seller.Client)).Items);
    }

    [Theory]
    [InlineData("A", "ok@example.test", "A perfectly fine message.")]                       // name too short
    [InlineData("Visitor", "not-an-email", "A perfectly fine message.")]
    [InlineData("Visitor", "has space@example.test", "A perfectly fine message.")]
    [InlineData("Visitor", "a@b.test?bcc=evil@example.test", "A perfectly fine message.")]   // would inject mailto settings
    [InlineData("Visitor", "ok@example.test", "short")]                                       // message too short
    [InlineData("Visitor", "ok@example.test", "          ")]                                  // only spaces
    public async Task InvalidMessagesAreRejected(string name, string email, string message)
    {
        var seller = await _factory.RegisterUserAsync();
        var product = await CreateProductAsync(seller.Client, "Valid target", published: true);

        var response = await SendAsync(_factory.CreateClient(), product.Id, email, message, name);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Empty((await InboxAsync(seller.Client)).Items);
    }

    [Fact]
    public async Task AMessageOver2000CharactersIsRejected()
    {
        var seller = await _factory.RegisterUserAsync();
        var product = await CreateProductAsync(seller.Client, "Target", published: true);

        var response = await SendAsync(_factory.CreateClient(), product.Id, message: new string('a', 2001));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task AMessageWithMoreThanTwoLinksIsRejected()
    {
        var seller = await _factory.RegisterUserAsync();
        var product = await CreateProductAsync(seller.Client, "Target", published: true);
        var anonymous = _factory.CreateClient();

        var spam = await SendAsync(anonymous, product.Id, message: "Cheap! http://a.test http://b.test and www.c.test now");
        var fine = await SendAsync(anonymous, product.Id, message: "See the photo at http://photos.test/me please, thanks.");

        Assert.Equal(HttpStatusCode.BadRequest, spam.StatusCode);
        Assert.Equal(HttpStatusCode.Created, fine.StatusCode);
    }

    [Fact]
    public async Task TheHoneypot_PretendsToSucceed_ButStoresNothing()
    {
        var seller = await _factory.RegisterUserAsync();
        var product = await CreateProductAsync(seller.Client, "Target", published: true);

        var response = await SendAsync(_factory.CreateClient(), product.Id, companyWebsite: "http://bot.example");

        Assert.Equal(HttpStatusCode.Created, response.StatusCode); // the bot is told it worked
        Assert.Empty((await InboxAsync(seller.Client)).Items);      // but nothing was saved
    }

    [Fact]
    public async Task ADoubleClickIsStoredOnce_AndOneAddressCannotFloodASeller()
    {
        var seller = await _factory.RegisterUserAsync();
        var product = await CreateProductAsync(seller.Client, "Target", published: true);
        var anonymous = _factory.CreateClient();
        var email = NewEmail();

        // the exact same message twice (a double click): both succeed, only one is stored
        Assert.Equal(HttpStatusCode.Created, (await SendAsync(anonymous, product.Id, email, "The very same message.")).StatusCode);
        Assert.Equal(HttpStatusCode.Created, (await SendAsync(anonymous, product.Id, email, "The very same message.")).StatusCode);
        Assert.Single((await InboxAsync(seller.Client)).Items);

        // different messages: up to 3 per day from one address
        Assert.Equal(HttpStatusCode.Created, (await SendAsync(anonymous, product.Id, email, "A second, different message.")).StatusCode);
        Assert.Equal(HttpStatusCode.Created, (await SendAsync(anonymous, product.Id, email, "A third, different message.")).StatusCode);
        var fourth = await SendAsync(anonymous, product.Id, email, "A fourth, different message.");

        Assert.Equal(HttpStatusCode.TooManyRequests, fourth.StatusCode);
        Assert.Contains("several messages", await fourth.Content.ReadAsStringAsync());
        Assert.Equal(3, (await InboxAsync(seller.Client)).TotalCount);

        // another seller is not affected by that address's limit
        var other = await _factory.RegisterUserAsync();
        var otherProduct = await CreateProductAsync(other.Client, "Other target", published: true);
        Assert.Equal(HttpStatusCode.Created, (await SendAsync(anonymous, otherProduct.Id, email, "Hello other seller, one question.")).StatusCode);
    }

    [Fact]
    public async Task TheInboxRequiresALogin()
    {
        var anonymous = _factory.CreateClient();

        Assert.Equal(HttpStatusCode.Unauthorized, (await anonymous.GetAsync("/api/inquiries")).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await anonymous.GetAsync("/api/inquiries/unread-count")).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await anonymous.DeleteAsync("/api/inquiries/1")).StatusCode);
    }

    [Fact]
    public async Task SellersOnlySeeAndChangeTheirOwnMessages()
    {
        var sellerA = await _factory.RegisterUserAsync();
        var sellerB = await _factory.RegisterUserAsync();
        var productA = await CreateProductAsync(sellerA.Client, "A's product", published: true);
        var productB = await CreateProductAsync(sellerB.Client, "B's product", published: true);
        var anonymous = _factory.CreateClient();

        await SendAsync(anonymous, productA.Id, message: "Message for seller A, please reply.");
        await SendAsync(anonymous, productB.Id, message: "Message for seller B, please reply.");

        var inboxA = await InboxAsync(sellerA.Client);
        var inboxB = await InboxAsync(sellerB.Client);
        Assert.Equal("Message for seller A, please reply.", Assert.Single(inboxA.Items).Message);
        Assert.Equal("Message for seller B, please reply.", Assert.Single(inboxB.Items).Message);
        Assert.Equal(1, await UnreadAsync(sellerA.Client));

        // B cannot touch A's message: 404, as if it did not exist
        var id = inboxA.Items[0].Id;
        Assert.Equal(HttpStatusCode.NotFound,
            (await sellerB.Client.PutAsJsonAsync($"/api/inquiries/{id}/read", new { isRead = true })).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await sellerB.Client.DeleteAsync($"/api/inquiries/{id}")).StatusCode);
        Assert.Equal(1, await UnreadAsync(sellerA.Client));
        Assert.Single((await InboxAsync(sellerA.Client)).Items);
    }

    [Fact]
    public async Task MarkingReadUnreadAndDeleting_Work_AndUpdateTheUnreadCount()
    {
        var seller = await _factory.RegisterUserAsync();
        var product = await CreateProductAsync(seller.Client, "Target", published: true);
        var anonymous = _factory.CreateClient();
        await SendAsync(anonymous, product.Id, message: "First message to the seller.");
        await SendAsync(anonymous, product.Id, message: "Second message to the seller.");
        await SendAsync(anonymous, product.Id, message: "Third message to the seller.");

        var all = (await InboxAsync(seller.Client)).Items;
        Assert.Equal(new[] { "Third message to the seller.", "Second message to the seller.", "First message to the seller." },
            all.Select(i => i.Message).ToArray()); // newest first
        Assert.Equal(3, await UnreadAsync(seller.Client));

        // mark one as read
        var read = await seller.Client.PutAsJsonAsync($"/api/inquiries/{all[0].Id}/read", new { isRead = true });
        Assert.Equal(HttpStatusCode.NoContent, read.StatusCode);
        Assert.Equal(2, await UnreadAsync(seller.Client));
        Assert.Equal(2, (await InboxAsync(seller.Client, "unread=true")).TotalCount);

        // and back to unread
        await seller.Client.PutAsJsonAsync($"/api/inquiries/{all[0].Id}/read", new { isRead = false });
        Assert.Equal(3, await UnreadAsync(seller.Client));

        // delete one
        Assert.Equal(HttpStatusCode.NoContent, (await seller.Client.DeleteAsync($"/api/inquiries/{all[1].Id}")).StatusCode);
        Assert.Equal(2, (await InboxAsync(seller.Client)).TotalCount);

        // mark everything read
        Assert.Equal(HttpStatusCode.NoContent, (await seller.Client.PutAsync("/api/inquiries/read-all", null)).StatusCode);
        Assert.Equal(0, await UnreadAsync(seller.Client));
        Assert.Empty((await InboxAsync(seller.Client, "unread=true")).Items);
        Assert.Equal(2, (await InboxAsync(seller.Client)).TotalCount); // still there, just read
    }

    [Fact]
    public async Task DeletingTheProduct_KeepsTheMessage()
    {
        var seller = await _factory.RegisterUserAsync();
        var product = await CreateProductAsync(seller.Client, "Short-lived lamp", published: true);
        await SendAsync(_factory.CreateClient(), product.Id, message: "Is the lamp still available?");

        await seller.Client.DeleteAsync($"/api/products/{product.Id}");

        var inquiry = Assert.Single((await InboxAsync(seller.Client)).Items);
        Assert.Null(inquiry.ProductId);                       // the link is gone
        Assert.Equal("Short-lived lamp", inquiry.ProductName); // but the name was kept
        Assert.Equal("Is the lamp still available?", inquiry.Message);
    }

    [Fact]
    public async Task TheMessageIsStoredAsPlainText_NotChanged()
    {
        var seller = await _factory.RegisterUserAsync();
        var product = await CreateProductAsync(seller.Client, "Target", published: true);
        const string text = "<script>alert('hi')</script> & <b>bold</b>";

        await SendAsync(_factory.CreateClient(), product.Id, message: text);

        // The API returns it exactly as written. The website shows it as text, so it cannot run.
        Assert.Equal(text, Assert.Single((await InboxAsync(seller.Client)).Items).Message);
    }

    [Fact]
    public async Task DeletingASellerAccount_DeletesTheirMessages()
    {
        var admin = await _factory.RegisterUserAsync(admin: true);
        var seller = await _factory.RegisterUserAsync();
        var product = await CreateProductAsync(seller.Client, "Target", published: true);
        await SendAsync(_factory.CreateClient(), product.Id, message: "A message that will vanish.");

        var delete = await admin.Client.DeleteAsync($"/api/admin/users/{seller.Id}");

        Assert.Equal(HttpStatusCode.NoContent, delete.StatusCode);
        Assert.Equal(0, await _factory.QueryDbAsync(db => Task.FromResult(db.Inquiries.Count(i => i.OwnerId == seller.Id))));
    }
}
