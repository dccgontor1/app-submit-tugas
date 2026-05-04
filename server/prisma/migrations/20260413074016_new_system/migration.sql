/*
  Warnings:

  - You are about to drop the column `examCode` on the `SesiAktif` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[ujianId,noAbsen]` on the table `SesiAktif` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "SesiAktif" DROP COLUMN "examCode";

-- CreateIndex
CREATE UNIQUE INDEX "SesiAktif_ujianId_noAbsen_key" ON "SesiAktif"("ujianId", "noAbsen");
