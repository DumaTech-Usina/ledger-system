import { ReporterType } from "../../../../core/domain/enums/ReporterType";

export const USINA    = "usina-platform";
export const BROKER   = "broker-001";
export const OPERATOR = "operator-health-001";
export const TAX_AUTH = "receita-federal";

export const reporter = () => ({
  reporterType: ReporterType.SYSTEM,
  reporterId: "worker-test",
  channel: "integration-test",
});
