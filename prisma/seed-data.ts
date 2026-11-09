// Reference data shared by BOTH seeds:
//   prisma/seed.ts             demo data for development (npm run db:seed)
//   prisma/seed-production.ts  what a real install needs to run (npm run db:seed:production)
// Lists: offices, 2026 holidays, the 2026 national salary schedule; plus the leave types from src/lib/leave-types.ts.
import type { PrismaClient } from "../src/generated/prisma/client";
import { toDbDate } from "../src/lib/dates";
import { LEAVE_TYPES } from "../src/lib/leave-types";

/** The offices of the municipal hall: [code, name]. */
export const OFFICES: [id: string, name: string][] = [
  ["MO", "Office of the Municipal Mayor"],
  ["HRMO", "Human Resource Management Office"],
  ["MTO", "Office of the Municipal Treasurer"],
  ["MACCO", "Office of the Municipal Accountant"],
  ["MEO", "Office of the Municipal Engineer"],
  ["MSWDO", "Municipal Social Welfare and Development Office"],
  ["MHO", "Municipal Health Office"],
];

/**
 * Philippine non-working holidays of 2026, the starting list of a new install.
 * Later years are entered by the HRMO on the Holidays page (/holidays) from the yearly
 * Malacañang proclamation, so they are not listed here.
 */
export const HOLIDAYS: [date: string, name: string][] = [
  ["2026-01-01", "New Year's Day"],
  ["2026-04-02", "Maundy Thursday"],
  ["2026-04-03", "Good Friday"],
  ["2026-04-09", "Araw ng Kagitingan"],
  ["2026-05-01", "Labor Day"],
  ["2026-06-12", "Independence Day"],
  ["2026-08-21", "Ninoy Aquino Day"],
  ["2026-08-31", "National Heroes Day"],
  ["2026-11-01", "All Saints' Day"],
  ["2026-11-02", "All Souls' Day"],
  ["2026-11-30", "Bonifacio Day"],
  ["2026-12-08", "Feast of the Immaculate Conception"],
  ["2026-12-24", "Christmas Eve"],
  ["2026-12-25", "Christmas Day"],
  ["2026-12-30", "Rizal Day"],
  ["2026-12-31", "Last Day of the Year"],
];

/**
 * The 14 leave types, from src/lib/leave-types.ts. They are updated on every run, so a newer
 * version of the system brings its corrected rules (there is no screen that edits leave types).
 */
export async function seedLeaveTypes(db: PrismaClient) {
  for (const [index, t] of LEAVE_TYPES.entries()) {
    const data = {
      name: t.name,
      legalBasis: t.legalBasis,
      ruleNote: t.ruleNote,
      deductsFrom: t.deductsFrom,
      detailKind: t.detailKind,
      convertible: t.convertible,
      maxDaysPerYear: t.maxDaysPerYear,
      eligibleStatuses: t.eligibleStatuses,
      sortOrder: index + 1,
    };
    await db.leaveType.upsert({ where: { code: t.code }, update: data, create: { code: t.code, ...data } });
  }
}

/**
 * Adds the listed holidays of the given years (all years when none given), but only for a year
 * that has no holiday in the database yet. Once the HRMO has holidays for a year (and may have
 * edited or deleted some on the Holidays page), running the seed again never adds them back.
 * Returns how many holidays were added.
 */
export async function seedHolidays(db: PrismaClient, years?: number[]) {
  const listedYears = [...new Set(HOLIDAYS.map(([date]) => Number(date.slice(0, 4))))];
  let added = 0;
  for (const year of listedYears.filter((y) => !years || years.includes(y))) {
    const existing = await db.holiday.count({ where: { date: { gte: toDbDate(`${year}-01-01`), lte: toDbDate(`${year}-12-31`) } } });
    if (existing > 0) continue;
    const rows = HOLIDAYS.filter(([date]) => date.startsWith(`${year}-`)).map(([date, name]) => ({ date: toDbDate(date), name }));
    added += (await db.holiday.createMany({ data: rows, skipDuplicates: true })).count;
  }
  return added;
}

