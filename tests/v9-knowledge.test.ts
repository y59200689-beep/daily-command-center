import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { decisionReadiness, rankResearchQueue, sourceFreshness, topicHealth } from "../src/lib/knowledge";

test("V9 freshness is explicit and never invents a universal expiry",()=>{assert.equal(sourceFreshness(null,"2026-09-07"),"no_rule");assert.equal(sourceFreshness("2026-09-06","2026-09-07"),"stale");assert.equal(sourceFreshness("2026-09-14","2026-09-07"),"review_soon");assert.equal(sourceFreshness("2026-10-14","2026-09-07"),"current");});
test("V9 topic health and Research Next are deterministic and bounded",()=>{assert.equal(topicHealth({findings:1,supported:1,contradictions:1,openQuestions:0,staleSources:0},"2026-09-07"),"contradictory");assert.equal(topicHealth({findings:1,supported:1,contradictions:0,openQuestions:0,staleSources:0},"2026-09-07"),"well_supported");assert.equal(rankResearchQueue(Array.from({length:10},(_,id)=>({id:String(id),title:String(id),reason:"",route:"/knowledge",score:id}))).length,7);});
test("V9 decision readiness exposes missing or contradictory evidence without choosing a decision",()=>{assert.equal(decisionReadiness({findings:0,supporting:0,contradicting:0,openQuestions:0}),"needs_evidence");assert.equal(decisionReadiness({findings:1,supporting:1,contradicting:1,openQuestions:0}),"contradictory_evidence");assert.equal(decisionReadiness({findings:1,supporting:1,contradicting:0,openQuestions:0}),"ready_to_decide");});
test("V9 migration is additive, indexed, owner-scoped, and private",async()=>{const source=await readFile(new URL("../supabase/migrations/20260907113000_v9_knowledge_research_operating_system.sql",import.meta.url),"utf8");for(const table of["research_topics","knowledge_sources","research_findings","finding_evidence","research_questions","knowledge_collections","knowledge_entity_links","knowledge_relations","research_briefs","watch_entities","watch_updates"])assert.match(source,new RegExp(`create table if not exists ${table}`));assert.match(source,/enable row level security/);assert.match(source,/user_id=\(select auth.uid\(\)\)/);assert.ok(source.includes("^https?://"));});
test("V9 API and Knowledge Home preserve owner-scoped deterministic workflows",async()=>{const[home,api,ui]=await Promise.all([readFile(new URL("../src/app/api/knowledge/route.ts",import.meta.url),"utf8"),readFile(new URL("../src/app/api/knowledge/[resource]/route.ts",import.meta.url),"utf8"),readFile(new URL("../src/features/knowledge/knowledge-home.tsx",import.meta.url),"utf8")]);for(const source of[home,api]){assert.match(source,/requireUser\(\)/);assert.match(source,/user_id/);}for(const text of["Research next","Active topics","Open questions","Recent findings","Stale knowledge","Watching"])assert.ok(ui.includes(text));assert.match(home,/rankResearchQueue/);});
test("V9 evidence API validates both owned sides and permits every evidence relation",async()=>{const api=await readFile(new URL("../src/app/api/knowledge/[resource]/route.ts",import.meta.url),"utf8");for(const relation of["supports","contradicts","context","weak_support"])assert.ok(api.includes(`\"${relation}\"`));assert.match(api,/owned\(supabase,userId,"research_findings",input.finding_id\)/);assert.match(api,/owned\(supabase,userId,"knowledge_sources",input.source_id\)/);});
test("V9 evidence detail has add, relation-change, removal, grouping, and calm contradiction actions",async()=>{const ui=await readFile(new URL("../src/features/knowledge/knowledge-detail.tsx",import.meta.url),"utf8");for(const text of["Add evidence","Change relation","Remove","Supporting evidence","Contradictory evidence","weak_support","supported","mixed","contradicted","superseded"])assert.ok(ui.includes(text));assert.match(ui,/method: editingEvidence \? "PATCH" : "POST"/);assert.match(ui,/method: "DELETE"/);assert.match(ui,/await load\(\)/);});
test("V9 question findings remain owner-scoped and Topic context preserves compact question actions",async()=>{const[route,ui]=await Promise.all([readFile(new URL("../src/app/api/knowledge/questions/[id]/findings/route.ts",import.meta.url),"utf8"),readFile(new URL("../src/features/knowledge/topic-detail.tsx",import.meta.url),"utf8")]);assert.match(route,/research_questions/);assert.match(route,/research_findings/);assert.match(route,/eq\("user_id", userId\)/);for(const text of["Notes","Researching","question.answer_summary"])assert.ok(ui.includes(text));});
test("V9 canonical Note bridge validates target and note ownership before links mutate",async()=>{const[route,ui]=await Promise.all([readFile(new URL("../src/app/api/knowledge/notes/route.ts",import.meta.url),"utf8"),readFile(new URL("../src/features/knowledge/knowledge-detail.tsx",import.meta.url),"utf8")]);for(const text of["research_topic","knowledge_source","research_finding","research_question","note_links"])assert.ok(route.includes(text));assert.ok(ui.includes("Create linked note"));assert.match(route,/verifyTarget/);assert.match(route,/eq\("user_id", userId\)/);assert.match(route,/is\("deleted_at", null\)/);});
test("V9 source edits keep URL safety and normalized review timestamps",async()=>{const[route,ui]=await Promise.all([readFile(new URL("../src/app/api/knowledge/[resource]/[id]/route.ts",import.meta.url),"utf8"),readFile(new URL("../src/features/knowledge/knowledge-detail.tsx",import.meta.url),"utf8")]);assert.match(route,/\^https\?:\\\/\\\//);assert.ok(ui.includes("Mark reviewed"));assert.ok(ui.includes("new Date(output.accessed_at).toISOString()"));assert.ok(ui.includes("datetime-local"));});
test("V9 evidence and question controls retain mobile-safe semantic controls",async()=>{const[ui,css]=await Promise.all([readFile(new URL("../src/features/knowledge/knowledge-detail.tsx",import.meta.url),"utf8"),readFile(new URL("../src/app/globals.css",import.meta.url),"utf8")]);assert.match(ui,/aria-label=\{`Change relation/);assert.match(ui,/aria-label=\{`Remove/);assert.ok(ui.includes("simple-form"));assert.ok(css.includes("knowledge-section"));assert.ok(css.includes("@media"));});
test("V9 collections and briefs reuse owner-scoped references without copying knowledge",async()=>{const[api,ui]=await Promise.all([readFile(new URL("../src/app/api/knowledge/[resource]/route.ts",import.meta.url),"utf8"),readFile(new URL("../src/features/knowledge/knowledge-library.tsx",import.meta.url),"utf8")]);for(const type of["topic","source","finding","note","file","decision","brief"])assert.ok(ui.includes(`\"${type}\"`));assert.match(api,/ownedType\(supabase,userId,input.item_type,input.item_id/);assert.match(api,/ownedType\(supabase,userId,input.knowledge_type,input.knowledge_id/);assert.ok(ui.includes("No references in this collection."));});
test("V9 Topic and Question Notes use the canonical owner-scoped Note bridge with immediate refresh",async()=>{const[topic,notes]=await Promise.all([readFile(new URL("../src/features/knowledge/topic-detail.tsx",import.meta.url),"utf8"),readFile(new URL("../src/app/api/knowledge/notes/route.ts",import.meta.url),"utf8")]);for(const text of["Create Note","Link existing","Unlink","/notes/","Search Notes","targetType=\"topic\"","targetType=\"question\""])assert.ok(topic.includes(text));assert.match(topic,/await refresh\(\)/);assert.match(notes,/verifyTarget/);assert.match(notes,/eq\("user_id", userId\)/);});
test("V9 relation modal supports every textual relation with owner-scoped target selection",async()=>{const[topic,api]=await Promise.all([readFile(new URL("../src/features/knowledge/topic-detail.tsx",import.meta.url),"utf8"),readFile(new URL("../src/app/api/knowledge/[resource]/route.ts",import.meta.url),"utf8")]);for(const type of["related","supports","contradicts","derived_from","supersedes","depends_on","impacts","about"])assert.ok(topic.includes(`\"${type}\"`));for(const target of["topic","source","finding","question","brief"])assert.ok(topic.includes(`\"${target}\"`));assert.match(api,/ownedType\(supabase,userId,input.from_type,input.from_id/);assert.match(api,/ownedType\(supabase,userId,input.to_type,input.to_id/);});

test("V9 relation display preserves direction and renders all 8 textual verbs",async()=>{
  const[links,css]=await Promise.all([readFile(new URL("../src/features/knowledge/knowledge-links.tsx",import.meta.url),"utf8"),readFile(new URL("../src/app/globals.css",import.meta.url),"utf8")]);
  for(const verb of["Related to","Supports","Contradicts","Derived from","Supersedes","Depends on","Impacts","About"])assert.ok(links.includes(`\"${verb}\"`));
  assert.ok(links.includes("Outgoing relations"));
  assert.ok(links.includes("Incoming relations"));
  assert.match(links,/incoming \? words\(otherType\) : \"This record\"/);
  assert.match(links,/incoming \? \"This record\" : words\(otherType\)/);
  assert.match(links,/detailRoute\(otherType, otherId\)/);
  assert.ok(css.includes(".knowledge-relation-row"));
  assert.ok(css.includes(".knowledge-relation-verb"));
});

test("V9 relation lifecycle supports update, remove, immediate refresh, and ownership validation",async()=>{
  const[links,apiPost,apiPatch]=await Promise.all([
    readFile(new URL("../src/features/knowledge/knowledge-links.tsx",import.meta.url),"utf8"),
    readFile(new URL("../src/app/api/knowledge/[resource]/route.ts",import.meta.url),"utf8"),
    readFile(new URL("../src/app/api/knowledge/[resource]/[id]/route.ts",import.meta.url),"utf8")
  ]);
  assert.match(links,/method: editing \? \"PATCH\" : \"POST\"/);
  assert.match(links,/method: \"DELETE\"/);
  assert.match(links,/await load\(\)/);
  assert.match(apiPost,/ownedType\(supabase,userId,input.from_type,input.from_id,knowledgeTables\)/);
  assert.match(apiPost,/ownedType\(supabase,userId,input.to_type,input.to_id/);
  assert.match(apiPatch,/eq\(\"id\",id\)\.eq\(\"user_id\",userId\)/);
});

test("V9 relation and entity link controls are mounted on Topic, Source, Finding, Question, and Brief",async()=>{
  const[topic,detail,library]=await Promise.all([
    readFile(new URL("../src/features/knowledge/topic-detail.tsx",import.meta.url),"utf8"),
    readFile(new URL("../src/features/knowledge/knowledge-detail.tsx",import.meta.url),"utf8"),
    readFile(new URL("../src/features/knowledge/knowledge-library.tsx",import.meta.url),"utf8")
  ]);
  assert.ok(topic.includes('originType="topic"'));
  assert.ok(topic.includes('originType="question"'));
  assert.ok(detail.includes('originType="source"'));
  assert.ok(detail.includes('originType="finding"'));
  assert.ok(library.includes('originType="brief"'));
  assert.ok(topic.includes('<KnowledgeEntityLinksPanel originType="topic"'));
  assert.ok(detail.includes('<KnowledgeEntityLinksPanel originType="source"'));
  assert.ok(detail.includes('<KnowledgeEntityLinksPanel originType="finding"'));
  assert.ok(library.includes('<KnowledgeEntityLinksPanel originType="brief"'));
});

test("V9 decision research panel aggregates owner-scoped topics, findings, evidence, questions, and briefs with unlink support",async()=>{
  const[api,panel]=await Promise.all([
    readFile(new URL("../src/app/api/knowledge/decisions/[id]/route.ts",import.meta.url),"utf8"),
    readFile(new URL("../src/features/knowledge/decision-research-panel.tsx",import.meta.url),"utf8")
  ]);
  for(const table of["research_topics","research_findings","research_questions","research_briefs","finding_evidence"]){
    assert.ok(api.includes(table));
    assert.match(api,/eq\("user_id", userId\)/);
  }
  for(const group of["Linked topics","Key findings","Supporting evidence","Contradictory evidence","Open questions","Research briefs"]){
    assert.ok(panel.includes(group));
  }
  assert.ok(panel.includes("No research linked yet."));
  assert.ok(panel.includes("Link research"));
  assert.match(panel,/method: "DELETE"/);
  assert.match(panel,/await load\(\)/);
});

test("V9 decision readiness states and deterministic reasons remain un-opinionated and rule-based",()=>{
  assert.equal(decisionReadiness({findings:2,supporting:2,contradicting:0,openQuestions:0}),"ready_to_decide");
  assert.equal(decisionReadiness({findings:0,supporting:0,contradicting:0,openQuestions:0}),"needs_evidence");
  assert.equal(decisionReadiness({findings:2,supporting:1,contradicting:1,openQuestions:0}),"contradictory_evidence");
  assert.equal(decisionReadiness({findings:2,supporting:2,contradicting:0,openQuestions:1}),"open_questions_remain");
});

test("V9 entity-link selector supports all 15 entity types with owner isolation and human labels",async()=>{
  const[optionsRoute,linksPanel,apiPost]=await Promise.all([
    readFile(new URL("../src/app/api/knowledge/entity-options/route.ts",import.meta.url),"utf8"),
    readFile(new URL("../src/features/knowledge/knowledge-links.tsx",import.meta.url),"utf8"),
    readFile(new URL("../src/app/api/knowledge/[resource]/route.ts",import.meta.url),"utf8")
  ]);
  for(const type of["project","client","lead","opportunity","proposal","campaign","content","goal","decision","roadmap","product","supplier","trip","commitment","milestone"]){
    assert.ok(optionsRoute.includes(`\"${type}\"`));
    assert.ok(linksPanel.includes(`\"${type}\"`));
  }
  assert.match(optionsRoute,/eq\("user_id", userId\)/);
  assert.match(optionsRoute,/ilike/);
  assert.match(apiPost,/ownedType\(supabase,userId,input.entity_type,input.entity_id,entityTables\)/);
  assert.match(linksPanel,/method: "DELETE"/);
  assert.match(linksPanel,/await load\(\)/);
});

test("V9 Knowledge Home and navigation routes link directly to target objects and library entries",async()=>{
  const[homeApi,homeUi,topicUi]=await Promise.all([
    readFile(new URL("../src/app/api/knowledge/route.ts",import.meta.url),"utf8"),
    readFile(new URL("../src/features/knowledge/knowledge-home.tsx",import.meta.url),"utf8"),
    readFile(new URL("../src/features/knowledge/topic-detail.tsx",import.meta.url),"utf8")
  ]);
  assert.match(homeApi,/route: `\/knowledge\/topics\/\${item\.topic_id}#question-\${item\.id}`/);
  assert.match(homeApi,/route: `\/knowledge\/sources\/\${item\.id}`/);
  assert.match(homeApi,/route: `\/knowledge\/findings\/\${item\.id}`/);
  assert.match(homeApi,/route: `\/knowledge\/topics\/\${item\.id}`/);
  assert.ok(homeUi.includes('href="/knowledge/collections"'));
  assert.ok(homeUi.includes('href="/knowledge/briefs"'));
  assert.ok(topicUi.includes('window.location.hash.startsWith("#question-")'));
});

test("V9 mobile CSS stacks relations, decision panels, and entity selectors without horizontal overflow",async()=>{
  const css=await readFile(new URL("../src/app/globals.css",import.meta.url),"utf8");
  assert.ok(css.includes(".knowledge-relation-row{grid-template-columns:1fr;gap:8px}"));
  assert.ok(css.includes(".knowledge-decision-grid{grid-template-columns:1fr}"));
  assert.ok(css.includes(".knowledge-selector-search{grid-template-columns:1fr}"));
  assert.ok(css.includes(".knowledge-linked-row{align-items:flex-start;flex-direction:column}"));
});
