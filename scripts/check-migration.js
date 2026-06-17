const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function checkTables() {
  try {
    console.log('Checking if new tables exist...\n')
    
    const tables = ['book_author', 'book_contributor', 'alternate_title', 'book_link', 'digital_content']
    
    for (const table of tables) {
      try {
        const result = await prisma.$queryRawUnsafe(`SHOW TABLES LIKE '${table}'`)
        if (result.length > 0) {
          console.log(`✅ ${table} - EXISTS`)
        } else {
          console.log(`❌ ${table} - NOT FOUND`)
        }
      } catch (error) {
        console.log(`❌ ${table} - ERROR: ${error.message}`)
      }
    }
    
    // Check book table for new columns
    console.log('\nChecking book table for new columns...')
    const bookColumns = await prisma.$queryRawUnsafe(`SHOW COLUMNS FROM book`)
    const newColumns = ['material_type', 'subtitle', 'issn', 'lccn', 'series_title']
    
    for (const col of newColumns) {
      const exists = bookColumns.some(c => c.Field === col)
      if (exists) {
        console.log(`✅ book.${col} - EXISTS`)
      } else {
        console.log(`❌ book.${col} - NOT FOUND`)
      }
    }
    
  } catch (error) {
    console.error('Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

checkTables()


