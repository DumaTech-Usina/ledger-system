import type { ExternalSignal, ExternalSignalProps, ProposedFact, SignalSystem } from "../../domain/entities/ExternalSignal";
import { IntentStatus } from "../../domain/enums/IntentStatus";
import type { ExternalSignalRepository } from "../repositories/ExternalSignalRepository";
import type { IntentRepository } from "../repositories/IntentRepository";

export interface SignalProposalView extends ProposedFact {
  /** Where the proposal stands now, read from its intent — never stored on the signal. */
  intentStatus: IntentStatus | null;
  ledgerReference?: string;
  /** REQ-286: who declared there is no obligation, and when. Read from the intent. */
  dismissedBy?: string;
  /** The user's name, when Treasury knows the user. */
  dismissedByName?: string;
  dismissedAt?: string;
}

export interface SignalView extends Omit<ExternalSignalProps, "proposals"> {
  proposals: SignalProposalView[];
  /** Who brought it in, by name, when Treasury knows the user. An integration keeps its `system:` id. */
  recordedByName?: string;
}

export type SignalFilter = "needs_action" | "all";

export interface SignalPage {
  signals: SignalView[];
  /** Pass back as `before` for the next page; null when there is nothing older left to read. */
  nextCursor: string | null;
}

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;
/** How many stored signals are read at a time while looking for ones that match the filter. */
const SCAN_CHUNK = 100;

/** A proposal still waiting for the user; accepted, rejected and in-flight ones are not. */
const OPEN_STATUSES: ReadonlySet<string> = new Set([
  IntentStatus.GATHERING,
  IntentStatus.AWAITING_CONFIRMATION,
  IntentStatus.AWAITING_CORRECTION,
]);

/** The signals received, most recent first, each proposal with its current state. */
export class ListExternalSignalsUseCase {
  constructor(
    private readonly signals: ExternalSignalRepository,
    private readonly intents: IntentRepository,
    /** Treasury's users, to name who recorded or decided. Without it, the id is shown. */
    private readonly users?: { findById(id: string): Promise<{ displayName: string } | null> },
  ) {}

  async execute(): Promise<SignalView[]> {
    const signals = await this.signals.list();
    return Promise.all(signals.map((signal) => this.view(signal)));
  }

  /**
   * One page of signals, newest first. "Needs action" is derived from the intents' current state on
   * every read (nothing is stored on the signal), so the page reads stored signals in chunks until it
   * has `limit` matches or runs out of older ones.
   */
  async page(options: { limit?: number; before?: string; filter?: SignalFilter; system?: SignalSystem } = {}): Promise<SignalPage> {
    const limit = Math.min(Math.max(Math.trunc(options.limit ?? DEFAULT_PAGE_SIZE) || DEFAULT_PAGE_SIZE, 1), MAX_PAGE_SIZE);
    const filter = options.filter ?? "needs_action";
    const found: SignalView[] = [];
    let cursor = options.before;
    let exhausted = false;

    while (found.length < limit && !exhausted) {
      const chunk = await this.signals.listPage({ before: cursor, limit: SCAN_CHUNK });
      if (chunk.length < SCAN_CHUNK) exhausted = true;
      for (const item of chunk) {
        const view = await this.view(item.signal);
        cursor = item.cursor;
        if (!fromSystem(item.signal, options.system)) continue;
        if (filter === "all" || view.proposals.some((p) => p.intentStatus !== null && OPEN_STATUSES.has(p.intentStatus))) {
          found.push(view);
          if (found.length === limit) {
            // Stopped mid-chunk: the next page resumes right after this item.
            exhausted = false;
            break;
          }
        }
      }
    }

    // More may exist unless the whole history was read; a full page that ends exactly at the oldest
    // signal yields one empty follow-up page, which is harmless.
    return { signals: found, nextCursor: exhausted ? null : (cursor ?? null) };
  }

  /** How many distinct proposals still wait for the user, across every signal of a system (the menu badge). */
  async countOpenProposals(system?: SignalSystem): Promise<number> {
    const open = new Set<string>();
    let cursor: string | undefined;
    for (;;) {
      const chunk = await this.signals.listPage({ before: cursor, limit: SCAN_CHUNK });
      for (const { signal, cursor: c } of chunk) {
        cursor = c;
        if (!fromSystem(signal, system)) continue;
        for (const p of signal.toJSON().proposals) {
          if (open.has(p.intentId)) continue;
          const intent = await this.intents.findById(p.intentId);
          if (intent && OPEN_STATUSES.has(intent.status)) open.add(p.intentId);
        }
      }
      if (chunk.length < SCAN_CHUNK) return open.size;
    }
  }

  private async view(signal: ExternalSignal): Promise<SignalView> {
    const props = signal.toJSON();
    const proposals = await Promise.all(
      props.proposals.map(async (p) => {
        const intent = await this.intents.findById(p.intentId);
        return {
          ...p,
          intentStatus: intent?.status ?? null,
          ...(intent?.ledgerReference ? { ledgerReference: intent.ledgerReference } : {}),
          ...(intent?.dismissal
            ? { dismissedBy: intent.dismissal.by, dismissedAt: intent.dismissal.at, ...named("dismissedByName", await this.nameOf(intent.dismissal.by)) }
            : {}),
        };
      }),
    );
    return { ...props, proposals, ...named("recordedByName", await this.nameOf(props.recordedBy)) };
  }

  /** A user's name. An integration (`system:…`) or an unknown id has none: the id is shown instead. */
  private async nameOf(id: string): Promise<string | null> {
    if (!this.users || id.startsWith("system:")) return null;
    return (await this.users.findById(id).catch(() => null))?.displayName ?? null;
  }
}

/** No system asked for: every signal. Signals stored before `system` existed are the insurance's. */
const fromSystem = (signal: ExternalSignal, system: SignalSystem | undefined): boolean =>
  system === undefined || (signal.toJSON().system ?? "insurance") === system;

const named = <K extends string>(key: K, name: string | null): Partial<Record<K, string>> =>
  (name ? { [key]: name } : {}) as Partial<Record<K, string>>;
