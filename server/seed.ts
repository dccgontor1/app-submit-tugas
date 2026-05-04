import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcrypt';
import * as dotenv from 'dotenv';

// 1. WAJIB: Panggil config paling atas!
dotenv.config();

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error("❌ Error: DATABASE_URL tidak ditemukan di .env");
  process.exit(1);
}

// 2. Setup Driver Adapter dengan benar

const adapter = new PrismaPg({connectionString});
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🌱 Memulai proses seeding...');

  const passwordAsli = 'Dccnewface1926';
  // Pastikan bcrypt selesai sebelum lanjut
  const hashedPassword = await bcrypt.hash(passwordAsli, 10);

  try {
    const admin = await prisma.akun.upsert({
      where: { username: 'dccadmin' },
      update: {}, 
      create: {
        username: 'dccadmin',
        password: hashedPassword,
        nama: 'Super Administrator',
        role: 'ADMIN', 
      },
    });

    console.log('✅ Berhasil!');
    console.log(`Username: ${admin.username}`);
    console.log(`Password: ${passwordAsli}`);
  } catch (err) {
    console.error("❌ Gagal saat eksekusi query:", err);
  }
}

main()
  .catch((e) => {
    console.error("❌ Error Fatal:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();

  });