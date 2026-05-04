/*
  Warnings:

  - A unique constraint covering the columns `[username]` on the table `Akun` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `username` to the `Akun` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "Akun_nama_key";

-- AlterTable
ALTER TABLE "Akun" ADD COLUMN     "username" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Akun_username_key" ON "Akun"("username");
