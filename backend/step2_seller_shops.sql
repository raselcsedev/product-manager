-- Run ONCE in phpMyAdmin: select the product_crud database -> SQL tab -> paste -> Go
-- Run it BEFORE starting the new backend.
-- Nobody has a shop page until they set one up themselves (all three columns start empty).
-- utf8mb4 on the text columns, so shop names in any language (for example Bangla) are stored correctly.

ALTER TABLE Users
  ADD COLUMN ShopName VARCHAR(60) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL,
  ADD COLUMN ShopSlug VARCHAR(40) NULL,
  ADD COLUMN ShopDescription VARCHAR(300) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL,
  ADD UNIQUE KEY IX_Users_ShopSlug (ShopSlug);
