-- Run ONCE in phpMyAdmin: select the product_crud database -> SQL tab -> paste -> Go
-- Run it BEFORE starting the new backend.

ALTER TABLE Users ADD COLUMN Role VARCHAR(20) NOT NULL DEFAULT 'User';

-- Make the first account (lowest Id) the Admin.
UPDATE Users SET Role = 'Admin' ORDER BY Id LIMIT 1;
