-- Enhanced Book Cataloging System Migration
-- This migration updates the book management system to professional library cataloging standards

-- Step 1: Create MaterialType enum
DO $$ BEGIN
    CREATE TYPE "MaterialType" AS ENUM ('BOOK', 'EBOOK', 'AUDIOBOOK', 'DVD', 'CD', 'PERIODICAL', 'MAGAZINE', 'JOURNAL', 'REFERENCE', 'THESIS', 'OTHER');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Step 2: Create new tables for related entities

-- Book Authors (Main authors)
CREATE TABLE IF NOT EXISTS "book_author" (
    "id" SERIAL PRIMARY KEY,
    "book_id" INTEGER NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "dates" VARCHAR(100),
    "display_order" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "book_author_book_id_fkey" FOREIGN KEY ("book_id") REFERENCES "book"("book_id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "book_author_book_id_idx" ON "book_author"("book_id");

-- Book Contributors (Co-authors, Illustrators, Editors, etc.)
CREATE TABLE IF NOT EXISTS "book_contributor" (
    "id" SERIAL PRIMARY KEY,
    "book_id" INTEGER NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "role" VARCHAR(100) NOT NULL,
    "dates" VARCHAR(100),
    "display_order" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "book_contributor_book_id_fkey" FOREIGN KEY ("book_id") REFERENCES "book"("book_id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "book_contributor_book_id_idx" ON "book_contributor"("book_id");

-- Alternate Titles
CREATE TABLE IF NOT EXISTS "alternate_title" (
    "id" SERIAL PRIMARY KEY,
    "book_id" INTEGER NOT NULL,
    "title" VARCHAR(300) NOT NULL,
    "type" VARCHAR(50) NOT NULL,
    "created_at" TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "alternate_title_book_id_fkey" FOREIGN KEY ("book_id") REFERENCES "book"("book_id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "alternate_title_book_id_idx" ON "alternate_title"("book_id");

-- Electronic Resources/Links
CREATE TABLE IF NOT EXISTS "book_link" (
    "id" SERIAL PRIMARY KEY,
    "book_id" INTEGER NOT NULL,
    "url" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "book_link_book_id_fkey" FOREIGN KEY ("book_id") REFERENCES "book"("book_id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "book_link_book_id_idx" ON "book_link"("book_id");

-- Digital Content
CREATE TABLE IF NOT EXISTS "digital_content" (
    "id" SERIAL PRIMARY KEY,
    "book_id" INTEGER NOT NULL,
    "title" VARCHAR(300) NOT NULL,
    "file_path" TEXT,
    "file_type" VARCHAR(50),
    "file_size" INTEGER,
    "url" TEXT,
    "description" TEXT,
    "created_at" TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "digital_content_book_id_fkey" FOREIGN KEY ("book_id") REFERENCES "book"("book_id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "digital_content_book_id_idx" ON "digital_content"("book_id");

-- Step 3: Backup existing author data before altering book table
-- Create temporary table to store existing book author data
CREATE TEMP TABLE IF NOT EXISTS temp_book_authors AS
SELECT book_id, book_author 
FROM book 
WHERE book_author IS NOT NULL AND book_author != '';

-- Step 4: Alter book table to add new fields
-- Add new title fields
ALTER TABLE "book" ADD COLUMN IF NOT EXISTS "subtitle" VARCHAR(300);
ALTER TABLE "book" ADD COLUMN IF NOT EXISTS "uniform_title" VARCHAR(300);
ALTER TABLE "book" ADD COLUMN IF NOT EXISTS "varying_form" VARCHAR(300);

-- Modify title field to allow longer titles
ALTER TABLE "book" ALTER COLUMN "title" TYPE VARCHAR(300);

-- Add standard numbers
ALTER TABLE "book" ADD COLUMN IF NOT EXISTS "issn" VARCHAR(20);
ALTER TABLE "book" ADD COLUMN IF NOT EXISTS "lccn" VARCHAR(50);

-- Add material type
ALTER TABLE "book" ADD COLUMN IF NOT EXISTS "material_type" "MaterialType" DEFAULT 'BOOK';

-- Add subtype
ALTER TABLE "book" ADD COLUMN IF NOT EXISTS "subtype" VARCHAR(50);

-- Add series information
ALTER TABLE "book" ADD COLUMN IF NOT EXISTS "series_title" VARCHAR(300);
ALTER TABLE "book" ADD COLUMN IF NOT EXISTS "volume_number" VARCHAR(50);

-- Add reading level information
ALTER TABLE "book" ADD COLUMN IF NOT EXISTS "interest_level" VARCHAR(50);
ALTER TABLE "book" ADD COLUMN IF NOT EXISTS "lexile_code" VARCHAR(50);
ALTER TABLE "book" ADD COLUMN IF NOT EXISTS "fountas_pinnell" VARCHAR(10);

-- Add publication information
ALTER TABLE "book" ADD COLUMN IF NOT EXISTS "publication_place" VARCHAR(200);
ALTER TABLE "book" ADD COLUMN IF NOT EXISTS "publication_date" VARCHAR(50);
ALTER TABLE "book" ALTER COLUMN "publisher" TYPE VARCHAR(200);
ALTER TABLE "book" ALTER COLUMN "edition" TYPE VARCHAR(100);

-- Add physical description
ALTER TABLE "book" ADD COLUMN IF NOT EXISTS "extent" VARCHAR(200);
ALTER TABLE "book" ADD COLUMN IF NOT EXISTS "size" VARCHAR(50);
ALTER TABLE "book" ADD COLUMN IF NOT EXISTS "other_details" TEXT;

-- Add content information
ALTER TABLE "book" ADD COLUMN IF NOT EXISTS "summary" TEXT;
ALTER TABLE "book" ALTER COLUMN "notes" TYPE TEXT;

-- Add metadata fields
ALTER TABLE "book" ADD COLUMN IF NOT EXISTS "created_by" INTEGER;
ALTER TABLE "book" ADD COLUMN IF NOT EXISTS "updated_by" INTEGER;

-- Update location field
ALTER TABLE "book" ALTER COLUMN "location" TYPE VARCHAR(100);

-- Step 5: Create indexes for new fields
CREATE INDEX IF NOT EXISTS "book_issn_idx" ON "book"("issn");
CREATE INDEX IF NOT EXISTS "book_lccn_idx" ON "book"("lccn");
CREATE INDEX IF NOT EXISTS "book_material_type_idx" ON "book"("material_type");

-- Step 6: Migrate existing author data to new book_author table
INSERT INTO "book_author" ("book_id", "name", "display_order")
SELECT book_id, book_author, 1
FROM temp_book_authors
ON CONFLICT DO NOTHING;

-- Step 7: Update existing books to set default material_type
UPDATE "book" SET "material_type" = 'BOOK' WHERE "material_type" IS NULL;

-- Drop temporary table
DROP TABLE IF EXISTS temp_book_authors;

-- Step 8: Add comment to book_author column (for reference, will be phased out)
COMMENT ON COLUMN "book"."book_author" IS 'Legacy field - use book_author table instead';

-- Migration complete
-- Note: The book_author column is kept for backward compatibility
-- New implementations should use the book_author relation table

