// Single finite example catalog. No external ticket or operational service.
// Sample fares/capacity are fictional; rows with public schedule provenance remain examples.
export const EXAMPLE_VERSION='cx-examples-20261016-booking';
export const EXAMPLE_COVERAGE={from:'2026-10-15',until:'2027-12-31'};
export const EXAMPLE_DATE='2026-10-16';
const daily=[0,1,2,3,4,5,6];
const direct=(id,from,to,dep,arr,arrDay,fare,tax,bags,change,days=daily)=>({id,from,to,days,legs:[{flight:'CX-DEMO '+id,from,to,dep,arr,depDay:0,arrDay}],fare,tax,bags,change,capacity:8});
/** Published finite simulation timetable. No random generation and no itinerary seeding. */
const exampleBase=[
 direct('401','HKG','TPE','09:10','11:05',0,1100,180,1,600),direct('405','HKG','TPE','10:45','12:40',0,1450,180,2,0),direct('403','HKG','TPE','14:20','16:15',0,1450,180,2,0),
 direct('402','TPE','HKG','12:30','14:30',0,1150,180,1,600),direct('404','TPE','HKG','18:20','20:20',0,1500,180,2,0),
 direct('501','HKG','NRT','10:00','15:20',0,2400,380,1,800),direct('503','HKG','NRT','15:10','20:30',0,3000,380,2,0,[1,3,5,6]),
 direct('505','HKG','NRT','12:00','17:20',0,2800,380,1,800),direct('507','HKG','NRT','16:00','21:20',0,3200,380,2,0),
 direct('502','NRT','HKG','16:30','20:50',0,2500,380,1,800),
 direct('251','HKG','LHR','00:30','07:00',0,5100,680,1,1200),direct('253','HKG','LHR','13:00','19:30',0,6300,680,2,0),
 direct('252','LHR','HKG','12:30','08:30',1,5200,680,1,1200),direct('254','LHR','HKG','22:00','18:00',1,6400,680,2,0),
 direct('701','PVG','HKG','09:00','11:45',0,900,160,1,500),direct('702','HKG','PVG','15:00','17:45',0,900,160,1,500),
 {id:'PVG-LHR-connection',from:'PVG',to:'LHR',days:[1,3,5,0],legs:[{flight:'CX-DEMO 701',from:'PVG',to:'HKG',dep:'09:00',arr:'11:45',depDay:0,arrDay:0},{flight:'CX-DEMO 255',from:'HKG',to:'LHR',dep:'15:30',arr:'22:00',depDay:0,arrDay:0}],fare:5600,tax:760,bags:2,change:800,capacity:6},
 {id:'LHR-PVG-connection',from:'LHR',to:'PVG',days:daily,legs:[{flight:'CX-DEMO 252',from:'LHR',to:'HKG',dep:'12:30',arr:'08:30',depDay:0,arrDay:1},{flight:'CX-DEMO 702',from:'HKG',to:'PVG',dep:'15:00',arr:'17:45',depDay:1,arrDay:1}],fare:6100,tax:840,bags:2,change:800,capacity:6},
 direct('831','JFK','HKG','23:00','05:00',2,7200,900,2,0,[2,5]),direct('830','HKG','JFK','10:00','13:00',0,7200,900,2,0,[2,5]),
 direct('901','HKG','BKK','11:00',null,0,null,null,1,null,[4])
];

const reviewed=[
 ['CX520','HKG','NRT','10:40','16:05',0,'2026-10-15','2026-10-24'],
 ['CX520','HKG','NRT','10:30','15:30',0,'2026-10-25','2027-03-27'],
 ['CX521','NRT','HKG','17:15','21:10',0,'2026-10-15','2026-10-24'],
 ['CX521','NRT','HKG','16:50','21:10',0,'2026-10-25','2027-03-27'],
 ['CX251','HKG','LHR','22:45','05:40',1,'2026-10-15','2026-10-23'],
 ['CX251','HKG','LHR','23:00','05:25',1,'2026-10-24','2027-03-26'],
 ['CX252','LHR','HKG','12:20','07:50',1,'2026-10-15','2026-10-24'],
 ['CX252','LHR','HKG','11:00','07:30',1,'2026-10-25','2027-03-27'],
 ['CX367','PVG','HKG','13:20','16:15',0,'2026-10-15','2026-10-24'],
 ['CX376','HKG','PVG','10:25','13:15',0,'2026-10-15','2026-10-24'],
 ['CX494','HKG','TPE','10:10','12:10',0,'2026-10-15','2026-10-23'],
 ['CX495','TPE','HKG','13:20','15:20',0,'2026-10-15','2026-10-24']
];
export const EXAMPLE_CATALOG=[
 ...exampleBase.map(s=>({...s,fromDate:EXAMPLE_COVERAGE.from,untilDate:EXAMPLE_COVERAGE.until,aircraft:s.id==='405'?'A321neo':s.id==='403'?'A350-900':'A350',sourceUrl:null,demoSeats:['22A','22B','22C','22D','22E','22F','23A','23B'],careServices:['wheelchair','adjacent','childMeal','specialMeal','aisle',...(s.id==='405'?[]:['bassinet','infantMeal'])]})),
 ...reviewed.map(r=>({id:r[0]+'-'+r[6],from:r[1],to:r[2],days:daily,
  legs:[{flight:r[0],from:r[1],to:r[2],dep:r[3],arr:r[4],depDay:0,arrDay:r[5]}],
  fare:null,tax:null,bags:null,change:null,capacity:null,aircraft:null,fromDate:r[6],untilDate:r[7],sourceUrl:'https://www.flight.info/'+r[0]}))
];
export function exampleSchedules(from,to,day,rows=EXAMPLE_CATALOG){return rows.filter(s=>s.from===from&&s.to===to&&day>=(s.fromDate??EXAMPLE_COVERAGE.from)&&day<=(s.untilDate??EXAMPLE_COVERAGE.until)&&s.days.includes(new Date(day+'T12:00:00Z').getUTCDay()));}

export function examplePrice(s,cabin='economy',count=1,bags=1,lapInfants=0){const includedBags=s.bags===null?null:cabin==='business'?2:s.bags,fare=s.fare===null?null:Math.round(s.fare*(cabin==='business'?2.6:1)*(count-lapInfants+lapInfants*0.1)),tax=s.tax===null?null:s.tax*(count-lapInfants),baggageCost=includedBags===null?null:Math.max(0,bags-includedBags)*400*(count-lapInfants);return {fare,tax,includedBags,baggageCost,total:fare===null||tax===null||baggageCost===null?null:fare+tax+baggageCost,changeFee:s.change,capacity:s.capacity};}

// Departure preferences always use the first departure airport's local clock.
export function matchesDeparturePeriod(time,period='any'){const hour=Number(String(time).slice(0,2));return period==='any'||period==='morning'&&hour>=6&&hour<12||period==='afternoon'&&hour>=12&&hour<18||period==='evening'&&hour>=18&&hour<24;}
