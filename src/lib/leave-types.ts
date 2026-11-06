// The leave types on CS Form No. 6 (the 13 on the form, plus Wellness Leave).
// The seed loads these into the LeaveType table.
//
// ── Defaults chosen for the panel revisions (review with the HRMO) ──────────────
//
// Who may file (eligibleStatuses):
//   - PERMANENT, CASUAL and COTERMINOUS employees are covered by the civil service
//     leave rules (Rule XVI, Omnibus Rules on Leave), so they get every type below.
//   - ELECTIVE officials earn no VL/SL credits in this system (same as the prototype),
//     so they get every type EXCEPT VL, FL and SL.
//     Note for the HRMO: Sec. 81 of R.A. No. 7160 gives elective local officials the same
//     leave privileges as appointive officials. Add ELECTIVE to VL/FL/SL if the LGU applies that.
//   - COS and JO workers are not government employees under civil service rules
//     (no VL/SL credits). By default they may file only leave that the law gives to
//     workers regardless of employment status:
//       ML   (R.A. No. 11210; for COS/JO the benefit is paid through SSS)
//       SOLO (R.A. No. 11861 covers solo parents regardless of employment status)
//       VAWC (R.A. No. 9262 covers women victims, whatever their employer)
//     All three are "to be confirmed by HRMO" for COS/JO.
//   - Sex-specific types (ML, SLBW, VAWC = women; PL = married men) are checked by the
//     filing rules using Employee.sex, not by this list.
//
// Days allowed (maxDaysPerYear):
//   - null on VL and SL: limited only by the employee's credit balance.
//   - null on STL, RP, AL: no fixed yearly number; the HRMO enters the approved period.
//   - ML and SLBW are counted in CALENDAR days by law (see ruleNote). The rest are working days.
//
// Convertible to cash: only VL and SL (monetization and terminal leave).
// Every other type is non-convertible: unused days are simply lost at year end.
// ────────────────────────────────────────────────────────────────────────────────
import type { CreditKind, EmploymentStatus, LeaveDetailKind } from "../generated/prisma/client";

export interface LeaveTypeDef {
  code: string;
  name: string;
  legalBasis: string;
  ruleNote: string;
  deductsFrom: CreditKind | null; // null = does not use VL/SL credits
  detailKind: LeaveDetailKind;
  convertible: boolean;
  maxDaysPerYear: string | null; // string so it goes into the Decimal column exactly
  eligibleStatuses: EmploymentStatus[];
}

const OMNIBUS = "Rule XVI, Omnibus Rules Implementing E.O. No. 292";
const CONFIRM = "to be confirmed by HRMO";

/** Employment types covered by civil service leave rules. They earn 1.25 VL + 1.25 SL a month. */
export const CREDIT_EARNING_STATUSES: EmploymentStatus[] = ["PERMANENT", "CASUAL", "COTERMINOUS"];

const CIVIL_SERVICE = CREDIT_EARNING_STATUSES;
const WITH_ELECTIVE: EmploymentStatus[] = [...CREDIT_EARNING_STATUSES, "ELECTIVE"];
const EVERYONE: EmploymentStatus[] = [...WITH_ELECTIVE, "COS", "JO"];

