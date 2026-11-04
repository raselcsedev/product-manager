-- =====================================================================================
-- Copies your OLD data (database product_crud_old) into the NEW, migrated product_crud.
--
-- Run it in phpMyAdmin: click the product_crud database -> "SQL" tab -> paste -> Go.
-- Run it ONCE, right after "dotnet ef database update" and BEFORE you start the app.
-- The new tables must still be empty.
--
-- If a statement says "Unknown column 'X'", your old table never got that column.
-- Delete X from BOTH lists of that statement and run it again.
-- =====================================================================================

SET FOREIGN_KEY_CHECKS = 0;

INSERT INTO product_crud.Users
  (Id, Name, Email, PasswordHash, Role, CreatedAt, ShopName, ShopSlug, ShopDescription)
SELECT
   Id, Name, Email, PasswordHash, Role, CreatedAt, ShopName, ShopSlug, ShopDescription
FROM product_crud_old.Users;

INSERT INTO product_crud.Categories
  (Id, Name, OwnerId)
SELECT
   Id, Name, OwnerId
FROM product_crud_old.Categories;

INSERT INTO product_crud.Products
  (Id, Name, Description, Price, Quantity, CategoryId, OwnerId, ImageFileName, IsPublished)
SELECT
   Id, Name, Description, Price, Quantity, CategoryId, OwnerId, ImageFileName, IsPublished
FROM product_crud_old.Products;

INSERT INTO product_crud.Inquiries
  (Id, OwnerId, ProductId, ProductName, SenderName, SenderEmail, Message, IsRead, CreatedAt)
SELECT
   Id, OwnerId, ProductId, ProductName, SenderName, SenderEmail, Message, IsRead, CreatedAt
FROM product_crud_old.Inquiries;

INSERT INTO product_crud.AuditLogs
  (Id, UserId, ActorName, Action, EntityType, EntityId, EntityName, Details, CreatedAt)
SELECT
   Id, UserId, ActorName, Action, EntityType, EntityId, EntityName, Details, CreatedAt
FROM product_crud_old.AuditLogs;

SET FOREIGN_KEY_CHECKS = 1;

-- Check: the numbers in each pair must match.
SELECT 'Users'      AS tbl, (SELECT COUNT(*) FROM product_crud_old.Users)      AS old_rows, (SELECT COUNT(*) FROM product_crud.Users)      AS new_rows
UNION ALL SELECT 'Categories', (SELECT COUNT(*) FROM product_crud_old.Categories), (SELECT COUNT(*) FROM product_crud.Categories)
UNION ALL SELECT 'Products',   (SELECT COUNT(*) FROM product_crud_old.Products),   (SELECT COUNT(*) FROM product_crud.Products)
UNION ALL SELECT 'Inquiries',  (SELECT COUNT(*) FROM product_crud_old.Inquiries),  (SELECT COUNT(*) FROM product_crud.Inquiries)
UNION ALL SELECT 'AuditLogs',  (SELECT COUNT(*) FROM product_crud_old.AuditLogs),  (SELECT COUNT(*) FROM product_crud.AuditLogs);
