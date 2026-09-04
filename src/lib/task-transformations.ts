import type { Task } from "@/lib/types";

export function toggleTaskComplete(task: Task, at = new Date()) {
  return { ...task, completed: !task.completed, status: task.completed ? "planned" as const : "completed" as const, completedAt: task.completed ? null : at.toISOString() };
}

export function moveToTomorrow(task: Task, today = new Date()) {
  const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
  return { ...task, dueDate: tomorrow.toISOString().slice(0, 10), status: task.status === "inbox" ? "planned" as const : task.status };
}

export function orderDailyPriorities(ids: string[]) {
  if (ids.length > 3) throw new Error("A daily plan can contain at most three primary wins.");
  if (new Set(ids).size !== ids.length) throw new Error("A task can only appear once in daily priorities.");
  return ids.map((taskId, index) => ({ taskId, position: index + 1 }));
}
