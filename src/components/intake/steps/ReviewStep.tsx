'use client';

export interface ReviewWizardState {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  militaryBranch?: string;
  branch?: string;
  serviceBranch?: string;
  serviceStartDate?: string;
  serviceEndDate?: string;
  militaryServiceStart?: string;
  militaryServiceEnd?: string;
  dischargeStatus?: string;
  dischargeType?: string;
  hasDisability?: boolean;
  isEmployed?: boolean;
  unemployed5of10?: boolean;
  hasCar?: boolean;
  monthlyIncome?: string | number;
  rentExpense?: string | number;
  medicalExpense?: string | number;
  utilitiesExpense?: string | number;
  homeMaintenanceExpense?: string | number;
  carInsuranceExpense?: string | number;
  gasExpense?: string | number;
}

interface ReviewStepProps {
  wizardState: ReviewWizardState;
}

const emptyValue = 'Not provided';

const formatText = (value: unknown): string => {
  if (typeof value === 'string') return value.trim() || emptyValue;
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : emptyValue;
  return emptyValue;
};

const formatBoolean = (value: unknown): string => {
  if (typeof value !== 'boolean') return emptyValue;
  return value ? 'Yes' : 'No';
};

const formatCurrency = (value: unknown): string => {
  const amount =
    typeof value === 'number'
      ? value
      : typeof value === 'string' && value.trim()
        ? Number(value)
        : 0;

  if (!Number.isFinite(amount)) return emptyValue;

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(amount);
};

const resolveFirst = (
  wizardState: ReviewWizardState,
  keys: Array<keyof ReviewWizardState>
): unknown => {
  for (const key of keys) {
    const value = wizardState[key];
    if (typeof value === 'string' && value.trim()) return value;
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'boolean') return value;
  }

  return undefined;
};

function SummarySection({
  title,
  items,
}: {
  title: string;
  items: Array<{ label: string; value: string }>;
}) {
  return (
    <section className="border border-border rounded-lg overflow-hidden">
      <div className="bg-bg px-4 py-3 border-b border-border">
        <h3 className="font-serif text-[1.125rem] text-navy">{title}</h3>
      </div>
      <dl className="divide-y divide-border">
        {items.map((item) => (
          <div
            key={item.label}
            className="grid grid-cols-[minmax(120px,0.45fr)_1fr] gap-4 px-4 py-3 max-[540px]:grid-cols-1 max-[540px]:gap-1"
          >
            <dt className="text-[0.8125rem] font-semibold uppercase tracking-[0.08em] text-text-muted">
              {item.label}
            </dt>
            <dd className="text-[0.9375rem] text-text-primary break-words">
              {item.value}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

export default function ReviewStep({ wizardState }: ReviewStepProps) {
  const fullName = [wizardState.firstName, wizardState.lastName]
    .filter((part): part is string => typeof part === 'string' && part.trim().length > 0)
    .join(' ');

  const serviceStart = resolveFirst(wizardState, [
    'serviceStartDate',
    'militaryServiceStart',
  ]);
  const serviceEnd = resolveFirst(wizardState, [
    'serviceEndDate',
    'militaryServiceEnd',
  ]);
  const serviceDates =
    formatText(serviceStart) === emptyValue && formatText(serviceEnd) === emptyValue
      ? emptyValue
      : `${formatText(serviceStart)} to ${formatText(serviceEnd)}`;

  return (
    <div className="min-h-[280px] animate-step-enter">
      <div className="mb-6">
        <p className="font-sans text-xs font-semibold tracking-[0.14em] uppercase text-crimson mb-2">
          Step 5
        </p>
        <h2 className="font-serif text-[1.5rem] text-navy mb-2">
          Review &amp; Submit
        </h2>
        <p className="text-[0.9375rem] text-text-muted leading-relaxed">
          Please review your intake packet before sending it to your legal team.
        </p>
      </div>

      <div className="space-y-5">
        <SummarySection
          title="Personal Information"
          items={[
            { label: 'Name', value: fullName || emptyValue },
            { label: 'Phone', value: formatText(wizardState.phone) },
            { label: 'Email', value: formatText(wizardState.email) },
          ]}
        />

        <SummarySection
          title="Military Service"
          items={[
            {
              label: 'Branch',
              value: formatText(resolveFirst(wizardState, ['militaryBranch', 'branch', 'serviceBranch'])),
            },
            { label: 'Dates', value: serviceDates },
            {
              label: 'Discharge',
              value: formatText(resolveFirst(wizardState, ['dischargeStatus', 'dischargeType'])),
            },
          ]}
        />

        <SummarySection
          title="Financial Hardship"
          items={[
            { label: 'Employed', value: formatBoolean(wizardState.isEmployed) },
            { label: 'Disability', value: formatBoolean(wizardState.hasDisability) },
            { label: 'Vehicle', value: formatBoolean(wizardState.hasCar) },
            { label: 'Unemployed 5 of 10 Years', value: formatBoolean(wizardState.unemployed5of10) },
            { label: 'Monthly Income', value: formatCurrency(wizardState.monthlyIncome) },
          ]}
        />

        <SummarySection
          title="Monthly Expenses"
          items={[
            { label: 'Rent / Mortgage', value: formatCurrency(wizardState.rentExpense) },
            { label: 'Uninsured Medical', value: formatCurrency(wizardState.medicalExpense) },
            { label: 'Utilities', value: formatCurrency(wizardState.utilitiesExpense) },
            { label: 'Home Maintenance', value: formatCurrency(wizardState.homeMaintenanceExpense) },
            { label: 'Car Insurance', value: formatCurrency(wizardState.carInsuranceExpense) },
            { label: 'Gas / Fuel', value: formatCurrency(wizardState.gasExpense) },
          ]}
        />
      </div>

      <p className="mt-6 rounded-md border border-crimson/20 bg-crimson/5 px-4 py-3 text-[0.875rem] leading-relaxed text-text-secondary">
        By clicking submit, I verify this information is accurate to the best of my knowledge
        and authorize The Independence Law Firm to review it for my student loan matter.
      </p>
    </div>
  );
}
