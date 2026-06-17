/* eslint-disable @typescript-eslint/no-require-imports */
const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding categories and sections...')

  // Seed categories
  const categories = [
    { name: 'Fiction', description: 'Fictional literature and novels' },
    { name: 'Non-Fiction', description: 'Factual and informational books' },
    { name: 'Science & Technology', description: 'Scientific and technological topics' },
    { name: 'Mathematics', description: 'Mathematical concepts and theories' },
    { name: 'Computer Science', description: 'Programming, algorithms, and computing' },
    { name: 'Literature', description: 'Classic and contemporary literature' },
    { name: 'History', description: 'Historical events and biographies' },
    { name: 'Philosophy', description: 'Philosophical thoughts and theories' },
    { name: 'Business', description: 'Business and management topics' },
    { name: 'Art & Design', description: 'Visual arts and design' },
    { name: 'Reference', description: 'Dictionaries, encyclopedias, and reference materials' },
    { name: 'Textbooks', description: 'Educational textbooks' },
    { name: 'Research Papers', description: 'Academic research and papers' },
    { name: 'Magazines', description: 'Periodicals and magazines' }
  ]

  for (const category of categories) {
    await prisma.bookCategory.upsert({
      where: { name: category.name },
      update: {},
      create: category
    })
  }

  // Seed sections
  const sections = [
    { name: 'Ground Floor - Main Collection', description: 'Primary book collection on the ground floor', is_active: true },
    { name: 'Second Floor - Reference', description: 'Reference materials and study area', is_active: true },
    { name: 'Third Floor - Archives', description: 'Historical documents and archives', is_active: true },
    { name: 'Children\'s Section', description: 'Books for children and young readers', is_active: true },
    { name: 'Periodicals Area', description: 'Magazines and newspapers', is_active: true },
    { name: 'Computer Lab', description: 'Computer science and technology books', is_active: true },
    { name: 'Study Hall A', description: 'Quiet study area with reference books', is_active: true },
    { name: 'Study Hall B', description: 'Group study area', is_active: false }
  ]

  for (const section of sections) {
    await prisma.bookSection.upsert({
      where: { name: section.name },
      update: {},
      create: section
    })
  }

  console.log('Seeding completed successfully!')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
