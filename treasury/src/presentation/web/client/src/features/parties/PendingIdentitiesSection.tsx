import { useState } from "react";
import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Select } from "@/components/Select";
import { translateMessage } from "@/features/operations/copy";
import { partiesApi, type PartyName, type PendingIdentity } from "@/features/parties/partiesApi";
import { partiesCopy } from "@/features/parties/partiesCopy";
import { useLanguage } from "@/i18n/i18n";

/** Where the notification's "Resolver" lands (REQ-321). */
export const PENDING_SECTION_ID = "identidades-sem-resolucao";

/**
 * The identities still to resolve, at the top of the list of parties (REQ-315). Everyone sees who is
 * pending — it helps chase whoever holds curation (decided 2026-11-17) — and only curation acts:
 * link to a registered party, or register and link at once (REQ-322, REQ-402). The server enforces it.
 */
export function PendingIdentitiesSection({
  pending,
  registered,
  canCurate,
  onLinked,
  onRegisterAndLink,
}: {
  pending: PendingIdentity[];
  /** The registered parties a pending identity can be linked to. */
  registered: PartyName[];
  canCurate: boolean;
  onLinked: () => void;
  onRegisterAndLink: (identity: PendingIdentity) => void;
}) {
  const { language } = useLanguage();
  const copy = partiesCopy[language];
  if (pending.length === 0) return null;

  return (
    <Card id={PENDING_SECTION_ID} className="scroll-mt-24">
      <h3 className="font-display text-lg font-semibold text-ink">{copy.pendingTitle}</h3>
      <p className="mt-1 text-[13px] text-muted">{canCurate ? copy.linkNote : copy.pendingReadOnly}</p>
      <ul className="mt-2">
        {pending.map((identity) => (
          <PendingRow
            key={identity.partyId}
            identity={identity}
            registered={registered}
            canCurate={canCurate}
            onLinked={onLinked}
            onRegisterAndLink={() => onRegisterAndLink(identity)}
          />
        ))}
      </ul>
    </Card>
  );
}

function PendingRow({
  identity,
  registered,
  canCurate,
  onLinked,
  onRegisterAndLink,
}: {
  identity: PendingIdentity;
  registered: PartyName[];
  canCurate: boolean;
  onLinked: () => void;
  onRegisterAndLink: () => void;
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
      {canCurate && (
        <>
          {registered.length === 0 ? (
            <p className="text-[13px] text-muted">{copy.noPartiesToLink}</p>
          ) : (
            <div className="flex flex-wrap items-end gap-2">
              <Select
                className="min-w-0 flex-1 basis-full sm:basis-64"
                label={copy.linkTo}
                searchPlaceholder={copy.searchParty}
                value={target}
                onChange={setTarget}
                options={[{ value: "", label: copy.chooseParty }, ...registered.map((p) => ({ value: p.partyId, label: p.displayName }))]}
              />
              <Button size="sm" loading={saving} disabled={target === ""} onClick={link}>
                {copy.link}
              </Button>
            </div>
          )}
          <div>
            <Button size="sm" variant="ghost" disabled={saving} onClick={onRegisterAndLink}>
              {copy.registerAndLink}
            </Button>
          </div>
        </>
      )}
      {error && <span className="text-xs font-medium text-bad">{error}</span>}
    </li>
  );
}
