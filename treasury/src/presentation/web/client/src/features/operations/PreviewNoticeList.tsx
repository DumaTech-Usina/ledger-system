import { useLanguage } from "@/i18n/i18n";
import type { PreviewNotice } from "@/types/operations";
import { formatMoneyForLanguage } from "@/utils/format";

const copy = {
  "pt-BR": {
    payoutBeforeReceipt: (policy: string) =>
      `Nenhum recebimento registrado para a apólice ${policy}. O repasse vai sair sem a entrada correspondente; o Ledger aceita, e isso fica visível.`,
    openWith: (name: string) => `Já está em aberto com ${name}:`,
    openNote: "Nada é descontado. Se quiser compensar, decida antes de enviar.",
    unknownBalance: "saldo desconhecido",
    unavailable: "Não foi possível ler o Ledger para conferir avisos. Isso não quer dizer que não há nenhum.",
  },
  en: {
    payoutBeforeReceipt: (policy: string) =>
      `No receipt recorded for policy ${policy}. The payout leaves without the matching inflow; the Ledger accepts it, and it stays visible.`,
    openWith: (name: string) => `Already open with ${name}:`,
    openNote: "Nothing is deducted. If you want to offset, decide before submitting.",
    unknownBalance: "unknown balance",
    unavailable: "Could not read the Ledger to check for notices. That does not mean there are none.",
  },
};

/** §4.6 block C: what the preview says beside the candidate. Informative only (REQ-268, REQ-270). */
export function PreviewNoticeList({ notices, partyNames }: { notices: PreviewNotice[]; partyNames: Record<string, string> }) {
  const { language, t } = useLanguage();
  const c = copy[language];
  if (notices.length === 0) return null;

  return (
    <div className="mt-4 space-y-2.5">
      {notices.map((notice, i) => (
        <div key={i} className="rounded-2xl bg-warn-soft px-3.5 py-3 text-[13px] text-ink">
          {notice.code === "payout_before_receipt" && <p>{c.payoutBeforeReceipt(notice.policyId)}</p>}
          {notice.code === "notices_unavailable" && <p>{c.unavailable}</p>}
          {notice.code === "open_with_party" && (
            <>
              <p className="font-semibold">{c.openWith(partyNames[notice.partyId] ?? notice.partyId)}</p>
              <ul className="mt-1.5 space-y-1">
                {notice.positions.map((p) => (
                  <li key={p.objectId} className="flex justify-between gap-3">
                    <span>{t.objectType[p.objectType] ?? p.objectType}</span>
                    <span className="tabular font-medium">
                      {p.openBalance === null ? c.unknownBalance : formatMoneyForLanguage(p.openBalance, "BRL", language)}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-1.5 text-muted">{c.openNote}</p>
            </>
          )}
        </div>
      ))}
    </div>
  );
}
