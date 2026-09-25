import type { PersistedDomain } from "@/lib/domains";

export type MutationDomain = PersistedDomain | "founder-os";
type MutationListener = (domain: MutationDomain) => void;
const listeners = new Set<MutationListener>();

export function announceWorkspaceMutation(domain: MutationDomain) {
  for (const listener of listeners) listener(domain);
}

export function subscribeToWorkspaceMutations(domains: readonly MutationDomain[], listener: () => void) {
  const domainSet = new Set(domains);
  const mutationListener: MutationListener = (domain) => {
    if (domainSet.has(domain)) listener();
  };
  listeners.add(mutationListener);
  return () => {
    listeners.delete(mutationListener);
  };
}

// Founder views observe the same mutation bus as the existing workspace.
export const domainKeysForFounder: MutationDomain[] = ["founder-os", "fitness", "tasks", "projects", "decisions", "waiting", "subscriptions", "invoices"];
