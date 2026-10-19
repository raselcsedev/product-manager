using ProductApi.Services;

namespace ProductApi.Tests;

public class LoginThrottleTests
{
    // A clock the test controls, so we do not have to wait 15 real minutes
    private sealed class FakeClock : TimeProvider
    {
        public DateTimeOffset Now { get; private set; } = new(2026, 1, 1, 12, 0, 0, TimeSpan.Zero);
        public override DateTimeOffset GetUtcNow() => Now;
        public void Advance(TimeSpan time) => Now += time;
    }

    private static (LoginThrottle Throttle, FakeClock Clock) Create(int maxFailures = 3, int lockoutMinutes = 15)
    {
        var clock = new FakeClock();
        return (new LoginThrottle(maxFailures, TimeSpan.FromMinutes(lockoutMinutes), clock), clock);
    }

    [Fact]
    public void NothingIsLockedAtFirst()
    {
        var (throttle, _) = Create();

        Assert.False(throttle.IsLockedOut("someone@example.test", out _));
    }

    [Fact]
    public void FewerFailuresThanTheLimit_DoNotLock()
    {
        var (throttle, _) = Create(maxFailures: 3);

        throttle.RecordFailure("a@example.test");
        throttle.RecordFailure("a@example.test");

        Assert.False(throttle.IsLockedOut("a@example.test", out _));
    }

    [Fact]
    public void ReachingTheLimit_Locks_AndSaysForHowLong()
    {
        var (throttle, clock) = Create(maxFailures: 3, lockoutMinutes: 15);

        for (var i = 0; i < 3; i++) throttle.RecordFailure("a@example.test");

        Assert.True(throttle.IsLockedOut("a@example.test", out var retryAfter));
        Assert.Equal(TimeSpan.FromMinutes(15), retryAfter);

        clock.Advance(TimeSpan.FromMinutes(5));

        Assert.True(throttle.IsLockedOut("a@example.test", out var later));
        Assert.Equal(TimeSpan.FromMinutes(10), later);
    }

    [Fact]
    public void TheLockEnds_AndCountingStartsAgainFromZero()
    {
        var (throttle, clock) = Create(maxFailures: 3, lockoutMinutes: 15);
        for (var i = 0; i < 3; i++) throttle.RecordFailure("a@example.test");

        clock.Advance(TimeSpan.FromMinutes(15) + TimeSpan.FromSeconds(1));

        Assert.False(throttle.IsLockedOut("a@example.test", out _));

        // after the lock ends it takes a full 3 new failures to lock again
        throttle.RecordFailure("a@example.test");
        throttle.RecordFailure("a@example.test");
        Assert.False(throttle.IsLockedOut("a@example.test", out _));
        throttle.RecordFailure("a@example.test");
        Assert.True(throttle.IsLockedOut("a@example.test", out _));
    }

    [Fact]
    public void OldFailuresExpire_SoSlowGuessingNeverLocksAnOrdinaryUser()
    {
        var (throttle, clock) = Create(maxFailures: 3, lockoutMinutes: 15);

        throttle.RecordFailure("a@example.test");
        throttle.RecordFailure("a@example.test");
        clock.Advance(TimeSpan.FromMinutes(16)); // a long pause: a normal person who just mistyped twice
        throttle.RecordFailure("a@example.test");

        Assert.False(throttle.IsLockedOut("a@example.test", out _));
    }

    [Fact]
    public void ASuccessfulLogin_ClearsTheCounter()
    {
        var (throttle, _) = Create(maxFailures: 3);

        throttle.RecordFailure("a@example.test");
        throttle.RecordFailure("a@example.test");
        throttle.Reset("a@example.test");
        throttle.RecordFailure("a@example.test");
        throttle.RecordFailure("a@example.test");

        Assert.False(throttle.IsLockedOut("a@example.test", out _));
    }

    [Fact]
    public void CapitalLettersAndSpacesDoNotCreateANewCounter()
    {
        var (throttle, _) = Create(maxFailures: 3);

        throttle.RecordFailure("Person@Example.test");
        throttle.RecordFailure("  person@example.test ");
        throttle.RecordFailure("PERSON@EXAMPLE.TEST");

        Assert.True(throttle.IsLockedOut("person@example.test", out _));
    }

    [Fact]
    public void DifferentAddressesAreCountedSeparately()
    {
        var (throttle, _) = Create(maxFailures: 2);

        throttle.RecordFailure("a@example.test");
        throttle.RecordFailure("a@example.test");

        Assert.True(throttle.IsLockedOut("a@example.test", out _));
        Assert.False(throttle.IsLockedOut("b@example.test", out _));
    }

    [Fact]
    public void AnAbsurdlyLongKeyIsStillHandled()
    {
        var (throttle, _) = Create(maxFailures: 1);
        var huge = new string('x', 100_000);

        throttle.RecordFailure(huge);

        Assert.True(throttle.IsLockedOut(huge, out _));
    }
}
