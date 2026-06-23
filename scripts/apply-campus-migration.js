// Apply the campus designation migration directly against the configured
// MySQL database and then verify the columns / indexes exist.
//
// Usage:  node scripts/apply-campus-migration.js
//
// Safe to re-run: the script inspects the schema first and skips the
// ALTER TABLE statements when the column / index is already present. The
// script never DROPs anything, so running it on an up-to-date database
// is a no-op.
const { PrismaClient } = require('@prisma/client')
const fs = require('fs')
const path = require('path')

const prisma = new PrismaClient()

async function columnExists(table, column) {
  // Hard-coded table/column names -- no user input, so interpolation is safe.
  const rows = await prisma.$queryRawUnsafe(
    `SHOW COLUMNS FROM \`${table}\` LIKE '${column}'`
  )
  return Array.isArray(rows) && rows.length > 0
}

async function indexExists(table, index) {
  const rows = await prisma.$queryRawUnsafe(
    `SHOW INDEX FROM \`${table}\` WHERE Key_name = '${index}'`
  )
  return Array.isArray(rows) && rows.length > 0
}

async function applyAlter(sql, table, column) {
  if (await columnExists(table, column)) {
    console.log(`   - ${table}.${column} already exists, skipping`)
    return false
  }
  console.log(`   + ${sql.trim()}`)
  await prisma.$executeRawUnsafe(sql)
  return true
}

async function applyIndex(sql, table, index) {
  if (await indexExists(table, index)) {
    console.log(`   - index ${index} on ${table} already exists, skipping`)
    return false
  }
  console.log(`   + ${sql.trim()}`)
  await prisma.$executeRawUnsafe(sql)
  return true
}

async function main() {
  console.log('=== Campus designation migration ===\n')

  console.log('1) user_account.campus')
  await applyAlter(
    "ALTER TABLE `user_account` ADD COLUMN `campus` ENUM('COLLEGE', 'BASIC_EDUCATION') NULL DEFAULT 'COLLEGE'",
    'user_account',
    'campus'
  )
  await applyIndex(
    'CREATE INDEX `user_account_campus_idx` ON `user_account`(`campus`)',
    'user_account',
    'user_account_campus_idx'
  )

  console.log('\n2) entrylog.campus')
  await applyAlter(
    "ALTER TABLE `entrylog` ADD COLUMN `campus` ENUM('COLLEGE', 'BASIC_EDUCATION') NOT NULL DEFAULT 'COLLEGE'",
    'entrylog',
    'campus'
  )
  await applyIndex(
    'CREATE INDEX `entrylog_campus_idx` ON `entrylog`(`campus`)',
    'entrylog',
    'entrylog_campus_idx'
  )

  console.log('\n3) locker.campus')
  await applyAlter(
    "ALTER TABLE `locker` ADD COLUMN `campus` ENUM('COLLEGE', 'BASIC_EDUCATION') NOT NULL DEFAULT 'COLLEGE'",
    'locker',
    'campus'
  )
  await applyIndex(
    'CREATE INDEX `locker_campus_idx` ON `locker`(`campus`)',
    'locker',
    'locker_campus_idx'
  )

  console.log('\n4) Verification')
  for (const [t, c] of [
    ['user_account', 'campus'],
    ['entrylog', 'campus'],
    ['locker', 'campus']
  ]) {
    const ok = await columnExists(t, c)
    console.log(`   ${ok ? 'OK ' : 'MISSING'}  ${t}.${c}`)
  }
  for (const [t, i] of [
    ['user_account', 'user_account_campus_idx'],
    ['entrylog', 'entrylog_campus_idx'],
    ['locker', 'locker_campus_idx']
  ]) {
    const ok = await indexExists(t, i)
    console.log(`   ${ok ? 'OK ' : 'MISSING'}  index ${i} on ${t}`)
  }

  console.log('\n5) Quick row counts')
  const [{ userAccounts = 0 } = {}] = await prisma.$queryRawUnsafe(
    'SELECT COUNT(*) AS userAccounts FROM `user_account`'
  )
  const [{ staffAccounts = 0 } = {}] = await prisma.$queryRawUnsafe(
    "SELECT COUNT(*) AS staffAccounts FROM `user_account` WHERE role = 'STAFF'"
  )
  const [{ lockers = 0 } = {}] = await prisma.$queryRawUnsafe(
    'SELECT COUNT(*) AS lockers FROM `locker` WHERE archived_at IS NULL'
  )
  console.log(`   user_account rows: ${userAccounts}`)
  console.log(`   STAFF rows:        ${staffAccounts}`)
  console.log(`   active lockers:   ${lockers}`)

  console.log('\nDone.')
}

main()
  .catch((e) => {
    console.error('Migration failed:', e)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
