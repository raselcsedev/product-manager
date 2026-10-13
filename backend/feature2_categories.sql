-- Run ONCE in phpMyAdmin: select the product_crud database -> SQL tab -> paste -> Go
-- Run it BEFORE starting the new backend.

CREATE TABLE Categories (
  Id INT NOT NULL AUTO_INCREMENT,
  Name VARCHAR(50) NOT NULL,
  PRIMARY KEY (Id),
  UNIQUE KEY IX_Categories_Name (Name)
);

-- A product may have no category (CategoryId is NULL).
-- If a category is deleted, its products are kept and their CategoryId becomes NULL.
ALTER TABLE Products
  ADD COLUMN CategoryId INT NULL,
  ADD CONSTRAINT FK_Products_Categories FOREIGN KEY (CategoryId)
      REFERENCES Categories (Id) ON DELETE SET NULL;

-- Optional starter categories
INSERT INTO Categories (Name) VALUES ('Electronics'), ('Accessories'), ('Office'), ('Other');
