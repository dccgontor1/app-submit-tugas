import fastify, { FastifyRequest, FastifyReply } from "fastify";
import moduleCors from "@fastify/cors"
import moduleCookie from "@fastify/cookie"
import moduleSession from "@fastify/session"
import moduleMultiPart from "@fastify/multipart"
import * as fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from "uuid";
import { pipeline } from "stream/promises"
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import csv from 'csv-parser'
import crypto from 'crypto'
import fastifyJwt from '@fastify/jwt';
import { Role } from '@prisma/client';
import bcrypt from 'bcrypt';
import * as dotenv from 'dotenv'
// Tambah di bagian atas, setelah register plugin lainnya
import fastifyStatic from '@fastify/static';


declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload:
    | {
      // Admin/Guru
      id: number;
      username: string;
      nama: string;
      role: Role;
    }
    | {
      // Siswa
      nama: string;
      noAbsen: number;
      kelas: string;
      stambuk?: string;
      ujianId: string;
      judulUjian: string;
    };

    user:
    | {
      id: number;
      username: string;
      nama: string;
      role: Role;
    }
    | {
      nama: string;
      noAbsen: number;
      kelas: string;
      stambuk?: string;
      ujianId: string;
      judulUjian: string;
    };
  }
}
dotenv.config();

const connectionString = process.env.DATABASE_URL;


// Function Declaration
const adapter = new PrismaPg({ connectionString })
const prisma = new PrismaClient({ adapter });
const app = fastify({
  logger: {
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,          // Memberi warna pada teks log
        translateTime: 'HH:MM:ss Z', // Format waktu agar mudah dibaca
        ignore: 'hostname',   // Sembunyikan ID proses yang tidak penting
        errorLikeObjectKeys: ['err', 'error'], // Parsing objek error secara otomatis
        singleLine: false        // Biarkan stack trace melebar ke bawah agar rapi
      }
    }
  }
})

// Fasitfy register module
app.register(fastifyStatic, {
  root: path.join(__dirname, '..', 'uploads'),
  prefix: '/uploads/',
});

app.register(moduleCors, { origin: ["http://localhost:5173"], credentials: true, methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'] });
app.register(moduleCookie, {
  secret: "aplikasi-ujian-dcc-2026-by-vision-diba"
});
app.register(moduleSession, {
  secret: "for-development-not-for-production",
  saveUninitialized: false,
  cookie: { secure: false, httpOnly: true, sameSite: "lax", maxAge: 3600000 },
});
app.register(moduleMultiPart);
app.register(fastifyJwt, {
  secret: 'tokenUjianDCC2026',
});

const pastikanAdmin = async (request: FastifyRequest, reply: FastifyReply) => {
  try {

    const cookie = request.cookies?.session;
    if (!cookie) throw new Error('No session');
    request.headers.authorization = `Bearer ${cookie}`;

    await request.jwtVerify();
    const user = request.user as any;
    if (!('role' in user) || user.role !== 'ADMIN') {
      return reply.status(403).send({ error: 'Akses Ditolak!' });
    }
  } catch {
    return reply.status(401).send({ error: 'Tidak Terautentikasi' });
  }
};

const pastikanGuru = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const cookie = request.cookies?.session;
    if (!cookie) throw new Error('No session');
    request.headers.authorization = `Bearer ${cookie}`;

    await request.jwtVerify();
    const user = request.user as any;
    if (!('role' in user) || !['ADMIN', 'GURU'].includes(user.role)) {
      return reply.status(403).send({ error: 'Akses Ditolak!' });
    }
  } catch {
    return reply.status(401).send({ error: 'Tidak Terautentikasi' });
  }
};

const pastikanSiswa = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const cookie = request.cookies?.session;
    if (!cookie) throw new Error('No session');
    request.headers.authorization = `Bearer ${cookie}`;

    await request.jwtVerify();
  } catch {
    return reply.status(401).send({ error: 'Tidak Terautentikasi' });
  }
};

// POST /login — siswa
app.post('/login', async (req, res) => {
  const { code } = req.body as { code: string };

  try {
    const cookieLama = req.cookies.session;
    if (cookieLama) {
      try {
        await app.jwt.verify(cookieLama);

        return res.status(200).send({
          success: true,
          message: 'Sudah ada sesi aktif',
          alreadyLoggedIn: true
        });
      } catch (e) {

        res.clearCookie('session', { path: '/' });
      }
    }

    const sesi = await prisma.sesiAktif.findUnique({
      where: { token: code },
      include: { ujian: true },
    });

    if (!sesi) return res.status(401).send({ message: 'Kode invalid atau kedaluwarsa!' });

    const now = new Date();
    if (now > sesi.deadline) return res.status(403).send({ message: 'Sesi ujian ini sudah berakhir!' });

    const token = app.jwt.sign({
      nama: sesi.nama,
      noAbsen: sesi.noAbsen,
      kelas: sesi.kelas,
      stambuk: sesi.stambuk ?? undefined,
      ujianId: sesi.ujianId,
      judulUjian: sesi.ujian?.judul ?? 'unknown',
    });

    res.setCookie('session', token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: false,
      path: '/',
      maxAge: 60 * 60,
    });

    return {
      success: true,
      data: {
        nama: sesi.nama,
        judulUjian: sesi.ujian?.judul,
        deadline: sesi.deadline,
      },
    };
  } catch (error) {
    req.log.error(error);
    return res.status(500).send({ message: 'Terjadi kesalahan server' });
  }

});

