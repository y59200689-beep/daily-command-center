import test from "node:test";
import assert from "node:assert/strict";
import {filterPrompts,previewPrompts} from "../src/lib/prompts-dashboard";
test("prompt search combines instruction text, category, and favorites",()=>{assert.equal(filterPrompts(previewPrompts,"TARGET_AUDIENCE","Writing","favorites","updated")[0]?.title,"SEO Blog Writer");assert.equal(filterPrompts(previewPrompts,"client","Marketing","all","updated").length,0);assert.equal(filterPrompts(previewPrompts,"   ","all","favorites","updated").length,1)});
test("prompt sort uses recorded usage without mutating source records",()=>{const original=previewPrompts.map(r=>r.id);const sorted=filterPrompts(previewPrompts,"","all","all","uses");assert.deepEqual(sorted.map(r=>r.usage_count),[142,91,87,64,52,38]);assert.deepEqual(previewPrompts.map(r=>r.id),original)});
