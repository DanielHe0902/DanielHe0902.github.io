import { migrateIdentity } from '/assets/5c5eb8250e82e8e3ffd2/identity.js';
import { initFunds } from '/assets/5c5eb8250e82e8e3ffd2/fund.js';
import { buildItinerary } from '/assets/5c5eb8250e82e8e3ffd2/web/travel.js';
import { DEMO_CLOCK } from '/assets/5c5eb8250e82e8e3ffd2/config.js';
export const profileKey = (familyId, personId) => `${familyId}:${personId}`;
export function emptyProfile(familyId, personId) { return { familyId, personId, version: 1, needs: [], required: [], weight: null, months: null, walking: '', stairs: '', wheelchairType: '', equipment: '', updatedAt: DEMO_CLOCK }; }
export function newPlan(personId) { return { personId, school: '伦敦示例大学 · 演示校历', start: '2027-09-20', exam: '2028-05-15', holiday: '2027-12-18', holidayEnd: '2028-01-10', graduation: '2028-07-01', dorm: '2027-09-18', departure: '2027-09-17', visa: '2028-06-30', origin: 'HKG', destination: 'LHR', budget: 12000, bags: 2, scenario: 'move', accommodation: false, calendarConfirmed: false, checks: {}, saved: false, subscribed: false, selected: null, sharedWith: null }; }
export function seed() {
    const people = [
        { id: 'lin', name: '林浩', nickname: 'Taylor', dob: '1992-04-12', guardianIds: [] },
        { id: 'mei', name: '陈悦', nickname: '悦悦', dob: '1993-06-18', guardianIds: [] },
        { id: 'child', name: '林小禾', nickname: '小禾', dob: '2021-05-12', guardianIds: ['lin', 'mei'] },
        { id: 'baby', name: '林小米', nickname: '小米', dob: '2027-01-10', guardianIds: ['lin', 'mei'] },
        { id: 'grandma', name: '陈外婆', nickname: '外婆', dob: '1955-07-03', guardianIds: [] },
        { id: 'father', name: '林建国', nickname: '爸爸', dob: '1963-03-08', guardianIds: [] },
        { id: 'mother', name: '王秀兰', nickname: '妈妈', dob: '1965-08-09', guardianIds: [] },
        { id: 'inlawDad', name: '陈志远', nickname: '岳父', dob: '1961-02-22', guardianIds: [] },
        { id: 'inlawMom', name: '赵文清', nickname: '岳母', dob: '1964-11-06', guardianIds: [] },
        { id: 'student', name: '林晴', nickname: '晴晴', dob: '2009-10-01', guardianIds: ['father', 'mother'] },
        { id: 'guest', name: '游客', nickname: '游客', dob: '2006-06-06', guardianIds: [] }
    ];
    const s = { schemaVersion: 3, funds: {}, supports: {}, milestones: {}, epoch: crypto.randomUUID(), counter: 0, demoClock: DEMO_CLOCK, actorId: 'lin', activeFamilyId: 'a', persons: Object.fromEntries(people.map(p => [p.id, p])), accounts: {}, families: { a: { id: 'a', name: '我的家', currentTripId: 'trip-a', goal: 30000, archived: false }, b: { id: 'b', name: '父母的家', currentTripId: 'trip-b', goal: 20000, archived: false }, c: { id: 'c', name: '岳父母的家', currentTripId: 'trip-c', goal: 40000, archived: false }, d: { id: 'd', name: '晴晴的留学支持', currentTripId: null, goal: 25000, archived: false } }, memberships: [], relationships: [], profiles: {}, trips: {}, requests: {}, plans: { student: newPlan('student'), guest: newPlan('guest'), lin: newPlan('lin') }, tasks: {}, ledger: [], stamps: [], consents: [], events: [], invitations: [], messages: {}, mockMode: 'success', adultSharing: {} };
    for (const id of ['lin', 'mei', 'child', 'grandma', 'father', 'mother', 'inlawDad', 'inlawMom', 'student']) {
        const memberId = 'm-' + id;
        s.accounts[memberId] = { id: memberId, personId: id, joinedAt: '2026-01-01', expiry: '2029-01-01', studentVerified: false };
        s.ledger.push({ id: 'opening-' + id, memberId, amount: id === 'lin' ? 12400 : id === 'child' ? 2400 : 6800, kind: 'opening', key: 'opening-' + id, at: '2027-01-01T00:00:00Z', qualifying: false });
    }
    const add = (f, ids, roles, labels) => ids.forEach((id, i) => { s.memberships.push({ familyId: f, personId: id, role: roles[i], label: labels[i], active: true }); s.profiles[profileKey(f, id)] = emptyProfile(f, id); });
    add('a', ['lin', 'mei', 'child', 'baby', 'grandma'], ['owner', 'editor', 'viewer', 'viewer', 'viewer'], ['本人', '配偶', '孩子', '宝宝', '外婆']);
    add('b', ['lin', 'father', 'mother'], ['editor', 'owner', 'editor'], ['本人', '父亲', '母亲']);
    add('c', ['lin', 'mei', 'inlawDad', 'inlawMom'], ['viewer', 'editor', 'owner', 'editor'], ['本人', '配偶', '岳父', '岳母']);
    add('d', ['student', 'father', 'mother'], ['editor', 'owner', 'editor'], ['学生本人', '父亲', '母亲']);
    const scopes = ['care:view', 'care:edit', 'service', 'passport', 'miles'];
    for (const f of ['a', 'b'])
        for (const m of s.memberships.filter(m => m.familyId === f)) {
            s.consents.push({ id: `consent-${f}-${m.personId}`, familyId: f, personId: m.personId, granteeId: 'lin', scopes, grantedBy: m.personId === 'child' || m.personId === 'baby' ? 'lin' : m.personId, active: true });
        }
    for (const id of ['student', 'father', 'mother'])
        s.consents.push({ id: 'd-' + id, familyId: 'd', personId: id, granteeId: 'student', scopes: id === 'student' ? scopes : ['passport'], grantedBy: id, active: true });
    for (const guardian of ['father', 'mother'])
        s.consents.push({ id: 'd-guardian-' + guardian, familyId: 'd', personId: 'student', granteeId: guardian, scopes, grantedBy: guardian, active: true });
    s.relationships = [{ familyId: 'a', caregiverId: 'lin', dependentId: 'grandma', required: true }, { familyId: 'a', caregiverId: 'mei', dependentId: 'baby', required: true }, { familyId: 'a', caregiverId: 'lin', dependentId: 'child', required: false }, { familyId: 'b', caregiverId: 'lin', dependentId: 'father', required: false }];
    Object.assign(s.profiles['a:grandma'], { needs: ['wheelchair', 'aisle', 'adjacent'], required: ['adjacent'], walking: '短距离可步行，长距离需协助', stairs: '', updatedAt: '2027-08-01T00:00:00Z' });
    Object.assign(s.profiles['a:baby'], { needs: ['bassinet', 'infantMeal'], required: [], months: 8, weight: null, updatedAt: '2027-08-01T00:00:00Z' });
    Object.assign(s.profiles['a:child'], { needs: ['childMeal'], required: [] });
    Object.assign(s.profiles['b:father'], { needs: ['ownWheelchair', 'aisle'], required: [], wheelchairType: '手动', equipment: '', walking: '可短距离步行', stairs: '需要协助' });
    Object.assign(s.profiles['c:inlawMom'], { needs: ['specialMeal'], required: [] });
    const trip = (id, familyId, destination, date, ids) => ({ id, familyId, version: 1, route: buildItinerary({ origin: 'HKG', destination, date, budget: 30000 }), members: ids.map(personId => ({ personId, occupiesSeat: personId !== 'baby', companionId: personId === 'baby' ? 'mei' : null })), snapshots: [], relationships: [], status: 'planned', checklist: {}, needsReview: false, noCandidates: false });
    s.trips['trip-a'] = trip('trip-a', 'a', 'NRT', '2027-09-17', ['lin', 'mei', 'child', 'baby', 'grandma']);
    s.trips['trip-b'] = trip('trip-b', 'b', 'TPE', '2027-10-08', ['lin', 'father']);
    s.trips['trip-c'] = trip('trip-c', 'c', 'SIN', '2027-11-05', ['mei', 'inlawDad', 'inlawMom']);
    s.stamps = [{ id: 'stamp-child-1', personId: 'child', segmentKey: 'seed-child-hkg-tpe', familyId: 'a', city: '台北', aircraft: 'A330', date: '2027-04-01', flight: 'CX-DEMO 501', sharedFamilies: ['a'] }, { id: 'stamp-child-2', personId: 'child', segmentKey: 'seed-child-tpe-hkg', familyId: 'a', city: '香港', aircraft: 'A350', date: '2027-04-08', flight: 'CX-DEMO 502', sharedFamilies: ['a'] }, { id: 'stamp-student-1', personId: 'student', segmentKey: 'seed-student', familyId: 'd', city: '伦敦', aircraft: 'A350', date: '2027-07-01', flight: 'CX-DEMO 900', sharedFamilies: ['d'] }];
    initFunds(s, true);
    s.families.a.assistantNames = [{ personId: 'grandma', aliases: ['外婆', '外祖母', '姥姥'] }, { personId: 'mei', aliases: ['妈妈', '母亲'] }];
    return migrateIdentity(s);
}
