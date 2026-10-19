const object = (x) => !!x && typeof x === 'object' && !Array.isArray(x);
const date = (x) => typeof x === 'string' && Number.isFinite(Date.parse(x));
export function usableJourney(x) { return object(x) && Array.isArray(x.segments) && x.segments.length > 0 && x.segments.every((leg) => object(leg) && typeof leg.id === 'string' && typeof leg.from === 'string' && typeof leg.to === 'string' && date(leg.departure) && (leg.estimatedArrival === undefined || date(leg.estimatedArrival)) && date(leg.scheduledArrival)); }
export function needsJourneyRecovery(s) { return Object.values(s.journeys?.items ?? {}).some(x => !usableJourney(x)); }
/** Keep original malformed values for diagnosis; never invent a replacement trip. */
export function recoverJourneys(s) {
    if (!s.journeys)
        return s;
    for (const [id, record] of Object.entries(s.journeys.items))
        if (!usableJourney(record)) {
            s.journeyRecovery ??= { version: 1, records: {} };
            const existing = s.journeyRecovery.records[id];
            if (!existing)
                s.journeyRecovery.records[id] = { original: structuredClone(record), at: s.demoClock, reason: record == null ? 'empty-record' : 'invalid-segments' };
            else if (JSON.stringify(existing.original) !== JSON.stringify(record) && !existing.later?.some(x => JSON.stringify(x) === JSON.stringify(record)))
                (existing.later ??= []).push(structuredClone(record));
            delete s.journeys.items[id];
            if (s.journeys.selectedId === id)
                s.journeys.selectedId = null;
        }
    return s;
}
export function journeyNeedsReview(s, id) { return !!s.journeyRecovery?.records[id] && !s.journeys?.items[id]; }
export function canReadJourneyReview(s, id) {
    if (!journeyNeedsReview(s, id))
        return false;
    const raw = s.journeyRecovery.records[id].original;
    if (object(raw) && !raw.familyId && raw.ownerId === s.actorId)
        return true;
    const familyId = s.trips[id]?.familyId ?? (object(raw) ? raw.familyId : null);
    if (familyId) {
        const member = s.memberships.find(m => m.active && m.familyId === familyId && m.personId === s.actorId);
        return !!member && !s.families[familyId]?.archived && (member.role !== 'viewer' || !!s.trips[id]?.members.some(m => m.personId === s.actorId));
    }
    return Object.values(s.dual?.accounts ?? {}).some(a => a.personId === s.actorId && a.defaultTripId === id) || id === 'student-term-2027' && s.actorId === 'student';
}
