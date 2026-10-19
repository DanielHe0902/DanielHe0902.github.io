import { seed } from '/assets/e680549b4bafa81e51ac/seed.js';
import { CLOCK, FAMILY, FAMILY_TRIP, STUDENT_TRIP, migrateDemo, syncFamilyJourney } from '/assets/e680549b4bafa81e51ac/demo.js';
export const JOURNEY_RELEASE = '2026-10-11-current';
export const needsJourneyRefresh = (s) => s?.journeyRelease?.version !== JOURNEY_RELEASE;
/** One explicitly requested replacement of old trip fixtures, not a reset on every load. */
export function refreshJourneyRelease(input) {
    if (input.tripCleanup || !needsJourneyRefresh(input))
        return input;
    const s = structuredClone(input);
    s.legacyJourneyArchive ??= structuredClone({ trips: s.trips, requests: s.requests, journeys: s.journeys, stamps: s.stamps, messages: s.messages, events: s.events, tasks: s.tasks, plans: s.plans, dualTasks: s.dual?.tasks });
    delete s.seedVersion;
    const retired = [...new Set(['student-term-2027', 'trip-a', 'trip-b', 'trip-c', ...Object.keys(s.trips ?? {}), ...Object.keys(s.journeys?.items ?? {}), ...Object.keys(s.journeyRecovery?.records ?? {})])].filter(id => id !== STUDENT_TRIP && id !== FAMILY_TRIP);
    // Discard old flight progress before running compatibility code: even malformed
    // legacy rows/logs must not prevent replacement with the published fixtures.
    s.trips = {};
    s.requests = {};
    delete s.journeys;
    delete s.journeyRecovery;
    delete s.sceneMigration;
    delete s.timelineMigration;
    s.demoClock = CLOCK;
    s.stamps = [];
    s.messages = {};
    s.events = (s.events ?? []).filter(e => !e.tripId);
    s.tasks = Object.fromEntries(Object.entries(s.tasks ?? {}).filter(([, t]) => !t.tripId));
    const next = migrateDemo(s), fresh = migrateDemo(seed());
    next.trips = { [FAMILY_TRIP]: fresh.trips[FAMILY_TRIP] };
    next.requests = Object.fromEntries(Object.entries(fresh.requests).filter(([, r]) => r.tripId === FAMILY_TRIP));
    next.journeys = { items: { [STUDENT_TRIP]: fresh.journeys.items[STUDENT_TRIP] }, selectedId: null, log: [], processed: [] };
    next.plans.student = fresh.plans.student;
    const priorPlan = input.plans?.student, baseline = migrateDemo(seed()).plans.student;
    if (priorPlan)
        for (const field of ['budget', 'bags', 'saved', 'selected', 'accommodation'])
            if (priorPlan[field] !== undefined && priorPlan[field] !== baseline[field])
                next.plans.student[field] = priorPlan[field];
    const priorStudent = input.journeys?.items?.[STUDENT_TRIP];
    if (priorStudent?.draft)
        next.journeys.items[STUDENT_TRIP].draft = structuredClone(priorStudent.draft);
    if (Array.isArray(priorStudent?.pending))
        next.journeys.items[STUDENT_TRIP].pending = structuredClone(priorStudent.pending);
    for (const f of Object.values(next.families))
        f.currentTripId = f.id === FAMILY ? FAMILY_TRIP : null;
    next.dual.tasks = fresh.dual.tasks;
    next.dual.studentScene = 'exception';
    delete next.dual.familySelection;
    next.dual.accounts['demo-student'].defaultTripId = STUDENT_TRIP;
    next.dual.accounts['demo-parent'].defaultTripId = FAMILY_TRIP;
    next.dual.revision++;
    next.selectedTripId = next.activeAccountId === 'demo-student' ? STUDENT_TRIP : FAMILY_TRIP;
    next.activeFamilyId = FAMILY;
    next.demoClock = CLOCK;
    next.timelineMigration = fresh.timelineMigration;
    next.sceneMigration = fresh.sceneMigration;
    next.journeyRelease = { version: JOURNEY_RELEASE, retired };
    return syncFamilyJourney(next);
}
