import test from 'node:test';
import assert from 'node:assert/strict';
import {fitnessPreview,fitnessTotals,periodActivities,weekStart,targetActual,dayStreak,dayShift} from '../src/lib/fitness-dashboard';
test('fitness totals isolate workouts and burned calories from steps and nutrition',()=>{const sample=fitnessPreview('2026-09-27'),rows=periodActivities(sample.activities,'2026-09-21'),total=fitnessTotals(rows);assert.equal(total.sessions,5);assert.equal(total.steps,38500);assert.equal(total.calories,1575);assert.equal(total.volume,6370);assert.equal(rows.length,18);assert.equal(fitnessTotals(periodActivities(sample.activities,'2026-08-01')).sessions,0)});
test('fitness targets measure recorded sessions, daily steps, and unique nutrition days',()=>{const s=fitnessPreview('2026-09-27'),rows=periodActivities(s.activities,'2026-09-21');assert.deepEqual(s.targets.map(t=>targetActual(t,rows)),[3,2,38500,6]);const nutrition=s.targets[3];assert.equal(targetActual(nutrition,[...rows,rows.find(r=>r.source==='myfitnesspal')!]),6)});
test('week boundaries and streaks cross month boundaries and exclude stale runs',()=>{assert.equal(weekStart('2026-10-01'),'2026-09-28');assert.equal(weekStart('2026-10-01',0),'2026-09-27');assert.equal(dayShift('2026-03-01',-1),'2026-02-28');const a=fitnessPreview('2026-09-27').activities;assert.equal(dayStreak(a,'2026-09-27'),21);assert.equal(dayStreak(a.filter(r=>r.activity_type==='Running'),'2026-09-27'),0)});

test('weekly cards retain all four categories without creating saved targets',async()=>{
 const {weeklyFitnessCards}=await import('../src/lib/fitness-dashboard');
 const target={id:'saved-run',activity_type:'Running',target_type:'sessions',target_value:5,period:'week',active:true};
 const cards=weeklyFitnessCards([target]);
 assert.deepEqual(cards.map(c=>c.target.activity_type),['Running','Gym','Steps','Nutrition']);
 assert.deepEqual(cards.map(c=>c.hasTarget),[true,false,false,false]);
 assert.equal(cards[0].target,target);
 assert.equal(cards[1].target.target_value,0);
 assert.equal(weeklyFitnessCards([]).length,4);
 assert.equal(weeklyFitnessCards([{...target,active:false}])[0].hasTarget,false);
});

test('Monday starts fresh for every activity while preserving the previous week',()=>{
 const sample=fitnessPreview('2026-09-27');
 const swimming={id:'swim',activity_type:'Swimming',target_type:'sessions',target_value:5,period:'week',active:true};
 const activities=[...sample.activities,{id:'sunday-swim',activity_type:'Swimming',date:'2026-09-27'}];
 const targets=[...sample.targets,swimming];
 const previous=periodActivities(activities,weekStart('2026-09-27'));
 const monday=periodActivities(activities,weekStart('2026-09-28'));
 assert.deepEqual(targets.map(t=>targetActual(t,monday)),[0,0,0,0,0]);
 assert.deepEqual(targets.map(t=>targetActual(t,previous)),[3,2,38500,6,1]);
 assert.equal(targetActual(swimming,periodActivities([...activities,{id:'monday-swim',activity_type:'Swimming',date:'2026-09-28'}],'2026-09-28')),1);
});

test('fitness day uses local midnight rather than the UTC date',async()=>{
 const {fitnessLocalDay}=await import('../src/lib/fitness-dashboard');
 const previous=process.env.TZ;
 try{
  process.env.TZ='Africa/Casablanca';
  assert.equal(fitnessLocalDay(new Date('2026-09-27T23:01:00Z')),'2026-09-28');
  assert.equal(weekStart(fitnessLocalDay(new Date('2026-09-27T23:01:00Z'))),'2026-09-28');
 }finally{if(previous===undefined)delete process.env.TZ;else process.env.TZ=previous;}
});
