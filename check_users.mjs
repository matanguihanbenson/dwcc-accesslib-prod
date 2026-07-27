import { PrismaClient } from '@prisma/client'
const p = new PrismaClient()
const rows = await p.$queryRawUnsafe("SELECT user_id, account_id, year_level, education_level FROM user WHERE education_level = 'COLLEGE'")
console.log(JSON.stringify(rows, null, 2))
await p.$disconnect()
