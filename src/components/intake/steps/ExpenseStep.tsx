'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

const currencyField = (label: string) =>
  z.coerce
    .number({
      error: `${label} must be a valid monthly dollar amount.`,
    })
    .min(0, `${label} cannot be negative.`);

export const expenseSchema = z.object({
  rentExpense: currencyField('Rent / Mortgage'),
  medicalExpense: currencyField('Uninsured Medical'),
  utilitiesExpense: currencyField('Utilities'),
  homeMaintenanceExpense: currencyField('Home maintenance and repair'),
  carInsuranceExpense: currencyField('Car insurance'),
  gasExpense: currencyField('Gas / Fuel'),
});

export type ExpenseFormData = z.infer<typeof expenseSchema>;
type ExpenseFormInput = z.input<typeof expenseSchema>;

interface ExpenseStepProps {
  formId: string;
  defaultValues: ExpenseFormData;
  onSubmit: (data: ExpenseFormData) => void;
}

const fields: Array<{
  name: keyof ExpenseFormData;
  label: string;
  helper?: string;
}> = [
  {
    name: 'rentExpense',
    label: 'Rent / Mortgage',
  },
  {
    name: 'medicalExpense',
    label: 'Uninsured Medical',
    helper: 'Includes copays, prescriptions, medical supplies, and other out-of-pocket care.',
  },
  {
    name: 'utilitiesExpense',
    label: 'Utilities',
    helper: 'Includes telephone, energy, water, cable, and internet.',
  },
  {
    name: 'homeMaintenanceExpense',
    label: 'Home Maintenance and Repair',
    helper: 'Include average monthly costs for necessary repairs, upkeep, and maintenance.',
  },
  {
    name: 'carInsuranceExpense',
    label: 'Car Insurance',
  },
  {
    name: 'gasExpense',
    label: 'Gas / Fuel',
    helper: 'Use your average monthly fuel cost for work, medical, and household transportation.',
  },
];

const inputCls =
  'w-full px-8 py-4 text-[0.9375rem] text-[#1a2744] outline-none bg-transparent placeholder:text-[#9ca3af]';

const shellCls =
  'relative overflow-hidden rounded border bg-white transition-all duration-150 hover:border-[#9ca3af] focus-within:border-[#1d4ed8] focus-within:ring-2 focus-within:ring-[#1d4ed8]/12';

const labelCls =
  'mb-2 block text-[0.8125rem] font-semibold uppercase tracking-[0.08em] text-[#6b7280]';

const helperCls = 'mt-1.5 text-[0.8125rem] text-text-muted leading-[1.45]';

const errorCls = 'mt-1.5 block text-[0.8125rem] text-[#dc2626]';

export default function ExpenseStep({
  formId,
  defaultValues,
  onSubmit,
}: ExpenseStepProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ExpenseFormInput, unknown, ExpenseFormData>({
    resolver: zodResolver(expenseSchema),
    defaultValues,
    mode: 'onSubmit',
  });

  return (
    <form
      id={formId}
      onSubmit={handleSubmit(onSubmit)}
      noValidate
      className="min-h-[280px] animate-step-enter"
    >
      <div className="mb-6">
        <p className="font-sans text-xs font-semibold tracking-[0.14em] uppercase text-crimson mb-2">
          Step 4
        </p>
        <h2 className="font-serif text-[1.5rem] text-navy mb-2">
          Monthly Living Expenses
        </h2>
        <p className="text-[0.9375rem] text-text-muted leading-relaxed">
          Enter your average monthly costs for the following categories. Enter 0 if not applicable.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 max-[540px]:grid-cols-1">
        {fields.map((field) => {
          const fieldError = errors[field.name];
          const errorId = `${field.name}-error`;
          const helperId = `${field.name}-helper`;

          return (
            <div key={field.name}>
              <label htmlFor={field.name} className={labelCls}>
                {field.label}
              </label>
              <div className={`${shellCls} ${fieldError ? 'border-[#dc2626]' : 'border-[#d1d5db]'}`}>
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-base font-medium text-text-muted pointer-events-none">
                  $
                </span>
                <input
                  id={field.name}
                  type="number"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  className={inputCls}
                  placeholder="0.00"
                  aria-invalid={!!fieldError}
                  aria-describedby={
                    fieldError ? errorId : field.helper ? helperId : undefined
                  }
                  {...register(field.name)}
                />
              </div>
              {fieldError ? (
                <span id={errorId} className={errorCls} role="alert">
                  {fieldError.message}
                </span>
              ) : field.helper ? (
                <p id={helperId} className={helperCls}>
                  {field.helper}
                </p>
              ) : null}
            </div>
          );
        })}
      </div>
    </form>
  );
}
