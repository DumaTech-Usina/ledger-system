/**
 * One party as an external system already knows it. Seeding is the cheapest enrichment there is:
 * an imported party arrives with its name (and often its document) already correct, and its
 * conversational cost is zero from the first use.
 */
export interface PartySeed {
  /**
   * The canonical id this party ALREADY has — adopted, never minted. For a party already present in
   * the Ledger the id lives inside immutable events, and the Directory has to join on that exact
   * string. Minting a fresh id here would break the join it exists to serve.
   */
  partyId: string;
  displayName: string;
  /** Other forms this party has been referred to by. */
  aliases?: string[];
  /** CPF/CNPJ as the source holds it; normalization happens at comparison time. */
  document?: string;
  externalIds?: { system: string; value: string }[];
  /** The Ledger's published party vocabulary (company | client | supplier | bank | gateway). */
  type?: string;
}

/**
 * A system that can hand the Directory a batch of parties. Adapters are drop-in: a Ledger sweep and
 * an ERP connector differ only in where the seeds come from, never in what the importer does.
 */
export interface PartySeedSource {
  /** Identifies the originating system; recorded as the provenance of everything it seeds. */
  readonly system: string;
  fetch(): Promise<PartySeed[]>;
}
