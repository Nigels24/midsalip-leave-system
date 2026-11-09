-- AlterTable
ALTER TABLE "Employee" ADD COLUMN     "salaryStep" INTEGER,
ALTER COLUMN "salaryGrade" DROP NOT NULL;

-- CreateTable
CREATE TABLE "SalarySchedule" (
    "grade" INTEGER NOT NULL,
    "step" INTEGER NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "SalarySchedule_pkey" PRIMARY KEY ("grade","step")
);
