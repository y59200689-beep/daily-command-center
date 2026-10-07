export const exerciseLanguages = {en:"English",fr:"Français",es:"Español",it:"Italiano",tr:"Türkçe",ru:"Русский",zh:"中文",hi:"हिन्दी",pl:"Polski",ko:"한국어"} as const;
export type ExerciseLanguage = keyof typeof exerciseLanguages;
export type Exercise = {id:string;name:string;bodyPart:string;equipment:string;target:string;secondaryMuscles:string[];steps:Partial<Record<ExerciseLanguage,string[]>>};
export type ExerciseSummary = Omit<Exercise,"steps">;
export function filterExercises(rows:Exercise[], filters:{q?:string;bodyPart?:string;equipment?:string;target?:string}) {
 const query=(filters.q??"").trim().toLocaleLowerCase();
 return rows.filter(row=>(!filters.bodyPart||row.bodyPart===filters.bodyPart)&&(!filters.equipment||row.equipment===filters.equipment)&&(!filters.target||row.target===filters.target)&&(!query||[row.name,row.target,row.bodyPart,row.equipment,...row.secondaryMuscles].some(text=>text.toLocaleLowerCase().includes(query))));
}
