// Generates isolated live SQL fixtures. Run only against an explicitly approved project.
// No credentials, auth tokens, or existing record contents are read or printed.
import { randomUUID } from 'node:crypto';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const directory = mkdtempSync(join(tmpdir(), 'founder-live-'));
const ids = Object.fromEntries(['alice','bob','company','project','bobProject','task','issue','risk','dependency','system','access','kpi','observation','wealth','capture','capturedIssue'].map(key => [key,randomUUID()]));
const q = key => `'${ids[key]}'`;
const as = key => `reset role; set local role authenticated; select set_config('request.jwt.claim.sub',${q(key)},true);`;
const check = (condition,message) => `if not (${condition}) then raise exception '${message}'; end if;`;
const rejects = (sql,state='check_violation') => `begin ${sql}; raise exception 'Expected rejection did not occur'; exception when ${state} then null; end;`;
const head = "begin; set local lock_timeout='5s'; set local statement_timeout='45s';\n";
const setup = head + `
insert into auth.users(id,email,raw_user_meta_data) values
(${q('alice')},'founder-qa-${ids.alice}@example.invalid','{}'),
(${q('bob')},'founder-qa-${ids.bob}@example.invalid','{}');
${as('bob')}
insert into public.projects(id,user_id,name) values(${q('bobProject')},${q('bob')},'Temporary Founder QA B');
${as('alice')}
insert into public.companies(id,user_id,name,active) values(${q('company')},${q('alice')},'Temporary Founder QA business',true);
insert into public.projects(id,user_id,name,company_id) values(${q('project')},${q('alice')},'Temporary Founder QA project',${q('company')});
insert into public.tasks(id,user_id,title,project_id,recurrence_frequency,target_count,current_count,daily_target) values(${q('task')},${q('alice')},'Temporary Founder QA recurring task',${q('project')},'daily',8,2,1);
insert into public.quality_incidents(id,user_id,title,description,company_id,project_id,corrective_task_id,impact,urgency) values(${q('issue')},${q('alice')},'Temporary Founder QA issue','Isolated live verification',${q('company')},${q('project')},${q('task')},'critical','immediate');
insert into public.operating_risks(id,user_id,title,category,status,currency,issue_id,project_id,company_id) values(${q('risk')},${q('alice')},'Temporary Founder QA risk','technical','monitoring','MAD',${q('issue')},${q('project')},${q('company')});
insert into public.operational_dependencies(id,user_id,source_type,source_id,dependency_type,dependency_id,dependency_label,state) values(${q('dependency')},${q('alice')},'task',${q('task')},'issue',${q('issue')},'Temporary QA blocker','blocked');
insert into public.operational_systems(id,user_id,name,purpose,company_id) values(${q('system')},${q('alice')},'Temporary QA system','Isolated verification',${q('company')});
insert into public.system_access_records(id,user_id,system_id,person_label,access_level) values(${q('access')},${q('alice')},${q('system')},'QA fixture','admin');
insert into public.kpi_definitions(id,user_id,company_id,name,unit,source,active) values(${q('kpi')},${q('alice')},${q('company')},'Temporary QA KPI','orders','manual',true);
insert into public.kpi_observations(id,user_id,kpi_id,observed_on,value) values(${q('observation')},${q('alice')},${q('kpi')},current_date,20);
insert into public.personal_balance_entries(id,user_id,name,kind,category,amount,currency,valued_on) values(${q('wealth')},${q('alice')},'Temporary QA valuation','asset','cash',100,'MAD',current_date);
insert into public.inbox_items(id,user_id,raw_text) values(${q('capture')},${q('alice')},'Temporary QA capture');
commit;
select 'PASS: isolated fixtures committed as authenticated owners' as result;
`;
const verify = head + as('alice') + `
do $$ begin
${check(`current_user='authenticated' and auth.uid()=${q('alice')}::uuid`,'Authenticated role and UID must be active')}
${check(`exists(select 1 from tasks where id=${q('task')} and recurrence_frequency='daily' and current_count=2 and target_count=8 and daily_target=1)`,'Committed recurrence was not persisted')}
${check(`exists(select 1 from operating_risks r join quality_incidents i on i.id=r.issue_id join tasks t on t.id=i.corrective_task_id join projects p on p.id=t.project_id join companies c on c.id=p.company_id where r.id=${q('risk')} and c.id=${q('company')})`,'Committed cross-domain links missing')}
${check(`exists(select 1 from operational_dependencies where id=${q('dependency')} and source_id=${q('task')} and dependency_id=${q('issue')} and state='blocked')`,'Dependency persistence missing')}
${check(`exists(select 1 from activity_log where entity_id=${q('risk')} and user_id=${q('alice')})`,'Audit event missing')}
${check(`exists(select 1 from founder_kpi_values(current_date) where id=${q('kpi')} and current_value=20)`,'Manual KPI RPC failed')}
${check(`exists(select 1 from search_founder_records('Temporary Founder QA risk') where entity_id=${q('risk')})`,'Search RPC failed')}
${rejects(`insert into quality_incidents(user_id,title,description,project_id) values(${q('alice')},'Invalid foreign reference','QA',${q('bobProject')})`)}
${rejects(`update operating_risks set user_id=${q('bob')} where id=${q('risk')}`)}
${rejects(`insert into operational_dependencies(user_id,source_type,source_id,dependency_type,dependency_id,dependency_label) values(${q('alice')},'task',${q('task')},'task',${q('task')},'Self')`)}
${rejects(`insert into quality_incidents(user_id,title,description,project_id,source_inbox_id) values(${q('alice')},'Invalid capture','QA',${q('bobProject')},${q('capture')})`)}
${check(`exists(select 1 from inbox_items where id=${q('capture')} and status='unprocessed')`,'Failed conversion did not roll back')}
insert into quality_incidents(id,user_id,title,description,source_inbox_id) values(${q('capturedIssue')},${q('alice')},'Temporary QA captured issue','QA',${q('capture')});
${check(`exists(select 1 from inbox_items where id=${q('capture')} and status='processed' and target_id=${q('capturedIssue')})`,'Capture conversion did not persist destination')}
${rejects(`insert into operating_risks(user_id,title,source_inbox_id) values(${q('alice')},'Duplicate capture',${q('capture')})`)}
update tasks set recurrence_frequency='weekly',current_count=3 where id=${q('task')};
update quality_incidents set status='resolved',preventive_action='Temporary QA lesson' where id=${q('issue')};
update quality_incidents set root_cause='Temporary QA root cause' where id=${q('issue')};
${check(`(select count(*) from operating_lessons where source_id=${q('issue')} and status='proposed')=1`,'Lesson is not idempotent or proposed')}
${check(`(select count(*) from lesson_evidence_links e join operating_lessons l on l.id=e.lesson_id where l.source_id=${q('issue')})=1`,'Lesson evidence missing')}
update personal_balance_entries set amount=150,valued_on=current_date+1 where id=${q('wealth')};
${check(`(select count(*) from personal_balance_history where entry_id=${q('wealth')})=2`,'Valuation history missing')}
end $$;
${as('bob')}
do $$ declare n integer; begin
${check(`not exists(select 1 from tasks where id=${q('task')}) and not exists(select 1 from operating_risks where id=${q('risk')}) and not exists(select 1 from quality_incidents where id=${q('issue')}) and not exists(select 1 from system_access_records where id=${q('access')})`,'Cross-user SELECT leaked data')}
update operating_risks set title='Should not apply' where id=${q('risk')}; get diagnostics n=row_count;
${check('n=0','Cross-user UPDATE succeeded')}
${rejects(`insert into operating_risks(user_id,title) values(${q('alice')},'Invalid impersonation')`,'insufficient_privilege')}
${rejects(`insert into system_access_records(user_id,system_id,person_label,access_level) values(${q('bob')},${q('system')},'Invalid','admin')`)}
${check(`not exists(select 1 from founder_kpi_values(current_date)) and not exists(select 1 from search_founder_records('Temporary Founder QA risk'))`,'RPC leaked another user records')}
${check(`not exists(select 1 from personal_balance_history where entry_id=${q('wealth')}) and not exists(select 1 from operating_lessons where source_id=${q('issue')})`,'History or lesson leaked another user data')}
end $$;
reset role; set local role anon; select set_config('request.jwt.claim.sub','',true);
do $$ begin
begin if exists(select 1 from operating_risks where id=${q('risk')}) then raise exception 'Anonymous read leaked data'; end if; exception when insufficient_privilege then null; end;
${rejects(`perform * from founder_kpi_values(current_date)`,'insufficient_privilege')}
end $$;
reset role;
commit;
select 'PASS: committed reads, recurrence update, cross-domain links, ownership guards, two-user RLS, anonymous denial, audit, capture atomicity, lesson idempotency, valuation history and owner-scoped RPCs' as result;
`;
const readback = head + as('alice') + `
do $$ begin
${check(`exists(select 1 from tasks where id=${q('task')} and recurrence_frequency='weekly' and current_count=3)`,'Updated recurrence did not survive a new connection')}
${check(`exists(select 1 from quality_incidents where id=${q('issue')} and status='resolved')`,'Updated issue did not survive a new connection')}
${check(`exists(select 1 from operating_lessons where source_id=${q('issue')} and status='proposed')`,'Proposed lesson did not survive a new connection')}
${check(`exists(select 1 from quality_incidents where id=${q('capturedIssue')} and source_inbox_id=${q('capture')})`,'Captured issue did not survive a new connection')}
end $$;
rollback;
select 'PASS: updated recurrence, resolved issue, capture and lesson persisted across independent connections' as result;
`;
const owners = `${q('alice')},${q('bob')}`;
const cleanup = head + `
-- Restrict deletion to the two unique synthetic owners created by this run.
do $$ begin
if exists(select 1 from auth.users where id in (${owners}) and email not like 'founder-qa-%@example.invalid') then raise exception 'Fixture identity mismatch'; end if;
end $$;
` + ['lesson_evidence_links','operating_lessons','personal_balance_history','personal_balance_entries','kpi_observations','kpi_definitions','system_access_records','operational_systems','operational_dependencies','operating_risks','quality_incidents','inbox_items','tasks','projects','companies'].map(t=>`delete from public.${t} where user_id in (${owners});`).join('\n')+`
delete from auth.users where id in (${owners});
commit;
select 'PASS: isolated fixtures and synthetic users removed' as result;
`;
for(const [name,sql] of Object.entries({setup,verify,readback,cleanup})) writeFileSync(join(directory,name+'.sql'),sql,{mode:0o600});
writeFileSync(join(directory,'ids.json'),JSON.stringify(ids),{mode:0o600});
console.log(directory);
