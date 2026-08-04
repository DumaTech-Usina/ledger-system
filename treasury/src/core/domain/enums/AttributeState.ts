/**
 * Every attribute has three states, not two. Collapsing DECLINED into UNKNOWN makes the system ask
 * forever; it is also the direct application of "unknown is a valid state" — absence is recorded as
 * an explicit, qualified absence rather than a gap to be filled by inference.
 *
 * UNKNOWN is represented by the attribute being *absent* from the Party's attribute map, so only
 * KNOWN and DECLINED are ever stored.
 */
export enum AttributeState {
  /** Observed, with provenance. Never asked again. */
  KNOWN = "known",
  /** Asked; the user did not know or did not want to say. Never re-asked conversationally. */
  DECLINED = "declined",
}