// POST /login-staff — admin/guru
app.post('/login-staff', async (req, res) => {
  const { username, password } = req.body as any;


  try {
    const cookieLama = req.cookies.session;
    if (cookieLama) {
      try {
        await app.jwt.verify(cookieLama);

        return res.status(200).send({
          success: true,
          message: 'Sudah ada sesi aktif',
          alreadyLoggedIn: true
        });
      } catch (e) {
        // Jika cookie expired/invalid, hapus saja
        res.clearCookie('session', { path: '/' });
      }
    }

    const akun = await prisma.akun.findUnique({ where: { username } });
    if (!akun) return res.status(401).send({ message: 'Username atau Password salah!' });

    const passwordCocok = await bcrypt.compare(password, akun.password);
    if (!passwordCocok) return res.status(401).send({ message: 'Username atau Password salah!' });

    const token = app.jwt.sign({
      id: akun.id,
      username: akun.username,
      nama: akun.nama,
      role: akun.role,
    });

    const redirectTo = (akun.role as string) === "ADMIN" ? '/dashboard' : '/penilaian';

    res.setCookie('session', token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: false,
      path: '/',
      maxAge: 60 * 60 * 8, // 8 jam
    });

    return {
      success: true,
      user: { nama: akun.nama, role: akun.role },
      redirectTo
    };
  } catch (error) {
    req.log.error(error);
    return res.status(500).send({ message: 'Terjadi kesalahan sistem' });
  }
});

app.post('/logout', async (req, res) => {
  res.clearCookie('session', { path: '/' });
  return { success: true };
});

app.post('/admin/generate', { preHandler: [pastikanAdmin] }, async (req, res) => {
  const uploadedData = await req.file();

  // ✅ Fix: 400 bukan 401 untuk file tidak ada
  if (!uploadedData) return res.status(400).send({ message: "Tidak ada file .csv yang diupload!" });

  const results: any[] = [];

  try {
    await new Promise((resolve, reject) => {
      uploadedData.file
        .pipe(csv({ separator: ';' }))
        .on('data', (row) => {
          const rowData: any = {};
          Object.keys(row).forEach(key => {
            rowData[key.trim().toLowerCase()] = (row[key] || '').trim();
          });

          // ✅ Fix: skip baris kosong / tidak valid
          if (!rowData.nama || !rowData.kelas || !rowData.ujianid) return;

          const noAbsen = parseInt(rowData.noabsen);
          if (isNaN(noAbsen) || noAbsen <= 0) return;

          results.push({
            token: crypto.randomBytes(3).toString('hex').toUpperCase(),
            nama: rowData.nama,
            kelas: rowData.kelas,
            noAbsen,
            ujianId: rowData.ujianid,
            deadline: rowData.deadline ? new Date(rowData.deadline) : new Date(Date.now() + 90 * 60 * 1000),
          });
        })
        .on('end', resolve)
        .on('error', reject);
    });

    if (results.length === 0) {
      return res.status(400).send({ error: 'Tidak ada data valid dalam file CSV.' });
    }

    const upload = await prisma.sesiAktif.createMany({
      data: results,
      skipDuplicates: true,
    });

    return res.send({ message: "Data berhasil di generate!", totalData: upload.count, skipped: results.length - upload.count });
  } catch (error) {
    req.log.error(error);
    return res.status(500).send({ error: 'Terjadi kesalahan saat memproses data.' });
  }
});

app.get(
  '/admin/akun',
  { preHandler: [pastikanAdmin] }, // Pakai pengaman yang kita buat tadi
  async (request, reply) => {
    try {
      const semuaAkun = await prisma.akun.findMany({
        select: {
          id: true,
          username: true,
          nama: true,
          role: true,
          // Jangan kirim password ke frontend!
        },
        orderBy: { id: 'asc' }
      });
      return semuaAkun;
    } catch (err) {
      return reply.status(500).send({ error: "Gagal ambil data" });
    }
  }
);

app.get('/admin/sesi', { preHandler: [pastikanAdmin] }, async (req, res) => {
  try {
    const sesiList = await prisma.sesiAktif.findMany({
      orderBy: { deadline: 'asc' },
      select: {
        token: true,
        nama: true,
        kelas: true,
        noAbsen: true,
        ujianId: true,
        deadline: true,
        startedAt: true, // ✅ Fix: field ini dibutuhkan client untuk cek status aktif/menunggu
      },
    });
    return sesiList;
  } catch (error) {
    req.log.error(error);
    return res.status(500).send({ message: 'Terjadi kesalahan server' });
  }
});

