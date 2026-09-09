import {notFound} from 'next/navigation';
import '@/features/financial-control/financial-control.css';
import {FinancialWorkspace} from '@/features/financial-control/financial-workspace';
import {financialViews} from '@/lib/financial-schema';
export const metadata={title:'Financial Control — Daily Command Center'};
export default async function Page({params}:{params:Promise<{view?:string[]}>}){const path=(await params).view?.join('/')??'home';if(path!=='home'&&!financialViews.some(v=>v===path))notFound();return <FinancialWorkspace view={path}/>;}
