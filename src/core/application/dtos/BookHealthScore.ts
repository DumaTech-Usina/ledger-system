export type HealthLabel = 'saudável' | 'em_atencao' | 'crítico';
export type HealthTrend = 'up' | 'down' | 'stable';

export interface BookHealthScore {
  /** Composite score 0–100, rounded to 1 decimal. */
  score: number;
  label: HealthLabel;
  trend: HealthTrend;
  /** Absolute delta vs previous 90-day window (Leg 1 only). */
  trendDelta: number;
  /** Leg 1: fraction of settlements closed via CASH_IN in the current 90-day window (0–1). */
  closureQuality: number;
  /** Leg 2: 1 − (capitalAtRisk / openExposure) across all current open positions (0–1). */
  openBookHealth: number;
  /** Window size in days (always 90 for now; exposed so the UI can label it). */
  windowDays: number;
}
