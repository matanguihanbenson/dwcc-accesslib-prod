-- Book Copies Migration Script
-- This script migrates the existing book system to support individual book copies

-- Start transaction
START TRANSACTION;

-- Step 1: Create new BookCondition enum
ALTER TABLE book_transaction ADD COLUMN condition_on_borrow ENUM('EXCELLENT', 'GOOD', 'FAIR', 'POOR', 'DAMAGED', 'MISSING') NULL;
ALTER TABLE book_transaction ADD COLUMN condition_on_return ENUM('EXCELLENT', 'GOOD', 'FAIR', 'POOR', 'DAMAGED', 'MISSING') NULL;

-- Step 2: Create the new book_copy table
CREATE TABLE book_copy (
    copy_id INT AUTO_INCREMENT PRIMARY KEY,
    book_id INT NOT NULL,
    copy_number VARCHAR(20) NOT NULL,
    barcode VARCHAR(50) NULL UNIQUE,
    condition ENUM('EXCELLENT', 'GOOD', 'FAIR', 'POOR', 'DAMAGED', 'MISSING') DEFAULT 'GOOD',
    status ENUM('AVAILABLE', 'BORROWED', 'MISSING', 'DAMAGED', 'ARCHIVED') DEFAULT 'AVAILABLE',
    location VARCHAR(50) NULL,
    acquisition_date DATE NULL,
    acquisition_cost DECIMAL(10,2) NULL,
    notes TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    archived_at DATETIME NULL,
    
    FOREIGN KEY (book_id) REFERENCES book(book_id) ON DELETE CASCADE,
    UNIQUE KEY unique_book_copy (book_id, copy_number),
    INDEX idx_book_copy_book_id (book_id),
    INDEX idx_book_copy_status (status),
    INDEX idx_book_copy_condition (condition),
    INDEX idx_book_copy_barcode (barcode),
    INDEX idx_book_copy_created_at (created_at),
    INDEX idx_book_copy_archived_at (archived_at)
);

-- Step 3: Migrate existing book data to create individual copies
-- For each existing book, create copies based on copies_total
INSERT INTO book_copy (book_id, copy_number, condition, status, location, created_at)
SELECT 
    book_id,
    CONCAT('C', LPAD(ROW_NUMBER() OVER (PARTITION BY book_id ORDER BY book_id), 3, '0')) as copy_number,
    'GOOD' as condition,
    CASE 
        WHEN status = 'AVAILABLE' AND copies_available > 0 THEN 'AVAILABLE'
        WHEN status = 'BORROWED' THEN 'AVAILABLE'  -- We'll handle borrowed books separately
        ELSE status
    END as status,
    location,
    created_at
FROM book
CROSS JOIN (
    SELECT 1 as n UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5 
    UNION SELECT 6 UNION SELECT 7 UNION SELECT 8 UNION SELECT 9 UNION SELECT 10
) numbers
WHERE numbers.n <= book.copies_total;

-- Step 4: Handle currently borrowed books
-- Set the first few copies as BORROWED based on (copies_total - copies_available)
UPDATE book_copy bc
JOIN (
    SELECT 
        book_id,
        (copies_total - copies_available) as borrowed_count
    FROM book
    WHERE copies_total > copies_available
) b ON bc.book_id = b.book_id
SET bc.status = 'BORROWED'
WHERE bc.copy_id IN (
    SELECT copy_id FROM (
        SELECT copy_id, ROW_NUMBER() OVER (PARTITION BY book_id ORDER BY copy_id) as rn
        FROM book_copy
        WHERE book_id = bc.book_id
    ) ranked
    WHERE rn <= b.borrowed_count
);

-- Step 5: Add copy_id column to book_transaction table
ALTER TABLE book_transaction ADD COLUMN copy_id INT NULL;

-- Step 6: Update existing transactions to point to specific copies
-- This assigns existing transactions to the first available copy of each book
UPDATE book_transaction bt
JOIN (
    SELECT 
        bt_inner.transaction_id,
        bc.copy_id,
        ROW_NUMBER() OVER (PARTITION BY bt_inner.book_id ORDER BY bt_inner.transaction_id) as rn
    FROM book_transaction bt_inner
    JOIN book_copy bc ON bt_inner.book_id = bc.book_id
    WHERE bc.status = 'BORROWED'
) copy_assignments ON bt.transaction_id = copy_assignments.transaction_id
SET bt.copy_id = copy_assignments.copy_id;

-- Step 7: For transactions without assigned copies (edge case), assign to any available copy
UPDATE book_transaction bt
JOIN book_copy bc ON bt.book_id = bc.book_id
SET bt.copy_id = bc.copy_id
WHERE bt.copy_id IS NULL
AND bc.copy_id = (
    SELECT MIN(copy_id) 
    FROM book_copy 
    WHERE book_id = bt.book_id
);

-- Step 8: Make copy_id NOT NULL and add foreign key constraint
ALTER TABLE book_transaction MODIFY COLUMN copy_id INT NOT NULL;
ALTER TABLE book_transaction ADD CONSTRAINT fk_book_transaction_copy 
    FOREIGN KEY (copy_id) REFERENCES book_copy(copy_id) ON DELETE CASCADE;

-- Step 9: Add indexes for copy_id
ALTER TABLE book_transaction DROP INDEX idx_book_transaction_book_id;
ALTER TABLE book_transaction ADD INDEX idx_book_transaction_copy_id (copy_id);

-- Step 10: Remove old columns from book table that are no longer needed
ALTER TABLE book DROP COLUMN copies_total;
ALTER TABLE book DROP COLUMN copies_available;
ALTER TABLE book DROP COLUMN status;

-- Step 11: Add new fields to book table for enhanced metadata
ALTER TABLE book ADD COLUMN description TEXT NULL;
ALTER TABLE book ADD COLUMN language VARCHAR(50) NULL;
ALTER TABLE book ADD COLUMN pages INT NULL;
ALTER TABLE book ADD COLUMN edition VARCHAR(50) NULL;

-- Step 12: Remove old foreign key constraint from book_transaction to book
ALTER TABLE book_transaction DROP FOREIGN KEY book_transaction_book_id_fkey;

-- Step 13: Drop the old book_id column from book_transaction
ALTER TABLE book_transaction DROP COLUMN book_id;

-- Commit the transaction
COMMIT;

-- Verify the migration
SELECT 
    'Migration completed successfully' as status,
    (SELECT COUNT(*) FROM book) as total_books,
    (SELECT COUNT(*) FROM book_copy) as total_copies,
    (SELECT COUNT(*) FROM book_copy WHERE status = 'AVAILABLE') as available_copies,
    (SELECT COUNT(*) FROM book_copy WHERE status = 'BORROWED') as borrowed_copies,
    (SELECT COUNT(*) FROM book_transaction WHERE copy_id IS NOT NULL) as transactions_with_copies;
