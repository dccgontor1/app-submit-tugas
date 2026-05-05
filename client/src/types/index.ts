export interface Akun {
  id: number;
  username: string;
  nama: string;
  role: 'ADMIN' | 'GURU';
}

export interface Siswa {
  stambuk: string;
  noAbsen: number;
  nama: string;
  kelas: string;
  daerah: string;
  rayon: string;
}

export interface Sesi {
  token: string;
  nama: string;
  kelas: string;
  noAbsen: number;
  stambuk?: string;
  ujianId: string;
  deadline: string;
  startedAt: string | null;
}

export interface Ujian {
  id: string;
  judul: string;
  deskripsi: string | null;
  formatFile: string[];
  durasi: number;
  createdAt: string;
  deletedAt?: string | null;
  _count?: { sesiAktif: number };
}

export interface RiwayatUjian {
  id: string;
  judul: string;
  deskripsi: string | null;
  formatFile: string[];
  durasi: number;
  createdAt: string;
  deletedAt: string;
  _count: { tugas: number };
}

export interface Tugas {
  id: number;
  nama: string;
  kelas: string;
  noAbsen: number;
  stambuk?: string;
  token: string;
  filePath: string;
  submittedAt: string;
  nilai: number | null;
  catatan: string | null;
  dinilaiAt: string | null;
  status: 'MENUNGGU' | 'DINILAI' | 'DIKEMBALIKAN';
  ujianId: string;
  ujian?: { judul: string; deletedAt?: string | null };
  siswa?: Siswa & { daerah?: string; rayon?: string };
}

export interface AuthContextType {
  user: { nama: string; role?: string } | null;
  login: (user: { nama: string; role?: string }) => void;
  logout: () => void;
}