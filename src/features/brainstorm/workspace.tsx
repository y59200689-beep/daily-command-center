'use client';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useCallback, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useDeferredEffect } from '@/lib/use-deferred-effect';
import type { Board } from '@/lib/brainstorm';
import { Button } from '@/components/ui/button';
import './brainstorm.css';
const Editor=dynamic(()=>import('./editor'),{ssr:false,loading:()=> <div className="brainstorm-loading" role="status">Preparing your canvas…</div>});
type Task={id:string;title:string;status:string};
export function BrainstormWorkspace({projectId}:{projectId:string}){
 const params=useSearchParams();const boardId=params.get('board');const taskId=params.get('task');
 const[data,setData]=useState<{name:string;tasks:Task[];board:Board|null}|null>(null);const[error,setError]=useState('');const[retry,setRetry]=useState(0);
 useDeferredEffect(useCallback(()=>{void retry;let live=true;void Promise.all([fetch(`/api/projects/${projectId}`,{cache:'no-store'}),boardId?fetch(`/api/brainstorm/${boardId}`,{cache:'no-store'}):null]).then(async responses=>{const project=await responses[0]!.json();if(!responses[0]!.ok)throw new Error(project.error);let board:Board|null=null;if(responses[1]){const body=await responses[1].json();if(!responses[1].ok)throw new Error(body.error);board=body.board;if(board?.project_id!==projectId)throw new Error('This board belongs to a different project.');}if(live){setData({name:String(project.project.name),tasks:project.related.tasks,board});setError('')}}).catch(e=>{if(live)setError(e.message)});return()=>{live=false}},[projectId,boardId,retry]));
 if(error)return <div className="brainstorm-loading"><h1>Canvas unavailable</h1><p role="alert">{error}</p><Button onClick={()=>{setError('');setRetry(v=>v+1)}}>Retry</Button><Link href={`/projects/${projectId}`}>Back to project</Link></div>;
 if(!data)return <div className="brainstorm-loading" role="status">Loading your project…</div>;
 return <Editor key={data.board?.id??'new'} projectId={projectId} projectName={data.name} tasks={data.tasks} board={data.board} initialTaskId={taskId}/>;
}
