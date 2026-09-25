import { expect, type Page } from "@playwright/test";
import { create, edit, label, day, see, fits, watch, evidence, normalClient, fill, save, identity } from "../tier1/workflows";
async function verifyTodayPreview(page:Page){await page.goto('/today');await expect(page.getByRole('link',{name:/Active signals/})).toBeVisible();await fits(page);}
export async function businessWorkflow(page: Page) {
 page.setDefaultTimeout(60000);
 const errors=await watch(page), suffix=`tier2_${page.viewportSize()?.width}_${Date.now()}`;
 const name=label(`${suffix}_business`), metric=label(`${suffix}_availability`);
 const company=await create(page,"/business-pulse/businesses",{"Business name":name,"Business type":"Synthetic services","Active":true});
 await fits(page);
 await edit(page,"/business-pulse/businesses",company.id,{"Description":"Edited venture context","Business status":"operating"});
 const kpi=await create(page,"/business-pulse/kpis",{"KPI name":metric,"Business":company.id,"Unit":"percent","Direction of success":"higher","Target / range minimum":"99","Warning threshold":"95","Critical threshold":"90","Frequency":"daily","Active":true});
 const obs=await create(page,"/business-pulse/observations",{"KPI":kpi.id,"Observed on":day(),"Value":"70","Evidence / source reference":"Synthetic measurement"});
 await edit(page,"/business-pulse/observations",obs.id,{"Value":"80"});
 await page.reload();await expect(page.locator("main")).toContainText("80");
 await see(page,"/business-pulse",name);await expect(page.locator("main")).toContainText("CRITICAL");await expect(page.locator("main")).toContainText("Current 80 percent");
 const state=await page.request.get('/api/founder-state'),stateBody=await state.json();expect(state.ok()).toBeTruthy();expect(stateBody.signals.some((signal:{sourceId:string;type:string})=>signal.sourceId===kpi.id&&signal.type==='KPI_CRITICAL')).toBe(true);
 await see(page,"/state",metric);await verifyTodayPreview(page);
 for(const route of ["/executive","/review/weekly"]) await see(page,route,metric);
 const client=await normalClient();const stored=await client.from("kpi_observations").select("value,unit,is_manual").eq("id",obs.id).single();
 expect(stored.error).toBeNull();expect(Number(stored.data?.value)).toBe(80);expect(stored.data?.unit).toBe("percent");expect(stored.data?.is_manual).toBe(true);
 await fits(page);expect(errors).toEqual([]);evidence("Tier 2A business/KPI create edit refresh and propagation",{company:company.id,kpi:kpi.id,observation:obs.id,errors});
}
export async function infrastructureWorkflow(page:Page){
 page.setDefaultTimeout(60000);const errors=await watch(page),name=label(`tier2_system_${page.viewportSize()?.width}_${Date.now()}`);
 const system=await create(page,"/infrastructure",{"System":name,"Purpose":"Synthetic continuity verification","Category":"domain","Criticality":"critical","Status":"active","Owner":"Synthetic operator","Service / domain expiry":day(2),"Domain name":"example.test","Registrar":"Synthetic registrar","Production depends on this system":true,"Migration status":"blocked"});
 await edit(page,"/infrastructure",system.id,{"Billing contact":"Synthetic billing team","Current version":"test-v2","DNS owner":"Synthetic DNS team"});await page.reload();await fits(page);
 const access=await create(page,"/infrastructure/access",{"System":system.id,"Person / team":label(`tier2_admin_${page.viewportSize()?.width}`),"Access level":"owner","2FA enabled":false,"Recovery path exists":false,"Last access audit":day(-180)});
 const checkName=label(`tier2_database_${page.viewportSize()?.width}`);
 const check=await create(page,"/infrastructure/health",{"System":system.id,"Component name":checkName,"Component":"database","Observed status":"failed","Evidence / explanation":"Synthetic database probe failed","Checked on":day()});
 await edit(page,"/infrastructure/health",check.id,{"Evidence / explanation":"Edited failure evidence persists"});await page.reload();await fits(page);
 for(const route of ["/state","/executive","/review/weekly","/founder/development"])await see(page,route,name);
 const lookup=await page.request.get(`/api/search?q=${encodeURIComponent(name)}`);expect(lookup.ok()).toBeTruthy();expect((await lookup.json()).data.some((r:{entity_id:string})=>r.entity_id===system.id)).toBe(true);
 const client=await normalClient();const stored=await client.from("system_health_checks").select("reason,source").eq("id",check.id).single();expect(stored.data?.reason).toBe("Edited failure evidence persists");expect(stored.data?.source).toBe("manual");
 await edit(page,"/infrastructure/access",access.id,{"2FA enabled":true,"Recovery path exists":true,"Last access audit":day()});
 const state=await page.request.get("/api/founder-state");const body=await state.json();expect(state.ok()).toBeTruthy();expect(body.signals.some((s:{type:string;sourceId:string})=>s.sourceId===access.id&&s.type==="NO_2FA_ON_CRITICAL_SYSTEM")).toBe(false);
 expect(errors).toEqual([]);evidence("Tier 2B registry access health edit refresh propagation and recovery",{system:system.id,access:access.id,check:check.id,errors});
}
export async function personalWorkflow(page:Page){
 page.setDefaultTimeout(60000);const errors=await watch(page),suffix=`personal_${page.viewportSize()?.width}_${Date.now()}`;
 const initialBalance=await page.request.get('/api/founder-personal'); expect(initialBalance.ok()).toBeTruthy(); const initialUSD=(await initialBalance.json()).totals.USD?.assets??0;
 const asset=await create(page,'/life/wealth',{'Asset / liability':label(`${suffix}_cash`),'Kind':'asset','Category':'bank','Value':'1000','Currency (ISO code)':'USD','Liquid asset':true,'Valuation date':day(-1)});
 await edit(page,'/life/wealth',asset.id,{'Value':'700','Valuation date':day()});await page.reload();await expect(page.locator('main')).toContainText('Personal balance sheet'); const balance=await page.request.get('/api/founder-personal'); expect(balance.ok()).toBeTruthy(); expect((await balance.json()).totals.USD.assets).toBe(initialUSD+700);await fits(page);
 const liabilityName=label(`${suffix}_obligation`);const debt=await create(page,'/life/wealth',{'Asset / liability':liabilityName,'Kind':'liability','Category':'tax','Value':'200','Currency (ISO code)':'MAD','Valuation date':day(),'Liability due date':day(3),'Major personal obligation':true});
 const client=await normalClient();const savedDebt=await client.from('personal_balance_entries').select('id,kind,amount,currency,due_date,material').eq('id',debt.id).single();expect(savedDebt.error).toBeNull();expect(savedDebt.data).toMatchObject({kind:'liability',material:true,due_date:day(3)});
 const founderState=await page.request.get('/api/founder-state');expect(founderState.ok()).toBeTruthy();const stateBody=await founderState.json();expect(stateBody.signals.some((s:{sourceId:string;type:string})=>s.sourceId===debt.id&&s.type==='LARGE_OBLIGATION_SOON')).toBe(true);
 const docName=label(`${suffix}_passport`),doc=await create(page,'/life/documents',{'Document name':docName,'Type':'passport','Expiry date':day(5),'Verification status':'unverified','Remind within days':'30'});
 await edit(page,'/life/documents',doc.id,{'Owner':'Synthetic traveller','Verification status':'verified'});await page.reload();await fits(page);
 const tripName=label(`${suffix}_stay`),trip=await create(page,'/travel/mobility',{'Stay':tripName,'Country':'Synthetic country','City':'Synthetic city','Status':'in_progress','Entry date':day(-5),'Expected departure':day(4),'Documented allowed stay (days)':'10','Source of stay allowance':'Synthetic entered rule','Passport required':true,'Passport document':doc.id,'Insurance expiry':day(2),'Administrative status':'pending'});
 await edit(page,'/travel/mobility',trip.id,{'Accommodation / local logistics':'Edited local transport note'});await page.reload();await expect(page.locator('main')).toContainText('6 days used');await fits(page);
 const personalState=await page.request.get('/api/founder-state'),personalBody=await personalState.json();expect(personalState.ok()).toBeTruthy();expect(personalBody.signals.some((signal:{sourceId:string;type:string})=>signal.sourceId===debt.id&&signal.type==='LARGE_OBLIGATION_SOON')).toBe(true);
 await see(page,'/state',liabilityName);await verifyTodayPreview(page);for(const route of ['/executive','/review/weekly'])await see(page,route,liabilityName);
 const stored=await client.from('trips').select('accommodation_notes,passport_document_id').eq('id',trip.id).single();expect(stored.data?.passport_document_id).toBe(doc.id);expect(stored.data?.accommodation_notes).toBe('Edited local transport note');
 expect(errors).toEqual([]);evidence('Tier 2C personal wealth documents mobility persistence and propagation',{asset:asset.id,debt:debt.id,document:doc.id,trip:trip.id,errors});
}
export async function relationshipWorkflow(page:Page){
 page.setDefaultTimeout(60000);page.setDefaultNavigationTimeout(180000);const errors=await watch(page),suffix=`relationship_${page.viewportSize()?.width}_${Date.now()}`;
 const name=label(`${suffix}_partner`),contact=await create(page,'/relationships',{'Relationship label':name,'Type':'contact','Organization':'Synthetic organization','Role':'Synthetic counterpart','Importance':'critical','Health':'attention','Last interaction':day(-8),'Next follow-up':day(-1)});
 await edit(page,'/relationships',contact.id,{'Relationship context':'Edited coordination context'});await page.reload();await expect(page.locator('main')).toContainText('Edited coordination context');
 const promiseName=label(`${suffix}_promise`);await page.goto('/today');await page.getByRole('button',{name:/^(Capture|Quick capture)$/i}).first().click();await page.getByRole('dialog').getByLabel('Quick capture',{exact:true}).fill(`commitment ${promiseName}`);const captured=await save(page,'Save to Inbox');
 await page.goto('/inbox');const item=page.locator('article.inbox-item').filter({hasText:promiseName.replaceAll('_',' ')});await item.getByRole('button',{name:'Clear',exact:true}).click();await expect(page.getByRole('dialog')).toBeVisible();
 await fill(page.getByRole('dialog'),{'Who':'Synthetic counterpart','Direction':'owed_to_me','Status':'open','Due date':day(2),'Follow-up date':day(-1),'Importance':'critical','Relationship':contact.id,'Expected outcome':'Synthetic coordinated follow-up'});const promise=await save(page);await page.reload();await expect(page.locator('main')).toContainText(promise.title);
 await page.goto('/relationships');await expect(page.locator('main')).toContainText(promise.title);await page.goto(`/commitments?relationship_id=${contact.id}`);await expect(page.locator('main')).toContainText(promise.title);await fits(page);
 for(const title of [name,promise.title])await see(page,'/state',title);
 await verifyTodayPreview(page);
 for(const route of ['/executive','/review/weekly'])for(const title of [name,promise.title])await see(page,route,title);
 const client=await normalClient();const saved=await client.from('operating_commitments').select('relationship_id,source_inbox_id,follow_up_date,direction,status').eq('id',promise.id).single();expect(saved.error).toBeNull();expect(saved.data).toMatchObject({relationship_id:contact.id,source_inbox_id:captured.id,follow_up_date:day(-1),direction:'owed_to_me',status:'open'});const state=await page.request.get('/api/founder-state');const body=await state.json();expect(body.signals.some((signal:{sourceId:string;type:string})=>signal.sourceId===promise.id&&signal.type==='COMMITMENT_OVERDUE')).toBe(true);
 const taskName=label(`${suffix}_repeated_work`);await page.goto('/tasks');await page.getByRole('button',{name:'New task',exact:true}).click();const taskDialog=page.getByRole('dialog');await taskDialog.getByRole('textbox',{name:/^Task Name/}).fill(taskName);await fill(taskDialog,{'Status':'planned','Priority':'high','Work classification':'founder_only'});const task=await save(page,'Create task');const updated=await client.from('tasks').update({recurrence_frequency:'weekly'}).eq('id',task.id).select('id').single();expect(updated.error).toBeNull();const now=Date.now();const sessions=Array.from({length:5},(_,index)=>{const started=new Date(now-(index+1)*86400000).toISOString();return {user_id:identity().userId,task_id:task.id,started_at:started,ended_at:new Date(new Date(started).getTime()+3600000).toISOString(),duration_seconds:3600};});const recorded=await client.from('focus_sessions').insert(sessions);expect(recorded.error).toBeNull();const briefing=await page.request.get('/api/founder-briefing?window=7');expect(briefing.ok()).toBeTruthy();const brief=await briefing.json();expect(brief.bottlenecks.some((item:{id:string;reasons:string[]})=>item.id===`activity:${task.id}`&&item.reasons.some(reason=>reason.includes('5.0 recorded hours')))).toBe(true);const founderState=await page.request.get('/api/founder-state');const founder=await founderState.json();expect(founder.signals.some((signal:{type:string;title:string})=>signal.type==='FOUNDER_BOTTLENECK'&&signal.title.includes(taskName))).toBe(true);
 await see(page,'/executive',taskName);await see(page,'/review/weekly',taskName);
 expect(errors).toEqual([]);evidence('Tier 2D relationship and commitment capture, timeline, follow-up and cross-domain propagation',{relationship:contact.id,commitment:promise.id,inbox:captured.id,errors});
}
