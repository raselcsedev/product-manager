# Database migrations

A **migration** is one small, named, versioned database change ("add the Inquiries table", "add a column").
EF Core writes them for you by comparing your C# model with the last migration, and it remembers which ones a
database already has (in a table called `__EFMigrationsHistory`).

Why bother, compared with the SQL files we ran by hand?
- A new computer, a test database or the Docker server builds its whole database in one command.
- Updating a database is safe: only the migrations it is missing are applied, once each.
- The history lives in Git next to the code that needs it, so code and database never drift apart.

You need `dotnet-ef` (`dotnet tool install --global dotnet-ef`, done earlier) and MySQL running.
**Stop `dotnet run` first** (it locks the build). Run every command from the `backend` folder.

---

## One-time setup

The migrations folder starts empty. Create the first migration (it describes ALL tables as they are today).
Choose ONE of the two paths.

### Path A: a fresh database (recommended while you are learning)
Your old test data stays in the old database, and you start clean.

1. In phpMyAdmin create an **empty** database called `product_crud_v2` (collation `utf8mb4_unicode_ci`).
   (It must exist, because the tools connect to it to find the MySQL version.)
2. In `appsettings.json` change `Database=product_crud` to `Database=product_crud_v2`.
3. In `backend/`:
   ```bash
   dotnet ef migrations add InitialCreate
   dotnet ef database update
   ```
4. Run the app. Register again: the first account becomes the Admin.

`dotnet ef database update` builds every table with the right keys and indexes.

### Path B: keep the database you have now
Only if you really need the data. The database already has the tables, so we must tell EF
"InitialCreate is already applied" instead of running it.

1. In `backend/`:
   ```bash
   dotnet ef migrations add InitialCreate
   ```
   Look in `backend/Migrations/`. The file is named like `20261021093015_InitialCreate.cs`.
   The part before `_InitialCreate` is the **migration id**. The EF version is shown by `dotnet ef --version`.
2. In phpMyAdmin run this (use YOUR id and version):
   ```sql
   CREATE TABLE IF NOT EXISTS __EFMigrationsHistory (
     MigrationId VARCHAR(150) NOT NULL,
     ProductVersion VARCHAR(32) NOT NULL,
     PRIMARY KEY (MigrationId)
   );
   INSERT INTO __EFMigrationsHistory (MigrationId, ProductVersion)
   VALUES ('20261021093015_InitialCreate', '10.0.12');
   ```
3. Check: `dotnet ef database update` should finish at once without changing anything.

Caution: your hand-made tables may differ in small ways (index or key names) from what EF would have made.
Later migrations that rename or drop such an index could fail. If that happens, Path A is the clean fix.

Commit the new `backend/Migrations/` folder to Git. It is part of your source code.

---

## Every time you change the model
Added a property to a class in `Models/`? A new table? Then:

```bash
dotnet ef migrations add AddShopBanner      # a short name that says what changed
```
1. **Open the generated file** in `backend/Migrations/` and read it. It should only contain what you meant to change.
2. Apply it to your database: `dotnet ef database update`
3. Run the tests. The migration tests tell you if you forgot step 1.

Handy commands:
```bash
dotnet ef migrations list                   # which migrations exist, and which are applied
dotnet ef migrations remove                 # delete the LAST migration (only if it was never applied anywhere)
dotnet ef database update PreviousName      # go back to an earlier migration (can drop data!)
dotnet ef migrations script --idempotent -o update.sql   # all changes as SQL that is safe to run twice
```

## Rules that save you pain
- **Never edit or delete a migration that has been applied** to a database someone else uses. Add a new one.
- **Always read a migration before applying it.** Dropping or renaming a column can lose data. Take a backup first.
- **One change per migration**, with a clear name.
- **Commit the migration together with the code** that needs it.

## Production
- **Docker:** `Database__AutoMigrate=true` is already set, so migrations are applied when the API starts.
- **Review first:** switch it off and run the script from `dotnet ef migrations script --idempotent`.
- With several copies of the API, apply migrations from ONE place (a script), not from every copy at startup.

## The old SQL files
The files like `step4_inquiries.sql` and `feature_public_shop.sql` were how we changed the database before migrations.
After you set up migrations you no longer run them. Keep them as history, or delete them.

## Common errors
| Message | Cause and fix |
|---|---|
| `Unknown database 'product_crud_v2'` | Create the empty database in phpMyAdmin first |
| `Build failed` / file is locked | Stop `dotnet run`, then try again |
| `Table '...' already exists` during `database update` | The database already has tables. Use Path B (baseline), or Path A (fresh database) |
| `No migrations were applied. The database is already up to date` | Good: nothing to do |
| A test says `The model changed but no migration was created` | Run `dotnet ef migrations add <Name>` |
