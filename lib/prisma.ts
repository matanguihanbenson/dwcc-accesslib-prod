import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// Create Prisma client with simplified logging
// Using stdout logging instead of event-based to avoid $on issues
// Add timezone parameter to connection string if not already present
const getDatabaseUrl = () => {
  const baseUrl = process.env.DATABASE_URL || ''
  try {
    const url = new URL(baseUrl)
    if (!url.searchParams.has('timezone')) {
      url.searchParams.set('timezone', '+08:00')
    }
    return url.toString()
  } catch {
    // If DATABASE_URL is not a valid URL (or missing), fall back to the raw value
    return baseUrl
  }
}

export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  log: process.env.NODE_ENV === 'development' 
    ? ['query', 'error', 'warn'] 
    : ['error'],
  datasources: {
    db: {
      url: getDatabaseUrl()
    }
  }
})

// Ensure disconnection on process exit
process.on('beforeExit', async () => {
  await prisma.$disconnect()
})

// Cache client in development to avoid creating multiple instances
if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}
