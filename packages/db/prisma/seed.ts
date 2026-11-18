import { PrismaClient } from '@prisma/client';
import { WILAYAS } from '../src/data/wilayas';
import { MUNICIPALITIES } from '../src/data/municipalities';

const prisma = new PrismaClient();

/**
 * Idempotent seed: safe to re-run. Existing admin-tuned settings are never
 * overwritten (upsert with an empty update clause).
 */
const DEFAULT_SETTINGS: ReadonlyArray<{ key: string; value: unknown }> = [
  { key: 'dispatch.wave_size', value: 3 },
  { key: 'dispatch.offer_timeout_s', value: 30 },
  { key: 'dispatch.max_waves', value: 4 },
  { key: 'dispatch.radius_steps_m', value: [3000, 5000, 10000] },
  { key: 'dispatch.courier_heartbeat_ttl_s', value: 60 },
  { key: 'pricing.base_fee_dzd', value: 200 },
  { key: 'pricing.per_km_dzd', value: 40 },
  { key: 'pricing.cash_rounding_step_dzd', value: 5 },
  { key: 'pricing.commission_pct', value: 0 },
];

async function main(): Promise<void> {
  for (const wilaya of WILAYAS) {
    await prisma.wilaya.upsert({
      where: { code: wilaya.code },
      create: wilaya,
      update: { nameAr: wilaya.nameAr, nameFr: wilaya.nameFr },
    });
  }

  for (const municipality of MUNICIPALITIES) {
    await prisma.municipality.upsert({
      where: {
        wilayaCode_nameFr: { wilayaCode: municipality.wilayaCode, nameFr: municipality.nameFr },
      },
      create: municipality,
      update: { nameAr: municipality.nameAr },
    });
  }

  for (const setting of DEFAULT_SETTINGS) {
    await prisma.adminSetting.upsert({
      where: { key: setting.key },
      create: { key: setting.key, value: setting.value as object },
      update: {},
    });
  }

  console.log(
    `Seeded ${WILAYAS.length} wilayas, ${MUNICIPALITIES.length} municipalities, and ${DEFAULT_SETTINGS.length} default settings.`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());