-- Drop the `prefix` column from `accession_number_sequence`.
--
-- The library wants accession numbers to be plain integers
-- (e.g. `48012`) with no prefix at all, and the previous
-- `202607070001_drop_lib_accession_prefix` migration already
-- cleared the column to the empty string. This migration
-- finishes the job by removing the column outright, so the
-- Prisma schema, the central helper in `lib/accession-number.ts`,
-- and the two copy-creation endpoints (`app/api/books/[book_id]/
-- copies/route.ts` and `app/api/books/[book_id]/copies/
-- initialize/route.ts`) can stop threading the value through
-- their `create` / `update` payloads.
--
-- The new generation path emits numbers as bare zero-padded
-- integers (e.g. `48012`). The lookup endpoint
-- (`/api/books/lookup/accession/[accessionNumber]`) does an
-- exact-match `where: { accession_number }` query and therefore
-- continues to work as long as every row was already stripped of
-- its `LIB-` prefix by the earlier migration.

ALTER TABLE `accession_number_sequence`
  DROP COLUMN `prefix`;
