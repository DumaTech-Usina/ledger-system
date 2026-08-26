import { useState } from "react";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { Modal } from "@/components/Modal";
import { partiesApi, type PartySummary } from "@/screens-concept/partiesApi";
import { useLanguage } from "@/i18n/i18n";

/** Renaming a counterparty — the only thing about it this screen can change. The PartyId never
 * moves, so nothing about the entity's history is affected. */
export function EditCounterpartyModal({
  party,
  onClose,
  onRenamed,
}: {
  party: PartySummary;
  onClose: () => void;
  onRenamed: (partyId: string, displayName: string) => void;
}) {
  const { t } = useLanguage();
  const [name, setName] = useState(party.displayName);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmed = name.trim();
  const unchanged = trimmed === party.displayName;

  const save = async () => {
    if (trimmed === "") {
      setError(t.counterparties.editModal.nameRequired);
      return;
    }
    setSaving(true);
    setError(null);
    const { ok, data } = await partiesApi.rename(party.partyId, trimmed);
    setSaving(false);
    if (!ok || !data || "error" in data) {
      setError(data && "error" in data ? data.error : t.counterparties.editModal.genericError);
      return;
    }
    onRenamed(data.partyId, data.displayName);
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={t.counterparties.editModal.title}
      closeLabel={t.common.close}
      className="max-w-md"
    >
      <div className="flex flex-col gap-4 p-5">
        <Input
          label={t.counterparties.editModal.nameLabel}
          value={name}
          onChange={(event) => {
            setName(event.target.value);
            setError(null);
          }}
          error={error ?? undefined}
          disabled={saving}
          autoFocus
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              save();
            }
          }}
        />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>
            {t.counterparties.editModal.cancel}
          </Button>
          <Button type="button" onClick={save} loading={saving} disabled={unchanged}>
            {t.counterparties.editModal.save}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
