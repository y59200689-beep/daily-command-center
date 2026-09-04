import test from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import { setDailyPriority } from "../src/lib/today";

test("clearing an existing daily win removes its priority without creating a plan", async () => {
  const operations:string[]=[];
  const client={
    from(table:string){
      let operation="select";
      const query={
        select(){operation="select";return query},
        delete(){operation="delete";operations.push(`delete:${table}`);return query},
        upsert(){operations.push(`upsert:${table}`);return query},
        eq(){return query},
        is(){return query},
        maybeSingle(){
          if(table==="tasks")return Promise.resolve({data:{id:"task-1"},error:null});
          if(table==="daily_plans")return Promise.resolve({data:{id:"plan-1"},error:null});
          return Promise.resolve({data:null,error:null});
        },
        then(resolve:(value:{data:null;error:null})=>unknown){
          operations.push(`${operation}:await:${table}`);
          return Promise.resolve({data:null,error:null}).then(resolve);
        },
      };
      return query;
    },
  } as unknown as SupabaseClient;

  await setDailyPriority(client,"user-1","task-1",null);

  assert.deepEqual(operations,["delete:daily_priorities","delete:await:daily_priorities"]);
});
