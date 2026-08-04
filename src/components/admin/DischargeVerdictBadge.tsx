"use client";

import {
  getDischargeVerdictBadgeClass,
  getDischargeVerdictLabel,
  type DischargeVerdictStatus,
} from "@/lib/dischargeVerdict";

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
