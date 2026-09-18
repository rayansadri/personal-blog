import {buildBehaviorReport} from '@/lib/behavior';
import {buildInterpreterInput} from '@/services/ai/inputBuilder';
import {interpretDeterministically} from '@/services/ai/deterministic';
import {loadTransactions,loadRules} from './data';
let cached:any;
export async function loadBehaviorBundle(){
  if(cached)return cached;
  const txs=loadTransactions(),report=buildBehaviorReport(txs,loadRules());
  if(!report)return null;
  const input=buildInterpreterInput(report,txs);
  cached={report,interpretation:{interpretation:interpretDeterministically(input),source:'deterministic',model:null,dropped:[],input,inputHash:'demo',cached:false},ai:{enabled:false,available:false,model:'Demo'}};
  return cached;
}
