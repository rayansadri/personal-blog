import {ask} from '@/lib/ask';
import {transactions,rules} from './data';
import type {DemoTurn} from '@/lib/demo/scenarios';
export async function answerPreviewQuestion(question:string):Promise<DemoTurn>{
  const answer=await ask(question,transactions,undefined,rules);
  const cards:any[]=[];
  if(answer.chart?.data.length)cards.push({type:'trend',title:'From your sample transactions',series:answer.chart.data});
  if(answer.table?.rows.length){
    const numericIndex=answer.table.rows[0].findIndex((v,i)=>i>0&&typeof v==='number');
    if(numericIndex>0)cards.push({type:'breakdown',title:answer.table.columns.join(' · '),kind:'merchant',rows:answer.table.rows.slice(0,8).map(row=>({label:String(row[0]),value:Number(row[numericIndex])}))});
  }
  const query=question.toLowerCase();
  const followups=query.includes('habit')?['Am I spending more on weekends?','What recurring costs are growing?']:query.includes('recurring')?['What am I paying for next?','What should I actually pay attention to?']:['What habit is costing me the most?','Which merchants do I spend the most at?','Show my spending trend'];
  return {question,statuses:['Reading the sample transactions…','Computing your spending patterns…'],answer:[answer.text,...answer.details||[]].join('\n\n'),cards,evidence:[{tool:answer.plan.kind,label:'Local analytics · Fictional dataset',range:{start:'2025-01-01',end:'2026-09-28',label:'Sample history: Jan 2025 – Sep 2026'},values:[{metric:'Transactions in sample history',value:String(transactions.length)},{metric:'Query',value:answer.plan.kind}]}],followups};
}