// DELETE /admin/sesi/:token
app.delete('/admin/sesi/:token', { preHandler: [pastikanAdmin] }, async (req, res) => {
  const { token } = req.params as { token: string };
  try {
    await prisma.sesiAktif.delete({ where: { token } });
    return { success: true };
  } catch (error) {
    req.log.error(error);
    return res.status(500).send({ message: 'Gagal menghapus sesi' });
  }
});

// ── DATA SISWA ENDPOINTS ─────────────────────────────────────

// GET /admin/siswa — list semua siswa
app.get('/admin/siswa', { preHandler: [pastikanAdmin] }, async (req, res) => {
  const { kelas } = req.query as { kelas?: string };
  try {
    const siswa = await prisma.siswa.findMany({
      where: kelas ? { kelas } : undefined,
      orderBy: [{ kelas: 'asc' }, { noAbsen: 'asc' }]
    });
    return siswa;
  } catch (error) {
    req.log.error(error);
    return res.status(500).send({ message: 'Gagal mengambil data siswa' });
  }
});

// GET /admin/siswa/kelas — list kelas unik
app.get('/admin/siswa/kelas', { preHandler: [pastikanAdmin] }, async (req, res) => {
  try {
    const kelasUnik = await prisma.siswa.findMany({
      select: { kelas: true },
      distinct: ['kelas'],
      orderBy: { kelas: 'asc' }
    });
    return kelasUnik.map(k => k.kelas).filter(k => k);
  } catch (error) {
    req.log.error(error);
    return res.status(500).send({ message: 'Gagal mengambil daftar kelas' });
  }
});

// POST /admin/siswa/import — import massal siswa dari Excel ke tabel Siswa
app.post('/admin/siswa/import', { preHandler: [pastikanAdmin] }, async (req, res) => {
  try {
    const { siswa } = req.body as {
      siswa: Array<{ stambuk: string; noAbsen: number; nama: string; kelas: string; daerah?: string; rayon?: string; }>;
    };

    if (!Array.isArray(siswa) || siswa.length === 0) {
      return res.status(400).send({ message: 'Data siswa wajib diisi' });
    }

    // Validasi setiap record (stambuk wajib ada sebagai ID)
    const validSiswa = siswa.filter(s => s.stambuk?.trim() && s.nama?.trim());

    if (validSiswa.length === 0) {
      return res.status(400).send({ message: 'Tidak ada data siswa yang valid (stambuk dan nama wajib)' });
    }

    let upsertedCount = 0;

    // Gunakan transaksi untuk upsert massal (karena Prisma belum punya upsertMany yang native dan safe di semua DB)
    await prisma.$transaction(async (tx) => {
      for (const s of validSiswa) {
        await tx.siswa.upsert({
          where: { stambuk: s.stambuk.trim() },
          update: {
            noAbsen: s.noAbsen || 0,
            nama: s.nama.trim(),
            kelas: s.kelas?.trim() || '',
            daerah: s.daerah?.trim() || '',
            rayon: s.rayon?.trim() || ''
          },
          create: {
            stambuk: s.stambuk.trim(),
            noAbsen: s.noAbsen || 0,
            nama: s.nama.trim(),
            kelas: s.kelas?.trim() || '',
            daerah: s.daerah?.trim() || '',
            rayon: s.rayon?.trim() || ''
          }
        });
        upsertedCount++;
      }
    });

    return res.send({
      success: true,
      totalData: upsertedCount,
      skipped: siswa.length - upsertedCount,
    });
  } catch (error) {
    req.log.error(error);
    return res.status(500).send({ message: 'Gagal mengimport data siswa' });
  }
});

// PUT /admin/siswa/:stambuk
app.put('/admin/siswa/:stambuk', { preHandler: [pastikanAdmin] }, async (req, res) => {
  const { stambuk } = req.params as { stambuk: string };
  const { nama, kelas, noAbsen, daerah, rayon } = req.body as any;
  try {
    const updated = await prisma.siswa.update({
      where: { stambuk },
      data: { nama, kelas, noAbsen, daerah, rayon }
    });
    return updated;
  } catch (error) {
    req.log.error(error);
    return res.status(500).send({ message: 'Gagal update siswa' });
  }
});

// DELETE /admin/siswa/:stambuk
app.delete('/admin/siswa/:stambuk', { preHandler: [pastikanAdmin] }, async (req, res) => {
  const { stambuk } = req.params as { stambuk: string };
  try {
    await prisma.siswa.delete({ where: { stambuk } });
    return { success: true };
  } catch (error) {
    req.log.error(error);
    return res.status(500).send({ message: 'Gagal menghapus siswa' });
  }
});

