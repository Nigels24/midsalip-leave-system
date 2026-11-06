// The 13 leave types on CS Form No. 6. The seed loads these into the LeaveType table.
import type { CreditKind, LeaveDetailKind } from "../generated/prisma/client";

export interface LeaveTypeDef {
  code: string;
  name: string;
  legalBasis: string;
  deductsFrom: CreditKind | null; // null = does not use VL/SL credits
  detailKind: LeaveDetailKind;
}

const OMNIBUS = "Rule XVI, Omnibus Rules Implementing E.O. No. 292";

export const LEAVE_TYPES: LeaveTypeDef[] = [
  { code: "VL", name: "Vacation Leave", legalBasis: `Sec. 51, ${OMNIBUS}`, deductsFrom: "VL", detailKind: "VACATION" },
  { code: "FL", name: "Mandatory/Forced Leave", legalBasis: `Sec. 25, ${OMNIBUS}`, deductsFrom: "VL", detailKind: "NONE" },
  { code: "SL", name: "Sick Leave", legalBasis: `Sec. 43, ${OMNIBUS}`, deductsFrom: "SL", detailKind: "SICK" },
  { code: "ML", name: "Maternity Leave", legalBasis: "R.A. No. 11210 / IRR issued by CSC, DOLE and SSS", deductsFrom: null, detailKind: "NONE" },
  { code: "PL", name: "Paternity Leave", legalBasis: "R.A. No. 8187 / CSC MC No. 71, s. 1998, as amended", deductsFrom: null, detailKind: "NONE" },
  { code: "SPL", name: "Special Privilege Leave", legalBasis: `Sec. 21, ${OMNIBUS}`, deductsFrom: null, detailKind: "VACATION" },
  { code: "SOLO", name: "Solo Parent Leave", legalBasis: "R.A. No. 11861 / CSC MC No. 8, s. 2004", deductsFrom: null, detailKind: "NONE" },
  { code: "STL", name: "Study Leave", legalBasis: `Sec. 68, ${OMNIBUS}`, deductsFrom: null, detailKind: "STUDY" },
  { code: "VAWC", name: "10-Day VAWC Leave", legalBasis: "R.A. No. 9262 / CSC MC No. 15, s. 2005", deductsFrom: null, detailKind: "NONE" },
  { code: "RP", name: "Rehabilitation Privilege", legalBasis: `Sec. 55, ${OMNIBUS}`, deductsFrom: null, detailKind: "NONE" },
  { code: "SLBW", name: "Special Leave Benefits for Women", legalBasis: "R.A. No. 9710 / CSC MC No. 25, s. 2010", deductsFrom: null, detailKind: "WOMEN" },
  { code: "SEL", name: "Special Emergency (Calamity) Leave", legalBasis: "CSC MC No. 2, s. 2012, as amended", deductsFrom: null, detailKind: "NONE" },
  { code: "AL", name: "Adoption Leave", legalBasis: "R.A. No. 8552", deductsFrom: null, detailKind: "NONE" },
];
