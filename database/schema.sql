-- MySQL dump 10.13  Distrib 8.0.46, for Win64 (x86_64)
--
-- Host: localhost    Database: auto_care_db
-- ------------------------------------------------------
-- Server version	8.0.46

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Current Database: `auto_care_db`
--

CREATE DATABASE /*!32312 IF NOT EXISTS*/ `auto_care_db` /*!40100 DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci */ /*!80016 DEFAULT ENCRYPTION='N' */;

USE `auto_care_db`;

--
-- Table structure for table `appointment`
--

DROP TABLE IF EXISTS `appointment`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `appointment` (
  `appointmentId` varchar(50) NOT NULL,
  `customerId` varchar(50) NOT NULL,
  `vehicleId` varchar(50) DEFAULT NULL,
  `appointmentDate` datetime NOT NULL,
  `timeSlot` varchar(50) DEFAULT NULL,
  `status` varchar(20) DEFAULT 'PENDING',
  `notes` text,
  PRIMARY KEY (`appointmentId`),
  KEY `customerId` (`customerId`),
  KEY `appointment_ibfk_2` (`vehicleId`),
  CONSTRAINT `appointment_ibfk_1` FOREIGN KEY (`customerId`) REFERENCES `customer` (`customerId`) ON DELETE CASCADE,
  CONSTRAINT `appointment_ibfk_2` FOREIGN KEY (`vehicleId`) REFERENCES `vehicle` (`vehicleId`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `audit_logs`
--

DROP TABLE IF EXISTS `audit_logs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `audit_logs` (
  `logId` int NOT NULL AUTO_INCREMENT,
  `action` varchar(255) NOT NULL,
  `performedBy` varchar(50) DEFAULT NULL,
  `userRole` varchar(50) DEFAULT NULL,
  `details` text,
  `timestamp` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`logId`)
) ENGINE=InnoDB AUTO_INCREMENT=35 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `custom_modification_request`
--

DROP TABLE IF EXISTS `custom_modification_request`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `custom_modification_request` (
  `modRequestId` varchar(50) NOT NULL,
  `jobCardId` varchar(50) NOT NULL,
  `requestNote` text NOT NULL,
  `status` varchar(20) DEFAULT 'PENDING',
  `createdDate` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`modRequestId`),
  KEY `jobCardId` (`jobCardId`),
  CONSTRAINT `custom_mod_ibfk_1` FOREIGN KEY (`jobCardId`) REFERENCES `job_card` (`jobCardId`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `customer`
--

DROP TABLE IF EXISTS `customer`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `customer` (
  `customerId` varchar(50) NOT NULL,
  `name` varchar(100) DEFAULT NULL,
  `nic` varchar(20) DEFAULT NULL,
  `email` varchar(100) DEFAULT NULL,
  `phone` varchar(20) DEFAULT NULL,
  `vehiclePassId` varchar(50) DEFAULT NULL,
  `themePreference` varchar(50) DEFAULT 'dark-gold',
  `fontSizePreference` varchar(20) DEFAULT 'medium',
  PRIMARY KEY (`customerId`),
  CONSTRAINT `customer_ibfk_1` FOREIGN KEY (`customerId`) REFERENCES `user` (`userId`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `feedback`
--

DROP TABLE IF EXISTS `feedback`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `feedback` (
  `feedbackId` varchar(50) NOT NULL,
  `rating` int DEFAULT NULL,
  `comment` text,
  `photoUrl` varchar(255) DEFAULT NULL,
  `createdDate` datetime DEFAULT CURRENT_TIMESTAMP,
  `customerId` varchar(50) DEFAULT NULL,
  `jobCardId` varchar(50) DEFAULT NULL,
  PRIMARY KEY (`feedbackId`),
  KEY `customerId` (`customerId`),
  KEY `jobCardId` (`jobCardId`),
  CONSTRAINT `feedback_ibfk_1` FOREIGN KEY (`customerId`) REFERENCES `customer` (`customerId`) ON DELETE CASCADE,
  CONSTRAINT `feedback_ibfk_2` FOREIGN KEY (`jobCardId`) REFERENCES `job_card` (`jobCardId`) ON DELETE CASCADE,
  CONSTRAINT `feedback_chk_1` CHECK ((`rating` between 1 and 5))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `inventory_item`
--

DROP TABLE IF EXISTS `inventory_item`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `inventory_item` (
  `itemId` varchar(50) NOT NULL,
  `itemName` varchar(100) NOT NULL,
  `unitPrice` decimal(10,2) NOT NULL,
  `quantityInStock` int NOT NULL DEFAULT '0',
  `reorderLevel` int DEFAULT '10',
  `isActive` tinyint(1) NOT NULL DEFAULT '1',
  PRIMARY KEY (`itemId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_unicode_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'IGNORE_SPACE,ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50003 TRIGGER `inventory_history_after_insert` AFTER INSERT ON `inventory_item` FOR EACH ROW BEGIN
  INSERT INTO inventory_stock_history
    (itemId, itemName, quantityInStock, reorderLevel, unitPrice, isActive, changeType)
  VALUES (NEW.itemId, NEW.itemName, NEW.quantityInStock, NEW.reorderLevel, NEW.unitPrice, NEW.isActive, 'ADDED');
END */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_unicode_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'IGNORE_SPACE,ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50003 TRIGGER `inventory_history_after_update` AFTER UPDATE ON `inventory_item` FOR EACH ROW BEGIN
  IF NOT (OLD.itemName <=> NEW.itemName AND OLD.quantityInStock <=> NEW.quantityInStock
    AND OLD.reorderLevel <=> NEW.reorderLevel AND OLD.unitPrice <=> NEW.unitPrice
    AND OLD.isActive <=> NEW.isActive) THEN
    INSERT INTO inventory_stock_history
      (itemId, itemName, quantityInStock, reorderLevel, unitPrice, isActive, changeType)
    VALUES (NEW.itemId, NEW.itemName, NEW.quantityInStock, NEW.reorderLevel, NEW.unitPrice, NEW.isActive, 'UPDATED');
  END IF;
END */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;

--
-- Table structure for table `inventory_stock_history`
--

DROP TABLE IF EXISTS `inventory_stock_history`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `inventory_stock_history` (
  `historyId` bigint NOT NULL AUTO_INCREMENT,
  `itemId` varchar(50) NOT NULL,
  `itemName` varchar(100) NOT NULL,
  `quantityInStock` int NOT NULL,
  `reorderLevel` int NOT NULL,
  `unitPrice` decimal(10,2) NOT NULL,
  `isActive` tinyint(1) NOT NULL,
  `recordedAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `changeType` varchar(20) NOT NULL,
  PRIMARY KEY (`historyId`),
  KEY `idx_inventory_history_item_date` (`itemId`,`recordedAt`,`historyId`),
  KEY `idx_inventory_history_date` (`recordedAt`)
) ENGINE=InnoDB AUTO_INCREMENT=12 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `invoice`
--

DROP TABLE IF EXISTS `invoice`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `invoice` (
  `invoiceId` varchar(50) NOT NULL,
  `issueDate` datetime DEFAULT CURRENT_TIMESTAMP,
  `netAmount` decimal(10,2) NOT NULL,
  `laborCharge` decimal(10,2) DEFAULT '0.00',
  `workshopFee` decimal(10,2) DEFAULT '0.00',
  `taxAmount` decimal(10,2) DEFAULT '0.00',
  `grandTotal` decimal(10,2) NOT NULL,
  `paymentStatus` varchar(50) DEFAULT 'Unpaid',
  `jobCardId` varchar(50) DEFAULT NULL,
  `officeUserId` varchar(50) DEFAULT NULL,
  PRIMARY KEY (`invoiceId`),
  KEY `jobCardId` (`jobCardId`),
  KEY `officeUserId` (`officeUserId`),
  CONSTRAINT `invoice_ibfk_1` FOREIGN KEY (`jobCardId`) REFERENCES `job_card` (`jobCardId`) ON DELETE CASCADE,
  CONSTRAINT `invoice_ibfk_2` FOREIGN KEY (`officeUserId`) REFERENCES `office_management` (`officeUserId`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `invoice_charge`
--

DROP TABLE IF EXISTS `invoice_charge`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `invoice_charge` (
  `chargeId` bigint unsigned NOT NULL AUTO_INCREMENT,
  `jobCardId` varchar(50) NOT NULL,
  `chargeType` varchar(30) NOT NULL,
  `description` varchar(255) NOT NULL,
  `amount` decimal(10,2) NOT NULL,
  PRIMARY KEY (`chargeId`),
  KEY `invoice_charge_job_idx` (`jobCardId`),
  CONSTRAINT `invoice_charge_job_fk` FOREIGN KEY (`jobCardId`) REFERENCES `job_card` (`jobCardId`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `job_card`
--

DROP TABLE IF EXISTS `job_card`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `job_card` (
  `jobCardId` varchar(50) NOT NULL,
  `vehicleId` varchar(50) DEFAULT NULL,
  `createdDate` datetime DEFAULT CURRENT_TIMESTAMP,
  `status` varchar(50) DEFAULT 'Created',
  `pauseReason` text,
  `totalAmount` decimal(10,2) DEFAULT '0.00',
  `requestId` varchar(50) DEFAULT NULL,
  `advisorId` varchar(50) DEFAULT NULL,
  `technicianId` varchar(50) DEFAULT NULL,
  `stageName` varchar(50) DEFAULT 'Stage 1',
  `instructionComment` text,
  PRIMARY KEY (`jobCardId`),
  KEY `requestId` (`requestId`),
  KEY `advisorId` (`advisorId`),
  KEY `technicianId` (`technicianId`),
  KEY `job_card_ibfk_4` (`vehicleId`),
  CONSTRAINT `job_card_ibfk_1` FOREIGN KEY (`requestId`) REFERENCES `service_request` (`requestId`) ON DELETE SET NULL,
  CONSTRAINT `job_card_ibfk_2` FOREIGN KEY (`advisorId`) REFERENCES `service_advisor` (`advisorId`) ON DELETE SET NULL,
  CONSTRAINT `job_card_ibfk_3` FOREIGN KEY (`technicianId`) REFERENCES `technician` (`technicianId`) ON DELETE SET NULL,
  CONSTRAINT `job_card_ibfk_4` FOREIGN KEY (`vehicleId`) REFERENCES `vehicle` (`vehicleId`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `job_item`
--

DROP TABLE IF EXISTS `job_item`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `job_item` (
  `jobCardId` varchar(50) NOT NULL,
  `itemId` varchar(50) NOT NULL,
  `quantityUsed` int NOT NULL,
  `pricePerUnit` decimal(10,2) NOT NULL,
  PRIMARY KEY (`jobCardId`,`itemId`),
  KEY `itemId` (`itemId`),
  CONSTRAINT `job_item_ibfk_1` FOREIGN KEY (`jobCardId`) REFERENCES `job_card` (`jobCardId`) ON DELETE CASCADE,
  CONSTRAINT `job_item_ibfk_2` FOREIGN KEY (`itemId`) REFERENCES `inventory_item` (`itemId`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `job_time_log`
--

DROP TABLE IF EXISTS `job_time_log`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `job_time_log` (
  `logId` int NOT NULL AUTO_INCREMENT,
  `jobCardId` varchar(50) NOT NULL,
  `technicianId` varchar(50) NOT NULL,
  `startTime` datetime DEFAULT NULL,
  `endTime` datetime DEFAULT NULL,
  `durationMinutes` int DEFAULT '0',
  `status` varchar(20) DEFAULT 'RUNNING',
  `rejectReason` text,
  PRIMARY KEY (`logId`),
  KEY `fk_log_job` (`jobCardId`),
  KEY `fk_log_tech` (`technicianId`),
  CONSTRAINT `fk_log_job` FOREIGN KEY (`jobCardId`) REFERENCES `job_card` (`jobCardId`) ON DELETE CASCADE,
  CONSTRAINT `fk_log_tech` FOREIGN KEY (`technicianId`) REFERENCES `technician` (`technicianId`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=19 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `manager`
--

DROP TABLE IF EXISTS `manager`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `manager` (
  `managerId` varchar(50) NOT NULL,
  `managerRoleType` varchar(100) DEFAULT NULL,
  PRIMARY KEY (`managerId`),
  CONSTRAINT `manager_ibfk_1` FOREIGN KEY (`managerId`) REFERENCES `user` (`userId`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `notification`
--

DROP TABLE IF EXISTS `notification`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `notification` (
  `notificationId` varchar(50) NOT NULL,
  `customerId` varchar(50) NOT NULL,
  `title` varchar(100) NOT NULL,
  `message` text NOT NULL,
  `isRead` tinyint(1) DEFAULT '0',
  `createdDate` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`notificationId`),
  KEY `customerId` (`customerId`),
  CONSTRAINT `notification_ibfk_1` FOREIGN KEY (`customerId`) REFERENCES `customer` (`customerId`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `office_management`
--

DROP TABLE IF EXISTS `office_management`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `office_management` (
  `officeUserId` varchar(50) NOT NULL,
  `designation` varchar(100) DEFAULT NULL,
  PRIMARY KEY (`officeUserId`),
  CONSTRAINT `office_management_ibfk_1` FOREIGN KEY (`officeUserId`) REFERENCES `user` (`userId`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `payment`
--

DROP TABLE IF EXISTS `payment`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `payment` (
  `paymentId` varchar(50) NOT NULL,
  `paymentDate` datetime DEFAULT CURRENT_TIMESTAMP,
  `amount` decimal(10,2) NOT NULL,
  `paymentMethod` varchar(50) NOT NULL,
  `invoiceId` varchar(50) DEFAULT NULL,
  PRIMARY KEY (`paymentId`),
  KEY `invoiceId` (`invoiceId`),
  CONSTRAINT `payment_ibfk_1` FOREIGN KEY (`invoiceId`) REFERENCES `invoice` (`invoiceId`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `purchase_order_items`
--

DROP TABLE IF EXISTS `purchase_order_items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `purchase_order_items` (
  `poItemId` int NOT NULL AUTO_INCREMENT,
  `poId` int NOT NULL,
  `itemId` varchar(50) DEFAULT NULL,
  `itemName` varchar(100) NOT NULL,
  `quantity` int NOT NULL,
  `unitPrice` decimal(10,2) NOT NULL DEFAULT '0.00',
  PRIMARY KEY (`poItemId`),
  KEY `poId` (`poId`),
  KEY `itemId` (`itemId`),
  CONSTRAINT `poi_ibfk_1` FOREIGN KEY (`poId`) REFERENCES `purchase_orders` (`poId`) ON DELETE CASCADE,
  CONSTRAINT `poi_ibfk_2` FOREIGN KEY (`itemId`) REFERENCES `inventory_item` (`itemId`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `purchase_orders`
--

DROP TABLE IF EXISTS `purchase_orders`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `purchase_orders` (
  `poId` int NOT NULL AUTO_INCREMENT,
  `supplierId` int NOT NULL,
  `officeUserId` varchar(50) DEFAULT NULL,
  `orderDate` datetime DEFAULT CURRENT_TIMESTAMP,
  `estimatedDeliveryDate` date DEFAULT NULL,
  `status` varchar(30) DEFAULT 'PENDING',
  `rejectionReason` text,
  `paymentStatus` varchar(30) DEFAULT 'PENDING',
  `totalAmount` decimal(10,2) DEFAULT '0.00',
  PRIMARY KEY (`poId`),
  KEY `supplierId` (`supplierId`),
  KEY `officeUserId` (`officeUserId`),
  CONSTRAINT `po_ibfk_1` FOREIGN KEY (`supplierId`) REFERENCES `suppliers` (`supplierId`) ON DELETE CASCADE,
  CONSTRAINT `po_ibfk_2` FOREIGN KEY (`officeUserId`) REFERENCES `office_management` (`officeUserId`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `quotations`
--

DROP TABLE IF EXISTS `quotations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `quotations` (
  `quotationId` int NOT NULL AUTO_INCREMENT,
  `supplierId` int NOT NULL,
  `requestDetails` text NOT NULL,
  `quotedAmount` decimal(10,2) NOT NULL,
  `status` varchar(20) DEFAULT 'PENDING',
  `submittedDate` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`quotationId`),
  KEY `supplierId` (`supplierId`),
  CONSTRAINT `quote_ibfk_1` FOREIGN KEY (`supplierId`) REFERENCES `suppliers` (`supplierId`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `salary_advance`
--

DROP TABLE IF EXISTS `salary_advance`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `salary_advance` (
  `advanceId` int NOT NULL AUTO_INCREMENT,
  `technicianId` varchar(50) NOT NULL,
  `amount` decimal(10,2) NOT NULL,
  `reason` text NOT NULL,
  `status` varchar(20) DEFAULT 'PENDING',
  `requestedDate` datetime DEFAULT CURRENT_TIMESTAMP,
  `monthlyBaseSalary` decimal(10,2) DEFAULT '75000.00',
  `rejectionReason` text,
  PRIMARY KEY (`advanceId`),
  KEY `fk_adv_tech` (`technicianId`),
  CONSTRAINT `fk_adv_tech` FOREIGN KEY (`technicianId`) REFERENCES `technician` (`technicianId`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=9 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `service_advisor`
--

DROP TABLE IF EXISTS `service_advisor`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `service_advisor` (
  `advisorId` varchar(50) NOT NULL,
  `workshopSection` varchar(100) DEFAULT NULL,
  PRIMARY KEY (`advisorId`),
  CONSTRAINT `service_advisor_ibfk_1` FOREIGN KEY (`advisorId`) REFERENCES `user` (`userId`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `service_request`
--

DROP TABLE IF EXISTS `service_request`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `service_request` (
  `requestId` varchar(50) NOT NULL,
  `requestDate` datetime DEFAULT CURRENT_TIMESTAMP,
  `status` varchar(50) DEFAULT 'Pending',
  `description` text,
  `customerId` varchar(50) DEFAULT NULL,
  `vehicleId` varchar(50) DEFAULT NULL,
  `fuelLevel` varchar(20) DEFAULT NULL,
  `mileage` int DEFAULT NULL,
  `damagedParts` text,
  `repairRequirements` text,
  `isCustomModification` tinyint(1) DEFAULT '0',
  `modApprovalStatus` varchar(20) DEFAULT 'PENDING',
  `qualityCheckStatus` varchar(20) DEFAULT 'NOT_CHECKED',
  `qualityRemarks` text,
  PRIMARY KEY (`requestId`),
  KEY `customerId` (`customerId`),
  KEY `vehicleId` (`vehicleId`),
  CONSTRAINT `service_request_ibfk_1` FOREIGN KEY (`customerId`) REFERENCES `customer` (`customerId`) ON DELETE CASCADE,
  CONSTRAINT `service_request_ibfk_2` FOREIGN KEY (`vehicleId`) REFERENCES `vehicle` (`vehicleId`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `supplier_notifications`
--

DROP TABLE IF EXISTS `supplier_notifications`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `supplier_notifications` (
  `notificationId` int NOT NULL AUTO_INCREMENT,
  `supplierId` int NOT NULL,
  `title` varchar(100) NOT NULL,
  `message` text NOT NULL,
  `isRead` tinyint(1) DEFAULT '0',
  `createdDate` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`notificationId`),
  KEY `supplierId` (`supplierId`),
  CONSTRAINT `sup_notif_ibfk_1` FOREIGN KEY (`supplierId`) REFERENCES `suppliers` (`supplierId`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `suppliers`
--

DROP TABLE IF EXISTS `suppliers`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `suppliers` (
  `supplierId` int NOT NULL AUTO_INCREMENT,
  `supplierUserId` varchar(50) DEFAULT NULL,
  `supplierName` varchar(100) NOT NULL,
  `contactPerson` varchar(100) DEFAULT NULL,
  `phone` varchar(15) DEFAULT NULL,
  `email` varchar(100) DEFAULT NULL,
  `deliveryAddress` text,
  `category` varchar(50) DEFAULT NULL,
  `createdDate` datetime DEFAULT CURRENT_TIMESTAMP,
  `isActive` tinyint(1) NOT NULL DEFAULT '1',
  PRIMARY KEY (`supplierId`),
  KEY `fk_supplier_user` (`supplierUserId`),
  CONSTRAINT `fk_supplier_user` FOREIGN KEY (`supplierUserId`) REFERENCES `user` (`userId`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `system_log`
--

DROP TABLE IF EXISTS `system_log`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `system_log` (
  `logId` int NOT NULL AUTO_INCREMENT,
  `action` varchar(255) NOT NULL,
  `timestamp` datetime DEFAULT CURRENT_TIMESTAMP,
  `userId` varchar(50) DEFAULT NULL,
  PRIMARY KEY (`logId`),
  KEY `userId` (`userId`),
  CONSTRAINT `system_log_ibfk_1` FOREIGN KEY (`userId`) REFERENCES `user` (`userId`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `technician`
--

DROP TABLE IF EXISTS `technician`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `technician` (
  `technicianId` varchar(50) NOT NULL,
  `activeJobCount` int DEFAULT '0',
  `dailyWorkingHours` double DEFAULT '0',
  PRIMARY KEY (`technicianId`),
  CONSTRAINT `technician_ibfk_1` FOREIGN KEY (`technicianId`) REFERENCES `user` (`userId`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `user`
--

DROP TABLE IF EXISTS `user`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `user` (
  `userId` varchar(50) NOT NULL,
  `username` varchar(100) NOT NULL,
  `passwordHash` varchar(255) NOT NULL,
  `name` varchar(100) NOT NULL,
  `phone` varchar(20) DEFAULT NULL,
  `role` varchar(50) NOT NULL DEFAULT 'CUSTOMER',
  PRIMARY KEY (`userId`),
  UNIQUE KEY `username` (`username`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `vehicle`
--

DROP TABLE IF EXISTS `vehicle`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `vehicle` (
  `vehicleId` varchar(50) NOT NULL,
  `registrationNo` varchar(50) NOT NULL,
  `make` varchar(50) DEFAULT NULL,
  `model` varchar(50) DEFAULT NULL,
  `year` int DEFAULT NULL,
  `customerId` varchar(50) DEFAULT NULL,
  `registeredDate` datetime DEFAULT CURRENT_TIMESTAMP,
  `status` varchar(50) DEFAULT 'REGISTERED',
  `vehiclePassId` varchar(50) DEFAULT NULL,
  PRIMARY KEY (`vehicleId`),
  UNIQUE KEY `registrationNo` (`registrationNo`),
  UNIQUE KEY `uq_vehicle_pass_id` (`vehiclePassId`),
  KEY `customerId` (`customerId`),
  CONSTRAINT `vehicle_ibfk_1` FOREIGN KEY (`customerId`) REFERENCES `customer` (`customerId`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping events for database 'auto_care_db'
--

--
-- Dumping routines for database 'auto_care_db'
--
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-10-14 13:16:56
