# Use the product_crud database, and run the app without errors

Do the steps IN ORDER. Run every command from the project root unless it says `cd backend` or `cd frontend`.
After any step, `bash scripts/doctor.sh` tells you what is still wrong.

## 0. Stop everything
Press Ctrl+C in every terminal that runs `dotnet run` or `npm run dev`. Start MySQL in the XAMPP Control Panel.

## 1. Put the three POS edits in (automatic)
```bash
node scripts/fix-pos-edits.mjs
```
It prints `DONE` or `OK` for each of the three files. It is safe to run again.

## 2. Check that your migrations are complete
```bash
cd backend
dotnet ef migrations list
dotnet ef migrations has-pending-model-changes
```
- You should see InitialCreate, AddPasswordReset, AddInquiryNotifications and AddSales (some may say "Pending", that is fine for now).
- If the second command says "Changes have been made to the model", create the missing migration:
  `dotnet ef migrations add SyncModel`  (a migration for the POS is `AddSales`)
- Go back: `cd ..`

## 3. Back up, then get a clean product_crud
Your old data stays safe in `product_crud_old`.

1. phpMyAdmin: click `product_crud` -> **Export** -> Quick -> **Export**. Keep the downloaded .sql file.
2. Click `product_crud` -> **Operations** tab -> "Rename database to": `product_crud_old` -> **Go**.
   (If phpMyAdmin refuses, skip this step. Instead, after the export, use Operations -> "Remove database", and
   later import your .sql file into a database called `product_crud_old`.)
3. Click **New** -> database name `product_crud`, collation `utf8mb4_unicode_ci` -> **Create**. It stays EMPTY.

## 4. Point the app at product_crud
Copy the `backend/appsettings.json` from this zip over yours (it says `Database=product_crud`).
Then make sure nothing overrides it:
```bash
cd backend
dotnet user-secrets list
```
If you see a `ConnectionStrings:DefaultConnection` line with another database name, remove it:
```bash
dotnet user-secrets remove "ConnectionStrings:DefaultConnection"
```

## 5. Build all tables
```bash
dotnet ef database update
cd ..
```
Done when it ends with "Done." In phpMyAdmin the new `product_crud` now has Users, Products, Categories,
AuditLogs, Inquiries, PasswordResetTokens, Sales, SaleItems and __EFMigrationsHistory.

## 6. (Optional) bring your old data over
Only if you want your old users, products, categories and messages back.
phpMyAdmin: click `product_crud` -> **SQL** tab -> paste the whole of `scripts/copy-old-data.sql` -> **Go**.
Check the table at the end: old_rows and new_rows must match in every row.
Your uploaded pictures are still in `backend/uploads`, so they show up again. Accounts keep their passwords.

## 7. Check, then run
```bash
bash scripts/doctor.sh
```
When it says "no problems found", open two terminals:
```bash
cd backend && dotnet run          # terminal 1: wait for "Now listening on: http://localhost:5080"
cd frontend && npm run dev        # terminal 2: wait for "Local: http://localhost:3000"
```
Open http://localhost:3000. If you did NOT do step 6, register: the first account becomes the Admin.

## 8. Run the tests (from the project root)
```bash
dotnet test tests/ProductApi.Tests
```
All of them should pass.

## If something is still wrong
Run `bash scripts/doctor.sh` and paste everything it prints. If the backend itself crashes, also paste the first
lines of the red error in the backend terminal.
