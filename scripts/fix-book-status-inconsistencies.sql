-- Fix inconsistent book statuses
-- This script corrects books that have available copies but are marked as BORROWED

UPDATE book 
SET status = 'AVAILABLE' 
WHERE copies_available > 0 
  AND status = 'BORROWED'
  AND copies_total > 0;

-- Update books with no available copies to BORROWED status
UPDATE book 
SET status = 'BORROWED' 
WHERE copies_available = 0 
  AND status = 'AVAILABLE'
  AND copies_total > 0;

-- Fix books where copies_available is greater than copies_total (data inconsistency)
UPDATE book 
SET copies_available = copies_total 
WHERE copies_available > copies_total;

-- Fix books where copies_available is negative (should never happen)
UPDATE book 
SET copies_available = 0,
    status = 'BORROWED'
WHERE copies_available < 0;

-- Verify the results
SELECT 
  status,
  COUNT(*) as count,
  SUM(copies_total) as total_books,
  SUM(copies_available) as available_books
FROM book 
WHERE status != 'ARCHIVED'
GROUP BY status;

-- Show any remaining inconsistencies
SELECT 
  book_id,
  title,
  status,
  copies_total,
  copies_available,
  CASE 
    WHEN copies_available > 0 AND status = 'BORROWED' THEN 'Should be AVAILABLE'
    WHEN copies_available = 0 AND status = 'AVAILABLE' THEN 'Should be BORROWED'
    WHEN copies_available > copies_total THEN 'Available > Total'
    WHEN copies_available < 0 THEN 'Negative available'
    ELSE 'OK'
  END as issue
FROM book 
WHERE 
  (copies_available > 0 AND status = 'BORROWED') OR
  (copies_available = 0 AND status = 'AVAILABLE') OR
  (copies_available > copies_total) OR
  (copies_available < 0);
