import 'dotenv/config';
import { createPrismaClient } from '@delivery/db';
import { normalizeDzPhone } from '@delivery/shared';
import { hashPassword } from '../modules/auth/password';

/**
 * Provision a development administrator. Credentials come exclusively from the
 * ADMIN_PHONE / ADMIN_PASSWORD environment variables — never hardcode them.
 * Refuses to run in production. Reuses the API's Argon2id hashing so the stored
 * hash is identical to one produced by normal registration.
 */
async function main(): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    console.error('Refusing to bootstrap an admin account in production.');
    process.exit(1);
  }

  const rawPhone = process.env.ADMIN_PHONE;
  const password = process.env.ADMIN_PASSWORD;
  if (!rawPhone || !password) {
    console.error('Set ADMIN_PHONE and ADMIN_PASSWORD environment variables before running.');
    process.exit(1);
  }

  const phone = normalizeDzPhone(rawPhone);
  if (!phone) {
    console.error('ADMIN_PHONE is not a valid Algerian phone number.');
    process.exit(1);
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('DATABASE_URL is required.');
    process.exit(1);
  }

  const prisma = createPrismaClient(databaseUrl);
  try {
    const passwordHash = await hashPassword(password);
    const existing = await prisma.user.findUnique({ where: { phone } });
    if (existing) {
      const updated = await prisma.user.update({
        where: { phone },
        data: { role: 'admin', status: 'active', passwordHash },
      });
      console.log(`Updated user ${updated.id} to an active admin.`);
    } else {
      const created = await prisma.user.create({
        data: { phone, passwordHash, role: 'admin', status: 'active' },
      });
      console.log(`Created active admin ${created.id}.`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});