import {workoutRead,workoutWrite} from "@/lib/workout-api";
export function GET(request:Request){return workoutRead(request,"routines");}
export function POST(request:Request){return workoutWrite(request,"routines");}
