using System.Net;
using System.Net.Mail;
using System.Threading.Channels;

namespace ProductApi.Services;

public sealed record EmailMessage(string To, string Subject, string Body);

public interface IEmailSender
{
    Task SendAsync(EmailMessage message, CancellationToken cancellationToken);
}

// Used when no SMTP server is configured (on your own computer).
// In Development the whole email, including the reset link, is written to the console, so you can click it.
// Anywhere else only "an email was not sent" is written, because a reset link in a log file would let
// anybody who can read the log take over that account.
public sealed class LoggingEmailSender : IEmailSender
{
    private readonly ILogger<LoggingEmailSender> _logger;
    private readonly bool _logContents;

    public LoggingEmailSender(ILogger<LoggingEmailSender> logger, bool logContents)
    {
        _logger = logger;
        _logContents = logContents;
    }

    public Task SendAsync(EmailMessage message, CancellationToken cancellationToken)
    {
        if (_logContents)
        {
            _logger.LogInformation(
                "EMAIL (not sent, because no SMTP server is configured)\n  To: {To}\n  Subject: {Subject}\n\n{Body}",
                message.To, message.Subject, message.Body);
        }
        else
        {
            _logger.LogWarning(
                "An email to {To} (\"{Subject}\") was NOT sent, because no SMTP server is configured (Email:Smtp:Host).",
                message.To, message.Subject);
        }

        return Task.CompletedTask;
    }
}

// Sends real emails through any SMTP server (Gmail, SendGrid, Mailgun, your own ...).
public sealed class SmtpEmailSender : IEmailSender
{
    private readonly string _host;
    private readonly int _port;
    private readonly string? _username;
    private readonly string? _password;
    private readonly string _from;
    private readonly string _fromName;
    private readonly bool _useSsl;

    public SmtpEmailSender(IConfiguration config)
    {
        _host = config["Email:Smtp:Host"]!;
        _port = config.GetValue<int?>("Email:Smtp:Port") ?? 587;
        _username = config["Email:Smtp:Username"];
        _password = config["Email:Smtp:Password"];
        _useSsl = config.GetValue<bool?>("Email:Smtp:UseSsl") ?? true; // encrypted connection (STARTTLS on port 587)
        _fromName = config["Email:Smtp:FromName"] ?? "Product Manager";

        _from = config["Email:Smtp:From"] ?? _username ?? string.Empty;
        if (string.IsNullOrWhiteSpace(_from))
            throw new InvalidOperationException("Email:Smtp:From is required when Email:Smtp:Host is set.");
    }

    public async Task SendAsync(EmailMessage message, CancellationToken cancellationToken)
    {
        using var mail = new MailMessage
        {
            From = new MailAddress(_from, _fromName),
            Subject = message.Subject,
            Body = message.Body,
            IsBodyHtml = false, // plain text only: nothing a visitor typed can ever become a link or a script
        };
        mail.To.Add(message.To);

        using var client = new SmtpClient(_host, _port)
        {
            EnableSsl = _useSsl,
            DeliveryMethod = SmtpDeliveryMethod.Network,
            Timeout = 15_000,
        };

        if (!string.IsNullOrWhiteSpace(_username))
            client.Credentials = new NetworkCredential(_username, _password);

        await client.SendMailAsync(mail, cancellationToken);
    }
}

// Emails wait here, and a background worker sends them. A slow mail server then never slows down a web request.
// (The queue is in memory: emails that have not been sent yet are lost if the server restarts.)
public sealed class EmailQueue
{
    private readonly Channel<EmailMessage> _channel = Channel.CreateBounded<EmailMessage>(
        new BoundedChannelOptions(1000) { FullMode = BoundedChannelFullMode.DropWrite });

    public bool TryEnqueue(EmailMessage message) => _channel.Writer.TryWrite(message);

    public IAsyncEnumerable<EmailMessage> ReadAllAsync(CancellationToken cancellationToken) =>
        _channel.Reader.ReadAllAsync(cancellationToken);
}

public sealed class EmailBackgroundService : BackgroundService
{
    private const int MaxAttempts = 3;

    private readonly EmailQueue _queue;
    private readonly IEmailSender _sender;
    private readonly ILogger<EmailBackgroundService> _logger;

    public EmailBackgroundService(EmailQueue queue, IEmailSender sender, ILogger<EmailBackgroundService> logger)
    {
        _queue = queue;
        _sender = sender;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        await foreach (var message in _queue.ReadAllAsync(stoppingToken))
        {
            for (var attempt = 1; attempt <= MaxAttempts; attempt++)
            {
                try
                {
                    await _sender.SendAsync(message, stoppingToken);
                    break;
                }
                catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
                {
                    return;
                }
                catch (Exception ex)
                {
                    // Never log the body: it can contain a secret reset link.
                    if (attempt == MaxAttempts)
                    {
                        _logger.LogError(ex, "Giving up sending the email \"{Subject}\" to {To} after {Attempts} attempts.",
                            message.Subject, message.To, MaxAttempts);
                    }
                    else
                    {
                        _logger.LogWarning(ex, "Sending the email \"{Subject}\" to {To} failed (attempt {Attempt} of {Max}). Trying again.",
                            message.Subject, message.To, attempt, MaxAttempts);
                        await Task.Delay(TimeSpan.FromSeconds(2 * attempt), stoppingToken);
                    }
                }
            }
        }
    }
}
