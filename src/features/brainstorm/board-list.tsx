'use client';
import Link from 'next/link';
import { useCallback, useState } from 'react';
import { useDeferredEffect } from '@/lib/use-deferred-effect';
import { Button } from '@/components/ui/button';
import { Network } from 'lucide-react';
import { Icons } from '@/components/icons';
import type { Board } from '@/lib/brainstorm';
import './brainstorm.css';
export function ProjectBoards({projectId,taskId}:{projectId:string;taskId?:string}){
 const[boards,setBoards]=useState<Board[]>([]);const[loading,setLoading]=useState(true);const[error,setError]=useState('');
 const load=useCallback(()=>{let live=true;setLoading(true);setError('');void fetch(`/api/brainstorm?projectId=${projectId}`,{cache:'no-store'}).then(async r=>{const data=await r.json();if(!r.ok)throw new Error(data.error);if(live)setBoards(data.boards)}).catch(e=>{if(live)setError(e.message)}).finally(()=>{if(live)setLoading(false)});return()=>{live=false}},[projectId]);useDeferredEffect(load);
 const shown=taskId?boards.filter(b=>b.task_ids.includes(taskId)):boards;
 return <section className="brainstorm-list"><header><div><p className="eyebrow">IDEAS INTO ACTION</p><h2>Brainstorm boards</h2><p>A visual space to explore ideas and connect your next steps.</p></div><Link className="button button--solid button--brand" href={`/projects/${projectId}/brainstorm${taskId?`?task=${taskId}`:''}`}><Icons.Plus size={16}/> New board</Link></header>{loading?<p role="status">Loading boards…</p>:error?<div role="alert"><p>{error}</p><Button onClick={()=>load()}>Retry</Button></div>:shown.length?<div className="brainstorm-board-grid">{shown.map(b=><Link className="brainstorm-board-card" key={b.id} href={`/projects/${projectId}/brainstorm?board=${b.id}`}><div className="brainstorm-board-art"><Network size={34}/><i/><i/><i/></div><strong>{b.title}</strong><span>{b.task_ids.length} linked tasks · {new Date(b.updated_at).toLocaleDateString()}</span><small>Open canvas →</small></Link>)}</div>:<div className="brainstorm-list-empty"><Icons.Lightbulb size={28}/><h3>Make room for your next idea</h3><p>Start with a blank canvas, a mind map, or a simple plan.</p></div>}</section>;
}
