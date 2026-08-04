"use client";

import Link from "next/link";
import type { FormEvent } from "react";
import { use, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import DischargeVerdictBadge from "@/components/admin/DischargeVerdictBadge";
import {
  calculateProjectedDOJStatus,
  getDischargeVerdictLabel,
  type DOJProjection,
  type DOJProjectionInput,
} from "@/lib/dischargeVerdict";

interface PageProps {
  params: Promise<{ id: string }>;
}

interface EditFormData extends Required<DOJProjectionInput> {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  outstandingBalance: string;
  householdSize: string;
  lastAttendedSchool: string;
}

const EMPTY_FORM: EditFormData = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  hasFederalLoans: "",
  outstandingBalance: "",
  householdSize: "1",
  monthlyGrossIncome: "",
  monthlyTakeHomePay: "",
  additionalMonthlyIncome: "",
  housingExpenses: "",
  transportationExpenses: "",
  dependentCareExpenses: "",
  currentlyEmployed: "Yes",
  workInFieldOfStudy: "Yes",
  unemployed5Years: "No",
  hasDisability: "No",
  didGraduate: "Yes",
  schoolClosed: "No",
  lastAttendedSchool: "",
  is65OrOlder: "No",
  appliedForIDR: "No",
  madePriorPayments: "No",
  contactedServicer: "No",
};

const inputCls =
  "h-10 w-full rounded-md border border-border bg-white px-3 text-sm text-text-primary outline-none transition focus:border-navy focus:ring-2 focus:ring-navy/10";
const selectCls = `${inputCls} cursor-pointer`;

