import { installDemoNames } from '/assets/5c5eb8250e82e8e3ffd2/recognition-fixture.js';
import { migrateStory } from '/assets/5c5eb8250e82e8e3ffd2/story.js';
import { migrateTimeline, synchronizeClocks } from '/assets/5c5eb8250e82e8e3ffd2/timeline.js';
import { recoverJourneys, journeyNeedsReview, canReadJourneyReview } from '/assets/5c5eb8250e82e8e3ffd2/journey-data.js';
import { migrateScenes } from '/assets/5c5eb8250e82e8e3ffd2/scene-migration.js';
import * as D from '/assets/5c5eb8250e82e8e3ffd2/domain.js';
import * as J from '/assets/5c5eb8250e82e8e3ffd2/transit.js';
import { emptyProfile, newPlan, seed } from '/assets/5c5eb8250e82e8e3ffd2/seed.js';
import { airport, buildItinerary } from '/assets/5c5eb8250e82e8e3ffd2/web/travel.js';
import { availableMiles, fundTotals } from '/assets/5c5eb8250e82e8e3ffd2/fund.js';
import { message } from '/assets/5c5eb8250e82e8e3ffd2/messages.js';
import { completeLearning } from '/assets/5c5eb8250e82e8e3ffd2/learning.js';
export const CLOCK = '2027-01-05T02:00:00.000Z';
export const FAMILY = 'lin-family', STUDENT_TRIP = 'lin-student-return-2027', FAMILY_TRIP = 'lin-tokyo-2027', FUND = 'lin-home-2027';
export const STUDENT_ACCOUNT = 'demo-student', PARENT_ACCOUNT = 'demo-parent';
export const demoAccount = (s) => (s.dual?.accounts[s.activeAccountId ?? ''] ?? s.externalAccounts?.[s.activeAccountId ?? '']);
export const studentAccount = (s) => demoAccount(s)?.role === 'student';
const names = { student: { old: '林晴', name: '林晴', dob: '2006-10-01' }, father: { old: '林建国', name: '林志明' }, mother: { old: '王秀兰', name: '陈慧' } };
export function migrateDemo(input) {
    if (input.tripCleanup)
        return input;
    const s = recoverJourneys(D.clone(input));
    if (s.dual?.version === 1)
        return installDemoNames(migrateTimeline(migrateScenes(s)));
    J.initJourneys(s);
    s.demoClock = CLOCK;
    const oldPlan = s.plans.student;
    if (oldPlan && oldPlan.school === '伦敦示例大学 · 演示校历' && oldPlan.start === '2027-09-20' && !oldPlan.saved)
        Object.assign(oldPlan, { school: '伦敦有期示例大学（模拟院校）', start: '2027-01-11', dorm: '2027-01-08', departure: '2027-01-08', holiday: '2027-02-01', holidayEnd: '2027-02-15', exam: '2027-05-15', graduation: '2027-07-01' });
    s.plans.father ??= newPlan('father');
    // Explicit known-fixture mapping only. Never rename custom-created records.
    for (const [id, x] of Object.entries(names)) {
        const p = s.persons[id];
        if (p && p.name === x.old) {
            p.name = x.name;
            p.displayName = x.name;
            p.displayNames = { en: x.name, 'zh-CN': x.name, 'zh-HK': x.name };
            if (x.dob && p.dob === '2009-10-01')
                p.dob = x.dob;
        }
    }
    s.persons['lin-elder'] ??= { id: 'lin-elder', name: '王秀芳', displayName: '王秀芳', nickname: '外婆', dob: '1950-05-20', guardianIds: [] };
    s.persons['lin-child'] ??= { id: 'lin-child', name: '林小宇', displayName: '林小宇', nickname: '小宇', dob: '2017-06-12', guardianIds: ['father', 'mother'] };
    for (const pid of ['student', 'father', 'mother', 'lin-elder', 'lin-child'])
        if (!D.account(s, pid)) {
            const id = 'm-' + pid;
            s.accounts[id] = { id, personId: pid, joinedAt: '2025-01-01', expiry: '2028-07-01', studentVerified: pid === 'student' };
        }
    s.families[FAMILY] ??= { id: FAMILY, name: '林家的家人', currentTripId: FAMILY_TRIP, goal: 25000, archived: false };
    for (const [personId, role, label, referencePersonId] of [['father', 'owner', '父亲', 'student'], ['mother', 'editor', '母亲', 'student'], ['student', 'viewer', '女儿', 'father'], ['lin-elder', 'viewer', '外婆', 'student'], ['lin-child', 'viewer', '弟弟', 'student']]) {
        if (!s.memberships.some(m => m.familyId === FAMILY && m.personId === personId))
            s.memberships.push({ familyId: FAMILY, personId, role, label, referencePersonId, active: true });
        s.profiles[FAMILY + ':' + personId] ??= emptyProfile(FAMILY, personId);
    }
    for (const pid of ['mother', 'lin-elder', 'lin-child'])
        s.consents.push({ id: 'dual-consent-' + pid, familyId: FAMILY, personId: pid, granteeId: 'father', scopes: ['care:view', 'care:edit', 'service', ...(pid === 'lin-child' ? ['passport', 'miles'] : [])], grantedBy: pid === 'lin-child' ? 'father' : pid, active: true });
    // The student is an adult. Legacy guardian grants do not become adult consent.
    s.adultSharing.student = false;
    const elder = s.profiles[FAMILY + ':lin-elder'];
    Object.assign(elder, { needs: ['wheelchair', 'adjacent'], required: ['adjacent'], walking: '可短距离步行；机场长距离需轮椅协助', stairs: '可自行登梯，长距离需协助', wheelchairType: '机场手动轮椅', equipment: '不携带个人电动设备；需现场核实服务', updatedAt: CLOCK });
    Object.assign(s.profiles[FAMILY + ':lin-child'], { needs: ['childMeal', 'adjacent'], required: ['adjacent'], updatedAt: CLOCK });
    s.relationships.push({ familyId: FAMILY, caregiverId: 'father', dependentId: 'lin-elder', required: true }, { familyId: FAMILY, caregiverId: 'mother', dependentId: 'lin-child', required: true });
    if (!s.trips[FAMILY_TRIP]) {
        const t = { id: FAMILY_TRIP, familyId: FAMILY, version: 1, route: fixtureRoute('NRT', '2027-01-08T03:00:00Z', '2027-01-08T07:15:00Z', 'CX-DEMO 520'), members: ['father', 'mother', 'lin-elder', 'lin-child'].map(personId => ({ personId, occupiesSeat: true, companionId: null, tripMemberId: FAMILY_TRIP + ':' + personId })), snapshots: [], relationships: [], status: 'cancelled', checklist: { documents: true }, needsReview: false, event: 'cancel', noCandidates: false };
        t.candidateSeats = { father: '22A', 'lin-elder': '22B', mother: '22D', 'lin-child': '22E' };
        t.snapshots = t.members.map(m => ({ personId: m.personId, profileVersion: 1, profile: D.clone(s.profiles[FAMILY + ':' + m.personId]) }));
        t.relationships = D.clone(s.relationships.filter(r => r.familyId === FAMILY));
        s.trips[t.id] = t;
        for (const snap of t.snapshots)
            for (const kind of snap.profile.needs) {
                const id = 'dual-old-' + snap.personId + '-' + kind;
                s.requests[id] = { id, familyId: FAMILY, tripId: t.id, tripVersion: 1, personId: snap.personId, identitySnapshot: { personId: snap.personId, displayName: s.persons[snap.personId].displayName ?? s.persons[snap.personId].name, capturedAt: CLOCK, legacy: false }, segmentId: t.id + '-v1-s0', kind, applicability: 'eligible', progress: kind === 'childMeal' ? 'submitted' : 'confirmed', missing: [], deadline: '2027-01-06T03:00:00Z', key: id, attempt: 1, receipt: 'MOCK-OLD-' + id, ticket: null, history: ['原航段模拟记录；已取消，不适用于新航段'], manualQueried: false };
            }
    }
    if (!s.journeys.items[STUDENT_TRIP] && !journeyNeedsReview(s, STUDENT_TRIP)) {
        const j = D.clone(s.journeys.items[J.STUDENT_TRIP] ?? J.initJourneys(seed()).journeys.items[J.STUDENT_TRIP]);
        Object.assign(j, { id: STUDENT_TRIP, ownerId: 'student', familyId: null, version: 2, revision: 2, now: CLOCK, sceneStep: 0, segments: [{ id: STUDENT_TRIP + '-v2-s0', flight: 'CX-DEMO 251', from: 'HKG', to: 'LHR', zone: 'Europe/London', departure: '2027-01-08T06:00:00Z', scheduledArrival: '2027-01-08T16:00:00Z', estimatedArrival: '2027-01-08T20:00:00Z', aircraft: 'A350', terminal: 'T1', gate: '待公布', updatedAt: CLOCK }], school: { name: '伦敦有期示例大学（模拟院校）', address: '示例校园宿舍 · 不是真实地址', dormOpen: '2027-01-08T08:00:00Z', dormClose: '2027-01-08T21:00:00Z', confirmed: false }, pickup: { at: '2027-01-08T18:00:00Z', point: 'LHR 到达层模拟接机点，须联系学校核实', status: 'sample', updatedAt: CLOCK }, selectedTransport: 'car', pending: [], grants: [], sharedTo: [], fieldTimes: {}, node: 'unknown', arrivalNode: 0 });
        s.journeys.items[j.id] = j;
    }
    s.funds[FUND] ??= { id: FUND, ownerId: 'student', title: '林晴的回家基金', origin: 'LHR', destination: 'HKG', from: '2027-02-01', until: '2027-02-15', target: 20000, token: crypto.randomUUID(), invited: ['father'], status: 'open', inventory: true, landingConsent: false, landed: false, redemption: null, reminders: {} };
    const accounts = {};
    for (const [accountId, personId, role, defaultTripId, workspace, opening] of [[STUDENT_ACCOUNT, 'student', 'student', STUDENT_TRIP, '我的学期与个人旅程', 8000], [PARENT_ACCOUNT, 'father', 'parent', FAMILY_TRIP, '林家的家庭出行', 60000]]) {
        const memberId = D.account(s, personId).id;
        accounts[accountId] = { accountId, personId, memberId, role, defaultTripId, ledgerRef: memberId, workspace };
        const key = 'dual-opening:' + personId;
        if (!s.ledger.some(l => l.key === key))
            s.ledger.push({ id: key, memberId, amount: opening - D.balance(s, personId), kind: 'opening', key, at: CLOCK, qualifying: false });
    }
    s.dual = { version: 1, generation: 1, accounts, grants: [{ personId: 'student', granteeId: 'father', fundId: FUND, fields: ['beneficiary', 'title', 'route', 'travelWindow', 'target', 'confirmedSupport'], support: true }], tasks: {}, transactions: {}, journal: [], notifications: {}, thanks: {}, studentScene: 'exception', revision: 1 };
    seedTasks(s);
    return installDemoNames(migrateTimeline(migrateScenes(s)));
}
export function fixtureRoute(to, dep, arr, number) { const r = buildItinerary({ origin: 'HKG', destination: to, date: dep.slice(0, 10), budget: 30000 }); const from = Date.parse(dep), until = Date.parse(arr), fmt = (iso, zone) => new Intl.DateTimeFormat('en-GB', { timeZone: zone, hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(iso)); Object.assign(r, { number, departure: fmt(dep, 'Asia/Hong_Kong'), arrival: fmt(arr, to === 'NRT' ? 'Asia/Tokyo' : 'Europe/London'), durationMinutes: (until - from) / 60000 }); Object.assign(r.segments[0], { departure: r.departure, arrival: r.arrival, departureUtc: from, arrivalUtc: until, minutes: r.durationMinutes }); return r; }
function seedTasks(s) {
    const rows = [
        [STUDENT_TRIP, 'student', '本次行程证件要求', 'documents', 'done', '本人已核对；不表示签证获批'], [STUDENT_TRIP, 'student', '学生票资格与适用行李', 'eligibility', 'pending', '核对票价条件及所需学生证明'], [STUDENT_TRIP, 'student', '行李清单', 'packing', 'done', '已核对随身与托运清单'], [STUDENT_TRIP, 'student', '学校接机', 'pickup', 'reconfirm', '抵达变更至 20:00；联系学校重新确认'], [STUDENT_TRIP, 'student', '宿舍晚到入住', 'dorm', 'pending', '预计 22:00 到校；先申请晚到安排'], [STUDENT_TRIP, 'student', '备用交通与学校联系方式', 'transport', 'pending', '选择交通，保存联系人与联系草稿'],
        [FAMILY_TRIP, 'father', '四位旅客行程资料', 'documents', 'done', '本人已核对四位实际同行人'], [FAMILY_TRIP, 'lin-elder', '王秀芳轮椅协助', 'wheelchair', 'reconfirm', '原确认仅适用于已取消航段；新航段须重新核实'], [FAMILY_TRIP, 'father', '两组照护相邻座位', 'seating', 'reconfirm', '林志明＋王秀芳；陈慧＋林小宇，旧组合保留'], [FAMILY_TRIP, 'lin-child', '林小宇儿童餐', 'meal', 'reconfirm', '旧航段已提交；改签后单独核实'], [FAMILY_TRIP, 'father', '家庭行李清单', 'packing', 'pending', '核对四位旅客随身与托运安排'], [FAMILY_TRIP, 'father', '机场交通', 'transport', 'pending', '按新出发时间确认接送安排']
    ];
    for (const [tripId, personId, title, kind, status, next] of rows) {
        const taskId = 'dual-task:' + tripId + ':' + kind;
        s.dual.tasks[taskId] = { taskId, personId, tripId, version: tripId === STUDENT_TRIP ? 2 : 1, title, kind, status, deadline: tripId === STUDENT_TRIP ? '2027-01-07T10:00:00Z' : '2027-01-06T03:00:00Z', next };
    }
}
export function canReadTrip(s, id) { if (journeyNeedsReview(s, id))
    return false; const j = s.journeys?.items[id]; if (j && !j.familyId)
    return J.canReadJourney(s, j); const t = s.trips[id]; return !!t && D.canAccessFamily(s, t.familyId) && (D.membership(s, t.familyId)?.role !== 'viewer' || t.members.some(m => m.personId === s.actorId)); }
export function selectTrip(s, explicit) {
    if (!explicit && s.selectedTripId?.startsWith('none:'))
        return { status: 'empty', message: '这个家庭还没有行程。请单独建立行程，不会带入其他家庭资料。' };
    const ids = explicit ? [explicit] : [s.selectedTripId, demoAccount(s)?.defaultTripId].filter(Boolean);
    for (const id of ids) {
        if (journeyNeedsReview(s, id))
            return { status: canReadJourneyReview(s, id) ? 'error' : 'forbidden', message: canReadJourneyReview(s, id) ? '這段舊行程的航段資料不完整，原始記錄已保留待核實。請先選擇其他完整行程；不會自動補造航班或飛行紀錄。' : '目前帳號未獲授權查看這段行程。' };
        const exists = !!s.trips[id] || !!s.journeys?.items[id];
        if (!exists) {
            if (explicit)
                return { status: 'error', message: '行程记录不存在或已损坏，请返回当前账号的行程。' };
            continue;
        }
        if (!canReadTrip(s, id)) {
            if (explicit)
                return { status: 'forbidden', message: '当前账号无权查看这段行程。请切换至获授权账号，或返回自己的行程。' };
            continue;
        }
        const j = s.journeys?.items[id], t = s.trips[id];
        return { status: 'ok', id, kind: j && !j.familyId ? 'student' : 'family', version: t?.version ?? j.version };
    }
    return { status: 'empty', message: '此工作区尚未建立行程。请先选择目的地、日期和同行成员。' };
}
export function activateAccount(s, accountId, session) {
    const a = s.dual?.accounts[accountId];
    if (!a)
        throw Error('未知演示账号');
    s.activeAccountId = accountId;
    s.actorId = a.personId;
    const families = D.familiesFor(s), preferred = session?.familyId;
    s.activeFamilyId = preferred && D.canAccessFamily(s, preferred) ? preferred : families.find(f => f.id === FAMILY)?.id ?? families[0]?.id ?? null;
    const empty = 'none:' + (s.activeFamilyId ?? a.personId);
    const visible = (id) => canReadTrip(s, id) || journeyNeedsReview(s, id) && canReadJourneyReview(s, id);
    s.selectedTripId = session?.tripId && (visible(session.tripId) || session.tripId === empty) ? session.tripId : a.defaultTripId && visible(a.defaultTripId) ? a.defaultTripId : empty;
    if (s.journeys)
        s.journeys.selectedId = s.journeys.items[s.selectedTripId] ? s.selectedTripId : null;
    return s;
}
export function currentTasks(s) { const x = selectTrip(s); if (x.status !== 'ok')
    return []; return Object.values(s.dual?.tasks ?? {}).filter(t => t.tripId === x.id && t.version === x.version && (!s.trips[x.id] || s.trips[x.id].members.some(m => m.personId === t.personId) && D.permitted(s, s.trips[x.id].familyId, t.personId, 'care:view'))).map(t => { const task = { ...t, version: x.version }; if (x.id === FAMILY_TRIP && ['wheelchair', 'seating', 'meal'].includes(t.kind)) {
    const kind = t.kind === 'seating' ? 'adjacent' : t.kind === 'meal' ? 'childMeal' : 'wheelchair', requests = D.requestsFor(s, s.trips[x.id]).filter(r => r.kind === kind);
    task.status = s.trips[x.id].status === 'cancelled' ? 'reconfirm' : requests.length && requests.every(r => r.progress === 'confirmed') ? 'done' : 'reconfirm';
} return task; }); }
export function updateTask(s, taskId, done) { const t = s.dual?.tasks[taskId]; if (!t || !canReadTrip(s, t.tripId) || s.journeys?.items[t.tripId]?.familyId === null && s.journeys.items[t.tripId].ownerId !== s.actorId || s.journeys?.items[t.tripId]?.segments.every(x => x.actualLanding) || t.tripId === FAMILY_TRIP && s.actorId !== 'father')
    throw Error('没有更新此准备项的权限'); if (s.trips[t.tripId] && !D.permitted(s, s.trips[t.tripId].familyId, t.personId, 'care:edit'))
    throw Error('沒有更新此準備項的權限'); if (['wheelchair', 'seating', 'meal'].includes(t.kind))
    throw Error('服务须通过各自回执确认'); t.status = done ? 'done' : 'pending'; if (done && s.actorId === 'student' && s.journeys?.items[t.tripId]?.ownerId === 'student' && !s.journeys.items[t.tripId].familyId && ['documents', 'packing'].includes(t.kind))
    completeLearning(s, t.kind, '本人保存準備核對記錄；文件仍可有待辦，不代表已獲批准'); s.dual.revision++; return s; }
export function canSupport(s, personId, fundId) { return s.dual?.grants.some(g => g.granteeId === personId && g.fundId === fundId && g.support) === true && s.funds[fundId]?.invited.includes(personId); }
export function beginSupport(s, input, now = Date.now()) {
    input = { ...input, amount: parseSupportAmount(input.amount) };
    const a = s.dual?.accounts[input.accountId] ?? s.externalAccounts?.[input.accountId];
    if (!a || a.personId !== s.actorId || input.accountId !== s.activeAccountId)
        throw Error('请由出资人本人确认');
    if (!/^[a-zA-Z0-9:-]{8,120}$/.test(input.key))
        throw Error('交易标识无效');
    const old = Object.values(s.dual.transactions).find(t => t.key === input.key);
    if (old) {
        if (old.accountId !== a.accountId || old.amount !== input.amount || old.fundId !== input.fundId)
            throw Error('原交易标识不能用于不同额度或目标');
        return s;
    }
    validateSupport(s, a.personId, input.fundId, input.amount);
    const id = 'TX-' + crypto.randomUUID(), t = { id, key: input.key, accountId: a.accountId, personId: a.personId, memberId: a.memberId, fundId: input.fundId, amount: input.amount, status: 'pending', createdAt: s.demoClock, dueAt: now + (s.mockMode === 'delay' ? 8000 : 900), attempt: 1, mode: s.mockMode, epoch: s.epoch + ':' + s.dual.generation };
    s.dual.transactions[id] = t;
    s.supports[id] = { id, fundId: t.fundId, personId: t.personId, amount: t.amount, source: 'miles', status: 'pending', attempt: 1, subscribed: false, at: s.demoClock };
    s.dual.revision++;
    return s;
}
export const SUPPORT_RULES = { version: 1, minimum: 100, step: 100, singleMax: 1000000 };
export function parseSupportAmount(raw) { if (typeof raw === 'number') {
    if (!Number.isSafeInteger(raw) || raw <= 0)
        throw Error(message('INVALID_AMOUNT'));
    return raw;
} if (typeof raw !== 'string' || !/^\d+$/.test(raw) || !Number.isSafeInteger(Number(raw)) || Number(raw) <= 0)
    throw Error(message('INVALID_AMOUNT')); return Number(raw); }
export function maxSupport(s, p = s.actorId) { return Math.floor(Math.min(availableMiles(s, p), SUPPORT_RULES.singleMax) / SUPPORT_RULES.step) * SUPPORT_RULES.step; }
export function validateSupport(s, p, f, raw) { const amount = parseSupportAmount(raw); if (amount < SUPPORT_RULES.minimum || amount > SUPPORT_RULES.singleMax || amount % SUPPORT_RULES.step)
    throw Error(message('INVALID_AMOUNT')); if (!canSupport(s, p, f))
    throw Error(message('CONSENT_REQUIRED')); if (s.funds[f]?.status !== 'open')
    throw Error(message('FUND_CLOSED')); if (amount > availableMiles(s, p))
    throw Error(message('INSUFFICIENT_BALANCE') + ' 目前可用 ' + availableMiles(s, p).toLocaleString('en-US') + ' 里數；按 100 的倍數計，最多可支持 ' + maxSupport(s, p).toLocaleString('en-US') + ' 里數。'); return amount; }
const previewContext = (s, f) => JSON.stringify({ fund: s.funds[f], grants: s.dual?.grants, generation: s.dual?.generation, epoch: s.epoch });
export function supportPreview(s, raw, key = crypto.randomUUID()) { const a = demoAccount(s); if (!a || a.personId !== s.actorId)
    throw Error(message('CONTEXT_CHANGED')); const amount = validateSupport(s, a.personId, FUND, raw); return { key, accountId: a.accountId, personId: a.personId, beneficiaryId: s.funds[FUND].ownerId, fundId: FUND, amount, available: availableMiles(s, a.personId), ruleVersion: SUPPORT_RULES.version, context: previewContext(s, FUND) }; }
export function confirmSupport(s, draft) { if (draft.accountId !== s.activeAccountId || draft.personId !== s.actorId)
    throw Error(message('CONTEXT_CHANGED')); const existing = Object.values(s.dual?.transactions ?? {}).find(t => t.key === draft.key); if (existing)
    return beginSupport(s, draft); validateSupport(s, s.actorId, draft.fundId, draft.amount); if (draft.ruleVersion !== SUPPORT_RULES.version || draft.available !== availableMiles(s, s.actorId) || draft.context !== previewContext(s, draft.fundId) || draft.beneficiaryId !== s.funds[draft.fundId]?.ownerId)
    throw Error(message('CONTEXT_CHANGED')); return beginSupport(s, draft); }
export function settleSupport(s, id, query = false, now = Date.now()) {
    const t = s.dual?.transactions[id];
    if (!t || !['pending', 'unknown'].includes(t.status) || t.epoch !== s.epoch + ':' + s.dual.generation)
        return s;
    if (!query && t.dueAt > now)
        return s;
    if (t.mode === 'timeout' && !query) {
        t.status = 'unknown';
        t.reason = '回执超时，先查询原交易；预留保留，不重复扣款';
        s.dual.revision++;
        return s;
    }
    const reject = (reason) => { t.status = 'failed'; t.reason = reason; s.supports[t.id].status = 'failed'; s.dual.revision++; return s; };
    if (t.mode === 'failure')
        return reject('支持服務暫不可用；尚未扣減里數，可重試原交易');
    if (!canSupport(s, t.personId, t.fundId) || s.funds[t.fundId]?.status !== 'open')
        return reject('授权已撤回或基金已关闭；未扣款');
    if (D.balance(s, t.personId) < t.amount)
        return reject('余额不足；未扣款');
    const at = s.demoClock, key = 'dual-support:' + t.id;
    if (!s.ledger.some(l => l.key === key))
        s.ledger.push({ id: key, memberId: t.memberId, amount: -t.amount, kind: 'fund', key, at, qualifying: false });
    s.supports[t.id].status = 'confirmed';
    t.status = 'confirmed';
    delete t.reason;
    const beneficiary = s.dual.accounts[STUDENT_ACCOUNT];
    for (const [side, accountId, memberId, amount] of [['debit', t.accountId, t.memberId, -t.amount], ['restricted-credit', beneficiary.accountId, beneficiary.memberId, t.amount]])
        if (!s.dual.journal.some(l => l.id === t.id + ':' + side))
            s.dual.journal.push({ id: t.id + ':' + side, transactionId: t.id, memberId, accountId, fundId: t.fundId, side, amount, at });
    const nid = 'support:' + t.id;
    s.dual.notifications[nid] = { id: nid, accountId: beneficiary.accountId, transactionId: t.id, text: (t.personId === 'father' ? '爸爸林志明' : s.persons[t.personId]?.name ?? '親友') + '支持了 ' + t.amount.toLocaleString('en-US') + ' 里数', read: false };
    s.dual.revision++;
    return s;
}
export function retrySupport(s, id, now = Date.now()) { const t = s.dual?.transactions[id]; if (!t || t.accountId !== s.activeAccountId || t.personId !== s.actorId)
    throw Error('仅出资人可重试原交易'); if (t.status === 'unknown')
    throw Error('结果未知，请先查询原交易'); if (t.status !== 'failed')
    return s; validateSupport(s, t.personId, t.fundId, t.amount); t.status = 'pending'; t.attempt++; t.mode = s.mockMode; t.dueAt = now + 900; delete t.reason; s.supports[t.id].status = 'pending'; s.supports[t.id].attempt = t.attempt; s.dual.revision++; return s; }
export function thankSupport(s, id) { const t = s.dual?.transactions[id]; if (s.actorId !== 'student' || t?.status !== 'confirmed')
    throw Error('只能感谢已到账的支持'); if (s.dual.thanks[id])
    return s; s.dual.thanks[id] = true; const nid = 'thanks:' + id; s.dual.notifications[nid] = { id: nid, accountId: t.accountId, transactionId: id, text: '林晴：謝謝爸爸，我會照顧好自己。', read: false }; s.dual.revision++; return s; }
export function visibleTransactions(s) { return Object.values(s.dual?.transactions ?? {}).filter(t => t.accountId === s.activeAccountId || s.actorId === s.funds[t.fundId]?.ownerId && t.status === 'confirmed'); }
export function visibleNotifications(s) { return Object.values(s.dual?.notifications ?? {}).filter(n => n.accountId === s.activeAccountId && (!n.eventId || !!n.tripId && canReadTrip(s, n.tripId))); }
export function fundSummary(s) { const f = s.funds[FUND]; if (!f || s.actorId !== f.ownerId && !canSupport(s, s.actorId, f.id))
    return null; return { id: f.id, title: f.title, beneficiary: s.persons[f.ownerId].name, origin: f.origin, destination: f.destination, target: f.target, from: f.from, until: f.until, balance: fundTotals(s, f).confirmed }; }
export function setScene(s, mode) {
    const x = selectTrip(s);
    if (x.status !== 'ok')
        throw Error('先选择可访问行程');
    if (x.id === STUDENT_TRIP) {
        const j = s.journeys.items[x.id];
        if (j.ownerId !== s.actorId)
            throw Error('學生行程情境須由本人調整。');
        s.dual.studentScene = mode;
        for (const task of Object.values({ ...s.dual.tasks }).filter(t => t.tripId === j.id && t.version === j.version)) {
            s.dual.tasks[task.taskId + ':history:v' + task.version] = { ...task, taskId: task.taskId + ':history:v' + task.version };
            task.version++;
        }
        j.version++;
        j.revision++;
        j.segments[0].id = j.id + '-v' + j.version + '-s0';
        delete j.segments[0].actualLanding;
        delete j.segments[0].completed;
        j.arrivalNode = 0;
        j.sceneStep = 0;
        j.now = s.demoClock;
        const day = s.seedVersion ? '2027-01-18' : '2027-01-08';
        j.segments[0].departure = day + (mode === 'normal' ? 'T02:00:00Z' : 'T06:00:00Z');
        j.segments[0].scheduledArrival = day + 'T16:00:00Z';
        j.segments[0].estimatedArrival = day + (mode === 'normal' ? 'T16:00:00Z' : 'T20:00:00Z');
        j.school.confirmed = mode === 'resolved';
        j.school.dormClose = day + (mode === 'resolved' ? 'T23:00:00Z' : 'T21:00:00Z');
        j.pickup.at = day + (mode === 'resolved' ? 'T21:30:00Z' : 'T18:00:00Z');
        for (const t of Object.values(s.dual.tasks).filter(t => t.tripId === x.id && t.version === j.version && ['pickup', 'dorm'].includes(t.kind)))
            t.status = mode === 'resolved' ? 'done' : mode === 'exception' ? 'reconfirm' : 'pending';
        delete j.draft;
        delete j.feedback;
        delete j.notification;
        j.fieldTimes = {};
    }
    else {
        const t = s.trips[x.id];
        if (mode === 'resolved') {
            if (t.status !== 'cancelled')
                t.status = 'cancelled';
            s = D.reduce(s, { type: 'rebook', familyId: t.familyId, tripId: t.id, candidateId: 'later', confirmed: true });
            s.dual.familySelection = 'later';
        }
        else {
            t.status = mode === 'normal' ? 'planned' : 'cancelled';
            if (mode === 'normal')
                delete t.event;
            else
                t.event = 'cancel';
        }
    }
    s.dual.revision++;
    return s;
}
export function resetDemo(s) { if (!s.dual)
    throw Error('没有演示空间'); const ids = new Set(Object.keys(s.dual.transactions)); s.ledger = s.ledger.filter(l => !Array.from(ids).some(id => l.key === 'dual-support:' + id)); for (const id of ids)
    delete s.supports[id]; s.dual.transactions = {}; s.dual.journal = []; s.dual.notifications = {}; s.dual.thanks = {}; s.dual.generation++; s.dual.revision++; return s; }
export function resetScenario(s) { resetDemo(s); const fresh = migrateStory(migrateDemo(seed())); s.trips[FAMILY_TRIP] = fresh.trips[FAMILY_TRIP]; for (const [id, r] of Object.entries(s.requests))
    if (r.tripId === FAMILY_TRIP)
        delete s.requests[id]; for (const [id, r] of Object.entries(fresh.requests))
    if (r.tripId === FAMILY_TRIP)
        s.requests[id] = r; s.journeys.items[STUDENT_TRIP] = fresh.journeys.items[STUDENT_TRIP]; delete s.journeys.items[FAMILY_TRIP]; s.dual.tasks = fresh.dual.tasks; s.dual.studentScene = 'exception'; delete s.dual.familySelection; synchronizeClocks(s); syncFamilyJourney(s); return s; }
export function syncFamilyJourney(s) { recoverJourneys(s); if (!s.journeys)
    return s; for (const t of Object.values(s.trips).filter(t => !s.families[t.familyId]?.archived)) {
    const old = s.journeys.items[t.id];
    if (journeyNeedsReview(s, t.id))
        continue;
    if (old?.version === t.version)
        continue;
    const ownerId = s.memberships.find(m => m.active && m.familyId === t.familyId && m.role === 'owner')?.personId ?? t.members[0]?.personId;
    if (!ownerId)
        continue;
    const j = { ...old, id: t.id, ownerId, familyId: t.familyId, purpose: 'family', version: t.version, revision: (old?.revision ?? 0) + 1, now: s.demoClock, sceneStep: 2, generation: old?.generation ?? 0, node: 'unknown', nodeAt: s.demoClock, routeAt: s.demoClock, walkMinutes: 0, securityMinutes: 0, reserveMinutes: 10, recheck: 'unknown', arrivalNode: 0, school: { name: '', address: '', dormOpen: s.demoClock, dormClose: s.demoClock, confirmed: false }, pickup: { at: s.demoClock, point: '', status: 'sample', updatedAt: s.demoClock }, segments: t.route.segments.map((leg, i) => ({ id: t.id + '-v' + t.version + '-s' + i, flight: i === 1 && t.id === FAMILY_TRIP ? 'CX-DEMO 521' : t.route.number, from: leg.origin, to: leg.destination, zone: airport(leg.destination)?.zone ?? 'UTC', departure: new Date(leg.departureUtc).toISOString(), scheduledArrival: new Date(leg.arrivalUtc).toISOString(), estimatedArrival: new Date(leg.arrivalUtc).toISOString(), aircraft: leg.aircraft, terminal: '待公布', gate: '待公布', updatedAt: s.demoClock })), pending: [], grants: old?.grants ?? [], sharedTo: old?.sharedTo ?? [], fieldTimes: old?.fieldTimes ?? {} };
    s.journeys.items[t.id] = j;
} return s; }
