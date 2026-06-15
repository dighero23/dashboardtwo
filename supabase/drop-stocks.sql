-- Drop Stock Tracker tables and column
DROP TABLE IF EXISTS alerts CASCADE;
DROP TABLE IF EXISTS price_cache CASCADE;
DROP TABLE IF EXISTS tickers CASCADE;
ALTER TABLE user_permissions DROP COLUMN IF EXISTS can_edit_stocks;
