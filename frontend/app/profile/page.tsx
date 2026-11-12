"use client";

import { useEffect, useState } from "react";
import Alert from "@/components/Alert";
import { useAuth } from "@/context/AuthContext";
import { changePassword, updateNotificationSettings, updateProfile } from "@/lib/api";

type Message = { type: "success" | "error"; text: string } | null;

const inputClass =
  "mt-1.5 w-full rounded-xl border border-slate-200/90 bg-white px-3.5 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 transition-all";

export default function ProfilePage() {
  const { user, updateUser, replaceSession } = useAuth();

  // ---- Name form ----
  const [name, setName] = useState(user?.name ?? "");
  const [nameSaving, setNameSaving] = useState(false);
  const [nameMessage, setNameMessage] = useState<Message>(null);

  // ---- Password form ----
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<Message>(null);

  // ---- Notifications ----
  const [notify, setNotify] = useState(user?.notifyOnInquiry ?? true);
  const [notifySaving, setNotifySaving] = useState(false);
  const [notifyMessage, setNotifyMessage] = useState<Message>(null);

  useEffect(() => {
    if (user?.notifyOnInquiry !== undefined) setNotify(user.notifyOnInquiry);
  }, [user?.notifyOnInquiry]);

  async function handleNameSubmit(event: React.FormEvent) {
    event.preventDefault();
    setNameMessage(null);

    const trimmed = name.trim();
    if (!trimmed) {
      setNameMessage({ type: "error", text: "Name is required." });
      return;
    }
    if (trimmed.length > 100) {
      setNameMessage({ type: "error", text: "Name must be 100 characters or fewer." });
      return;
    }

    setNameSaving(true);
    try {
      const updated = await updateProfile(trimmed);
      updateUser(updated);
      setName(updated.name);
      setNameMessage({ type: "success", text: "Your display name was updated successfully." });
    } catch (err) {
      setNameMessage({ type: "error", text: err instanceof Error ? err.message : "Failed to update name." });
    } finally {
      setNameSaving(false);
    }
  }

  async function handlePasswordSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPasswordMessage(null);

    if (!currentPassword) {
      setPasswordMessage({ type: "error", text: "Enter your current password." });
      return;
    }
    if (newPassword.length < 8 || newPassword.length > 72) {
      setPasswordMessage({ type: "error", text: "New password must be between 8 and 72 characters." });
      return;
    }
    if (newPassword === currentPassword) {
      setPasswordMessage({ type: "error", text: "The new password must be different from the current one." });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordMessage({ type: "error", text: "The new passwords do not match." });
      return;
    }

    setPasswordSaving(true);
    try {
      const session = await changePassword(currentPassword, newPassword);
      replaceSession(session);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordMessage({ type: "success", text: "Your password was changed. All other sessions have been logged out." });
    } catch (err) {
      setPasswordMessage({ type: "error", text: err instanceof Error ? err.message : "Failed to change password." });
    } finally {
      setPasswordSaving(false);
    }
  }

  async function handleNotifyChange(next: boolean) {
    setNotify(next);
    setNotifyMessage(null);
    setNotifySaving(true);
    try {
      const updated = await updateNotificationSettings(next);
      updateUser(updated);
      setNotifyMessage({
        type: "success",
        text: next ? "You will now receive email alerts for new inquiries." : "Inquiry email alerts have been disabled.",
      });
    } catch (err) {
      setNotify(!next);
      setNotifyMessage({ type: "error", text: err instanceof Error ? err.message : "Failed to save preference." });
    } finally {
      setNotifySaving(false);
    }
  }

  if (!user) return null;

  const initials =
    user.name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "?";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Account Settings</h1>
        <p className="mt-1 text-sm text-slate-500">Manage your profile details, password, and email preferences.</p>
      </div>

      {/* 2-Column Responsive Layout */}
      <div className="grid gap-6 lg:grid-cols-[340px_minmax(0,1fr)] xl:grid-cols-[380px_minmax(0,1fr)]">
        {/* Left Column: Account Summary Card */}
        <div className="space-y-6">
          <section className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs text-center dark:border-slate-800 dark:bg-slate-900">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl bg-emerald-600 text-2xl font-bold text-white shadow-lg shadow-emerald-600/30">
              {initials}
            </div>
            <h2 className="mt-4 text-lg font-bold text-slate-900 dark:text-white">{user.name}</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-mono mt-0.5">{user.email}</p>

            <div className="mt-4 flex items-center justify-center gap-2">
              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  user.role === "Admin"
                    ? "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300"
                    : "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300"
                }`}
              >
                {user.role} Role
              </span>
            </div>

            <div className="mt-6 border-t border-slate-100 pt-4 dark:border-slate-800 text-left space-y-2 text-xs text-slate-500 dark:text-slate-400">
              {user.createdAt && (
                <div className="flex justify-between">
                  <span>Member Since</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {new Date(user.createdAt).toLocaleDateString()}
                  </span>
                </div>
              )}
              <div className="flex justify-between">
                <span>Account Status</span>
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">Active</span>
              </div>
            </div>
          </section>

          {/* Notifications Card */}
          <section className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900">
            <h2 className="font-bold text-base text-slate-900 dark:text-white mb-2">Inquiry Alerts</h2>
            {notifyMessage && <div className="mb-4"><Alert type={notifyMessage.type} message={notifyMessage.text} /></div>}

            <label className="flex cursor-pointer items-start gap-3 text-sm">
              <input
                type="checkbox"
                checked={notify}
                disabled={notifySaving}
                onChange={(e) => handleNotifyChange(e.target.checked)}
                className="mt-1 h-4 w-4 rounded text-emerald-600 focus:ring-emerald-500"
              />
              <span>
                <span className="font-semibold text-slate-900 dark:text-slate-100">Email notifications</span>
                <span className="block mt-1 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  Receive an email alert when visitors send messages from your public products (batched safely).
                </span>
              </span>
            </label>
          </section>
        </div>

        {/* Right Column: Forms */}
        <div className="space-y-6">
          {/* Change name form */}
          <form onSubmit={handleNameSubmit} noValidate className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-4">
            <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
              <h2 className="text-base font-bold text-slate-900 dark:text-white">Profile Information</h2>
              <p className="text-xs text-slate-500">Update your account display name.</p>
            </div>

            {nameMessage && <Alert type={nameMessage.type} message={nameMessage.text} />}

            <div>
              <label htmlFor="name" className="block text-xs font-semibold text-slate-600 dark:text-slate-400">
                Display Name
              </label>
              <input id="name" autoComplete="name" className={inputClass} value={name} onChange={(e) => setName(e.target.value)} />
            </div>

            <div>
              <label htmlFor="email" className="block text-xs font-semibold text-slate-600 dark:text-slate-400">
                Email Address
              </label>
              <input id="email" className={`${inputClass} cursor-not-allowed opacity-70 bg-slate-50 dark:bg-slate-800`} value={user.email} disabled readOnly />
              <p className="mt-1.5 text-xs text-slate-400">Your email address is your login identifier and cannot be changed here.</p>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={nameSaving}
                className="inline-flex items-center justify-center rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm shadow-emerald-500/25 hover:bg-emerald-700 active:scale-[0.98] transition-all disabled:opacity-60"
              >
                {nameSaving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </form>

          {/* Change password form */}
          <form onSubmit={handlePasswordSubmit} noValidate className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-4">
            <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
              <h2 className="text-base font-bold text-slate-900 dark:text-white">Update Password</h2>
              <p className="text-xs text-slate-500">Ensure your account is using a strong, unique password.</p>
            </div>

            {passwordMessage && <Alert type={passwordMessage.type} message={passwordMessage.text} />}

            <div>
              <label htmlFor="currentPassword" className="block text-xs font-semibold text-slate-600 dark:text-slate-400">
                Current Password
              </label>
              <input
                id="currentPassword"
                type="password"
                autoComplete="current-password"
                className={inputClass}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="newPassword" className="block text-xs font-semibold text-slate-600 dark:text-slate-400">
                  New Password
                </label>
                <input
                  id="newPassword"
                  type="password"
                  autoComplete="new-password"
                  className={inputClass}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
                <p className="mt-1 text-[11px] text-slate-400">8 to 72 characters.</p>
              </div>

              <div>
                <label htmlFor="confirmPassword" className="block text-xs font-semibold text-slate-600 dark:text-slate-400">
                  Confirm Password
                </label>
                <input
                  id="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  className={inputClass}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={passwordSaving}
                className="inline-flex items-center justify-center rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm shadow-emerald-500/25 hover:bg-emerald-700 active:scale-[0.98] transition-all disabled:opacity-60"
              >
                {passwordSaving ? "Updating Password..." : "Update Password"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
