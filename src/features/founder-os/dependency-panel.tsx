"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useDeferredEffect } from "@/lib/use-deferred-effect";
import { subscribeToWorkspaceMutations } from "@/lib/workspace-mutations";
import type { Row } from "@/lib/founder-os/repository";
export function DependencyPanel({ type, id }: { type: string; id: string }) {
  const [revision, setRevision] = useState(0);
  useEffect(() => subscribeToWorkspaceMutations(["founder-os"], () => setRevision(v => v + 1)), []);
  const [data, setData] = useState<{ blockedBy: Row[]; blocks: Row[]; limited: boolean; downstream: { id: string; label: string; type: string }[] } | null>(null), [error, setError] = useState("");
  useDeferredEffect(useCallback(() => { let active = true; void fetch(`/api/dependencies?type=${encodeURIComponent(type)}&id=${encodeURIComponent(id)}&revision=${revision}`).then(async res => { const body = await res.json(); if (!res.ok) throw new Error(body.error); if (active) setData(body); }).catch(e => { if (active) setError(String(e)); }); return () => { active = false; }; }, [type, id, revision]));
  return <section className="founder-dependency-panel"><h3>Dependencies</h3>{error && <p role="alert">{error}</p>}{data && <>{data.limited && <p>Graph limited to 500 links; downstream evidence may be incomplete.</p>}<h4>BLOCKED BY / UPSTREAM</h4>{data.blockedBy.length ? data.blockedBy.map(r => <Link className="founder-list-row" href={`/dependencies?record=${r.id}`} key={r.id}><span>{String(r.target_label || r.dependency_label)}</span><span>{String(r.state)}</span></Link>) : <p className="founder-muted">No upstream dependencies recorded.</p>}<h4>BLOCKS / DOWNSTREAM</h4>{data.blocks.length ? data.blocks.map(r => <Link className="founder-list-row" href={`/dependencies?record=${r.id}`} key={r.id}><span>{String(r.source_type)} · {String(r.source_label)}</span><span>{String(r.state)}</span></Link>) : <p className="founder-muted">No downstream dependencies recorded.</p>}<h4>DOWNSTREAM IMPACT</h4>{data.downstream?.length ? data.downstream.map(r => <p key={r.id}>{r.label} · {r.type}</p>) : <p>No affected downstream records on blocked, waiting or unavailable paths.</p>}</>}<Link href="/dependencies">Manage dependencies →</Link></section>;
}
