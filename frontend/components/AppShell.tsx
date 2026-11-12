"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import AuthGuard from "@/components/AuthGuard";
import ThemeToggle from "@/components/ThemeToggle";
import UserMenu from "@/components/UserMenu";
import { useAuth } from "@/context/AuthContext";
import { getUnreadInquiryCount } from "@/lib/api";

const iconClass = "h-5 w-5 shrink-0";

const menu = [
  {
    label: "Dashboard",
    href: "/",
    adminOnly: false,
    isActive: (p: string) => p === "/",
    icon: (
      <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 13h8V3H3v10zm10 8h8V11h-8v10zM3 21h8v-6H3v6zM13 3v6h8V3h-8z" />
      </svg>
    ),
  },
  {
    label: "POS",
    href: "/pos",
    adminOnly: false,
    isActive: (p: string) => p === "/pos",
    icon: (
      <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l3-8H5.4M7 13L5.4 5M7 13l-2 4h13M9 20a1 1 0 100-2 1 1 0 000 2zm8 0a1 1 0 100-2 1 1 0 000 2z" />
      </svg>
    ),
  },
  {
    label: "Products",
    href: "/products",
    adminOnly: false,
    isActive: (p: string) => p === "/products" || p.startsWith("/products/edit") || /^\/products\/\d+$/.test(p),
    icon: (
      <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 8l-9-5-9 5 9 5 9-5zM3 8v8l9 5 9-5V8M12 13v8" />
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
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14M5 12h14" />
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
        <path strokeLinecap="round" strokeLinejoin="round" d="M20.6 13.4l-7.2 7.2a2 2 0 01-2.8 0L3 13V3h10l7.6 7.6a2 2 0 010 2.8zM7.5 7.5h.01" />
      </svg>
    ),
  },
  {
    label: "Inbox",
    href: "/inbox",
    adminOnly: false,
    isActive: (p: string) => p === "/inbox",
    icon: (
      <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 7l9 6 9-6M3 7v10a1 1 0 001 1h16a1 1 0 001-1V7M3 7a1 1 0 011-1h16a1 1 0 011 1" />
      </svg>
    ),
  },
  {
    label: "Sales",
    href: "/sales",
    adminOnly: false,
    isActive: (p: string) => p === "/sales" || /^\/sales\/\d+$/.test(p),
    icon: (
      <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 2h12v20l-3-2-3 2-3-2-3 2V2zM9 7h6M9 11h6" />
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
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    label: "My shop",
    href: "/my-shop",
    adminOnly: false,
    isActive: (p: string) => p === "/my-shop",
    icon: (
      <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 7h16l-1.5 5a3 3 0 01-5.5 0 3 3 0 01-5 0A3 3 0 015.5 12L4 7zM5 12v8h14v-8" />
      </svg>
    ),
  },
  {
    label: "Public shop",
    href: "/shop",
    adminOnly: false,
    isActive: () => false,
    icon: (
      <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 9l1-5h16l1 5M3 9v11h18V9M3 9h18M9 20v-6h6v6" />
      </svg>
    ),
  },
  {
    label: "Users",
    href: "/admin/users",
    adminOnly: true,
    isActive: (p: string) => p === "/admin/users",
    icon: (
      <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path strokeLinecap="round" strokeLinejoin="round" d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
      </svg>
    ),
  },
];

function isPublicRoute(pathname: string) {
  return (
    pathname === "/login" ||
    pathname === "/register" ||
    pathname === "/forgot-password" ||
    pathname === "/reset-password" ||
    pathname === "/shop" ||
    pathname.startsWith("/shop/") ||
    pathname === "/shops" ||
    pathname.startsWith("/shops/")
  );
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
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/90 backdrop-blur dark:border-slate-800 dark:bg-slate-900/90">
        <div className="mx-auto flex h-16 w-full max-w-[1720px] items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link href="/shop" className="flex items-center gap-2.5 font-bold tracking-tight text-slate-900 dark:text-white hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm shadow-emerald-500/25">
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </span>
            <span className="text-lg">Product Manager</span>
          </Link>
          <nav className="flex items-center gap-1.5 sm:gap-2">
            <Link href="/shop" className="rounded-xl px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors">
              Shop
            </Link>
            <Link href="/shops" className="rounded-xl px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors">
              Shops
            </Link>
            <ThemeToggle />
            {ready && user ? (
              <Link
                href="/"
                className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-1.5 text-sm font-semibold text-white shadow-sm shadow-emerald-500/25 hover:bg-emerald-700 transition-colors"
              >
                Dashboard
              </Link>
            ) : (
              ready && (
                <>
                  <Link href="/login" className="rounded-xl px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors">
                    Login
                  </Link>
                  <Link
                    href="/register"
                    className="inline-flex items-center rounded-xl bg-emerald-600 px-4 py-1.5 text-sm font-semibold text-white shadow-sm shadow-emerald-500/25 hover:bg-emerald-700 transition-colors"
                  >
                    Register
                  </Link>
                </>
              )
            )}
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-[1720px] p-4 sm:p-6 lg:p-8">{children}</main>
    </div>
  );
}

