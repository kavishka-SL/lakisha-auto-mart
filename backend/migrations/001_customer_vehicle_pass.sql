-- Run once after importing new3.sql into auto_care_db.
-- The vehicle table keeps the pass for each vehicle. The customer table keeps
-- the most recently issued pass for that customer.
USE auto_care_db;

ALTER TABLE customer
  ADD COLUMN vehiclePassId varchar(50) DEFAULT NULL AFTER phone;

UPDATE customer c
JOIN vehicle v ON v.customerId = c.customerId
SET c.vehiclePassId = v.vehiclePassId
WHERE v.vehiclePassId IS NOT NULL;

ALTER TABLE vehicle
  ADD UNIQUE KEY uq_vehicle_pass_id (vehiclePassId);
