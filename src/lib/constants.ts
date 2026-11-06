// App-wide labels and fixed values.
import type { ApplicationStatus, EmploymentStatus, Role } from "../generated/prisma/client";

export const APP = {
  name: "MMH Leave",
  subtitle: "Employee Leave Management System",
  issuer: "Municipal Government of Midsalip, Province of Zamboanga del Sur",
};

/** VL and SL each earn this many days per month of service (CSC rule). */
export const MONTHLY_ACCRUAL = 1.25;

export const ROLE_LABELS: Record<Role, string> = {
  EMPLOYEE: "Employee",
  DEPT_HEAD: "Department Head",
  HRMO: "HRMO",
  APPROVER: "Approving Authority",
};

export const EMPLOYMENT_STATUS_LABELS: Record<EmploymentStatus, string> = {
  PERMANENT: "Permanent",
  CASUAL: "Casual",
  COS: "Contract of Service (COS)",
  JO: "Job Order (JO)",
  ELECTIVE: "Elective",
  COTERMINOUS: "Coterminous",
};

export const STATUS_LABELS: Record<ApplicationStatus, string> = {
  FOR_RECOMMENDATION: "For Recommendation",
  FOR_CERTIFICATION: "For Certification",
  FOR_APPROVAL: "For Approval",
  APPROVED: "Approved",
  DISAPPROVED: "Disapproved",
  CANCELLED: "Cancelled",
};
