export type LeadDeletionResult = { deletedIds: string[]; failedIds: string[] };

/** Use the existing owner-scoped archive endpoint, with bounded parallel requests. */
export async function deleteLeads(ids: readonly string[], request: typeof fetch = fetch): Promise<LeadDeletionResult> {
  const uniqueIds = [...new Set(ids)];
  const deletedIds: string[] = [], failedIds: string[] = [];
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(4, uniqueIds.length) }, async () => {
    while (next < uniqueIds.length) {
      const id = uniqueIds[next++];
      try {
        const response = await request(`/api/business/leads?id=${encodeURIComponent(id)}`, { method: "DELETE" });
        if (!response.ok) throw new Error("Delete failed");
        deletedIds.push(id);
      } catch { failedIds.push(id); }
    }
  }));
  return { deletedIds, failedIds };
}
