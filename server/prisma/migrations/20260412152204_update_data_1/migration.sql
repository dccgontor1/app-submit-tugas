/*
  Warnings:

  - The `role` column on the `Akun` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'GURU');

-- AlterTable
ALTER TABLE "Akun" DROP COLUMN "role",
ADD COLUMN     "role" "Role" NOT NULL DEFAULT 'GURU';
