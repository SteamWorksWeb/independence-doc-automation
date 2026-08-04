export type DischargeVerdictStatus =
  | "HIGH_PROBABILITY"
  | "BORDERLINE"
  | "LOW_PROBABILITY"
  | "PENDING";

export interface DOJProjectionInput {
  hasFederalLoans?: string;
  monthlyGrossIncome?: string;
  monthlyTakeHomePay?: string;
  additionalMonthlyIncome?: string;
  housingExpenses?: string;
  transportationExpenses?: string;
  dependentCareExpenses?: string;
  currentlyEmployed?: string;
  unemployed5Years?: string;
  hasDisability?: string;
  didGraduate?: string;
  schoolClosed?: string;
  is65OrOlder?: string;
  workInFieldOfStudy?: string;
  appliedForIDR?: string;
  madePriorPayments?: string;
  contactedServicer?: string;
}

export interface DOJProjection {
  status: Exclude<DischargeVerdictStatus, "PENDING">;
  disposableIncome: number;
  totalIncome: number;
  totalExpenses: number;
  prongs: {
    minimalStandard: boolean;
    additionalCircumstances: boolean;
    goodFaith: boolean;
  };
  goodFaithSignals: number;
  hardshipSignals: number;
}

export const DISCHARGE_VERDICT_STATUSES: DischargeVerdictStatus[] = [
  "HIGH_PROBABILITY",
  "BORDERLINE",
  "LOW_PROBABILITY",
  "PENDING",
];

const VERDICT_CONFIG: Record<
  DischargeVerdictStatus,
  { label: string; badgeClass: string; activeClass: string }
> = {
  HIGH_PROBABILITY: {
    label: "High Probability",
    badgeClass: "bg-emerald-50 text-emerald-700 border border-emerald-200",
    activeClass: "bg-emerald-600 text-white shadow-sm",
  },
  BORDERLINE: {
    label: "Borderline",
    badgeClass: "bg-amber-50 text-amber-700 border border-amber-200",
    activeClass: "bg-amber-500 text-white shadow-sm",
  },
  LOW_PROBABILITY: {
    label: "Low Probability",
    badgeClass: "bg-red-50 text-red-700 border border-red-200",
    activeClass: "bg-red-600 text-white shadow-sm",
  },
  PENDING: {
    label: "Incomplete/Pending",
    badgeClass: "bg-slate-100 text-slate-600 border border-slate-200",
    activeClass: "bg-slate-500 text-white shadow-sm",
  },
};

export function getDischargeVerdictLabel(status: DischargeVerdictStatus): string {
  return VERDICT_CONFIG[status].label;
}

export function getDischargeVerdictBadgeClass(status: DischargeVerdictStatus): string {
  return VERDICT_CONFIG[status].badgeClass;
}

export function getDischargeVerdictActiveClass(status: DischargeVerdictStatus): string {
  return VERDICT_CONFIG[status].activeClass;
}

export function isDischargeVerdictStatus(value: unknown): value is DischargeVerdictStatus {
  return typeof value === "string" && DISCHARGE_VERDICT_STATUSES.includes(value as DischargeVerdictStatus);
}

export function calculateProjectedDOJStatus(formData: DOJProjectionInput): DOJProjection {
  const takeHome = parseCurrency(formData.monthlyTakeHomePay);
  const grossIncome = parseCurrency(formData.monthlyGrossIncome);
  const additionalIncome = parseCurrency(formData.additionalMonthlyIncome);
  const housingExpenses = parseCurrency(formData.housingExpenses);
  const transportationExpenses = parseCurrency(formData.transportationExpenses);
  const dependentCareExpenses = parseCurrency(formData.dependentCareExpenses);

  const baseIncome = takeHome || grossIncome;
  const totalIncome = baseIncome + additionalIncome;
  const totalExpenses = housingExpenses + transportationExpenses + dependentCareExpenses;
  const disposableIncome = totalIncome - totalExpenses;

  const hasFederalLoans = isYes(formData.hasFederalLoans);
  const minimalStandard = hasFederalLoans && disposableIncome <= 0;

  const hardshipSignals = [
    isYes(formData.unemployed5Years),
    isYes(formData.hasDisability),
    isNo(formData.didGraduate),
    isYes(formData.schoolClosed),
    isYes(formData.is65OrOlder),
    isNo(formData.workInFieldOfStudy),
  ].filter(Boolean).length;
  const additionalCircumstances = hardshipSignals > 0;

  const goodFaithSignals = [
    isYes(formData.appliedForIDR),
    isYes(formData.madePriorPayments),
    isYes(formData.contactedServicer),
  ].filter(Boolean).length;
  const goodFaith = goodFaithSignals >= 2;

  const passedProngs = [minimalStandard, additionalCircumstances, goodFaith].filter(Boolean).length;
  const status =
    passedProngs === 3
      ? "HIGH_PROBABILITY"
      : passedProngs >= 2
      ? "BORDERLINE"
      : "LOW_PROBABILITY";

  return {
    status,
    disposableIncome,
    totalIncome,
    totalExpenses,
    prongs: {
      minimalStandard,
      additionalCircumstances,
      goodFaith,
    },
    goodFaithSignals,
    hardshipSignals,
  };
}

function parseCurrency(raw?: string): number {
  if (!raw || raw.trim() === "") return 0;
  const n = Number(raw.replace(/[$,\s]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function isYes(value?: string): boolean {
  const normalized = value?.trim().toLowerCase();
  return normalized === "yes" || normalized === "true";
}

function isNo(value?: string): boolean {
  const normalized = value?.trim().toLowerCase();
  return normalized === "no" || normalized === "false";
}
