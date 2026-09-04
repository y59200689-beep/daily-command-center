"use client";
import { useCallback,useState } from "react";
import { useDeferredEffect } from "@/lib/use-deferred-effect";
export function InboxBadge(){const[count,setCount]=useState(0);const load=useCallback(async()=>{try{const response=await fetch("/api/entities/inbox",{cache:"no-store"});const data=await response.json();if(response.ok)setCount(data.records?.length??0)}catch{}},[]);useDeferredEffect(useCallback(()=>{void load()},[load]));return count?<small>{count}</small>:null}
