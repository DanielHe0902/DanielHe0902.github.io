import { COMPLETED_EXAMPLE_IDS } from '/assets/ee1ad71b9a14d41f146c/completed-examples.js';
import { demoOwned } from '/assets/ee1ad71b9a14d41f146c/runtime.js';
/** Explicit Oct 19 cleanup request. This fixed cutoff never advances on startup/releases. */
export const REQUESTED_TRIP_CLEANUP = '2026-10-19-test-trips-third-request';
export const CLEANUP_CUTOFF = '2026-10-19T02:04:56.000Z';
export function needsRequestedCleanup(s, space) {
    return !!s && demoOwned(s) && (!s.requestedTripCleanup || Date.parse(s.requestedTripCleanup.cutoff) < Date.parse(CLEANUP_CUTOFF)) && !/^(qa-|recording-)/.test(space);
}
function removeWhere(items, predicate) {
    if (items)
        for (const [key, value] of Object.entries(items))
            if (predicate(value, key))
                delete items[key];
}
export function removeRequestedTrips(s, space, now = Date.now()) {
    if (!needsRequestedCleanup(s, space))
        return s;
    const keep = new Set(COMPLETED_EXAMPLE_IDS), cutoff = Date.parse(CLEANUP_CUTOFF);
    const all = new Set([...Object.keys(s.trips), ...Object.keys(s.journeys?.items ?? {}), ...Object.keys(s.experience?.plans ?? {}), ...Object.keys(s.booking?.sessions ?? {})]);
    const ids = new Set([...all].filter(id => {
        if (keep.has(id))
            return false;
        const j = s.journeys?.items[id], p = s.booking?.sessions[id] ?? s.experience?.plans[id];
        const first = s.flightChanges?.recording.find(t => t.tripId === id)?.confirmedAt;
        const receipt = Object.values(s.booking?.receipts ?? {}).find(r => r.tripId === id);
        const savedAt = first ?? Date.parse(receipt?.createdAt ?? '');
        if (Number.isFinite(savedAt))
            return savedAt <= cutoff;
        const times = [j?.flightHistory?.[0]?.at, j?.routeAt, ...(j ? [] : [p?.updatedAt])].map(t => Date.parse(t ?? '')).filter(Number.isFinite);
        // Unknown legacy dates are pre-existing records; known post-request work survives.
        return !times.length || Math.min(...times) <= cutoff;
    }));
    s.requestedTripCleanup = { id: REQUESTED_TRIP_CLEANUP, at: new Date(now).toISOString(), cutoff: CLEANUP_CUTOFF, removed: [...ids] };
    if (!ids.size)
        return s;
    const requests = new Set(Object.values(s.requests).filter(r => ids.has(r.tripId)).map(r => r.id));
    const segments = new Set([...ids].flatMap(id => { const j = s.journeys?.items[id]; return [...(j?.segments ?? []), ...(j?.flightHistory ?? []).flatMap(h => h.segments)].map(seg => seg.id); }));
    for (const id of ids) {
        delete s.trips[id];
        if (s.journeys)
            delete s.journeys.items[id];
        if (s.experience)
            delete s.experience.plans[id];
        if (s.journeyRecovery)
            delete s.journeyRecovery.records[id];
    }
    removeWhere(s.requests, r => ids.has(r.tripId));
    removeWhere(s.serviceCases, r => ids.has(r.tripId) || requests.has(r.requestId));
    removeWhere(s.followUps, r => requests.has(r.requestId));
    removeWhere(s.serviceJobs, r => ids.has(r.envelope.tripId) || requests.has(r.requestId));
    removeWhere(s.serviceReplies, r => ids.has(r.envelope.tripId) || requests.has(r.envelope.requestId));
    removeWhere(s.reminders, r => !!r.tripId && ids.has(r.tripId));
    removeWhere(s.tasks, r => !!r.tripId && ids.has(r.tripId) && r.status !== 'credited');
    s.events = s.events.filter(e => !e.tripId || !ids.has(e.tripId));
    // Preserve earned balances, reward evidence and the original 20 historical stamps.
    s.stamps = s.stamps.filter(st => st.historicalExample || ![...segments].some(id => st.segmentKey.startsWith(id + '-')));
    if (s.journeys) {
        s.journeys.log = s.journeys.log.filter(r => !ids.has(r.event.tripId));
        if (ids.has(s.journeys.selectedId ?? ''))
            s.journeys.selectedId = null;
    }
    if (ids.has(s.selectedTripId ?? ''))
        s.selectedTripId = '';
    for (const f of Object.values(s.families))
        if (ids.has(f.currentTripId ?? ''))
            f.currentTripId = null;
    for (const a of Object.values({ ...s.dual?.accounts, ...s.externalAccounts }))
        if (ids.has(a.defaultTripId))
            a.defaultTripId = '';
    if (s.dual) {
        removeWhere(s.dual.tasks, t => ids.has(t.tripId));
        removeWhere(s.dual.notifications, n => !!n.tripId && ids.has(n.tripId));
        if (ids.has(s.dual.familySelection ?? ''))
            delete s.dual.familySelection;
        s.dual.revision++;
    }
    if (s.booking) {
        removeWhere(s.booking.sessions, p => ids.has(p.id) || ids.has(p.booking?.savedTripId ?? ''));
        removeWhere(s.booking.care, c => ids.has(c.draftId) || ids.has(c.tripId ?? ''));
        removeWhere(s.booking.receipts, r => ids.has(r.tripId));
    }
    if (s.flightChanges) {
        s.flightChanges.recording = s.flightChanges.recording.filter(t => !ids.has(t.tripId));
        removeWhere(s.flightChanges.events, e => ids.has(e.tripId));
    }
    for (const r of Object.values(s.feedbackRewards ?? {}))
        if (ids.has(r.tripId) && r.status !== 'credited') {
            r.status = 'ineligible';
            r.reason = '此測試行程已按要求移除';
            delete r.dueAt;
        }
    if (s.scenario && ids.has(s.scenario.tripId))
        delete s.scenario;
    // Retire identifiers so stale assistants, forms and delayed tab writes cannot restore them.
    if (s.tripCleanup)
        s.tripCleanup.retired = [...new Set([...s.tripCleanup.retired, ...ids])];
    s.seedVersion = 'user-journeys-v1:' + REQUESTED_TRIP_CLEANUP;
    return s;
}
