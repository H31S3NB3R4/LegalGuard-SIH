-- ============================================================================
-- LegalGuard — Legal Metrology Compliance Backend — Database Schema
-- ----------------------------------------------------------------------------
-- This is the canonical schema referenced by server.py (see the startup banner
-- at server.py:2027) and by the README. It reflects the REAL tables/columns that
-- the endpoints query. It replaces the earlier minimal dump.sql/schema.txt which
-- were missing: users.mt_tokens, gifts, gifts_redeemed, products.product_json_raw.
--
-- IMPORTANT (table-name casing): MySQL table names are case-sensitive on Linux
-- (Docker). The Python code uses mixed casing (Users/Products/Images/selleractivity
-- vs SellerActivity). To make the app work identically everywhere, the MySQL
-- server is started with `--lower_case_table_names=1` in docker-compose.yml.
-- If you run against an existing server, either enable lower_case_table_names=1
-- or keep the casing below identical to what server.py emits.
-- ============================================================================

CREATE DATABASE IF NOT EXISTS `amazon_scraper_db`
    CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

USE `amazon_scraper_db`;

-- ----------------------------------------------------------------------------
-- users
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `users` (
    `id` int NOT NULL AUTO_INCREMENT,
    `username` varchar(255) NOT NULL,
    `password` varchar(255) NOT NULL,
    `role` enum('customer','seller') NOT NULL DEFAULT 'customer',
    `mt_tokens` int NOT NULL DEFAULT 0 COMMENT 'Meta-Token reward balance',
    `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `username` (`username`)
) ENGINE=InnoDB;

-- ----------------------------------------------------------------------------
-- products
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `products` (
    `product_id` int NOT NULL AUTO_INCREMENT,
    `user_id` int NOT NULL,
    `url` varchar(1000) NOT NULL,
    `asin` varchar(50) NOT NULL,
    `title` text,
    `price` decimal(10,2) DEFAULT NULL,
    `currency` varchar(10) DEFAULT NULL,
    `country` varchar(50) DEFAULT NULL,
    `language` varchar(50) DEFAULT NULL,
    `seller_information` json DEFAULT NULL,
    `product_json` json DEFAULT NULL,
    `product_json_raw` json DEFAULT NULL COMMENT 'Raw scraper output (QA)',
    `analysis_results` text,
    `rating` decimal(3,2) DEFAULT NULL,
    `remarks` text,
    `last_analysed` datetime DEFAULT NULL,
    `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`product_id`),
    UNIQUE KEY `asin` (`asin`),
    KEY `idx_asin` (`asin`),
    KEY `idx_user_id` (`user_id`)
) ENGINE=InnoDB;

-- ----------------------------------------------------------------------------
-- images
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `images` (
    `image_id` int NOT NULL AUTO_INCREMENT,
    `product_id` int NOT NULL,
    `image_data` longblob NOT NULL,
    `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`image_id`),
    KEY `idx_product_id` (`product_id`),
    CONSTRAINT `fk_images_product` FOREIGN KEY (`product_id`)
        REFERENCES `products`(`product_id`) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ----------------------------------------------------------------------------
-- selleractivity  (heatmap + seller/customer activity log)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `selleractivity` (
    `activity_id` int NOT NULL AUTO_INCREMENT,
    `seller_id` int DEFAULT NULL COMMENT 'The seller who owns the scraped product',
    `customer_id` int DEFAULT NULL COMMENT 'The customer who scraped the product (NULL if seller)',
    `action` varchar(500) NOT NULL,
    `seller_information` json DEFAULT NULL,
    `location` varchar(255) DEFAULT NULL COMMENT 'Geographic location for heatmap',
    `latitude` decimal(10,8) DEFAULT NULL,
    `longitude` decimal(11,8) DEFAULT NULL,
    `timestamp` datetime NOT NULL,
    `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`activity_id`),
    KEY `idx_seller_id` (`seller_id`),
    KEY `idx_customer_id` (`customer_id`),
    KEY `idx_timestamp` (`timestamp`),
    KEY `idx_location` (`latitude`,`longitude`)
) ENGINE=InnoDB;

-- ----------------------------------------------------------------------------
-- gifts  (Meta-Token reward catalogue)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `gifts` (
    `id` int NOT NULL AUTO_INCREMENT,
    `gift_code` varchar(100) NOT NULL,
    `gift_pin` varchar(100) NOT NULL,
    `partner` varchar(255) DEFAULT NULL,
    `value` decimal(10,2) DEFAULT NULL,
    `mt_tokens_required` int NOT NULL DEFAULT 0,
    `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `gift_code` (`gift_code`)
) ENGINE=InnoDB;

-- ----------------------------------------------------------------------------
-- gifts_redeemed  (customer redemptions of gifts)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `gifts_redeemed` (
    `id` int NOT NULL AUTO_INCREMENT,
    `user_id` int NOT NULL,
    `gift_id` int NOT NULL,
    `status` varchar(50) NOT NULL DEFAULT 'Redeem',
    `redeemed_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `idx_user_id` (`user_id`),
    KEY `idx_gift_id` (`gift_id`),
    CONSTRAINT `fk_redeemed_user` FOREIGN KEY (`user_id`)
        REFERENCES `users`(`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_redeemed_gift` FOREIGN KEY (`gift_id`)
        REFERENCES `gifts`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB;
