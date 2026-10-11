import { z } from "zod";
export const boardInput = z.object({
  id: z.uuid(), projectId: z.uuid(), title: z.string().trim().min(1).max(160),
  taskIds: z.array(z.uuid()).max(100).transform(ids => [...new Set(ids)]),
  scene: z.object({ elements: z.array(z.record(z.string(), z.unknown())).max(3000), appState: z.record(z.string(), z.unknown()), files: z.record(z.string(), z.unknown()) }),
  version: z.number().int().nonnegative(), archived: z.boolean().default(false),
});
export type BoardInput = z.infer<typeof boardInput>;
export type Board = { id:string; project_id:string; title:string; task_ids:string[]; scene:BoardInput['scene']; version:number; archived:boolean; updated_at:string };
