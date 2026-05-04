-- DropForeignKey
ALTER TABLE "Tugas" DROP CONSTRAINT "Tugas_ujianId_fkey";

-- AlterTable
ALTER TABLE "Tugas" ALTER COLUMN "ujianId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "Tugas" ADD CONSTRAINT "Tugas_ujianId_fkey" FOREIGN KEY ("ujianId") REFERENCES "Ujian"("id") ON DELETE SET NULL ON UPDATE CASCADE;