/**
 * NATIONAL monthly salary schedule effective January 1, 2026: the third tranche under EO No. 64, s. 2024,
 * copied from DBM National Budget Circular No. 601 (January 22, 2026), Annex A, in pesos.
 * Source: https://www.dbm.gov.ph/wp-content/uploads/Issuances/2026/National-Budget-Circular/NATIONAL-BUDGET-CIRCULAR-NO.-601_NEW.pdf
 * One line per salary grade (1 to 33), Steps 1 to 8; grade 33 has only Steps 1 and 2.
 * The LGU pays a percentage of these (set on /salary-schedule). Later years are loaded by the HRMO
 * with Import on /salary-schedule, never typed here.
 */
export const SALARY_SCHEDULE_2026: number[][] = [
  [14634, 14730, 14849, 14968, 15089, 15211, 15333, 15456], // SG 1
  [15522, 15636, 15752, 15869, 15986, 16103, 16223, 16342], // SG 2
  [16486, 16610, 16732, 16856, 16982, 17106, 17234, 17360], // SG 3
  [17506, 17636, 17767, 17898, 18031, 18163, 18298, 18433], // SG 4
  [18581, 18720, 18858, 18998, 19137, 19280, 19423, 19565], // SG 5
  [19716, 19862, 20009, 20158, 20307, 20456, 20609, 20761], // SG 6
  [20914, 21069, 21224, 21382, 21539, 21699, 21859, 22022], // SG 7
  [22423, 22627, 22832, 23038, 23246, 23456, 23668, 23883], // SG 8
  [24329, 24523, 24720, 24917, 25117, 25318, 25521, 25725], // SG 9
  [26917, 27131, 27347, 27565, 27786, 28007, 28230, 28456], // SG 10
  [31705, 31820, 32109, 32401, 32697, 32998, 33302, 33611], // SG 11
  [33947, 34069, 34357, 34648, 34943, 35242, 35544, 35850], // SG 12
  [36125, 36283, 36599, 36919, 37244, 37572, 37904, 38241], // SG 13
  [38764, 39141, 39523, 39910, 40300, 40696, 41097, 41503], // SG 14
  [42178, 42594, 43015, 43442, 43874, 44310, 44753, 45202], // SG 15
  [45694, 46152, 46615, 47084, 47559, 48040, 48528, 49020], // SG 16
  [49562, 50066, 50576, 51092, 51614, 52144, 52678, 53221], // SG 17
  [53818, 54371, 54933, 55499, 56075, 56657, 57246, 57842], // SG 18
  [59153, 59966, 60793, 61632, 62486, 63353, 64236, 65132], // SG 19
  [66052, 66970, 67904, 68853, 69818, 70772, 71727, 72671], // SG 20
  [73303, 74337, 75388, 76456, 77542, 78645, 79692, 80831], // SG 21
  [81796, 82963, 84151, 85356, 86582, 87746, 89011, 90295], // SG 22
  [91306, 92622, 93962, 95330, 96823, 98341, 99883, 101318], // SG 23
  [102603, 104209, 105841, 107500, 109185, 110898, 112533, 114301], // SG 24
  [116643, 118469, 120326, 122212, 124131, 126079, 128061, 130073], // SG 25
  [131807, 133870, 135968, 138100, 140268, 142469, 144707, 146983], // SG 26
  [148940, 151273, 153644, 155906, 158353, 160235, 162752, 165310], // SG 27
  [167129, 169752, 172418, 174797, 177545, 180339, 182660, 185537], // SG 28
  [187531, 190482, 193480, 196528, 199624, 202005, 205191, 208430], // SG 29
  [210718, 214038, 217207, 220425, 223691, 227224, 230595, 234240], // SG 30
  [300961, 306691, 312532, 318182, 323938, 329989, 336092, 342310], // SG 31
  [356237, 363257, 370418, 377359, 384805, 392400, 400150, 408055], // SG 32
  [449157, 462329], // SG 33
];

/**
 * Fills the SalarySchedule table with the 2026 national amounts, but only when the table is empty,
 * so amounts the HRMO edited or imported on /salary-schedule are never overwritten.
 * Returns how many rows were added (0 or 258).
 */
export async function seedSalarySchedule(db: PrismaClient) {
  if ((await db.salarySchedule.count()) > 0) return 0;
  const data = SALARY_SCHEDULE_2026.flatMap((amounts, index) =>
    amounts.map((amount, stepIndex) => ({ grade: index + 1, step: stepIndex + 1, amount: String(amount) })),
  );
  return (await db.salarySchedule.createMany({ data, skipDuplicates: true })).count;
}
