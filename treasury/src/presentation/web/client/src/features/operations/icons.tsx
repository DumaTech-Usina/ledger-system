import type { ReactElement } from "react";

const stroke = { stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

export const scenarioIcons: Record<string, ReactElement> = {
  register_payment: (
    <svg viewBox="0 0 20 20" fill="none" className="size-5">
      <rect x="2.5" y="4.5" width="15" height="11" rx="2" {...stroke} />
      <path d="M2.5 8.5h15" {...stroke} />
      <path d="M5.5 12h3" {...stroke} />
    </svg>
  ),
  register_payroll: (
    <svg viewBox="0 0 20 20" fill="none" className="size-5">
      <circle cx="7" cy="7" r="2.6" {...stroke} />
      <path d="M2.2 16c.6-2.8 2.4-4.3 4.8-4.3s4.2 1.5 4.8 4.3" {...stroke} />
      <circle cx="14.5" cy="6.5" r="2" {...stroke} />
      <path d="M12.8 11.3c1.9.2 3.3 1.6 3.8 4" {...stroke} />
    </svg>
  ),
  register_infrastructure: (
    <svg viewBox="0 0 20 20" fill="none" className="size-5">
      <path d="M4 17V8.5L10 4l6 4.5V17" {...stroke} />
      <path d="M7.5 17v-5h5v5" {...stroke} />
    </svg>
  ),
  register_penalty: (
    <svg viewBox="0 0 20 20" fill="none" className="size-5">
      <path d="M10 3.2 17.5 16H2.5L10 3.2Z" {...stroke} />
      <path d="M10 8.3v3.2" {...stroke} />
      <circle cx="10" cy="13.8" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  ),
  register_incentive: (
    <svg viewBox="0 0 20 20" fill="none" className="size-5">
      <rect x="3" y="8" width="14" height="9" rx="1.5" {...stroke} />
      <path d="M3 11.3h14" {...stroke} />
      <path d="M10 8v9" {...stroke} />
      <path d="M10 8c-2-3.6-6.3-2-4.6.6 1 .9 4.6-.6 4.6-.6Z" {...stroke} />
      <path d="M10 8c2-3.6 6.3-2 4.6.6-1 .9-4.6-.6-4.6-.6Z" {...stroke} />
    </svg>
  ),
  // Coin (elapsed value) with a forward arrow — cash paid out ahead of when it's normally due.
  register_advance: (
    <svg viewBox="0 0 20 20" fill="none" className="size-5">
      <circle cx="8" cy="10" r="5.5" {...stroke} />
      <path d="M8 7.2v5.6" {...stroke} />
      <path d="M6.3 12c.4.6 1 .9 1.7.9s1.6-.4 1.6-1.3-.9-1-1.6-1.2c-.8-.2-1.6-.4-1.6-1.2S7.2 8 8 8s1.3.3 1.6.8" {...stroke} />
      <path d="M13.8 10h4M16 8.2l1.8 1.8-1.8 1.8" {...stroke} />
    </svg>
  ),
  // Bank/institution — the classic loan-origination mark, distinct from the app's own bot-shaped logo.
  register_loan: (
    <svg viewBox="0 0 20 20" fill="none" className="size-5">
      <path d="M10 2.5 17 8H3l7-5.5Z" {...stroke} />
      <path d="M4.3 8v7.2M8 8v7.2M12 8v7.2M15.7 8v7.2" {...stroke} />
      <path d="M3 17h14" {...stroke} />
    </svg>
  ),
  // A voided receipt — the commission entitlement is discharged, not paid.
  register_waiver: (
    <svg viewBox="0 0 20 20" fill="none" className="size-5">
      <path d="M5 2.5h10v15l-2.2-1.4-1.8 1.4-1.8-1.4-1.8 1.4L5 16.1V2.5Z" {...stroke} />
      <path d="M7.3 8.8 12.7 13.4M12.7 8.8 7.3 13.4" {...stroke} />
    </svg>
  ),
  // Dashed (not yet realized) coin — an accrual booked ahead of the cash that will settle it.
  register_commission_accrual: (
    <svg viewBox="0 0 20 20" fill="none" className="size-5">
      <circle cx="10" cy="10" r="6.2" strokeDasharray="2.2 2.2" {...stroke} />
      <path d="M10 7.2v5.6" {...stroke} />
      <path d="M8.3 12.4c.4.6 1 .9 1.7.9s1.6-.4 1.6-1.3-.9-1-1.6-1.2c-.8-.2-1.6-.4-1.6-1.2S9.2 8.4 10 8.4s1.3.3 1.6.8" {...stroke} />
    </svg>
  ),
  // Two parties linked directly, bypassing a third (faded) node — the usina's own cash never moves.
  register_direct_payment: (
    <svg viewBox="0 0 20 20" fill="none" className="size-5">
      <circle cx="3.6" cy="14" r="1.6" {...stroke} />
      <circle cx="16.4" cy="14" r="1.6" {...stroke} />
      <circle cx="10" cy="4" r="1.3" strokeDasharray="1.2 1.4" {...stroke} />
      <path d="M5.4 13.2h9.2" {...stroke} />
      <path d="M12.3 11.4l2.3 1.8-2.3 1.8" {...stroke} />
    </svg>
  ),
  // Solid coin with an inbound corner arrow — cash actually landing, settling a prior accrual.
  register_commission_received: (
    <svg viewBox="0 0 20 20" fill="none" className="size-5">
      <circle cx="11.5" cy="11.5" r="5.8" {...stroke} />
      <path d="M11.5 8.8v5.4" {...stroke} />
      <path d="M9.9 13.8c.4.6 1 .9 1.6.9s1.6-.4 1.6-1.3-.9-1-1.6-1.2c-.8-.2-1.6-.4-1.6-1.2s.7-1.2 1.5-1.2 1.3.3 1.6.8" {...stroke} />
      <path d="M2.5 2.5v4.4h4.4" {...stroke} />
      <path d="M2.5 2.5 6.8 6.8" {...stroke} />
    </svg>
  ),
  // Circular return arrow around a coin — an advance coming back to the usina.
  register_advance_settlement: (
    <svg viewBox="0 0 20 20" fill="none" className="size-5">
      <path d="M4.2 7.8a6 6 0 1 1 .9 5.6" {...stroke} />
      <path d="M3.2 4.8v3.4h3.4" {...stroke} />
      <path d="M10.3 7.6v4.8" {...stroke} />
      <path d="M8.9 11.5c.4.6 1 .9 1.6.9s1.5-.4 1.5-1.2-.8-1-1.5-1.2c-.8-.2-1.6-.4-1.6-1.2s.7-1.1 1.5-1.1 1.2.2 1.5.8" {...stroke} />
    </svg>
  ),
  // Coin with a checkmark — a loan fully settled/paid off.
  register_loan_repayment: (
    <svg viewBox="0 0 20 20" fill="none" className="size-5">
      <circle cx="10" cy="10" r="6.5" {...stroke} />
      <path d="M7 10.3 9.1 12.4 13.5 8" {...stroke} />
    </svg>
  ),
};

export const defaultScenarioIcon = (
  <svg viewBox="0 0 20 20" fill="none" className="size-5">
    <path d="M10 2 18 10 10 18 2 10 10 2Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
  </svg>
);
