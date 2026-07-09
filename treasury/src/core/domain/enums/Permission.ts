/** Fine-grained capabilities checked at the route boundary. */
export enum Permission {
  INTENT_CREATE = "intent:create",
  INTENT_SUBMIT = "intent:submit",
  INTENT_READ = "intent:read",
  DASHBOARD_READ = "dashboard:read",
}
