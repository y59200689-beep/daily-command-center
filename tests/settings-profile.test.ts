import test from "node:test";
import assert from "node:assert/strict";
import { settingsProfileInput } from "../src/lib/settings-profile";
test("profile changes trim names and accept valid regional defaults",()=>{
 assert.deepEqual(settingsProfileInput.parse({display_name:"  Youssef  "}),{display_name:"Youssef"});
 assert.equal(settingsProfileInput.safeParse({timezone:"Africa/Casablanca",week_starts_on:1}).success,true);
});
test("profile changes reject invalid time zones, week boundaries, and empty names",()=>{
 for(const input of [{timezone:"not/a/timezone"},{week_starts_on:7},{week_starts_on:-1},{week_starts_on:1.5},{display_name:"  "},{}])assert.equal(settingsProfileInput.safeParse(input).success,false);
});
test("profile endpoint input cannot write identity or authentication fields",()=>{
 for(const key of ["id","email","password","role","preferences"])assert.equal(settingsProfileInput.safeParse({display_name:"Valid",[key]:"unexpected"}).success,false);
});
