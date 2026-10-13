-- Run this once in phpMyAdmin: select the product_crud database -> SQL tab -> paste -> Go
CREATE TABLE Users (
  Id INT NOT NULL AUTO_INCREMENT,
  Name VARCHAR(100) NOT NULL,
  Email VARCHAR(255) NOT NULL,
  PasswordHash VARCHAR(255) NOT NULL,
  CreatedAt DATETIME(6) NOT NULL,
  PRIMARY KEY (Id),
  UNIQUE KEY IX_Users_Email (Email)
);
