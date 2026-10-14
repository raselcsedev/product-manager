-- Run ONCE in phpMyAdmin: select the product_crud database -> SQL tab -> paste -> Go
-- Run it BEFORE starting the new backend.
-- utf8mb4 so product names in any language (for example Bangla) are stored correctly in the log.

CREATE TABLE AuditLogs (
  Id INT NOT NULL AUTO_INCREMENT,
  UserId INT NOT NULL,
  ActorName VARCHAR(100) NOT NULL,
  Action VARCHAR(20) NOT NULL,
  EntityType VARCHAR(20) NOT NULL,
  EntityId INT NULL,
  EntityName VARCHAR(150) NOT NULL,
  Details VARCHAR(1000) NULL,
  CreatedAt DATETIME(6) NOT NULL,
  PRIMARY KEY (Id),
  KEY IX_AuditLogs_UserId_CreatedAt (UserId, CreatedAt),
  KEY IX_AuditLogs_CreatedAt (CreatedAt)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
