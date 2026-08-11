import { Badge } from "@/components/Badge";
import { Table } from "@/components/Table";
import { useLanguage } from "@/i18n/i18n";
import { cn } from "@/utils/cn";
import { formatMoney } from "@/utils/format";
import type { EventObjectRef, EventPartyRef } from "@/types/dashboard";

/**
 * The context the Ledger publishes about a fact: what it touched, who took part, where it came from.
 *
 * Shared by the movement detail and the position timeline because it is the same record in both —
 * the Ledger publishes one shape and this renders it once. Nothing here derives anything.
 *
 * Both blocks are tables rather than loose rows: every value the Ledger publishes here is one of
 * several per line, and a value without a column heading is a value the reader has to guess the
 * meaning of. "Liquida" beneath a heading that says Relação is a fact; the same word floating beside
 * an amount reads as a status, which it is not.
 *
 * The distinction the copy is careful about: an ABSENT field means the Ledger did not tell us, an
 * EMPTY one means it told us there was nothing. Different sentences, because they are different
 * facts about the book.
 */

/** Section heading — the design system's `label-sm`: 12px, 700, wide tracking. */
function SectionLabel({ children }: { children: string }) {
  return (
    <p className="text-[12px] font-bold uppercase tracking-[0.03em] text-muted">{children}</p>
  );
}

/** A sentence standing in for a table nobody can draw — an absence, said rather than left blank. */
function Absence({ children }: { children: string }) {
  return <p className="mt-2 text-[13px] text-muted">{children}</p>;
}

/** The producing system and its own identifier. Neither identifies the fact without the other. */
export function SourceRef({ source }: { source: { system: string; reference: string } }) {
  return (
    <span className="tabular text-[12px] text-muted">
      {source.system} · {source.reference}
    </span>
  );
}

/** What the Ledger calls this object, with an untyped one named as untyped rather than guessed. */
function objectTypeLabel(objectType: string, t: ReturnType<typeof useLanguage>["t"]): string {
  // "" is what the adapter puts when the Ledger published no type — shown as the absence it is.
  if (objectType === "") return t.dashboard.fact.untypedObject;
  return t.objectType[objectType] ?? objectType;
}

/**
 * The positions and documents the movement named, each with the relation it declared for them.
 *
 * `relation` is NOT a status: it says what this movement did to that position — settled it,
 * originated it, merely referenced it. It sits under its own heading so it cannot be read as the
 * position's own state, which lives on the positions screen and is a different thing entirely.
 */
