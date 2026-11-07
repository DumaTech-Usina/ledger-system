import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/Badge";
import { Banner } from "@/components/Banner";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Input } from "@/components/Input";
import { Select } from "@/components/Select";
import { Table } from "@/components/Table";
import { translateMessage } from "@/features/operations/copy";
import { partiesApi, type PendingIdentity, type RegisteredParty } from "@/features/parties/partiesApi";
import { partiesCopy } from "@/features/parties/partiesCopy";
import { useLanguage } from "@/i18n/i18n";
import { formatDocument } from "@/utils/format";

function PendingRow({
  identity,
  parties,
  onLinked,
}: {
  identity: PendingIdentity;
  parties: RegisteredParty[];
  onLinked: () => void;
}) {
  const { language } = useLanguage();
  const copy = partiesCopy[language];
  const [target, setTarget] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const link = async () => {
    setSaving(true);
    setError(null);
    const { ok, data } = await partiesApi.link(identity.partyId, target);
    setSaving(false);
    if (ok) {
      onLinked();
      return;
    }
    setError("error" in data ? translateMessage(data.error) : copy.genericError);
  };

  return (
    <li className="flex flex-col gap-2 border-t border-line py-3 first:border-t-0">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-semibold text-ink">{identity.displayName}</span>
        <Badge variant="warn">{identity.kind === "provisional" ? copy.provisional : copy.unidentifiable}</Badge>
      </div>
      {parties.length === 0 ? (
        <p className="text-[13px] text-muted">{copy.noPartiesToLink}</p>
      ) : (
        <div className="flex flex-wrap items-end gap-2">
          <Select
            className="min-w-64 flex-1"
            label={copy.linkTo}
            searchPlaceholder={copy.searchParty}
            value={target}
            onChange={setTarget}
            options={[
              { value: "", label: copy.chooseParty },
              ...parties.map((p) => ({ value: p.partyId, label: p.displayName })),
            ]}
          />
          <Button size="sm" loading={saving} disabled={target === ""} onClick={link}>
            {copy.link}
          </Button>
        </div>
      )}
      {error && <span className="text-xs font-medium text-bad">{error}</span>}
    </li>
  );
}

/**
 * The party registry, for whoever holds curation: resolve what is pending, register who is missing,
 * see who is there. The server is what enforces both the permission and the rules; this page shows
 * what it answers.
 */
export function PartiesPage({ pending, onChanged }: { pending: PendingIdentity[]; onChanged: () => void }) {
  const { language } = useLanguage();
  const copy = partiesCopy[language];
  const [parties, setParties] = useState<RegisteredParty[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [name, setName] = useState("");
  const [kind, setKind] = useState<"person" | "company">("company");
  const [hasBankAccount, setHasBankAccount] = useState(true);
  const [document, setDocument] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const { ok, data } = await partiesApi.list();
      setLoadFailed(!ok);
      if (ok) setParties(data.parties);
    } catch {
      setLoadFailed(true);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const register = async () => {
    setSaving(true);
    setError(null);
    setDone(null);
    const registered = name.trim();
    const { ok, data } = await partiesApi.register({ displayName: registered, kind, hasBankAccount, document });
    setSaving(false);
    if (!ok) {
      setError("error" in data ? translateMessage(data.error) : copy.genericError);
      return;
    }
    setName("");
    setDocument("");
    setDone(copy.registered(registered));
    await load();
    onChanged();
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="font-display text-2xl font-semibold text-ink">{copy.heading}</h2>
        <p className="mt-1 text-sm text-muted">{copy.subheading}</p>
      </div>

      {loadFailed && <Banner variant="bad">{copy.loadError}</Banner>}

      <Card>
        <h3 className="font-display text-lg font-semibold text-ink">{copy.pendingTitle}</h3>
        {pending.length === 0 ? (
          <p className="mt-2 text-sm text-muted">{copy.pendingEmpty}</p>
        ) : (
          <>
            <p className="mt-1 text-[13px] text-muted">{copy.linkNote}</p>
            <ul className="mt-2">
              {pending.map((identity) => (
                <PendingRow
                  key={identity.partyId}
                  identity={identity}
                  parties={parties ?? []}
                  onLinked={onChanged}
                />
              ))}
            </ul>
          </>
        )}
      </Card>

      <Card>
        <h3 className="font-display text-lg font-semibold text-ink">{copy.registerTitle}</h3>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <Input label={copy.name} value={name} disabled={saving} onChange={(e) => setName(e.target.value)} />
          <Select
            label={copy.kind}
            value={kind}
            onChange={(value) => setKind(value === "person" ? "person" : "company")}
            options={[
              { value: "company", label: copy.company },
              { value: "person", label: copy.person },
            ]}
          />
          <Select
            label={copy.bankAccount}
            value={hasBankAccount ? "yes" : "no"}
            onChange={(value) => setHasBankAccount(value === "yes")}
            options={[
              { value: "yes", label: copy.yes },
              { value: "no", label: copy.no },
            ]}
          />
          <Input
            label={hasBankAccount ? copy.documentRequired : copy.documentOptional}
            value={document}
            inputMode="numeric"
            disabled={saving}
            onChange={(e) => setDocument(formatDocument(e.target.value))}
          />
        </div>
        {error && <p className="mt-3 text-sm font-medium text-bad">{error}</p>}
        {done && <p className="mt-3 text-sm font-medium text-ok">{done}</p>}
        <div className="mt-4">
          <Button loading={saving} disabled={name.trim() === ""} onClick={register}>
            {copy.register}
          </Button>
        </div>
      </Card>

      <Card>
        <h3 className="font-display text-lg font-semibold text-ink">{copy.listTitle}</h3>
        {parties !== null && parties.length === 0 ? (
          <p className="mt-2 text-sm text-muted">{copy.listEmpty}</p>
        ) : (
          <Table.Root className="mt-3">
            <Table.Head>
              <Table.Row>
                <Table.HeaderCell>{copy.name}</Table.HeaderCell>
                <Table.HeaderCell>{copy.kind}</Table.HeaderCell>
                <Table.HeaderCell>{copy.document}</Table.HeaderCell>
                <Table.HeaderCell>{copy.bankAccount}</Table.HeaderCell>
              </Table.Row>
            </Table.Head>
            <Table.Body>
              {(parties ?? []).map((party) => (
                <Table.Row key={party.partyId}>
                  <Table.Cell>{party.displayName}</Table.Cell>
                  <Table.Cell>
                    {party.kind === "person" ? copy.person : party.kind === "company" ? copy.company : copy.notKnown}
                  </Table.Cell>
                  <Table.Cell mono>{party.document ? formatDocument(party.document) : copy.notKnown}</Table.Cell>
                  <Table.Cell>
                    {party.hasBankAccount === null ? copy.notKnown : party.hasBankAccount ? copy.yes : copy.no}
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table.Root>
        )}
      </Card>
    </div>
  );
}
