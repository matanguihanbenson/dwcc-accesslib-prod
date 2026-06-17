-- Performance optimization indexes for DWCC AccessLib
-- Run these indexes to improve query performance

-- Composite indexes for most common query patterns

-- BookTransaction table optimizations
CREATE INDEX IF NOT EXISTS idx_book_transaction_composite_status_date 
ON book_transaction(status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_book_transaction_composite_user_status 
ON book_transaction(user_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_book_transaction_composite_book_status 
ON book_transaction(book_id, status, borrow_date DESC);

CREATE INDEX IF NOT EXISTS idx_book_transaction_overdue 
ON book_transaction(due_date, status) 
WHERE status = 'ACTIVE' AND due_date < NOW();

-- Book table optimizations
CREATE INDEX IF NOT EXISTS idx_book_composite_search 
ON book(status, category_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_book_text_search 
ON book(title, book_author, isbn);

CREATE INDEX IF NOT EXISTS idx_book_availability 
ON book(status, copies_available) 
WHERE status = 'AVAILABLE' AND copies_available > 0;

-- User table optimizations  
CREATE INDEX IF NOT EXISTS idx_user_composite_active 
ON user(status, user_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_search_fields 
ON user(full_name, account_id, status);

-- UserAccount table optimizations
CREATE INDEX IF NOT EXISTS idx_user_account_login 
ON user_account(username, is_active, locked_until);

CREATE INDEX IF NOT EXISTS idx_user_account_role_active 
ON user_account(role, is_active, last_login DESC);

-- NotificationLog optimizations
CREATE INDEX IF NOT EXISTS idx_notification_user_status 
ON notification_log(user_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notification_pending 
ON notification_log(status, created_at) 
WHERE status IN ('QUEUED', 'SENT');

-- AuditLog optimizations
CREATE INDEX IF NOT EXISTS idx_audit_user_date 
ON auditlog(user_account_id, date_time_log DESC);

CREATE INDEX IF NOT EXISTS idx_audit_action_date 
ON auditlog(action, date_time_log DESC);

-- Session optimizations
CREATE INDEX IF NOT EXISTS idx_session_active 
ON session(user_account_id, is_active, expires_at);

CREATE INDEX IF NOT EXISTS idx_session_cleanup 
ON session(expires_at, is_active) 
WHERE is_active = TRUE;

-- EntryLog optimizations
CREATE INDEX IF NOT EXISTS idx_entry_log_user_time 
ON entrylog(user_id, entry_time DESC);

CREATE INDEX IF NOT EXISTS idx_entry_log_date_range 
ON entrylog(entry_time, exit_time);

-- LockerTransaction optimizations
CREATE INDEX IF NOT EXISTS idx_locker_transaction_active 
ON locker_transaction(status, due_time) 
WHERE status = 'ACTIVE';

CREATE INDEX IF NOT EXISTS idx_locker_transaction_user_status 
ON locker_transaction(user_id, status, borrow_time DESC);

-- Additional performance optimizations

-- Update table statistics for better query planning
ANALYZE TABLE book;
ANALYZE TABLE book_transaction;
ANALYZE TABLE user;
ANALYZE TABLE user_account;
ANALYZE TABLE notification_log;
ANALYZE TABLE auditlog;

-- Enable query cache (if not already enabled)
-- SET GLOBAL query_cache_type = ON;
-- SET GLOBAL query_cache_size = 268435456; -- 256MB

-- Optimize InnoDB settings for better performance
-- SET GLOBAL innodb_buffer_pool_size = 2147483648; -- 2GB (adjust based on available RAM)
-- SET GLOBAL innodb_log_file_size = 268435456; -- 256MB
-- SET GLOBAL innodb_flush_log_at_trx_commit = 2; -- Better performance with slight durability trade-off

-- Note: Global settings require SUPER privileges and server restart
-- For production, these should be set in my.cnf configuration file
