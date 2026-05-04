/*
  Warnings:

  - The primary key for the `Ujian` table will be changed. If it partially fails, the table could be left without primary key constraint.

*/
-- DropForeignKey
ALTER TABLE "SesiAktif" DROP CONSTRAINT "SesiAktif_ujianId_fkey";

-- AlterTable
ALTER TABLE "SesiAktif" ALTER COLUMN "ujianId" SET DATA TYPE TEXT;

-- AlterTable
ALTER TABLE "Ujian" DROP CONSTRAINT "Ujian_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ADD CONSTRAINT "Ujian_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "Ujian_id_seq";

-- AddForeignKey
ALTER TABLE "SesiAktif" ADD CONSTRAINT "SesiAktif_ujianId_fkey" FOREIGN KEY ("ujianId") REFERENCES "Ujian"("id") ON DELETE SET NULL ON UPDATE CASCADE;
