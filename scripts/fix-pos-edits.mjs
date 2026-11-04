// Applies the three small edits the POS feature needs to your existing files.
// Safe to run more than once: an edit that is already there is skipped.
//
//   node scripts/fix-pos-edits.mjs
//
import fs from "node:fs";
import path from "node:path";

const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
let problems = 0;

function edit(relativePath, description, change) {
  const file = path.join(root, relativePath);
  if (!fs.existsSync(file)) {
    console.log(`[MISSING] ${relativePath} not found. Run this from the project root (the folder that contains "backend" and "frontend").`);
    problems++;
    return;
  }

  try {
    const original = fs.readFileSync(file, "utf8");
    const updated = change(original);
    if (updated === null) {
      console.log(`[  OK   ] ${relativePath}: ${description} (already done)`);
      return;
    }
    fs.writeFileSync(file, updated, "utf8");
    console.log(`[ DONE  ] ${relativePath}: ${description}`);
  } catch (error) {
    console.log(`[FAILED ] ${relativePath}: ${description}: ${error.message}`);
    problems++;
  }
}

// ---- Edit 1: AppDbContext finds the POS table settings ----
edit("backend/Data/AppDbContext.cs", "added the ApplyConfigurationsFromAssembly line", (src) => {
  if (src.includes("ApplyConfigurationsFromAssembly")) return null;

  const match = /protected override void OnModelCreating\(ModelBuilder modelBuilder\)\s*\{/.exec(src);
  if (!match) throw new Error("could not find the OnModelCreating method");

  const eol = src.includes("\r\n") ? "\r\n" : "\n";
  const at = match.index + match[0].length;
  const line = "        modelBuilder.ApplyConfigurationsFromAssembly(typeof(AppDbContext).Assembly);";
  return src.slice(0, at) + eol + line + eol + src.slice(at);
});

// ---- Edit 2: api.ts exports its request function ----
edit("frontend/lib/api.ts", 'put "export" in front of the request function', (src) => {
  if (/export\s+async\s+function\s+request\s*</.test(src)) return null;
  if (!/(^|\n)async function request\s*</.test(src)) throw new Error("could not find the request function");

  return src.replace(/(^|\n)async function request\s*</, (_match, start) => `${start}export async function request<`);
});

// ---- Edit 3: POS and Sales in the sidebar ----
edit("frontend/components/AppShell.tsx", "added the POS and Sales menu items", (src) => {
  const eol = src.includes("\r\n") ? "\r\n" : "\n";
  const lines = (text) => text.replace(/\n/g, eol);

  const posItem = lines(`{
    label: "POS",
    href: "/pos",
    adminOnly: false,
    isActive: (p: string) => p === "/pos",
    icon: (
      <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M3 3h2l.4 2M7 13h10l3-8H5.4M7 13L5.4 5M7 13l-2 4h13M9 20a1 1 0 100-2 1 1 0 000 2zm8 0a1 1 0 100-2 1 1 0 000 2z" />
      </svg>
    ),
  },
  `);

  const salesItem = lines(`{
    label: "Sales",
    href: "/sales",
    adminOnly: false,
    isActive: (p: string) => p === "/sales" || /^\\/sales\\/\\d+$/.test(p),
    icon: (
      <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M6 2h12v20l-3-2-3 2-3-2-3 2V2zM9 7h6M9 11h6" />
      </svg>
    ),
  },
  `);

  // Puts `item` in front of the menu object whose label is `label`
  const insertBefore = (text, label, item) => {
    const at = text.indexOf(`label: "${label}"`);
    if (at < 0) throw new Error(`could not find the "${label}" menu item`);
    const open = text.lastIndexOf("{", at);
    return text.slice(0, open) + item + text.slice(open);
  };

  let result = src;
  let changed = false;

  if (!result.includes('href: "/pos"')) {
    result = insertBefore(result, "Products", posItem);
    changed = true;
  }
  if (!result.includes('href: "/sales"')) {
    result = insertBefore(result, "Activity", salesItem);
    changed = true;
  }

  return changed ? result : null;
});

console.log("");
if (problems > 0) {
  console.log(`${problems} problem(s). Fix them, then run this script again.`);
  process.exit(1);
}
console.log("All three edits are in place. Next: cd backend, then: dotnet ef migrations add AddSales (only if you have not yet), then: dotnet ef database update");
