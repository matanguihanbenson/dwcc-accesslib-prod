-- ============================================================
-- Slowly-changing-dimension snapshot for EntryLog.
-- ============================================================
-- The entrylog row references `user_id`, but the live
-- `user` row is mutable: a student advances year levels,
-- shifts programs, transfers departments, etc. Reports
-- pulled today for a "last year" date range would show
-- the user's CURRENT attributes, not the attributes they
-- had at the moment of the entry. This is the classic
-- slowly-changing-dimension problem.
--
-- Fix: stamp the relevant user attributes onto the
-- entrylog row at write time, so each entry carries its
-- own historical truth. Same pattern the row already
-- uses for `campus`, `entrance_id`, and `purpose` —
-- those are immutable per-entry, which is why reports
-- from last year still read them correctly.
--
-- This migration:
--   1. Adds 11 snapshot columns to `entrylog`.
--   2. Backfills every existing row from the *current*
--      `user` row. The backfill is best-effort for old
--      data (it reflects today's state, not the state at
--      the moment of the entry), but new entries will be
--      accurate forever.
--   3. Backfills `user_user_type` to a sensible default
--      (STUDENT) in the (theoretical) case of an existing
--      row whose user has been deleted (the FK is ON
--      DELETE CASCADE, so this should be empty in
--      practice).
-- ============================================================

-- 1. Snapshot columns
ALTER TABLE `entrylog`
  ADD COLUMN `user_year_level`       VARCHAR(10)  NULL AFTER `entrance_id`,
  ADD COLUMN `user_grade_level_id`   INT          NULL AFTER `user_year_level`,
  ADD COLUMN `user_program_id`       INT          NULL AFTER `user_grade_level_id`,
  ADD COLUMN `user_department_id`    INT          NULL AFTER `user_program_id`,
  ADD COLUMN `user_office_id`        INT          NULL AFTER `user_department_id`,
  ADD COLUMN `user_user_type`        ENUM('STUDENT','EMPLOYEE','ALUMNI','GUEST') NOT NULL DEFAULT 'STUDENT' AFTER `user_office_id`,
  ADD COLUMN `user_education_level`  ENUM('BASIC_EDUCATION','COLLEGE') NULL AFTER `user_user_type`,
  ADD COLUMN `user_full_name`        VARCHAR(100) NULL AFTER `user_education_level`,
  ADD COLUMN `user_department_name`  VARCHAR(200) NULL AFTER `user_full_name`,
  ADD COLUMN `user_program_name`     VARCHAR(200) NULL AFTER `user_department_name`,
  ADD COLUMN `user_grade_level_name` VARCHAR(50)  NULL AFTER `user_program_name`;

-- 2. Backfill scalar columns from the live `user` row.
--    LEFT JOIN because the user table is the source of
--    truth; if a user row is missing for some reason,
--    the snapshot just stays NULL.
UPDATE `entrylog` e
  LEFT JOIN `user` u ON u.user_id = e.user_id
  SET
    e.`user_year_level`       = u.`year_level`,
    e.`user_grade_level_id`   = u.`grade_level_id`,
    e.`user_program_id`       = u.`program_id`,
    e.`user_department_id`    = u.`department_id`,
    e.`user_office_id`        = u.`office_id`,
    e.`user_user_type`        = COALESCE(u.`user_type`, 'STUDENT'),
    e.`user_education_level`  = u.`education_level`,
    e.`user_full_name`        = u.`full_name`
WHERE u.user_id IS NOT NULL;

-- 3. Backfill the denormalised name columns from the
--    lookup tables. Done as a separate UPDATE because the
--    joins are different (department, program, grade_level
--    are independent lookups). Any row whose lookup has
--    been deleted since the entry was logged falls back to
--    NULL, which is the same as if the lookup never
--    existed.
UPDATE `entrylog` e
  LEFT JOIN `department` d
    ON d.department_id = e.user_department_id
  SET e.`user_department_name` = d.`name`
WHERE e.`user_department_id` IS NOT NULL;

UPDATE `entrylog` e
  LEFT JOIN `program` p
    ON p.program_id = e.user_program_id
  SET e.`user_program_name` = p.`name`
WHERE e.`user_program_id` IS NOT NULL;

UPDATE `entrylog` e
  LEFT JOIN `grade_level` g
    ON g.grade_level_id = e.user_grade_level_id
  SET e.`user_grade_level_name` = g.`name`
WHERE e.`user_grade_level_id` IS NOT NULL;

-- 4. Indexes for the analytics breakdowns. The
--    `byYearLevel` / `byProgram` / `byDepartment` /
--    `byGradeLevel` groupings on the analytics endpoint
--    run on these columns, so they need to be indexed.
CREATE INDEX `entrylog_user_year_level_idx`        ON `entrylog` (`user_year_level`);
CREATE INDEX `entrylog_user_grade_level_id_idx`    ON `entrylog` (`user_grade_level_id`);
CREATE INDEX `entrylog_user_program_id_idx`        ON `entrylog` (`user_program_id`);
CREATE INDEX `entrylog_user_department_id_idx`     ON `entrylog` (`user_department_id`);
