const setWaktu = (tgl: number, jam: number, menit: number) => {
  return new Date(2026, 3, tgl, jam, menit).getTime(); 
};

export const Exams: Record<string,any> = {
    "KLS-A": {
        title: "Ujian Matematika",
        duration: 60,
        isOpen: true
    }
}

export const Users: Record<string, any> = {};
for (let i = 1; i <= 40; i++) {

    const code =`TOKEN-${i.toString().padStart(2, '0')}`;
    Users[code] = {noAbsen: i, targetExam: "KLS-A"}
}

export const activeSession: Record<string, any> = {};