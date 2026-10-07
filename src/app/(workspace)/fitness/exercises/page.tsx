import {ExerciseLibrary} from "@/features/fitness/exercise-library";
export const metadata={title:"Exercise library"};
export default async function Page({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){const params=await searchParams;const value=(key:string)=>typeof params[key]==="string"?String(params[key]):"";const page=Number(value("page")||1);return <ExerciseLibrary initial={{q:value("q").slice(0,200),bodyPart:value("bodyPart"),equipment:value("equipment"),target:value("target"),page:Number.isSafeInteger(page)&&page>0?page:1}}/>;}
