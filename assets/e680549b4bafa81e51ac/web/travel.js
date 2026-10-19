// Fictional route fixtures for interaction testing, never live airline inventory.
export const AIRPORTS = [
  {code:'JFK',city:'紐約',name:'甘迺迪國際機場',zone:'America/New_York',minutes:970,fare:7200},
  {code:'BKK',city:'曼谷',name:'素萬那普機場',zone:'Asia/Bangkok',minutes:180,fare:1800},
  {code:'HKG',city:'香港',name:'香港国际机场',zone:'Asia/Hong_Kong',minutes:0,fare:0},
  {code:'TPE',city:'台北',name:'桃园国际机场',zone:'Asia/Taipei',minutes:115,fare:1180},
  {code:'NRT',city:'东京',name:'成田国际机场',zone:'Asia/Tokyo',minutes:275,fare:2580},
  {code:'SIN',city:'新加坡',name:'樟宜机场',zone:'Asia/Singapore',minutes:235,fare:2180},
  {code:'PVG',city:'上海',name:'浦东国际机场',zone:'Asia/Shanghai',minutes:160,fare:1680},
  {code:'PEK',city:'北京',name:'首都国际机场',zone:'Asia/Shanghai',minutes:200,fare:1880},
  {code:'LHR',city:'伦敦',name:'希思罗机场',zone:'Europe/London',minutes:805,fare:5280},
  {code:'SYD',city:'悉尼',name:'悉尼机场',zone:'Australia/Sydney',minutes:555,fare:4580},
];
export const DEFAULT_TRIP={origin:'HKG',destination:'TPE',date:'2027-09-17',budget:20000};
export const airport=code=>AIRPORTS.find(a=>a.code===code);
export const duration=minutes=>`${Math.floor(minutes/60)}小时${minutes%60?`${minutes%60}分`:''}`;

export function validateTrip(raw){
  if(!raw||!airport(raw.origin)||!airport(raw.destination))throw new Error('请选择列表中的出发地和目的地。');
  if(raw.origin===raw.destination)throw new Error('出发地和目的地不能相同，请选择另一座城市。');
  const stamp=Date.parse(raw.date+'T00:00:00Z');
  if(typeof raw.date!=='string'||!/^20\d{2}-\d{2}-\d{2}$/.test(raw.date)||!Number.isFinite(stamp)||new Date(stamp).toISOString().slice(0,10)!==raw.date)throw new Error('请选择有效出发日期（2000–2099 年）。');
  const budget=Number(raw.budget);
  if(!Number.isFinite(budget)||budget<1000||budget>300000)throw new Error('请输入 HK$1,000–300,000 的家庭总预算。');
  return {origin:raw.origin,destination:raw.destination,date:raw.date,budget};
}
function localParts(stamp,zone){
  const parts=new Intl.DateTimeFormat('en-GB',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(stamp);
  const p=Object.fromEntries(parts.map(x=>[x.type,x.value]));
  return {date:`${p.year}-${p.month}-${p.day}`,time:`${p.hour}:${p.minute}`};
}
function departureUtc(date,zone){
  // Resolve 11:05 in the origin's local zone, including daylight-saving offsets.
  const target=Date.parse(date+'T11:05:00Z');let guess=target;
  for(let i=0;i<3;i++){const p=localParts(guess,zone);guess+=target-Date.parse(p.date+'T'+p.time+':00Z');}
  return guess;
}
export function buildItinerary(raw=DEFAULT_TRIP,{delayMinutes=0,aircraft}={}){
  const trip=validateTrip(raw),from=airport(trip.origin),to=airport(trip.destination);
  if(!Number.isFinite(delayMinutes)||delayMinutes<0)throw new Error('延误分钟数无效。');
  const codes=trip.origin==='HKG'||trip.destination==='HKG'?[trip.origin,trip.destination]:[trip.origin,'HKG',trip.destination];
  const connectionMinutes=codes.length===3?105:0,segments=[];
  let cursor=departureUtc(trip.date,from.zone)+delayMinutes*60000,adultFare=0;
  const departUtc=cursor;
  for(let i=0;i<codes.length-1;i++){
    const a=airport(codes[i]),b=airport(codes[i+1]),leg=a.code==='HKG'?b:a;
    const depart=localParts(cursor,a.zone),arrivalUtc=cursor+leg.minutes*60000,arrive=localParts(arrivalUtc,b.zone);
    segments.push({origin:a.code,destination:b.code,departure:depart.time,departureDate:depart.date,arrival:arrive.time,arrivalDate:arrive.date,departureUtc:cursor,arrivalUtc,minutes:leg.minutes,aircraft:aircraft||(leg.minutes>360?'A350':'A330')});
    adultFare+=leg.fare;cursor=arrivalUtc+(i<codes.length-2?connectionMinutes*60000:0);
  }
  const first=segments[0],last=segments.at(-1),infantFare=Math.round(adultFare*.1),total=adultFare*3+infantFare;
  return {id:'original',number:'CX-DEMO 410',aircraft:aircraft||(segments.some(s=>s.minutes>360)?'A350':'A330'),origin:from.code,destination:to.code,date:first.departureDate,departure:first.departure,arrival:last.arrival,arrivalDate:last.arrivalDate,gate:'36',segments,stops:codes.length-2,connectionMinutes,durationMinutes:(cursor-departUtc)/60000,delayMinutes,adultFare,infantFare,total,overBudget:total>trip.budget,budget:trip.budget};
}
