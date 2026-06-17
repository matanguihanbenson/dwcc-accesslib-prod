import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const hashedPassword = await bcrypt.hash('password123', 10);

  // Create account first
  const account = await prisma.userAccount.create({
    data: {
      username: 'admin',
      password_hash: hashedPassword,
      role: 'SUPER_ADMIN',
    },
  });

  // Create user with the generated account_id
  const user = await prisma.user.create({
    data: {
      full_name: 'System Administrator',
      user_type: 'EMPLOYEE',
      account_id: account.account_id,
    },
    include: { account: true },
  });

  console.log('Created user with account:', user);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
