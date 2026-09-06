/**
 * Server-only boundaries for future Para Officinal connectors. UI reads local,
 * normalized snapshots; adapters may be implemented only in trusted server code.
 */
export type CommerceSnapshot = { capturedAt: string; orders: Array<{ externalId: string; status: string; currency: string; totalAmount: number; customerReference?: string }>; items: Array<{ orderExternalId: string; productExternalId?: string; productName: string; quantity: number; unitPrice: number; unitCost?: number }> };
export type DeploymentSnapshot = { capturedAt: string; deployments: Array<{ externalId: string; environment: "production" | "preview"; status: "building" | "ready" | "failed" | "canceled"; branch?: string; commitSha?: string; commitMessage?: string; url?: string; completedAt?: string }> };
export type DeploymentSourceHealth = { state: "connected" | "not_connected" | "stale" | "needs_attention"; lastSuccessfulSync: string | null; message: string };
export type AnalyticsSnapshot = { capturedAt: string; metrics: Record<string, number | null> };
export interface CommerceDataSource { pull(companyId: string): Promise<CommerceSnapshot>; }
export interface DeploymentDataSource { pull(companyId: string): Promise<DeploymentSnapshot>; health(companyId: string): Promise<DeploymentSourceHealth>; }
export interface AnalyticsDataSource { pull(companyId: string): Promise<AnalyticsSnapshot>; }

export function normalizeVercelDeployment(input: { id: string; target?: string | null; state: string; meta?: Record<string, string | undefined>; createdAt?: number | null; ready?: number | null; url?: string | null }): DeploymentSnapshot["deployments"][number] {
  const statuses: Record<string, DeploymentSnapshot["deployments"][number]["status"]> = { READY: "ready", ERROR: "failed", CANCELED: "canceled", BUILDING: "building", QUEUED: "building" };
  const millisecondsToIso = (value: number | null | undefined) => value == null ? undefined : new Date(value).toISOString();
  return { externalId: input.id, environment: input.target === "production" ? "production" : "preview", status: statuses[input.state] ?? "building", branch: input.meta?.githubCommitRef, commitSha: input.meta?.githubCommitSha, commitMessage: input.meta?.githubCommitMessage, url: input.url ?? undefined, completedAt: millisecondsToIso(input.ready ?? input.createdAt) };
}

export function deploymentSourceHealth(input: { connected: boolean; lastSuccessfulSync?: string | null; providerError?: boolean; now?: Date }): DeploymentSourceHealth {
  if (!input.connected) return { state: "not_connected", lastSuccessfulSync: null, message: "Deployment source is not connected." };
  if (input.providerError) return { state: "needs_attention", lastSuccessfulSync: input.lastSuccessfulSync ?? null, message: "Deployment source needs attention." };
  const now = input.now ?? new Date();
  if (!input.lastSuccessfulSync || now.getTime() - new Date(input.lastSuccessfulSync).getTime() > 24 * 3_600_000) return { state: "stale", lastSuccessfulSync: input.lastSuccessfulSync ?? null, message: "Deployment source has not synchronized recently." };
  return { state: "connected", lastSuccessfulSync: input.lastSuccessfulSync, message: "Deployment source is connected." };
}
