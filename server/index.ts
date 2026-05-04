import fastify, { FastifyRequest, FastifyReply } from "fastify";
import moduleCors from "@fastify/cors"
import moduleCookie from "@fastify/cookie"
import moduleSession from "@fastify/session"
import moduleMultiPart from "@fastify/multipart"
import * as fs from 'fs';
import path from 'path';
import {v4 as uuidv4 } from "uuid";
import {pipeline} from "stream/promises"
import {PrismaClient} from "@prisma/client";
import {PrismaPg} from "@prisma/adapter-pg";
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
          ujianId: string;
          judulUjian: string;
        };
  }
}
dotenv.config();

const connectionString = process.env.DATABASE_URL;


// Function Declaration
const adapter = new PrismaPg({connectionString})
const prisma = new PrismaClient({ adapter });
const app = fastify({logger: {
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
  }})

// Fasitfy register module
app.register(fastifyStatic, {
  root: path.join(__dirname, '..', 'uploads'),
  prefix: '/uploads/',
});

app.register(moduleCors, {origin: ["http://localhost:5173"], credentials: true, methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']});
app.addHook('onRequest', async (request) => {
  console.log('COOKIES:', request.cookies);
  console.log('HEADERS:', request.headers);
});
app.register(moduleCookie, {
  secret: "aplikasi-ujian-dcc-2026-by-vision-diba"
});
app.register(moduleSession, {
    secret: "for-development-not-for-production",
    saveUninitialized: false,
    cookie: {secure: false, httpOnly: true, sameSite: "lax", maxAge: 3600000},
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

    const redirectTo = (akun.role as string)  === "ADMIN" ? '/dashboard' : '/penilaian'; 

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

    if (!uploadedData) return res.status(401).send({ message: "Tidak ada file .csv yang diupload!" })

    const results: any[] = [];
    
    try {
        await new Promise((resolve, reject) => {
            uploadedData.file
                .pipe(csv({separator: ';'}))
                .on('data', (row) => {
                    // Gunakan pengecekan kolom yang lebih fleksibel
                    // Kita ambil key yang ada, lalu paksa jadi lowercase untuk pengecekan
                    const rowData: any = {};
                    Object.keys(row).forEach(key => {
                        rowData[key.trim().toLowerCase()] = row[key];
                    });

                    results.push({
                        token: crypto.randomBytes(3).toString('hex').toUpperCase(),
                        nama: rowData.nama,
                        kelas: rowData.kelas,
                        // Pastikan jika data kosong tidak jadi NaN
                        noAbsen: parseInt(rowData.noabsen) || 0,
                        ujianId: rowData.ujianid,
                        // Ambil dari rowData.deadline (sudah di-lowercase)
                        deadline: rowData.deadline ? new Date(rowData.deadline) : new Date()
                    });
                })
                .on('end', resolve)
                .on('error', reject)
        });

        const upload = await prisma.sesiAktif.createMany({
            data: results,
            skipDuplicates: true
        });

        return res.send({ message: "Data berhasil di generate!", totalData: upload.count });
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

// ── GET /admin/ujian ─────────────────────────────────────
app.get('/admin/ujian', { preHandler: [pastikanGuru] }, async (req, res) => {
  const { includeDeleted } = req.query as { includeDeleted?: string };

  const ujianList = await prisma.ujian.findMany({
    where: includeDeleted === 'true' ? {} : { deletedAt: null },
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { sesiAktif: true } } },
  });

  return ujianList;
});

// ── POST /admin/ujian ─────────────────────────────────────
app.post('/admin/ujian', { preHandler: [pastikanAdmin] }, async (req, res) => {
  const { judul, deskripsi, formatFile, durasi } = req.body as {
    judul: string;
    deskripsi?: string;
    formatFile: string[];
    durasi: number;
  };
  const id = "UJIAN-" + crypto.randomBytes(3).toString('hex').toUpperCase();
  const ujian = await prisma.ujian.create({
    data: {id, judul, deskripsi, formatFile, durasi },
  });
  return ujian;
});

// ── POST /admin/ujian/:id/start ───────────────────────────
app.post('/admin/ujian/:id/start', { preHandler: [pastikanAdmin] }, async (req, res) => {
  const { id } = req.params as { id: string };
  const now = new Date();

  const ujian = await prisma.ujian.findUnique({ where: { id: id } });
  if (!ujian) return res.status(404).send({ message: 'Ujian tidak ditemukan' });
  if (ujian.status === 'BERLANGSUNG') return res.status(400).send({ message: 'Ujian sudah berjalan' });

  const deadline = new Date(now.getTime() + ujian.durasi * 60 * 1000);

  await prisma.$transaction([
    prisma.ujian.update({
      where: { id: id },
      data: { status: 'BERLANGSUNG' },
    }),
    prisma.sesiAktif.updateMany({
      where: { ujianId: id },
      data: { startedAt: now, deadline },
    }),
  ]);

  return { success: true, startedAt: now, deadline };
});

// ── POST /admin/ujian/:id/extend ──────────────────────────
app.post('/admin/ujian/:id/extend', { preHandler: [pastikanAdmin] }, async (req, res) => {
  const { id } = req.params as { id: string };
  const { token, tambahMenit } = req.body as { token: string; tambahMenit: number };

  const sesi = await prisma.sesiAktif.findUnique({ where: { token } });
  if (!sesi) return res.status(404).send({ message: 'Sesi tidak ditemukan' });

  const newDeadline = new Date(sesi.deadline.getTime() + tambahMenit * 60 * 1000);
  await prisma.sesiAktif.update({
    where: { token },
    data: { deadline: newDeadline },
  });

  return { success: true, deadline: newDeadline };
});

// ── GET /admin/ujian/:id/monitor ──────────────────────────
app.get('/admin/ujian/:id/monitor', { preHandler: [pastikanAdmin] }, async (req, res) => {
  const { id } = req.params as { id: string };
  const sesiList = await prisma.sesiAktif.findMany({
    where: { ujianId: id },
    orderBy: [{ kelas: 'asc' }, { noAbsen: 'asc' }],
  });
  return sesiList;
});

app.post('/upload-jawaban', { preHandler: [pastikanSiswa] }, async (req, res) => {
  const data = await req.file();
  if (!data) return res.status(400).send({ message: 'File tidak ditemukan' });

  const { nama, kelas, noAbsen, ujianId, judulUjian } = req.user as any;

  const ext = path.extname(data.filename).toLowerCase();
  const allowed = ['.pdf', '.docx', '.doc', '.jpg', '.jpeg', '.png'];
  if (!allowed.includes(ext)) {
    return res.status(400).send({ message: `Format ${ext} tidak diizinkan` });
  }

  const folderName = judulUjian.replace(/[^a-zA-Z0-9_\-]/g, '_');
  const folder = path.join(__dirname, '..', 'uploads', folderName, kelas);
  fs.mkdirSync(folder, { recursive: true });

  const filename = `${noAbsen}_${nama.replace(/\s+/g, '_')}${ext}`;
  const filepath = path.join(folder, filename);

  await pipeline(data.file, fs.createWriteStream(filepath));

  // ✅ Simpan ke database
  await prisma.tugas.create({
    data: {
      nama,
      kelas,
      noAbsen,
      ujianId,    
      filePath: filepath,
      token: crypto.randomBytes(6).toString('hex').toUpperCase(),
    }
  });

  await prisma.sesiAktif.deleteMany({
  where: {
    ujianId: ujianId,
    noAbsen: noAbsen,
    kelas: kelas,
  }
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
        // Frontend akan menggunakan ini untuk auto-redirect jika user di halaman login
        redirectTo: decoded.role === 'ADMIN' ? '/dashboard' : '/penilaian'
      };
    }

    // Logika untuk Siswa (Existing)
    const sesi = await prisma.sesiAktif.findFirst({
      where: { ujianId: decoded.ujianId, noAbsen: decoded.noAbsen, kelas: decoded.kelas },
      include: { ujian: true }
    });

    if (!sesi) return reply.code(404).send({ error: "Sesi tidak ditemukan" });

    return {
      isStaff: false,
      nama: sesi.nama,
      examCode: sesi.ujian?.judul || "Ujian",
      status: 'ACTIVE',
      redirectTo: '/ujian'
    };

  } catch (err) {
    return reply.code(401).send({ error: "Token expired" });
  }
});

app.get('/check-status-ujian', {preHandler: [pastikanSiswa]}, async (req, reply) => {
  try {
    const cookie = req.cookies?.session;
    if (!cookie) return reply.code(401).send({ error: "No session" })

    const decoded = await app.jwt.verify(cookie) as any;

    const sesi = await prisma.sesiAktif.findFirst({
      where: { ujianId: decoded.ujianId, noAbsen: decoded.noAbsen, kelas: decoded.kelas },
      include: { ujian: true }
    });

    if (!sesi) return reply.code(404).send({ error: "Sesi tidak ditemukan" });

    return {
      startedAt: sesi.startedAt,
      deadline: sesi.deadline
    }

  } catch (err) {
    return reply.code(401).send({ error: "Token expired" });
  }
})

// PUT /admin/tugas/:id/nilai
app.put('/admin/tugas/:id/nilai', { preHandler: [pastikanGuru] }, async (req, res) => {
  const { id } = req.params as { id: string };
  const { nilai, catatan } = req.body as { nilai: number; catatan?: string };

  if (nilai < 0 || nilai > 100) {
    return res.status(400).send({ message: 'Nilai harus antara 0-100' });
  }

  const tugas = await prisma.tugas.update({
    where: { id: Number(id) },
    data: {
      nilai,
      catatan,
      status: 'DINILAI',
      dinilaiAt: new Date(),
    },
  });

  return tugas;
});

// GET /admin/tugas — list semua tugas per ujian
app.get('/admin/tugas', { preHandler: [pastikanGuru] }, async (req, res) => {
  const { ujianId } = req.query as { ujianId?: string };

  const tugas = await prisma.tugas.findMany({
    where: ujianId ? { ujianId } : undefined,
    orderBy: [{ kelas: 'asc' }, { noAbsen: 'asc' }],
    include: { ujian: { select: { judul: true } } },
  });

  return tugas;
});

// GET /nilai — siswa cek nilai sendiri
app.get('/nilai', { preHandler: [pastikanSiswa] }, async (req, res) => {
  const { noAbsen, ujianId } = req.user as any;

  const tugas = await prisma.tugas.findFirst({
    where: { noAbsen, ujianId },
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

app.listen({port: 5000})