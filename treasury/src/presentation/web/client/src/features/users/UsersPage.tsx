import { useCallback, useEffect, useState } from "react";
import { Check, Copy } from "lucide-react";
import { Badge } from "@/components/Badge";
import { Banner } from "@/components/Banner";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Input } from "@/components/Input";
import { Modal } from "@/components/Modal";
import { Select } from "@/components/Select";
import { Table } from "@/components/Table";
import { usersApi, type IssuedInvite, type UserListing } from "@/features/users/usersApi";
import { usersCopy } from "@/features/users/usersCopy";
import { refusalMessage, userRows } from "@/features/users/usersEngine";
import { useLanguage } from "@/i18n/i18n";
import { ROLES, type Role, type User } from "@/types/auth";
import { formatDateTime } from "@/utils/format";

type Refusal = { error: string };
const refusalCode = (data: unknown) => (data && typeof data === "object" && "error" in data ? (data as Refusal).error : undefined);

/** The link of an invite that could not be e-mailed (REQ-436): shown once, to be copied and passed on. */
function IssuedLink({ email, issued, onClose }: { email: string; issued: IssuedInvite; onClose: () => void }) {
  const { language } = useLanguage();
  const copy = usersCopy[language];
  const [copied, setCopied] = useState(false);

  const take = async () => {
    try {
      await navigator.clipboard.writeText(issued.link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // No clipboard here: the link stays on screen to be selected by hand.
    }
  };

  return (
    <div className="mt-4 rounded-2xl border border-accent/30 bg-accent-soft/40 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="font-semibold text-ink">{copy.linkReadyTitle(email)}</p>
        <button type="button" onClick={onClose} className="text-[12.5px] font-semibold text-muted hover:text-ink">
          {copy.close}
        </button>
      </div>
      <p className="mt-1 text-[13px] text-muted">
        {copy.linkReadyNote} {copy.linkValidUntil(formatDateTime(issued.expiresAt))}
      </p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <input
          readOnly
          value={issued.link}
          aria-label={copy.linkReadyTitle(email)}
          onFocus={(e) => e.currentTarget.select()}
          className="tabular h-10 min-w-0 flex-1 rounded-2xl border border-line bg-panel-solid px-3 text-[13px] text-ink outline-none focus:border-accent"
        />
        <Button variant="ghost" onClick={take} className="shrink-0">
          {copied ? <Check className="size-4" strokeWidth={1.8} /> : <Copy className="size-4" strokeWidth={1.6} />}
          {copied ? copy.copied : copy.copyLink}
        </Button>
      </div>
    </div>
  );
}

/**
 * The users screen (REQ-440), for the administrator. The server enforces every rule — who may act,
 * the last administrator, one active user per e-mail; this page shows what it answers.
 */
export function UsersPage({ me, onSelfChanged }: { me: User; onSelfChanged: () => void }) {
  const { t, language } = useLanguage();
  const copy = usersCopy[language];
  const [listing, setListing] = useState<UserListing | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("finance_manager");
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [issued, setIssued] = useState<{ email: string; invite: IssuedInvite } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [toDeactivate, setToDeactivate] = useState<User | null>(null);

  const load = useCallback(async () => {
    try {
      const { ok, data } = await usersApi.list();
      setLoadFailed(!ok);
      if (ok && "users" in data) setListing(data);
    } catch {
      setLoadFailed(true);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const issue = async (to: string, as: Role) => {
    setInviting(true);
    setInviteError(null);
    const { ok, data } = await usersApi.invite(to, as);
    setInviting(false);
    if (!ok || !("link" in data)) {
      setInviteError(refusalMessage(copy.errors, refusalCode(data)));
      return;
    }
    setIssued({ email: to.trim().toLowerCase(), invite: data });
    setEmail("");
    await load();
  };

  /** Runs one act on a user, then reloads; the result is said in one line above the list. */
  const act = async (target: User, run: () => ReturnType<typeof usersApi.deactivate>, done: string) => {
    setBusy(target.id);
    setMessage(null);
    const { ok, data } = await run();
    setBusy(null);
    setMessage(ok ? { ok: true, text: done } : { ok: false, text: refusalMessage(copy.errors, refusalCode(data)) });
    await load();
    if (ok && target.id === me.id) onSelfChanged();
  };

  const roleOptions = ROLES.map((r) => ({ value: r, label: t.roles[r] }));
  const yesNo = [
    { value: "yes", label: copy.yes },
    { value: "no", label: copy.no },
  ];
  const rows = listing ? userRows(listing.users, listing.invites) : [];

  return (
    <div className="space-y-8">
      <div>
        <h2 className="font-display text-2xl font-semibold text-ink">{copy.heading}</h2>
        <p className="mt-1 max-w-3xl text-sm text-muted">{copy.subheading}</p>
      </div>

      {loadFailed && <Banner variant="bad">{copy.loadError}</Banner>}

      <Card>
        <h3 className="font-display text-lg font-semibold text-ink">{copy.inviteTitle}</h3>
        <p className="mt-1 text-[13px] text-muted">{copy.inviteNote}</p>
        <form
          className="mt-4 grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,16rem)_auto] md:items-end"
          onSubmit={(e) => {
            e.preventDefault();
            void issue(email, role);
          }}
        >
          <Input
            label={copy.email}
            type="email"
            autoComplete="off"
            value={email}
            disabled={inviting}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Select label={copy.role} value={role} onChange={(v) => setRole(v as Role)} options={roleOptions} />
          <Button type="submit" loading={inviting} disabled={email.trim() === ""}>
            {copy.invite}
          </Button>
        </form>
        <p className="mt-2 text-[12.5px] text-muted">{copy.roleHelp[role]}</p>
        {inviteError && <p className="mt-3 text-sm font-medium text-bad">{inviteError}</p>}
        {issued && <IssuedLink email={issued.email} issued={issued.invite} onClose={() => setIssued(null)} />}
      </Card>

      <Card>
        <h3 className="font-display text-lg font-semibold text-ink">{copy.listTitle}</h3>
        {message && (
          <p className={`mt-2 text-sm font-medium ${message.ok ? "text-ok" : "text-bad"}`} role="status">
            {message.text}
          </p>
        )}
        <Table.Root className="mt-3">
          <Table.Head>
            <Table.Row>
              <Table.HeaderCell>{copy.person}</Table.HeaderCell>
              <Table.HeaderCell>{copy.role}</Table.HeaderCell>
              <Table.HeaderCell>{copy.curation}</Table.HeaderCell>
              <Table.HeaderCell>{copy.status}</Table.HeaderCell>
              <Table.HeaderCell className="text-right">{copy.actions}</Table.HeaderCell>
            </Table.Row>
          </Table.Head>
          <Table.Body>
            {rows.map((row) => {
              if (row.kind === "invite") {
                const { invite } = row;
                return (
                  <Table.Row key={row.key}>
                    <Table.Cell>
                      <span className="text-ink">{invite.email}</span>
                    </Table.Cell>
                    <Table.Cell className="text-muted">{t.roles[invite.role]}</Table.Cell>
                    <Table.Cell className="text-muted">—</Table.Cell>
                    <Table.Cell>
                      <Badge variant="warn">{copy.pendingInvite(formatDateTime(invite.expiresAt))}</Badge>
                    </Table.Cell>
                    <Table.Cell className="text-right">
                      <Button size="sm" variant="ghost" loading={inviting} onClick={() => void issue(invite.email, invite.role)}>
                        {copy.resend}
                      </Button>
                    </Table.Cell>
                  </Table.Row>
                );
              }
              const { user } = row;
              const active = user.status === "active";
              const isMe = user.id === me.id;
              return (
                <Table.Row key={row.key} className={active ? undefined : "opacity-60"}>
                  <Table.Cell>
                    <div className="flex min-w-48 flex-col">
                      <span className="font-semibold text-ink">
                        {user.displayName}
                        {isMe && <span className="ml-1.5 text-[12px] font-medium text-muted">({copy.you})</span>}
                      </span>
                      {user.name && <span className="text-[12.5px] text-muted">{user.email}</span>}
                    </div>
                  </Table.Cell>
                  <Table.Cell>
                    {active ? (
                      <Select
                        className="min-w-44"
                        value={user.role}
                        options={roleOptions}
                        onChange={(value) =>
                          value !== user.role &&
                          void act(user, () => usersApi.changeRole(user.id, value as Role), copy.done.role(user.displayName))
                        }
                      />
                    ) : (
                      <span className="text-muted">{t.roles[user.role]}</span>
                    )}
                  </Table.Cell>
                  <Table.Cell>
                    {active && user.role === "admin" ? (
                      <span className="text-muted">{copy.curationByRole}</span>
                    ) : active ? (
                      <Select
                        className="min-w-24"
                        value={user.curator ? "yes" : "no"}
                        options={yesNo}
                        onChange={(value) =>
                          (value === "yes") !== user.curator &&
                          void act(
                            user,
                            () => usersApi.setCuration(user.id, value === "yes"),
                            copy.done.curation(user.displayName, value === "yes"),
                          )
                        }
                      />
                    ) : (
                      <span className="text-muted">{user.curator ? copy.yes : copy.no}</span>
                    )}
                  </Table.Cell>
                  <Table.Cell>
                    <Badge variant={active ? "ok" : "neutral"} dot>
                      {active ? copy.active : copy.deactivated}
                    </Badge>
                  </Table.Cell>
                  <Table.Cell className="text-right">
                    {active && (
                      <Button size="sm" variant="ghost" loading={busy === user.id} onClick={() => setToDeactivate(user)}>
                        {copy.deactivate}
                      </Button>
                    )}
                  </Table.Cell>
                </Table.Row>
              );
            })}
          </Table.Body>
        </Table.Root>
      </Card>

      <Modal
        open={toDeactivate !== null}
        onClose={() => setToDeactivate(null)}
        title={copy.confirmTitle}
        closeLabel={copy.cancel}
        className="max-w-md"
      >
        {toDeactivate && (
          <div className="space-y-5 p-5">
            <p className="text-sm text-ink">{copy.confirmBody(toDeactivate.displayName)}</p>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="ghost" onClick={() => setToDeactivate(null)}>
                {copy.cancel}
              </Button>
              <Button
                variant="danger"
                onClick={() => {
                  const target = toDeactivate;
                  setToDeactivate(null);
                  void act(target, () => usersApi.deactivate(target.id), copy.done.deactivated(target.displayName));
                }}
              >
                {copy.confirm}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
