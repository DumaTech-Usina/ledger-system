/**
 * Where an attribute's value came from. Provenance is per attribute, not per entity: the same Party
 * may have a name the user said, a document an ERP imported and a type the scenario implied, and
 * collapsing them would erase the difference between known, imported and inferred.
 */
export enum AttributeSource {
  /** The user stated it. */
  USER = "user",
  /** An extractor proposed it and it was accepted. */
  EXTRACTION = "extraction",
  /** Another system asserted it (ERP, validators, a Ledger sweep). */
  IMPORT = "import",
  /** Inferred by a rule. Never presented back to the user as their own assertion. */
  DERIVED = "derived",
}