// POST /admin/ujian/:id/generate-sesi-kelas
app.post('/admin/ujian/:id/generate-sesi-kelas', { preHandler: [pastikanAdmin] }, async (req, res) => {
  const { id: ujianId } = req.params as { id: string };
  const { kelasList, deadline } = req.body as { kelasList: string[], deadline: string };

  try {
    if (!kelasList || !kelasList.length || !deadline) {
      return res.status(400).send({ message: 'Kelas dan deadline wajib diisi' });
    }

    const ujian = await prisma.ujian.findUnique({ where: { id: ujianId } });
    if (!ujian) return res.status(404).send({ message: 'Ujian tidak ditemukan' });

    const deadlineDate = new Date(deadline);
    if (isNaN(deadlineDate.getTime())) return res.status(400).send({ message: 'Format deadline tidak valid' });

    const siswaToGenerate = await prisma.siswa.findMany({
      where: { kelas: { in: kelasList } }
    });

    if (siswaToGenerate.length === 0) {
      return res.status(400).send({ message: 'Tidak ada siswa di kelas yang dipilih' });
    }

    // Fungsi generate token 6 karakter
    const generateToken = () => {
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
      return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    };

    let createdCount = 0;
    const generatedSessions = [];

    // Buat sesi
    for (const siswa of siswaToGenerate) {
      // Cek apa sudah punya sesi untuk ujian ini
      const existing = await prisma.sesiAktif.findUnique({
        where: { ujianId_stambuk: { ujianId, stambuk: siswa.stambuk } }
      });

      if (!existing) {
        let token = generateToken();
        // Cek bentrok token (sangat jarang tapi mungkin)
        let bentrok = await prisma.sesiAktif.findUnique({ where: { token } });
        while (bentrok) {
          token = generateToken();
          bentrok = await prisma.sesiAktif.findUnique({ where: { token } });
        }

        const newSesi = await prisma.sesiAktif.create({
          data: {
            token,
            nama: siswa.nama,
            kelas: siswa.kelas,
            noAbsen: siswa.noAbsen,
            stambuk: siswa.stambuk,
            deadline: deadlineDate,
            ujianId
          }
        });
        generatedSessions.push(newSesi);
        createdCount++;
      } else {
        // update deadline jika sudah ada
        await prisma.sesiAktif.update({
          where: { token: existing.token },
          data: { deadline: deadlineDate }
        });
        generatedSessions.push({ ...existing, deadline: deadlineDate });
      }
    }

    return res.send({ success: true, count: createdCount, sessions: generatedSessions });
  } catch (error) {
    req.log.error(error);
    return res.status(500).send({ message: 'Gagal generate sesi' });
  }
});


// PUT /admin/sesi/:token — edit data sesi siswa (termasuk token, nama, kelas, noAbsen, deadline)
app.put('/admin/sesi/:token', { preHandler: [pastikanAdmin] }, async (req, res) => {
  const { token } = req.params as { token: string };
  const { newToken, nama, kelas, noAbsen, deadline } = req.body as {
    newToken?: string;
    nama?: string;
    kelas?: string;
    noAbsen?: number;
    deadline?: string;
  };

  try {
    const sesi = await prisma.sesiAktif.findUnique({ where: { token } });
    if (!sesi) return res.status(404).send({ message: 'Sesi tidak ditemukan' });

    // Validasi noAbsen jika diberikan
    if (noAbsen !== undefined && (isNaN(noAbsen) || noAbsen <= 0)) {
      return res.status(400).send({ message: 'No. Absen harus berupa angka positif' });
    }

    // Validasi deadline jika diberikan
    if (deadline && isNaN(new Date(deadline).getTime())) {
      return res.status(400).send({ message: 'Format deadline tidak valid' });
    }

    const cleanToken = newToken?.trim().toUpperCase();

    // Jika token diubah: delete lama + create baru dalam satu transaksi
    if (cleanToken && cleanToken !== token) {
      const existing = await prisma.sesiAktif.findUnique({ where: { token: cleanToken } });
      if (existing) return res.status(400).send({ message: 'Token baru sudah dipakai oleh siswa lain' });

      await prisma.$transaction([
        prisma.sesiAktif.create({
          data: {
            token: cleanToken,
            nama: nama?.trim() ?? sesi.nama,
            kelas: kelas?.trim() ?? sesi.kelas,
            noAbsen: noAbsen ?? sesi.noAbsen,
            deadline: deadline ? new Date(deadline) : sesi.deadline,
            startedAt: sesi.startedAt,
            ujianId: sesi.ujianId,
          },
        }),
        prisma.sesiAktif.delete({ where: { token } }),
      ]);

      return res.send({ success: true, token: cleanToken });
    }

    // Jika token tidak berubah: update field lainnya
    const updated = await prisma.sesiAktif.update({
      where: { token },
      data: {
        ...(nama !== undefined && { nama: nama.trim() }),
        ...(kelas !== undefined && { kelas: kelas.trim() }),
        ...(noAbsen !== undefined && { noAbsen }),
        ...(deadline !== undefined && { deadline: new Date(deadline) }),
      },
    });

    return res.send({ success: true, sesi: updated });
  } catch (error) {
    req.log.error(error);
    return res.status(500).send({ message: 'Gagal mengupdate sesi' });
  }
});




