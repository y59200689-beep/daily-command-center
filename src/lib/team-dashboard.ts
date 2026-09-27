import type { TeamPerson, TeamDelegation } from "./team";
export function visibleTeamPeople(people: TeamPerson[], query: string, role: string, status: string, team: string) {
  const needle = query.trim().toLowerCase();
  return people.filter(p => (!role || p.role_title === role) && (!status || p.status === status) && (!team || p.company_team === team) && (!needle || [p.name,p.display_name,p.email,p.role_title,p.company_team,p.notes].some(value => value?.toLowerCase().includes(needle))));
}
export function openDelegations(delegations: TeamDelegation[]) { return delegations.filter(d => !["completed","cancelled"].includes(d.status)); }
export function nextTeamFollowup(delegations: TeamDelegation[], personId: string) {
  return openDelegations(delegations).filter(d => d.delegated_to_person_id === personId).flatMap(d => [d.review_at,d.due_at].filter((date): date is string => Boolean(date))).sort()[0] ?? null;
}
