"use client";

import { useCallback, useEffect, useState } from "react";
import Alert from "@/components/Alert";
import Spinner from "@/components/Spinner";
import { useAuth } from "@/context/AuthContext";
import { deleteAdminUser, getAdminUsers, updateUserRole } from "@/lib/api";
import { AdminUser, Role } from "@/types/auth";

export default function AdminUsersPage() {
  const { user, isAdmin } = useAuth();

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      setUsers(await getAdminUsers());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load users.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAdmin) load();
    else setLoading(false);
  }, [isAdmin, load]);

  async function handleRoleChange(target: AdminUser, role: Role) {
    const verb = role === "Admin" ? "grant administrator rights to" : "revoke admin privileges from";
    if (!window.confirm(`Do you want to ${verb} ${target.name}?`)) return;

    setBusyId(target.id);
    setError(null);
    setSuccess(null);
    try {
      await updateUserRole(target.id, role);
      setSuccess(`${target.name} role changed to ${role}.`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to change role.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(target: AdminUser) {
    const message =
      `Delete ${target.name} (${target.email})?\n\n` +
      `This will permanently remove their account, ${target.productCount} product(s), and ${target.categoryCount} category(ies).`;
    if (!window.confirm(message)) return;

    setBusyId(target.id);
    setError(null);
    setSuccess(null);
    try {
      await deleteAdminUser(target.id);
      setSuccess(`${target.name} was successfully removed.`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete user.");
    } finally {
      setBusyId(null);
    }
  }

  if (!isAdmin) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">User Management</h1>
          <p className="mt-1 text-sm text-slate-500">Administrator controls for registered accounts.</p>
        </div>
        <Alert type="error" message="Access Denied: Only administrators have permission to manage system users." />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">User Management</h1>
          <p className="mt-1 text-sm text-slate-500">Manage user roles, inventory ownership, and administrative rights.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="rounded-xl border border-slate-200/80 bg-white px-3.5 py-1.5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
            <span className="text-xs text-slate-400">Total Registered Users: </span>
            <span className="font-bold text-slate-900 dark:text-white">{users.length}</span>
          </div>
        </div>
      </div>

      {success && <Alert type="success" message={success} />}
      {error && <Alert type="error" message={error} />}

      {loading ? (
        <Spinner label="Loading user directory..." />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200/80 bg-slate-50/80 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-400">
                <tr>
                  <th className="px-6 py-4">User</th>
                  <th className="px-6 py-4">Role</th>
                  <th className="px-6 py-4 text-right">Products</th>
                  <th className="px-6 py-4 text-right">Categories</th>
                  <th className="px-6 py-4">Joined</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {users.map((u) => {
                  const isSelf = u.id === user?.id;
                  return (
                    <tr key={u.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300">
                            {u.name.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-semibold text-slate-900 dark:text-white">
                              {u.name}
                              {isSelf && (
                                <span className="ml-2 inline-flex items-center rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                                  Current User
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-slate-400 font-mono mt-0.5">{u.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                            u.role === "Admin"
                              ? "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300"
                              : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                          }`}
                        >
                          {u.role}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right font-medium text-slate-700 dark:text-slate-300">
                        {u.productCount}
                      </td>
                      <td className="px-6 py-4 text-right font-medium text-slate-700 dark:text-slate-300">
                        {u.categoryCount}
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-500 dark:text-slate-400">
                        {new Date(u.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 text-right">
                        {isSelf ? (
                          <span className="text-xs text-slate-400 italic">Self Account</span>
                        ) : (
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleRoleChange(u, u.role === "Admin" ? "User" : "Admin")}
                              disabled={busyId === u.id}
                              className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 transition-colors disabled:opacity-50"
                            >
                              {u.role === "Admin" ? "Revoke Admin" : "Make Admin"}
                            </button>
                            <button
                              onClick={() => handleDelete(u)}
                              disabled={busyId === u.id}
                              className="rounded-xl border border-rose-200 bg-white px-3 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:border-rose-900/60 dark:bg-slate-800 dark:text-rose-400 dark:hover:bg-rose-950/40 transition-colors disabled:opacity-50"
                            >
                              Delete
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