export const LEAVE_TYPES: LeaveTypeDef[] = [
  {
    code: "VL", name: "Vacation Leave", legalBasis: `Sec. 51, ${OMNIBUS}`,
    ruleNote: "Earned 1.25 days a month. Limited by the VL balance.",
    deductsFrom: "VL", detailKind: "VACATION", convertible: true, maxDaysPerYear: null, eligibleStatuses: CIVIL_SERVICE,
  },
  {
    code: "FL", name: "Mandatory/Forced Leave", legalBasis: `Sec. 25, ${OMNIBUS}`,
    ruleNote: "5 working days a year, deducted from VL. For employees with 10 or more VL credits. Forfeited if not taken.",
    deductsFrom: "VL", detailKind: "NONE", convertible: false, maxDaysPerYear: "5", eligibleStatuses: CIVIL_SERVICE,
  },
  {
    code: "SL", name: "Sick Leave", legalBasis: `Sec. 43, ${OMNIBUS}`,
    ruleNote: "Earned 1.25 days a month. Limited by the SL balance.",
    deductsFrom: "SL", detailKind: "SICK", convertible: true, maxDaysPerYear: null, eligibleStatuses: CIVIL_SERVICE,
  },
  {
    code: "ML", name: "Maternity Leave", legalBasis: "R.A. No. 11210 / IRR issued by CSC, DOLE and SSS",
    ruleNote: "105 calendar days per pregnancy (+15 days for a solo parent). 60 days for miscarriage or emergency termination. Women only.",
    deductsFrom: null, detailKind: "NONE", convertible: false, maxDaysPerYear: "105", eligibleStatuses: EVERYONE,
  },
  {
    code: "PL", name: "Paternity Leave", legalBasis: "R.A. No. 8187 / CSC MC No. 71, s. 1998, as amended",
    ruleNote: "7 working days per delivery of the legitimate spouse, for the first four deliveries. Married men only.",
    deductsFrom: null, detailKind: "NONE", convertible: false, maxDaysPerYear: "7", eligibleStatuses: WITH_ELECTIVE,
  },
  {
    code: "SPL", name: "Special Privilege Leave", legalBasis: `Sec. 21, ${OMNIBUS}`,
    ruleNote: "3 working days a year. Not cumulative.",
    deductsFrom: null, detailKind: "VACATION", convertible: false, maxDaysPerYear: "3", eligibleStatuses: WITH_ELECTIVE,
  },
  {
    code: "SOLO", name: "Solo Parent Leave", legalBasis: "R.A. No. 11861 / CSC MC No. 8, s. 2004",
    ruleNote: "7 working days a year, after at least 6 months of service. Needs a Solo Parent ID.",
    deductsFrom: null, detailKind: "NONE", convertible: false, maxDaysPerYear: "7", eligibleStatuses: EVERYONE,
  },
  {
    code: "STL", name: "Study Leave", legalBasis: `Sec. 68, ${OMNIBUS}`,
    ruleNote: "Up to 6 months with pay for a bar/board review or a master's degree, under a study contract.",
    deductsFrom: null, detailKind: "STUDY", convertible: false, maxDaysPerYear: null, eligibleStatuses: CIVIL_SERVICE,
  },
  {
    code: "VAWC", name: "10-Day VAWC Leave", legalBasis: "R.A. No. 9262 / CSC MC No. 15, s. 2005",
    ruleNote: "Up to 10 working days for women victims of violence. May be extended when necessary.",
    deductsFrom: null, detailKind: "NONE", convertible: false, maxDaysPerYear: "10", eligibleStatuses: EVERYONE,
  },
  {
    code: "RP", name: "Rehabilitation Privilege", legalBasis: `Sec. 55, ${OMNIBUS}`,
    ruleNote: "Up to 6 months for injuries or illness caused by the performance of duty.",
    deductsFrom: null, detailKind: "NONE", convertible: false, maxDaysPerYear: null, eligibleStatuses: WITH_ELECTIVE,
  },
  {
    code: "SLBW", name: "Special Leave Benefits for Women", legalBasis: "R.A. No. 9710 / CSC MC No. 25, s. 2010",
    ruleNote: "Up to 2 months (60 calendar days) after surgery for a gynecological disorder. Women only.",
    deductsFrom: null, detailKind: "WOMEN", convertible: false, maxDaysPerYear: "60", eligibleStatuses: WITH_ELECTIVE,
  },
  {
    code: "SEL", name: "Special Emergency (Calamity) Leave", legalBasis: "CSC MC No. 2, s. 2012, as amended",
    ruleNote: "Up to 5 working days a year, within 30 days of a declared calamity.",
    deductsFrom: null, detailKind: "NONE", convertible: false, maxDaysPerYear: "5", eligibleStatuses: WITH_ELECTIVE,
  },
  {
    code: "AL", name: "Adoption Leave", legalBasis: "R.A. No. 8552",
    ruleNote: `Number of days ${CONFIRM}.`,
    deductsFrom: null, detailKind: "NONE", convertible: false, maxDaysPerYear: null, eligibleStatuses: WITH_ELECTIVE,
  },
  {
    code: "WL", name: "Wellness Leave", legalBasis: `CSC Memorandum Circular on Wellness Leave (circular number ${CONFIRM})`,
    ruleNote: `5 working days a year, not cumulative (${CONFIRM}).`,
    deductsFrom: null, detailKind: "NONE", convertible: false, maxDaysPerYear: "5", eligibleStatuses: WITH_ELECTIVE,
  },
];
