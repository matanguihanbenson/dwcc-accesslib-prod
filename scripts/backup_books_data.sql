-- Backup current book data before migration
-- Run this script first to backup current data

CREATE TABLE book_backup AS SELECT * FROM book;
CREATE TABLE book_transaction_backup AS SELECT * FROM book_transaction;

SELECT 'Backup completed successfully' as status,
       (SELECT COUNT(*) FROM book_backup) as books_backed_up,
       (SELECT COUNT(*) FROM book_transaction_backup) as transactions_backed_up;
