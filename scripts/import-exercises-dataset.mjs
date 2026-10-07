import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
const source=process.argv[2];if(!source)throw new Error('Pass the path to a reviewed exercises-dataset checkout.');
const rows=JSON.parse(fs.readFileSync(path.join(source,'data/exercises.json'),'utf8'));
const ids=new Set();const exercises=rows.map(row=>{
 if(typeof row.id!=='string'||ids.has(row.id)||!row.name||!row.instructions?.en)throw new Error('Invalid or duplicate exercise.');ids.add(row.id);
 return {id:row.id,name:row.name,bodyPart:row.body_part,equipment:row.equipment,target:row.target,secondaryMuscles:row.secondary_muscles??[],steps:Object.fromEntries(Object.entries(row.instructions).map(([language,text])=>[language,row.instruction_steps?.[language]?.length?row.instruction_steps[language]:[text]]))};
});
const dest='src/data/exercises';fs.mkdirSync(dest,{recursive:true});fs.writeFileSync(path.join(dest,'catalog.json'),JSON.stringify(exercises));
for(const file of ['LICENSE','NOTICE.md'])fs.copyFileSync(path.join(source,file),path.join(dest,file));
const commit=execFileSync('git',['-C',source,'rev-parse','HEAD'],{encoding:'utf8'}).trim();
fs.writeFileSync(path.join(dest,'provenance.json'),JSON.stringify({repository:'https://github.com/hasaneyldrm/exercises-dataset',commit,count:exercises.length,mediaIncluded:false},null,2)+'\n');
console.log(`Imported ${exercises.length} exercises; no third-party media or executable code included.`);
