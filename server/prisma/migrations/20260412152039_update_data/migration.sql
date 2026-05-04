-- CreateTable
CREATE TABLE "Akun" (
    "id" SERIAL NOT NULL,
    "nama" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'GURU',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Akun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tugas" (
    "id" SERIAL NOT NULL,
    "nama" TEXT NOT NULL,
    "kelas" TEXT NOT NULL,
    "noAbsen" INTEGER NOT NULL,
    "token" TEXT NOT NULL,
    "examCode" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Tugas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SesiAktif" (
    "token" TEXT NOT NULL,
    "nama" TEXT NOT NULL,
    "kelas" TEXT NOT NULL,
    "noAbsen" INTEGER NOT NULL,
    "examCode" TEXT NOT NULL,
    "deadline" TIMESTAMP(3) NOT NULL,
    "pembuatId" INTEGER,

    CONSTRAINT "SesiAktif_pkey" PRIMARY KEY ("token")
);

-- CreateIndex
CREATE UNIQUE INDEX "Akun_nama_key" ON "Akun"("nama");

-- CreateIndex
CREATE UNIQUE INDEX "Tugas_token_key" ON "Tugas"("token");

-- CreateIndex
CREATE INDEX "Tugas_noAbsen_idx" ON "Tugas"("noAbsen");

-- AddForeignKey
ALTER TABLE "SesiAktif" ADD CONSTRAINT "SesiAktif_pembuatId_fkey" FOREIGN KEY ("pembuatId") REFERENCES "Akun"("id") ON DELETE SET NULL ON UPDATE CASCADE;
