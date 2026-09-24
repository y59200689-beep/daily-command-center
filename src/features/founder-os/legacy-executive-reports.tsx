"use client";
import { useState } from "react";
import { ExecutiveHome } from "@/features/executive/executive-home";
import { Button } from "@/components/ui/button";
export function LegacyExecutiveReports() { const [open, setOpen] = useState(false); return <section className="founder-record"><Button onClick={() => setOpen(v => !v)}>{open ? "Hide" : "Open"} detailed executive reports</Button>{open && <ExecutiveHome />}</section>; }
