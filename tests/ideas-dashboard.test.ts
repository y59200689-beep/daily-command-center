import test from 'node:test';
import assert from 'node:assert/strict';
import { filterIdeas, type Idea } from '../src/lib/ideas-dashboard';
const ideas:Idea[]=[{id:'a',title:'Guide',description:'Radiology ideas',category:'Marketing',potential:'high',status:'ready',project_id:null,created_at:'2026-01-01',updated_at:'2026-03-01'},{id:'b',title:'Automation',description:null,category:'Operations',potential:'medium',status:'captured',project_id:null,created_at:'2026-02-01',updated_at:'2026-04-01'}];
test('idea filters combine search, category, potential and stage without mutating source',()=>{assert.deepEqual(filterIdeas(ideas,'radiology','Marketing','ready','high','updated').map(i=>i.id),['a']);assert.equal(filterIdeas(ideas,'','Marketing','ready','medium','updated').length,0);assert.deepEqual(ideas.map(i=>i.id),['a','b']);});
test('idea sorting supports updated, oldest and name with missing descriptions',()=>{assert.deepEqual(filterIdeas(ideas,'','all','all','all','updated').map(i=>i.id),['b','a']);assert.deepEqual(filterIdeas(ideas,'','all','all','all','oldest').map(i=>i.id),['a','b']);assert.deepEqual(filterIdeas(ideas,'','all','all','all','name').map(i=>i.id),['b','a']);});
