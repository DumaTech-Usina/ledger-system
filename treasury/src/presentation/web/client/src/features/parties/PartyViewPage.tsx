import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/Button";
import { Badge } from "@/components/Badge";
import { Banner } from "@/components/Banner";
import { Card } from "@/components/Card";
import { ClearFiltersButton } from "@/components/ClearFiltersButton";
import { DateRangePicker } from "@/components/DateRangePicker";
import { MultiSelectDropdown } from "@/components/MultiSelectDropdown";
import { Pagination } from "@/components/Pagination";
import { Select } from "@/components/Select";
import { Input } from "@/components/Input";
import { Modal } from "@/components/Modal";
import { RowDetailModal } from "@/features/dashboard/RowDetailModal";
import { useObjectLifecycle } from "@/features/dashboard/useObjectLifecycle";
import type { AdoptedIntent } from "@/features/operations/useConversation";
import {
  partiesApi,
  type PageAlert,
  type PageLine,
  type PartyName,
  type Author,
  type HistoryFact,
  type HistoryPageInfo,
  type HistoryQuery,
  type PartyPageResult,
  type Side,
  type SidePageInfo,
  type SideQuery,
} from "@/features/parties/partiesApi";
import { partiesCopy } from "@/features/parties/partiesCopy";
import type { PendingIdentity } from "@/features/parties/partiesApi";
import { PENDING_SECTION_ID, PendingIdentitiesSection } from "@/features/parties/PendingIdentitiesSection";
import { RegisterPartyModal } from "@/features/parties/RegisterPartyModal";
import { CompensateModal } from "@/features/parties/CompensateModal";
import { PrepareBatchModal } from "@/features/batches/PrepareBatchModal";
import { toggle, type Selection } from "@/features/batches/batchSelection";
import {
  alertPosition,
  matchingParties,
  othersInEvent,
  positionFromLifecycle,
  recordedOnAnotherDay,
  rowAction,
  selectionOffer,
  type PickedLine,
} from "@/features/parties/partiesEngine";
import { useLanguage } from "@/i18n/i18n";
import { cn } from "@/utils/cn";
import { formatDate, formatDateTime, formatDocument, formatMoney } from "@/utils/format";

type Copy = (typeof partiesCopy)["pt-BR"];
type Selected = { partyId: string; displayName: string };

/**
 * The list of parties (REQ-630): pick one and its page opens below, with its three sections in order
 * (REQ-631). Nothing here adds anything up (REQ-627): the two sides stay apart with no net figure
 * (REJ-632), and "recebe também por" carries no amount (REQ-633).
 */
