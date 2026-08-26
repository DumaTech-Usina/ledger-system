import type { ReactElement } from "react";
import {
  ArrowRightLeft,
  BadgeCheck,
  Building2,
  CircleDashed,
  Diamond,
  FileClock,
  FileCode,
  FileSpreadsheet,
  FileText,
  FileX,
  Gift,
  HandCoins,
  Image,
  Landmark,
  Paperclip,
  Percent,
  PiggyBank,
  Receipt,
  RotateCcw,
  TriangleAlert,
  Users,
  Wrench,
} from "lucide-react";

const iconProps = { className: "size-5", strokeWidth: 1.5 };

export const scenarioIcons: Record<string, ReactElement> = {
  register_payment: <Receipt {...iconProps} />,
  register_payroll: <Users {...iconProps} />,
  register_infrastructure: <Building2 {...iconProps} />,
  register_penalty: <TriangleAlert {...iconProps} />,
  // Incentive — a reward handed to a counterparty.
  register_incentive: <Gift {...iconProps} />,
  // Cash paid out ahead of when it's normally due.
  register_advance: <HandCoins {...iconProps} />,
  // Bank/institution — the classic loan-origination mark.
  register_loan: <Landmark {...iconProps} />,
  // The commission entitlement is discharged, not paid.
  register_waiver: <FileX {...iconProps} />,
  // Not yet realized — an accrual booked ahead of the cash that will settle it.
  register_commission_accrual: <CircleDashed {...iconProps} />,
  // Two parties exchanging directly, bypassing a third — the usina's own cash never moves.
  register_direct_payment: <ArrowRightLeft {...iconProps} />,
  // Cash actually landing, settling a prior accrual.
  register_commission_received: <PiggyBank {...iconProps} />,
  // An advance coming back to the usina.
  register_advance_settlement: <RotateCcw {...iconProps} />,
  // A loan fully settled/paid off.
  register_loan_repayment: <BadgeCheck {...iconProps} />,
  // An obligation established by an external fact (invoice, payroll, tax) before any cash moves.
  register_obligation_recognition: <FileClock {...iconProps} />,
  // A service fee paid to a supplier/provider.
  register_service_fee: <Wrench {...iconProps} />,
  // A tax paid to an authority.
  register_tax: <Percent {...iconProps} />,
};

export const defaultScenarioIcon = <Diamond {...iconProps} />;

export const paperclipIcon = <Paperclip className="size-5" strokeWidth={1.5} />;

const fileTypeIconProps = { className: "size-4", strokeWidth: 1.5 };

export const fileTypeIcons: Record<"pdf" | "image" | "csv" | "xml", ReactElement> = {
  pdf: <FileText {...fileTypeIconProps} />,
  image: <Image {...fileTypeIconProps} />,
  csv: <FileSpreadsheet {...fileTypeIconProps} />,
  xml: <FileCode {...fileTypeIconProps} />,
};
