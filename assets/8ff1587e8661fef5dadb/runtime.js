import { emptyProfile } from '/assets/8ff1587e8661fef5dadb/seed.js';
import { installDemoNames } from '/assets/8ff1587e8661fef5dadb/recognition-fixture.js';
import { FAMILY, FUND, PARENT_ACCOUNT, STUDENT_ACCOUNT } from '/assets/8ff1587e8661fef5dadb/demo.js';
/** Stable one-time migration for retired seed journeys; releases preserve manual plans. */
export const TRIP_CLEANUP = '2026-10-14-empty-journeys-v1';
export const STORAGE_VERSION = 3; // Earlier tabs cannot reopen and overwrite the new business contracts.
// Latest brief preserves manually created journeys across releases. Keep this migration marker stable.
export const TRIP_RELEASE = '2.15.2';
export const runtimeNow = () => new Date().toISOString();
export function updateRuntimeClock(s) { s.demoClock = runtimeNow(); for (const j of Object.values(s.journeys?.items ?? {}))
    j.now = s.demoClock; return s; }
export const demoOwned = (s) => s.dual?.accounts[PARENT_ACCOUNT]?.personId === 'father' && s.dual.accounts[STUDENT_ACCOUNT]?.personId === 'student' && !!s.families[FAMILY];
export function emptyStudentPlan(personId) { return { personId, school: '', start: '', exam: '', holiday: '', holidayEnd: '', graduation: '', dorm: '', departure: '', visa: '', origin: '', destination: '', budget: 12000, bags: 2, scenario: 'move', accommodation: false, calendarConfirmed: false, checks: {}, saved: false, subscribed: false, selected: null, sharedWith: null }; }
/** New spaces contain identities and independent member assets, never flight fixtures. */
export function runtimeState() {
    const at = runtimeNow();
    const s = { schemaVersion: 3, identityVersion: 1, epoch: crypto.randomUUID(), counter: 0, demoClock: at, actorId: 'father', activeAccountId: PARENT_ACCOUNT, activeFamilyId: FAMILY, persons: {}, accounts: {}, families: { [FAMILY]: { id: FAMILY, name: '林家的家人', currentTripId: null, goal: 25000, archived: false } }, memberships: [], relationships: [], profiles: {}, trips: {}, requests: {}, journeys: { items: {}, selectedId: null, log: [], processed: [] }, plans: { student: emptyStudentPlan('student') }, tasks: {}, ledger: [], stamps: [], consents: [], events: [], invitations: [], messages: {}, mockMode: 'success', adultSharing: { student: false }, funds: {}, supports: {}, milestones: {} };
    const people = [['father', '林志明', '爸爸', '1963-03-08', 'owner', '父親'], ['mother', '陳慧', '媽媽', '1965-08-09', 'editor', '母親'], ['student', '林晴', '晴晴', '2006-10-01', 'viewer', '女兒'], ['lin-elder', '王秀芳', '外婆', '1950-05-20', 'viewer', '外婆'], ['lin-child', '林小宇', '小宇', '2017-06-12', 'viewer', '弟弟']];
    for (const [id, name, nickname, dob, role, label] of people) {
        s.persons[id] = { id, name, displayName: name, nickname, dob, guardianIds: id === 'lin-child' ? ['father', 'mother'] : [] };
        s.accounts['m-' + id] = { id: 'm-' + id, personId: id, joinedAt: at.slice(0, 10), expiry: '2029-01-01', studentVerified: id === 'student' };
        s.memberships.push({ familyId: FAMILY, personId: id, role, label, referencePersonId: id === 'student' ? 'father' : 'student', active: true });
        s.profiles[FAMILY + ':' + id] = { ...emptyProfile(FAMILY, id), updatedAt: at };
    }
    for (const id of ['mother', 'lin-elder', 'lin-child'])
        s.consents.push({ id: 'dual-consent-' + id, familyId: FAMILY, personId: id, granteeId: 'father', scopes: ['care:view', 'care:edit', 'service', ...(id === 'lin-child' ? ['passport', 'miles'] : [])], grantedBy: id === 'lin-child' ? 'father' : id, active: true });
    Object.assign(s.profiles[FAMILY + ':lin-elder'], { needs: ['wheelchair', 'adjacent'], required: ['adjacent'], walking: '可短距離步行；機場長距離需輪椅協助', stairs: '可自行登梯', wheelchairType: '機場手動輪椅' });
    Object.assign(s.profiles[FAMILY + ':lin-child'], { needs: ['childMeal', 'adjacent'], required: ['adjacent'] });
    s.relationships = [{ familyId: FAMILY, caregiverId: 'father', dependentId: 'lin-elder', required: true }, { familyId: FAMILY, caregiverId: 'mother', dependentId: 'lin-child', required: true }];
    s.dual = { version: 1, generation: 1, accounts: {}, grants: [{ personId: 'student', granteeId: 'father', fundId: FUND, fields: ['beneficiary', 'title', 'route', 'travelWindow', 'target', 'confirmedSupport'], support: true }], tasks: {}, transactions: {}, journal: [], notifications: {}, thanks: {}, studentScene: 'normal', revision: 1 };
    for (const [id, personId, role, amount] of [[PARENT_ACCOUNT, 'father', 'parent', 60000], [STUDENT_ACCOUNT, 'student', 'student', 8000]]) {
        s.dual.accounts[id] = { accountId: id, personId, memberId: 'm-' + personId, role, defaultTripId: '', ledgerRef: 'm-' + personId, workspace: role === 'parent' ? '林家的家庭出行' : '我的個人旅程' };
        s.ledger.push({ id: 'dual-opening:' + personId, key: 'dual-opening:' + personId, memberId: 'm-' + personId, amount, kind: 'opening', at, qualifying: false });
    }
    s.funds[FUND] = { id: FUND, ownerId: 'student', title: '林晴的回家基金', origin: 'LHR', destination: 'HKG', from: '2027-02-01', until: '2027-02-15', target: 20000, token: crypto.randomUUID(), invited: ['father'], status: 'open', inventory: true, landingConsent: false, landed: false, redemption: null, reminders: {} };
    return clearRetiredTrips(installDemoNames(s));
}
/** Runs transactionally for this one recognized demo space, never iterates other spaces. */
export function clearRetiredTrips(input) {
    if (!demoOwned(input) || input.tripCleanup?.id === TRIP_CLEANUP)
        return input;
    const s = structuredClone(input), at = runtimeNow();
    const ids = [...new Set([...(s.tripCleanup?.retired ?? []), 'trip-a', 'trip-b', 'trip-c', 'student-term-2027', 'lin-tokyo-2027', 'lin-student-return-2027', ...Object.keys(s.trips ?? {}), ...Object.keys(s.journeys?.items ?? {}), ...Object.keys(s.journeyRecovery?.records ?? {}), ...Object.keys(s.experience?.plans ?? {})])];
    const retired = new Set(ids);
    // Tombstones contain identifiers only; no itineraries or resumable versions.
    s.tripCleanup = { id: TRIP_CLEANUP, release: TRIP_RELEASE, at, generation: (s.tripCleanup?.generation ?? 0) + 1, retired: ids };
    s.epoch = crypto.randomUUID();
    s.journeyRelease = { version: TRIP_CLEANUP + ':' + TRIP_RELEASE, retired: ids };
    s.seedVersion = 'user-journeys-v1';
    s.recoverySeedVersion = 'user-journeys-v1';
    s.trips = {};
    s.requests = {};
    s.journeys = { items: {}, selectedId: null, log: [], processed: [] };
    s.selectedTripId = '';
    s.messages = {};
    if (s.experience)
        s.experience.plans = {};
    // Keep independent school calendar, visa and preferences; detach the saved itinerary.
    for (const p of Object.values(s.plans ?? {})) {
        p.saved = false;
        p.selected = null;
        p.departure = '';
        p.checks = {};
    }
    for (const f of Object.values(s.families))
        f.currentTripId = null;
    if (s.dual) {
        s.dual.tasks = {};
        s.dual.studentScene = 'normal';
        delete s.dual.familySelection;
        for (const a of Object.values(s.dual.accounts))
            a.defaultTripId = '';
        s.dual.revision++;
    }
    for (const a of Object.values(s.externalAccounts ?? {}))
        a.defaultTripId = '';
    // Earned evidence/deduplication survives; pending trip-specific work cannot run again.
    s.tasks = Object.fromEntries(Object.entries(s.tasks ?? {}).filter(([, t]) => !t.tripId || t.status === 'credited'));
    // Document/packing eligibility came from the now-removed trip checklist. Keep
    // credited evidence and keys, but require fresh preparation for unearned work.
    if (s.learning)
        for (const [key, e] of Object.entries(s.learning.events))
            if (e.kind !== 'calendar' && e.status !== 'credited' && !s.ledger.some(l => l.key === key))
                delete s.learning.events[key];
    s.events = (s.events ?? []).filter(e => !e.tripId);
    s.reminders = Object.fromEntries(Object.entries(s.reminders ?? {}).filter(([, r]) => !r.tripId));
    s.serviceCases = {};
    for (const f of Object.values(s.feedbackRewards ?? {}))
        if (retired.has(f.tripId) && f.status !== 'credited') {
            f.status = 'ineligible';
            f.reason = '此行程已移除；原記錄僅供追溯';
            delete f.dueAt;
        }
    // Forward-compatible detached pointers; balances/goals/redemptions are retained verbatim.
    for (const f of Object.values(s.funds)) {
        const refs = f;
        for (const key of ['tripId', 'planId', 'journeyId'])
            if (typeof refs[key] === 'string')
                delete refs[key];
    }
    delete s.legacyJourneyArchive;
    delete s.storyHistory;
    delete s.storyMigration;
    delete s.journeyRecovery;
    delete s.scenario;
    return updateRuntimeClock(s);
}
