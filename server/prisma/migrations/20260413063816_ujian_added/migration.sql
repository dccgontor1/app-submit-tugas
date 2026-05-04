/*
  Warnings:

  - You are about to drop the column `pembuatId` on the `SesiAktif` table. All the data in the column will be lost.
  - The primary key for the `Ujian` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `deadline` on the `Ujian` table. All the data in the column will be lost.
  - You are about to drop the column `kode` on the `Ujian` table. All the data in the column will be lost.
  - You are about to drop the column `nama` on the `Ujian` table. All the data in the column will be lost.
  - You are about to drop the column `pembuatId` on the `Ujian` table. All the data in the column will be lost.
  - Added the required column `durasi` to the `Ujian` table without a default value. This is not possible if the table is not empty.
  - Added the required column `judul` to the `Ujian` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "SesiAktif" DROP CONSTRAINT "SesiAktif_pembuatId_fkey";

-- DropForeignKey
ALTER TABLE "Ujian" DROP CONSTRAINT "Ujian_pembuatId_fkey";

-- DropIndex
DROP INDEX "Ujian_kode_key";

-- AlterTable
ALTER TABLE "SesiAktif" DROP COLUMN "pembuatId",
ADD COLUMN     "startedAt" TIMESTAMP(3),
ADD COLUMN     "ujianId" INTEGER;

-- AlterTable
ALTER TABLE "Ujian" DROP CONSTRAINT "Ujian_pkey",
DROP COLUMN "deadline",
DROP COLUMN "kode",
DROP COLUMN "nama",
DROP COLUMN "pembuatId",
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "deskripsi" TEXT,
ADD COLUMN     "durasi" INTEGER NOT NULL,
ADD COLUMN     "formatFile" TEXT[],
ADD COLUMN     "id" SERIAL NOT NULL,
ADD COLUMN     "judul" TEXT NOT NULL,
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'MENUNGGU',
ADD CONSTRAINT "Ujian_pkey" PRIMARY KEY ("id");

-- AddForeignKey
ALTER TABLE "SesiAktif" ADD CONSTRAINT "SesiAktif_ujianId_fkey" FOREIGN KEY ("ujianId") REFERENCES "Ujian"("id") ON DELETE SET NULL ON UPDATE CASCADE;