export function FactObjects({
  objects,
  onOpenObject,
  className,
}: {
  /** Undefined when the Ledger does not publish objects at all — said differently from an empty list. */
  objects: EventObjectRef[] | undefined;
  onOpenObject?: (objectId: string) => void;
  className?: string;
}) {
  const { t } = useLanguage();

  return (
    <section className={className}>
      <SectionLabel>{t.dashboard.fact.whatItTouched}</SectionLabel>
      {objects === undefined ? (
        <Absence>{t.dashboard.fact.objectsNotPublished}</Absence>
      ) : objects.length === 0 ? (
        <Absence>{t.dashboard.fact.touchedNothing}</Absence>
      ) : (
        <div className="mt-2">
          <Table.Root>
            <Table.Head>
              <Table.Row>
                <Table.HeaderCell>{t.dashboard.fact.record}</Table.HeaderCell>
                <Table.HeaderCell>{t.dashboard.fact.relation}</Table.HeaderCell>
                <Table.HeaderCell aria-hidden />
              </Table.Row>
            </Table.Head>
            <Table.Body>
              {objects.map((object) => (
                <Table.Row key={`${object.objectId}-${object.relation}`}>
                  <Table.Cell className="font-semibold text-ink">
                    {objectTypeLabel(object.objectType, t)}
                  </Table.Cell>
                  <Table.Cell>
                    <Badge variant="neutral">{t.eventRelation[object.relation] ?? object.relation}</Badge>
                  </Table.Cell>
                  <Table.Cell className="text-right">
                    {onOpenObject ? (
                      <button
                        type="button"
                        onClick={() => onOpenObject(object.objectId)}
                        className="inline-flex items-center rounded-full bg-accent-soft px-3 py-1.5 text-[12px] font-semibold text-accent transition hover:opacity-80"
                      >
                        {t.dashboard.fact.openObject}
                      </button>
                    ) : (
                      // No history view to open from here, so the id stays: without it the row names
                      // a kind of document without saying which one.
                      <span className="tabular text-[12px] text-muted">{object.objectId}</span>
                    )}
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table.Root>
        </div>
      )}
    </section>
  );
}

/**
 * Who took part, and which way the money went for each — the "from whom, to whom" of the fact.
 *
 * Every column is labelled because every value here needs one: "Recebedor" and "Saiu" are answers
 * to two different questions, and side by side without headings they read as one run-on phrase.
 *
 * The order is the Ledger's own and is not re-sorted: the record is the record.
 */
export function FactParties({
  parties,
  partyNames,
  counterparty,
  currency,
  className,
}: {
  /** Undefined when the Ledger does not publish parties at all — not the same as none having taken part. */
  parties: EventPartyRef[] | undefined;
  /** partyId → display name. A party the Directory does not know keeps its id on screen. */
  partyNames: Record<string, string>;
  /** The party the movement already names as its counterparty, marked rather than repeated. */
  counterparty?: string | null;
  currency: string;
  className?: string;
}) {
  const { t } = useLanguage();

  return (
    <section className={className}>
      <SectionLabel>{t.dashboard.fact.whoTookPart}</SectionLabel>
      {parties === undefined ? (
        <Absence>{t.dashboard.fact.partiesNotPublished}</Absence>
      ) : parties.length === 0 ? (
        <Absence>{t.dashboard.fact.noParties}</Absence>
      ) : (
        <div className="mt-2">
          <Table.Root>
            <Table.Head>
              <Table.Row>
                <Table.HeaderCell>{t.dashboard.fact.participant}</Table.HeaderCell>
                <Table.HeaderCell>{t.dashboard.fact.role}</Table.HeaderCell>
                <Table.HeaderCell>{t.dashboard.fact.direction}</Table.HeaderCell>
                <Table.HeaderCell className="text-right">{t.dashboard.table.amount}</Table.HeaderCell>
              </Table.Row>
            </Table.Head>
            <Table.Body>
              {parties.map((party, index) => (
                <Table.Row key={`${party.partyId}-${party.role}-${index}`}>
                  <Table.Cell>
                    <span className="font-semibold text-ink">
                      {partyNames[party.partyId] ?? party.partyId}
                    </span>
                    {party.partyId === counterparty && (
                      <Badge variant="neutral" className="ml-2">
                        {t.dashboard.fact.counterpartyTag}
                      </Badge>
                    )}
                  </Table.Cell>
                  <Table.Cell className="text-muted">
                    {t.partyRole[party.role] ?? party.role}
                  </Table.Cell>
                  {/* Colour follows the direction so the side money left and the side it reached are
                      told apart at a glance — and the word is there for anyone who cannot use colour. */}
                  <Table.Cell
                    className={cn(
                      "font-semibold",
                      party.direction === "out" && "text-bad",
                      party.direction === "in" && "text-ok",
                      party.direction !== "out" && party.direction !== "in" && "text-muted",
                    )}
                  >
                    {t.partyDirection[party.direction] ?? party.direction}
                  </Table.Cell>
                  {/* Only when the event attributed a share to this party. Null means it stated one
                      total for the fact, which is not the same as this party having taken nothing. */}
                  <Table.Cell mono className="text-right text-ink">
                    {party.amount === null ? (
                      <span className="text-muted">—</span>
                    ) : (
                      formatMoney(party.amount, currency)
                    )}
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table.Root>
        </div>
      )}
    </section>
  );
}

/**
 * One object named outside a table — used where a single reference stands on its own, as in the
 * documents a position's origination pointed at.
 */
export function ObjectChip({ object }: { object: EventObjectRef }) {
  const { t } = useLanguage();

  return (
    <li className="flex flex-wrap items-center gap-2 py-1.5">
      <span className="text-[13px] font-semibold text-ink">{objectTypeLabel(object.objectType, t)}</span>
      <Badge variant="neutral">{t.eventRelation[object.relation] ?? object.relation}</Badge>
      <span className="tabular truncate text-[12px] text-muted">{object.objectId}</span>
    </li>
  );
}