export default function EditClientDischargePage({ params }: PageProps) {
  const { id } = use(params);
  const router = useRouter();
  const [form, setForm] = useState<EditFormData>(EMPTY_FORM);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadProfile() {
      setIsLoading(true);
      setError(null);

      try {
        const res = await fetch(`/api/admin/clients/${id}/profile`, {
          cache: "no-store",
          credentials: "same-origin",
        });
        const data = await res.json().catch(() => null);

        if (!res.ok) {
          throw new Error(readMessage(data) ?? `Profile request failed (${res.status})`);
        }

        if (!cancelled) {
          setForm(hydrateForm(data));
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Unable to load client profile.");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    loadProfile();

    return () => {
      cancelled = true;
    };
  }, [id]);

  const projection = useMemo(() => calculateProjectedDOJStatus(form), [form]);

  const set = (key: keyof EditFormData) => (value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setSaveError(null);

    const payload = {
      ...form,
      // ── Numbers ──
      outstandingBalance: toNumber(form.outstandingBalance),
      householdSize: toNumber(form.householdSize, 1),
      monthlyGrossIncome: toNumber(form.monthlyGrossIncome),
      monthlyTakeHomePay: toNumber(form.monthlyTakeHomePay),
      additionalMonthlyIncome: toNumber(form.additionalMonthlyIncome),
      housingExpenses: toNumber(form.housingExpenses),
      transportationExpenses: toNumber(form.transportationExpenses),
      dependentCareExpenses: toNumber(form.dependentCareExpenses),
      // ── Booleans (Prisma expects real booleans, not "Yes"/"No" strings) ──
      hasFederalLoans: form.hasFederalLoans === "Yes",
      currentlyEmployed: form.currentlyEmployed === "Yes",
      workInFieldOfStudy: form.workInFieldOfStudy === "Yes",
      unemployed5Years: form.unemployed5Years === "Yes",
      hasDisability: form.hasDisability === "Yes",
      didGraduate: form.didGraduate === "Yes",
      schoolClosed: form.schoolClosed === "Yes",
      is65OrOlder: form.is65OrOlder === "Yes",
      appliedForIDR: form.appliedForIDR === "Yes",
      madePriorPayments: form.madePriorPayments === "Yes",
      contactedServicer: form.contactedServicer === "Yes",
      // ── Dates (Prisma expects ISO-8601 DateTime, not YYYY-MM-DD) ──
      lastAttendedSchool: form.lastAttendedSchool
        ? new Date(form.lastAttendedSchool).toISOString()
        : null,
      // ── Projection ──
      projectedStatus: projection.status,
      status: projection.status,
    };

    try {
      const res = await fetch(`/api/admin/clients/${id}/profile`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => null);

      if (!res.ok) {
        console.error("[edit-snapshot/save] API error:", {
          status: res.status,
          body: data,
          payload,
        });
        throw new Error(readMessage(data) ?? `Save failed (${res.status})`);
      }

      router.push(`/admin/clients/${id}`);
      router.refresh();
    } catch (err) {
      console.error("[edit-snapshot/save] Save failed:", err);
      const msg = err instanceof Error ? err.message : "Unable to save changes.";
      setSaveError(msg);
      alert(`❌ Save failed:\n${msg}`);
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return <EditSkeleton />;
  }

  if (error) {
    return (
      <div className="flex max-w-[1200px] flex-col gap-4 animate-fade-in">
        <Link href={`/admin/clients/${id}`} className="text-sm font-semibold text-navy">
          Back to Client Profile
        </Link>
        <div className="rounded-lg border border-red-200 bg-red-50 p-5 text-sm text-red-700">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="flex max-w-[1200px] flex-col gap-6 pt-24 pb-10 animate-fade-in md:pt-0">
      <MobileStickyScoreboard projection={projection} />

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href={`/admin/clients/${id}`} className="text-sm font-semibold text-text-muted hover:text-navy">
            Back to Client Profile
          </Link>
          <h1 className="mt-2 font-serif text-[clamp(1.5rem,2.5vw,2rem)] font-black italic leading-tight text-navy">
            Edit Discharge Snapshot
          </h1>
          <p className="mt-1 text-sm text-text-muted">
            Update intake data and preview the full DOJ 3-prong projection in real time.
          </p>
        </div>
        <button
          type="submit"
          form="edit-discharge-snapshot-form"
          disabled={isSaving}
          className="h-10 rounded-md bg-[#2563eb] px-5 text-sm font-bold text-white shadow-sm transition hover:bg-[#1d4ed8] disabled:cursor-wait disabled:opacity-60"
        >
          {isSaving ? "Saving..." : "Save Changes"}
        </button>
      </div>

      {saveError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
          {saveError}
        </div>
      )}

      <div className="flex flex-col md:flex-row gap-6 relative items-start">
        <div className="w-full md:w-2/3">
        <form
          id="edit-discharge-snapshot-form"
          className="rounded-lg border border-border bg-white shadow-sm"
          onSubmit={handleSave}
        >
          <Section title="Borrower">
            <Field label="First Name"><TextInput value={form.firstName} onChange={set("firstName")} /></Field>
            <Field label="Last Name"><TextInput value={form.lastName} onChange={set("lastName")} /></Field>
            <Field label="Email"><TextInput type="email" value={form.email} onChange={set("email")} /></Field>
            <Field label="Phone"><TextInput type="tel" value={form.phone} onChange={set("phone")} /></Field>
          </Section>

          <Section title="Loans And Household">
            <Field label="Federal Student Loans"><YesNoSelect value={form.hasFederalLoans} onChange={set("hasFederalLoans")} includeUnknown /></Field>
            <Field label="Outstanding Principal Balance"><CurrencyInput value={form.outstandingBalance} onChange={set("outstandingBalance")} /></Field>
            <Field label="Household Size"><TextInput type="number" value={form.householdSize} onChange={set("householdSize")} /></Field>
          </Section>

          <Section title="Prong 1: Disposable Income">
            <Field label="Monthly Gross Income"><CurrencyInput value={form.monthlyGrossIncome} onChange={set("monthlyGrossIncome")} /></Field>
            <Field label="Monthly Take-Home Pay"><CurrencyInput value={form.monthlyTakeHomePay} onChange={set("monthlyTakeHomePay")} /></Field>
            <Field label="Additional Monthly Income"><CurrencyInput value={form.additionalMonthlyIncome} onChange={set("additionalMonthlyIncome")} /></Field>
            <Field label="Monthly Housing Expenses"><CurrencyInput value={form.housingExpenses} onChange={set("housingExpenses")} /></Field>
            <Field label="Monthly Transportation Expenses"><CurrencyInput value={form.transportationExpenses} onChange={set("transportationExpenses")} /></Field>
            <Field label="Monthly Dependent Care Expenses"><CurrencyInput value={form.dependentCareExpenses} onChange={set("dependentCareExpenses")} /></Field>
          </Section>

          <Section title="Prong 2: Additional Circumstances">
            <Field label="Currently Employed"><YesNoSelect value={form.currentlyEmployed} onChange={set("currentlyEmployed")} /></Field>
            <Field label="Works In Field Of Study"><YesNoSelect value={form.workInFieldOfStudy} onChange={set("workInFieldOfStudy")} /></Field>
            <Field label="Unemployed 5+ Years In Last 10"><YesNoSelect value={form.unemployed5Years} onChange={set("unemployed5Years")} /></Field>
            <Field label="Disability Or Chronic Injury"><YesNoSelect value={form.hasDisability} onChange={set("hasDisability")} /></Field>
            <Field label="Graduated"><YesNoSelect value={form.didGraduate} onChange={set("didGraduate")} /></Field>
            <Field label="School Closed"><YesNoSelect value={form.schoolClosed} onChange={set("schoolClosed")} /></Field>
            <Field label="Last Attended School"><TextInput type="date" value={form.lastAttendedSchool} onChange={set("lastAttendedSchool")} /></Field>
            <Field label="Age 65 Or Older"><YesNoSelect value={form.is65OrOlder} onChange={set("is65OrOlder")} /></Field>
          </Section>

          <Section title="Prong 3: Good Faith">
            <Field label="Applied For IDR"><YesNoSelect value={form.appliedForIDR} onChange={set("appliedForIDR")} /></Field>
            <Field label="Made Prior Payments"><YesNoSelect value={form.madePriorPayments} onChange={set("madePriorPayments")} /></Field>
            <Field label="Contacted Servicer"><YesNoSelect value={form.contactedServicer} onChange={set("contactedServicer")} /></Field>
          </Section>
        </form>
        </div>

        <div className="w-full md:w-1/3 sticky top-6 self-start h-min">
        <aside className="rounded-lg border border-border bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[0.6875rem] font-bold uppercase tracking-[0.07em] text-text-muted">
                Live 3-Prong Scoreboard
              </p>
              <h2 className="mt-1 font-serif text-lg font-bold text-navy">
                Projected DOJ Verdict
              </h2>
            </div>
            <DischargeVerdictBadge status={projection.status} />
          </div>

          <div className="mt-5 space-y-3">
            <ScoreRow label="Prong 1: Minimal Standard" passed={projection.prongs.minimalStandard} />
            <ScoreRow label="Prong 2: Hardship Presumption" passed={projection.prongs.additionalCircumstances} />
            <ScoreRow label="Prong 3: Good Faith" passed={projection.prongs.goodFaith} />
          </div>

          <div className="mt-5 rounded-md bg-bg p-4 text-sm">
            <Metric label="Total Income" value={formatMoney(projection.totalIncome)} />
            <Metric label="Total Expenses" value={formatMoney(projection.totalExpenses)} />
            <Metric label="Disposable Income" value={formatMoney(projection.disposableIncome)} strong />
            <Metric label="Hardship Signals" value={String(projection.hardshipSignals)} />
            <Metric label="Good Faith Signals" value={`${projection.goodFaithSignals}/3`} />
          </div>

          <p className="mt-4 text-xs leading-relaxed text-text-muted">
            This projection recalculates from the edited form. Saving sends the projected verdict as{" "}
            <strong className="text-text-secondary">{getDischargeVerdictLabel(projection.status)}</strong>.
          </p>
        </aside>
        </div>
      </div>
    </div>
  );
}

function MobileStickyScoreboard({ projection }: { projection: DOJProjection }) {
  return (
    <div className="fixed left-0 right-0 top-0 z-50 block border-b border-border bg-white p-3 shadow-md md:hidden">
      <div className="mx-auto flex max-w-[1200px] flex-col gap-2">
        <div className="flex items-center justify-between gap-3">
          <span className="text-[0.6875rem] font-bold uppercase tracking-[0.07em] text-text-muted">
            Projected DOJ Verdict
          </span>
          <DischargeVerdictBadge status={projection.status} />
        </div>
        <div className="flex items-center gap-2 overflow-x-auto [-webkit-overflow-scrolling:touch]">
          <CompactProng label="P1" passed={projection.prongs.minimalStandard} />
          <CompactProng label="P2" passed={projection.prongs.additionalCircumstances} />
          <CompactProng label="P3" passed={projection.prongs.goodFaith} />
        </div>
      </div>
    </div>
  );
}

function CompactProng({ label, passed }: { label: string; passed: boolean }) {
  return (
    <span
      className={`inline-flex min-w-[72px] items-center justify-center rounded-full px-2.5 py-1 text-[0.6875rem] font-bold ${
        passed ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
      }`}
    >
      {label}: {passed ? "Pass" : "Review"}
    </span>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-b border-border p-5 last:border-b-0">
      <h2 className="mb-4 font-serif text-lg font-bold text-navy">{title}</h2>
      <div className="grid gap-4 md:grid-cols-2">{children}</div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5 text-sm font-semibold text-text-secondary">
      {label}
      {children}
    </label>
  );
}

function TextInput({
  value,
  onChange,
  type = "text",
}: {
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return <input type={type} value={value} onChange={(e) => onChange(e.target.value)} className={inputCls} />;
}

function CurrencyInput({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <div className="flex h-10 overflow-hidden rounded-md border border-border bg-white focus-within:border-navy focus-within:ring-2 focus-within:ring-navy/10">
      <span className="flex items-center border-r border-border bg-bg px-3 text-sm font-semibold text-text-muted">$</span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="min-w-0 flex-1 px-3 text-sm text-text-primary outline-none"
      />
    </div>
  );
}

function YesNoSelect({
  value,
  onChange,
  includeUnknown = false,
}: {
  value: string;
  onChange: (value: string) => void;
  includeUnknown?: boolean;
}) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className={selectCls}>
      {includeUnknown && <option value="">Unknown</option>}
      <option value="Yes">Yes</option>
      <option value="No">No</option>
      {includeUnknown && <option value="I don't know">I don't know</option>}
    </select>
  );
}

function ScoreRow({ label, passed }: { label: string; passed: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2">
      <span className="text-sm font-semibold text-text-secondary">{label}</span>
      <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${passed ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
        {passed ? "Pass" : "Review"}
      </span>
    </div>
  );
}

function Metric({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex justify-between gap-4 py-1 ${strong ? "border-t border-border pt-2 font-bold text-navy" : "text-text-secondary"}`}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}

function EditSkeleton() {
  return (
    <div className="flex max-w-[1200px] flex-col gap-6 animate-pulse">
      <div className="h-8 w-72 rounded bg-border" />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="h-[640px] rounded-lg border border-border bg-white" />
        <div className="h-80 rounded-lg border border-border bg-white" />
      </div>
    </div>
  );
}

function hydrateForm(data: unknown): EditFormData {
  const record = isRecord(data) ? data : {};
  const nestedProfile = firstRecord(record, ["profile", "caseProfile", "data"]) ?? record;
  const client = firstRecord(nestedProfile, ["client", "borrower"]) ?? nestedProfile;
  const intake =
    firstRecord(nestedProfile, ["intakeSnapshot", "intake", "snapshot"]) ??
    firstRecord(client, ["intakeProfile"]) ??
    {};
  const discharge =
    firstRecord(nestedProfile, ["dischargeSnapshot", "DischargeSnapshot"]) ??
    firstRecord(client, ["dischargeSnapshot", "DischargeSnapshot"]) ??
    {};

  const records = collectHydrationRecords(client, intake, discharge, nestedProfile, record);
  const source = (...keys: string[]) => readString(records, keys);
  const yesNo = (keys: string[], fallback = "No", includeUnknown = false) =>
    normalizeYesNo(source(...keys), fallback, includeUnknown);
  const money = (...keys: string[]) => source(...keys);

  return {
    firstName: source("firstName", "borrowerFirstName") || "",
    lastName: source("lastName", "borrowerLastName") || "",
    email: source("email", "borrowerEmail") || "",
    phone: source("phone", "phoneNumber", "borrowerPhone") || "",
    hasFederalLoans: yesNo(["hasFederalLoans", "federalLoans", "hasStudentLoans", "federalStudentLoans"], "", true),
    outstandingBalance: money("outstandingBalance", "studentLoanDebt", "totalDebt", "principalBalance", "loanBalance"),
    householdSize: source("householdSize") || "1",
    monthlyGrossIncome: money("monthlyGrossIncome", "grossMonthlyIncome", "monthlyIncome", "grossIncome"),
    monthlyTakeHomePay: money("monthlyTakeHomePay", "takeHomePay", "monthlyNetIncome", "netMonthlyIncome"),
    additionalMonthlyIncome: money("additionalMonthlyIncome", "additionalIncome", "otherMonthlyIncome"),
    housingExpenses: money("housingExpenses", "monthlyHousingExpenses", "expHousing", "housing"),
    transportationExpenses:
      money("transportationExpenses", "monthlyTransportationExpenses", "transportation") ||
      sumFields(records, ["expTransportGas", "expCarInsurance"]),
    dependentCareExpenses: money("dependentCareExpenses", "dependentCare", "childCareExpenses", "familyCareExpenses"),
    currentlyEmployed: yesNo(["currentlyEmployed", "isEmployed", "employed"], "Yes"),
    workInFieldOfStudy: yesNo(["workInFieldOfStudy", "worksInFieldOfStudy"], "Yes"),
    unemployed5Years: yesNo(["unemployed5Years", "unemployedFiveYears"], "No"),
    hasDisability: yesNo(["hasDisability", "disability", "disabledVeteran"], "No"),
    didGraduate: yesNo(["didGraduate", "graduated"], "Yes"),
    schoolClosed: yesNo(["schoolClosed", "isSchoolClosed"], "No"),
    lastAttendedSchool: normalizeDate(source("lastAttendedSchool", "lastAttendedDate")),
    is65OrOlder: yesNo(["is65OrOlder", "age65OrOlder", "olderThan65"], "No"),
    appliedForIDR: yesNo(["appliedForIDR", "appliedForIdr", "idrApplied"], "No"),
    madePriorPayments: yesNo(["madePriorPayments", "priorPayments"], "No"),
    contactedServicer: yesNo(["contactedServicer", "servicerContacted"], "No"),
  };
}

function readString(
  records: Record<string, unknown>[],
  keys: string[]
): string {
  for (const key of keys) {
    for (const source of records) {
      const value = source[key];
      const normalized = valueToInputString(value);
      if (normalized !== "") return normalized;
    }
  }
  return "";
}

function collectHydrationRecords(...roots: Record<string, unknown>[]): Record<string, unknown>[] {
  const records: Record<string, unknown>[] = [];
  const seen = new Set<Record<string, unknown>>();
  const nestedKeys = [
    "profile",
    "caseProfile",
    "data",
    "client",
    "borrower",
    "intakeSnapshot",
    "intakeProfile",
    "intake",
    "snapshot",
    "dischargeSnapshot",
    "DischargeSnapshot",
    "formData",
    "answers",
    "financials",
    "finances",
    "income",
    "expenses",
    "goodFaith",
    "hardship",
    "education",
    "employment",
  ];

  function visit(source: Record<string, unknown>, depth: number) {
    if (seen.has(source) || depth > 4) return;
    seen.add(source);
    records.push(source);

    for (const key of nestedKeys) {
      const value = source[key];
      if (isRecord(value)) visit(value, depth + 1);
    }
  }

  for (const root of roots) {
    visit(root, 0);
  }

  return records;
}

function valueToInputString(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "";
  if (typeof value !== "string") return "";

  const trimmed = value.trim();
  if (!trimmed) return "";

  const normalized = trimmed.toLowerCase();
  if (normalized === "true") return "Yes";
  if (normalized === "false") return "No";
  return trimmed;
}

function normalizeYesNo(value: string, fallback: string, includeUnknown = false): string {
  const normalized = value.trim().toLowerCase();
  if (normalized === "yes") return "Yes";
  if (normalized === "no") return "No";
  if (includeUnknown && (normalized === "i don't know" || normalized === "unknown")) {
    return "I don't know";
  }
  return fallback;
}

function normalizeDate(value: string): string {
  if (!value) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

function sumFields(records: Record<string, unknown>[], keys: string[]): string {
  const total = keys.reduce((sum, key) => {
    const value = readString(records, [key]);
    return sum + toNumber(value);
  }, 0);

  return total > 0 ? String(total) : "";
}

function firstRecord(source: Record<string, unknown>, keys: string[]): Record<string, unknown> | null {
  for (const key of keys) {
    const value = source[key];
    if (isRecord(value)) return value;
  }
  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readMessage(data: unknown): string | null {
  if (!isRecord(data)) return null;
  const message = data.message ?? data.error;
  return typeof message === "string" ? message : null;
}

function formatMoney(value: number): string {
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function toNumber(value: string, fallback = 0): number {
  const cleaned = value.replace(/[$,\s]/g, "");
  if (cleaned === "") return fallback;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : fallback;
}
