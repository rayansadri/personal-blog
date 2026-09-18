import React,{useEffect,useState} from 'react';
import {createRoot} from 'react-dom/client';
import './api';
import '@/app/globals.css';
import './preview.css';
import Link,{useLocation,usePathname,useSearchParams,useRouteRevision} from './router';
import {AppShell} from '@/components/AppShell';
import {AskChat} from '@/components/ask/AskChat';
import Home from '@/app/page';
import Cards from '@/app/cards/page';
import Dna from '@/app/money-dna/page';
import Habits from '@/app/habits/page';
import Activity from '@/app/transactions/page';
import Recurring from '@/app/recurring/page';
import Upcoming from '@/app/upcoming/page';
import Changes from '@/app/changes/page';
import Insights from '@/app/insights/page';
import Timeline from '@/app/timeline/page';
import Patterns from '@/app/patterns/page';
import Splits from '@/app/splits/page';
import {PageHeader} from '@/components/ui/PageHeader';
import {Card} from '@/components/ui/Card';
import {transactions} from './data';
const routes:any={'/':Home,'/cards':Cards,'/money-dna':Dna,'/habits':Habits,'/transactions':Activity,'/recurring':Recurring,'/upcoming':Upcoming,'/changes':Changes,'/insights':Insights,'/timeline':Timeline,'/patterns':Patterns,'/splits':Splits};
const links=[['/cards','Cards'],['/recurring','Subscriptions'],['/upcoming','Upcoming'],['/habits','Habits'],['/changes','Changes'],['/insights','Insights'],['/timeline','Timeline'],['/patterns','Patterns'],['/splits','Splits']];
function SampleImport(){const [loaded,setLoaded]=useState(false);return <><PageHeader title="Import statements" description="Try the import flow with a fictional bank statement."/><Card><p className="text-[16px] font-medium">September sample statement</p><p className="mt-2 text-[14px] text-ink-secondary">Merchant names, categories, and duplicate checks. This public preview uses sample data only.</p><button onClick={()=>setLoaded(true)} className="my-4 rounded-lg bg-ink px-4 py-3 text-ink-inverse">{loaded?'Sample loaded':'Preview sample CSV'}</button>{loaded&&<><div className="divide-y divide-line">{transactions.slice(0,6).map(t=><div className="flex justify-between gap-3 py-3 text-[13px]" key={t.id}><span>{t.merchant}<small className="block text-ink-muted">{t.date} · {t.category}</small></span><span>${Math.abs(t.amount).toFixed(2)}</span></div>)}</div><p className="mt-3 text-[13px] text-positive">6 rows recognized · Categorized · Ready to explore</p><Link className="mt-3 inline-block text-accent" href="/transactions">Explore all transactions →</Link></>}</Card></>}
function App(){
  const loc=useLocation(),path=usePathname(),params=useSearchParams(),revision=useRouteRevision();
  const [page,setPage]=useState<React.ReactNode>(null);
  const [error,setError]=useState('');
  useEffect(()=>{
    let active=true;setError('');
    if(path==='/ask'||path==='/import')return;
    setPage(null);
    const route=routes[path]||Home;
    Promise.resolve(route({searchParams:Promise.resolve(Object.fromEntries(params))}))
      .then(p=>{if(active)setPage(p)})
      .catch(e=>{console.error(e);if(active)setError(e.message)});
    return()=>{active=false};
  },[loc,params,path,revision]);
  return <><div className="demo-banner"><span>SpendLens demo · Fictional data</span><button onClick={()=>location.reload()}>Reset</button></div><AppShell><div className="explore-links" aria-label="Explore app features">{links.map(([href,label])=><Link href={href} key={href} aria-current={path===href?'page':undefined}>{label}</Link>)}</div>{path==='/ask'?<AskChat hasData aiAvailable={false}/>:path==='/import'?<SampleImport/>:error?<p role="alert">Unable to open this view: {error}</p>:page||<p className="text-ink-muted">Opening your spending…</p>}</AppShell></>;
}
document.documentElement.dataset.theme=localStorage.getItem('spendlens-theme')==='light'?'light':'dark';
createRoot(document.getElementById('root')!).render(<App/>);
