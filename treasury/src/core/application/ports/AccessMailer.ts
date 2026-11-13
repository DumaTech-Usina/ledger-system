/**
 * How an access e-mail leaves the Treasury (REQ-435), decoupled from the rules. Until a sender is
 * configured, nothing is sent and the invite link is shown to the administrator instead (REQ-436).
 */
export interface AccessMailer {
  /** Returns whether the e-mail was actually sent. */
  sendInvite(message: { to: string; link: string; expiresAt: string }): Promise<boolean>;
}
