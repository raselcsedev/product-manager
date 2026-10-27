# Email

The API sends email for "forgot password" (and a warning email when a password is changed).

## On your own computer: nothing to set up
With no SMTP server configured, the email is **written to the backend console** instead of being sent.
Ask for a password reset, then look at the terminal where `dotnet run` is running: the whole email is there,
including the link. Copy the link into your browser.

## Sending real emails
Set these (use user secrets, so the password is never committed):
```bash
cd backend
dotnet user-secrets set "Email:Smtp:Host"     "smtp.example.com"
dotnet user-secrets set "Email:Smtp:Port"     "587"
dotnet user-secrets set "Email:Smtp:Username" "your-smtp-user"
dotnet user-secrets set "Email:Smtp:Password" "your-smtp-password"
dotnet user-secrets set "Email:Smtp:From"     "no-reply@example.com"
```
Port 587 with an encrypted connection (STARTTLS) is the default. For a provider that uses another setup:
`Email:Smtp:UseSsl` = `false` turns encryption off (only do that on a private network).

To try it safely, use a "mail catcher" such as Mailtrap or Papercut SMTP. They accept your emails and show
them to you without delivering them to anyone.

## Settings
| Setting | Default | Meaning |
|---|---|---|
| `Site:Url` | `Cors:AllowedOrigin` | The address of the website, used in the links |
| `Auth:ResetLinkMinutes` | `60` | How long a reset link works |
| `Email:Smtp:FromName` | `Product Manager` | The sender's display name |

## How the reset works (for the curious)
1. You enter your email. The answer is always the same polite text, whether or not you have an account.
2. If you have one, the API creates a random secret, stores only its fingerprint (SHA-256) with a one-hour expiry,
   and emails you a link: `https://your-site/reset-password#token=SECRET`.
3. The secret is after the `#`, so browsers never send it to any server. The page reads it and removes it from the address bar.
4. You choose a new password. The link works once. Your password changes, every login token is revoked
   (everyone, including a thief, is logged out) and a "your password was changed" email is sent.

## Email about new messages
When a visitor writes to a seller (the contact form on a public product), the seller gets an email,
unless they switched it off on their Profile page.

- At most **one email every 10 minutes** per seller, however many messages arrive (`Notifications:MinMinutesBetweenEmails`).
- The subject is fixed text, and the body only says how many unread messages there are, the seller's OWN product name,
  and a link to the inbox. It never contains anything the visitor typed (name, email address or message).
  That is deliberate: otherwise the contact form would let strangers send any text, for example a phishing message,
  to your sellers from your own mail server.
- The message itself is always stored in the inbox first. A failed email never loses a message.
