#!/usr/bin/env bash
# Checks your setup and tells you what to fix.
# Run it from the project root (the folder with "backend" and "frontend"):
#
#     bash scripts/doctor.sh
#
# It changes nothing. Paste its output here if you need help.

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT" || exit 1

FAILED=0
WARNINGS=0
ok()   { echo "  [ OK ]  $*"; }
warn() { echo "  [WARN]  $*"; WARNINGS=$((WARNINGS + 1)); }
bad()  { echo "  [FAIL]  $*"; FAILED=$((FAILED + 1)); }
section() { echo ""; echo "== $* =="; }

port_open() { (exec 3<>"/dev/tcp/127.0.0.1/$1") 2>/dev/null; }

echo "Project folder: $ROOT"

# ---------------------------------------------------------------------------
section "1. Tools"
if command -v dotnet >/dev/null 2>&1; then
  version="$(dotnet --version 2>/dev/null)"
  major="${version%%.*}"
  if [ "${major:-0}" -ge 10 ] 2>/dev/null; then ok ".NET SDK $version"; else bad ".NET SDK is $version, but this project needs version 10 or newer"; fi
else
  bad ".NET SDK not found (install .NET 10 SDK)"
fi

if command -v dotnet >/dev/null 2>&1 && dotnet ef --version >/dev/null 2>&1; then
  ok "dotnet-ef tool installed"
else
  bad "dotnet-ef tool missing. Run: dotnet tool install --global dotnet-ef"
fi

if command -v node >/dev/null 2>&1; then
  nodeVersion="$(node --version | tr -d v)"
  nodeMajor="${nodeVersion%%.*}"
  if [ "${nodeMajor:-0}" -ge 18 ] 2>/dev/null; then ok "Node.js $nodeVersion"; else bad "Node.js is $nodeVersion. Version 18.17 or newer is needed"; fi
else
  bad "Node.js not found"
fi

# ---------------------------------------------------------------------------
section "2. Project files"
for folder in backend frontend tests; do
  [ -d "$folder" ] && ok "folder $folder" || bad "folder $folder is missing. Are you in the project root?"
done

if [ -d frontend ]; then
  if [ -d frontend/node_modules ]; then ok "frontend packages installed"; else warn "frontend packages missing. Run: cd frontend && npm install"; fi
fi

# ---------------------------------------------------------------------------
section "3. The three POS edits"
if [ -f backend/Data/AppDbContext.cs ]; then
  grep -q "ApplyConfigurationsFromAssembly" backend/Data/AppDbContext.cs \
    && ok "AppDbContext.cs has the ApplyConfigurationsFromAssembly line" \
    || bad "AppDbContext.cs misses the ApplyConfigurationsFromAssembly line. Run: node scripts/fix-pos-edits.mjs"
fi
if [ -f frontend/lib/api.ts ]; then
  grep -Eq "export[[:space:]]+async[[:space:]]+function[[:space:]]+request" frontend/lib/api.ts \
    && ok "api.ts exports request" \
    || bad "api.ts does not export request. Run: node scripts/fix-pos-edits.mjs"
fi
if [ -f frontend/components/AppShell.tsx ]; then
  grep -q 'href: "/pos"' frontend/components/AppShell.tsx \
    && ok "AppShell.tsx has the POS menu item" \
    || bad "AppShell.tsx has no POS menu item. Run: node scripts/fix-pos-edits.mjs"
  grep -q 'href: "/sales"' frontend/components/AppShell.tsx \
    && ok "AppShell.tsx has the Sales menu item" \
    || bad "AppShell.tsx has no Sales menu item. Run: node scripts/fix-pos-edits.mjs"
fi

# ---------------------------------------------------------------------------
section "4. Which database will the app use?"
fileDb=""
if [ -f backend/appsettings.json ]; then
  fileDb="$(grep -o 'Database=[^;"]*' backend/appsettings.json | head -1 | cut -d= -f2)"
  echo "         appsettings.json says: ${fileDb:-(not found)}"
fi

secretLine=""
if command -v dotnet >/dev/null 2>&1 && [ -d backend ]; then
  secretLine="$( (cd backend && dotnet user-secrets list 2>/dev/null) | grep -i 'DefaultConnection' | head -1 )"
