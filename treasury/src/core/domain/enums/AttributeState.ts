/**
 * What is stored about an attribute. An attribute nobody has observed is simply absent from the
 * Party's attribute map: "unknown is a valid state", and absence is how it is written.
 */
export enum AttributeState {
  /** Observed, with provenance. */
  KNOWN = "known",
}
