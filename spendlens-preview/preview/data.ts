import type {Transaction,Account,SubscriptionRule,Person,Split} from '@/lib/types';

// Entirely fictional, repeatable data. No bank files are included in this preview.
export let accounts:Account[]=[
  {name:'Amex Gold',nickname:'Everyday',last4:'1008',holder:'Rayan',kind:'credit',theme:'sand',network:'Amex',createdAt:'2025-01-01'},
  {name:'Chase Checking',nickname:'Home base',last4:'4201',holder:'Rayan',kind:'checking',theme:'midnight',network:'Visa',createdAt:'2025-01-01'},
  {name:'Capital One',nickname:'Travel',last4:'9024',holder:'Rayan',kind:'credit',theme:'graphite',network:'Mastercard',createdAt:'2025-01-01'}
];
export let transactions:Transaction[]=[];
let seq=0;
function add(date:string,merchant:string,amount:number,category:any,account='Amex Gold',recurring=false){transactions.push({id:'sample-'+(++seq),date,merchant,description:merchant,amount:-amount,account,category,transactionType:amount<0?'income':'expense',recurring,sourceFile:'Fictional sample data',flags:[],importedAt:'2026-09-18T00:00:00Z'})}
for(let m=0;m<21;m++){
  const year=2025+Math.floor(m/12),month=m%12+1,ym=`${year}-${String(month).padStart(2,'0')}`;
  const day=(d:number)=>ym+'-'+String(d).padStart(2,'0');
  add(day(1),'Payroll',-6400,'Income','Chase Checking',true);
  add(day(2),'Apartment rent',1850,'Housing','Chase Checking',true);
  for(const [name,amount,cat,d] of [['Netflix',17.99,'Subscriptions',9],['Spotify',11.99,'Subscriptions',14],['iCloud',2.99,'Subscriptions',5],['Verizon',m>=19?89:70,'Utilities',11],['Hydro',72+m%5*4,'Utilities',18]] as const)add(day(d),name,amount,cat,'Chase Checking',true);
  if(m>10)add(day(7),'ChatGPT',20,'Subscriptions','Amex Gold',true);
  if(m>14)add(day(21),'Notion',12,'Subscriptions','Amex Gold',true);
  for(let d=3;d<=27;d+=4)add(day(d),'Whole Foods',58+(d*m%43),'Groceries');
  for(let d=2;d<=26;d+=3)add(day(d),'Blue Bottle Coffee',6.5+(d%3)*1.5,'Dining');
  for(let n=0;n<5+Math.floor(m/2);n++)add(day(3+(n*2)%25),'Uber Eats',21+(m+n)%18,'Delivery');
  for(let n=0;n<4;n++){add(day(6+n*6),'Sweetgreen',14.85+n*2,'Dining');add(day(5+n*6),'Uber',16+(m+n)%15,'Transportation')}
  add(day(13),'Amazon',69+m*7,'Shopping');add(day(24),'Uniqlo',55+(m*13)%100,'Shopping');
  add(day(16),'Cinema',34,'Entertainment');add(day(23),'Local restaurant',85+m*2,'Dining');
  if(m%4===3||m===20)add(day(12),'Delta Air Lines',412.6+(m%4)*55,'Travel','Capital One');
  if(m%3===1)add(day(20),'Airbnb',280+m*8,'Travel','Capital One');
}
transactions.sort((a,b)=>b.date.localeCompare(a.date));
export let rules:SubscriptionRule[]=[];
export let people:Person[]=[{id:'alex',name:'Alex',venmo:null,cashapp:null,paypal:null,createdAt:'2026-09-01'}];
export let splits:Split[]=[];
export const loadTransactions=()=>transactions;
export const loadRules=()=>rules;
export const listAccounts=()=>accounts;
export const getAccounts=()=>accounts.map(a=>a.name);
export const countTransactions=()=>transactions.length;
export const settings={userName:'Rayan',aiEnabled:false,aiModel:'Demo'};
export const getSettings=()=>settings;
export const listPeople=()=>people;
export const listSplits=()=>splits;
export function resetData(){location.reload()}