// ── GET /admin/ujian ─────────────────────────────────────
app.get('/admin/ujian', { preHandler: [pastikanGuru] }, async (req, res) => {
  try {
    const { includeDeleted } = req.query as { includeDeleted?: string };
    const ujianList = await prisma.ujian.findMany({
      where: includeDeleted === 'true' ? {} : { deletedAt: null },
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { sesiAktif: true } } },
    });
    return ujianList;
  } catch (error) {
    req.log.error(error);
    return res.status(500).send({ message: 'Gagal mengambil daftar ujian' });
  }
});

// ── POST /admin/ujian ─────────────────────────────────────
app.post('/admin/ujian', { preHandler: [pastikanAdmin] }, async (req, res) => {
  try {
    const { judul, deskripsi, formatFile, durasi } = req.body as {
      judul: string;
      deskripsi?: string;
      formatFile: string[];
      durasi: number;
    };

    // ✅ Fix: validasi input wajib
    if (!judul || !judul.trim()) return res.status(400).send({ message: 'Judul ujian tidak boleh kosong' });
    if (!formatFile || formatFile.length === 0) return res.status(400).send({ message: 'Pilih minimal satu format file' });
    if (!durasi || durasi < 1) return res.status(400).send({ message: 'Durasi tidak valid' });

    const id = "UJIAN-" + crypto.randomBytes(3).toString('hex').toUpperCase();
    const ujian = await prisma.ujian.create({
      data: { id, judul: judul.trim(), deskripsi, formatFile, durasi },
    });
    return res.status(201).send(ujian);
  } catch (error) {
    req.log.error(error);
    return res.status(500).send({ message: 'Gagal membuat ujian' });
  }
});

// ── POST /admin/ujian/:id/start-batch — mulai sesi per batch ─────────────
app.post('/admin/ujian/:id/start-batch', { preHandler: [pastikanAdmin] }, async (req, res) => {
  try {
    const { id } = req.params as { id: string };
    const { tokens } = req.body as { tokens: string[] };

    if (!tokens || tokens.length === 0) {
      return res.status(400).send({ message: 'Tokens wajib diisi' });
    }

    const ujian = await prisma.ujian.findUnique({ where: { id } });
    if (!ujian) return res.status(404).send({ message: 'Ujian tidak ditemukan' });

    const now = new Date();
    const deadline = new Date(now.getTime() + ujian.durasi * 60 * 1000);

    // Update sesi dalam batch ini saja
    await prisma.sesiAktif.updateMany({
      where: { token: { in: tokens }, ujianId: id },
      data: { startedAt: now, deadline },
    });

    return { success: true, startedAt: now, deadline };
  } catch (error) {
    req.log.error(error);
    return res.status(500).send({ message: 'Gagal memulai batch' });
  }
});

// ── POST /admin/ujian/:id/end-batch — akhiri sesi per batch ─────────────
app.post('/admin/ujian/:id/end-batch', { preHandler: [pastikanAdmin] }, async (req, res) => {
  try {
    const { id } = req.params as { id: string };
    const { tokens } = req.body as { tokens: string[] };

    if (!tokens || tokens.length === 0) {
      return res.status(400).send({ message: 'Tokens wajib diisi' });
    }

    const now = new Date();

    await prisma.sesiAktif.updateMany({
      where: { token: { in: tokens }, ujianId: id },
      data: { deadline: now },
    });

    return { success: true, endedAt: now };
  } catch (error) {
    req.log.error(error);
    return res.status(500).send({ message: 'Gagal mengakhiri batch' });
  }
});

// ── POST /admin/ujian/:id/extend ──────────────────────────
app.post('/admin/ujian/:id/extend', { preHandler: [pastikanAdmin] }, async (req, res) => {
  try {
    const { id } = req.params as { id: string };
    const { token, tambahMenit } = req.body as { token: string; tambahMenit: number };

    // ✅ Fix: validasi tambahMenit
    if (!tambahMenit || tambahMenit <= 0) return res.status(400).send({ message: 'Tambah menit harus lebih dari 0' });

    const sesi = await prisma.sesiAktif.findUnique({ where: { token } });
    if (!sesi) return res.status(404).send({ message: 'Sesi tidak ditemukan' });

    // ✅ Fix: pastikan sesi milik ujian yang benar
    if (sesi.ujianId !== id) return res.status(400).send({ message: 'Token tidak cocok dengan ujian ini' });

    const newDeadline = new Date(sesi.deadline.getTime() + tambahMenit * 60 * 1000);
    await prisma.sesiAktif.update({ where: { token }, data: { deadline: newDeadline } });

    return { success: true, deadline: newDeadline };
  } catch (error) {
    req.log.error(error);
    return res.status(500).send({ message: 'Gagal menambah waktu' });
  }
});

