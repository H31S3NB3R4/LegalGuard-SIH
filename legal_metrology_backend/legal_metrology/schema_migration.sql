-- ============================================================================
-- LegalGuard — Schema Migration (from the OLD minimal schema to the canonical one)
-- ----------------------------------------------------------------------------
-- Run this against an EXISTING amazon_scraper_db that was created from the old
-- dump.sql / schema.txt (which lacked users.mt_tokens, gifts, gifts_redeemed,
-- and products.product_json_raw). It is idempotent (each statement checks for
-- existence first). Safe to re-run.
--
--   mysql -h <host> -P <port> -u <user> -p amazon_scraper_db < schema_migration.sql
-- ============================================================================

USE `amazon_scraper_db`;

SET @db_name = 'amazon_scraper_db';

-- ----------------------------------------------------------------------------
-- 1. products.product_json_raw  (JSON column for raw scraper output)
-- ----------------------------------------------------------------------------
SET @stmt = (SELECT IF(
    (SELECT COUNT(*) FROM information_schema.columns
     WHERE table_schema = @db_name AND table_name = 'products'
       AND column_name = 'product_json_raw') = 0,
    'ALTER TABLE products ADD COLUMN product_json_raw json DEFAULT NULL COMMENT ''Raw scraper output (QA)''',
    'SELECT ''product_json_raw already exists'' AS msg'
));
PREPARE s FROM @stmt; EXECUTE s; DEALLOCATE PREPARE s;

-- ----------------------------------------------------------------------------
-- 2. users.mt_tokens  (Meta-Token reward balance)
-- ----------------------------------------------------------------------------
SET @stmt = (SELECT IF(
    (SELECT COUNT(*) FROM information_schema.columns
     WHERE table_schema = @db_name AND table_name = 'users'
       AND column_name = 'mt_tokens') = 0,
    'ALTER TABLE users ADD COLUMN mt_tokens int NOT NULL DEFAULT 0 COMMENT ''Meta-Token reward balance''',
    'SELECT ''mt_tokens already exists'' AS msg'
));
PREPARE s FROM @stmt; EXECUTE s; DEALLOCATE PREPARE s;

-- ----------------------------------------------------------------------------
-- 3. gifts table
-- ----------------------------------------------------------------------------
SET @stmt = (SELECT IF(
    (SELECT COUNT(*) FROM information_schema.tables
     WHERE table_schema = @db_name AND table_name = 'gifts') = 0,
    'CREATE TABLE gifts (
        id int NOT NULL AUTO_INCREMENT,
        gift_code varchar(100) NOT NULL,
        gift_pin varchar(100) NOT NULL,
        partner varchar(255) DEFAULT NULL,
        value decimal(10,2) DEFAULT NULL,
        mt_tokens_required int NOT NULL DEFAULT 0,
        created_at timestamp NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY gift_code (gift_code)
     ) ENGINE=InnoDB',
    'SELECT ''gifts already exists'' AS msg'
));
PREPARE s FROM @stmt; EXECUTE s; DEALLOCATE PREPARE s;

-- ----------------------------------------------------------------------------
-- 4. gifts_redeemed table
-- ----------------------------------------------------------------------------
SET @stmt = (SELECT IF(
    (SELECT COUNT(*) FROM information_schema.tables
     WHERE table_schema = @db_name AND table_name = 'gifts_redeemed') = 0,
    'CREATE TABLE gifts_redeemed (
        id int NOT NULL AUTO_INCREMENT,
        user_id int NOT NULL,
        gift_id int NOT NULL,
        status varchar(50) NOT NULL DEFAULT ''Redeem'',
        redeemed_at timestamp NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_user_id (user_id),
        KEY idx_gift_id (gift_id),
        CONSTRAINT fk_redeemed_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        CONSTRAINT fk_redeemed_gift FOREIGN KEY (gift_id) REFERENCES gifts(id) ON DELETE CASCADE
     ) ENGINE=InnoDB',
    'SELECT ''gifts_redeemed already exists'' AS msg'
));
PREPARE s FROM @stmt; EXECUTE s; DEALLOCATE PREPARE s;

-- ----------------------------------------------------------------------------
-- 5. Foreign key + index hardening on products/images
-- ----------------------------------------------------------------------------
ALTER TABLE products ADD KEY idx_user_id_owner (user_id);

SET @stmt = (SELECT IF(
    (SELECT COUNT(*) FROM information_schema.statistics
     WHERE table_schema = @db_name AND table_name = 'images'
       AND index_name = 'fk_images_product') = 0,
    'ALTER TABLE images ADD CONSTRAINT fk_images_product FOREIGN KEY (product_id)
        REFERENCES products(product_id) ON DELETE CASCADE',
    'SELECT ''images FK already exists'' AS msg'
));
PREPARE s FROM @stmt; EXECUTE s; DEALLOCATE PREPARE s;

SELECT 'Migration complete' AS status;
