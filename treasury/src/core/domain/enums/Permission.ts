/** Fine-grained capabilities checked at the route boundary. */
export enum Permission {
  INTENT_CREATE = "intent:create",
  INTENT_SUBMIT = "intent:submit",
  INTENT_READ = "intent:read",
  DASHBOARD_READ = "dashboard:read",
  /** REQ-402: granted to a user who already has a role, never implied by one. */
  PARTY_CURATE = "party:curate",
}
