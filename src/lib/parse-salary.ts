import { normalizeVndAmount, prepareImageForParse, fileToBase64 } from "@/lib/parse-payment-list"

/** Vietnam statutory employer social-insurance rate (BHXH 17.5% + BHYT 3% + BHTN 1%). */
export const EMPLOYER_INSURANCE_RATE = 0.215

export type ParsedSalary = {
  year: number
  month: number
  headcount: number | null
  fixedSalaryVnd: number
  svcVnd: number
  insuranceVnd: number // employer contribution (company cost)
  foodVnd: number
  bonusesVnd: number
  overtimeVnd: number
  otherVnd: number
  insuranceBaseVnd: number
  grossIncomeVnd: number
  netPaidVnd: number
  warnings: string[]
}

export const SALARY_CATEGORIES = [
  { key: "fixedSalaryVnd", col: "fixed_salary_vnd", label: "Fixed salary", color: "#B8922A" },
  { key: "svcVnd", col: "svc_vnd", label: "Service charge", color: "#1565C0" },
  { key: "foodVnd", col: "food_vnd", label: "Food allowance", color: "#2E7D52" },
  { key: "bonusesVnd", col: "bonuses_vnd", label: "Bonuses", color: "#7B3F00" },
  { key: "overtimeVnd", col: "overtime_vnd", label: "Overtime", color: "#8B3030" },
  { key: "otherVnd", col: "other_vnd", label: "Other", color: "#6B7280" },
  { key: "insuranceVnd", col: "insurance_vnd", label: "Insurance (employer)", color: "#5C4080" },
] as const

export type SalaryCategoryKey = (typeof SALARY_CATEGORIES)[number]["key"]

function amount(value: unknown): number {
  if (value == null || value === "") return 0
  const n = normalizeVndAmount(value as string | number)
  return Number.isFinite(n) && n > 0 ? n : 0
}

export function postProcessParsedSalary(raw: unknown): ParsedSalary {
  const input = (raw ?? {}) as Record<string, unknown>
  const now = new Date()

  const warnings = Array.isArray(input.warnings) ? input.warnings.map((w) => String(w)) : []

  let year =
    typeof input.year === "number" ? input.year : Number(String(input.year ?? "")) || now.getFullYear()
  let month =
    typeof input.month === "number" ? input.month : Number(String(input.month ?? "")) || now.getMonth() + 1
  if (!Number.isFinite(year) || year < 2000 || year > 2100) year = now.getFullYear()
  month = Math.min(12, Math.max(1, Math.round(month) || now.getMonth() + 1))

  const headcountRaw =
    typeof input.headcount === "number" ? input.headcount : Number(String(input.headcount ?? ""))
  const headcount = Number.isFinite(headcountRaw) && headcountRaw > 0 ? Math.round(headcountRaw) : null

  const insuranceBaseVnd = amount(input.insuranceBaseVnd)
  // Employer insurance = 21.5% of the base; fall back to computing it if the model didn't.
  let insuranceVnd = amount(input.employerInsuranceVnd ?? input.insuranceVnd)
  if (insuranceVnd === 0 && insuranceBaseVnd > 0) {
    insuranceVnd = Math.round(insuranceBaseVnd * EMPLOYER_INSURANCE_RATE)
  }

  return {
    year,
    month,
    headcount,
    fixedSalaryVnd: amount(input.fixedSalaryVnd),
    svcVnd: amount(input.svcVnd),
    insuranceVnd,
    foodVnd: amount(input.foodVnd),
    bonusesVnd: amount(input.bonusesVnd),
    overtimeVnd: amount(input.overtimeVnd),
    otherVnd: amount(input.otherVnd),
    insuranceBaseVnd,
    grossIncomeVnd: amount(input.grossIncomeVnd),
    netPaidVnd: amount(input.netPaidVnd),
    warnings,
  }
}

/** PDFs go straight to base64; images are downscaled first (edge gateway limits). */
export async function prepareSalaryFileForParse(
  file: File,
): Promise<{ base64: string; mimeType: string }> {
  if (file.type === "application/pdf") return fileToBase64(file)
  if (file.type.startsWith("image/")) return prepareImageForParse(file)
  throw new Error("Upload a PDF or an image (PNG, JPG, WEBP) of the salary sheet.")
}
