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
      setSuccess(`Category "${name}" was added.`);
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
    "rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600";

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h1 className="text-2xl font-semibold">Categories</h1>

      {success && <Alert type="success" message={success} />}
      {error && <Alert type="error" message={error} />}

      <form onSubmit={handleAdd} className="flex gap-2 rounded-lg border border-slate-200 bg-white p-4">
        <label htmlFor="newCategory" className="sr-only">New category name</label>
        <input
          id="newCategory"
          placeholder="New category name"
          className={`${inputClass} flex-1`}
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
        />
        <button
          type="submit"
          disabled={adding}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
        >
          {adding ? "Adding..." : "Add category"}
        </button>
      </form>

      {loading ? (
        <Spinner label="Loading categories..." />
      ) : categories.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white p-10 text-center text-slate-600">
          No categories yet. Add your first category above.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-100 text-slate-700">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 text-right font-medium">Products</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {categories.map((c) => (
                <tr key={c.id}>
                  <td className="px-4 py-3">
                    {editingId === c.id ? (
                      <input
                        aria-label={`Rename ${c.name}`}
                        className={`${inputClass} w-full`}
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        autoFocus
                      />
                    ) : (
                      <span className="font-medium">{c.name}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">{c.productCount}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      {editingId === c.id ? (
                        <>
                          <button
                            onClick={() => handleSave(c)}
                            disabled={saving}
                            className="rounded-md bg-blue-600 px-3 py-1 text-white hover:bg-blue-700 disabled:opacity-60"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            className="rounded-md border border-slate-300 px-3 py-1 hover:bg-slate-100"
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => startEdit(c)}
                            className="rounded-md border border-slate-300 px-3 py-1 hover:bg-slate-100"
                          >
                            Rename
                          </button>
                          <button
                            onClick={() => handleDelete(c)}
                            className="rounded-md border border-red-200 px-3 py-1 text-red-700 hover:bg-red-50"
                          >
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
  );
}
