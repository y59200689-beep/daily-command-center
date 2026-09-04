import type { Metadata } from "next";
import { Suspense } from "react";
import { FocusTimer } from "@/features/focus/focus-timer";
export const metadata: Metadata = { title: "Focus" };
export default function FocusPage() { return <Suspense fallback={<div className="empty-state"><span>···</span><h2>Preparing focus</h2></div>}><FocusTimer /></Suspense>; }
