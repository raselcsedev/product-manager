"use client";

import { useState } from "react";
import Alert from "@/components/Alert";
import { useAuth } from "@/context/AuthContext";
import { changePassword, updateProfile } from "@/lib/api";

type Message = { type: "success" | "error"; text: string } | null;

const inputClass =
  "mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600";

export default function ProfilePage() {
  const { user, updateUser } = useAuth();

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
      updateUser(updated); // refreshes the name in the navbar right away
      setName(updated.name);
      setNameMessage({ type: "success", text: "Your name was updated." });
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
      await changePassword(currentPassword, newPassword);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordMessage({ type: "success", text: "Your password was changed." });
    } catch (err) {
      setPasswordMessage({ type: "error", text: err instanceof Error ? err.message : "Failed to change password." });
    } finally {
      setPasswordSaving(false);
    }
  }

  if (!user) return null; // AuthGuard normally guarantees a user

  const initials =
    user.name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "?";

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <h1 className="text-2xl font-semibold">Profile</h1>

      {/* Account summary */}
      <section className="flex items-center gap-4 rounded-lg border border-slate-200 bg-white p-5">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-blue-600 text-lg font-semibold text-white">
          {initials}
        </span>
        <div className="min-w-0">
          <p className="truncate text-lg font-medium">{user.name}</p>
          <p className="truncate text-sm text-slate-500">{user.email}</p>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
            <span
              className={`rounded-full px-2 py-0.5 font-medium ${
                user.role === "Admin" ? "bg-purple-100 text-purple-800" : "bg-slate-100 text-slate-700"
              }`}
            >
              {user.role}
            </span>
            {user.createdAt && (
              <span className="text-slate-500">Member since {new Date(user.createdAt).toLocaleDateString()}</span>
            )}
          </div>
        </div>
      </section>

      {/* Change name */}
      <form onSubmit={handleNameSubmit} noValidate className="space-y-4 rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="font-medium">Display name</h2>
        {nameMessage && <Alert type={nameMessage.type} message={nameMessage.text} />}

        <div>
          <label htmlFor="name" className="text-sm font-medium">Name</label>
          <input id="name" autoComplete="name" className={inputClass} value={name} onChange={(e) => setName(e.target.value)} />
        </div>

        <div>
          <label htmlFor="email" className="text-sm font-medium">Email</label>
          <input id="email" className={`${inputClass} cursor-not-allowed opacity-70`} value={user.email} disabled readOnly />
          <p className="mt-1 text-xs text-slate-500">Your email is your login, so it cannot be changed here.</p>
        </div>

        <button
          type="submit"
          disabled={nameSaving}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
        >
          {nameSaving ? "Saving..." : "Save name"}
        </button>
      </form>

      {/* Change password */}
      <form onSubmit={handlePasswordSubmit} noValidate className="space-y-4 rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="font-medium">Change password</h2>
        {passwordMessage && <Alert type={passwordMessage.type} message={passwordMessage.text} />}

        <div>
          <label htmlFor="currentPassword" className="text-sm font-medium">Current password</label>
          <input
            id="currentPassword"
            type="password"
            autoComplete="current-password"
            className={inputClass}
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
          />
        </div>

        <div>
          <label htmlFor="newPassword" className="text-sm font-medium">New password</label>
          <input
            id="newPassword"
            type="password"
            autoComplete="new-password"
            className={inputClass}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
          <p className="mt-1 text-xs text-slate-500">8 to 72 characters.</p>
        </div>

        <div>
          <label htmlFor="confirmPassword" className="text-sm font-medium">Confirm new password</label>
          <input
            id="confirmPassword"
            type="password"
            autoComplete="new-password"
            className={inputClass}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />
        </div>

        <button
          type="submit"
          disabled={passwordSaving}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
        >
          {passwordSaving ? "Changing..." : "Change password"}
        </button>
      </form>
    </div>
  );
}
