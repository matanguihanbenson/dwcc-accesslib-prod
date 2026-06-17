const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')

const prisma = new PrismaClient()

async function createAdmin() {
  try {
    await prisma.bookCategory.upsert({
      where: { name: 'General' },
      update: {},
      create: {
        name: 'General',
        description: 'General books category'
      }
    })

    // Check if admin already exists
    const existingAdmin = await prisma.userAccount.findFirst({
      where: { role: 'SUPER_ADMIN' }
    })

    if (existingAdmin) {
      console.log('Admin user already exists')
      return
    }

    const hashedPassword = await bcrypt.hash('admin123', 12)
    
    const user = await prisma.user.create({
      data: {
        account_id: 'ADMIN001',
        first_name: 'System',
        middle_name: '',
        last_name: 'Administrator',
        suffix: null,
        full_name: 'System Administrator',
        user_type: 'EMPLOYEE',
        email: 'admin@dwcc.edu.ph',
        status: 'ACTIVE'
      }
    })

    const userAccount = await prisma.userAccount.create({
      data: {
        username: 'admin',
        password_hash: hashedPassword,
        role: 'SUPER_ADMIN',
        user_id: user.user_id,
        is_active: true
      }
    })

    console.log('Admin user created successfully!')
    console.log('Username: admin')
    console.log('Password: admin123')
    console.log('Please change the password after first login')

  } catch (error) {
    console.error('Error creating admin user:', error)
  } finally {
    await prisma.$disconnect()
  }
}

createAdmin()
