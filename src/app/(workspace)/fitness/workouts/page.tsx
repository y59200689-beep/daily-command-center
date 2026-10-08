import {WorkoutWorkspace} from "@/features/fitness/workout-workspace";
export const metadata={title:"Gym workouts"};
export default async function Page({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){const params=await searchParams;return <WorkoutWorkspace initialView={params.view==="history"?"history":"routines"} initialExercises={typeof params.exercises==="string"?params.exercises.split(",").slice(0,20):[]}/>;}
