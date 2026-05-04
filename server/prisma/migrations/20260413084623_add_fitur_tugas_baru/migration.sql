/*
  Warnings:

  - You are about to drop the column `examCode` on the `Tugas` table. All the data in the column will be lost.
  - Added the required column `ujianId` to the `Tugas` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "StatusTugas" AS ENUM ('MENUNGGU', 'DINILAI', 'DIKEMBALIKAN');

-- AlterTable
ALTER TABLE "Tugas" DROP COLUMN "examCode",
ADD COLUMN     "catatan" TEXT,
ADD COLUMN     "dinilaiAt" TIMESTAMP(3),
ADD COLUMN     "nilai" DOUBLE PRECISION,
ADD COLUMN     "status" "StatusTugas" NOT NULL DEFAULT 'MENUNGGU',
ADD COLUMN     "ujianId" TEXT NOT NULL;

-- AddForeignKey
ALTER TABLE "Tugas" ADD CONSTRAINT "Tugas_ujianId_fkey" FOREIGN KEY ("ujianId") REFERENCES "Ujian"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
