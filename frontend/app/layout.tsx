import type { Metadata } from "next";
import AppShell from "@/components/AppShell";
import { AuthProvider } from "@/context/AuthContext";
import { SITE_NAME, SITE_URL } from "@/lib/site";
import "./globals.css";

export const metadata: Metadata = {
  // Lets every page use short addresses like "/shop/5" in its share-preview and canonical tags
  metadataBase: new URL(SITE_URL),
  // A page that sets title "Lamp" becomes "Lamp | Product Manager"
  title: { default: SITE_NAME, template: `%s | ${SITE_NAME}` },
  description: "Browse products from independent sellers.",
};

// Runs in the browser BEFORE the page is painted, so there is no white flash in dark mode.
// A saved choice wins; otherwise we follow the computer's own light/dark setting.
const themeScript = `
(function () {
  try {
    var saved = localStorage.getItem("theme");
    var dark = saved ? saved === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
    if (dark) document.documentElement.classList.add("dark");
  } catch (e) {}
})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // suppressHydrationWarning: the script above changes <html class> before React loads.
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="bg-slate-50 text-slate-900 antialiased">
        <AuthProvider>
          <AppShell>{children}</AppShell>
        </AuthProvider>
      </body>
    </html>
  );
}
