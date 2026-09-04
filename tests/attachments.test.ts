import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { attachmentStoragePath, safeAttachmentFilename, validateAttachmentContents, validateAttachmentMetadata } from "../src/lib/attachment-policy";
import { getOwnedAttachment, requireOwnedAttachmentEntity } from "../src/lib/attachments";

function fakeClient(rows: Record<string, Array<Record<string, unknown>>>) {
  return { from(table: string) {
    const filters: Array<[string, unknown]> = [];
    const builder = {
      select() { return builder; },
      eq(column: string, value: unknown) { filters.push([column, value]); return builder; },
      is(column: string, value: unknown) { filters.push([column, value]); return builder; },
      async maybeSingle() { return { data: rows[table]?.find((row) => filters.every(([column, value]) => row[column] === value)) ?? null, error: null }; },
    };
    return builder;
  } } as unknown as SupabaseClient<Record<string, unknown>>;
}

test("attachment metadata enforces the 6 MB limit and supported MIME types", () => {
  assert.equal(validateAttachmentMetadata({ name: "brief.pdf", type: "application/pdf", size: 1024 }), null);
  assert.equal(validateAttachmentMetadata({ name: "brief.pdf", type: "application/pdf", size: 6 * 1024 * 1024 + 1 }), "File is too large. Maximum size is 6 MB.");
  assert.equal(validateAttachmentMetadata({ name: "payload.html", type: "text/html", size: 10 }), "This file type is not supported.");
  assert.equal(validateAttachmentMetadata({ name: "photo.jpg", type: "text/plain", size: 10 }), "This file type is not supported.");
});

test("server validation checks file signatures instead of trusting extension and MIME alone", async () => {
  const validPdf = new File([new Uint8Array([0x25,0x50,0x44,0x46,0x2d,0x31])], "invoice.pdf", { type: "application/pdf" });
  const disguisedPdf = new File(["not a pdf"], "invoice.pdf", { type: "application/pdf" });
  assert.equal(await validateAttachmentContents(validPdf), null);
  assert.equal(await validateAttachmentContents(disguisedPdf), "The file contents do not match the selected file type.");
});

test("storage paths are owner-scoped and filenames cannot traverse paths", () => {
  assert.equal(safeAttachmentFilename("../../client brief.pdf"), "client-brief.pdf");
  assert.equal(attachmentStoragePath("user-a", "project", "project-a", "../../client brief.pdf", "object-a"), "user-a/project/project-a/object-a-client-brief.pdf");
});

test("only the owner can attach to an entity or retrieve its attachment record", async () => {
  const client = fakeClient({
    tasks: [{ id: "task-a", user_id: "user-a", deleted_at: null }],
    attachments: [{ id: "file-a", user_id: "user-a", deleted_at: null, entity_type: "task", entity_id: "task-a" }],
  });
  assert.equal(await requireOwnedAttachmentEntity(client, "user-a", "task", "task-a"), true);
  assert.equal(await requireOwnedAttachmentEntity(client, "user-b", "task", "task-a"), false);
  assert.equal((await getOwnedAttachment(client, "user-a", "file-a"))?.id, "file-a");
  assert.equal(await getOwnedAttachment(client, "user-b", "file-a"), null);
});

test("migration enforces entity integrity, private storage ownership, and attachment search", () => {
  const migration = readFileSync(path.join(process.cwd(), "supabase/migrations/20260904171619_attachment_system.sql"), "utf8");
  assert.match(migration, /update storage\.buckets set public=false,file_size_limit=6291456/);
  assert.match(migration, /attachments_storage_read[\s\S]+to authenticated[\s\S]+storage\.foldername\(name\)\)\[1\]=\(select auth\.uid\(\)\)::text/);
  assert.match(migration, /attachments_storage_delete[\s\S]+to authenticated/);
  assert.match(migration, /create trigger attachments_owned_entity[\s\S]+enforce_attachment_entity_owner/);
  assert.match(migration, /Attachment target is not owned by this user/);
  assert.match(migration, /union all[\s\S]+select 'attachment',a\.id,a\.file_name/);
});

test("signed URL and deletion routes resolve rows through authenticated ownership", () => {
  const route = readFileSync(path.join(process.cwd(), "src/app/api/attachments/[id]/route.ts"), "utf8");
  const repository = readFileSync(path.join(process.cwd(), "src/lib/attachments.ts"), "utf8");
  assert.match(route, /await requireUser\(\)/);
  assert.match(route, /getOwnedAttachment\(supabase, userId, id\)/);
  assert.match(repository, /\.eq\("user_id", userId\)\.is\("deleted_at", null\)/);
  assert.match(route, /createSignedUrl\(attachment\.storage_path, 60\)/);
  assert.match(route, /removeOwnedAttachment\(supabase, userId, attachment\)/);
});
