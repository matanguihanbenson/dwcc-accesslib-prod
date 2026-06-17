-- MySQL dump 10.13  Distrib 8.0.30, for Win64 (x86_64)
--
-- Host: localhost    Database: accesslib
-- ------------------------------------------------------
-- Server version	5.5.5-10.4.32-MariaDB

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
-- Table structure for table `auditlog`
--

DROP TABLE IF EXISTS `auditlog`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `auditlog` (
  `event_id` int(11) NOT NULL AUTO_INCREMENT,
  `action` varchar(50) NOT NULL,
  `description` text NOT NULL,
  `ip_address` varchar(45) DEFAULT NULL,
  `user_agent` text DEFAULT NULL,
  `date_time_log` datetime NOT NULL DEFAULT current_timestamp(),
  `role` enum('SUPER_ADMIN','ADMIN','STAFF','USER') NOT NULL,
  `user_account_id` int(11) NOT NULL,
  PRIMARY KEY (`event_id`),
  KEY `auditlog_user_account_id_idx` (`user_account_id`),
  KEY `auditlog_date_time_log_idx` (`date_time_log`),
  KEY `auditlog_role_idx` (`role`),
  KEY `auditlog_action_idx` (`action`),
  CONSTRAINT `auditlog_user_account_id_fkey` FOREIGN KEY (`user_account_id`) REFERENCES `user_account` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=192 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `auditlog`
--

LOCK TABLES `auditlog` WRITE;
/*!40000 ALTER TABLE `auditlog` DISABLE KEYS */;
INSERT INTO `auditlog` VALUES (1,'LOGIN','Successful login attempt for user admin','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36','2025-09-10 05:13:39','SUPER_ADMIN',1),(2,'LOGIN','Successful login','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36','2025-09-10 05:13:41','SUPER_ADMIN',1),(3,'LOGIN','Successful login attempt for user admin','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36','2025-09-10 05:21:19','SUPER_ADMIN',1),(4,'LOGIN','Successful login','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36','2025-09-10 05:21:28','SUPER_ADMIN',1),(5,'DEPARTMENT_CREATE','Created new department: \"School of Information and Technology\" (Code: SIT)','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36','2025-09-10 05:24:30','SUPER_ADMIN',1),(6,'PROGRAM_CREATE','Created new program: \"Bachelor of Science in Information Technology\" (Code: BSIT) in department \"School of Information and Technology\"','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36','2025-09-10 05:27:42','SUPER_ADMIN',1),(7,'CREATE_USER','Created library user: Cedrick Dimayuga (43434)',NULL,NULL,'2025-09-10 05:28:11','SUPER_ADMIN',1),(8,'CREATE_ADMIN_ACCOUNT','Created ADMIN account for Cedrick Dimayuga (43434)','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36','2025-09-10 05:28:45','SUPER_ADMIN',1),(9,'LOGOUT','User logged out',NULL,NULL,'2025-09-10 05:28:48','SUPER_ADMIN',1),(10,'LOGIN','Successful login attempt for user 43434','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36','2025-09-10 05:29:02','ADMIN',2),(11,'LOGIN','Successful login','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36','2025-09-10 05:29:04','ADMIN',2),(12,'LOGIN','Successful login attempt for user admin','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36','2025-09-10 06:34:41','SUPER_ADMIN',1),(13,'LOGIN','Successful login','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36','2025-09-10 06:34:47','SUPER_ADMIN',1),(14,'LOGOUT','User logged out',NULL,NULL,'2025-09-10 06:52:47','SUPER_ADMIN',1),(15,'LOGIN','Successful login attempt for user admin','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36','2025-09-10 06:53:52','SUPER_ADMIN',1),(16,'LOGIN','Successful login','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36','2025-09-10 06:53:55','SUPER_ADMIN',1),(17,'LOGOUT','User logged out',NULL,NULL,'2025-09-10 06:54:13','SUPER_ADMIN',1),(18,'LOGIN','Successful login attempt for user admin','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36','2025-09-10 06:54:40','SUPER_ADMIN',1),(19,'LOGIN','Successful login','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36','2025-09-10 06:54:41','SUPER_ADMIN',1),(20,'PASSWORD_RESET','Reset password for user: Cedrick Dimayuga (43434)','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36','2025-09-10 06:54:54','SUPER_ADMIN',1),(21,'LOGOUT','User logged out',NULL,NULL,'2025-09-10 06:54:58','SUPER_ADMIN',1),(22,'LOGIN','Successful login attempt for user 43434','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36','2025-09-10 06:56:44','ADMIN',2),(23,'LOGIN','Successful login','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36','2025-09-10 06:56:45','ADMIN',2),(24,'CREATE_BOOK','Created book: asdasd by asda',NULL,NULL,'2025-09-10 07:06:00','ADMIN',2),(25,'LOGIN','Successful login attempt for user admin','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36','2025-09-10 07:06:58','SUPER_ADMIN',1),(26,'LOGIN','Successful login','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36','2025-09-10 07:07:00','SUPER_ADMIN',1),(27,'CREATE_USER','Created library user: Emee (43555)',NULL,NULL,'2025-09-10 07:07:43','SUPER_ADMIN',1),(28,'CREATE_USER','Created library user: efgdg (454666)',NULL,NULL,'2025-09-10 07:25:43','SUPER_ADMIN',1),(29,'PROMOTE_TO_STAFF','Created STAFF account for Emee (43555)','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36','2025-09-10 07:27:03','ADMIN',2),(30,'USER_DEACTIVATE','Deactivated user: Emee (43555)','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36','2025-09-10 07:27:12','ADMIN',2),(31,'USER_ACTIVATE','Activated user: Emee (43555)','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36','2025-09-10 07:27:22','ADMIN',2),(32,'USER_DEACTIVATE','Deactivated user: Cedrick Dimayuga (43434)','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36','2025-09-10 07:27:36','SUPER_ADMIN',1),(33,'USER_ACTIVATE','Activated user: Cedrick Dimayuga (43434)','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36','2025-09-10 07:27:39','SUPER_ADMIN',1),(34,'LOGOUT','User logged out',NULL,NULL,'2025-09-10 07:28:56','SUPER_ADMIN',1),(35,'LOGIN','Successful login attempt for user 43555','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36','2025-09-10 07:29:20','STAFF',3),(36,'LOGIN','Successful login','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36','2025-09-10 07:29:22','STAFF',3),(37,'UPDATE_BOOK','Updated book: asdasd by asda',NULL,NULL,'2025-09-10 07:30:06','ADMIN',2),(38,'UPDATE_BOOK','Updated book: asdasd by asda',NULL,NULL,'2025-09-10 07:30:42','ADMIN',2),(39,'UPDATE_BOOK','Updated book: asdasd by asda',NULL,NULL,'2025-09-10 07:32:11','STAFF',3),(40,'BOOK_APPROVAL','Approved borrow request: \"asdasd\" for user Emee (43555)',NULL,NULL,'2025-09-10 07:38:40','ADMIN',2),(41,'RETURN_BOOK','Processed book return: asdasd from user ID 3',NULL,NULL,'2025-09-10 07:42:12','STAFF',3),(42,'BOOK_APPROVAL','Approved borrow request: \"asdasd\" for user Emee (43555)',NULL,NULL,'2025-09-10 08:07:16','ADMIN',2),(43,'RECORD_ENTRY','Recorded entry for user: Emee (43555)',NULL,NULL,'2025-09-10 08:14:12','STAFF',3),(44,'RECORD_EXIT','Recorded exit for user: Emee (43555)',NULL,NULL,'2025-09-10 08:14:56','STAFF',3),(45,'RECORD_ENTRY','Recorded entry for user: Cedrick Dimayuga (43434)',NULL,NULL,'2025-09-10 08:16:52','STAFF',3),(46,'RECORD_EXIT','Recorded exit for user: Cedrick Dimayuga (43434)',NULL,NULL,'2025-09-10 08:18:10','STAFF',3),(47,'RECORD_ENTRY','Recorded entry for user: Cedrick Dimayuga (43434)',NULL,NULL,'2025-09-10 08:18:20','STAFF',3),(48,'RECORD_EXIT','Recorded exit for user: Cedrick Dimayuga (43434)',NULL,NULL,'2025-09-10 08:25:23','STAFF',3),(49,'RECORD_ENTRY','Recorded entry for user: Emee (43555)',NULL,NULL,'2025-09-10 08:25:29','STAFF',3),(50,'RECORD_ENTRY','Recorded entry for user: Cedrick Dimayuga (43434)',NULL,NULL,'2025-09-10 08:26:05','STAFF',3),(51,'RECORD_EXIT','Recorded exit for user: Cedrick Dimayuga (43434)',NULL,NULL,'2025-09-10 08:26:22','STAFF',3),(52,'RETURN_BOOK','Processed book return: asdasd from user ID 3 (Penalty: ₱20.00)',NULL,NULL,'2025-09-10 09:22:20','STAFF',3),(53,'BOOK_APPROVAL','Approved borrow request: \"asdasd\" for user Emee (43555)',NULL,NULL,'2025-09-10 09:25:49','ADMIN',2),(54,'BOOK_APPROVAL','Approved borrow request: \"asdasd\" for user Cedrick Dimayuga (43434)',NULL,NULL,'2025-09-10 09:25:49','ADMIN',2),(55,'RETURN_BOOK','Processed book return: asdasd from user ID 3',NULL,NULL,'2025-09-10 09:33:13','ADMIN',2),(56,'RETURN_BOOK','Processed book return: asdasd from user ID 2',NULL,NULL,'2025-09-10 09:33:17','ADMIN',2),(57,'BOOK_APPROVAL','Approved borrow request: \"asdasd\" for user Cedrick Dimayuga (43434)',NULL,NULL,'2025-09-10 09:35:11','ADMIN',2),(58,'RETURN_BOOK','Processed book return: asdasd from user ID 2',NULL,NULL,'2025-09-10 09:35:22','STAFF',3),(59,'BOOK_APPROVAL','Approved borrow request: \"asdasd\" for user efgdg (454666)',NULL,NULL,'2025-09-10 09:38:37','ADMIN',2),(60,'RETURN_BOOK','Processed book return: asdasd from user ID 4',NULL,NULL,'2025-09-10 09:38:45','STAFF',3),(61,'RECORD_ENTRY','Recorded entry for user: efgdg (454666)',NULL,NULL,'2025-09-10 09:39:45','STAFF',3),(62,'RECORD_EXIT','Recorded exit for user: efgdg (454666)',NULL,NULL,'2025-09-10 09:39:51','STAFF',3),(63,'RECORD_ENTRY','Recorded entry for user: efgdg (454666)',NULL,NULL,'2025-09-10 09:39:55','STAFF',3),(64,'RECORD_EXIT','Recorded exit for user: efgdg (454666)',NULL,NULL,'2025-09-10 09:39:59','STAFF',3),(65,'RECORD_ENTRY','Recorded entry for user: efgdg (454666)',NULL,NULL,'2025-09-10 09:45:17','STAFF',3),(66,'RECORD_EXIT','Recorded exit for user: efgdg (454666)',NULL,NULL,'2025-09-10 10:03:10','STAFF',3),(67,'RECORD_ENTRY','Recorded entry for user: efgdg (454666)',NULL,NULL,'2025-09-10 10:03:23','STAFF',3),(68,'RECORD_EXIT','Recorded exit for user: efgdg (454666)',NULL,NULL,'2025-09-10 10:03:28','STAFF',3),(69,'RECORD_EXIT','Recorded exit for user: Emee (43555)',NULL,NULL,'2025-09-10 10:19:29','STAFF',3),(70,'RECORD_ENTRY','Recorded entry for user: Emee (43555)',NULL,NULL,'2025-09-10 10:19:40','STAFF',3),(71,'RECORD_EXIT','Recorded exit for user: Emee (43555)',NULL,NULL,'2025-09-10 10:19:45','STAFF',3),(72,'LOGOUT','User logged out',NULL,NULL,'2025-09-10 10:27:00','STAFF',3),(73,'LOGIN','Successful login attempt for user admin','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36','2025-09-10 12:22:57','SUPER_ADMIN',1),(74,'LOGIN','Successful login','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36','2025-09-10 12:22:57','SUPER_ADMIN',1),(75,'LOGOUT','User logged out',NULL,NULL,'2025-09-10 12:24:52','SUPER_ADMIN',1),(76,'LOGIN','Successful login attempt for user admin','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36','2025-09-10 12:25:26','SUPER_ADMIN',1),(77,'LOGIN','Successful login','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36','2025-09-10 12:25:27','SUPER_ADMIN',1),(78,'LOGOUT','User logged out',NULL,NULL,'2025-09-10 12:25:48','SUPER_ADMIN',1),(79,'LOGIN','Successful login attempt for user 43434','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36','2025-09-10 12:25:53','ADMIN',2),(80,'LOGIN','Successful login','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36','2025-09-10 12:25:53','ADMIN',2),(81,'DEMOTE_STAFF','Demoted STAFF for Emee (43555) to USER','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36','2025-09-10 12:27:20','ADMIN',2),(82,'LOGOUT','User logged out',NULL,NULL,'2025-09-10 12:27:28','ADMIN',2),(83,'LOGIN','Successful login attempt for user admin','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36','2025-09-10 12:27:33','SUPER_ADMIN',1),(84,'LOGIN','Successful login','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36','2025-09-10 12:27:34','SUPER_ADMIN',1),(85,'LOGOUT','User logged out',NULL,NULL,'2025-09-10 12:28:00','SUPER_ADMIN',1),(86,'LOGIN','Successful login attempt for user 43434','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36','2025-09-10 12:28:06','ADMIN',2),(87,'LOGIN','Successful login','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36','2025-09-10 12:28:06','ADMIN',2),(88,'LOGOUT','User logged out',NULL,NULL,'2025-09-10 12:38:40','ADMIN',2),(89,'LOGIN','Successful login attempt for user 43434','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36','2025-09-10 12:38:46','ADMIN',2),(90,'LOGIN','Successful login','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36','2025-09-10 12:38:47','ADMIN',2),(91,'PROMOTE_TO_STAFF','Created STAFF account for efgdg (454666)','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36','2025-09-10 12:41:15','ADMIN',2),(92,'DEMOTE_STAFF','Demoted STAFF for efgdg (454666) to USER','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36','2025-09-10 12:45:18','ADMIN',2),(93,'BOOK_APPROVAL','Approved borrow request: \"asdasd\" for user Emee (43555)',NULL,NULL,'2025-09-10 12:53:36','ADMIN',2),(94,'PROMOTE_TO_STAFF','Promoted STAFF account for Emee (43555)','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36','2025-09-10 14:11:45','ADMIN',2),(95,'LOGIN','Successful login attempt for user 43555','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36','2025-09-10 14:12:13','STAFF',3),(96,'LOGIN','Successful login','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36','2025-09-10 14:12:14','STAFF',3),(97,'RETURN_BOOK','Processed book return: asdasd from user ID 3',NULL,NULL,'2025-09-10 14:13:10','STAFF',3),(98,'BOOK_APPROVAL','Approved borrow request: \"asdasd\" for user Cedrick Dimayuga (43434)',NULL,NULL,'2025-09-10 14:15:21','ADMIN',2),(99,'PROMOTE_TO_STAFF','Promoted STAFF account for efgdg (454666)','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36','2025-09-10 14:33:36','ADMIN',2),(100,'CREATE_SECTION','Created section: Computer (#1)','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36','2025-09-10 14:33:54','ADMIN',2),(101,'CREATE_CATEGORY','Created category: Technology (#2)','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36','2025-09-10 14:34:05','ADMIN',2),(102,'CREATE_BOOK','Created book: Human Computer Interaction by Jane Smith',NULL,NULL,'2025-09-10 14:35:58','STAFF',3),(103,'UPDATE_BOOK','Updated book: Human Computer Interaction by Jane Smith',NULL,NULL,'2025-09-10 14:36:08','STAFF',3),(104,'UPDATE_BOOK','Updated book: Human Computer Interaction by Jane Smith',NULL,NULL,'2025-09-10 14:36:17','STAFF',3),(105,'RECORD_ENTRY','Recorded entry for user: Cedrick Dimayuga (43434)',NULL,NULL,'2025-09-10 14:36:40','STAFF',3),(106,'RECORD_EXIT','Recorded exit for user: Cedrick Dimayuga (43434)',NULL,NULL,'2025-09-10 14:36:46','STAFF',3),(107,'RETURN_BOOK','Processed book return: asdasd from user ID 2',NULL,NULL,'2025-09-10 14:46:47','STAFF',3),(108,'BOOK_APPROVAL','Approved borrow request: \"asdasd\" for user efgdg (454666)',NULL,NULL,'2025-09-10 14:46:52','ADMIN',2),(109,'BOOK_APPROVAL','Approved borrow request: \"asdasd\" for user Emee (43555)',NULL,NULL,'2025-09-10 14:47:13','ADMIN',2),(110,'RETURN_BOOK','Processed book return: asdasd from user ID 3',NULL,NULL,'2025-09-10 14:48:44','STAFF',3),(111,'USER_DEACTIVATE','Deactivated user: Emee (43555)','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36','2025-09-10 14:49:28','ADMIN',2),(112,'USER_ACTIVATE','Activated user: Emee (43555)','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36','2025-09-10 14:49:30','ADMIN',2),(113,'USER_DEACTIVATE','Deactivated user: Emee (43555)','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36','2025-09-10 14:49:34','ADMIN',2),(114,'DEMOTE_STAFF','Demoted STAFF for Emee (43555) to USER','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36','2025-09-10 14:49:43','ADMIN',2),(115,'USER_DEACTIVATE','Deactivated user: efgdg (454666)','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36','2025-09-10 14:49:51','ADMIN',2),(116,'USER_ACTIVATE','Activated user: efgdg (454666)','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36','2025-09-10 14:49:54','ADMIN',2),(117,'USER_DEACTIVATE','Deactivated user: efgdg (454666)','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36','2025-09-10 14:49:59','ADMIN',2),(118,'USER_ACTIVATE','Activated user: efgdg (454666)','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36','2025-09-10 14:50:04','ADMIN',2),(119,'LOGOUT','User logged out',NULL,NULL,'2025-09-10 14:50:44','ADMIN',2),(120,'LOGIN','Successful login attempt for user admin','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36','2025-09-10 14:50:52','SUPER_ADMIN',1),(121,'LOGIN','Successful login','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36','2025-09-10 14:50:52','SUPER_ADMIN',1),(122,'LOGIN','Successful login attempt for user admin','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36','2025-09-10 15:17:32','SUPER_ADMIN',1),(123,'LOGIN','Successful login','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36','2025-09-10 15:17:32','SUPER_ADMIN',1),(124,'LOGIN','Successful login attempt for user 43434','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36','2025-09-10 15:19:58','ADMIN',2),(125,'LOGIN','Successful login','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36','2025-09-10 15:19:59','ADMIN',2),(126,'PROFILE_UPDATE','User admin updated profile: username: \"admin\" → \"admins\"','::1','Mozilla/5.0 (X11; Linux aarch64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36 CrKey/1.54.250320','2025-09-10 15:25:05','SUPER_ADMIN',1),(127,'PROFILE_UPDATE','User admins updated profile: username: \"admins\" → \"admin\"','::1','Mozilla/5.0 (X11; Linux aarch64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36 CrKey/1.54.250320','2025-09-10 15:25:12','SUPER_ADMIN',1),(128,'PASSWORD_RESET','Reset password for user: Cedrick Dimayuga (43434)','::1','Mozilla/5.0 (X11; Linux aarch64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36 CrKey/1.54.250320','2025-09-10 15:25:51','SUPER_ADMIN',1),(129,'DEPARTMENT_CREATE','Created new department: \"nnnnhhhggg\" (Code: mhb)','::1','Mozilla/5.0 (X11; Linux aarch64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36 CrKey/1.54.250320','2025-09-10 15:29:18','SUPER_ADMIN',1),(130,'PASSWORD_CHANGE','User admin changed their password','::1','Mozilla/5.0 (X11; Linux aarch64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36 CrKey/1.54.250320','2025-09-10 15:30:02','SUPER_ADMIN',1),(131,'LOGOUT','User logged out',NULL,NULL,'2025-09-10 15:52:36','SUPER_ADMIN',1),(132,'LOGIN','Successful login attempt for user admin','::1','Mozilla/5.0 (X11; Linux aarch64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36 CrKey/1.54.250320','2025-09-10 15:52:49','SUPER_ADMIN',1),(133,'LOGIN','Successful login','::1','Mozilla/5.0 (X11; Linux aarch64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36 CrKey/1.54.250320','2025-09-10 15:52:51','SUPER_ADMIN',1),(134,'LOGIN','Successful login attempt for user admin','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36','2025-09-10 16:18:14','SUPER_ADMIN',1),(135,'LOGIN','Successful login','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36','2025-09-10 16:18:16','SUPER_ADMIN',1),(136,'LOGIN','Successful login attempt for user admin','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36','2025-09-10 16:19:08','SUPER_ADMIN',1),(137,'LOGIN','Successful login','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36','2025-09-10 16:19:09','SUPER_ADMIN',1),(138,'LOGIN','Successful login attempt for user admin','::1','Mozilla/5.0 (X11; Linux aarch64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36 CrKey/1.54.250320','2025-09-10 16:19:16','SUPER_ADMIN',1),(139,'LOGIN','Successful login','::1','Mozilla/5.0 (X11; Linux aarch64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36 CrKey/1.54.250320','2025-09-10 16:19:18','SUPER_ADMIN',1),(140,'PROMOTE_TO_ADMIN','Promoted ADMIN account for Emee (43555)','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36','2025-09-10 16:23:28','SUPER_ADMIN',1),(141,'PASSWORD_RESET','Reset password for user: Emee (43555)','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36','2025-09-10 16:23:38','SUPER_ADMIN',1),(142,'USER_DEACTIVATE','Deactivated user: Emee (43555)','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36','2025-09-10 16:23:41','SUPER_ADMIN',1),(143,'USER_ACTIVATE','Activated user: Emee (43555)','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36','2025-09-10 16:23:46','SUPER_ADMIN',1),(144,'DEMOTE_ADMIN','Demoted ADMIN for Emee (43555) to USER','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36','2025-09-10 16:23:54','SUPER_ADMIN',1),(145,'PROGRAM_UPDATE','Updated program \"Computer Science\": status: active → inactive','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36','2025-09-10 16:24:03','SUPER_ADMIN',1),(146,'LOGOUT','User logged out',NULL,NULL,'2025-09-10 16:24:57','SUPER_ADMIN',1),(147,'LOGIN','Successful login attempt for user 43434','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36','2025-09-10 16:25:09','ADMIN',2),(148,'LOGIN','Successful login','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36','2025-09-10 16:25:09','ADMIN',2),(149,'LOGOUT','User logged out',NULL,NULL,'2025-09-10 16:25:18','SUPER_ADMIN',1),(150,'PASSWORD_RESET','Reset password for user: efgdg (454666)','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36','2025-09-10 16:25:44','ADMIN',2),(151,'PASSWORD_RESET','Reset password for user: efgdg (454666)','::1','Mozilla/5.0 (X11; Linux aarch64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36 CrKey/1.54.250320','2025-09-10 16:25:51','ADMIN',2),(152,'USER_DEACTIVATE','Deactivated user: efgdg (454666)','::1','Mozilla/5.0 (X11; Linux aarch64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36 CrKey/1.54.250320','2025-09-10 16:25:55','ADMIN',2),(153,'USER_ACTIVATE','Activated user: efgdg (454666)','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36','2025-09-10 16:26:16','ADMIN',2),(154,'PROMOTE_TO_STAFF','Promoted STAFF account for Emee (43555)','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36','2025-09-10 16:26:37','ADMIN',2),(155,'PASSWORD_RESET','Reset password for user: Emee (43555)','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36','2025-09-10 16:26:47','ADMIN',2),(156,'DEMOTE_STAFF','Demoted STAFF for Emee (43555) to USER','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36','2025-09-10 16:27:07','ADMIN',2),(157,'PROMOTE_TO_STAFF','Promoted STAFF account for Emee (43555)','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36','2025-09-10 16:27:22','ADMIN',2),(158,'LOGIN','Successful login attempt for user 43555','::1','Mozilla/5.0 (X11; Linux aarch64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36 CrKey/1.54.250320','2025-09-10 16:27:36','STAFF',3),(159,'LOGIN','Successful login','::1','Mozilla/5.0 (X11; Linux aarch64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36 CrKey/1.54.250320','2025-09-10 16:27:37','STAFF',3),(160,'LOGOUT','User logged out',NULL,NULL,'2025-09-10 16:27:40','STAFF',3),(161,'LOGIN','Successful login attempt for user 454666','::1','Mozilla/5.0 (X11; Linux aarch64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36 CrKey/1.54.250320','2025-09-10 16:27:52','STAFF',4),(162,'LOGIN','Successful login','::1','Mozilla/5.0 (X11; Linux aarch64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36 CrKey/1.54.250320','2025-09-10 16:27:52','STAFF',4),(163,'PASSWORD_RESET','Reset password for user: Emee (43555)','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36','2025-09-10 16:28:45','ADMIN',2),(164,'LOGOUT','User logged out',NULL,NULL,'2025-09-10 16:29:44','ADMIN',2),(165,'LOGIN','Successful login attempt for user admin','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36','2025-09-10 16:30:12','SUPER_ADMIN',1),(166,'LOGIN','Successful login','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36','2025-09-10 16:30:12','SUPER_ADMIN',1),(167,'USER_DEACTIVATE','Deactivated user: Cedrick Dimayuga (43434)','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36','2025-09-10 16:30:18','SUPER_ADMIN',1),(168,'PASSWORD_RESET','Reset password for user: Cedrick Dimayuga (43434)','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36','2025-09-10 16:30:37','SUPER_ADMIN',1),(169,'PASSWORD_CHANGE','User 454666 changed their password','::1','Mozilla/5.0 (X11; Linux aarch64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36 CrKey/1.54.250320','2025-09-10 16:33:58','STAFF',4),(170,'LOGOUT','User logged out',NULL,NULL,'2025-09-10 16:51:42','SUPER_ADMIN',1),(171,'LOGIN','Successful login attempt for user admin','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36','2025-09-10 16:52:00','SUPER_ADMIN',1),(172,'LOGIN','Successful login','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36','2025-09-10 16:52:00','SUPER_ADMIN',1),(173,'USER_ACTIVATE','Activated user: Cedrick Dimayuga (43434)','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36','2025-09-10 16:52:05','SUPER_ADMIN',1),(174,'PASSWORD_RESET','Reset password for user: Cedrick Dimayuga (43434)','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36','2025-09-10 16:52:13','SUPER_ADMIN',1),(175,'LOGOUT','User logged out',NULL,NULL,'2025-09-10 16:52:16','SUPER_ADMIN',1),(176,'LOGIN','Successful login attempt for user 43434','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36','2025-09-10 16:52:20','ADMIN',2),(177,'LOGIN','Successful login','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36','2025-09-10 16:52:20','ADMIN',2),(178,'USER_DEACTIVATE','Deactivated user: Emee (43555)','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36','2025-09-10 16:52:41','ADMIN',2),(179,'USER_ACTIVATE','Activated user: Emee (43555)','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36','2025-09-10 16:52:43','ADMIN',2),(180,'PASSWORD_RESET','Reset password for user: Emee (43555)','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36','2025-09-10 16:52:48','ADMIN',2),(181,'DEMOTE_STAFF','Demoted STAFF for Emee (43555) to USER','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36','2025-09-10 16:52:51','ADMIN',2),(182,'RETURN_BOOK','Processed book return: asdasd from user ID 4',NULL,NULL,'2025-09-10 17:12:43','STAFF',4),(183,'BOOK_APPROVAL','Approved borrow request: \"asdasd\" for user Emee (43555)',NULL,NULL,'2025-09-10 17:41:19','ADMIN',2),(184,'BOOK_APPROVAL','Approved borrow request: \"asdasd\" for user Cedrick Dimayuga (43434)',NULL,NULL,'2025-09-10 18:23:59','ADMIN',2),(185,'RECORD_ENTRY','Recorded entry for user: Cedrick Dimayuga (43434)',NULL,NULL,'2025-09-10 18:52:31','STAFF',4),(186,'RECORD_EXIT','Recorded exit for user: Cedrick Dimayuga (43434)',NULL,NULL,'2025-09-10 18:52:37','STAFF',4),(187,'RECORD_ENTRY','Recorded entry for user: Cedrick Dimayuga (43434)',NULL,NULL,'2025-09-10 18:52:45','STAFF',4),(188,'RECORD_EXIT','Recorded exit for user: Cedrick Dimayuga (43434)',NULL,NULL,'2025-09-10 18:52:49','STAFF',4),(189,'LOGOUT','User logged out',NULL,NULL,'2025-09-10 19:12:02','ADMIN',2),(190,'LOGIN','Successful login attempt for user admin','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36','2025-09-10 19:12:23','SUPER_ADMIN',1),(191,'LOGIN','Successful login','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36','2025-09-10 19:12:23','SUPER_ADMIN',1);
/*!40000 ALTER TABLE `auditlog` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `book`
--

DROP TABLE IF EXISTS `book`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `book` (
  `book_id` int(11) NOT NULL AUTO_INCREMENT,
  `title` varchar(150) NOT NULL,
  `book_author` varchar(100) NOT NULL,
  `isbn` varchar(20) DEFAULT NULL,
  `publisher` varchar(100) DEFAULT NULL,
  `year_published` int(11) DEFAULT NULL,
  `copies_total` int(11) NOT NULL DEFAULT 1,
  `copies_available` int(11) NOT NULL DEFAULT 1,
  `category_id` int(11) NOT NULL,
  `section_id` int(11) DEFAULT NULL,
  `status` enum('AVAILABLE','BORROWED','MISSING','DAMAGED','ARCHIVED') NOT NULL DEFAULT 'AVAILABLE',
  `location` varchar(50) DEFAULT NULL,
  `description` text DEFAULT NULL,
  `language` varchar(50) DEFAULT NULL,
  `pages` int(11) DEFAULT NULL,
  `edition` varchar(50) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL,
  `archived_at` datetime DEFAULT NULL,
  PRIMARY KEY (`book_id`),
  UNIQUE KEY `book_isbn_key` (`isbn`),
  KEY `book_status_category_id_idx` (`status`,`category_id`),
  KEY `book_section_id_idx` (`section_id`),
  KEY `book_title_idx` (`title`),
  KEY `book_book_author_idx` (`book_author`),
  KEY `book_isbn_idx` (`isbn`),
  KEY `book_created_at_idx` (`created_at`),
  KEY `book_archived_at_idx` (`archived_at`),
  KEY `book_category_id_fkey` (`category_id`),
  CONSTRAINT `book_category_id_fkey` FOREIGN KEY (`category_id`) REFERENCES `book_category` (`category_id`) ON UPDATE CASCADE,
  CONSTRAINT `book_section_id_fkey` FOREIGN KEY (`section_id`) REFERENCES `book_section` (`section_id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `book`
--

LOCK TABLES `book` WRITE;
/*!40000 ALTER TABLE `book` DISABLE KEYS */;
INSERT INTO `book` VALUES (1,'asdasd','asda','123456',NULL,NULL,23,21,1,NULL,'AVAILABLE',NULL,NULL,NULL,NULL,NULL,'2025-09-09 23:05:59','2025-09-10 18:23:59',NULL),(2,'Human Computer Interaction','Jane Smith','4321',NULL,NULL,11,11,2,NULL,'AVAILABLE',NULL,NULL,NULL,NULL,NULL,'2025-09-10 06:35:58','2025-09-10 14:36:17',NULL);
/*!40000 ALTER TABLE `book` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `book_category`
--

DROP TABLE IF EXISTS `book_category`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `book_category` (
  `category_id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL,
  `description` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`category_id`),
  UNIQUE KEY `book_category_name_key` (`name`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `book_category`
--

LOCK TABLES `book_category` WRITE;
/*!40000 ALTER TABLE `book_category` DISABLE KEYS */;
INSERT INTO `book_category` VALUES (1,'General','General books category','2025-09-09 21:13:31'),(2,'Technology',NULL,'2025-09-10 06:34:05');
/*!40000 ALTER TABLE `book_category` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `book_section`
--

DROP TABLE IF EXISTS `book_section`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `book_section` (
  `section_id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL,
  `description` text DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`section_id`),
  UNIQUE KEY `book_section_name_key` (`name`),
  KEY `book_section_is_active_idx` (`is_active`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `book_section`
--

LOCK TABLES `book_section` WRITE;
/*!40000 ALTER TABLE `book_section` DISABLE KEYS */;
INSERT INTO `book_section` VALUES (1,'Computer',NULL,1,'2025-09-10 06:33:54');
/*!40000 ALTER TABLE `book_section` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `book_transaction`
--

DROP TABLE IF EXISTS `book_transaction`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `book_transaction` (
  `transaction_id` int(11) NOT NULL AUTO_INCREMENT,
  `borrow_date` date DEFAULT NULL,
  `return_date` date DEFAULT NULL,
  `due_date` date DEFAULT NULL,
  `penalty` decimal(10,2) NOT NULL DEFAULT 0.00,
  `status` enum('PENDING_APPROVAL','ACTIVE','COMPLETED','OVERDUE','REJECTED','CANCELLED') NOT NULL DEFAULT 'PENDING_APPROVAL',
  `condition_on_borrow` enum('EXCELLENT','GOOD','FAIR','POOR','DAMAGED','MISSING') DEFAULT NULL,
  `condition_on_return` enum('EXCELLENT','GOOD','FAIR','POOR','DAMAGED','MISSING') DEFAULT NULL,
  `book_id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `requested_by` int(11) DEFAULT NULL,
  `approved_by` int(11) DEFAULT NULL,
  `returned_by` int(11) DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL,
  PRIMARY KEY (`transaction_id`),
  KEY `book_transaction_book_id_idx` (`book_id`),
  KEY `book_transaction_user_id_idx` (`user_id`),
  KEY `book_transaction_due_date_idx` (`due_date`),
  KEY `book_transaction_borrow_date_idx` (`borrow_date`),
  KEY `book_transaction_return_date_idx` (`return_date`),
  KEY `book_transaction_status_idx` (`status`),
  CONSTRAINT `book_transaction_book_id_fkey` FOREIGN KEY (`book_id`) REFERENCES `book` (`book_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `book_transaction_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `user` (`user_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=13 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `book_transaction`
--

LOCK TABLES `book_transaction` WRITE;
/*!40000 ALTER TABLE `book_transaction` DISABLE KEYS */;
INSERT INTO `book_transaction` VALUES (1,'2025-09-10','2025-09-10','2025-09-08',15.00,'COMPLETED','GOOD','GOOD',1,3,3,2,3,NULL,'2025-09-09 23:38:07','2025-09-10 07:42:12'),(2,'2025-09-10','2025-09-10','2025-09-07',20.00,'COMPLETED','GOOD','GOOD',1,3,3,2,3,NULL,'2025-09-09 23:43:01','2025-09-10 09:22:20'),(3,'2025-09-10','2025-09-10','2025-09-12',0.00,'COMPLETED','GOOD',NULL,1,2,3,2,2,NULL,'2025-09-10 01:24:44','2025-09-10 09:33:17'),(4,'2025-09-10','2025-09-10','2025-09-24',0.00,'COMPLETED','GOOD',NULL,1,3,3,2,2,NULL,'2025-09-10 01:24:56','2025-09-10 09:33:13'),(5,'2025-09-10','2025-09-10','2025-09-11',0.00,'COMPLETED','GOOD',NULL,1,2,3,2,3,NULL,'2025-09-10 01:34:46','2025-09-10 09:35:22'),(6,'2025-09-10','2025-09-10','2025-09-11',0.00,'COMPLETED','GOOD',NULL,1,4,3,2,3,NULL,'2025-09-10 01:38:23','2025-09-10 09:38:45'),(7,'2025-09-10','2025-09-10','2025-09-13',0.00,'COMPLETED','GOOD',NULL,1,3,3,2,3,NULL,'2025-09-10 02:14:35','2025-09-10 14:13:10'),(8,'2025-09-10','2025-09-10','2025-09-13',0.00,'COMPLETED','GOOD',NULL,1,3,3,2,3,NULL,'2025-09-10 06:13:24','2025-09-10 14:48:44'),(9,'2025-09-10','2025-09-10','2025-09-13',0.00,'COMPLETED','GOOD','GOOD',1,2,3,2,3,NULL,'2025-09-10 06:14:04','2025-09-10 14:46:47'),(10,'2025-09-10','2025-09-10','2025-09-13',0.00,'COMPLETED','GOOD','GOOD',1,4,3,2,4,NULL,'2025-09-10 06:46:25','2025-09-10 17:12:43'),(11,'2025-09-10',NULL,'2025-09-13',0.00,'ACTIVE','GOOD',NULL,1,3,4,2,NULL,NULL,'2025-09-10 08:28:26','2025-09-10 17:41:19'),(12,'2025-09-10',NULL,'2025-09-13',0.00,'ACTIVE','GOOD',NULL,1,2,4,2,NULL,NULL,'2025-09-10 10:23:52','2025-09-10 18:23:59');
/*!40000 ALTER TABLE `book_transaction` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `department`
--

DROP TABLE IF EXISTS `department`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `department` (
  `department_id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL,
  `code` varchar(10) NOT NULL,
  `description` text DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL,
  `archived_at` datetime DEFAULT NULL,
  PRIMARY KEY (`department_id`),
  UNIQUE KEY `department_name_key` (`name`),
  UNIQUE KEY `department_code_key` (`code`),
  KEY `department_code_idx` (`code`),
  KEY `department_is_active_idx` (`is_active`),
  KEY `department_archived_at_idx` (`archived_at`)
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `department`
--

LOCK TABLES `department` WRITE;
/*!40000 ALTER TABLE `department` DISABLE KEYS */;
INSERT INTO `department` VALUES (1,'School of Information and Technology','SIT',NULL,1,'2025-09-09 21:24:30','2025-09-10 05:24:30',NULL),(2,'nnnnhhhggg','mhb',NULL,1,'2025-09-10 07:29:18','2025-09-10 15:29:18',NULL),(3,'College of Engineering','COE','College of Engineering and Technology',1,'2025-09-10 07:39:49','2025-09-10 15:39:49',NULL),(4,'College of Arts and Sciences','CAS','College of Liberal Arts and Sciences',1,'2025-09-10 07:39:49','2025-09-10 15:39:49',NULL),(5,'College of Business','COB','College of Business Administration',1,'2025-09-10 07:39:49','2025-09-10 15:39:49',NULL),(6,'College of Education','COEd','College of Education and Human Development',1,'2025-09-10 07:39:49','2025-09-10 15:39:49',NULL);
/*!40000 ALTER TABLE `department` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `entrylog`
--

DROP TABLE IF EXISTS `entrylog`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `entrylog` (
  `entry_id` int(11) NOT NULL AUTO_INCREMENT,
  `entry_time` datetime NOT NULL,
  `exit_time` datetime DEFAULT NULL,
  `user_id` int(11) NOT NULL,
  `rfid_code` varchar(50) DEFAULT NULL,
  `purpose` varchar(100) DEFAULT NULL,
  `verified_by` int(11) DEFAULT NULL,
  PRIMARY KEY (`entry_id`),
  KEY `entrylog_user_id_idx` (`user_id`),
  KEY `entrylog_entry_time_idx` (`entry_time`),
  KEY `entrylog_exit_time_idx` (`exit_time`),
  KEY `entrylog_rfid_code_idx` (`rfid_code`),
  CONSTRAINT `entrylog_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `user` (`user_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=14 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `entrylog`
--

LOCK TABLES `entrylog` WRITE;
/*!40000 ALTER TABLE `entrylog` DISABLE KEYS */;
INSERT INTO `entrylog` VALUES (1,'2025-09-10 08:14:12','2025-09-10 08:14:55',3,NULL,'General',3),(2,'2025-09-10 08:16:52','2025-09-10 08:18:10',2,NULL,'General',3),(3,'2025-09-10 08:18:20','2025-09-10 08:25:23',2,NULL,'General',3),(4,'2025-09-10 08:25:28','2025-09-10 10:19:28',3,NULL,'General',3),(5,'2025-09-10 08:26:05','2025-09-10 08:26:22',2,NULL,'General',3),(6,'2025-09-10 09:39:45','2025-09-10 09:39:51',4,NULL,'General',3),(7,'2025-09-10 09:39:55','2025-09-10 09:39:59',4,NULL,'General',3),(8,'2025-09-10 09:45:17','2025-09-10 10:03:10',4,NULL,'General',3),(9,'2025-09-10 10:03:23','2025-09-10 10:03:28',4,NULL,'General',3),(10,'2025-09-10 10:19:40','2025-09-10 10:19:45',3,NULL,'General',3),(11,'2025-09-10 14:36:40','2025-09-10 14:36:46',2,NULL,'General',3),(12,'2025-09-10 18:52:31','2025-09-10 18:52:37',2,NULL,'General',4),(13,'2025-09-10 18:52:45','2025-09-10 18:52:49',2,NULL,'General',4);
/*!40000 ALTER TABLE `entrylog` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `locker`
--

DROP TABLE IF EXISTS `locker`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `locker` (
  `locker_id` int(11) NOT NULL AUTO_INCREMENT,
  `locker_number` varchar(20) NOT NULL,
  `location` varchar(100) NOT NULL,
  `status` enum('AVAILABLE','OCCUPIED','DAMAGED','MAINTENANCE','ARCHIVED') NOT NULL DEFAULT 'AVAILABLE',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL,
  `archived_at` datetime DEFAULT NULL,
  PRIMARY KEY (`locker_id`),
  UNIQUE KEY `locker_locker_number_key` (`locker_number`),
  KEY `locker_status_idx` (`status`),
  KEY `locker_location_idx` (`location`),
  KEY `locker_archived_at_idx` (`archived_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `locker`
--

LOCK TABLES `locker` WRITE;
/*!40000 ALTER TABLE `locker` DISABLE KEYS */;
/*!40000 ALTER TABLE `locker` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `locker_transaction`
--

DROP TABLE IF EXISTS `locker_transaction`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `locker_transaction` (
  `transaction_id` int(11) NOT NULL AUTO_INCREMENT,
  `borrow_time` datetime NOT NULL,
  `return_time` datetime DEFAULT NULL,
  `due_time` datetime NOT NULL,
  `penalty` decimal(10,2) NOT NULL DEFAULT 0.00,
  `status` enum('PENDING_APPROVAL','ACTIVE','COMPLETED','OVERDUE','REJECTED','CANCELLED') NOT NULL DEFAULT 'ACTIVE',
  `user_id` int(11) NOT NULL,
  `locker_id` int(11) NOT NULL,
  `assigned_by` int(11) DEFAULT NULL,
  `returned_by` int(11) DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL,
  PRIMARY KEY (`transaction_id`),
  KEY `locker_transaction_locker_id_idx` (`locker_id`),
  KEY `locker_transaction_user_id_idx` (`user_id`),
  KEY `locker_transaction_due_time_idx` (`due_time`),
  KEY `locker_transaction_borrow_time_idx` (`borrow_time`),
  KEY `locker_transaction_return_time_idx` (`return_time`),
  KEY `locker_transaction_status_idx` (`status`),
  CONSTRAINT `locker_transaction_locker_id_fkey` FOREIGN KEY (`locker_id`) REFERENCES `locker` (`locker_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `locker_transaction_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `user` (`user_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `locker_transaction`
--

LOCK TABLES `locker_transaction` WRITE;
/*!40000 ALTER TABLE `locker_transaction` DISABLE KEYS */;
/*!40000 ALTER TABLE `locker_transaction` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `notification_log`
--

DROP TABLE IF EXISTS `notification_log`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `notification_log` (
  `notification_id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `type` enum('LOCKER_OVERDUE','BOOK_OVERDUE','LOCKER_ASSIGNED','BOOK_APPROVED','BOOK_REJECTED','PENDING_APPROVAL','SYSTEM_ALERT','ACCOUNT_UPDATE') NOT NULL,
  `title` varchar(200) NOT NULL,
  `message` text NOT NULL,
  `status` enum('QUEUED','SENT','FAILED','READ') NOT NULL DEFAULT 'QUEUED',
  `sent_at` datetime DEFAULT NULL,
  `read_at` datetime DEFAULT NULL,
  `metadata` longtext DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`notification_id`),
  KEY `notification_log_user_id_idx` (`user_id`),
  KEY `notification_log_type_idx` (`type`),
  KEY `notification_log_status_idx` (`status`),
  KEY `notification_log_created_at_idx` (`created_at`),
  CONSTRAINT `notification_log_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `user` (`user_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=17 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `notification_log`
--

LOCK TABLES `notification_log` WRITE;
/*!40000 ALTER TABLE `notification_log` DISABLE KEYS */;
INSERT INTO `notification_log` VALUES (1,2,'PENDING_APPROVAL','New Borrow Request','Emee (43555) has requested to borrow \"asdasd\" by asda. Click to review and approve.','QUEUED',NULL,'2025-09-10 10:15:28','{\"transactionId\":1,\"bookTitle\":\"asdasd\",\"borrowerName\":\"Emee\",\"borrowerAccountId\":\"43555\",\"redirectUrl\":\"/books?tab=pending\"}','2025-09-09 23:38:07'),(2,2,'PENDING_APPROVAL','Pending Borrow Request','Emee (43555) has requested to borrow \"asdasd\" by asda. Please review and approve.','QUEUED',NULL,'2025-09-10 10:15:28','{\"transactionId\":1,\"bookTitle\":\"asdasd\",\"borrowerName\":\"Emee\",\"borrowerAccountId\":\"43555\",\"redirectUrl\":\"/books?tab=pending\"}','2025-09-09 23:42:25'),(3,2,'PENDING_APPROVAL','New Borrow Request','Emee (43555) has requested to borrow \"asdasd\" by asda. Click to review and approve.','QUEUED',NULL,'2025-09-10 10:15:28','{\"transactionId\":2,\"bookTitle\":\"asdasd\",\"borrowerName\":\"Emee\",\"borrowerAccountId\":\"43555\",\"redirectUrl\":\"/books?tab=pending\"}','2025-09-09 23:43:01'),(4,2,'PENDING_APPROVAL','New Borrow Request','Cedrick Dimayuga (43434) has requested to borrow \"asdasd\" by asda. Click to review and approve.','QUEUED',NULL,'2025-09-10 10:15:28','{\"transactionId\":3,\"bookTitle\":\"asdasd\",\"borrowerName\":\"Cedrick Dimayuga\",\"borrowerAccountId\":\"43434\",\"redirectUrl\":\"/books?tab=pending\"}','2025-09-10 01:24:44'),(5,2,'PENDING_APPROVAL','New Borrow Request','Emee (43555) has requested to borrow \"asdasd\" by asda. Click to review and approve.','QUEUED',NULL,'2025-09-10 10:15:28','{\"transactionId\":4,\"bookTitle\":\"asdasd\",\"borrowerName\":\"Emee\",\"borrowerAccountId\":\"43555\",\"redirectUrl\":\"/books?tab=pending\"}','2025-09-10 01:24:56'),(6,2,'PENDING_APPROVAL','New Borrow Request','Cedrick Dimayuga (43434) has requested to borrow \"asdasd\" by asda. Click to review and approve.','QUEUED',NULL,'2025-09-10 10:15:28','{\"transactionId\":5,\"bookTitle\":\"asdasd\",\"borrowerName\":\"Cedrick Dimayuga\",\"borrowerAccountId\":\"43434\",\"redirectUrl\":\"/books?tab=pending\"}','2025-09-10 01:34:46'),(7,2,'PENDING_APPROVAL','New Borrow Request','efgdg (454666) has requested to borrow \"asdasd\" by asda. Click to review and approve.','QUEUED',NULL,'2025-09-10 10:15:28','{\"transactionId\":6,\"bookTitle\":\"asdasd\",\"borrowerName\":\"efgdg\",\"borrowerAccountId\":\"454666\",\"redirectUrl\":\"/books?tab=pending\"}','2025-09-10 01:38:23'),(8,2,'PENDING_APPROVAL','New Borrow Request','Emee (43555) has requested to borrow \"asdasd\" by asda. Click to review and approve.','QUEUED',NULL,'2025-09-10 10:15:25','{\"transactionId\":7,\"bookTitle\":\"asdasd\",\"borrowerName\":\"Emee\",\"borrowerAccountId\":\"43555\",\"redirectUrl\":\"/books?tab=pending\"}','2025-09-10 02:14:35'),(9,2,'PENDING_APPROVAL','New Borrow Request','Emee (43555) has requested to borrow \"asdasd\" by asda. Click to review and approve.','QUEUED',NULL,NULL,'{\"transactionId\":8,\"bookTitle\":\"asdasd\",\"borrowerName\":\"Emee\",\"borrowerAccountId\":\"43555\",\"redirectUrl\":\"/books?tab=pending\"}','2025-09-10 06:13:24'),(10,2,'PENDING_APPROVAL','New Borrow Request','Cedrick Dimayuga (43434) has requested to borrow \"asdasd\" by asda. Click to review and approve.','QUEUED',NULL,NULL,'{\"transactionId\":9,\"bookTitle\":\"asdasd\",\"borrowerName\":\"Cedrick Dimayuga\",\"borrowerAccountId\":\"43434\",\"redirectUrl\":\"/books?tab=pending\"}','2025-09-10 06:14:04'),(11,2,'PENDING_APPROVAL','Pending Borrow Request','Emee (43555) has requested to borrow \"asdasd\" by asda. Please review and approve.','QUEUED',NULL,NULL,'{\"transactionId\":8,\"bookTitle\":\"asdasd\",\"borrowerName\":\"Emee\",\"borrowerAccountId\":\"43555\",\"redirectUrl\":\"/books?tab=pending\"}','2025-09-10 06:26:38'),(12,2,'PENDING_APPROVAL','Pending Borrow Request','Emee (43555) has requested to borrow \"asdasd\" by asda. Please review and approve.','QUEUED',NULL,NULL,'{\"transactionId\":8,\"bookTitle\":\"asdasd\",\"borrowerName\":\"Emee\",\"borrowerAccountId\":\"43555\",\"redirectUrl\":\"/books?tab=pending\"}','2025-09-10 06:33:06'),(13,2,'PENDING_APPROVAL','New Borrow Request','efgdg (454666) has requested to borrow \"asdasd\" by asda. Click to review and approve.','QUEUED',NULL,NULL,'{\"transactionId\":10,\"bookTitle\":\"asdasd\",\"borrowerName\":\"efgdg\",\"borrowerAccountId\":\"454666\",\"redirectUrl\":\"/books?tab=pending\"}','2025-09-10 06:46:25'),(14,2,'PENDING_APPROVAL','Pending Borrow Request','Emee (43555) has requested to borrow \"asdasd\" by asda. Please review and approve.','QUEUED',NULL,NULL,'{\"transactionId\":8,\"bookTitle\":\"asdasd\",\"borrowerName\":\"Emee\",\"borrowerAccountId\":\"43555\",\"redirectUrl\":\"/books?tab=pending\"}','2025-09-10 06:47:00'),(15,2,'PENDING_APPROVAL','New Borrow Request','Emee (43555) has requested to borrow \"asdasd\" by asda. Click to review and approve.','QUEUED',NULL,NULL,'{\"transactionId\":11,\"bookTitle\":\"asdasd\",\"borrowerName\":\"Emee\",\"borrowerAccountId\":\"43555\",\"redirectUrl\":\"/books?tab=pending\"}','2025-09-10 08:28:26'),(16,2,'PENDING_APPROVAL','New Borrow Request','Cedrick Dimayuga (43434) has requested to borrow \"asdasd\" by asda. Click to review and approve.','QUEUED',NULL,NULL,'{\"transactionId\":12,\"bookTitle\":\"asdasd\",\"borrowerName\":\"Cedrick Dimayuga\",\"borrowerAccountId\":\"43434\",\"redirectUrl\":\"/books?tab=pending\"}','2025-09-10 10:23:52');
/*!40000 ALTER TABLE `notification_log` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `overdue_settlement`
--

DROP TABLE IF EXISTS `overdue_settlement`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `overdue_settlement` (
  `settlement_id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `transaction_type` enum('BOOK','LOCKER') NOT NULL,
  `transaction_id` int(11) NOT NULL,
  `penalty_amount` decimal(10,2) NOT NULL,
  `amount_paid` decimal(10,2) NOT NULL DEFAULT 0.00,
  `remaining_balance` decimal(10,2) NOT NULL,
  `status` enum('PENDING','PARTIAL','SETTLED') NOT NULL DEFAULT 'PENDING',
  `settled_at` datetime DEFAULT NULL,
  `processed_by` int(11) DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL,
  PRIMARY KEY (`settlement_id`),
  KEY `overdue_settlement_user_id_idx` (`user_id`),
  KEY `overdue_settlement_transaction_type_idx` (`transaction_type`),
  KEY `overdue_settlement_transaction_id_idx` (`transaction_id`),
  KEY `overdue_settlement_status_idx` (`status`),
  KEY `overdue_settlement_created_at_idx` (`created_at`),
  CONSTRAINT `overdue_settlement_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `user` (`user_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `overdue_settlement`
--

LOCK TABLES `overdue_settlement` WRITE;
/*!40000 ALTER TABLE `overdue_settlement` DISABLE KEYS */;
INSERT INTO `overdue_settlement` VALUES (1,3,'BOOK',2,30.00,30.00,0.00,'SETTLED','2025-09-10 09:20:37',2,NULL,'2025-09-10 01:07:25','2025-09-10 09:20:37');
/*!40000 ALTER TABLE `overdue_settlement` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `penalty_config`
--

DROP TABLE IF EXISTS `penalty_config`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `penalty_config` (
  `config_id` int(11) NOT NULL AUTO_INCREMENT,
  `type` enum('BOOK','LOCKER') NOT NULL,
  `penalty_per_day` decimal(10,2) NOT NULL,
  `penalty_per_hour` decimal(10,2) DEFAULT NULL,
  `grace_period_days` int(11) NOT NULL DEFAULT 0,
  `grace_period_hours` int(11) DEFAULT 0,
  `max_penalty` decimal(10,2) DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL,
  PRIMARY KEY (`config_id`),
  KEY `penalty_config_type_is_active_idx` (`type`,`is_active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `penalty_config`
--

LOCK TABLES `penalty_config` WRITE;
/*!40000 ALTER TABLE `penalty_config` DISABLE KEYS */;
/*!40000 ALTER TABLE `penalty_config` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `program`
--

DROP TABLE IF EXISTS `program`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `program` (
  `program_id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL,
  `code` varchar(10) NOT NULL,
  `description` text DEFAULT NULL,
  `department_id` int(11) NOT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL,
  `archived_at` datetime DEFAULT NULL,
  PRIMARY KEY (`program_id`),
  UNIQUE KEY `program_name_key` (`name`),
  UNIQUE KEY `program_code_key` (`code`),
  KEY `program_code_idx` (`code`),
  KEY `program_department_id_idx` (`department_id`),
  KEY `program_is_active_idx` (`is_active`),
  KEY `program_archived_at_idx` (`archived_at`),
  CONSTRAINT `program_department_id_fkey` FOREIGN KEY (`department_id`) REFERENCES `department` (`department_id`) ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=17 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `program`
--

LOCK TABLES `program` WRITE;
/*!40000 ALTER TABLE `program` DISABLE KEYS */;
INSERT INTO `program` VALUES (1,'Bachelor of Science in Information Technology','BSIT',NULL,1,1,'2025-09-09 21:27:42','2025-09-10 05:27:42',NULL),(2,'Computer Science','CS','Bachelor of Science in Computer Science',3,0,'2025-09-10 07:39:49','2025-09-10 16:24:03',NULL),(3,'Information Technology','IT','Bachelor of Science in Information Technology',3,1,'2025-09-10 07:39:49','2025-09-10 15:39:49',NULL),(4,'Civil Engineering','CE','Bachelor of Science in Civil Engineering',3,1,'2025-09-10 07:39:49','2025-09-10 15:39:49',NULL),(5,'Electrical Engineering','EE','Bachelor of Science in Electrical Engineering',3,1,'2025-09-10 07:39:49','2025-09-10 15:39:49',NULL),(6,'Psychology','PSYC','Bachelor of Arts in Psychology',4,1,'2025-09-10 07:39:49','2025-09-10 15:39:49',NULL),(7,'English Literature','ENGL','Bachelor of Arts in English Literature',4,1,'2025-09-10 07:39:49','2025-09-10 15:39:49',NULL),(8,'Mathematics','MATH','Bachelor of Science in Mathematics',4,1,'2025-09-10 07:39:49','2025-09-10 15:39:49',NULL),(9,'Biology','BIO','Bachelor of Science in Biology',4,1,'2025-09-10 07:39:49','2025-09-10 15:39:49',NULL),(10,'Business Administration','BA','Bachelor of Science in Business Administration',5,1,'2025-09-10 07:39:49','2025-09-10 15:39:49',NULL),(11,'Accounting','ACCT','Bachelor of Science in Accounting',5,1,'2025-09-10 07:39:49','2025-09-10 15:39:49',NULL),(12,'Marketing','MKT','Bachelor of Science in Marketing',5,1,'2025-09-10 07:39:49','2025-09-10 15:39:49',NULL),(13,'Finance','FIN','Bachelor of Science in Finance',5,1,'2025-09-10 07:39:49','2025-09-10 15:39:49',NULL),(14,'Elementary Education','ELED','Bachelor of Elementary Education',6,1,'2025-09-10 07:39:49','2025-09-10 15:39:49',NULL),(15,'Secondary Education','SCED','Bachelor of Secondary Education',6,1,'2025-09-10 07:39:49','2025-09-10 15:39:49',NULL),(16,'Special Education','SPED','Bachelor of Special Education',6,1,'2025-09-10 07:39:49','2025-09-10 15:39:49',NULL);
/*!40000 ALTER TABLE `program` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `report_log`
--

DROP TABLE IF EXISTS `report_log`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `report_log` (
  `report_id` int(11) NOT NULL AUTO_INCREMENT,
  `module` enum('ENTRY','BOOK','LOCKER','USER','AUDIT','SYSTEM') NOT NULL,
  `title` varchar(200) NOT NULL,
  `parameters` longtext DEFAULT NULL,
  `file_path` varchar(500) DEFAULT NULL,
  `date_generated` timestamp NOT NULL DEFAULT current_timestamp(),
  `generated_by` int(11) NOT NULL,
  `download_count` int(11) NOT NULL DEFAULT 0,
  PRIMARY KEY (`report_id`),
  KEY `report_log_generated_by_idx` (`generated_by`),
  KEY `report_log_module_idx` (`module`),
  KEY `report_log_date_generated_idx` (`date_generated`),
  CONSTRAINT `report_log_generated_by_fkey` FOREIGN KEY (`generated_by`) REFERENCES `user` (`user_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `report_log`
--

LOCK TABLES `report_log` WRITE;
/*!40000 ALTER TABLE `report_log` DISABLE KEYS */;
/*!40000 ALTER TABLE `report_log` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `session`
--

DROP TABLE IF EXISTS `session`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `session` (
  `session_id` int(11) NOT NULL AUTO_INCREMENT,
  `session_token` varchar(191) NOT NULL,
  `user_account_id` int(11) NOT NULL,
  `ip_address` varchar(45) DEFAULT NULL,
  `user_agent` text DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `expires_at` datetime NOT NULL,
  `last_activity` datetime NOT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (`session_id`),
  UNIQUE KEY `session_session_token_key` (`session_token`),
  KEY `session_user_account_id_idx` (`user_account_id`),
  KEY `session_expires_at_is_active_idx` (`expires_at`,`is_active`),
  KEY `session_last_activity_idx` (`last_activity`),
  CONSTRAINT `session_user_account_id_fkey` FOREIGN KEY (`user_account_id`) REFERENCES `user_account` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `session`
--

LOCK TABLES `session` WRITE;
/*!40000 ALTER TABLE `session` DISABLE KEYS */;
/*!40000 ALTER TABLE `session` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `system_config`
--

DROP TABLE IF EXISTS `system_config`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `system_config` (
  `config_id` int(11) NOT NULL AUTO_INCREMENT,
  `key` varchar(100) NOT NULL,
  `value` text NOT NULL,
  `description` text DEFAULT NULL,
  `data_type` enum('STRING','NUMBER','BOOLEAN','JSON') NOT NULL DEFAULT 'STRING',
  `is_encrypted` tinyint(1) NOT NULL DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL,
  PRIMARY KEY (`config_id`),
  UNIQUE KEY `system_config_key_key` (`key`),
  KEY `system_config_key_idx` (`key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `system_config`
--

LOCK TABLES `system_config` WRITE;
/*!40000 ALTER TABLE `system_config` DISABLE KEYS */;
/*!40000 ALTER TABLE `system_config` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `user`
--

DROP TABLE IF EXISTS `user`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `user` (
  `user_id` int(11) NOT NULL AUTO_INCREMENT,
  `account_id` varchar(20) NOT NULL,
  `full_name` varchar(100) NOT NULL,
  `user_type` enum('STUDENT','EMPLOYEE','ALUMNI','GUEST') NOT NULL,
  `department_id` int(11) DEFAULT NULL,
  `program_id` int(11) DEFAULT NULL,
  `year_level` varchar(10) DEFAULT NULL,
  `email` varchar(100) DEFAULT NULL,
  `rfid_code` varchar(50) DEFAULT NULL,
  `purpose` varchar(100) DEFAULT NULL,
  `contact_number` varchar(20) DEFAULT NULL,
  `status` enum('ACTIVE','ARCHIVED','INACTIVE','SUSPENDED') NOT NULL DEFAULT 'ACTIVE',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL,
  `archived_at` datetime DEFAULT NULL,
  PRIMARY KEY (`user_id`),
  UNIQUE KEY `user_account_id_key` (`account_id`),
  UNIQUE KEY `user_email_key` (`email`),
  UNIQUE KEY `user_rfid_code_key` (`rfid_code`),
  KEY `user_user_type_status_idx` (`user_type`,`status`),
  KEY `user_department_id_idx` (`department_id`),
  KEY `user_program_id_idx` (`program_id`),
  KEY `user_created_at_idx` (`created_at`),
  KEY `user_full_name_idx` (`full_name`),
  KEY `user_archived_at_idx` (`archived_at`),
  CONSTRAINT `user_department_id_fkey` FOREIGN KEY (`department_id`) REFERENCES `department` (`department_id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `user_program_id_fkey` FOREIGN KEY (`program_id`) REFERENCES `program` (`program_id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `user`
--

LOCK TABLES `user` WRITE;
/*!40000 ALTER TABLE `user` DISABLE KEYS */;
INSERT INTO `user` VALUES (1,'ADMIN001','System Administrator','EMPLOYEE',NULL,NULL,NULL,'admin@dwcc.edu.ph',NULL,NULL,NULL,'ACTIVE','2025-09-09 21:13:32','2025-09-10 05:13:32',NULL),(2,'43434','Cedrick Dimayuga','STUDENT',1,1,'3rd Year',NULL,NULL,NULL,NULL,'ACTIVE','2025-09-09 21:28:11','2025-09-10 05:28:11',NULL),(3,'43555','Emee','STUDENT',1,1,'4th Year',NULL,NULL,NULL,NULL,'ACTIVE','2025-09-09 23:07:43','2025-09-10 07:07:43',NULL),(4,'454666','efgdg','STUDENT',1,1,'4th Year',NULL,NULL,NULL,NULL,'ACTIVE','2025-09-09 23:25:42','2025-09-10 07:25:42',NULL);
/*!40000 ALTER TABLE `user` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `user_account`
--

DROP TABLE IF EXISTS `user_account`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `user_account` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `username` varchar(50) NOT NULL,
  `password_hash` text NOT NULL,
  `role` enum('SUPER_ADMIN','ADMIN','STAFF','USER') NOT NULL,
  `last_login` datetime DEFAULT NULL,
  `login_attempts` int(11) NOT NULL DEFAULT 0,
  `locked_until` datetime DEFAULT NULL,
  `user_id` int(11) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  UNIQUE KEY `user_account_username_key` (`username`),
  UNIQUE KEY `user_account_user_id_key` (`user_id`),
  KEY `user_account_role_is_active_idx` (`role`,`is_active`),
  KEY `user_account_last_login_idx` (`last_login`),
  KEY `user_account_locked_until_idx` (`locked_until`),
  CONSTRAINT `user_account_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `user` (`user_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `user_account`
--

LOCK TABLES `user_account` WRITE;
/*!40000 ALTER TABLE `user_account` DISABLE KEYS */;
INSERT INTO `user_account` VALUES (1,'admin','$2b$12$2BKiUPlWkecoaxnDwdfHK.ucn5CZcVp5Bv3fqgvtTmIQOAM72Z/Bm','SUPER_ADMIN','2025-09-10 19:12:23',0,NULL,1,'2025-09-09 21:13:32','2025-09-10 15:30:01',1),(2,'43434','$2b$12$/SBVv9zDPfp.KoBmv33pKOvh78KF2/jlGTWaW5IZHLKBvUZPqom/u','ADMIN','2025-09-10 16:52:20',0,NULL,2,'2025-09-09 21:28:45','2025-09-10 16:52:12',1),(3,'43555','$2b$12$ec26F5lgI8vT//ac9eX9Lu2M6abjz1tzKAzFxyEvMGV7ibgY87Pni','USER','2025-09-10 16:27:37',0,NULL,3,'2025-09-09 23:27:03','2025-09-10 16:52:48',1),(4,'454666','$2b$12$ZlNhKvQ08EDz.FB/BALKzOv78WPn9JUS/u11I.1od40NzGoSum21K','STAFF','2025-09-10 16:27:52',0,NULL,4,'2025-09-10 04:41:15','2025-09-10 16:33:58',1);
/*!40000 ALTER TABLE `user_account` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping routines for database 'accesslib'
--
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2025-09-11  3:18:50
