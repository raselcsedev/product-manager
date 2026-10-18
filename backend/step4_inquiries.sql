-- Run ONCE in phpMyAdmin: select the product_crud database -> SQL tab -> paste -> Go
-- Run it BEFORE starting the new backend.
-- utf8mb4 so messages in any language (for example Bangla) are stored correctly.

CREATE TABLE Inquiries (
  Id INT NOT NULL AUTO_INCREMENT,
  OwnerId INT NOT NULL,                 -- the seller who receives the message
  ProductId INT NULL,                   -- the product it was about (NULL after that product is deleted)
  ProductName VARCHAR(100) NOT NULL,    -- a copy of the product name, so the message still makes sense later
  SenderName VARCHAR(100) NOT NULL,
  SenderEmail VARCHAR(255) NOT NULL,
  Message VARCHAR(2000) NOT NULL,
  IsRead TINYINT(1) NOT NULL DEFAULT 0,
  CreatedAt DATETIME(6) NOT NULL,
  PRIMARY KEY (Id),
  KEY IX_Inquiries_OwnerId_CreatedAt (OwnerId, CreatedAt),
  KEY IX_Inquiries_OwnerId_IsRead (OwnerId, IsRead),
  KEY IX_Inquiries_OwnerId_SenderEmail_CreatedAt (OwnerId, SenderEmail(100), CreatedAt),
  -- If the seller's account is deleted, their messages go with it
  CONSTRAINT FK_Inquiries_Users FOREIGN KEY (OwnerId) REFERENCES Users (Id) ON DELETE CASCADE,
  -- If the product is deleted, the message stays (only its product link is cleared)
  CONSTRAINT FK_Inquiries_Products FOREIGN KEY (ProductId) REFERENCES Products (Id) ON DELETE SET NULL
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
