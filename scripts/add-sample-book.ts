import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Adding sample book with comprehensive data...')

  try {
    // First, ensure we have at least one category
    let category = await prisma.bookCategory.findFirst()
    if (!category) {
      category = await prisma.bookCategory.create({
        data: {
          name: 'Fiction',
          description: 'Fiction books'
        }
      })
      console.log('Created Fiction category')
    }

    // Create a sample book with all fields
    const book = await prisma.book.create({
      data: {
        // Title Information
        title: 'The Great Gatsby',
        subtitle: 'A Novel of the Jazz Age',
        uniform_title: 'Great Gatsby',
        varying_form: 'Gatsby',
        
        // Standard Numbers
        isbn: '978-0-7432-7356-5',
        issn: null,
        lccn: '2004110489',
        
        // Material Type
        material_type: 'BOOK',
        subtype: 'Hardcover',
        
        // Series Information
        series_title: 'American Classics Series',
        volume_number: '7',
        
        // Reading Level Information
        interest_level: 'Adult',
        lexile_code: '1070L',
        fountas_pinnell: 'Level Z',
        
        // Publication Information
        publisher: 'Scribner',
        publication_place: 'New York',
        publication_date: 'c2004',
        year_published: 2004,
        edition: 'Revised Edition',
        
        // Physical Description
        pages: 180,
        extent: '180 pages',
        size: '21 cm',
        other_details: 'Includes bibliographical references',
        
        // Content Information
        description: 'A classic novel of the 1920s American society',
        summary: 'Set in the summer of 1922, the novel follows the life of millionaire Jay Gatsby and his pursuit of his lost love, Daisy Buchanan.',
        notes: JSON.stringify([
          { type: 'Summary', content: 'A tale of excess and tragedy in 1920s America' },
          { type: 'Content', content: 'Contains themes of idealism, social upheaval, and excess' },
          { type: 'General', content: 'Winner of numerous literary awards' }
        ]),
        language: 'English',
        
        // Library Management
        category_id: category.category_id,
        section_id: null,
        location: 'Section A, Shelf 3',
        copies_total: 5,
        copies_available: 5,
        status: 'AVAILABLE',
        
        // Related data
        authors: {
          create: [
            {
              name: 'Fitzgerald, F. Scott',
              dates: '1896-1940',
              display_order: 1
            }
          ]
        },
        
        contributors: {
          create: [
            {
              name: 'Smith, John',
              role: 'Editor',
              dates: '1950-',
              display_order: 1
            },
            {
              name: 'Johnson, Mary',
              role: 'Illustrator',
              dates: '1965-',
              display_order: 2
            }
          ]
        },
        
        alternate_titles: {
          create: [
            {
              title: 'Gatsby',
              type: 'Short Title'
            },
            {
              title: 'El Gran Gatsby',
              type: 'Spanish Translation'
            }
          ]
        },
        
        links: {
          create: [
            {
              url: 'https://www.goodreads.com/book/show/4671.The_Great_Gatsby',
              description: 'Goodreads Page'
            },
            {
              url: 'https://en.wikipedia.org/wiki/The_Great_Gatsby',
              description: 'Wikipedia Entry'
            }
          ]
        },
        
        digital_content: {
          create: [
            {
              title: 'eBook Version',
              url: 'https://example.com/ebook/great-gatsby.pdf',
              file_type: 'PDF',
              file_size: 2048000, // 2MB in bytes
              description: 'Digital PDF version of the book'
            },
            {
              title: 'Audiobook',
              url: 'https://example.com/audiobook/great-gatsby.mp3',
              file_type: 'Audio',
              file_size: 52428800, // 50MB in bytes
              description: 'Narrated audiobook version'
            }
          ]
        }
      },
      include: {
        category: true,
        section: true,
        authors: true,
        contributors: true,
        alternate_titles: true,
        links: true,
        digital_content: true
      }
    })

    console.log('\n✅ Successfully created sample book!')
    console.log('\n📚 Book Details:')
    console.log('================')
    console.log(`ID: ${book.book_id}`)
    console.log(`Title: ${book.title}`)
    console.log(`Subtitle: ${book.subtitle}`)
    console.log(`ISBN: ${book.isbn}`)
    console.log(`Material Type: ${book.material_type}`)
    console.log(`Category: ${book.category.name}`)
    console.log(`Copies: ${book.copies_available}/${book.copies_total}`)
    
    console.log('\n👤 Authors:')
    book.authors.forEach(author => {
      console.log(`  - ${author.name} (${author.dates})`)
    })
    
    console.log('\n🤝 Contributors:')
    book.contributors.forEach(contributor => {
      console.log(`  - ${contributor.name} (${contributor.role})`)
    })
    
    console.log('\n📖 Alternate Titles:')
    book.alternate_titles.forEach(title => {
      console.log(`  - ${title.title} (${title.type})`)
    })
    
    console.log('\n🔗 Links:')
    book.links.forEach(link => {
      console.log(`  - ${link.description}: ${link.url}`)
    })
    
    console.log('\n💾 Digital Content:')
    book.digital_content.forEach(content => {
      console.log(`  - ${content.title} (${content.file_type}): ${content.url}`)
    })
    
    console.log('\n📊 Full Data Structure:')
    console.log(JSON.stringify(book, null, 2))

  } catch (error) {
    console.error('❌ Error adding book:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
