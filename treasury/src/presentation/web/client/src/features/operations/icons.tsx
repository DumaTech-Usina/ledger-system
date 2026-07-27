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
};

export const defaultScenarioIcon = (
  <svg viewBox="0 0 20 20" fill="none" className="size-5">
    <path d="M10 2 18 10 10 18 2 10 10 2Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
  </svg>
);

export const paperclipIcon = (
  <svg viewBox="0 0 20 20" fill="none" className="size-5">
    <path
      d="M13.5 6.5 8 12a2 2 0 1 0 2.8 2.8l5.6-5.6a4 4 0 1 0-5.7-5.7L5.1 9.1a5.7 5.7 0 0 0 8 8l4.9-4.9"
      {...stroke}
    />
  </svg>
);

export const fileTypeIcons: Record<"pdf" | "image" | "csv" | "xml", ReactElement> = {
  pdf: (
    <svg viewBox="0 0 20 20" fill="none" className="size-4">
      <path d="M6 2.5h5.5L15 6v11a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V3.5a1 1 0 0 1 1-1Z" {...stroke} />
      <path d="M11.5 2.5V6H15" {...stroke} />
    </svg>
  ),
  image: (
    <svg viewBox="0 0 20 20" fill="none" className="size-4">
      <rect x="2.5" y="4" width="15" height="12" rx="1.5" {...stroke} />
      <circle cx="7" cy="8.2" r="1.3" {...stroke} />
      <path d="M3 14.5 7.5 11l3 2.5 2.5-2 4 3" {...stroke} />
    </svg>
  ),
  csv: (
    <svg viewBox="0 0 20 20" fill="none" className="size-4">
      <path d="M6 2.5h5.5L15 6v11a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V3.5a1 1 0 0 1 1-1Z" {...stroke} />
      <path d="M6.3 15.2v-4h2.4M6.3 13.2h2M10.1 15.2v-4l1.4 4 1.4-4v4" {...stroke} />
    </svg>
  ),
  xml: (
    <svg viewBox="0 0 20 20" fill="none" className="size-4">
      <path d="M6 2.5h5.5L15 6v11a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V3.5a1 1 0 0 1 1-1Z" {...stroke} />
      <path d="m5.8 12 1.8 1.8-1.8 1.8M9 12l-1 3.6M11.2 12l1.8 1.8-1.8 1.8" {...stroke} />
    </svg>
  ),
};