function PrivateShell({ pathname, children }: { pathname: string; children: React.ReactNode }) {
  const { isAdmin } = useAuth();
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  // Unread messages next to "Inbox"
  const [unread, setUnread] = useState(0);
  const [inboxTick, setInboxTick] = useState(0);

  // Load saved sidebar state
  useEffect(() => {
    try {
      const saved = localStorage.getItem("pm_sidebar_collapsed");
      if (saved !== null) {
        setCollapsed(saved === "true");
      }
    } catch {
      // localStorage may fail in restricted mode
    }
  }, []);

  function toggleSidebar() {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("pm_sidebar_collapsed", String(next));
      } catch {
        // ignore
      }
      return next;
    });
  }

  // The inbox page announces every change
  useEffect(() => {
    const onChanged = () => setInboxTick((t) => t + 1);
    window.addEventListener("inbox:changed", onChanged);
    return () => window.removeEventListener("inbox:changed", onChanged);
  }, []);

  // Refresh inquiry count
  useEffect(() => {
    let cancelled = false;

    const refresh = () =>
      getUnreadInquiryCount()
        .then((r) => {
          if (!cancelled) setUnread(r.count);
        })
        .catch(() => {});

    refresh();
    const timer = setInterval(refresh, 60_000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [pathname, inboxTick]);

  const visibleMenu = menu.filter((item) => !item.adminOnly || isAdmin);
  const currentTitle =
    pathname === "/profile" ? "Profile" : menu.find((m) => m.isActive(pathname))?.label ?? "";

  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/60 backdrop-blur-sm transition-opacity md:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Mobile Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-slate-200/80 bg-white shadow-2xl transition-transform duration-300 md:hidden dark:border-slate-800 dark:bg-slate-900 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-16 items-center justify-between border-b border-slate-200/80 px-5 dark:border-slate-800">
          <Link href="/" className="flex items-center gap-2.5 font-bold tracking-tight text-slate-900 dark:text-white">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm shadow-emerald-500/25">
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </span>
            <span>Product Manager</span>
          </Link>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300"
            aria-label="Close menu"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <nav className="flex-1 space-y-1.5 overflow-y-auto p-4" aria-label="Mobile navigation">
          {visibleMenu.map((item) => {
            const active = item.isActive(pathname);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                aria-current={active ? "page" : undefined}
                className={`flex items-center gap-3.5 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors ${
                  active
                    ? "bg-emerald-600 text-white shadow-sm shadow-emerald-500/20"
                    : "text-slate-600 hover:bg-slate-100/80 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                }`}
              >
                {item.icon}
                <span>{item.label}</span>
                {item.href === "/inbox" && unread > 0 && (
                  <span
                    aria-label={`${unread} unread message${unread === 1 ? "" : "s"}`}
                    className={`ml-auto rounded-full px-2 py-0.5 text-xs font-semibold ${
                      active ? "bg-white text-emerald-700" : "bg-emerald-600 text-white"
                    }`}
                  >
                    {unread > 99 ? "99+" : unread}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Desktop Sidebar (Expandable / Collapsible) */}
      <aside
        className={`hidden md:sticky md:top-0 md:flex md:h-screen md:flex-col md:border-r md:border-slate-200/80 md:bg-white md:shadow-[1px_0_3px_rgba(0,0,0,0.03)] dark:md:border-slate-800 dark:md:bg-slate-900 transition-all duration-300 ease-in-out shrink-0 ${
          collapsed ? "md:w-20" : "md:w-64"
        }`}
      >
        {/* Sidebar Header */}
        <div
          className={`flex h-16 items-center border-b border-slate-200/80 dark:border-slate-800 ${
            collapsed ? "justify-center px-2" : "justify-between px-5"
          }`}
        >
          <Link
            href="/"
            className="flex items-center gap-3 font-bold tracking-tight text-slate-900 dark:text-white group"
            title="Product Manager"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm shadow-emerald-500/25 group-hover:scale-105 transition-transform">
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </span>
            {!collapsed && (
              <span className="whitespace-nowrap text-base font-bold text-slate-900 dark:text-white tracking-tight">
                Product Manager
              </span>
            )}
          </Link>

          {!collapsed && (
            <button
              type="button"
              onClick={toggleSidebar}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300 transition-colors"
              title="Collapse sidebar"
              aria-label="Collapse sidebar"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
              </svg>
            </button>
          )}
        </div>

        {/* Sidebar Nav Items */}
        <nav className={`flex-1 space-y-1.5 overflow-y-auto py-4 ${collapsed ? "px-2.5" : "px-3.5"}`} aria-label="Desktop menu">
          {visibleMenu.map((item) => {
            const active = item.isActive(pathname);
            return (
              <div key={item.href} className="relative group">
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  title={collapsed ? item.label : undefined}
                  className={`flex items-center rounded-xl text-sm font-medium transition-all ${
                    collapsed
                      ? "h-11 w-11 mx-auto justify-center"
                      : "gap-3.5 px-3.5 py-2.5"
                  } ${
                    active
                      ? "bg-emerald-600 text-white shadow-sm shadow-emerald-500/25"
                      : "text-slate-600 hover:bg-slate-100/90 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                  }`}
                >
                  {item.icon}
                  {!collapsed && <span className="whitespace-nowrap">{item.label}</span>}

                  {/* Badge */}
                  {item.href === "/inbox" && unread > 0 && (
                    collapsed ? (
                      <span className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-emerald-600 px-1 text-[10px] font-bold text-white shadow-md ring-2 ring-white dark:ring-slate-900">
                        {unread > 9 ? "9+" : unread}
                      </span>
                    ) : (
                      <span
                        aria-label={`${unread} unread message${unread === 1 ? "" : "s"}`}
                        className={`ml-auto rounded-full px-2 py-0.5 text-xs font-semibold ${
                          active ? "bg-white text-emerald-700" : "bg-emerald-600 text-white"
                        }`}
                      >
                        {unread > 99 ? "99+" : unread}
                      </span>
                    )
                  )}
                </Link>

                {/* Floating tooltip when sidebar is collapsed */}
                {collapsed && (
                  <div className="pointer-events-none absolute left-full top-1/2 z-50 ml-3 -translate-y-1/2 whitespace-nowrap rounded-lg bg-slate-900 px-2.5 py-1 text-xs font-medium text-white shadow-lg opacity-0 transition-opacity group-hover:opacity-100 dark:bg-slate-800 border border-slate-700">
                    {item.label}
                    {item.href === "/inbox" && unread > 0 && ` (${unread})`}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* Sidebar Footer Toggle (when collapsed) */}
        {collapsed && (
          <div className="border-t border-slate-200/80 p-3 flex justify-center dark:border-slate-800">
            <button
              type="button"
              onClick={toggleSidebar}
              className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition-colors"
              title="Expand sidebar"
              aria-label="Expand sidebar"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 5l7 7-7 7M5 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        )}
      </aside>

      {/* Main Content Area (Full Width Layout) */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top Header */}
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-slate-200/80 bg-white/95 backdrop-blur px-4 sm:px-6 lg:px-8 dark:border-slate-800 dark:bg-slate-900/95">
          <div className="flex items-center gap-3">
            {/* Mobile hamburger */}
            <button
              type="button"
              aria-label="Open menu"
              onClick={() => setOpen(true)}
              className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 md:hidden"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>

            {/* Desktop collapse toggle in header */}
            <button
              type="button"
              onClick={toggleSidebar}
              className="hidden md:inline-flex items-center justify-center rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition-colors"
              title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                {collapsed ? (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16M13 9l3 3-3 3" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16M17 9l-3 3 3 3" />
                )}
              </svg>
            </button>

            <span className="text-base font-semibold text-slate-800 dark:text-slate-100">{currentTitle}</span>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <ThemeToggle />
            {isAdmin && (
              <span className="rounded-full bg-purple-100 px-2.5 py-0.5 text-xs font-semibold text-purple-800 dark:bg-purple-900/40 dark:text-purple-300">
                Admin
              </span>
            )}
            <UserMenu />
          </div>
        </header>

        {/* Full-width Main Canvas */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 w-full overflow-x-hidden">
          <div className="w-full max-w-[1720px] mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
