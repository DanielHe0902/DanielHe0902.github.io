import { demoOwned } from '/assets/e680549b4bafa81e51ac/runtime.js';
import { FAMILY } from '/assets/e680549b4bafa81e51ac/demo.js';
import { airport } from '/assets/e680549b4bafa81e51ac/web/travel.js';
import { localParts } from '/assets/e680549b4bafa81e51ac/flight-time.js';
/** Explicitly requested Oct 16 demo history. Add once; never clear user data or credit miles. */
export const COMPLETED_EXAMPLES_VERSION = 1;
const records = [
    { id: 'demo-history-202607-tokyo', title: '東京夏日家庭旅行 · 已完成示例', legs: [
            { from: 'HKG', to: 'NRT', flight: 'CX-DEMO H501', dep: '2026-07-10T02:00:00Z', arr: '2026-07-10T06:20:00Z' },
            { from: 'NRT', to: 'HKG', flight: 'CX-DEMO H502', dep: '2026-07-14T07:30:00Z', arr: '2026-07-14T12:00:00Z' }
        ] },
    { id: 'demo-history-202609-taipei', title: '台北週末家庭旅行 · 已完成示例', legs: [
            { from: 'HKG', to: 'TPE', flight: 'CX-DEMO H401', dep: '2026-09-05T00:30:00Z', arr: '2026-09-05T02:25:00Z' },
            { from: 'TPE', to: 'HKG', flight: 'CX-DEMO H402', dep: '2026-09-08T10:20:00Z', arr: '2026-09-08T12:15:00Z' }
        ] }
];
export const COMPLETED_EXAMPLE_IDS = records.map(r => r.id);
export function installCompletedExamples(input) {
    if (!demoOwned(input) || input.completedExamples?.version === COMPLETED_EXAMPLES_VERSION)
        return input;
    // Fixed past dates never move with the current clock or become upcoming seed trips.
    if (Date.parse(input.demoClock) < Date.parse(records[1].legs[1].arr))
        return input;
    const s = structuredClone(input), personIds = ['father', 'mother', 'student', 'lin-elder', 'lin-child'].filter(id => s.persons[id] && s.memberships.some(m => m.familyId === FAMILY && m.personId === id && m.active));
    if (!personIds.length)
        return input;
    s.journeys ??= { items: {}, selectedId: null, log: [], processed: [] };
    const added = [];
    for (const record of records) {
        if (s.trips[record.id] || s.journeys.items[record.id] || s.tripCleanup?.retired.includes(record.id))
            continue;
        const segments = record.legs.map((leg, index) => ({ id: record.id + '-v1-s' + index, flight: leg.flight, from: leg.from, to: leg.to, zone: airport(leg.to).zone, departure: leg.dep, scheduledArrival: leg.arr, estimatedArrival: leg.arr, actualLanding: leg.arr, completed: true, aircraft: 'A350', terminal: '歷史示例', gate: '歷史示例', updatedAt: leg.arr }));
        const routeSegments = record.legs.map(leg => { const d = localParts(leg.dep, airport(leg.from).zone), a = localParts(leg.arr, airport(leg.to).zone); return { origin: leg.from, destination: leg.to, departure: d.time, departureDate: d.day, arrival: a.time, arrivalDate: a.day, departureUtc: Date.parse(leg.dep), arrivalUtc: Date.parse(leg.arr), minutes: (Date.parse(leg.arr) - Date.parse(leg.dep)) / 60000, aircraft: 'A350' }; });
        const first = routeSegments[0], last = routeSegments.at(-1);
        const t = { id: record.id, familyId: FAMILY, version: 1, title: record.title, historicalExample: true, members: personIds.map(personId => ({ personId, occupiesSeat: true, companionId: null })), snapshots: [], relationships: s.relationships.filter(r => r.familyId === FAMILY && personIds.includes(r.caregiverId) && personIds.includes(r.dependentId)), status: 'completed', checklist: {}, needsReview: false, noCandidates: false, route: { id: record.id, origin: first.origin, destination: first.destination, date: first.departureDate, budget: 0, number: segments.map(l => l.flight).join(' / '), aircraft: 'A350', departure: first.departure, arrival: last.arrival, arrivalDate: last.arrivalDate, gate: '歷史示例', segments: routeSegments, stops: 0, connectionMinutes: 0, durationMinutes: routeSegments.reduce((n, l) => n + l.minutes, 0), delayMinutes: 0, adultFare: 0, infantFare: 0, total: 0, overBudget: false } };
        const j = { id: t.id, title: t.title, ownerId: 'father', familyId: FAMILY, purpose: 'family', historicalExample: true, version: 1, revision: 1, now: s.demoClock, sceneStep: 4, generation: 0, segments, node: 'unknown', nodeAt: last.arrivalDate, routeAt: segments.at(-1).actualLanding, walkMinutes: 0, securityMinutes: 0, reserveMinutes: 10, recheck: 'unknown', arrivalNode: 0, school: { name: '', address: '', dormOpen: '', dormClose: '', confirmed: false }, pickup: { at: '', point: '', status: 'sample', updatedAt: s.demoClock }, pending: [], sharedTo: [], grants: [], fieldTimes: {}, flightSource: '用戶要求補入的已完成演示行程；非真實航空紀錄' };
        s.trips[t.id] = t;
        s.journeys.items[j.id] = j;
        added.push(t.id);
        for (const seg of segments) {
            for (const kind of ['landed', 'flight_completed']) {
                const event = { id: seg.id + ':history:' + kind, kind, tripId: j.id, segmentId: seg.id, familyId: FAMILY, version: 1, occurredAt: seg.actualLanding, receivedAt: s.demoClock, source: 'mock', payload: kind === 'landed' ? { at: seg.actualLanding } : { aircraft: seg.aircraft } };
                s.journeys.log.push({ event, result: '已完成歷史示例 · 按用戶要求補入；不發放里數' });
                s.journeys.processed.push(event.id);
            }
            for (const pid of personIds) {
                if (!Object.values(s.accounts).some(a => a.personId === pid))
                    continue;
                const segmentKey = seg.id + '-' + pid;
                if (s.stamps.some(st => st.segmentKey === segmentKey))
                    continue;
                const stamp = { id: 'stamp:' + segmentKey, personId: pid, segmentKey, familyId: FAMILY, city: seg.to, aircraft: seg.aircraft, date: localParts(seg.actualLanding, seg.zone).day, flight: seg.flight, sharedFamilies: [FAMILY], historicalExample: true };
                s.stamps.push(stamp);
            }
        }
    }
    s.completedExamples = { version: COMPLETED_EXAMPLES_VERSION, at: s.demoClock, tripIds: added, personIds };
    return s;
}
