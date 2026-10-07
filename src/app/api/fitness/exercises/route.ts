import {exercises,exerciseFacets} from "@/lib/exercise-catalog-server";
import {exerciseLanguages,filterExercises,type ExerciseLanguage} from "@/lib/exercise-catalog";
export async function GET(request:Request) {
 const params=new URL(request.url).searchParams;
 const headers={"Cache-Control":"private, no-store"};
 const id=params.get("id");
 if(id){const exercise=exercises.find(row=>row.id===id);if(!exercise)return Response.json({error:"Exercise not found."},{status:404,headers});const language=params.get("language")??"en";if(!Object.hasOwn(exerciseLanguages,language))return Response.json({error:"Unsupported instruction language."},{status:400,headers});const selected=language as ExerciseLanguage;return Response.json({exercise:{...exercise,steps:exercise.steps[selected]??exercise.steps.en??[],language:exercise.steps[selected]?selected:"en"}},{headers});}
 const page=Number(params.get("page")??"1");if(!Number.isSafeInteger(page)||page<1)return Response.json({error:"Invalid page."},{status:400,headers});
 const rows=filterExercises(exercises,{q:(params.get("q")??"").slice(0,200),bodyPart:params.get("bodyPart")??"",equipment:params.get("equipment")??"",target:params.get("target")??""});
 const currentPage=Math.min(page,Math.max(1,Math.ceil(rows.length/24)));
 const items=rows.slice((currentPage-1)*24,currentPage*24).map(({steps,...row})=>{void steps;return row;});
 return Response.json({items,total:rows.length,page:currentPage,pageSize:24,facets:exerciseFacets,catalogCount:exercises.length},{headers});
}
