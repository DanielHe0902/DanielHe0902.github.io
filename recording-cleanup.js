import { demoOwned } from './runtime.js';
/** One-time, user-authorized removal of the identifiable 18 Oct recording trip.
 * No other manual itineraries, completed flights, finance, consent or user messages are changed. */
export function removeRecordingTrip(s) {
    if (!demoOwned(s) || s.recordingCleanup?.id === '2026-10-16-passport')
        return s;
    const ids = Object.values(s.journeys?.items ?? {}).filter(j => j.userManaged && !j.historicalExample && j.ownerId === 'father' && s.trips[j.id]?.status !== 'completed' && j.segments.length === 1 && j.segments[0].from === 'HKG' && j.segments[0].to === 'TPE' && j.segments[0].flight === 'CX-DEMO 401' && j.segments[0].departure.startsWith('2026-10-18') && !j.segments[0].completed).map(j => j.id);
    s.recordingCleanup = { id: '2026-10-16-passport', removed: ids };
    for (const id of ids) {
        delete s.trips[id];
        if (s.journeys) {
            delete s.journeys.items[id];
            if (s.journeys.selectedId === id)
                s.journeys.selectedId = null;
        }
        if (s.selectedTripId === id)
            s.selectedTripId = '';
        for (const f of Object.values(s.families))
            if (f.currentTripId === id)
                f.currentTripId = null;
        for (const a of Object.values(s.dual?.accounts ?? {}))
            if (a.defaultTripId === id)
                a.defaultTripId = '';
        for (const [k, r] of Object.entries(s.requests))
            if (r.tripId === id)
                delete s.requests[k];
        for (const [k, r] of Object.entries(s.reminders ?? {}))
            if (r.tripId === id)
                delete s.reminders[k];
        if (s.experience)
            delete s.experience.plans[id];
        if (s.journeyRecovery)
            delete s.journeyRecovery.records[id];
        for (const p of Object.values(s.booking?.sessions ?? {}))
            if (p.id === id || p.booking?.savedTripId === id) {
                p.booking.phase = 'cancelled';
                delete p.booking.savedTripId;
                delete p.booking.notificationId;
            }
        for (const r of Object.values(s.booking?.care ?? {}))
            if (r.tripId === id)
                r.status = 'cancelled';
        for (const [k, r] of Object.entries(s.booking?.receipts ?? {}))
            if (r.tripId === id)
                delete s.booking.receipts[k];
        for (const [k, n] of Object.entries(s.dual?.notifications ?? {}))
            if (n.kind === 'booking' && n.tripId === id)
                delete s.dual.notifications[k];
        if (s.tripCleanup && !s.tripCleanup.retired.includes(id))
            s.tripCleanup.retired.push(id);
    }
    if (ids.length)
        s.seedVersion = 'user-journeys-v1:recording-2026-10-16';
    return s;
}
