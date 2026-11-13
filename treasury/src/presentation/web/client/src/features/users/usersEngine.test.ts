import { describe, it, expect } from "vitest";
import { userRows, refusalMessage } from "@/features/users/usersEngine";
import { passwordProblem, acceptErrorMessage } from "@/features/auth/acceptInvite";
import { inviteTokenFrom } from "@/features/auth/authApi";
import type { User } from "@/types/auth";

const user = (id: string, status: User["status"]): User => ({
  id,
  email: `${id}@usina.test`,
  name: null,
  displayName: `${id}@usina.test`,
  role: "viewer",
  status,
  curator: false,
  permissions: [],
});

describe("userRows (REQ-440)", () => {
  it("lists active people, then pending invites, then the deactivated, in one list", () => {
    const rows = userRows(
      [user("a", "active"), user("gone", "deactivated"), user("b", "active")],
      [{ email: "new@usina.test", role: "viewer", expiresAt: "2026-11-16T12:00:00.000Z", invitedBy: "a", invitedAt: "2026-11-13T12:00:00.000Z" }],
    );
    expect(rows.map((r) => r.key)).toEqual(["u:a", "u:b", "i:new@usina.test", "u:gone"]);
  });
});

describe("refusalMessage", () => {
  it("words a known code and falls back for an unknown one", () => {
    const errors = { last_admin: "precisa de um administrador", generic: "algo deu errado" };
    expect(refusalMessage(errors, "last_admin")).toBe("precisa de um administrador");
    expect(refusalMessage(errors, "boom")).toBe("algo deu errado");
    expect(refusalMessage(errors, undefined)).toBe("algo deu errado");
  });
});

describe("invite acceptance (REQ-415, REQ-422)", () => {
  it("asks 12 to 128 characters and the same password twice, with no composition rule", () => {
    expect(passwordProblem("a".repeat(11), "a".repeat(11))).toBe("too_short");
    expect(passwordProblem("a".repeat(129), "a".repeat(129))).toBe("too_long");
    expect(passwordProblem("a".repeat(12), "b".repeat(12))).toBe("mismatch");
    expect(passwordProblem("uma frase qualquer", "uma frase qualquer")).toBeNull();
  });

  it("says the same thing for every unusable link (EX-403)", () => {
    expect(acceptErrorMessage("invalid_invite")).toBe(acceptErrorMessage(undefined));
    expect(acceptErrorMessage("invalid_password")).toContain("12");
  });

  it("reads the token from the invite link", () => {
    expect(inviteTokenFrom("?convite=abc123")).toBe("abc123");
    expect(inviteTokenFrom("?outra=1")).toBeNull();
    expect(inviteTokenFrom("?convite=")).toBeNull();
  });
});
