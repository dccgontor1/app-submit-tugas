export interface Akun {
  id: number;
  username: string;
  nama: string;
  role: 'ADMIN' | 'GURU';
}

export interface Sesi {
  token: string;
  nama: string;
  kelas: string;
  noAbsen: number;
  ujianId: string;      // ✅ ganti examCode → ujianId, Int → String
  deadline: string;
  startedAt: string | null;
}

export interface Ujian {
  id: string;           // ✅ ganti Int → String (UJIAN-XXXXXX)
  judul: string;
  deskripsi: string | null;
  formatFile: string[];
  durasi: number;
  status: 'MENUNGGU' | 'BERLANGSUNG' | 'SELESAI';
  createdAt: string;
  _count?: { sesiAktif: number };
}

export interface Tugas {
  id: number;
  nama: string;
  kelas: string;
  noAbsen: number;
  token: string;
  filePath: string;
  submittedAt: string;
  nilai: number | null;
  catatan: string | null;
  dinilaiAt: string | null;
  status: 'MENUNGGU' | 'DINILAI' | 'DIKEMBALIKAN';
  ujianId: string;
  ujian?: { judul: string };
}

export interface AuthContextType {
  user: { nama: string; role?: string } | null;
  login: (user: { nama: string; role?: string }) => void;
  logout: () => void;
}