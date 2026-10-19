import { EXAMPLE_CATALOG, EXAMPLE_VERSION, EXAMPLE_COVERAGE, exampleSchedules, examplePrice, matchesDeparturePeriod } from '/assets/ee1ad71b9a14d41f146c/web/example-flights.js';
import { snapshotFromOffer } from '/assets/ee1ad71b9a14d41f146c/flight-service.js';
import { airport } from '/assets/ee1ad71b9a14d41f146c/web/travel.js';
import { localDeparture, localParts, addDays } from '/assets/ee1ad71b9a14d41f146c/flight-time.js';
export const CATALOG_VERSION = EXAMPLE_VERSION;
export const SERVICES = EXAMPLE_CATALOG;
export const COVERAGE = EXAMPLE_COVERAGE;
export const FLIGHT_SOURCE = '內置示例航班 · 價格及容量為演示資料';
export function criteriaFor(p) { return { ...(p.lapInfantIds?.length ? { lapInfantIds: [...p.lapInfantIds].sort() } : {}), origin: p.origin, destination: p.destination, outboundDate: p.start, returnDate: p.travelType === 'oneway' ? '' : p.end, travelType: p.travelType ?? (p.end ? 'return' : 'oneway'), travelerIds: [...p.travelerIds].sort(), familyId: p.familyId ?? '', cabin: p.cabin ?? 'economy', bags: p.bags ?? 1, budget: p.budget, departurePeriod: p.departurePeriod ?? 'any', flexible: !!p.flexible }; }
export const criteriaKey = (c) => JSON.stringify({ ...c, travelerIds: [...c.travelerIds].sort() });
export function validateCriteria(c) {
    if (!airport(c.origin) || !airport(c.destination) || c.origin === c.destination)
        throw Error('請選擇不同的有效出發與目的地機場。');
    const date = (v) => /^\d{4}-\d{2}-\d{2}$/.test(v) && Number.isFinite(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v;
    if (!date(c.outboundDate) || c.travelType === 'return' && (!date(c.returnDate) || c.returnDate < c.outboundDate))
        throw Error('請核對出發日期與回程出發日期。');
    if (c.lapInfantIds?.some(id => !c.travelerIds.includes(id)) || new Set(c.lapInfantIds).size !== (c.lapInfantIds?.length ?? 0) || !c.travelerIds.length || new Set(c.travelerIds).size !== c.travelerIds.length)
        throw Error('請選擇實際同行旅客。');
    if (!['economy', 'business'].includes(c.cabin) || !Number.isInteger(c.bags) || c.bags < 0 || c.bags > 5 || !['any', 'morning', 'afternoon', 'evening'].includes(c.departurePeriod))
        throw Error('請核對艙等、行李與出發時段。');
    if (c.budget !== null && (!Number.isInteger(c.budget) || c.budget < 100 || c.budget > 1000000))
        throw Error('請核對預算上限。');
}
function option(service, date, c) {
    const legs = service.legs.map((l, index) => { const departure = localDeparture(addDays(date, l.depDay), l.dep, l.from), arrival = l.arr ? localDeparture(addDays(date, l.arrDay), l.arr, l.to) : null; return { id: service.id + ':' + date + ':' + index, flight: l.flight, operator: 'CX', from: l.from, to: l.to, departure, arrival, departureZone: airport(l.from).zone, arrivalZone: airport(l.to).zone, departureLocal: { day: addDays(date, l.depDay), time: l.dep }, arrivalLocal: l.arr ? { day: addDays(date, l.arrDay), time: l.arr } : null, arrivalDayOffset: l.arr ? l.arrDay - l.depDay : null, aircraft: service.aircraft ?? '待確認' }; });
    const { fare, tax, includedBags, baggageCost } = examplePrice(service, c.cabin, c.travelerIds.length, c.bags, c.lapInfantIds?.length ?? 0);
    return { id: service.id + ':' + date + ':' + c.cabin, origin: service.from, destination: service.to, date, legs, cabin: c.cabin, includedBags, baggageCost, fare, tax, total: fare === null || tax === null ? null : fare + tax + (baggageCost ?? 0), changeFee: service.change, fareDifference: 'unknown', refundable: null, capacity: service.capacity, source: FLIGHT_SOURCE, catalogVersion: CATALOG_VERSION, rules: '模擬條件；退票規則與未來票價差額待核實，未鎖位或出票。', tags: [] };
}
function matches(services, from, to, date, c) {
    return exampleSchedules(from, to, date, services).filter(s => s.capacity === null || s.capacity >= c.travelerIds.length - (c.lapInfantIds?.length ?? 0)).map(s => option(s, date, c)).filter(o => {
        return matchesDeparturePeriod(o.legs[0].departureLocal.time, c.departurePeriod) && (!c.flexible || o.changeFee === 0);
    });
}
export function searchFlights(c, now = Date.now(), services = SERVICES) {
    validateCriteria(c);
    const result = { status: 'ready', criteriaKey: criteriaKey(c), queryAt: new Date(now).toISOString(), validUntil: new Date(now + 15 * 60000).toISOString(), catalogVersion: CATALOG_VERSION, outbound: [], inbound: [], message: '' };
    const dates = [c.outboundDate, ...(c.travelType === 'return' ? [c.returnDate] : [])];
    if (dates.some(d => d < COVERAGE.from || d > COVERAGE.until) || !services.some(s => s.from === c.origin && s.to === c.destination) || c.travelType === 'return' && !services.some(s => s.from === c.destination && s.to === c.origin)) {
        result.status = 'no-coverage';
        result.message = `目前內置示例尚未覆蓋此條件。示例日期涵蓋 ${COVERAGE.from} 至 ${COVERAGE.until}，可調整日期／路線，或保存旅行想法。`;
        return result;
    }
    let out = matches(services, c.origin, c.destination, c.outboundDate, c).filter(o => Date.parse(o.legs[0].departure) > now), back = c.travelType === 'return' ? matches(services, c.destination, c.origin, c.returnDate, c).filter(o => Date.parse(o.legs[0].departure) > now) : [];
    const within = (a, b) => c.budget === null || a.total === null || b?.total === null || (a.total + (b?.total ?? 0)) <= c.budget;
    const compatible = (a, b) => !!a.legs.at(-1).arrival && Date.parse(b.legs[0].departure) > Date.parse(a.legs.at(-1).arrival) && within(a, b);
    if (c.travelType === 'return') {
        const allOut = out, allBack = back;
        out = out.filter(a => allBack.some(b => compatible(a, b)));
        back = back.filter(b => allOut.some(a => compatible(a, b)));
    }
    else
        out = out.filter(a => within(a));
    result.outbound = out;
    result.inbound = back;
    if (!out.length || c.travelType === 'return' && !back.length) {
        result.status = 'no-match';
        result.message = '目前內置示例尚未覆蓋此條件，沒有相符班次。可放寬預算、時段或改期條件，或選擇其他日期；不會自動替你改日期。';
    }
    else
        result.message = '選擇去程' + (c.travelType === 'return' ? '及回程' : '') + '航班，再檢查抵達安排。';
    return result;
}
export function selectFlight(p, id, direction, now = Date.now()) {
    const c = criteriaFor(p), r = p.flightSearch;
    if (!r || r.status !== 'ready' || r.criteriaKey !== criteriaKey(c) || Date.parse(r.validUntil) <= now || r.catalogVersion !== CATALOG_VERSION)
        throw Error('查詢已過期或條件已變更，請重新查詢。');
    const fresh = searchFlights(c, now), o = fresh[direction].find(x => x.id === id);
    if (!o)
        throw Error('此班次已不符合查詢條件，請重新查詢。');
    const next = { ...p, selectedFlight: p.selectedFlight ? structuredClone(p.selectedFlight) : undefined };
    if (direction === 'outbound')
        next.selectedFlight = { criteria: c, criteriaKey: criteriaKey(c), outbound: o, queryAt: r.queryAt, validUntil: r.validUntil, catalogVersion: CATALOG_VERSION, selectedAt: new Date(now).toISOString(), source: FLIGHT_SOURCE };
    else {
        if (!next.selectedFlight)
            throw Error('請先選擇去程航班。');
        next.selectedFlight.inbound = o;
    }
    if (next.selectedFlight?.inbound) {
        const a = next.selectedFlight.outbound, b = next.selectedFlight.inbound;
        if (!a.legs.at(-1).arrival || Date.parse(b.legs[0].departure) <= Date.parse(a.legs.at(-1).arrival))
            throw Error('回程出發必須晚於去程抵達，請選擇其他班次。');
        if (c.budget !== null && a.total !== null && b.total !== null && a.total + b.total > c.budget)
            throw Error('去回程已知總價超出預算，請選擇其他班次。');
    }
    if (next.constraints)
        next.constraints = { ...next.constraints, accepted: false };
    return next;
}
export function validateSnapshot(p, now = Date.now()) {
    const c = criteriaFor(p), snap = p.selectedFlight;
    if (!snap || snap.criteriaKey !== criteriaKey(c) || criteriaKey(snap.criteria) !== criteriaKey(c))
        throw Error('請先查詢並選擇符合目前條件的航班。');
    if (snap.providerOffer) {
        const checked = snapshotFromOffer(p, snap.providerOffer);
        if (JSON.stringify(checked.outbound) !== JSON.stringify(snap.outbound) || JSON.stringify(checked.inbound) !== JSON.stringify(snap.inbound))
            throw Error('報價快照已變更，請重新選擇。');
        if (snap.outbound.origin !== p.origin || snap.outbound.destination !== p.destination || snap.outbound.date !== p.start || p.end && snap.inbound?.date !== p.end)
            throw Error('報價與日期或航線不符。');
        for (const leg of [...snap.outbound.legs, ...(snap.inbound?.legs ?? [])])
            if (!leg.arrival || Date.parse(leg.arrival) <= Date.parse(leg.departure))
                throw Error('供應商航段時間無效。');
        return snap;
    }
    if (snap.catalogVersion !== CATALOG_VERSION || Date.parse(snap.validUntil) <= now)
        throw Error('航班資料已過期，請重新查詢並確認最新結果。');
    const fresh = searchFlights(c, now);
    for (const direction of ['outbound', 'inbound']) {
        const chosen = snap[direction];
        if (direction === 'inbound' && c.travelType === 'oneway') {
            if (chosen)
                throw Error('單程條件不能包含回程航班。');
            continue;
        }
        if (!chosen)
            throw Error('請選擇回程航班。');
        const actual = fresh[direction].find(x => x.id === chosen.id);
        if (!actual || JSON.stringify(actual) !== JSON.stringify(chosen))
            throw Error('航班時刻、價格或規則已變更，請重新查詢並明確選擇。');
    }
    const legs = [...snap.outbound.legs, ...(snap.inbound?.legs ?? [])];
    let last = 0;
    for (const leg of legs) {
        if (!leg.arrival)
            throw Error('這個班次的抵達時間尚未確認，可保存想法或選擇資料完整的航班。');
        const dep = Date.parse(leg.departure), arr = Date.parse(leg.arrival);
        if (dep < last || arr <= dep)
            throw Error('航段時間先後不成立，請重新選擇航班。');
        last = arr;
    }
    if (c.budget !== null && snap.outbound.total !== null && snap.inbound?.total !== null && snap.outbound.total + (snap.inbound?.total ?? 0) > c.budget)
        throw Error('去回程已知總價超出預算。');
    return snap;
}
export function checkConstraints(o, c) {
    const arrival = o.legs.at(-1).arrival, zone = o.legs.at(-1).arrivalZone;
    if (!arrival)
        return { status: 'unknown', arrival: null, readyAt: null, notes: ['抵達時間未確認，無法判斷接機與到校可行性。'] };
    const buffer = c ? (c.immigrationMinutes + c.baggageMinutes + c.transportMinutes) : 0, readyAt = new Date(Date.parse(arrival) + buffer * 60000).toISOString(), notes = [];
    if (c) {
        for (const [label, limit, test] of [['宿舍尚未開放', c.dormOpen, 'before'], ['可能趕不上報到', c.reportBy, 'after'], ['可能趕不上接機', c.pickupAt, 'pickup']]) {
            if (!limit)
                continue;
            let point;
            try {
                point = Date.parse(localDeparture(limit.slice(0, 10), limit.slice(11, 16) || '00:00', o.destination));
            }
            catch {
                notes.push(label + '時間格式需重新核對');
                continue;
            }
            const ready = test === 'pickup' ? Date.parse(arrival) + (c.immigrationMinutes + c.baggageMinutes) * 60000 : Date.parse(readyAt);
            if (test === 'before' ? ready < point : ready > point)
                notes.push(label + '，請調整個人安排或選擇其他航班。');
        }
        if (c.preferredArrival) {
            const hour = Number(localParts(arrival, zone).time.slice(0, 2));
            if ((hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening') !== c.preferredArrival)
                notes.push('此班次不符合你的抵達時段偏好。');
        }
    }
    return { status: notes.length ? 'conflict' : 'estimated', arrival, readyAt, notes: notes.length ? notes : ['依估算緩衝可銜接；仍須自行核對通關、交通與學校安排。'] };
}
export function recommendations(options, constraints) {
    const complete = options.filter(o => o.total !== null), best = complete.reduce((a, b) => !a || b.total < a.total ? b : a, null);
    const viable = options.filter(o => checkConstraints(o, constraints).status !== 'conflict' && o.legs.every(l => l.arrival));
    const stable = [...viable].sort((a, b) => a.legs.length - b.legs.length || Date.parse(a.legs.at(-1).arrival) - Date.parse(b.legs.at(-1).arrival))[0];
    const flexible = options.filter(o => o.changeFee !== null).sort((a, b) => a.changeFee - b.changeFee)[0];
    return new Map(options.map(o => [o.id, [best?.id === o.id ? '最省 · 此次結果已知總價最低' : '', stable?.id === o.id ? '最穩 · 可銜接且轉機較少' : '', flexible?.id === o.id ? '最靈活 · 已知改期手續費最低' : ''].filter(Boolean)]));
}
/** Adapt a selected, complete timetable option to the existing care/recovery route contract. */
export function flightRoute(o, budget = 300000) {
    const first = o.legs[0], last = o.legs.at(-1);
    if (o.legs.some(l => !l.arrival))
        throw Error('抵達時間待核實，不能建立完整行程。');
    return { id: o.id, origin: o.origin, destination: o.destination, date: o.date, budget, number: o.legs.map(l => l.flight).join(' / '), aircraft: first.aircraft, departure: first.departureLocal.time, arrival: last.arrivalLocal.time, arrivalDate: last.arrivalLocal.day, gate: '待公布', segments: o.legs.map(l => ({ operatingCarrier: l.operator, origin: l.from, destination: l.to, departure: l.departureLocal.time, departureDate: l.departureLocal.day, arrival: l.arrivalLocal.time, arrivalDate: l.arrivalLocal.day, departureUtc: Date.parse(l.departure), arrivalUtc: Date.parse(l.arrival), minutes: (Date.parse(l.arrival) - Date.parse(l.departure)) / 60000, aircraft: l.aircraft })), stops: o.legs.length - 1, connectionMinutes: o.legs.slice(1).reduce((n, l, i) => n + (Date.parse(l.departure) - Date.parse(o.legs[i].arrival)) / 60000, 0), durationMinutes: (Date.parse(last.arrival) - Date.parse(first.departure)) / 60000, delayMinutes: 0, adultFare: o.fare ?? 0, infantFare: 0, total: o.total ?? 0, overBudget: o.total !== null && o.total > budget };
}
