import { recoverJourneys } from '/assets/e680549b4bafa81e51ac/journey-data.js';
const legacyId = 'student-term-2027', legacyStart = '2027-09-18T02:00:00.000Z';
const valid = (at) => typeof at === 'string' && Number.isFinite(Date.parse(at));
/** One clock per shared demo space. Selecting a trip never changes time. */
export function synchronizeClocks(s) {
    recoverJourneys(s);
    if (s.dual)
        for (const j of Object.values(s.journeys?.items ?? {}))
            if (j.now !== s.demoClock) {
                j.now = s.demoClock;
                j.revision++;
            }
    return s;
}
export function advanceDemoTime(s, at) {
    if (!valid(at))
        throw Error('演示時間無效。');
    s.demoClock = new Date(Math.max(Date.parse(s.demoClock), Date.parse(at))).toISOString();
    return synchronizeClocks(s);
}
/** Repair only the known untouched transfer fixture; retain deliberate replay evidence. */
export function migrateTimeline(s) {
    if (!s.dual)
        return s;
    recoverJourneys(s);
    if (!s.timelineMigration) {
        const removed = [], j = s.journeys?.items[legacyId];
        const accepted = (s.journeys?.log ?? []).filter(x => x.result === '已应用');
        const ownEvents = accepted.filter(x => x.event.tripId === legacyId);
        if (j && j.ownerId === 'student' && !j.familyId && j.sceneStep === 0 && !ownEvents.length && j.segments.length === 2 && j.segments[0].from === 'PVG' && j.segments[0].to === 'HKG' && j.segments[1].to === 'LHR' && j.segments[0].departure === '2027-09-17T23:15:00Z' && j.segments[0].actualLanding === '2027-09-18T01:45:00Z' && !j.segments.some(x => x.completed) && !j.segments[1].actualLanding) {
            delete j.segments[0].actualLanding;
            j.node = 'unknown';
            j.nodeAt = s.demoClock;
            j.routeAt = s.demoClock;
            for (const leg of j.segments)
                if (leg.updatedAt === legacyStart)
                    leg.updatedAt = s.demoClock;
            if (j.pickup.updatedAt === legacyStart)
                j.pickup.updatedAt = s.demoClock;
            removed.push(j.segments[0].id + ': 移除舊樣例預填抵達，並非使用者事件');
        }
        // Keep already played events and actual records; move the shared clock forward
        // instead of erasing history or pretending that January and September coexist.
        const evidence = [s.demoClock, ...accepted.map(x => x.event.occurredAt), ...Object.values(s.journeys?.items ?? {}).flatMap(x => x.segments.filter(seg => seg.actualLanding && Date.parse(seg.actualLanding) >= Date.parse(seg.departure) && Date.parse(seg.actualLanding) <= Date.parse(x.now)).map(seg => seg.actualLanding))].filter(valid);
        s.demoClock = new Date(Math.max(...evidence.map(Date.parse))).toISOString();
        s.timelineMigration = { version: 1, at: s.demoClock, removed };
    }
    return synchronizeClocks(s);
}
