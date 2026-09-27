import test from "node:test";
import assert from "node:assert/strict";
import { visibleTeamPeople, openDelegations, nextTeamFollowup } from "../src/lib/team-dashboard";
import type { TeamPerson, TeamDelegation } from "../src/lib/team";
const people:TeamPerson[]=[{id:"a",name:"Sarah Chen",email:"sarah@example.com",role_title:"Operations Lead",company_team:"Operations",status:"active",relationship_type:"team_member"},{id:"b",name:"David Kim",role_title:"Designer",company_team:"Design",status:"inactive",relationship_type:"contractor"}];
const delegations:TeamDelegation[]=[{id:"1",title:"Launch",delegated_to_person_id:"a",expected_outcome:"Ship",status:"assigned",priority:"high",due_at:"2026-10-10",review_at:"2026-10-08"},{id:"2",title:"Finished",delegated_to_person_id:"a",expected_outcome:"Ship",status:"completed",priority:"low",due_at:"2026-09-01"},{id:"3",title:"Other",delegated_to_person_id:"b",expected_outcome:"Ship",status:"blocked",priority:"high",due_at:"2026-10-01"}];
test("team search matches email, role and team without changing source data",()=>{assert.deepEqual(visibleTeamPeople(people," SARAH@ ","","","").map(p=>p.id),["a"]);assert.equal(visibleTeamPeople(people,"design","","","").length,1);assert.equal(people.length,2);});
test("team filters combine rather than replace one another",()=>{assert.equal(visibleTeamPeople(people,"","Designer","active","Design").length,0);assert.equal(visibleTeamPeople(people,"","Operations Lead","active","Operations").length,1);});
test("follow-up selects earliest due or review date for this person's open work",()=>{assert.equal(nextTeamFollowup(delegations,"a"),"2026-10-08");assert.equal(nextTeamFollowup(delegations,"missing"),null);assert.equal(openDelegations(delegations).length,2);});
