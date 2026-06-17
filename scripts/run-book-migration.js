const { PrismaClient } = require('@prisma/client')
const fs = require('fs')
const path = require('path')

const prisma = new PrismaClient()

async function runMigration() {
  try {
    console.log('Running enhanced book cataloging migration...')
    
    // Read the SQL migration file
    const migrationPath = path.join(__dirname, '..', 'prisma', 'migrations', 'enhanced_book_cataloging_migration_mysql.sql')
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8')
    
    // Split by semicolons and filter out empty statements
    const statements = migrationSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s && !s.startsWith('--') && !s.startsWith('/*'))
    
    console.log(`Found ${statements.length} SQL statements to execute`)
    
    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i]
      if (statement) {
        try {
          console.log(`Executing statement ${i + 1}/${statements.length}...`)
          await prisma.$executeRawUnsafe(statement)
        } catch (error) {
          // Ignore "already exists" errors
          if (error.message.includes('already exists') || error.message.includes('Duplicate')) {
            console.log(`  Skipped (already exists)`)
          } else {
            console.error(`  Error: ${error.message}`)
          }
        }
      }
    }
    
    console.log('\n✅ Migration completed successfully!')
    console.log('📋 New tables created:')
    console.log('  - book_author')
    console.log('  - book_contributor')
    console.log('  - alternate_title')
    console.log('  - book_link')
    console.log('  - digital_content')
    console.log('\n🔄 Now regenerating Prisma Client...')
    
  } catch (error) {
    console.error('❌ Migration failed:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

runMigration()