// ── GET /admin/ujian/:id/monitor ──────────────────────────
app.get('/admin/ujian/:id/monitor', { preHandler: [pastikanAdmin] }, async (req, res) => {
  try {
    const { id } = req.params as { id: string };
    const sesiList = await prisma.sesiAktif.findMany({
      where: { ujianId: id },
      orderBy: [{ kelas: 'asc' }, { noAbsen: 'asc' }],
    });
    return sesiList;
  } catch (error) {
    req.log.error(error);
    return res.status(500).send({ message: 'Gagal mengambil data monitor' });
  }
});

app.post('/upload-jawaban', { preHandler: [pastikanSiswa] }, async (req, res) => {
  const data = await req.file();
  if (!data) return res.status(400).send({ message: 'File tidak ditemukan' });

  const { nama, kelas, noAbsen, stambuk, ujianId, judulUjian } = req.user as any;

  // ✅ Cek deadline sebelum terima file
  const sesiCek = await prisma.sesiAktif.findFirst({
    where: stambuk ? { ujianId, stambuk } : { ujianId, noAbsen, kelas },
  });
  if (!sesiCek) return res.status(403).send({ message: 'Sesi tidak ditemukan atau sudah selesai' });

  const now = new Date();
  if (now > sesiCek.deadline) {
    // Drain stream agar tidak hang
    data.file.resume();
    return res.status(403).send({ message: 'Waktu ujian sudah habis, tidak bisa mengumpulkan jawaban' });
  }

  // ✅ Ambil ujian untuk validasi format file
  const ujian = await prisma.ujian.findUnique({ where: { id: ujianId } });
  const ext = path.extname(data.filename).toLowerCase().replace('.', '');
  const allowedFormats = ujian?.formatFile ?? ['pdf', 'docx', 'doc', 'jpg', 'jpeg', 'png'];
  if (!allowedFormats.includes(ext)) {
    data.file.resume();
    return res.status(400).send({ message: `Format .${ext} tidak diizinkan. Format yang diterima: ${allowedFormats.join(', ')}` });
  }

  const folderName = judulUjian.replace(/[^a-zA-Z0-9_\-]/g, '_');
  const folder = path.join(__dirname, '..', 'uploads', folderName, kelas);
  fs.mkdirSync(folder, { recursive: true });

  const filename = `${stambuk || noAbsen}_${nama.replace(/\s+/g, '_')}.${ext}`;
  const filepath = path.join(folder, filename);

  await pipeline(data.file, fs.createWriteStream(filepath));

  // ✅ Simpan path relatif (bukan absolut) agar portable
  const relativePath = path.join(folderName, kelas, filename);

  // ✅ Upsert: jika sudah pernah submit, update file-nya (bukan duplikasi)
  const existingTugas = await prisma.tugas.findFirst({
    where: stambuk ? { ujianId, stambuk } : { ujianId, noAbsen, kelas }
  });

  if (existingTugas) {
    // Hapus file lama jika berbeda
    if (existingTugas.filePath !== relativePath) {
      const oldAbsPath = path.join(__dirname, '..', 'uploads', existingTugas.filePath);
      if (fs.existsSync(oldAbsPath)) fs.unlinkSync(oldAbsPath);
    }
    await prisma.tugas.update({
      where: { id: existingTugas.id },
      data: { filePath: relativePath, submittedAt: new Date(), status: 'MENUNGGU', nilai: null, catatan: null, dinilaiAt: null, stambuk: stambuk || existingTugas.stambuk },
    });
  } else {
    await prisma.tugas.create({
      data: {
        nama,
        kelas,
        noAbsen,
        stambuk,
        ujianId,
        filePath: relativePath,
        token: crypto.randomBytes(6).toString('hex').toUpperCase(),
      }
    });
  }

  await prisma.sesiAktif.deleteMany({
    where: stambuk ? { ujianId, stambuk } : { ujianId, noAbsen, kelas },
  });

  return { success: true, filename };
});

app.get('/sesi-status', async (request, reply) => {
  try {
    const cookie = request.cookies?.session;
    if (!cookie) return reply.code(401).send({ error: "No session" });

    const decoded = await app.jwt.verify(cookie) as any;

    // Logika untuk Staff (Admin/Guru)
    if (decoded.role) {
      return {
        isStaff: true,
        nama: decoded.nama,
        role: decoded.role,
        redirectTo: decoded.role === 'ADMIN' ? '/dashboard' : '/penilaian',
      };
    }

    // ✅ Fix: cek apakah siswa sudah submit dulu sebelum cari sesi
    const sudahSubmit = await prisma.tugas.findFirst({
      where: { ujianId: decoded.ujianId, noAbsen: decoded.noAbsen, kelas: decoded.kelas },
    });
    if (sudahSubmit) {
      return {
        isStaff: false,
        nama: decoded.nama,
        examCode: decoded.judulUjian || 'Ujian',
        submitted: true,
        redirectTo: '/ujian',
      };
    }

    // Logika untuk Siswa
    const sesi = await prisma.sesiAktif.findFirst({
      where: { ujianId: decoded.ujianId, noAbsen: decoded.noAbsen, kelas: decoded.kelas },
      include: { ujian: true },
    });

    if (!sesi) return reply.code(404).send({ error: "Sesi tidak ditemukan" });

    return {
      isStaff: false,
      nama: sesi.nama,
      examCode: sesi.ujian?.judul || 'Ujian',
      submitted: false,
      redirectTo: '/ujian',
    };

  } catch (err) {
    return reply.code(401).send({ error: "Token expired" });
  }
});

