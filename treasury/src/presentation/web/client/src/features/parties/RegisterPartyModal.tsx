import { useState } from "react";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { Modal } from "@/components/Modal";
import { Select } from "@/components/Select";
import { translateMessage } from "@/features/operations/copy";
import { partiesApi, type PendingIdentity } from "@/features/parties/partiesApi";
import { partiesCopy } from "@/features/parties/partiesCopy";
import { useLanguage } from "@/i18n/i18n";
import { formatDocument } from "@/utils/format";

/**
 * Registering a party (REQ-311, REQ-314), in a modal over the list of parties (REQ-315).
 *
 * With `linking`, it is "cadastrar e ligar" (REQ-322): the provisional identity's name comes filled in,
 * and once the party is registered the identity is linked to it. The link cannot be undone (REQ-331,
 * DEC-015), so the modal says so before saving. Two steps on the server: if the link fails after the
 * registration, the party stays registered and the modal says what is left to do.
 *
 * On success the modal closes and the caller refreshes the list (decided 2026-11-17).
 */
export function RegisterPartyModal({
  linking,
  onClose,
  onDone,
}: {
  /** The provisional identity to link the new party to, if any. */
  linking?: PendingIdentity;
  onClose: () => void;
  /** What happened, said in one line for the list to show. */
  onDone: (message: string) => void;
}) {
  const { language } = useLanguage();
  const copy = partiesCopy[language];
  const [name, setName] = useState(linking?.displayName ?? "");
  const [kind, setKind] = useState<"person" | "company">("company");
  const [hasBankAccount, setHasBankAccount] = useState(true);
  const [document, setDocument] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Once registered, a second click must not register the same party again.
  const [registeredId, setRegisteredId] = useState<string | null>(null);

  const refusal = (data: unknown) =>
    data && typeof data === "object" && "error" in data ? translateMessage(String((data as { error: unknown }).error)) : copy.genericError;

  const save = async () => {
    setSaving(true);
    setError(null);
    const registered = name.trim();
    let partyId = registeredId;
    if (!partyId) {
      const { ok, data } = await partiesApi.register({ displayName: registered, kind, hasBankAccount, document });
      if (!ok || !("partyId" in data)) {
        setSaving(false);
        setError(refusal(data));
        return;
      }
      partyId = data.partyId;
      setRegisteredId(partyId);
    }
    if (!linking) {
      setSaving(false);
      onDone(copy.registered(registered));
      return;
    }
    const linked = await partiesApi.link(linking.partyId, partyId);
    setSaving(false);
    if (!linked.ok) {
      onDone(copy.linkFailedAfterRegister(registered, refusal(linked.data)));
      return;
    }
    onDone(copy.registeredAndLinked(registered, linking.displayName));
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={linking ? copy.registerAndLinkTitle(linking.displayName) : copy.registerTitle}
      closeLabel={copy.close}
      className="max-w-xl"
    >
      <div className="flex flex-col gap-4 p-5">
        {linking && <p className="rounded-2xl bg-warn-soft px-3 py-2 text-[13px] font-medium text-warn">{copy.linkingNote(linking.displayName)}</p>}
        <Input label={copy.name} value={name} disabled={saving || registeredId !== null} onChange={(e) => setName(e.target.value)} />
        <div className="grid gap-4 sm:grid-cols-2">
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
        </div>
        <Input
          label={hasBankAccount ? copy.documentRequired : copy.documentOptional}
          value={document}
          inputMode="numeric"
          disabled={saving || registeredId !== null}
          onChange={(e) => setDocument(formatDocument(e.target.value))}
        />
        {error && <p className="text-sm font-medium text-bad">{error}</p>}
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="ghost" disabled={saving} onClick={onClose}>
            {copy.cancel}
          </Button>
          <Button loading={saving} disabled={name.trim() === ""} onClick={save}>
            {linking ? copy.registerAndLink : copy.register}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
