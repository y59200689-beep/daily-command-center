import {workoutRead,workoutWrite} from "@/lib/workout-api";
export function GET(request:Request){return workoutRead(request,"workouts");}
export function POST(request:Request){return workoutWrite(request,"workouts");}
