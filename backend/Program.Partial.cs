// Program.cs uses "top-level statements", so its Program class is hidden (internal) by default.
// This one line makes it public, so the test project can start the whole API in memory
// (WebApplicationFactory<Program>). It changes nothing about how the app runs.
public partial class Program
{
}
