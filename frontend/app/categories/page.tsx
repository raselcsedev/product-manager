"use client";

import { useCallback, useEffect, useState } from "react";
import Alert from "@/components/Alert";
import Spinner from "@/components/Spinner";
import { createCategory, deleteCategory, getCategories, updateCategory } from "@/lib/api";
import { Category } from "@/types/category";

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [newName, setNewName] = useState("");
  const [adding, setAdding] = useState(false);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      setCategories(await getCategories());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load categories.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleAdd(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    const name = newName.trim();
    if (!name) {
      setError("Category name is required.");
      return;
    }
    if (name.length > 50) {
      setError("Category name must be 50 characters or fewer.");
      return;
    }

    setAdding(true);
    try {
      await createCategory({ name });
      setNewName("");
      setSuccess(`Category "${name}" was created successfully.`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add category.");
    } finally {
      setAdding(false);
    }
  }

  function startEdit(category: Category) {
    setEditingId(category.id);
    setEditName(category.name);
    setError(null);
    setSuccess(null);
  }

  async function handleSave(category: Category) {
    const name = editName.trim();
    if (!name) {
      setError("Category name is required.");
      return;
    }
    if (name.length > 50) {
      setError("Category name must be 50 characters or fewer.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await updateCategory(category.id, { name });
      setEditingId(null);
      setSuccess(`Category renamed to "${name}".`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to rename category.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(category: Category) {
    const note =
      category.productCount > 0
        ? ` ${category.productCount} product(s) will be kept but left without a category.`
        : "";
    if (!window.confirm(`Delete category "${category.name}"?${note}`)) return;

    setError(null);
    setSuccess(null);
    try {
      await deleteCategory(category.id);
      setSuccess(`Category "${category.name}" was deleted.`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete category.");
    }
  }

  const inputClass =
    "w-full rounded-xl border border-slate-200/90 bg-white px-3.5 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 transition-all";

  const totalProducts = categories.reduce((sum, c) => sum + (c.productCount || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Categories</h1>
          <p className="mt-1 text-sm text-slate-500">Organize your product catalog into searchable groups.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="rounded-xl border border-slate-200/80 bg-white px-3.5 py-1.5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
            <span className="text-xs text-slate-400">Total Categories: </span>
            <span className="font-bold text-slate-900 dark:text-white">{categories.length}</span>
          </div>
          <div className="rounded-xl border border-slate-200/80 bg-white px-3.5 py-1.5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
            <span className="text-xs text-slate-400">Assigned Products: </span>
            <span className="font-bold text-blue-600 dark:text-blue-400">{totalProducts}</span>
          </div>
        </div>
      </div>

      {success && <Alert type="success" message={success} />}
      {error && <Alert type="error" message={error} />}

      {/* 2-Column Responsive Layout */}
      <div className="grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)] xl:grid-cols-[400px_minmax(0,1fr)]">
        {/* Left Column: Create Form */}
        <div className="space-y-4">
          <form
            onSubmit={handleAdd}
            className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="flex items-center gap-2.5 pb-4 border-b border-slate-100 dark:border-slate-800">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400">
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
              </span>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">Create Category</h2>
            </div>

            <div className="mt-4 space-y-4">
              <div>
                <label htmlFor="newCategory" className="mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-300">
                  Category Name
                </label>
                <input
                  id="newCategory"
                  placeholder="e.g. Electronics, Footwear..."
                  className={inputClass}
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  maxLength={50}
                />
              </div>

              <button
                type="submit"
                disabled={adding || !newName.trim()}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 py-2.5 text-sm font-semibold text-white shadow-sm shadow-blue-500/25 hover:bg-blue-700 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {adding ? (
                  "Adding category..."
                ) : (
                  <>
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                    </svg>
                    Add Category
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Quick Info Box */}
          <div className="rounded-2xl border border-slate-200/80 bg-slate-50/50 p-5 text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-900/30">
            <h3 className="font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Category Tips</h3>
            <p className="leading-relaxed">
              Categories help customers filter products in your public shop and allow you to quickly group sales in the POS screen.
            </p>
          </div>
        </div>

        {/* Right Column: Categories List */}
        <div>
          {loading ? (
            <Spinner label="Loading categories..." />
          ) : categories.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center text-slate-500 dark:border-slate-800 dark:bg-slate-900">
              <svg className="mx-auto h-12 w-12 text-slate-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
                <path strokeLinecap="round" strokeLinejoin="round" d="M20.6 13.4l-7.2 7.2a2 2 0 01-2.8 0L3 13V3h10l7.6 7.6a2 2 0 010 2.8zM7.5 7.5h.01" />
              </svg>
              <p className="mt-3 text-base font-semibold text-slate-700 dark:text-slate-300">No categories found</p>
              <p className="mt-1 text-xs text-slate-400">Add your first category using the form on the left.</p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200/80 bg-slate-50/80 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-400">
                  <tr>
                    <th className="px-5 py-3.5">Category Name</th>
                    <th className="px-5 py-3.5 text-center">Products</th>
                    <th className="px-5 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {categories.map((c) => (
                    <tr key={c.id} className="hover:bg-slate-50/70 transition-colors dark:hover:bg-slate-800/50">
                      <td className="px-5 py-4">
                        {editingId === c.id ? (
                          <input
                            aria-label={`Rename ${c.name}`}
                            className={inputClass}
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleSave(c);
                              if (e.key === "Escape") setEditingId(null);
                            }}
                          />
                        ) : (
                          <div className="flex items-center gap-2.5">
                            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                              </svg>
                            </span>
                            <span className="font-semibold text-slate-800 dark:text-slate-100">{c.name}</span>
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-4 text-center">
                        <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">
                          {c.productCount} {c.productCount === 1 ? "product" : "products"}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex justify-end gap-2">
                          {editingId === c.id ? (
                            <>
                              <button
                                onClick={() => handleSave(c)}
                                disabled={saving}
                                className="inline-flex items-center rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-blue-700 disabled:opacity-60"
                              >
                                Save
                              </button>
                              <button
                                onClick={() => setEditingId(null)}
                                className="inline-flex items-center rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                              >
                                Cancel
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() => startEdit(c)}
                                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-blue-600 transition-colors dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                              >
                                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                                Rename
                              </button>
                              <button
                                onClick={() => handleDelete(c)}
                                className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-white px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50 transition-colors dark:border-red-900/60 dark:bg-slate-800 dark:text-red-400"
                              >
                                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                                Delete
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
