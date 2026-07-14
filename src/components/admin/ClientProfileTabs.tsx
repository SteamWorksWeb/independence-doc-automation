"use client";

/**
 * src/components/admin/ClientProfileTabs.tsx
 *
 * Client 360° Profile — 4-tab tabbed interface.
 *
 * Tabs:
 *   1. Personal & Financials  — demographic data, income, itemized DOJ expenses
 *   2. Debt & Hardship        — total debt, student loans, schools, narrative
 *   3. Eligibility Engine     — Brunner Test automated eligibility analysis
 *   4. Messages               — placeholder (Secure Messaging Coming Soon)
 *
 * Props:
 *   client — the full client record returned by GET /api/v1/admin/clients/:id
 *
 * This is a Client Component because it manages tab-switching state.
 * All data rendering is pure — no client-side fetching happens here.
 */

import React, { useState } from "react";
import styles from "./ClientProfile.module.css";
import EligibilityEngine from "./EligibilityEngine";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface IntakeProfile {
  id: string;
  clientId: string;
  // Personal & Household
  dob: string | null;
  ssn: string | null;
  county: string | null;
  phone: string | null;
  address: string | null;
  householdSize: number;
  // Health & Employment
  hasDisability: boolean;
  isEmployed: boolean;
  unemployed5of10: boolean;
  monthlyIncome: number | null;
  // Assets
  housingStatus: string | null;
  hasCar: boolean;
  hasRetirement: boolean;
  expectingRefund: boolean;
  // Monthly Expenses
  expFood: number | null;
  expHousekeeping: number | null;
  expApparel: number | null;
  expPersonalCare: number | null;
  expHousing: number | null;
  expUtilities: number | null;
  expTransportGas: number | null;
  expCarInsurance: number | null;
  // Education & Debt
  totalDebt: number | null;
  studentLoanDebt: number | null;
  schoolsHistory: string | null;
  // Narrative
  hardshipNotes: string | null;
  unmetBasicNeeds: string | null;
  // Status
  isCompleted: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ClientData {
  id: string;
  email: string;
  isVerified: boolean;
  createdAt: string;
  intakeProfile: IntakeProfile | null;
}

// ── Tab definitions ───────────────────────────────────────────────────────────

type TabId = "personal" | "debt" | "documents" | "messages";

interface TabDef {
  id: TabId;
  label: string;
  icon: React.ReactElement;
}

const TABS: TabDef[] = [
  {
    id: "personal",
    label: "Personal & Financials",
    icon: <PersonIcon />,
  },
  {
    id: "debt",
    label: "Debt & Hardship",
    icon: <DebtIcon />,
  },
  {
    id: "documents",
    label: "Eligibility Engine",
    icon: <FileIcon />,
  },
  {
    id: "messages",
    label: "Messages",
    icon: <MessageIcon />,
  },
];

// ── Main component ────────────────────────────────────────────────────────────

export default function ClientProfileTabs({ client }: { client: ClientData }) {
  const [activeTab, setActiveTab] = useState<TabId>("personal");
  const ip = client.intakeProfile;

  return (
    <div className={styles.tabsCard}>
      {/* ── Tab bar ──────────────────────────────────────────── */}
      <div className={styles.tabBar} role="tablist" aria-label="Client profile sections">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            id={`tab-${tab.id}`}
            role="tab"
            aria-selected={activeTab === tab.id}
            aria-controls={`panel-${tab.id}`}
            className={`${styles.tabBtn} ${activeTab === tab.id ? styles.tabBtnActive : ""}`}
            onClick={() => setActiveTab(tab.id)}
          >
            <span className={styles.tabIcon} aria-hidden>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Tab panels ───────────────────────────────────────── */}

      {/* Tab 1: Personal & Financials */}
      <div
        id="panel-personal"
        role="tabpanel"
        aria-labelledby="tab-personal"
        hidden={activeTab !== "personal"}
      >
        {activeTab === "personal" && (
          <div className={styles.tabPanel}>

            {/* ── Demographics ────────────────────────────── */}
            <section className={styles.section} aria-labelledby="section-demo">
              <h3 id="section-demo" className={styles.sectionTitle}>
                Demographics &amp; Household
              </h3>
              {ip ? (
                <dl className={styles.dl}>
                  <DlRow label="Date of Birth"    value={ip.dob}             />
                  <DlRow label="County"           value={ip.county}          />
                  <DlRow label="Phone"            value={ip.phone}           />
                  <DlRow label="Address"          value={ip.address}         />
                  <DlRow label="Household Size"   value={ip.householdSize > 0 ? String(ip.householdSize) : null} />
                  <DlRow label="Housing Status"   value={ip.housingStatus}   />
                </dl>
              ) : <NoIntake />}
            </section>

            {/* ── Employment & Health ──────────────────────── */}
            <section className={styles.section} aria-labelledby="section-emp">
              <h3 id="section-emp" className={styles.sectionTitle}>
                Employment &amp; Health
              </h3>
              {ip ? (
                <dl className={styles.dl}>
                  <DlBoolRow label="Currently Employed"          value={ip.isEmployed}      />
                  <DlBoolRow label="Unemployed 5 of Last 10 Yrs" value={ip.unemployed5of10} />
                  <DlBoolRow label="Has Disability"              value={ip.hasDisability}   />
                  <DlRow     label="Monthly Income"
                    value={ip.monthlyIncome != null ? formatCurrency(ip.monthlyIncome) : null}
                    currency
                  />
                </dl>
              ) : <NoIntake />}
            </section>

            {/* ── Assets ──────────────────────────────────── */}
            <section className={styles.section} aria-labelledby="section-assets">
              <h3 id="section-assets" className={styles.sectionTitle}>Assets</h3>
              {ip ? (
                <dl className={styles.dl}>
                  <DlBoolRow label="Owns a Vehicle"         value={ip.hasCar}           />
                  <DlBoolRow label="Retirement Account"     value={ip.hasRetirement}    />
                  <DlBoolRow label="Expecting Tax Refund"   value={ip.expectingRefund}  />
                </dl>
              ) : <NoIntake />}
            </section>

            {/* ── Monthly Expenses ─────────────────────────── */}
            <section className={styles.section} aria-labelledby="section-exp">
              <h3 id="section-exp" className={styles.sectionTitle}>
                Monthly Expenses (DOJ Itemized)
              </h3>
              {ip ? (
                <dl className={styles.dl}>
                  <DlRow label="Food &amp; Dining"    value={ip.expFood         != null ? formatCurrency(ip.expFood)         : null} currency />
                  <DlRow label="Housekeeping"         value={ip.expHousekeeping  != null ? formatCurrency(ip.expHousekeeping)  : null} currency />
                  <DlRow label="Apparel"              value={ip.expApparel       != null ? formatCurrency(ip.expApparel)       : null} currency />
                  <DlRow label="Personal Care"        value={ip.expPersonalCare  != null ? formatCurrency(ip.expPersonalCare)  : null} currency />
                  <DlRow label="Housing / Rent"       value={ip.expHousing       != null ? formatCurrency(ip.expHousing)       : null} currency />
                  <DlRow label="Utilities"            value={ip.expUtilities     != null ? formatCurrency(ip.expUtilities)     : null} currency />
                  <DlRow label="Transportation / Gas" value={ip.expTransportGas  != null ? formatCurrency(ip.expTransportGas)  : null} currency />
                  <DlRow label="Car Insurance"        value={ip.expCarInsurance  != null ? formatCurrency(ip.expCarInsurance)  : null} currency />
                </dl>
              ) : <NoIntake />}
            </section>

          </div>
        )}
      </div>

      {/* Tab 2: Debt & Hardship */}
      <div
        id="panel-debt"
        role="tabpanel"
        aria-labelledby="tab-debt"
        hidden={activeTab !== "debt"}
      >
        {activeTab === "debt" && (
          <div className={styles.tabPanel}>

            {/* ── Debt Summary ─────────────────────────────── */}
            <section className={styles.section} aria-labelledby="section-debt">
              <h3 id="section-debt" className={styles.sectionTitle}>Debt Overview</h3>
              {ip ? (
                <dl className={styles.dl}>
                  <DlRow label="Total Debt"         value={ip.totalDebt       != null ? formatCurrency(ip.totalDebt)       : null} currency />
                  <DlRow label="Student Loan Debt"  value={ip.studentLoanDebt != null ? formatCurrency(ip.studentLoanDebt) : null} currency />
                </dl>
              ) : <NoIntake />}
            </section>

            {/* ── Education History ─────────────────────────── */}
            <section className={styles.section} aria-labelledby="section-schools">
              <h3 id="section-schools" className={styles.sectionTitle}>Schools &amp; Education</h3>
              {ip ? (
                <div className={styles.narrativeGrid}>
                  <NarrativeBlock
                    label="Schools Attended"
                    text={ip.schoolsHistory}
                  />
                </div>
              ) : <NoIntake />}
            </section>

            {/* ── Hardship Narrative ───────────────────────── */}
            <section className={styles.section} aria-labelledby="section-hardship">
              <h3 id="section-hardship" className={styles.sectionTitle}>
                Hardship Narrative (DOJ Undue-Hardship Form)
              </h3>
              {ip ? (
                <div className={styles.narrativeGrid}>
                  <NarrativeBlock
                    label="Hardship Statement"
                    text={ip.hardshipNotes}
                  />
                  <NarrativeBlock
                    label="Unmet Basic Needs"
                    text={ip.unmetBasicNeeds}
                  />
                </div>
              ) : <NoIntake />}
            </section>

          </div>
        )}
      </div>

      {/* Tab 3: Eligibility Engine */}
      <div
        id="panel-documents"
        role="tabpanel"
        aria-labelledby="tab-documents"
        hidden={activeTab !== "documents"}
      >
        {activeTab === "documents" && (
          <EligibilityEngine intakeProfile={ip} />
        )}
      </div>

      {/* Tab 4: Messages (placeholder) */}
      <div
        id="panel-messages"
        role="tabpanel"
        aria-labelledby="tab-messages"
        hidden={activeTab !== "messages"}
      >
        {activeTab === "messages" && (
          <div className={styles.placeholder}>
            <div className={styles.placeholderIcon}>
              <MessageIconLg />
            </div>
            <p className={styles.placeholderTitle}>Secure Messaging</p>
            <p className={styles.placeholderBody}>
              End-to-end encrypted messaging between the attorney and this client
              will be available here. All communications will be logged and
              protected under attorney-client privilege.
            </p>
            <span className={styles.placeholderBadge}>Coming Soon</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function DlRow({
  label,
  value,
  currency: isCurrency,
}: {
  label: string;
  value: string | null | undefined;
  currency?: boolean;
}) {
  const display = value ?? null;
  return (
    <div className={styles.dlRow}>
      {/* eslint-disable-next-line react/no-danger */}
      <dt className={styles.dt} dangerouslySetInnerHTML={{ __html: label }} />
      <dd className={display == null ? styles.ddMuted : isCurrency ? styles.currency : styles.dd}>
        {display ?? "Not provided"}
      </dd>
    </div>
  );
}

function DlBoolRow({ label, value }: { label: string; value: boolean }) {
  return (
    <div className={styles.dlRow}>
      <dt className={styles.dt}>{label}</dt>
      <dd className={styles.dd}>
        <span className={`${styles.chip} ${value ? styles.chipYes : styles.chipNo}`}>
          {value ? "Yes" : "No"}
        </span>
      </dd>
    </div>
  );
}

function NarrativeBlock({ label, text }: { label: string; text: string | null }) {
  return (
    <div className={styles.narrativeBlock}>
      <p className={styles.narrativeLabel}>{label}</p>
      <div className={`${styles.narrativeText} ${!text ? styles.narrativeEmpty : ""}`}>
        {text ?? "Not provided"}
      </div>
    </div>
  );
}

function NoIntake() {
  return (
    <p className={styles.ddMuted} style={{ padding: "12px 16px" }}>
      This client has not yet started the intake questionnaire.
    </p>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
}

// ── Tab icons (small) ─────────────────────────────────────────────────────────

function PersonIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function DebtIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <line x1="12" y1="1" x2="12" y2="23" />
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </svg>
  );
}

function FileIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  );
}

function MessageIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

// ── Placeholder icons (large) ─────────────────────────────────────────────────

function FileIconLg() {
  return (
    <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10 9 9 9 8 9" />
    </svg>
  );
}

function MessageIconLg() {
  return (
    <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}
