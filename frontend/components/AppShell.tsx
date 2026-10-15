"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import AuthGuard from "@/components/AuthGuard";
import ThemeToggle from "@/components/ThemeToggle";
import UserMenu from "@/components/UserMenu";
import { useAuth } from "@/context/AuthContext";

const iconClass = "h-5 w-5 shrink-0";

const menu = [
  {
    label: "Dashboard",
    href: "/",
    adminOnly: false,
    isActive: (p: string) => p === "/",
    icon: (
      <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M3 13h8V3H3v10zm10 8h8V11h-8v10zM3 21h8v-6H3v6zM13 3v6h8V3h-8z" />
      </svg>
    ),
  },
  {
    label: "Products",
    href: "/products",
    adminOnly: false,
    // the list, the edit pages, and a single product's page (/products/5) all belong to "Products"
    isActive: (p: string) => p === "/products" || p.startsWith("/products/edit") || /^\/products\/\d+$/.test(p),
    icon: (
      <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M21 8l-9-5-9 5 9 5 9-5zM3 8v8l9 5 9-5V8M12 13v8" />
      </svg>
    ),
  },
  {
    label: "Add product",
    href: "/products/add",
    adminOnly: false,
    isActive: (p: string) => p === "/products/add",
    icon: (
      <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M12 5v14M5 12h14" />
      </svg>
    ),
  },
  {
    label: "Categories",
    href: "/categories",
    adminOnly: false,
    isActive: (p: string) => p === "/categories",
    icon: (
      <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M20.6 13.4l-7.2 7.2a2 2 0 01-2.8 0L3 13V3h10l7.6 7.6a2 2 0 010 2.8zM7.5 7.5h.01" />
      </svg>
    ),
  },
  {
    label: "Activity",
    href: "/activity",
    adminOnly: false,
    isActive: (p: string) => p === "/activity",
    icon: (
      <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M12 8v4l3 3M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    label: "Public shop",
    href: "/shop",
    adminOnly: false,
    isActive: () => false, // the shop has its own layout without this sidebar
    icon: (
      <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M3 9l1-5h16l1 5M3 9v11h18V9M3 9h18M9 20v-6h6v6" />
      </svg>
    ),
  },
  {
    label: "Users",
    href: "/admin/users",
    adminOnly: true, // only shown to admins
    isActive: (p: string) => p === "/admin/users",
    icon: (
      <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
      </svg>
    ),
  },
];

// Pages anyone can open without logging in: login, register, and the whole public shop.
function isPublicRoute(pathname: string) {
  return pathname === "/login" || pathname === "/register" || pathname === "/shop" || pathname.startsWith("/shop/");
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "";

  if (isPublicRoute(pathname)) {
    return <PublicShell>{children}</PublicShell>;
  }

  return (
    <AuthGuard>
      <PrivateShell pathname={pathname}>{children}</PrivateShell>
    </AuthGuard>
  );
}

function PublicShell({ children }: { children: React.ReactNode }) {
  const { user, ready } = useAuth();

  return (
    <div className="min-h-screen">
      <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-4 md:px-8">
        <Link href="/shop" className="text-lg font-semibold">
          Product Manager
        </Link>
        <nav className="flex items-center gap-2">
          <Link href="/shop" className="rounded-md px-4 py-1.5 text-sm font-medium hover:bg-slate-100">
            Shop
          </Link>
          <ThemeToggle />
          {ready && user ? (
            // Already logged in: a way back into the app
            <Link
              href="/"
              className="rounded-md bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
            >
              Dashboard
            </Link>
          ) : (
            ready && (
              <>
                <Link href="/login" className="rounded-md px-4 py-1.5 text-sm font-medium hover:bg-slate-100">
                  Login
                </Link>
                <Link
                  href="/register"
                  className="rounded-md bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
                >
                  Register
                </Link>
              </>
            )
          )}
        </nav>
      </header>
      <main className="p-4 md:p-8">{children}</main>
    </div>
  );
}

function PrivateShell({ pathname, children }: { pathname: string; children: React.ReactNode }) {
  const { isAdmin } = useAuth();
  const [open, setOpen] = useState(false);

  // Hiding a menu item is only for convenience. The real protection is on the server.
  const visibleMenu = menu.filter((item) => !item.adminOnly || isAdmin);
  const currentTitle =
    pathname === "/profile" ? "Profile" : menu.find((m) => m.isActive(pathname))?.label ?? "";

  return (
    <div className="flex min-h-screen">
      {/* Mobile overlay */}
      {open && <div className="fixed inset-0 z-30 bg-black/40 md:hidden" onClick={() => setOpen(false)} />}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-60 transform border-r border-slate-200 bg-white transition-transform md:static md:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-16 items-center border-b border-slate-200 px-5 text-lg font-semibold">
          Product Manager
        </div>
        <nav className="space-y-1 p-3" aria-label="Main menu">
          {visibleMenu.map((item) => {
            const active = item.isActive(pathname);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                aria-current={active ? "page" : undefined}
                className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium ${
                  active ? "bg-blue-50 text-blue-700" : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                {item.icon}
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Right side: navbar + page content */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-slate-200 bg-white px-4 md:px-8">
          <div className="flex items-center gap-3">
            <button
              type="button"
              aria-label="Open menu"
              onClick={() => setOpen(true)}
              className="rounded-md p-2 text-slate-600 hover:bg-slate-100 md:hidden"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <span className="font-medium text-slate-700">{currentTitle}</span>
          </div>

          <div className="flex items-center gap-2">
            <ThemeToggle />
            {isAdmin && (
              <span className="rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-800">Admin</span>
            )}
            <UserMenu />
          </div>
        </header>

        <main className="flex-1 p-4 md:p-8">
          <div className="mx-auto max-w-5xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
