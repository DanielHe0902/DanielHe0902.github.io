import { assess } from '/assets/e680549b4bafa81e51ac/domain.js';
import { profileForAssessment } from '/assets/e680549b4bafa81e51ac/care-registry.js';
import { BASSINET_RULE, aircraftLayout, seatsAdjacent, bassinetAvailability } from '/assets/e680549b4bafa81e51ac/aircraft-care.js';
import { searchFlights, flightRoute, SERVICES } from '/assets/e680549b4bafa81e51ac/flights.js';
import { addDays, localParts } from '/assets/e680549b4bafa81e51ac/flight-time.js';
import { airport } from '/assets/e680549b4bafa81e51ac/web/travel.js';
export const RECOVERY_VERSION = 'five-seat-layout-2';
// A declared 3+3 DEMO cabin, not an aircraft inventory. C/D are across an aisle.
export const CABIN = Array.from({ length: 40 }, (_, i) => ['ABC', 'DEF'].flatMap(block => [...block].map((letter, index) => ({ id: (i + 1) + letter, block: (i + 1) + block, index })))).flat();
export function adjacent(a, b) { const x = CABIN.find(s => s.id === a), y = CABIN.find(s => s.id === b); return !!x && !!y && x.block === y.block && Math.abs(x.index - y.index) === 1; }
export function tripDemand(t) { const travellers = t.members, carePairs = t.relationships.filter(r => r.required && travellers.some(m => m.personId === r.dependentId)); return { tripId: t.id, tripVersion: t.version, travellers, travellerCount: travellers.length, requiredSeatCount: travellers.filter(m => m.occupiesSeat).length, carePairs, careTravellerCount: new Set(carePairs.flatMap(r => [r.caregiverId, r.dependentId])).size }; }
export function inventory(t, id) {
    if (t.recoveryInventory?.[id])
        return structuredClone(t.recoveryInventory[id]);
    const family = t.id === 'lin-tokyo-2027';
    const seats = id === 'earliest' ? ['22A', '22B', '22C'] : id === 'early' ? ['22A', '22B', '38D', '38E', '38F'] : ['24A', '24B', '24C', '24D', '24E'];
    const assignments = family ? (id === 'early' ? { father: '22A', 'lin-elder': '22B', mother: '38D', 'lin-child': '38E', student: '38F' } : id === 'later' ? { father: '24A', 'lin-elder': '24B', student: '24C', mother: '24D', 'lin-child': '24E' } : { father: '22A', 'lin-elder': '22B', student: '22C' }) : {};
    if (!family) {
        for (const pair of tripDemand(t).carePairs) {
            if (!t.members.find(m => m.personId === pair.dependentId)?.occupiesSeat)
                continue;
            const available = seats.filter(x => !Object.values(assignments).includes(x));
            const a = available.find(x => available.some(y => adjacent(x, y)));
            const b = available.find(x => a && adjacent(a, x));
            if (a && b) {
                assignments[pair.caregiverId] = a;
                assignments[pair.dependentId] = b;
            }
        }
        for (const m of t.members.filter(m => m.occupiesSeat && !assignments[m.personId])) {
            const free = seats.find(x => !Object.values(assignments).includes(x));
            if (free)
                assignments[m.personId] = free;
        }
    }
    return { version: RECOVERY_VERSION, seats, assignments, difference: id === 'early' ? 320 : id === 'later' ? 180 : 0, layoutKnown: true };
}
export function evaluateCandidate(s, t, c, stock) {
    const layout = stock.layout ?? CABIN;
    const d = tripDemand(t), reasons = [], unknown = [], seated = d.travellers.filter(m => m.occupiesSeat), seats = stock.seats;
    if (seats === null)
        unknown.push('候選容量待核實');
    else if (seats.length < d.requiredSeatCount)
        reasons.push(`可用 ${seats.length} 座 / 需要 ${d.requiredSeatCount} 座，缺少 ${d.requiredSeatCount - seats.length} 座`);
    if (!stock.layoutKnown)
        unknown.push('機艙相鄰座位塊資料待核實');
    const assigned = seated.map(m => stock.assignments[m.personId]);
    if (assigned.some(x => !x))
        reasons.push('候選分座遺漏占座旅客');
    if (new Set(assigned.filter(Boolean)).size !== assigned.filter(Boolean).length)
        reasons.push('候選存在重複分座');
    if (assigned.some(x => x && (!layout.some(y => y.id === x) || seats && !seats.includes(x))))
        reasons.push('分配使用不存在或不在庫存內的座位');
    if (new Set(t.members.map(m => m.personId)).size !== t.members.length)
        reasons.push('同行名單有重複旅客');
    const pairs = d.carePairs.map(p => { const child = t.members.find(m => m.personId === p.dependentId), lap = child && !child.occupiesSeat && child.companionId === p.caregiverId && !!stock.assignments[p.caregiverId]; return { ...p, result: !stock.layoutKnown ? 'unknown' : lap || seatsAdjacent(layout, stock.assignments[p.caregiverId], stock.assignments[p.dependentId]) ? 'pass' : 'fail' }; });
    if (pairs.some(p => p.result === 'fail'))
        reasons.push('必要照護相鄰未滿足（跨過道不算相鄰）');
    const services = t.snapshots.filter(x => t.members.some(m => m.personId === x.personId)).flatMap(x => x.profile.needs.filter(k => k !== 'adjacent').map(kind => ({ personId: x.personId, kind, required: x.profile.required.includes(kind), status: kind === 'bassinet' && bassinetAvailability(c.route.aircraft, c.route.segments[0]?.operatingCarrier ?? 'CX') === 'unavailable' ? 'unavailable' : kind === 'bassinet' && assess(profileForAssessment(s, x.profile, c.route.date), kind, c.route.aircraft, s.demoClock, c.route.segments[0]?.operatingCarrier).applicability !== 'eligible' ? 'verify' : kind === 'bassinet' ? bassinetAvailability(c.route.aircraft, c.flightOption?.legs[0].operator ?? c.route.segments[0]?.operatingCarrier ?? 'CX') : kind === 'ownWheelchair' || stock.instanceId && !stock.services?.includes(kind) ? 'verify' : 'pending' })));
    if (services.some(x => x.required && x.status === 'unavailable'))
        reasons.push('必要服務：國泰 A321neo 不提供嬰兒籃，不能選擇此方案');
    if (services.some(x => x.required && x.status === 'verify'))
        unknown.push('必要設備條件待人工核實');
    const current = t.route.segments[0], replacement = c.route.segments[0];
    if (s.seedVersion && Date.parse(s.demoClock) >= replacement.departureUtc)
        reasons.push('候選已過出發時間');
    if (t.route.segments[1] && replacement.arrivalUtc >= t.route.segments[1].departureUtc)
        reasons.push('替代去程與後續航段時間重疊');
    if (t.status === 'cancelled' && c.route.number === t.route.number && replacement.departureUtc === current.departureUtc)
        reasons.push('候選仍是已取消的同一航班實例');
    if (t.noCandidates)
        reasons.push('目前已無可安排座位');
    const status = reasons.length ? 'unavailable' : unknown.length ? 'verify' : services.length ? 'pending-services' : 'available';
    const followups = services.length ? ['新航段特殊服務須重新申請，並核對相應回執。'] : ['鄰座安排待確認。'];
    const fingerprint = JSON.stringify({ serviceRuleVersion: BASSINET_RULE.version, tripId: t.id, version: t.version, members: t.members, pairs: t.relationships, snapshots: t.snapshots, stock, route: c.route, noCandidates: t.noCandidates, status });
    return { tripId: t.id, segmentId: t.id + '-v' + t.version + '-s0', tripVersion: t.version, candidateId: c.id, inventoryVersion: stock.version, travellerCount: d.travellerCount, requiredSeatCount: d.requiredSeatCount, availableSeatCount: seats?.length ?? null, assignments: Object.fromEntries(seated.filter(m => stock.assignments[m.personId]).map(m => [m.personId, stock.assignments[m.personId]])), pairs, services, status, reasons: [...reasons, ...unknown], followups, fingerprint };
}
function candidateInventory(t, o) {
    const aircraft = o.legs[0].aircraft, layout = aircraftLayout(aircraft, o.cabin), seats = o.capacity === null ? null : layout.slice(0, o.capacity).map(s => s.id), assignments = {};
    for (const pair of tripDemand(t).carePairs) {
        if (!t.members.find(m => m.personId === pair.dependentId)?.occupiesSeat)
            continue;
        const free = (seats ?? []).filter(x => !Object.values(assignments).includes(x));
        const a = free.find(x => free.some(y => seatsAdjacent(layout, x, y))), b = free.find(x => a && seatsAdjacent(layout, a, x));
        if (a && b) {
            assignments[pair.caregiverId] = a;
            assignments[pair.dependentId] = b;
        }
    }
    for (const m of t.members.filter(m => m.occupiesSeat && !assignments[m.personId])) {
        const free = seats?.find(x => !Object.values(assignments).includes(x));
        if (free)
            assignments[m.personId] = free;
    }
    return { services: SERVICES.find(row => o.id.startsWith(row.id + ':'))?.careServices, version: o.catalogVersion + ':' + o.id, seats, layout, assignments, layoutKnown: !!layout.length, instanceId: o.id, aircraft, cabin: o.cabin, difference: Math.max(0, (o.total ?? t.route.total) - t.route.total) };
}
export function recoveryCandidates(s, t) {
    const first = t.route.segments[0], base = [first.departureDate, localParts(s.demoClock, airport(first.origin).zone).day].sort().at(-1), options = [];
    for (let offset = 0; offset < 7 && options.length < 3; offset++) {
        const c = { origin: first.origin, destination: first.destination, outboundDate: addDays(base, offset), returnDate: '', travelType: 'oneway', travelerIds: t.members.map(m => m.personId), lapInfantIds: t.members.filter(m => !m.occupiesSeat).map(m => m.personId), familyId: t.familyId, cabin: (s.booking?.sessions[t.id]?.cabin ?? 'economy'), bags: 1, budget: null, departurePeriod: 'any', flexible: false };
        const found = searchFlights(c).outbound.filter(o => o.legs.length === 1 && o.legs.every(l => l.arrival) && Date.parse(o.legs[0].departure) > Date.parse(s.demoClock) && !(Date.parse(o.legs[0].departure) === first.departureUtc && t.route.number.includes(o.legs[0].flight)));
        options.push(...found.sort((a, b) => Date.parse(a.legs[0].departure) - Date.parse(b.legs[0].departure)));
        if (t.flightChangeId && options.filter(o => o.capacity !== null && aircraftLayout(o.legs[0].aircraft).length).length >= 2)
            break;
    }
    return options.slice(0, 3).map((o, i) => {
        const id = ['earliest', 'early', 'later'][i], stock = t.flightChangeId ? candidateInventory(t, o) : inventory(t, id), route = flightRoute(o, t.route.budget);
        if (t.route.segments[1]) {
            route.segments.push(...structuredClone(t.route.segments.slice(1)));
            route.destination = t.route.destination;
            route.arrival = t.route.arrival;
            route.arrivalDate = t.route.arrivalDate;
            route.durationMinutes = (route.segments.at(-1).arrivalUtc - route.segments[0].departureUtc) / 60000;
        }
        if (t.flightChangeId) {
            const original = s.flightChanges?.events[t.flightChangeId]?.order?.affectedAmount;
            stock.difference = original !== undefined && o.total !== null ? Math.max(0, o.total - original) : 0;
        }
        const c = { id, flightOption: structuredClone(o), cabin: o.cabin, feeKnown: !t.flightChangeId || !!s.flightChanges?.events[t.flightChangeId]?.order?.paid && o.total !== null, label: ['最早航班', '較早航班 · 核對照護組位置', '較晚航班 · 核對相鄰位置'][i], route, seats: stock.seats?.length ?? 0, eligible: false, reasons: [], difference: stock.difference, bassinet: bassinetAvailability(route.aircraft) === 'unavailable' ? 'unavailable' : 'pending', adjacent: false };
        const evaluation = evaluateCandidate(s, t, c, stock);
        c.evaluation = evaluation;
        c.eligible = ['available', 'pending-services'].includes(evaluation.status);
        c.reasons = evaluation.reasons;
        c.adjacent = evaluation.pairs.every(x => x.result === 'pass');
        c.seatGroups = Object.entries(evaluation.assignments).map(([p, seat]) => seat + ' ' + (s.persons[p]?.displayName ?? s.persons[p]?.name ?? '同行旅客'));
        return c;
    });
}
/** Repair only known fixture metadata. Never reset selections, financial records or custom routes. */
export function migrateRecovery(s) {
    if (s.recoverySeedVersion === RECOVERY_VERSION)
        return s;
    const t = s.trips['lin-tokyo-2027'];
    if (t && t.route.origin === 'HKG' && t.route.destination === 'NRT' && t.route.date === '2027-01-08') {
        s.storyHistory ??= {};
        s.storyHistory['recovery:' + RECOVERY_VERSION] = structuredClone({ candidateSeats: t.candidateSeats, candidateSeatGroups: t.candidateSeatGroups, recoveryInventory: t.recoveryInventory });
        if (t.members.some(m => m.personId === 'student') && t.candidateSeats && !t.candidateSeats.student) {
            const seat = t.route.number === 'CX-DEMO 468' ? '24C' : t.route.number === 'CX-DEMO 460' ? '38F' : '23A';
            if (!Object.values(t.candidateSeats).includes(seat))
                t.candidateSeats.student = seat;
        }
        if (t.candidateSeats)
            t.candidateSeatGroups = Object.entries(t.candidateSeats).map(([p, seat]) => seat + ' ' + (s.persons[p]?.name ?? p));
    }
    s.recoverySeedVersion = RECOVERY_VERSION;
    return s;
}
