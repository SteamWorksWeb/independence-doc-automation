"use client";

export type DischargeVerdictStatus =
  | "HIGH_PROBABILITY"
  | "BORDERLINE"
  | "LOW_PROBABILITY"
  | "PENDING";

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

export const DISCHARGE_VERDICT_STATUSES: DischargeVerdictStatus[] = [
  "HIGH_PROBABILITY",
  "BORDERLINE",
  "LOW_PROBABILITY",
  "PENDING",
];

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

export default function DischargeVerdictBadge({
  status,
  className = "",
}: {
  status: DischargeVerdictStatus;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 py-1 px-2.5 rounded-full text-xs font-semibold tracking-[0.02em] whitespace-nowrap ${getDischargeVerdictBadgeClass(status)} ${className}`}
    >
      {getDischargeVerdictLabel(status)}
    </span>
  );
}
