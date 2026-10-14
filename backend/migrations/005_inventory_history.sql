CREATE TABLE IF NOT EXISTS inventory_stock_history (
  historyId BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  itemId VARCHAR(50) NOT NULL,
  itemName VARCHAR(100) NOT NULL,
  quantityInStock INT NOT NULL,
  reorderLevel INT NOT NULL,
  unitPrice DECIMAL(10,2) NOT NULL,
  isActive TINYINT(1) NOT NULL,
  recordedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  changeType VARCHAR(20) NOT NULL,
  INDEX idx_inventory_history_item_date (itemId, recordedAt, historyId),
  INDEX idx_inventory_history_date (recordedAt)
);

INSERT INTO inventory_stock_history
  (itemId, itemName, quantityInStock, reorderLevel, unitPrice, isActive, changeType)
SELECT i.itemId, i.itemName, i.quantityInStock, i.reorderLevel, i.unitPrice, i.isActive, 'BASELINE'
FROM inventory_item i
WHERE NOT EXISTS (SELECT 1 FROM inventory_stock_history h WHERE h.itemId = i.itemId);

DROP TRIGGER IF EXISTS inventory_history_after_insert;
DROP TRIGGER IF EXISTS inventory_history_after_update;

DELIMITER $$
CREATE TRIGGER inventory_history_after_insert AFTER INSERT ON inventory_item
FOR EACH ROW BEGIN
  INSERT INTO inventory_stock_history
    (itemId, itemName, quantityInStock, reorderLevel, unitPrice, isActive, changeType)
  VALUES (NEW.itemId, NEW.itemName, NEW.quantityInStock, NEW.reorderLevel, NEW.unitPrice, NEW.isActive, 'ADDED');
END$$

CREATE TRIGGER inventory_history_after_update AFTER UPDATE ON inventory_item
FOR EACH ROW BEGIN
  IF NOT (OLD.itemName <=> NEW.itemName AND OLD.quantityInStock <=> NEW.quantityInStock
    AND OLD.reorderLevel <=> NEW.reorderLevel AND OLD.unitPrice <=> NEW.unitPrice
    AND OLD.isActive <=> NEW.isActive) THEN
    INSERT INTO inventory_stock_history
      (itemId, itemName, quantityInStock, reorderLevel, unitPrice, isActive, changeType)
    VALUES (NEW.itemId, NEW.itemName, NEW.quantityInStock, NEW.reorderLevel, NEW.unitPrice, NEW.isActive, 'UPDATED');
  END IF;
END$$
DELIMITER ;
