using System.Security.Claims;

namespace ProductApi.Services;

public static class ClaimsPrincipalExtensions
{
    // Reads the logged-in user's id from the JWT ("sub" claim).
    // The id always comes from the signed token, never from the request body or URL.
    public static int GetUserId(this ClaimsPrincipal principal)
    {
        var value = principal.FindFirst("sub")?.Value;
        if (!int.TryParse(value, out var id))
            throw new InvalidOperationException("The token does not contain a valid user id.");

        return id;
    }
}
