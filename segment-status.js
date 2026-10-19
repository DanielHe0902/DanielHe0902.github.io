import { userCancelledSegment } from './trip-decision.js';
/** Legacy cancellation covered the whole trip. Bound events affect only their segment. */
export function segmentCancelled(s, tripId, segmentId) { if (userCancelledSegment(s, tripId, segmentId))
    return true; const personal = !s.trips[tripId] && Object.values(s.flightChanges?.events ?? {}).find(e => e.tripId === tripId && e.segmentId === segmentId && e.type === 'cancel' && e.status !== 'rebooked'); if (personal)
    return true; const t = s.trips[tripId]; if (t?.status !== 'cancelled')
    return false; const e = t.flightChangeId && s.flightChanges?.events[t.flightChangeId]; return !e || e.segmentId === segmentId; }
