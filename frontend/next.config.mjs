// The address of the API as seen by a visitor's browser (used in the security policy below)
const apiOrigin = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5080").origin;
  } catch {
    return "http://localhost:5080";
  }
})();

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
const isHttps = siteUrl.startsWith("https://");
const isProduction = process.env.NODE_ENV === "production";

// Content Security Policy: the browser may only load scripts, images and data from these places.
// If an attacker ever got a script into a page, the browser would still refuse to send data to their server.
// "'unsafe-inline'" is needed because Next.js and the dark-mode script use small inline scripts.
// (A stricter version uses per-request "nonces". That is possible, but makes every page dynamic.)
const contentSecurityPolicy = [
  "default-src 'self'",
  `img-src 'self' data: blob: ${apiOrigin}`, // blob: is the preview of a picture you just chose in the product form
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  `connect-src 'self' ${apiOrigin}`,
  "font-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'", // nobody may put this site inside a frame (clickjacking)
  ...(isHttps ? ["upgrade-insecure-requests"] : []),
].join("; ");

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  // Tell browsers to always use https for this site (only when the site really is on https)
  ...(isHttps ? [{ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" }] : []),
  // The policy is only applied in production: the development server needs more freedom
  ...(isProduction ? [{ key: "Content-Security-Policy", value: contentSecurityPolicy }] : []),
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  // The Docker build sets NEXT_OUTPUT=standalone: a small self-contained server for the container.
  // (Left off on your own computer, because it can fail on Windows.)
  output: process.env.NEXT_OUTPUT === "standalone" ? "standalone" : undefined,

  poweredByHeader: false, // do not announce "X-Powered-By: Next.js"

  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
