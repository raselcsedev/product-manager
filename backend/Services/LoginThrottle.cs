using System.Collections.Concurrent;

namespace ProductApi.Services;

// Protects against password guessing ("brute force").
//
// After `maxFailures` wrong attempts for the same key (an email address) within the lockout window,
// that key is locked for `lockout`. While it is locked, even the CORRECT password is refused.
//
// Two design decisions worth knowing:
//  - It counts attempts for unknown email addresses too, so "locked" never reveals whether an account exists.
//  - It lives in memory: it is fast and needs no database, but it resets when the server restarts and is not
//    shared between several server copies. (A shared store such as Redis would be the next step for that.)
public sealed class LoginThrottle
{
    private const int MaxTrackedKeys = 20_000;
    private const int MaxKeyLength = 256;

    private sealed class Entry
    {
        public int Failures;
        public DateTimeOffset WindowStart;
        public DateTimeOffset? LockedUntil;
    }

    private readonly ConcurrentDictionary<string, Entry> _entries = new();
    private readonly int _maxFailures;
    private readonly TimeSpan _lockout;
    private readonly TimeProvider _clock;

    public LoginThrottle(int maxFailures, TimeSpan lockout, TimeProvider clock)
    {
        if (maxFailures < 1) throw new ArgumentOutOfRangeException(nameof(maxFailures));
        if (lockout <= TimeSpan.Zero) throw new ArgumentOutOfRangeException(nameof(lockout));

        _maxFailures = maxFailures;
        _lockout = lockout;
        _clock = clock;
    }

    // Is this key locked right now? If so, `retryAfter` says for how much longer.
    public bool IsLockedOut(string key, out TimeSpan retryAfter)
    {
        retryAfter = TimeSpan.Zero;

        if (!_entries.TryGetValue(Normalize(key), out var entry))
            return false;

        var now = _clock.GetUtcNow();
        lock (entry)
        {
            if (entry.LockedUntil is { } until && until > now)
            {
                retryAfter = until - now;
                return true;
            }
        }

        return false;
    }

    public void RecordFailure(string key)
    {
        var normalized = Normalize(key);
        var now = _clock.GetUtcNow();
        var entry = _entries.GetOrAdd(normalized, _ => new Entry { WindowStart = now });

        lock (entry)
        {
            // An old lock, or old failures, no longer count: start counting again
            var lockExpired = entry.LockedUntil is { } until && until <= now;
            if (lockExpired || now - entry.WindowStart > _lockout)
            {
                entry.Failures = 0;
                entry.WindowStart = now;
                entry.LockedUntil = null;
            }

            entry.Failures++;
            if (entry.Failures >= _maxFailures)
                entry.LockedUntil = now + _lockout;
        }

        RemoveExpiredEntriesIfTooMany(now);
    }

    // A successful login clears the counter
    public void Reset(string key) => _entries.TryRemove(Normalize(key), out _);

    private static string Normalize(string key)
    {
        var normalized = key.Trim().ToLowerInvariant();
        return normalized.Length <= MaxKeyLength ? normalized : normalized[..MaxKeyLength];
    }

    // Keeps memory bounded when somebody tries thousands of different addresses
    private void RemoveExpiredEntriesIfTooMany(DateTimeOffset now)
    {
        if (_entries.Count <= MaxTrackedKeys) return;

        foreach (var pair in _entries)
        {
            var entry = pair.Value;
            bool expired;
            lock (entry)
            {
                expired = entry.LockedUntil is { } until ? until <= now : now - entry.WindowStart > _lockout;
            }

            if (expired) _entries.TryRemove(pair.Key, out _);
        }
    }
}
