-- Run ONCE in phpMyAdmin: select the product_crud database -> SQL tab -> paste -> Go
-- Run it BEFORE starting the new backend.

ALTER TABLE Products ADD COLUMN ImageFileName VARCHAR(100) NULL;
