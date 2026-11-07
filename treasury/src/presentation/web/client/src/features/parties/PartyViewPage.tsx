import { useEffect, useState } from "react";
import { Badge } from "@/components/Badge";
import { Banner } from "@/components/Banner";
import { Card } from "@/components/Card";
import { Input } from "@/components/Input";
import { Table } from "@/components/Table";
import { partiesApi, type PartyEventsResult, type PartyName } from "@/features/parties/partiesApi";
import { partiesCopy } from "@/features/parties/partiesCopy";
import { matchingParties, othersInEvent } from "@/features/parties/partiesEngine";
import { useLanguage } from "@/i18n/i18n";
import { cn } from "@/utils/cn";
import { formatDate, formatMoney } from "@/utils/format";

/**
 * Pick a person or a company and see every event they have any role in (REQ-615). It is for filtering
 * and seeing (REQ-612), so there is no total here. This adds a way in: the operations grid and the
 * positions stay as they are.
 */
export function PartyViewPage() {
  const { t, language } = useLanguage();
  const copy = partiesCopy[language];
  const [parties, setParties] = useState<PartyName[] | null>(null);
  const [namesFailed, setNamesFailed] = useState(false);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<PartyName | null>(null);
  const [result, setResult] = useState<PartyEventsResult | null>(null);

  useEffect(() => {
    let cancelled = false;
    partiesApi
      .names()
      .then(({ ok, data }) => {
        if (cancelled) return;
        setNamesFailed(!ok);
        if (ok) setParties(data.parties);
      })
      .catch(() => {
        if (!cancelled) setNamesFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!selected) return;
    let cancelled = false;
    setResult(null);
    partiesApi
      .events(selected.partyId)
      .then(({ ok, data }) => {
        if (!cancelled) setResult(ok ? data : { available: false, party: selected });
      })
      .catch(() => {
        if (!cancelled) setResult({ available: false, party: selected });
      });
    return () => {
      cancelled = true;
    };
  }, [selected]);

  const matches = matchingParties(parties ?? [], query);
  const also = result?.available ? result.identifiers.filter((id) => id !== result.party.partyId) : [];

  return (
    <div className="space-y-8">
      <div>
        <h2 className="font-display text-2xl font-semibold text-ink">{copy.viewHeading}</h2>
        <p className="mt-1 text-sm text-muted">{copy.viewSubheading}</p>
      </div>

      {namesFailed && <Banner variant="bad">{copy.loadError}</Banner>}

      <Card>
        <Input
          label={copy.search}
          placeholder={copy.searchPlaceholder}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {parties !== null && matches.length === 0 ? (
          <p className="mt-3 text-sm text-muted">{copy.noMatch}</p>
        ) : (
          <div className="mt-3 flex flex-wrap gap-2">
            {matches.map((party) => (
              <button
                key={party.partyId}
                type="button"
                aria-pressed={selected?.partyId === party.partyId}
                onClick={() => setSelected(party)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-xs font-semibold transition",
                  selected?.partyId === party.partyId
                    ? "border-accent bg-accent text-accent-ink"
                    : "border-line bg-panel-solid text-ink hover:border-accent",
                )}
              >
                {party.displayName}
                {party.state === "provisional" && ` (${copy.provisionalTag})`}
                {party.state === "unidentifiable" && ` (${copy.unidentifiableTag})`}
              </button>
            ))}
          </div>
        )}
      </Card>

      {selected && (
        <Card>
          <h3 className="font-display text-lg font-semibold text-ink">{result?.party.displayName ?? selected.displayName}</h3>
          {also.length > 0 && (
            <p className="mt-1 text-[13px] text-muted">
              {copy.recordedAs} {also.join(", ")}
            </p>
          )}

          {result === null ? (
            <p className="mt-3 text-sm text-muted">{t.common.loading}</p>
          ) : !result.available ? (
            <p className="mt-3 text-sm font-medium text-bad">{copy.unavailable}</p>
          ) : result.events.length === 0 ? (
            <p className="mt-3 text-sm text-muted">{copy.noEvents}</p>
          ) : (
            <Table.Root className="mt-3">
              <Table.Head>
                <Table.Row>
                  <Table.HeaderCell>{copy.date}</Table.HeaderCell>
                  <Table.HeaderCell>{copy.operation}</Table.HeaderCell>
                  <Table.HeaderCell>{copy.role}</Table.HeaderCell>
                  <Table.HeaderCell>{copy.others}</Table.HeaderCell>
                  <Table.HeaderCell className="text-right">{copy.amount}</Table.HeaderCell>
                </Table.Row>
              </Table.Head>
              <Table.Body>
                {result.events.map((event) => (
                  <Table.Row key={event.eventId} className={event.retracted ? "opacity-60" : undefined}>
                    <Table.Cell mono>{formatDate(event.occurredAt)}</Table.Cell>
                    <Table.Cell>
                      {t.eventType[event.eventType] ?? event.eventType}
                      {event.retracted && (
                        <span className="ml-2" title={copy.withdrawnNote}>
                          <Badge variant="warn">{copy.withdrawn}</Badge>
                        </span>
                      )}
                      {event.description && <div className="text-[12px] text-muted">{event.description}</div>}
                    </Table.Cell>
                    <Table.Cell>{event.roles.map((r) => t.partyRole[r.role] ?? r.role).join(", ")}</Table.Cell>
                    <Table.Cell>{othersInEvent(event, result.partyNames).join(", ")}</Table.Cell>
                    <Table.Cell mono className={cn("text-right font-semibold", event.retracted && "line-through")}>
                      {formatMoney(event.amount, event.currency)}
                    </Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table.Root>
          )}
        </Card>
      )}
    </div>
  );
}
