-- CreateTable
CREATE TABLE "Ujian" (
    "kode" TEXT NOT NULL,
    "nama" TEXT NOT NULL,
    "deadline" TIMESTAMP(3) NOT NULL,
    "pembuatId" INTEGER,

    CONSTRAINT "Ujian_pkey" PRIMARY KEY ("kode")
);

-- CreateIndex
CREATE UNIQUE INDEX "Ujian_kode_key" ON "Ujian"("kode");

-- AddForeignKey
ALTER TABLE "Ujian" ADD CONSTRAINT "Ujian_pembuatId_fkey" FOREIGN KEY ("pembuatId") REFERENCES "Akun"("id") ON DELETE SET NULL ON UPDATE CASCADE;
