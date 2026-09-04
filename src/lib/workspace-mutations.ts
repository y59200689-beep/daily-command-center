import type { PersistedDomain } from "@/lib/domains";

type MutationListener = (domain: PersistedDomain) => void;
const listeners = new Set<MutationListener>();

export function announceWorkspaceMutation(domain: PersistedDomain) {
  for (const listener of listeners) listener(domain);
}

export function subscribeToWorkspaceMutations(domains: readonly PersistedDomain[], listener: () => void) {
  const domainSet = new Set(domains);
  const mutationListener: MutationListener = (domain) => {
    if (domainSet.has(domain)) listener();
  };
  listeners.add(mutationListener);
  return () => {
    listeners.delete(mutationListener);
  };
}
