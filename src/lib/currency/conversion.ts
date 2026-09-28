export type ExchangeRate = { date: string; base: 'MAD'; quote: 'USD'; rate: number };
export type Conversion = { path: string; original: Record<string, unknown>; converted: Record<string, unknown>; requestedDate: string; rate: ExchangeRate };
// Only monetary fields: never quantities, percentages, hours, or nonfinancial targets.
const moneyFields = new Set(['amount','subtotal','tax_amount','discount_amount','total','total_amount','total_value','value_amount','amount_paid','amount_remaining','potential_value','estimated_value','default_price','unit_price','unit_cost','selling_price','price','budget','cost','cost_estimate','balance','buffer_amount','baseline_monthly_cost','monthly_cost','setup_cost','minimum_order_value','shipping_cost','payment_fee','marketing_cost','financial_exposure','revenue_exposure','revenue_impact','exposure','payment_amount','spend','attributed_revenue','production_cost','estimated_cost']);
const dates = ['payment_date','paymentDate','expense_date','occurred_on','issue_date','invoice_date','snapshot_date','valued_on','as_of','ordered_at','decision_date','date','created_at'];
export function conversionDate(row: Record<string, unknown>, today: string) {
 const value=dates.map(key=>row[key]).find(value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}/.test(value));
 const day=typeof value==='string'?value.slice(0,10):today;
 return day>today?today:day;
}
export function isMoneyField(key:string,row:Record<string,unknown>) {
 if(moneyFields.has(key))return true;
 if(key==='value')return 'renewal_date' in row;
 if(key==='target_value'||key==='current_value')return /revenue|pipeline_generated|sales_value|profit|cash|spend|budget/.test(String(row.metric_type??row.metric??''));
 return false;
}
export async function convertMoneyInput(input: unknown, getRate: (date:string)=>Promise<ExchangeRate>, today=new Date().toISOString().slice(0,10)) {
 const conversions:Conversion[]=[];
 async function visit(value:unknown,path:string,inherited?:{currency:string;date:string;rate?:ExchangeRate}):Promise<unknown>{
  if(Array.isArray(value))return Promise.all(value.map((row,index)=>visit(row,`${path}[${index}]`,inherited)));
  if(!value||typeof value!=='object')return value;
  const row=value as Record<string,unknown>;const result={...row};
  const currencyKey=Object.hasOwn(row,'currency')?'currency':Object.hasOwn(row,'metric_currency')?'metric_currency':null;
  const currency=currencyKey?String(row[currencyKey]).trim().toUpperCase():inherited?.currency;
  const day=dates.some(key=>row[key])?conversionDate(row,today):inherited?.date??today;
  const context=currency?{currency,date:day,rate:inherited?.date===day?inherited.rate:undefined}:undefined;
  const keys=Object.keys(row).filter(key=>isMoneyField(key,row)&&row[key]!==null&&row[key]!==''&&row[key]!==undefined);
  if(currency==='MAD'){
   if(keys.length){
    const rate=context!.rate??await getRate(day);context!.rate=rate;
    if(!Number.isFinite(rate.rate)||rate.rate<=0||rate.base!=='MAD'||rate.quote!=='USD'||rate.date>day)throw new Error('A valid dated MAD to USD rate is unavailable. Your entry has not been saved.');
    const original:Record<string,unknown>={},converted:Record<string,unknown>={};
    for(const key of keys){const amount=Number(row[key]);if(!Number.isFinite(amount))throw new Error('Enter a valid monetary amount.');original[key]=row[key];result[key]=converted[key]=Math.round((amount*rate.rate+Number.EPSILON)*100)/100;}
    conversions.push({path,original,converted,requestedDate:day,rate});
   }
   if(currencyKey)result[currencyKey]='USD';
  }else if(currencyKey&&currency==='USD')result[currencyKey]='USD';
  for(const [key,child]of Object.entries(row))if(child&&typeof child==='object')result[key]=await visit(child,`${path}.${key}`,context);
  return result;
 }
 return {value:await visit(input,'$'),conversions};
}
