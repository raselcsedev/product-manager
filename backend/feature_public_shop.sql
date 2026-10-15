-- Run ONCE in phpMyAdmin: select the product_crud database -> SQL tab -> paste -> Go
-- Run it BEFORE starting the new backend.
-- Every existing product starts as PRIVATE (0). Owners choose what to publish.

ALTER TABLE Products ADD COLUMN IsPublished TINYINT(1) NOT NULL DEFAULT 0;

CREATE INDEX IX_Products_IsPublished ON Products (IsPublished, Id);