export function PartyViewPage({
  canCurate = false,
  pending = [],
  onChanged,
  focusPending = 0,
  canAct = false,
  onOperationStarted,
  reloadKey = 0,
  focusParty,
}: {
  /** REQ-696: opens this party's page, from another screen (the receivables agenda). `nonce` repeats it. */
  focusParty?: { partyId: string; displayName: string; nonce: number } | null;
  /** REQ-691: recording from a position writes to the Ledger — gated on `intent:submit`. */
  canAct?: boolean;
  /** Hands a conversation opened from a position over to the operations page. */
  onOperationStarted?: (intent: AdoptedIntent) => void;
  /** REQ-690: changes when the operator comes back from a conversation opened here. */
  reloadKey?: number;
  /** Curation registers parties and resolves identities (REQ-402); the server enforces it. */
  canCurate?: boolean;
  /** The identities still to resolve (REQ-321), shown to everyone at the top of the list (REQ-315). */
  pending?: PendingIdentity[];
  /** A party was registered or an identity linked: the notification must re-read. */
  onChanged?: () => void;
  /** Bumped by the notification's "Resolver": back to the list, at the pending identities. */
  focusPending?: number;
}) {
  const { language } = useLanguage();
  const copy = partiesCopy[language];
  const [parties, setParties] = useState<PartyName[] | null>(null);
  const [namesFailed, setNamesFailed] = useState(false);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Selected | null>(null);
  // The registration modal: closed, a plain registration, or "cadastrar e ligar" for one identity.
  const [registering, setRegistering] = useState<{ linking?: PendingIdentity } | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const { ok, data } = await partiesApi.names();
      setNamesFailed(!ok);
      if (ok) setParties(data.parties);
    } catch {
      setNamesFailed(true);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (focusParty) setSelected({ partyId: focusParty.partyId, displayName: focusParty.displayName });
    // The nonce is what asks again; the same party asked twice opens twice.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusParty?.nonce]);

  useEffect(() => {
    if (focusPending === 0) return;
    setSelected(null);
    // After the list has rendered again.
    requestAnimationFrame(() => document.getElementById(PENDING_SECTION_ID)?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }, [focusPending]);

  const changed = async (message?: string) => {
    setRegistering(null);
    if (message) setDone(message);
    await load();
    onChanged?.();
  };

  const matches = matchingParties(parties ?? [], query, Number.POSITIVE_INFINITY);
  const registered = (parties ?? []).filter((p) => p.state === "identified");

  // REQ-630: the list is the way in; a party opens on its own page, with a way back to the list.
  if (selected) {
    return (
      <PartyPage
        key={selected.partyId}
        selected={selected}
        onOpen={setSelected}
        onBack={() => setSelected(null)}
        canAct={canAct}
        onOperationStarted={onOperationStarted}
        reloadKey={reloadKey}
      />
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1 basis-72">
          <h2 className="font-display text-2xl font-semibold text-ink">{copy.viewHeading}</h2>
          <p className="mt-1 text-sm text-muted">{copy.viewSubheading}</p>
        </div>
        {canCurate && (
          <Button
            onClick={() => {
              setDone(null);
              setRegistering({});
            }}
          >
            {copy.registerTitle}
          </Button>
        )}
      </div>

      {namesFailed && <Banner variant="bad">{copy.loadError}</Banner>}
      {done && <Banner variant="ok">{done}</Banner>}

      <PendingIdentitiesSection
        pending={pending}
        registered={registered}
        canCurate={canCurate}
        onLinked={() => void changed()}
        onRegisterAndLink={(identity) => {
          setDone(null);
          setRegistering({ linking: identity });
        }}
      />

      <Card>
        <Input
          label={copy.search}
          placeholder={copy.searchPlaceholder}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {parties !== null && parties.length === 0 ? (
          <p className="mt-3 text-sm text-muted">{copy.listEmpty}</p>
        ) : parties !== null && matches.length === 0 ? (
          <p className="mt-3 text-sm text-muted">{copy.noMatch}</p>
        ) : (
          <ol className="mt-3 divide-y divide-line rounded-2xl border border-line" aria-label={copy.viewHeading}>
            {matches.map((party) => {
              const details = registryDetails(party, copy);
              return (
                <li key={party.partyId}>
                  <button
                    type="button"
                    onClick={() => setSelected(party)}
                    // The name names the button; the registry line describes it.
                    aria-labelledby={`party-${party.partyId}`}
                    aria-describedby={details ? `party-${party.partyId}-details` : undefined}
                    className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm text-ink transition hover:bg-accent-soft focus-visible:bg-accent-soft focus-visible:outline-none"
                  >
                    <span className="min-w-0">
                      <span id={`party-${party.partyId}`} className="font-semibold">
                        {party.displayName}
                        {party.state === "provisional" && <>{" "}<span className="font-normal text-muted">({copy.provisionalTag})</span></>}
                        {party.state === "unidentifiable" && <>{" "}<span className="font-normal text-muted">({copy.unidentifiableTag})</span></>}
                      </span>
                      {details && <span id={`party-${party.partyId}-details`} className="mt-0.5 block text-xs text-muted">{details}</span>}
                    </span>
                    <span aria-hidden className="text-muted">›</span>
                  </button>
                </li>
              );
            })}
          </ol>
        )}
      </Card>

      {registering && (
        <RegisterPartyModal linking={registering.linking} onClose={() => setRegistering(null)} onDone={(message) => void changed(message)} />
      )}
    </div>
  );
}

/**
 * What the registry says of a registered party, in one line: type, CPF/CNPJ and bank account (REQ-315).
 * A provisional identity has no registry entry yet, so nothing is said — not "not informed".
 */
function registryDetails(party: PartyName, copy: Copy): string | null {
  if (party.state !== "identified") return null;
  const kind = party.kind === "person" ? copy.person : party.kind === "company" ? copy.company : null;
  const bank =
    party.hasBankAccount === undefined || party.hasBankAccount === null
      ? `${copy.bankShort}: ${copy.notKnown.toLowerCase()}`
      : `${copy.bankShort}: ${party.hasBankAccount ? copy.yes.toLowerCase() : copy.no.toLowerCase()}`;
  return [kind, party.document ? formatDocument(party.document) : null, bank].filter(Boolean).join(" · ");
}

/** One party's page (§8.4). `onOpen` moves to another party's page, from a name shown here. */
function PartyPage({
  selected,
  onOpen,
  onBack,
  canAct,
  onOperationStarted,
  reloadKey,
}: {
  selected: Selected;
  onOpen: (party: Selected) => void;
  onBack: () => void;
  canAct: boolean;
  onOperationStarted?: (intent: AdoptedIntent) => void;
  reloadKey: number;
}) {
  const { t, language } = useLanguage();
  const copy = partiesCopy[language];
  const [result, setResult] = useState<PartyPageResult | null>(null);
  // REQ-631: Operação is the tab that opens.
  const [tab, setTab] = useState<Tab>("operation");
  // REQ-691: the position whose detail is open, from a line or from an alert.
  const [opened, setOpened] = useState<string | null>(null);
  // Bumped when a detail closes — something may have been recorded from it — and on the way back
  // from a conversation (REQ-690). The page and each side read again, keeping filters and paging.
  const [closedDetails, setClosedDetails] = useState(0);
  const version = reloadKey + closedDetails;
  // REQ-692: the positions ticked on Operação, across both sides and pages, and what they allow.
  const [picked, setPicked] = useState<Record<string, PickedLine>>({});
  const offer = selectionOffer(Object.values(picked));
  const [acting, setActing] = useState<"batch" | "compensate" | null>(null);
  const [batchSelection, setBatchSelection] = useState<Selection>({});
  const [notice, setNotice] = useState<string | null>(null);
  const pick = (line: PickedLine) =>
    setPicked((current) => {
      const next = { ...current };
      if (next[line.objectId]) delete next[line.objectId];
      else next[line.objectId] = line;
      return next;
    });
  const done = (message: string) => {
    setActing(null);
    setPicked({});
    setNotice(message);
    setClosedDetails((n) => n + 1);
  };
  const openBatch = () => {
    // The batch of this party (REQ-239): what the Usina owes it, each line at its open balance.
    const lines = Object.values(picked).map((p) => ({
      objectId: p.objectId,
      currency: "BRL",
      openBalance: p.openBalance,
      creditors: [{ partyId: party.partyId }],
    }));
    setBatchSelection(lines.reduce<Selection>((sel, line) => toggle(sel, line), {}));
    setActing("batch");
  };

  useEffect(() => {
    let cancelled = false;
    partiesApi
      .page(selected.partyId)
      .then(({ ok, data }) => {
        if (!cancelled) setResult(ok ? data : { available: false, party: selected });
      })
      .catch(() => {
        if (!cancelled) setResult({ available: false, party: selected });
      });
    return () => {
      cancelled = true;
    };
  }, [selected, version]);

  const party = result?.party ?? selected;

  return (
    <div className={cn("space-y-6", canAct && tab === "operation" && offer && "pb-24")}>
      <button type="button" onClick={onBack} className="text-sm font-semibold text-accent hover:underline">
        ‹ {copy.backToList}
      </button>
      <div>
        <h3 className="font-display text-xl font-semibold text-ink">
          {party.displayName}
          {result?.party.provisional && (
            <>
              {" "}
              <span className="ml-1 text-base font-medium text-muted">({copy.provisionalTag})</span>
            </>
          )}
        </h3>
      </div>

      {result === null ? (
        <p className="text-sm text-muted">{t.common.loading}</p>
      ) : !result.available ? (
        <p className="text-sm font-medium text-bad">{copy.unavailable}</p>
      ) : (
        <>
          <div role="tablist" aria-label={party.displayName} className="flex gap-1 overflow-x-auto border-b border-line">
            {TABS.map((id) => (
              <button
                key={id}
                type="button"
                role="tab"
                id={`tab-${id}`}
                aria-selected={tab === id}
                aria-controls={`panel-${id}`}
                onClick={() => setTab(id)}
                className={cn(
                  "-mb-px whitespace-nowrap border-b-2 px-4 py-2 text-sm font-semibold transition",
                  tab === id ? "border-accent text-ink" : "border-transparent text-muted hover:text-ink",
                )}
              >
                {tabLabel(id, copy)}
              </button>
            ))}
          </div>
          <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
            {tab === "operation" ? (
              <>
                {notice && (
                  <Banner variant="ok" className="mb-4">
                    {notice}
                  </Banner>
                )}
                <OperationSection
                  result={result}
                  copy={copy}
                  onOpen={onOpen}
                  canAct={canAct}
                  version={version}
                  onOpenPosition={setOpened}
                  picked={picked}
                  onPick={(line) => {
                    setNotice(null);
                    pick(line);
                  }}
                />
              </>
            ) : tab === "history" ? (
              <HistorySection result={result} copy={copy} />
            ) : (
              <Card>
                <p className="text-sm text-muted">{copy.resultsPending}</p>
              </Card>
            )}
          </div>
        </>
      )}

      {canAct && tab === "operation" && offer && (
        <div className="fixed inset-x-0 bottom-0 z-[50] px-4 pb-4">
          <div className="glass mx-auto flex max-w-3xl flex-wrap items-center gap-3 rounded-2xl border border-line px-4 py-3 shadow-lg">
            <div className="min-w-0 flex-1 basis-56">
              <p className="text-sm font-semibold text-ink">{copy.picked(Object.keys(picked).length)}</p>
              {offer.kind === "none" && <p className="text-[13px] text-muted">{copy.why[offer.reason]}</p>}
            </div>
            <Button variant="ghost" size="sm" onClick={() => setPicked({})}>
              {copy.clearPicked}
            </Button>
            {offer.kind === "batch" && (
              <Button size="sm" onClick={openBatch}>
                {copy.offerBatch}
              </Button>
            )}
            {offer.kind === "compensate" && (
              <Button size="sm" onClick={() => setActing("compensate")}>
                {copy.offerCompensate(formatMoney(offer.max, "BRL"))}
              </Button>
            )}
          </div>
        </div>
      )}

      {acting === "compensate" && offer?.kind === "compensate" && (
        <CompensateModal
          party={party}
          receivable={offer.receivable}
          payable={offer.payable}
          max={offer.max}
          onClose={() => setActing(null)}
          onCompensated={() => done(copy.compensated)}
        />
      )}

      {acting === "batch" && (
        <PrepareBatchModal
          selection={batchSelection}
          labelOf={(id) => ({ creditor: party.displayName, what: t.objectType[picked[id]?.objectType ?? ""] ?? picked[id]?.objectType ?? "" })}
          onChange={setBatchSelection}
          onClose={() => setActing(null)}
          onPrepared={() => done(copy.batchPrepared)}
        />
      )}

      {opened && (
        <PositionDetail
          objectId={opened}
          partyNames={{ [party.partyId]: party.displayName }}
          canAct={canAct}
          onOperationStarted={onOperationStarted}
          onClose={() => {
            setOpened(null);
            setClosedDetails((n) => n + 1);
          }}
          copy={copy}
        />
      )}
    </div>
  );
}

/**
 * REQ-691: the same detail the agendas open (`RowDetailModal`), with the position's actions — read
 * from the Ledger when it opens, so a line from a page loaded earlier, or an alert about a position on
 * another page, shows the book as it is now.
 */
function PositionDetail({
  objectId,
  partyNames,
  canAct,
  onOperationStarted,
  onClose,
  copy,
}: {
  objectId: string;
  partyNames: Record<string, string>;
  canAct: boolean;
  onOperationStarted?: (intent: AdoptedIntent) => void;
  onClose: () => void;
  copy: Copy;
}) {
  const { t } = useLanguage();
  const lifecycle = useObjectLifecycle(objectId);

  if (lifecycle.kind === "found") {
    return (
      <RowDetailModal
        position={positionFromLifecycle(lifecycle.lifecycle)}
        currency={lifecycle.lifecycle.currency}
        partyNames={{ ...lifecycle.lifecycle.partyNames, ...partyNames }}
        canRectify={canAct}
        onOperationStarted={onOperationStarted}
        onClose={onClose}
      />
    );
  }

  return (
    <Modal open onClose={onClose} title={copy.details} closeLabel={t.common.close} className="max-w-lg">
      <p className={cn("p-6 text-sm", lifecycle.kind === "loading" ? "text-muted" : "font-medium text-bad")}>
        {lifecycle.kind === "loading"
          ? copy.positionLoading
          : lifecycle.kind === "unknown"
            ? copy.positionUnknown
            : copy.positionUnavailable}
      </p>
    </Modal>
  );
}

type Loaded = Extract<PartyPageResult, { available: true }>;

/** REQ-631: the three sections, in this order. */
const TABS = ["operation", "history", "results"] as const;
type Tab = (typeof TABS)[number];

function tabLabel(tab: Tab, copy: Copy): string {
  return tab === "operation" ? copy.sectionOperation : tab === "history" ? copy.sectionHistory : copy.sectionResults;
}

/**
 * Operação (refinement of 2026-11-12): the alerts on top, then each side as its own section — its own
 * filters, its own list, its own paging — because each side is a different job and can hold hundreds
 * of positions. Stacked, never side by side, so no one reads a net (REJ-632). A count per side,
 * never a total: Treasury does not add anything up (REQ-627).
 */
function OperationSection({
  result,
  copy,
  onOpen,
  canAct,
  version,
  onOpenPosition,
  picked,
  onPick,
}: {
  result: Loaded;
  copy: Copy;
  onOpen: (party: Selected) => void;
  canAct: boolean;
  version: number;
  onOpenPosition: (objectId: string) => void;
  picked: Record<string, PickedLine>;
  onPick: (line: PickedLine) => void;
}) {
  const { operation, alerts, receivesAlsoThrough, party } = result;
  const nothingOpen = operation.pages.usinaOwes.total + operation.pages.partyOwes.total + operation.pages.unclassified.total === 0;

  return (
    <div className="space-y-5">
      {alerts.length > 0 && (
        <ul className="space-y-2" aria-label={copy.alertsTitle}>
          {alerts.map((alert, i) => {
            // REQ-691: an alert about a position opens it — the position may sit on another page.
            const objectId = alertPosition(alert);
            return (
              <li key={i} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-xl bg-warn-soft px-3 py-2 text-[13px] text-ink">
                <span className="min-w-0 flex-1">{alertText(alert, copy)}</span>
                {objectId && (
                  <button
                    type="button"
                    onClick={() => onOpenPosition(objectId)}
                    className="shrink-0 font-semibold text-accent hover:underline"
                  >
                    {copy.alertOpen}
                    <span aria-hidden> ›</span>
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {result.alertsPartial && <p className="text-xs text-muted">{copy.alertsPartial}</p>}

      {nothingOpen ? (
        <div className="rounded-2xl bg-ink/[0.03] p-4 dark:bg-white/5 sm:p-5">
          <p className="text-sm text-muted">{copy.nothingOpen(party.displayName)}</p>
        </div>
      ) : (
        <>
          <SideSection
            partyId={party.partyId}
            side="usinaOwes"
            title={copy.usinaOwes(party.displayName)}
            initial={operation}
            copy={copy}
            canAct={canAct}
            version={version}
            onOpenPosition={onOpenPosition}
            picked={picked}
            onPick={onPick}
          />
          <SideSection
            partyId={party.partyId}
            side="partyOwes"
            title={copy.partyOwes(party.displayName)}
            initial={operation}
            copy={copy}
            canAct={canAct}
            version={version}
            onOpenPosition={onOpenPosition}
            picked={picked}
            onPick={onPick}
          />
          {operation.pages.unclassified.total > 0 && (
            <SideSection
            partyId={party.partyId}
            side="unclassified"
            title={copy.unclassified}
            initial={operation}
            copy={copy}
            canAct={canAct}
            version={version}
            onOpenPosition={onOpenPosition}
            picked={picked}
            onPick={onPick}
          />
          )}
          <p className="text-xs text-muted">{copy.noNet}</p>
        </>
      )}

      {receivesAlsoThrough.length > 0 && (
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-line pt-3 text-[13px]">
          <span className="text-muted">{copy.receivesAlsoThrough}:</span>
          {receivesAlsoThrough.map((p) => (
            <button key={p.partyId} type="button" onClick={() => onOpen(p)} className="font-semibold text-accent hover:underline">
              {p.displayName}
              <span aria-hidden> ›</span>
            </button>
          ))}
        </p>
      )}
    </div>
  );
}

const DEFAULT_QUERY: SideQuery = { page: 1, limit: 20, sortBy: "createdAt", sortOrder: "DESC", objectType: [], from: "", to: "" };
const SORTS = [
  ["createdAt:DESC", "sortNewest"],
  ["createdAt:ASC", "sortOldest"],
  ["dueAt:ASC", "sortDueSoon"],
  ["dueAt:DESC", "sortDueLate"],
] as const;

/** Mobile: what and amount on one line, the rest below. From `sm`, four aligned columns. */
const ROW = "grid grid-cols-[1fr_auto] gap-x-4 sm:grid-cols-[minmax(0,1fr)_6.5rem_6.5rem_7.5rem]";

/** The line's button (REQ-691), at one width so the header can keep its place. */
const ROW_ACTION = "w-24 shrink-0";
/** The line's tick box (REQ-692), likewise. */
const ROW_PICK = "w-4 shrink-0";

type SideState = { lines: PageLine[]; info: SidePageInfo } | "loading" | "unavailable";

function SideSection({
  partyId,
  side,
  title,
  initial,
  copy,
  canAct,
  version,
  onOpenPosition,
  picked,
  onPick,
}: {
  partyId: string;
  side: Side;
  title: string;
  initial: Loaded["operation"];
  copy: Copy;
  canAct: boolean;
  /** Changes when something may have been recorded: the side reads again, keeping its filters. */
  version: number;
  onOpenPosition: (objectId: string) => void;
  /** REQ-692: what is ticked, on any side; whoever cannot write ticks nothing. */
  picked: Record<string, PickedLine>;
  onPick: (line: PickedLine) => void;
}) {
  const { t } = useLanguage();
  const [query, setQuery] = useState<SideQuery>(DEFAULT_QUERY);
  const [state, setState] = useState<SideState>({ lines: initial[side], info: initial.pages[side] });
  const [first, setFirst] = useState(true);
  const readVersion = useRef(version);

  useEffect(() => {
    // The first page came with the party page; anything after is this section's own read — a new
    // filter or page, or a new version (something may have been recorded).
    if (first && version === readVersion.current) return;
    readVersion.current = version;
    let cancelled = false;
    setState("loading");
    partiesApi
      .side(partyId, side, query)
      .then(({ ok, data }) => {
        if (cancelled) return;
        setState(ok && data.available ? { lines: data.lines, info: data } : "unavailable");
      })
      .catch(() => {
        if (!cancelled) setState("unavailable");
      });
    return () => {
      cancelled = true;
    };
  }, [partyId, side, query, first, version]);

  const update = (patch: Partial<SideQuery>) => {
    setFirst(false);
    setQuery((q) => ({ ...q, page: 1, ...patch }));
  };
  const filtered = query.objectType.length > 0 || query.from !== "" || query.to !== "";
  const kinds = initial.kinds[side];
  const info = typeof state === "object" ? state.info : null;

  return (
    <section className="rounded-2xl bg-ink/[0.03] p-4 dark:bg-white/5 sm:p-5" aria-label={title}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h4 className="text-[12px] font-semibold uppercase tracking-wide text-ink">{title}</h4>
        {info && <span className="text-[12px] text-muted">{copy.openCount(info.total)}</span>}
      </div>

      <div className="mt-3 flex flex-wrap items-end gap-3">
        <Select
          label={copy.sortLabel}
          value={`${query.sortBy}:${query.sortOrder}`}
          onChange={(value) => {
            const [sortBy, sortOrder] = value.split(":") as [SideQuery["sortBy"], SideQuery["sortOrder"]];
            update({ sortBy, sortOrder });
          }}
          options={SORTS.map(([value, key]) => ({ value, label: copy[key] }))}
          className="min-w-52"
        />
        {kinds.length > 1 && (
          <MultiSelectDropdown
            label={copy.kindLabel}
            placeholder={copy.kindAll}
            selectedLabel={copy.kindsSelected}
            options={kinds.map((k) => ({ value: k, label: t.objectType[k] ?? k }))}
            selected={query.objectType}
            onChange={(objectType) => update({ objectType })}
            className="min-w-40"
          />
        )}
        <DateRangePicker label={copy.openedBetween} from={query.from} to={query.to} onChange={({ from, to }) => update({ from, to })} />
        {filtered && <ClearFiltersButton onClick={() => update({ objectType: [], from: "", to: "" })} />}
      </div>

      {state === "loading" ? (
        <p className="py-4 text-[13px] text-muted">{copy.loadingSide}</p>
      ) : state === "unavailable" ? (
        <p className="py-4 text-[13px] font-medium text-bad">{copy.sideUnavailable}</p>
      ) : state.lines.length === 0 ? (
        <p className="py-4 text-[13px] text-muted">{filtered ? copy.noMatchFilters : copy.noLines}</p>
      ) : (
        <div className="mt-3">
          <div className="hidden gap-3 border-b border-line pb-1.5 text-[11px] uppercase tracking-wide text-muted sm:flex" aria-hidden>
            {canAct && <span className={ROW_PICK} />}
            <div className={cn(ROW, "min-w-0 flex-1")}>
              <span>{copy.colPosition}</span>
              <span>{copy.colAge}</span>
              <span>{copy.colDue}</span>
              <span className="text-right">{copy.colOpen}</span>
            </div>
            {/* The width of the line's button (REQ-691), so the columns stay aligned. */}
            <span className={ROW_ACTION} />
          </div>
          <ul className="divide-y divide-line">
            {state.lines.map((line) => (
              <PositionRow
                key={line.objectId}
                line={line}
                copy={copy}
                action={rowAction(side, canAct)}
                onOpenPosition={onOpenPosition}
                pick={
                  canAct
                    ? {
                        checked: !!picked[line.objectId],
                        toggle: () =>
                          onPick({ objectId: line.objectId, objectType: line.objectType, side, openBalance: line.openBalance }),
                      }
                    : null
                }
              />
            ))}
          </ul>
        </div>
      )}

      {info && info.total > 0 && (
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <Pagination page={info.page} totalPages={info.totalPages} onPageChange={(page) => { setFirst(false); setQuery((q) => ({ ...q, page })); }} />
          </div>
          <Select
            label={copy.pageSize}
            value={String(query.limit)}
            onChange={(value) => update({ limit: Number(value) })}
            options={[
              { value: "20", label: "20" },
              { value: "50", label: "50" },
            ]}
          />
        </div>
      )}
    </section>
  );
}

/**
 * One position, at a fixed height so a long list can be scanned. "Depende de" is a short indicator
 * on the line; the details open on click.
 */
function PositionRow({
  line,
  copy,
  action,
  onOpenPosition,
  pick,
}: {
  line: PageLine;
  copy: Copy;
  /** REQ-691: what the line's button says; it always opens the detail, with every action offered. */
  action: "pay" | "receive" | "view";
  onOpenPosition: (objectId: string) => void;
  /** REQ-692: the tick box, for whoever can write; null hides it. */
  pick: { checked: boolean; toggle: () => void } | null;
}) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const first = line.dependsOn[0];
  const money = (amount: string | null) => (amount === null ? copy.balanceUnknown : formatMoney(amount, "BRL"));

  return (
    <li className="text-[13px]">
      <div className="flex items-center gap-3">
        {pick && (
          <input
            type="checkbox"
            checked={pick.checked}
            onChange={pick.toggle}
            aria-label={`${copy.select}: ${t.objectType[line.objectType] ?? line.objectType}`}
            className={cn(ROW_PICK, "size-4 accent-accent")}
          />
        )}
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
          className="min-w-0 flex-1 py-2 text-left transition hover:bg-ink/[0.03] focus-visible:bg-ink/[0.04] focus-visible:outline-none dark:hover:bg-white/5"
        >
          <div className={ROW}>
            <span className="min-w-0 truncate text-ink">
              {t.objectType[line.objectType] ?? line.objectType}
              {line.contexts.length > 0 && <span className="text-muted"> · {line.contexts.join(", ")}</span>}
            </span>
            <span className="hidden tabular text-muted sm:block">{line.ageDays === null ? "—" : copy.days(line.ageDays)}</span>
            <span className="hidden tabular text-muted sm:block">{line.dueAt ? formatDate(line.dueAt) : "—"}</span>
            <span className="tabular text-right font-semibold text-ink">{money(line.openBalance)}</span>
          </div>
          <p className="mt-0.5 text-[12px] text-muted sm:hidden">
            {line.ageDays === null ? copy.ageUnknown : copy.openFor(line.ageDays)}
            {line.dueAt && ` · ${copy.dueOn(formatDate(line.dueAt))}`}
          </p>
          {first && (
            <p className="mt-0.5 truncate pl-4 text-[12px] text-muted">
              ↳ {copy.dependsOnLine(first.payerName ?? first.payerId ?? copy.payerUnknown, money(first.openBalance), formatMoney(first.totalSettled, "BRL"))}
              {line.dependsOn.length > 1 && ` +${line.dependsOn.length - 1}`}
            </p>
          )}
        </button>
        <Button
          size="sm"
          variant={action === "view" ? "ghost" : "primary"}
          onClick={() => onOpenPosition(line.objectId)}
          aria-label={`${actionLabel(action, copy)}: ${t.objectType[line.objectType] ?? line.objectType}`}
          className={cn(ROW_ACTION, "justify-center")}
        >
          {actionLabel(action, copy)}
        </Button>
      </div>
      {open && (
        <dl className="mb-2 space-y-0.5 rounded-xl bg-ink/[0.03] px-3 py-2 text-[12.5px] dark:bg-white/5" aria-label={copy.details}>
          {[
            [copy.positionId, line.objectId],
            [copy.originated, money(line.totalOriginated)],
            [copy.openedOn, line.originatedAt ? formatDate(line.originatedAt) : copy.ageUnknown],
            [copy.colDue, line.dueAt ? formatDate(line.dueAt) : copy.noDue],
            ...line.contexts.map((c) => [copy.context, c]),
          ].map(([label, value], i) => (
            <div key={i} className="flex justify-between gap-3">
              <dt className="text-muted">{label}</dt>
              <dd className="tabular truncate text-ink">{value}</dd>
            </div>
          ))}
          {line.dependsOn.map((d) => (
            <p key={d.objectId} className="pt-1 text-muted">
              {copy.dependsOn}: {copy.dependsOnLine(d.payerName ?? d.payerId ?? copy.payerUnknown, money(d.openBalance), formatMoney(d.totalSettled, "BRL"))}
            </p>
          ))}
        </dl>
      )}
    </li>
  );
}

function actionLabel(action: "pay" | "receive" | "view", copy: Copy): string {
  return action === "pay" ? copy.actPay : action === "receive" ? copy.actReceive : copy.actView;
}

function alertText(alert: PageAlert, copy: Copy): string {
  switch (alert.code) {
    case "paid_without_obligation":
      return copy.alertPaidWithoutObligation(alert.objectId);
    case "provisional_identity":
      return copy.alertProvisional;
    case "obligation_overdue":
      return copy.alertOverdue(alert.objectId, formatDate(alert.dueAt));
  }
}

const DEFAULT_HISTORY: HistoryQuery = { page: 1, limit: 20, sortOrder: "DESC", from: "", to: "", eventType: [], reporter: [], status: "all" };

/** Mobile: when, what and amount on one line, the author below. From `sm`, four aligned columns. */
const HISTORY_ROW = "grid grid-cols-[1fr_auto] gap-x-4 sm:grid-cols-[7.5rem_minmax(0,1fr)_9rem_7.5rem]";

type HistoryState = { entries: HistoryFact[]; info: HistoryPageInfo } | "loading" | "unavailable";

const authorName = (a: Author | null, copy: Copy) => (a ? (a.name ?? a.id) : copy.authorUnknown);

/**
 * Histórico (refinement of 2026-11-12), built for audit: ordered by the date of record, with who
 * recorded each fact and who withdrew it. Its own filters and paging. Signals not yet registered sit
 * in a block on top, apart from the facts: they are pending, not history (REQ-636, REJ-636).
 */
function HistorySection({ result, copy }: { result: Loaded; copy: Copy }) {
  const { t } = useLanguage();
  const [query, setQuery] = useState<HistoryQuery>(DEFAULT_HISTORY);
  const [state, setState] = useState<HistoryState>({ entries: result.history, info: result.historyPage });
  const [first, setFirst] = useState(true);
  const partyId = result.party.partyId;

  useEffect(() => {
    if (first) return;
    let cancelled = false;
    setState("loading");
    partiesApi
      .history(partyId, query)
      .then(({ ok, data }) => {
        if (cancelled) return;
        setState(ok && data.available ? { entries: data.entries, info: data } : "unavailable");
      })
      .catch(() => {
        if (!cancelled) setState("unavailable");
      });
    return () => {
      cancelled = true;
    };
  }, [partyId, query, first]);

  const update = (patch: Partial<HistoryQuery>) => {
    setFirst(false);
    setQuery((q) => ({ ...q, page: 1, ...patch }));
  };
  const filtered =
    query.eventType.length > 0 || query.reporter.length > 0 || query.status !== "all" || query.from !== "" || query.to !== "";
  // The filter options come from the whole history, so they never shrink to what one page shows.
  const facets = result.historyPage.facets;
  const info = typeof state === "object" ? state.info : null;

  return (
    <div className="space-y-5">
      {result.pendingSignals.length > 0 && (
        <section className="rounded-2xl border border-accent/30 bg-accent-soft/40 p-4 sm:p-5" aria-label={copy.pendingSignalsTitle(result.pendingSignals.length)}>
          <h4 className="text-[12px] font-semibold uppercase tracking-wide text-ink">{copy.pendingSignalsTitle(result.pendingSignals.length)}</h4>
          <ul className="mt-2 divide-y divide-line">
            {result.pendingSignals.map((signal) => (
              <li key={signal.signalId} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 py-2 text-[13px]">
                <span className="tabular text-muted">{formatDateTime(signal.receivedAt)}</span>
                <span className="min-w-0 flex-1 text-ink">{copy.signalLine(signal.recordId)}</span>
                <span className="text-[12px] text-muted">{copy.signalAuthor}</span>
                <Badge variant="accent">{copy.signal}</Badge>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="rounded-2xl bg-ink/[0.03] p-4 dark:bg-white/5 sm:p-5" aria-label={copy.historyTitle(result.party.displayName)}>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h4 className="text-[12px] font-semibold uppercase tracking-wide text-ink">{copy.historyTitle(result.party.displayName)}</h4>
          {info && <span className="text-[12px] text-muted">{copy.recordsCount(info.total)}</span>}
        </div>

        <div className="mt-3 flex flex-wrap items-end gap-3">
          <Select
            label={copy.sortLabel}
            value={query.sortOrder}
            onChange={(value) => update({ sortOrder: value as HistoryQuery["sortOrder"] })}
            options={[
              { value: "DESC", label: copy.historySortNewest },
              { value: "ASC", label: copy.historySortOldest },
            ]}
            className="min-w-52"
          />
          <DateRangePicker label={copy.recordedBetween} from={query.from} to={query.to} onChange={({ from, to }) => update({ from, to })} />
          {facets.eventTypes.length > 1 && (
            <MultiSelectDropdown
              label={copy.factKind}
              placeholder={copy.kindAll}
              selectedLabel={copy.kindsSelected}
              options={facets.eventTypes.map((k) => ({ value: k, label: t.eventType[k] ?? k }))}
              selected={query.eventType}
              onChange={(eventType) => update({ eventType })}
              className="min-w-40"
            />
          )}
          {facets.reporters.length > 1 && (
            <MultiSelectDropdown
              label={copy.recordedBy}
              placeholder={copy.kindAll}
              selectedLabel={copy.kindsSelected}
              options={facets.reporters.map((r) => ({ value: r.id, label: r.name ?? r.id }))}
              selected={query.reporter}
              onChange={(reporter) => update({ reporter })}
              className="min-w-40"
            />
          )}
          <Select
            label={copy.situation}
            value={query.status}
            onChange={(value) => update({ status: value as HistoryQuery["status"] })}
            options={[
              { value: "all", label: copy.situationAll },
              { value: "standing", label: copy.situationStanding },
              { value: "retracted", label: copy.situationRetracted },
            ]}
          />
          {filtered && <ClearFiltersButton onClick={() => update({ eventType: [], reporter: [], status: "all", from: "", to: "" })} />}
        </div>

        {state === "loading" ? (
          <p className="py-4 text-[13px] text-muted">{copy.loadingSide}</p>
        ) : state === "unavailable" ? (
          <p className="py-4 text-[13px] font-medium text-bad">{copy.unavailable}</p>
        ) : state.entries.length === 0 ? (
          <p className="py-4 text-[13px] text-muted">{filtered ? copy.noHistoryMatch : copy.noEvents}</p>
        ) : (
          <div className="mt-3">
            <div className={cn(HISTORY_ROW, "hidden border-b border-line pb-1.5 text-[11px] uppercase tracking-wide text-muted sm:grid")} aria-hidden>
              <span>{copy.colRecordedAt}</span>
              <span>{copy.colFact}</span>
              <span>{copy.colRecordedBy}</span>
              <span className="text-right">{copy.colAmount}</span>
            </div>
            <ul className="divide-y divide-line">
              {state.entries.map((entry) => (
                <HistoryRow key={entry.eventId} entry={entry} partyNames={result.partyNames} copy={copy} />
              ))}
            </ul>
          </div>
        )}

        {info && info.total > 0 && (
          <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <Pagination
                page={info.page}
                totalPages={info.totalPages}
                onPageChange={(page) => {
                  setFirst(false);
                  setQuery((q) => ({ ...q, page }));
                }}
              />
            </div>
            <Select
              label={copy.pageSize}
              value={String(query.limit)}
              onChange={(value) => update({ limit: Number(value) })}
              options={[
                { value: "20", label: "20" },
                { value: "50", label: "50" },
              ]}
            />
          </div>
        )}
      </section>
    </div>
  );
}

function HistoryRow({ entry, partyNames, copy }: { entry: HistoryFact; partyNames: Record<string, string>; copy: Copy }) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const context = (entry.objects ?? []).find((o) => o.relation === "references");
  const others = othersInEvent(entry, partyNames);

  return (
    <li className={cn("text-[13px]", entry.retracted && "opacity-70")}>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="w-full py-2 text-left transition hover:bg-ink/[0.03] focus-visible:bg-ink/[0.04] focus-visible:outline-none dark:hover:bg-white/5"
      >
        <div className={HISTORY_ROW}>
          <span className="hidden tabular text-muted sm:block">{formatDateTime(entry.recordedAt)}</span>
          <span className="min-w-0 truncate text-ink">
            <span className="tabular text-muted sm:hidden">{formatDate(entry.recordedAt)} · </span>
            {t.eventType[entry.eventType] ?? entry.eventType}
            {context && <span className="text-muted"> · {context.objectId}</span>}
            {entry.retracted && (
              <span className="ml-2" title={copy.withdrawnNote}>
                <Badge variant="warn">{copy.withdrawn}</Badge>
              </span>
            )}
          </span>
          <span className="hidden truncate text-muted sm:block">{authorName(entry.reporter, copy)}</span>
          <span className={cn("tabular text-right font-semibold text-ink", entry.retracted && "line-through")}>
            {formatMoney(entry.amount, entry.currency)}
          </span>
        </div>
        <p className="mt-0.5 truncate text-[12px] text-muted sm:pl-[8.5rem]">
          <span className="sm:hidden">{authorName(entry.reporter, copy)}</span>
          {recordedOnAnotherDay(entry.occurredAt, entry.recordedAt) && (
            <span>
              <span className="sm:hidden"> · </span>↳ {copy.factOn(formatDate(entry.occurredAt))}
            </span>
          )}
        </p>
        {entry.retractedBy && (
          <p className="mt-0.5 truncate text-[12px] font-medium text-warn sm:pl-[8.5rem]">
            ↳ {copy.retractedOn(formatDate(entry.retractedBy.recordedAt), authorName(entry.retractedBy.reporter, copy))}
          </p>
        )}
      </button>
      {open && (
        <dl className="mb-2 space-y-0.5 rounded-xl bg-ink/[0.03] px-3 py-2 text-[12.5px] dark:bg-white/5" aria-label={copy.details}>
          {[
            [copy.eventId, entry.eventId],
            [copy.origin, entry.source ? `${entry.source.system} · ${entry.source.reference}` : copy.authorUnknown],
            [copy.occurredOn, formatDateTime(entry.occurredAt)],
            [copy.recordedOnLabel, formatDateTime(entry.recordedAt)],
            [copy.recordedBy, authorName(entry.reporter, copy)],
            [copy.partyRole, entry.roles.map((r) => t.partyRole[r.role] ?? r.role).join(", ")],
            ...(others.length ? [[copy.others, others.join(", ")]] : []),
            ...(entry.objects ?? []).map((o) => [copy.citedPositions, `${t.objectType[o.objectType] ?? o.objectType} · ${o.objectId}`]),
            ...(entry.retractedBy
              ? [[copy.retraction, `${entry.retractedBy.eventId} · ${formatDateTime(entry.retractedBy.recordedAt)} · ${authorName(entry.retractedBy.reporter, copy)}`]]
              : []),
          ].map(([label, value], i) => (
            <div key={i} className="flex justify-between gap-3">
              <dt className="shrink-0 text-muted">{label}</dt>
              <dd className="min-w-0 truncate text-right text-ink">{value}</dd>
            </div>
          ))}
        </dl>
      )}
    </li>
  );
}
