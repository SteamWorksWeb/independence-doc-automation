import type { DischargeVerdictStatus } from "@/lib/dischargeVerdict";

export interface SnapshotBorrower {
  id: string;
  lastName: string;
  firstName: string;
  created: string;
  createdBy: string;
  lastUpdated: string;
  lastUpdatedBy: string;
  status: DischargeVerdictStatus;
  lowestMonthlyPayment?: string;
  pipelineStatus?: string;
  client?: {
    id?: string;
    email?: string;
    phone?: string;
  };
}
