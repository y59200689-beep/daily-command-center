export type MissionActivityLog = { log_date: string; action_id: string; quantity: number };

export function sumMissionActivity(logs: readonly MissionActivityLog[], actionId: string, from: string, to: string) {
  return logs.reduce((total, row) => total + (row.action_id === actionId && row.log_date >= from && row.log_date <= to ? row.quantity : 0), 0);
}

// A manual tally and its linked workspace records can describe the same work.
// Use the larger verified count until activities have per-record identities.
export function reconcileMissionActivity(logged: number, linkedRecords: number) {
  return Math.max(logged, linkedRecords);
}
