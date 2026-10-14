ALTER TABLE salary_advance
  ADD COLUMN rejectionReason TEXT NULL;

ALTER TABLE inventory_item
  ADD COLUMN isActive TINYINT(1) NOT NULL DEFAULT 1;
