import type { AccessMailer } from "../../core/application/ports/AccessMailer";

/**
 * The sender while none is configured (REQ-436): sends nothing, so the link goes to the administrator
 * who invited. The link is never written to the logs: it is a secret until it is used.
 */
export class NoEmailAccessMailer implements AccessMailer {
  async sendInvite(): Promise<boolean> {
    return false;
  }
}
