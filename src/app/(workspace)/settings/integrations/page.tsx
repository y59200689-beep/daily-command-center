import type { Metadata } from "next";
import { Icons } from "@/components/icons";
import { GoogleCalendarCard } from "@/features/integrations/google-calendar-card";
export const metadata: Metadata={title:"Integrations"};
const cards=[
  {name:"OpenAI",detail:"Daily brief, workspace questions, and confirmed planning actions.",ready:Boolean(process.env.OPENAI_API_KEY),needs:"OPENAI_API_KEY"},
  {name:"Gmail",detail:"Reference relevant client threads and awaiting-reply metadata without copying the inbox.",ready:false,needs:"GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET"},
  {name:"Google Drive",detail:"Attach provider-owned file references to clients, projects, and content items.",ready:false,needs:"GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET"},
  {name:"GitHub",detail:"Commits, pull requests, and issues in software projects.",ready:false,needs:"GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET"},
  {name:"Strava",detail:"Import runs, rides, swims, and activity duration without overwriting manual entries.",ready:false,needs:"STRAVA_CLIENT_ID and STRAVA_CLIENT_SECRET"},
];
export default function IntegrationsPage(){return <div className="domain-page"><header className="page-header"><div><p className="eyebrow">Settings · Connections</p><h1>Integrations</h1><p>Bring in context without turning the command center into a copy of every service.</p></div></header><div className="project-grid integration-grid"><GoogleCalendarCard/>{cards.map((card)=><article className="project-card" key={card.name}><div className="project-card__top"><span className="command-result__icon"><Icons.Zap size={17}/></span><span className={card.ready?"status status--blue":"status"}>{card.ready?"Ready":"Not connected"}</span></div><h2>{card.name}</h2><p>{card.detail}</p><button className="button button--outline button--neutral" disabled>Connect</button><small>Requires · {card.needs}</small></article>)}</div></div>}
