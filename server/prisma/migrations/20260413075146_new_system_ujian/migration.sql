/*
  Warnings:

  - Made the column `ujianId` on table `SesiAktif` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "SesiAktif" DROP CONSTRAINT "SesiAktif_ujianId_fkey";

-- AlterTable
ALTER TABLE "SesiAktif" ALTER COLUMN "ujianId" SET NOT NULL;

-- AlterTable
ALTER TABLE "Ujian" ALTER COLUMN "id" SET DEFAULT '';

-- AddForeignKey
ALTER TABLE "SesiAktif" ADD CONSTRAINT "SesiAktif_ujianId_fkey" FOREIGN KEY ("ujianId") REFERENCES "Ujian"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
