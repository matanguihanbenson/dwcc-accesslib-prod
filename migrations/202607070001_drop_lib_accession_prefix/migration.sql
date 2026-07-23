-- Drop the `LIB` prefix everywhere it appears in the system.
--
-- The library never printed a `LIB-` prefix on its physical
-- stickers, so the prefix was just noise in the database. The
-- code that renders accession numbers (see `lib/accession-number.ts`)
-- now omits the prefix entirely, so new copies come out as plain
-- zero-padded integers (e.g. `48001`). The `prefix` column on
-- `accession_number_sequence` is removed in a follow-up migration
-- (`202607150001_drop_accession_number_sequence_prefix`).
--
-- This migration:
--   1. Clears `prefix` on the `accession_number_sequence` row
--      so the in-app `formatAccessionNumber` helper renders
--      bare integers right away (the column itself is dropped
--      in the follow-up migration).
--   2. Strips the leading `LIB-` prefix from every existing
--      `book_copy.accession_number` row, in place.
--
-- The lookup endpoint (`/api/books/lookup/accession/[accessionNumber]`)
-- does an exact-match `where: { accession_number }`, so it works
-- for both `48001` (new) and `LIB-48001` (legacy) - after this
-- migration runs, every existing row is also in the new format.

UPDATE `accession_number_sequence`
SET `prefix` = ''
WHERE `prefix` = 'LIB';

UPDATE `book_copy`
SET `accession_number` = TRIM(LEADING 'LIB-' FROM `accession_number`)
WHERE `accession_number` LIKE 'LIB-%';
