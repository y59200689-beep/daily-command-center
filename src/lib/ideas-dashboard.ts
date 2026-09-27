export type Idea = { id:string; title:string; description:string|null; category:string|null; potential:string|null; status:string; project_id:string|null; created_at:string; updated_at:string };
export const ideaStages = ["captured", "exploring", "drafting", "ready"] as const;
export const ideaLabel = (value:string) => value === "captured" ? "Capture" : value.replace(/_/g," ").replace(/\b\w/g,letter=>letter.toUpperCase());
export function filterIdeas(ideas:Idea[],query:string,category:string,status:string,potential:string,sort:string) {
 const search=query.trim().toLocaleLowerCase();
 return ideas.filter(idea=>(!search||[idea.title,idea.description,idea.category,idea.potential].some(value=>value?.toLocaleLowerCase().includes(search)))&&(category==="all"||idea.category===category)&&(status==="all"||idea.status===status)&&(potential==="all"||idea.potential===potential)).sort((a,b)=>sort==="name"?a.title.localeCompare(b.title):sort==="oldest"?a.created_at.localeCompare(b.created_at):b.updated_at.localeCompare(a.updated_at));
}
