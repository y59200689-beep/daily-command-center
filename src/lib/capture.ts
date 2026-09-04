export type CaptureKind = "task"|"note"|"idea"|"decision"|"followup"|"inbox";
export type ParsedCapture = { kind:CaptureKind; text:string; confidence:number; due?:string };

export function parseCapture(input:string, now=new Date()):ParsedCapture{
  const value=input.trim(); const lower=value.toLowerCase();
  const prefixes:[RegExp,CaptureKind,number][]=[[/^task\s+/i,"task",.98],[/^note\s+/i,"note",.98],[/^idea\s+/i,"idea",.98],[/^decision\s+/i,"decision",.98],[/^follow[ -]?up(?:\s+with)?\s+/i,"followup",.96]];
  const match=prefixes.find(([pattern])=>pattern.test(value));
  if(!match)return{kind:"inbox",text:value,confidence:.35};
  const [pattern,kind,confidence]=match;let text=value.replace(pattern,"").trim();let due:string|undefined;
  if(/\btomorrow\b/i.test(text)){const next=new Date(now);next.setDate(next.getDate()+1);next.setHours(9,0,0,0);due=next.toISOString();text=text.replace(/\btomorrow\b/i,"").trim();}
  else {const days=["sunday","monday","tuesday","wednesday","thursday","friday","saturday"];const day=days.findIndex((name)=>lower.includes(name));if(day>=0){const next=new Date(now);let delta=(day-next.getDay()+7)%7;if(delta===0)delta=7;next.setDate(next.getDate()+delta);next.setHours(9,0,0,0);due=next.toISOString();text=text.replace(new RegExp(`\\b${days[day]}\\b`,"i"),"").trim();}}
  return{kind,text,confidence,due};
}
