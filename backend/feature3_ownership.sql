-- Run ONCE in phpMyAdmin: select the product_crud database -> SQL tab -> paste -> Go
-- Run it BEFORE starting the new backend.
--
-- Existing products and categories are assigned to the user with the lowest Id
-- (normally your first account). Log in with that account to see them.

-- ---------- Products ----------
ALTER TABLE Products ADD COLUMN OwnerId INT NULL;
UPDATE Products SET OwnerId = (SELECT MIN(Id) FROM Users) WHERE OwnerId IS NULL;
ALTER TABLE Products MODIFY COLUMN OwnerId INT NOT NULL;
ALTER TABLE Products
  ADD CONSTRAINT FK_Products_Users FOREIGN KEY (OwnerId) REFERENCES Users (Id) ON DELETE CASCADE;

-- ---------- Categories ----------
-- Category names were unique across the whole table; now they are unique per user.
ALTER TABLE Categories DROP INDEX IX_Categories_Name;
ALTER TABLE Categories ADD COLUMN OwnerId INT NULL;
UPDATE Categories SET OwnerId = (SELECT MIN(Id) FROM Users) WHERE OwnerId IS NULL;
ALTER TABLE Categories MODIFY COLUMN OwnerId INT NOT NULL;
ALTER TABLE Categories
  ADD CONSTRAINT FK_Categories_Users FOREIGN KEY (OwnerId) REFERENCES Users (Id) ON DELETE CASCADE;
ALTER TABLE Categories ADD UNIQUE KEY IX_Categories_OwnerId_Name (OwnerId, Name);
