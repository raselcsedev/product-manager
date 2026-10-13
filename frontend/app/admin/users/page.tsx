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
    const verb = role === "Admin" ? "make an admin" : "remove admin rights from";
    if (!window.confirm(`Do you want to ${verb} ${target.name}?`)) return;

    setBusyId(target.id);
    setError(null);
    setSuccess(null);
    try {
      await updateUserRole(target.id, role);
      setSuccess(`${target.name} is now ${role === "Admin" ? "an Admin" : "a User"}.`);
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
      `This also permanently deletes their ${target.productCount} product(s) and ${target.categoryCount} category(ies).`;
    if (!window.confirm(message)) return;

    setBusyId(target.id);
    setError(null);
    setSuccess(null);
    try {
      await deleteAdminUser(target.id);
      setSuccess(`${target.name} was deleted.`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete user.");
    } finally {
      setBusyId(null);
    }
  }

  // The server enforces this too. This message just explains the situation to the user.
  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-xl space-y-4">
        <h1 className="text-2xl font-semibold">Users</h1>
        <Alert type="error" message="You do not have access to this page. Only admins can manage users." />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Users</h1>

      {success && <Alert type="success" message={success} />}
      {error && <Alert type="error" message={error} />}

      {loading ? (
        <Spinner label="Loading users..." />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-100 text-slate-700">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Role</th>
                <th className="px-4 py-3 text-right font-medium">Products</th>
                <th className="px-4 py-3 text-right font-medium">Categories</th>
                <th className="px-4 py-3 font-medium">Joined</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((u) => {
                const isSelf = u.id === user?.id;
                return (
                  <tr key={u.id}>
                    <td className="px-4 py-3 font-medium">
                      {u.name}
                      {isSelf && <span className="ml-2 text-xs text-slate-500">(you)</span>}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{u.email}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          u.role === "Admin" ? "bg-purple-100 text-purple-800" : "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {u.role}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">{u.productCount}</td>
                    <td className="px-4 py-3 text-right">{u.categoryCount}</td>
                    <td className="px-4 py-3 text-slate-600">{new Date(u.createdAt).toLocaleDateString()}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        {isSelf ? (
                          <span className="text-xs text-slate-400">No actions on your own account</span>
                        ) : (
                          <>
                            <button
                              onClick={() => handleRoleChange(u, u.role === "Admin" ? "User" : "Admin")}
                              disabled={busyId === u.id}
                              className="rounded-md border border-slate-300 px-3 py-1 hover:bg-slate-100 disabled:opacity-50"
                            >
                              {u.role === "Admin" ? "Make user" : "Make admin"}
                            </button>
                            <button
                              onClick={() => handleDelete(u)}
                              disabled={busyId === u.id}
                              className="rounded-md border border-red-200 px-3 py-1 text-red-700 hover:bg-red-50 disabled:opacity-50"
                            >
                              Delete
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
