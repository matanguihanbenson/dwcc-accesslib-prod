// Seed the four Basic-Education `education_level` values
// (KINDERGARTEN, ELEMENTARY, JUNIOR_HIGH, SENIOR_HIGH) with
// the standard PH grade levels. The library add-user
// page filters `/api/grade-levels?education_level=…` for
// each of these; without this seed the Grade Level select
// is empty and the form can't proceed.
//
// Safe to re-run: every grade level is upserted on its
// unique `code` so re-running this script after the values
// are in place is a no-op (other than bumping `updated_at`).
//
// Usage:  node scripts/seed-grade-levels.js

const { PrismaClient, EducationLevel } = require('@prisma/client')
const prisma = new PrismaClient()

// Standard PH Basic Education sequence:
//   K (Kindergarten)  → KINDERGARTEN, level 0
//   Grade 1–6          → ELEMENTARY,   levels 1–6
//   Grade 7–10         → JUNIOR_HIGH,  levels 7–10
//   Grade 11–12        → SENIOR_HIGH,  levels 11–12
// (Codes use a short prefix that survives a CSV export /
// barcode label; e.g. "K", "G1", "G7", "G11".)
const SEED = [
  { code: 'K',  name: 'Kindergarten',  level_number: 0,  education_level: EducationLevel.KINDERGARTEN },
  { code: 'G1', name: 'Grade 1',       level_number: 1,  education_level: EducationLevel.ELEMENTARY },
  { code: 'G2', name: 'Grade 2',       level_number: 2,  education_level: EducationLevel.ELEMENTARY },
  { code: 'G3', name: 'Grade 3',       level_number: 3,  education_level: EducationLevel.ELEMENTARY },
  { code: 'G4', name: 'Grade 4',       level_number: 4,  education_level: EducationLevel.ELEMENTARY },
  { code: 'G5', name: 'Grade 5',       level_number: 5,  education_level: EducationLevel.ELEMENTARY },
  { code: 'G6', name: 'Grade 6',       level_number: 6,  education_level: EducationLevel.ELEMENTARY },
  { code: 'G7', name: 'Grade 7',       level_number: 7,  education_level: EducationLevel.JUNIOR_HIGH },
  { code: 'G8', name: 'Grade 8',       level_number: 8,  education_level: EducationLevel.JUNIOR_HIGH },
  { code: 'G9', name: 'Grade 9',       level_number: 9,  education_level: EducationLevel.JUNIOR_HIGH },
  { code: 'G10', name: 'Grade 10',     level_number: 10, education_level: EducationLevel.JUNIOR_HIGH },
  { code: 'G11', name: 'Grade 11',     level_number: 11, education_level: EducationLevel.SENIOR_HIGH },
  { code: 'G12', name: 'Grade 12',     level_number: 12, education_level: EducationLevel.SENIOR_HIGH },
]

async function main() {
  let created = 0
  let updated = 0
  for (const row of SEED) {
    const existing = await prisma.gradeLevel.findUnique({
      where: { code: row.code }
    })
    if (existing) {
      // Keep the existing code but bring the rest of the
      // fields in line with the canonical seed (level number,
      // education level, name). `is_active` and `archived_at`
      // are left alone so a soft-archived grade level stays
      // archived.
      await prisma.gradeLevel.update({
        where: { grade_level_id: existing.grade_level_id },
        data: {
          name: row.name,
          level_number: row.level_number,
          education_level: row.education_level
        }
      })
      updated++
    } else {
      await prisma.gradeLevel.create({
        data: {
          code: row.code,
          name: row.name,
          level_number: row.level_number,
          education_level: row.education_level,
          is_active: true
        }
      })
      created++
    }
  }
  console.log(`Done. Created: ${created}, Updated: ${updated}, Total: ${SEED.length}`)
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (err) => {
    console.error('Seed failed:', err)
    await prisma.$disconnect()
    process.exit(1)
  })
