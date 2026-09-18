import {transactions,accounts,rules,people,splits,settings} from './data';
import {computeShares} from '@/lib/splits';
import {detectRecurring} from '@/lib/analytics/recurring';
import {buildNotifications} from '@/lib/analytics/notifications';
const readIds=new Set<string>();
const originalFetch=window.fetch.bind(window);
const json=(data:unknown,status=200)=>Promise.resolve(new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}}));
// The original components keep their API contracts, backed by in-memory demo data.
window.fetch=(async(input:any,init:any={})=>{
  const url=new URL(typeof input==='string'?input:input.url,location.origin);
  if(!url.pathname.startsWith('/api/'))return originalFetch(input,init);
  const p=url.pathname,q=url.searchParams,method=init.method||'GET';
  const body=typeof init.body==='string'?JSON.parse(init.body):{};
  if(p==='/api/chat/conversations')return json({conversations:[],messages:[]});
  if(p==='/api/settings'){if(method==='POST'&&typeof body.userName==='string')settings.userName=body.userName;return json({settings})}
  if(p==='/api/notifications'){
    const notifications=buildNotifications(transactions,[],readIds,new Date('2026-09-28'),rules);
    if(method==='POST'){(body.all?notifications.map(n=>n.id):body.ids||[]).forEach((id:string)=>body.read===false?readIds.delete(id):readIds.add(id));return json({ok:true})}
    return json({notifications,unread:notifications.filter(n=>!n.read).length});
  }
  if(p==='/api/transactions'){
    let rows=transactions.filter(t=>(!q.get('search')||`${t.merchant} ${t.description}`.toLowerCase().includes(q.get('search')!.toLowerCase()))&&(!q.get('from')||t.date>=q.get('from')!)&&(!q.get('to')||t.date<=q.get('to')!)&&(!q.get('account')||t.account===q.get('account'))&&(!q.get('merchant')||t.merchant===q.get('merchant'))&&(!q.get('category')||t.category===q.get('category'))&&(!q.get('type')||t.transactionType===q.get('type'))&&(!q.get('minAmount')||Math.abs(t.amount)>=Number(q.get('minAmount')))&&(!q.get('maxAmount')||Math.abs(t.amount)<=Number(q.get('maxAmount')))&&(q.get('recurring')!=='true'||t.recurring));
    return json({items:rows.slice(Number(q.get('offset')||0),Number(q.get('offset')||0)+Number(q.get('limit')||100)),total:rows.length});
  }
  if(p.startsWith('/api/transactions/')&&method==='PATCH'){const t=transactions.find(t=>t.id===p.split('/').pop());if(t)transactions.forEach(row=>{if(row===t||(body.applyToMerchant&&row.merchant===t.merchant))row.category=body.category});return json({ok:true})}
  if(p==='/api/subscriptions'){
    if(method==='POST'){const old=rules.find(r=>r.merchant===body.merchant);if(old)Object.assign(old,body);else rules.push({status:'confirmed',reminderDays:2,amount:null,cadence:null,nextDate:null,category:null,note:null,manual:false,updatedAt:'2026-09-28',...body});}
    if(method==='DELETE'){const index=rules.findIndex(r=>r.merchant===q.get('merchant'));if(index>=0)rules.splice(index,1)}
    return json({subscriptions:detectRecurring(transactions,rules),rule:rules.find(r=>r.merchant===body.merchant)});
  }
  if(p.startsWith('/api/accounts')){
    const name=decodeURIComponent(p.split('/')[3]||'');
    if(method==='PATCH'){const a=accounts.find(a=>a.name===name);if(a)Object.assign(a,body)}
    if(method==='POST')accounts.push({createdAt:'2026-09-28',network:null,...body});
    if(method==='DELETE'){const i=accounts.findIndex(a=>a.name===name);if(i>=0)accounts.splice(i,1)}
    return json({accounts,account:accounts.find(a=>a.name===(body.name||name))});
  }
  if(p==='/api/people'){const person={id:crypto.randomUUID(),createdAt:'2026-09-28',cashapp:null,paypal:null,venmo:null,...body};if(method==='POST')people.push(person);return json(method==='POST'?{person}:{people})}
  if(p==='/api/splits'){
    if(method==='POST'){const tx=transactions.find(t=>t.id===body.transactionId)!;const split={id:crypto.randomUUID(),transactionId:tx.id,merchant:tx.merchant,date:tx.date,total:Math.abs(tx.amount),note:body.note,createdAt:'2026-09-28',shares:computeShares(Math.abs(tx.amount),body.shares).map((s:any)=>({...s,name:s.personId?people.find(p=>p.id===s.personId)?.name:'You',settledAt:null}))};const i=splits.findIndex(s=>s.transactionId===tx.id);if(i>=0)splits.splice(i,1);splits.push(split);tx.splitOthers=split.shares.filter((s:any)=>s.personId).reduce((a:number,s:any)=>a+s.amount,0);return json({split})}
    return json({split:splits.find(s=>s.transactionId===q.get('transactionId'))||null,splits,people});
  }
  if(p.startsWith('/api/splits/')){const i=splits.findIndex(s=>s.id===p.split('/').pop());if(i>=0){if(method==='DELETE')splits.splice(i,1);else splits[i].shares.forEach(s=>{if(s.personId===body.personId)s.settledAt=body.settled?'2026-09-28':null})}return json({ok:true})}
  return json({error:'This action is not available in the sample preview.'},400);
}) as typeof fetch;