fi
if [ -n "$secretLine" ]; then
  secretDb="$(echo "$secretLine" | grep -o 'Database=[^;]*' | head -1 | cut -d= -f2)"
  warn "user-secrets OVERRIDES appsettings.json: database '${secretDb:-?}'. This is the one the app really uses."
  echo "         (to remove it: cd backend && dotnet user-secrets remove \"ConnectionStrings:DefaultConnection\")"
  effectiveDb="$secretDb"
else
  effectiveDb="$fileDb"
fi
echo "         The app will use database: ${effectiveDb:-unknown}"

if [ -n "${ASPNETCORE_ENVIRONMENT:-}" ]; then
  if [ "$ASPNETCORE_ENVIRONMENT" = "Production" ]; then
    bad "The environment variable ASPNETCORE_ENVIRONMENT is 'Production' in this terminal. The server will refuse to start. Run: unset ASPNETCORE_ENVIRONMENT"
  else
    warn "ASPNETCORE_ENVIRONMENT is '$ASPNETCORE_ENVIRONMENT' in this terminal"
  fi
else
  ok "ASPNETCORE_ENVIRONMENT is not set (good for development)"
fi

# ---------------------------------------------------------------------------
section "5. MySQL"
if port_open 3306; then
  ok "something is listening on port 3306 (MySQL)"
else
  bad "nothing is listening on port 3306. Start MySQL in the XAMPP Control Panel"
fi

# ---------------------------------------------------------------------------
section "6. Database tables (migrations)"
if command -v dotnet >/dev/null 2>&1 && [ -d backend ] && port_open 3306; then
  echo "         (this takes a little while: it builds the backend)"
  list="$( (cd backend && dotnet ef migrations list 2>&1) )"
  if echo "$list" | grep -qi "Pending"; then
    bad "Some migrations are not applied to '${effectiveDb:-the database}'. Run: cd backend && dotnet ef database update"
    echo "$list" | grep -i "Pending" | sed 's/^/         /'
  elif echo "$list" | grep -qiE "Unable to connect|Unknown database|Access denied|error|fail"; then
    bad "Could not read the migrations. The last lines of the message:"
    echo "$list" | tail -8 | sed 's/^/         /'
  elif [ -z "$(echo "$list" | grep -E '^[0-9]{14}_')" ]; then
    bad "There are no migrations yet. Run: cd backend && dotnet ef migrations add InitialCreate"
  else
    ok "all migrations are applied to '${effectiveDb:-the database}'"
    echo "$list" | grep -E '^[0-9]{14}_' | sed 's/^/         /'
  fi

  pending="$( (cd backend && dotnet ef migrations has-pending-model-changes 2>&1) )"
  if echo "$pending" | grep -qi "Changes have been made"; then
    bad "Your C# models have changes that no migration contains. Run: cd backend && dotnet ef migrations add SyncModel   (then: dotnet ef database update)"
  elif echo "$pending" | grep -qi "No changes"; then
    ok "the migrations match your C# models"
  fi
else
  warn "skipped (needs the .NET SDK, the backend folder and MySQL running)"
fi

# ---------------------------------------------------------------------------
section "7. Are the app's ports free?"
if port_open 5080; then
  echo "  [info]  port 5080 is in use. If that is your backend already running, that is fine."
  curl -s --max-time 5 http://localhost:5080/health/ready 2>/dev/null | grep -q ready \
    && ok "the API answers on http://localhost:5080/health/ready" \
    || warn "port 5080 is in use but /health/ready did not say 'ready'. Is it an OLD copy of the backend? Stop it and start again"
else
  echo "  [info]  port 5080 is free (the backend is not running right now)"
fi
if port_open 3000; then
  echo "  [info]  port 3000 is in use (the website may already be running)"
else
  echo "  [info]  port 3000 is free (the website is not running right now)"
fi

# ---------------------------------------------------------------------------
echo ""
if [ "$FAILED" -eq 0 ]; then
  echo "RESULT: no problems found ($WARNINGS warning(s))."
  echo "Start the app in two terminals:"
  echo "   1)  cd backend && dotnet run"
  echo "   2)  cd frontend && npm run dev"
  echo "Then open http://localhost:3000"
else
  echo "RESULT: $FAILED problem(s) to fix. Fix the [FAIL] lines from the top, then run this again."
fi
exit "$FAILED"
