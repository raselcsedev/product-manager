using System.Security.Claims;

namespace ProductApi.Services;

public static class ClaimsPrincipalExtensions
{
    // Reads the logged-in user's id from the JWT ("sub" claim).
    // The id always comes from the signed token, never from the request body or URL.
    public static int GetUserId(this ClaimsPrincipal principal)
    {
        if (!principal.TryGetUserId(out var id))
            throw new InvalidOperationException("The token does not contain a valid user id.");

        return id;
    }

    // Same, but returns false instead of throwing (used where there may be no logged-in user).
    public static bool TryGetUserId(this ClaimsPrincipal? principal, out int id)
    {
        id = 0;
        return int.TryParse(principal?.FindFirst("sub")?.Value, out id);
    }

    // The display name stored in the token (used for the "who did it" part of the activity history).
    public static string GetUserName(this ClaimsPrincipal? principal) =>
        principal?.FindFirst("name")?.Value ?? "Unknown";
}
