import type { Metadata } from "next";
import { FilesPage } from "@/features/files/files-page";

export const metadata: Metadata = { title: "Files — Daily Command Center" };

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const read = (key: string) => typeof params[key] === "string" ? params[key] : "";
  return <FilesPage initialFilters={{ entity: read("entityType") || read("entity"), project: read("project"), client: read("client"), type: read("type"), recent: read("recent") }} initialAttachment={read("attachment")}/>
}
