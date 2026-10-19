import { FAMILY, FAMILY_TRIP, STUDENT_TRIP, fixtureRoute, syncFamilyJourney } from '/assets/5c5eb8250e82e8e3ffd2/demo.js';
import { emptyProfile } from '/assets/5c5eb8250e82e8e3ffd2/seed.js';
import { buildItinerary } from '/assets/5c5eb8250e82e8e3ffd2/web/travel.js';
export const SEED_VERSION = '2027-family-first-1';
export const STORY = { clock: '2027-01-05T02:00:00.000Z', out: '2027-01-08T03:00:00.000Z', outArrival: '2027-01-08T07:15:00.000Z', back: '2027-01-12T08:30:00.000Z', backArrival: '2027-01-12T13:15:00.000Z', schoolFlight: '2027-01-18T02:00:00.000Z', delayedFlight: '2027-01-18T06:00:00.000Z', schoolArrival: '2027-01-18T16:00:00.000Z', delayedArrival: '2027-01-18T20:00:00.000Z', dormOpen: '2027-01-17T08:00:00.000Z', dormClose: '2027-01-18T21:00:00.000Z', pickup: '2027-01-18T18:00:00.000Z', start: '2027-01-21' };
export function returnRoute() { const r = buildItinerary({ origin: 'NRT', destination: 'HKG', date: '2027-01-12', budget: 30000 }); Object.assign(r, { number: 'CX-DEMO 521', departure: '17:30', arrival: '21:15', durationMinutes: 285 }); Object.assign(r.segments[0], { departure: '17:30', arrival: '21:15', departureUtc: Date.parse(STORY.back), arrivalUtc: Date.parse(STORY.backArrival), minutes: 285 }); return r; }
/** Targeted fixture migration. Financial/consent stores and custom journeys are untouched. */
export function migrateStory(s) {
    if (s.tripCleanup || !s.dual || s.seedVersion === SEED_VERSION)
        return s;
    s.storyHistory ??= {};
    const t = s.trips[FAMILY_TRIP], j = s.journeys?.items[STUDENT_TRIP];
    const review = [];
    if (t && t.familyId === FAMILY && t.members.some(m => m.personId === 'father')) {
        s.storyHistory['family:before:' + SEED_VERSION] = structuredClone({ trip: t, journey: s.journeys?.items[t.id] });
        const known = t.route.origin === 'HKG' && t.route.destination === 'NRT' && t.route.date === '2027-01-08';
        if (known) {
            const previous = t.version;
            t.version++;
            t.status = 'planned';
            delete t.event;
            delete t.previous;
            t.noCandidates = false;
            t.route = fixtureRoute('NRT', STORY.out, STORY.outArrival, 'CX-DEMO 520');
            const back = returnRoute();
            t.route.segments.push(back.segments[0]);
            t.route.adultFare += back.adultFare;
            t.route.infantFare += back.infantFare;
            if (!t.members.some(m => m.personId === 'student'))
                t.members.push({ personId: 'student', occupiesSeat: true, companionId: null, tripMemberId: t.id + ':student' });
            const seats = t.members.filter(m => m.occupiesSeat).length;
            t.route.total = t.route.adultFare * seats + t.route.infantFare * (t.members.length - seats);
            t.route.overBudget = t.route.total > t.route.budget;
            s.profiles[FAMILY + ':student'] ??= emptyProfile(FAMILY, 'student');
            if (!t.snapshots.some(x => x.personId === 'student'))
                t.snapshots.push({ personId: 'student', profileVersion: s.profiles[FAMILY + ':student'].version, profile: structuredClone(s.profiles[FAMILY + ':student']) });
            t.candidateSeats = { father: '22A', 'lin-elder': '22B', mother: '22D', 'lin-child': '22E', student: '23A' };
            delete t.candidateSeatGroups;
            // Existing receipts remain on their original version, never backdated.
            for (const old of Object.values(s.requests).filter(r => r.tripId === t.id && r.tripVersion === previous))
                old.history.push('舊版本紀錄：預設故事已更新；原回執不移植到新日期。');
            for (const [index, leg] of t.route.segments.entries())
                for (const snap of t.snapshots)
                    for (const kind of snap.profile.needs) {
                        const id = 'story:' + t.id + ':v' + t.version + ':s' + index + ':' + snap.personId + ':' + kind;
                        s.requests[id] = { id, familyId: FAMILY, tripId: t.id, tripVersion: t.version, personId: snap.personId, identitySnapshot: { personId: snap.personId, displayName: s.persons[snap.personId]?.displayName ?? s.persons[snap.personId]?.name ?? snap.personId, bookingName: s.persons[snap.personId]?.bookingName, capturedAt: s.demoClock, legacy: false }, segmentId: t.id + '-v' + t.version + '-s' + index, kind, applicability: 'eligible', progress: 'reconfirm', missing: [], deadline: new Date(leg.departureUtc - 48 * 3600000).toISOString(), key: id, attempt: 0, receipt: null, ticket: null, history: ['新故事版本：保留照護需求，須核對本航段服務'], manualQueried: false };
                    }
            for (const task of Object.values(s.dual.tasks).filter(x => x.tripId === t.id && x.version === previous)) {
                s.dual.tasks[task.taskId + ':history:v' + previous] = { ...task, taskId: task.taskId + ':history:v' + previous };
                task.version = t.version;
                task.title = task.title.replace('四位', '五位');
                task.next = task.next.replaceAll('四位', '五位');
                task.deadline = '2027-01-06T03:00:00Z';
                if (['wheelchair', 'seating', 'meal'].includes(task.kind)) {
                    task.status = 'reconfirm';
                    task.next = '核實本次去程與返程的獨立服務回執';
                }
            }
            syncFamilyJourney(s);
        }
        else
            review.push('家庭行程已由使用者修改，保留原航程與成員；請自行核對時間及同行名單。');
    }
    if (j && j.ownerId === 'student' && j.familyId === null && j.segments.length === 1) {
        s.storyHistory['student:before:' + SEED_VERSION] = structuredClone(j);
        if (j.segments[0].departure.startsWith('2027-01-08')) {
            const previous = j.version;
            j.version++;
            j.revision++;
            j.sceneStep = 0;
            j.arrivalNode = 0;
            Object.assign(j.segments[0], { id: j.id + '-v' + j.version + '-s0', departure: STORY.schoolFlight, scheduledArrival: STORY.schoolArrival, estimatedArrival: STORY.schoolArrival, updatedAt: s.demoClock });
            delete j.segments[0].completed;
            delete j.segments[0].actualLanding;
            Object.assign(j.school, { dormOpen: STORY.dormOpen, dormClose: STORY.dormClose, confirmed: false });
            j.pickup.at = STORY.pickup;
            j.pickup.status = 'sample';
            j.pickup.updatedAt = s.demoClock;
            j.fieldTimes = {};
            delete j.notification;
            delete j.feedback;
            s.dual.studentScene = 'normal';
            // User draft and pending notes stay on the journey; original evidence is archived.
            for (const task of Object.values(s.dual.tasks).filter(x => x.tripId === j.id && x.version === previous)) {
                s.dual.tasks[task.taskId + ':history:v' + previous] = { ...task, taskId: task.taskId + ':history:v' + previous };
                task.version = j.version;
                task.deadline = '2027-01-17T10:00:00Z';
                if (task.kind === 'pickup') {
                    task.status = 'pending';
                    task.next = '1 月 18 日 18:00 接機窗口，請向學校確認';
                }
                if (task.kind === 'dorm') {
                    task.status = 'pending';
                    task.next = '1 月 17 日起開放；每日 21:00 前入住，晚到須另行確認';
                }
            }
        }
        else
            review.push('本人返校航班已修改，保留使用者日期與筆記；請核對校曆。');
    }
    const p = s.plans.student;
    if (p) {
        for (const [key, old, value] of [['start', '2027-01-11', STORY.start], ['dorm', '2027-01-08', '2027-01-17'], ['departure', '2027-01-08', '2027-01-18']])
            if (p[key] === old)
                p[key] = value;
    }
    s.seedVersion = SEED_VERSION;
    s.storyMigration = { at: s.demoClock, review };
    return s;
}