app.get('/check-status-ujian', { preHandler: [pastikanSiswa] }, async (req, reply) => {
  try {
    const cookie = req.cookies?.session;
    if (!cookie) return reply.code(401).send({ error: "No session" });

    const decoded = await app.jwt.verify(cookie) as any;

    // ✅ Cek apakah siswa sudah submit tugas (sesi sudah dihapus setelah submit)
    const sudahSubmit = await prisma.tugas.findFirst({
      where: { ujianId: decoded.ujianId, noAbsen: decoded.noAbsen, kelas: decoded.kelas },
    });
    if (sudahSubmit) {
      return reply.code(200).send({ submitted: true });
    }

    const sesi = await prisma.sesiAktif.findFirst({
      where: { ujianId: decoded.ujianId, noAbsen: decoded.noAbsen, kelas: decoded.kelas },
      include: { ujian: true }
    });

    if (!sesi) return reply.code(404).send({ error: "Sesi tidak ditemukan" });

    return {
      submitted: false,
      startedAt: sesi.startedAt,
      deadline: sesi.deadline
    };

  } catch (err) {
    return reply.code(401).send({ error: "Token expired" });
  }
});

// PUT /admin/tugas/:id/nilai
app.put('/admin/tugas/:id/nilai', { preHandler: [pastikanGuru] }, async (req, res) => {
  try {
    const { id } = req.params as { id: string };
    const { nilai, catatan } = req.body as { nilai: number; catatan?: string };

    if (nilai === undefined || nilai === null || isNaN(nilai)) {
      return res.status(400).send({ message: 'Nilai tidak valid' });
    }
    if (nilai < 0 || nilai > 100) {
      return res.status(400).send({ message: 'Nilai harus antara 0-100' });
    }

    const tugasAda = await prisma.tugas.findUnique({ where: { id: Number(id) } });
    if (!tugasAda) return res.status(404).send({ message: 'Tugas tidak ditemukan' });

    const tugas = await prisma.tugas.update({
      where: { id: Number(id) },
      data: { nilai, catatan, status: 'DINILAI', dinilaiAt: new Date() },
    });

    return tugas;
  } catch (error) {
    req.log.error(error);
    return res.status(500).send({ message: 'Gagal menyimpan nilai' });
  }
});

// GET /admin/tugas — list semua tugas per ujian
app.get('/admin/tugas', { preHandler: [pastikanGuru] }, async (req, res) => {
  try {
    const { ujianId } = req.query as { ujianId?: string };
    const tugas = await prisma.tugas.findMany({
      where: ujianId ? { ujianId } : undefined,
      orderBy: [{ kelas: 'asc' }, { noAbsen: 'asc' }],
      include: {
        ujian: { select: { judul: true } },
        siswa: true
      },
    });
    return tugas;
  } catch (error) {
    req.log.error(error);
    return res.status(500).send({ message: 'Gagal mengambil data tugas' });
  }
});

// GET /nilai — siswa cek nilai sendiri
app.get('/nilai', { preHandler: [pastikanSiswa] }, async (req, res) => {
  const { noAbsen, ujianId, stambuk } = req.user as any;

  const tugas = await prisma.tugas.findFirst({
    where: stambuk ? { stambuk, ujianId } : { noAbsen, ujianId },
    select: {
      status: true,
      nilai: true,
      catatan: true,
      dinilaiAt: true,
      submittedAt: true,
    },
  });

  if (!tugas) return res.status(404).send({ message: 'Tugas belum dikumpulkan' });

  return tugas;
});

