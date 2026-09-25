import test from "node:test";
import assert from "node:assert/strict";
import { evaluateKpi } from "../src/lib/founder-os/kpi";
import { businessStates, currencyTotals } from "../src/lib/founder-os/business";
import { resourceSchema } from "../src/lib/founder-os/resources";
const today="2026-09-24";
test("higher/lower KPI boundaries, recovery and target events use direction",()=>{
 const d={id:"k",direction:"higher",target:100,warning_threshold:80,critical_threshold:50};
 assert.equal(evaluateKpi(d,49,90).event,"KPI_CRITICAL");
 assert.equal(evaluateKpi(d,50,90).event,"KPI_WARNING");
 assert.equal(evaluateKpi(d,80,49).event,"KPI_RECOVERY");
 assert.equal(evaluateKpi(d,100,90).event,"KPI_TARGET_REACHED");
 assert.equal(evaluateKpi(d,110,105).event,null);
 assert.equal(evaluateKpi({...d,direction:"lower",target:10,warning_threshold:20,critical_threshold:30},25,40).trend,"improving");
});
test("range uses distance beyond either edge; informational never alerts",()=>{
 const d={id:"r",direction:"target_range",target:10,target_max:20,warning_threshold:2,critical_threshold:5};
 assert.equal(evaluateKpi(d,16,30).event,"KPI_RECOVERY");
 assert.equal(evaluateKpi(d,26,20).event,"KPI_CRITICAL");
 assert.equal(evaluateKpi(d,7,10).event,"KPI_WARNING");
 assert.equal(evaluateKpi(d,18,17).trend,"unchanged");
 assert.equal(evaluateKpi(d,18,17).variance,0);
 assert.equal(evaluateKpi(d,26,17).variance,30);
 assert.equal(evaluateKpi({...d,direction:"informational"},999,10).event,null);
 assert.equal(evaluateKpi({...d,direction:"informational"},999,10).variance,null);
});
test("missing and zero baselines never invent a percentage",()=>{
 assert.equal(evaluateKpi({id:"a",target:0},10,0).change,null);
 assert.equal(evaluateKpi({id:"a",target:0},10,0).variance,null);
 assert.equal(evaluateKpi({id:"a"},null,10).status,"unknown");
 assert.equal(evaluateKpi({id:"a",target:150000},120000,108000).variance,-20);
 assert.ok(Math.abs(evaluateKpi({id:"a"},120000,108000).change!-11.111111)<.001);
});
test("business currencies, attribution, reasons and unavailable sources stay explicit",()=>{
 const data={companies:[{id:"a",name:"A",active:true},{id:"b",name:"B",active:true}],orders:[{id:"o1",company_id:"a",currency:"MAD",total_amount:100,created_at:today,status:"delivered"},{id:"o2",company_id:"a",currency:"USD",total_amount:20,created_at:today,status:"delivered"},{id:"o3",company_id:"b",currency:"MAD",total_amount:900,created_at:today,status:"delivered"}],incidents:[{id:"i",company_id:"a",status:"detected",severity:"critical"}],issues:[],systems:[]};
 const [a,b]=businessStates(data,[],today);
 assert.deepEqual(a.sections.Financial.orderValue,{MAD:100,USD:20});assert.equal(a.status,"CRITICAL");assert.match(a.reasons.join(" "),/production incidents/);assert.equal(b.status,"STABLE");
 assert.equal(businessStates(data,[],today,[{source:"invoices",status:"unavailable",count:0}])[1].status,"INCOMPLETE");
 assert.deepEqual(currencyTotals([{id:"1",currency:"MAD",amount:5},{id:"2",currency:"USD",amount:7}],"amount"),{MAD:5,USD:7});
});
test("business state derives blocked edges and unowned systems without numeric score",()=>{
 const [b]=businessStates({companies:[{id:"c",name:"Venture"}],systems:[{id:"s",company_id:"c",criticality:"critical",status:"active",renewal_date:"2026-09-30"}],dependencies:[{id:"d",source_id:"s",state:"blocked"}]},[],today);
 assert.equal(b.status,"ATTENTION");assert.equal(b.sections.Operations.blockedDependencies,1);assert.equal(b.sections.Technology.unownedCritical,1);assert.equal("score" in b,false);
});
test("KPI API rejects arbitrary ownership and table fields",()=>{
 assert.throws(()=>resourceSchema("kpis").parse({name:"KPI",category:"revenue",unit:"MAD",direction:"higher",source:"manual",frequency:"monthly",user_id:"bad"}));
 assert.equal(resourceSchema("kpis",true).parse({direction:"informational"}).direction,"informational");
});

test("critical system business state always includes the concrete failure reason",()=>{
 const [b]=businessStates({companies:[{id:"c",name:"Business"}],systems:[{id:"s",name:"Payments",company_id:"c",owner_label:"Operator",status:"unavailable",criticality:"critical"}]},[],today);
 assert.equal(b.status,"CRITICAL");assert.match(b.reasons.join(" "),/Payments: recorded unavailable/);
});
