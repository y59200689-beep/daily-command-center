import type { Row } from "./repository";
const numeric = (v: unknown) => v == null || v === "" || !Number.isFinite(Number(v)) ? null : Number(v);
export function evaluateKpi(definition: Row, current: number | null, previous: number | null) {
 const target = numeric(definition.target), upper = numeric(definition.target_max), warning = numeric(definition.warning_threshold), critical = numeric(definition.critical_threshold);
 const range = definition.direction === "target_range", lower = definition.direction === "lower", informational = definition.direction === "informational";
 const distance = (n: number) => target === null || upper === null ? null : n < target ? target-n : n > upper ? n-upper : 0;
 const state = (n: number | null) => {
  if(n === null) return "unknown";
  if(informational) return "informational";
  if(range) { const d=distance(n);return d===null ? "unknown" : d===0 ? "within_thresholds" : critical!==null && d>critical ? "critical" : warning!==null && d>warning ? "attention" : "below_target"; }
  const crossed=(t:number|null)=>t!==null && (lower?n>t:n<t);
  return crossed(critical)?"critical":crossed(warning)?"attention":crossed(target)?"below_target":"within_thresholds";
 };
 const status=state(current), prior=state(previous), reached=current!==null && target!==null && !informational && (range?distance(current)===0:lower?current<=target:current>=target);
 const wasReached=previous!==null && target!==null && (range?distance(previous)===0:lower?previous<=target:previous>=target);
 const event=status==="critical"?"KPI_CRITICAL":status==="attention"?"KPI_WARNING":["critical","attention"].includes(prior)&&!["unknown","informational"].includes(status)?"KPI_RECOVERY":reached&&!wasReached?"KPI_TARGET_REACHED":null;
 const reason=current===null?"No observation in the current period.":informational?"Informational metric; no success or failure is inferred.":range?`Value ${current}; target range ${target ?? "unknown"}–${upper ?? "unknown"}. Thresholds are absolute distance outside that range.`:status==="critical"?`Value ${current} crossed the configured critical threshold ${critical}.`:status==="attention"?`Value ${current} crossed the configured warning threshold ${warning}.`:status==="below_target"?`Value ${current} has not reached target ${target}.`:"Within the configured thresholds; review the observation date.";
 const change=current===null||previous===null||previous===0?null:(current-previous)/Math.abs(previous)*100;
 const trend=current===null||previous===null?"unknown":current===previous?"unchanged":informational?(current>previous?"up":"down"):range?(distance(current)!<distance(previous)!?"improving":distance(current)!>distance(previous)!?"deteriorating":"unchanged"):(lower?current<previous:current>previous)?"improving":"deteriorating";
 const reference=range && current!==null && upper!==null && current>upper?upper:target;
 const variance=current===null||reference===null||reference===0||informational?null:range&&distance(current)===0?0:(current-reference)/Math.abs(reference)*100;
 return {status,current,previous,change,variance,reason,event,trend,target,targetMax:upper};
}