// POST /admin/akun — buat akun baru
app.post('/admin/akun', { preHandler: [pastikanAdmin] }, async (req, res) => {
  const { nama, username, password, role } = req.body as {
    nama: string;
    username: string;
    password: string;
    role: 'ADMIN' | 'GURU';
  };

  try {
    // Cek username sudah ada belum
    const existing = await prisma.akun.findUnique({ where: { username } });
    if (existing) {
      return res.status(400).send({ message: 'Username sudah dipakai!' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const akun = await prisma.akun.create({
      data: { nama, username, password: hashedPassword, role },
      select: { id: true, username: true, nama: true, role: true }, // jangan return password
    });

    return res.status(201).send(akun);
  } catch (error) {
    req.log.error(error);
    return res.status(500).send({ message: 'Gagal membuat akun' });
  }
});

// DELETE /admin/akun/:id — hapus akun
app.delete('/admin/akun/:id', { preHandler: [pastikanAdmin] }, async (req, res) => {
  const { id } = req.params as { id: string };

  try {
    await prisma.akun.delete({ where: { id: Number(id) } });
    return { success: true };
  } catch (error) {
    req.log.error(error);
    return res.status(500).send({ message: 'Gagal menghapus akun' });
  }
});

app.delete('/admin/ujian/:id', { preHandler: [pastikanAdmin] }, async (req, res) => {
  const { id } = req.params as { id: string };

  try {
    const ujian = await prisma.ujian.findUnique({ where: { id } });
    if (!ujian) return res.status(404).send({ message: 'Ujian tidak ditemukan' });

    await prisma.$transaction([
      prisma.sesiAktif.deleteMany({ where: { ujianId: id } }),
      prisma.ujian.update({
        where: { id },
        data: { deletedAt: new Date() }, // soft delete
      }),
    ]);

    return { success: true };
  } catch (error) {
    req.log.error(error);
    return res.status(500).send({ message: 'Gagal menghapus ujian.' });
  }
});

// ── GET /admin/ujian/riwayat — ujian yang sudah dihapus (soft-deleted) ──────
app.get('/admin/ujian/riwayat', { preHandler: [pastikanGuru] }, async (req, res) => {
  try {
    const riwayat = await prisma.ujian.findMany({
      where: { deletedAt: { not: null } },
      orderBy: { deletedAt: 'desc' },
      include: {
        _count: { select: { tugas: true } },
      },
    });
    return riwayat;
  } catch (error) {
    req.log.error(error);
    return res.status(500).send({ message: 'Gagal mengambil riwayat ujian' });
  }
});

// ── GET /admin/ujian/:id/hasil — nilai siswa untuk satu ujian ──────────────
app.get('/admin/ujian/:id/hasil', { preHandler: [pastikanGuru] }, async (req, res) => {
  try {
    const { id } = req.params as { id: string };
    const tugas = await prisma.tugas.findMany({
      where: { ujianId: id },
      orderBy: [{ kelas: 'asc' }, { noAbsen: 'asc' }],
      include: {
        ujian: { select: { judul: true, deletedAt: true } },
        siswa: { select: { daerah: true, rayon: true } },
      },
    });
    return tugas;
  } catch (error) {
    req.log.error(error);
    return res.status(500).send({ message: 'Gagal mengambil data hasil ujian' });
  }
});

// ── POST /admin/ujian/:id/generate-sesi-batch — batch sesi multi-kelas ─────
app.post('/admin/ujian/:id/generate-sesi-batch', { preHandler: [pastikanAdmin] }, async (req, res) => {
  const { id: ujianId } = req.params as { id: string };
  const { kelasList, deadline } = req.body as { kelasList: string[]; deadline: string };

  try {
    if (!kelasList || kelasList.length === 0) {
      return res.status(400).send({ message: 'Pilih minimal satu kelas' });
    }
    if (!deadline) {
      return res.status(400).send({ message: 'Deadline wajib diisi' });
    }

    const ujian = await prisma.ujian.findUnique({ where: { id: ujianId } });
    if (!ujian) return res.status(404).send({ message: 'Ujian tidak ditemukan' });

    const deadlineDate = new Date(deadline);
    if (isNaN(deadlineDate.getTime())) {
      return res.status(400).send({ message: 'Format deadline tidak valid' });
    }

    const siswaList = await prisma.siswa.findMany({
      where: { kelas: { in: kelasList } },
      orderBy: [{ kelas: 'asc' }, { noAbsen: 'asc' }],
    });

    if (siswaList.length === 0) {
      return res.status(400).send({ message: 'Tidak ada siswa di kelas yang dipilih' });
    }

    const generateToken = () => {
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
      return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    };

    let created = 0;
    let updated = 0;
    const sessions: any[] = [];

    for (const siswa of siswaList) {
      const existing = await prisma.sesiAktif.findUnique({
        where: { ujianId_stambuk: { ujianId, stambuk: siswa.stambuk } },
      });

      if (existing) {
        const upd = await prisma.sesiAktif.update({
          where: { token: existing.token },
          data: { deadline: deadlineDate },
        });
        sessions.push(upd);
        updated++;
      } else {
        let token = generateToken();
        while (await prisma.sesiAktif.findUnique({ where: { token } })) {
          token = generateToken();
        }
        const newSesi = await prisma.sesiAktif.create({
          data: {
            token,
            nama: siswa.nama,
            kelas: siswa.kelas,
            noAbsen: siswa.noAbsen,
            stambuk: siswa.stambuk,
            deadline: deadlineDate,
            ujianId,
          },
        });
        sessions.push(newSesi);
        created++;
      }
    }

    return res.send({
      success: true,
      created,
      updated,
      total: sessions.length,
      kelasList,
    });
  } catch (error) {
    req.log.error(error);
    return res.status(500).send({ message: 'Gagal generate sesi batch' });
  }
});

// ✅ Fix: graceful listen dengan error handler
app.listen({ port: 5000, host: '0.0.0.0' }, (err) => {
  if (err) {
    app.log.error(err);
    process.exit(1);
  }
});