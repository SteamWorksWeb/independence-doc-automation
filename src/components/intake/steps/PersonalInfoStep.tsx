'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

export const personalInfoSchema = z.object({
  firstName: z.string().trim().min(1, 'Borrower First Name is required.'),
  lastName: z.string().trim().min(1, 'Borrower Last Name is required.'),
  email: z
    .string()
    .trim()
    .min(1, 'Borrower Email is required.')
    .email('Please enter a valid borrower email address.'),
  phone: z.string().trim().min(1, 'Borrower Phone is required.'),
});

export type PersonalInfoFormData = z.infer<typeof personalInfoSchema>;

interface PersonalInfoStepProps {
  formId: string;
  defaultValues: PersonalInfoFormData;
  lockedEmail: string;
  onSubmit: (data: PersonalInfoFormData) => void;
}

const inputCls =
  'w-full px-5 py-4 text-[0.9375rem] text-[#1a2744] outline-none bg-transparent placeholder:text-[#9ca3af] disabled:cursor-not-allowed disabled:bg-[#f9fafb] disabled:text-[#6b7280]';

const shellCls =
  'relative overflow-hidden rounded border bg-white transition-all duration-150 hover:border-[#9ca3af] focus-within:border-[#1d4ed8] focus-within:ring-2 focus-within:ring-[#1d4ed8]/12';

const labelCls =
  'mb-2 block text-[0.8125rem] font-semibold uppercase tracking-[0.08em] text-[#6b7280]';

const errorCls = 'mt-1.5 block text-[0.8125rem] text-[#dc2626]';

export default function PersonalInfoStep({
  formId,
  defaultValues,
  lockedEmail,
  onSubmit,
}: PersonalInfoStepProps) {
  const emailValue = lockedEmail.trim().toLowerCase();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<PersonalInfoFormData>({
    resolver: zodResolver(personalInfoSchema),
    defaultValues: {
      ...defaultValues,
      email: emailValue,
    },
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
          Step 1
        </p>
        <h2 className="font-serif text-[1.5rem] text-navy mb-2">
          Personal Information
        </h2>
        <p className="text-[0.9375rem] text-text-muted leading-relaxed">
          Confirm your contact details before continuing.
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <label htmlFor="borrower-first-name" className={labelCls}>
            Borrower First Name <span className="text-[#b31e3c]">*</span>
          </label>
          <div className={`${shellCls} ${errors.firstName ? 'border-[#dc2626]' : 'border-[#d1d5db]'}`}>
            <input
              id="borrower-first-name"
              type="text"
              autoComplete="given-name"
              className={inputCls}
              placeholder="Borrower First Name"
              aria-invalid={!!errors.firstName}
              aria-describedby={errors.firstName ? 'borrower-first-name-error' : undefined}
              {...register('firstName')}
            />
          </div>
          {errors.firstName && (
            <span id="borrower-first-name-error" className={errorCls} role="alert">
              {errors.firstName.message}
            </span>
          )}
        </div>

        <div>
          <label htmlFor="borrower-last-name" className={labelCls}>
            Borrower Last Name <span className="text-[#b31e3c]">*</span>
          </label>
          <div className={`${shellCls} ${errors.lastName ? 'border-[#dc2626]' : 'border-[#d1d5db]'}`}>
            <input
              id="borrower-last-name"
              type="text"
              autoComplete="family-name"
              className={inputCls}
              placeholder="Borrower Last Name"
              aria-invalid={!!errors.lastName}
              aria-describedby={errors.lastName ? 'borrower-last-name-error' : undefined}
              {...register('lastName')}
            />
          </div>
          {errors.lastName && (
            <span id="borrower-last-name-error" className={errorCls} role="alert">
              {errors.lastName.message}
            </span>
          )}
        </div>

        <div>
          <label htmlFor="borrower-email" className={labelCls}>
            Borrower Email <span className="text-[#b31e3c]">*</span>
          </label>
          <input type="hidden" value={emailValue} {...register('email')} />
          <div className={`${shellCls} ${errors.email ? 'border-[#dc2626]' : 'border-[#d1d5db]'}`}>
            <input
              id="borrower-email"
              type="email"
              inputMode="email"
              autoComplete="email"
              className={inputCls}
              value={emailValue}
              placeholder="Borrower Email"
              aria-invalid={!!errors.email}
              aria-describedby={errors.email ? 'borrower-email-error' : undefined}
              disabled={true}
              readOnly
            />
          </div>
          {errors.email && (
            <span id="borrower-email-error" className={errorCls} role="alert">
              {errors.email.message}
            </span>
          )}
        </div>

        <div>
          <label htmlFor="borrower-phone" className={labelCls}>
            Borrower Phone <span className="text-[#b31e3c]">*</span>
          </label>
          <div className={`${shellCls} ${errors.phone ? 'border-[#dc2626]' : 'border-[#d1d5db]'}`}>
            <input
              id="borrower-phone"
              type="tel"
              autoComplete="tel"
              className={inputCls}
              placeholder="Borrower Phone"
              aria-invalid={!!errors.phone}
              aria-describedby={errors.phone ? 'borrower-phone-error' : undefined}
              {...register('phone')}
            />
          </div>
          {errors.phone && (
            <span id="borrower-phone-error" className={errorCls} role="alert">
              {errors.phone.message}
            </span>
          )}
        </div>
      </div>
    </form>
  );
}
