-- CreateEnum
CREATE TYPE "Role" AS ENUM ('EMPLOYEE', 'DEPT_HEAD', 'HRMO', 'APPROVER');

-- CreateEnum
CREATE TYPE "Sex" AS ENUM ('MALE', 'FEMALE');

-- CreateEnum
CREATE TYPE "EmploymentStatus" AS ENUM ('PERMANENT', 'CASUAL', 'COS', 'JO', 'ELECTIVE', 'COTERMINOUS');

-- CreateEnum
CREATE TYPE "CreditKind" AS ENUM ('VL', 'SL');

-- CreateEnum
CREATE TYPE "LeaveDetailKind" AS ENUM ('NONE', 'VACATION', 'SICK', 'STUDY', 'WOMEN');

-- CreateEnum
CREATE TYPE "Commutation" AS ENUM ('NOT_REQUESTED', 'REQUESTED');

-- CreateEnum
CREATE TYPE "ApplicationStatus" AS ENUM ('FOR_RECOMMENDATION', 'FOR_CERTIFICATION', 'FOR_APPROVAL', 'APPROVED', 'DISAPPROVED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ActionStep" AS ENUM ('FILED', 'RECOMMENDED', 'NOT_RECOMMENDED', 'CERTIFIED', 'APPROVED', 'DISAPPROVED', 'CANCELLED');

-- CreateTable
CREATE TABLE "Office" (
    "id" VARCHAR(16) NOT NULL,
    "name" TEXT NOT NULL,
    "headId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Office_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Employee" (
    "id" TEXT NOT NULL,
    "employeeNo" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "middleInitial" TEXT,
    "lastName" TEXT NOT NULL,
    "sex" "Sex" NOT NULL,
    "position" TEXT NOT NULL,
    "salaryGrade" INTEGER NOT NULL,
    "monthlySalary" DECIMAL(12,2) NOT NULL,
    "officeId" TEXT NOT NULL,
    "status" "EmploymentStatus" NOT NULL,
    "originalAppointment" DATE NOT NULL,
    "role" "Role" NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "signature" TEXT,
    "signatureUpdatedAt" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Employee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeaveType" (
    "code" VARCHAR(10) NOT NULL,
    "name" TEXT NOT NULL,
    "legalBasis" TEXT NOT NULL,
    "ruleNote" TEXT,
    "deductsFrom" "CreditKind",
    "detailKind" "LeaveDetailKind" NOT NULL DEFAULT 'NONE',
    "convertible" BOOLEAN NOT NULL DEFAULT false,
    "maxDaysPerYear" DECIMAL(7,3),
    "eligibleStatuses" "EmploymentStatus"[] DEFAULT ARRAY[]::"EmploymentStatus"[],
    "sortOrder" INTEGER NOT NULL,

    CONSTRAINT "LeaveType_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "LeaveApplication" (
    "id" TEXT NOT NULL,
    "refNo" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "filedById" TEXT,
    "typeCode" TEXT NOT NULL,
    "details" JSONB NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "days" DECIMAL(7,3) NOT NULL,
    "commutation" "Commutation" NOT NULL DEFAULT 'NOT_REQUESTED',
    "status" "ApplicationStatus" NOT NULL DEFAULT 'FOR_RECOMMENDATION',
    "filedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "certAsOf" DATE,
    "certVlTotal" DECIMAL(7,3),
    "certSlTotal" DECIMAL(7,3),
    "certVlLess" DECIMAL(7,3),
    "certSlLess" DECIMAL(7,3),
    "certVlBalance" DECIMAL(7,3),
    "certSlBalance" DECIMAL(7,3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeaveApplication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApprovalAction" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "step" "ActionStep" NOT NULL,
    "actorId" TEXT NOT NULL,
    "remarks" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApprovalAction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LedgerEntry" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "particulars" TEXT NOT NULL,
    "kind" "CreditKind" NOT NULL,
    "earned" DECIMAL(7,3) NOT NULL DEFAULT 0,
    "deducted" DECIMAL(7,3) NOT NULL DEFAULT 0,
    "applicationId" TEXT,
    "accrualMonth" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "applicationId" TEXT,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "detail" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Holiday" (
    "date" DATE NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Holiday_pkey" PRIMARY KEY ("date")
);

-- CreateTable
CREATE TABLE "AppSetting" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,

    CONSTRAINT "AppSetting_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "Office_headId_key" ON "Office"("headId");

-- CreateIndex
CREATE UNIQUE INDEX "Employee_employeeNo_key" ON "Employee"("employeeNo");

-- CreateIndex
CREATE UNIQUE INDEX "Employee_username_key" ON "Employee"("username");

-- CreateIndex
CREATE INDEX "Employee_officeId_idx" ON "Employee"("officeId");

-- CreateIndex
CREATE UNIQUE INDEX "LeaveApplication_refNo_key" ON "LeaveApplication"("refNo");

-- CreateIndex
CREATE INDEX "LeaveApplication_employeeId_status_idx" ON "LeaveApplication"("employeeId", "status");

-- CreateIndex
CREATE INDEX "LeaveApplication_status_idx" ON "LeaveApplication"("status");

-- CreateIndex
CREATE INDEX "LeaveApplication_filedById_idx" ON "LeaveApplication"("filedById");

-- CreateIndex
CREATE INDEX "ApprovalAction_applicationId_idx" ON "ApprovalAction"("applicationId");

-- CreateIndex
CREATE INDEX "LedgerEntry_employeeId_kind_date_idx" ON "LedgerEntry"("employeeId", "kind", "date");

-- CreateIndex
CREATE UNIQUE INDEX "LedgerEntry_employeeId_kind_accrualMonth_key" ON "LedgerEntry"("employeeId", "kind", "accrualMonth");

-- CreateIndex
CREATE INDEX "Notification_userId_read_idx" ON "Notification"("userId", "read");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- AddForeignKey
ALTER TABLE "Office" ADD CONSTRAINT "Office_headId_fkey" FOREIGN KEY ("headId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_officeId_fkey" FOREIGN KEY ("officeId") REFERENCES "Office"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveApplication" ADD CONSTRAINT "LeaveApplication_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveApplication" ADD CONSTRAINT "LeaveApplication_filedById_fkey" FOREIGN KEY ("filedById") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveApplication" ADD CONSTRAINT "LeaveApplication_typeCode_fkey" FOREIGN KEY ("typeCode") REFERENCES "LeaveType"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalAction" ADD CONSTRAINT "ApprovalAction_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "LeaveApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalAction" ADD CONSTRAINT "ApprovalAction_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "LeaveApplication"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
