import { saveCalendarVersion } from '/assets/b53849a26298fd713aba/student-calendar.js';
import { normalizeNeeds, profileForAssessment } from '/assets/b53849a26298fd713aba/care-registry.js';
import { tripDecision } from '/assets/b53849a26298fd713aba/trip-decision.js';
import { segmentCancelled } from '/assets/b53849a26298fd713aba/segment-status.js';
import { validateCalendarPlan } from '/assets/b53849a26298fd713aba/calendar-import.js';
import { searchFlights, flightRoute, recommendations } from '/assets/b53849a26298fd713aba/flights.js';
import { recoveryCandidates } from '/assets/b53849a26298fd713aba/recovery.js';
import { bassinetAvailability } from '/assets/b53849a26298fd713aba/aircraft-care.js';
import { feedbackReserved } from '/assets/b53849a26298fd713aba/feedback.js';
import { rewardMonth } from '/assets/b53849a26298fd713aba/learning.js';
import { canPlan, requireStudent } from '/assets/b53849a26298fd713aba/capabilities.js';
import { migrateIdentity, displayName } from '/assets/b53849a26298fd713aba/identity.js';
import { initFunds } from '/assets/b53849a26298fd713aba/fund.js';
import { airport, buildItinerary, validateTrip } from '/assets/b53849a26298fd713aba/web/travel.js';
import { createFollowUp, currentCase, serviceEvent } from '/assets/b53849a26298fd713aba/service-state.js';
import { MIN_MEMBER_AGE, MONTHLY_REWARD_CAP, TASK_REWARDS_EXTEND_EXPIRY, TASKS, RULES, SERVICE_LABELS } from '/assets/b53849a26298fd713aba/config.js';
import { emptyProfile, newPlan, profileKey, seed } from '/assets/b53849a26298fd713aba/seed.js';
export const clone = (value) => structuredClone(value);
function fail(message) { throw new Error(message); }
export const age = (person, clock) => { const d = clock.slice(0, 10); return Number(d.slice(0, 4)) - Number(person.dob.slice(0, 4)) - (d.slice(5) < person.dob.slice(5) ? 1 : 0); };
export const familyMembers = (s, f) => s.memberships.filter(m => m.familyId === f && m.active);
export const membership = (s, f, p = s.actorId) => familyMembers(s, f).find(m => m.personId === p);
export const canAccessFamily = (s, f, p = s.actorId) => !!f && !!s.families[f] && !s.families[f].archived && !!membership(s, f, p);
export const familiesFor = (s, p = s.actorId) => Object.values(s.families).filter(f => !f.archived && membership(s, f.id, p));
export const account = (s, p) => Object.values(s.accounts).find(a => a.personId === p);
export const balance = (s, p) => s.ledger.filter(l => l.memberId === account(s, p)?.id).reduce((a, b) => a + b.amount, 0);
export function permitted(s, f, p, scope) {
    if (!canAccessFamily(s, f) || !membership(s, f, p))
        return false;
    if (['care:edit', 'service'].includes(scope) && membership(s, f)?.role === 'viewer')
        return false;
    if (p === s.actorId)
        return true;
    const person = s.persons[p];
    // A family role is never substituted for legal guardianship or a person's grant.
    if (age(person, s.demoClock) >= 18 && person.guardianIds.includes(s.actorId) && !s.adultSharing[p])
        return false;
    return s.consents.some(c => c.active && c.familyId === f && c.personId === p && c.granteeId === s.actorId && c.scopes.includes(scope));
}
export function guard(s, f, write = false) { if (!canAccessFamily(s, f))
    fail('你没有这个家庭的访问权限。'); if (write && membership(s, f)?.role === 'viewer')
    fail('当前家庭为仅查看权限，不能修改。'); }
const own = (s, f) => { guard(s, f, true); if (membership(s, f)?.role !== 'owner')
    fail('只有家庭管理员可以执行此操作。'); };
const id = (s, prefix) => `${prefix}-${++s.counter}`;
export function event(s, type, context, dedupe) { if (!s.events.some(e => e.dedupe === dedupe))
    s.events.push({ id: id(s, 'event'), type, at: s.demoClock, ...context, dedupe }); }
export function currentTrip(s, f) { return s.trips[s.families[f]?.currentTripId ?? ''] ?? null; }
export function requestsFor(s, t) { return Object.values(s.requests).filter(r => r.familyId === t.familyId && r.tripId === t.id && r.tripVersion === t.version && !r.supersededBy && !r.withdrawnAt); }
export function visibleRequests(s, t) { return requestsFor(s, t).filter(r => permitted(s, t.familyId, r.personId, 'care:view')); }
export const visibleStamps = (s, f, p) => permitted(s, f, p, 'passport') ? s.stamps.filter(st => st.personId === p && (p === s.actorId || st.sharedFamilies.includes(f))) : [];
function getTrip(s, f, t) { guard(s, f, true); const trip = s.trips[t]; if (!trip || trip.familyId !== f)
    fail('行程与当前家庭不匹配。'); if (tripDecision(s, t).userCancelled)
    fail('行程已由你取消，請查看歷史或新增行程。'); return trip; }
function checkCare(s, f, p, scope) { guard(s, f, true); if (!permitted(s, f, p, scope))
    fail('尚未获得该成员的相应授权。'); }
function normalizeProfile(s, p) {
    const result = clone(p), normalized = normalizeNeeds(result.needs);
    result.needs = normalized.needs;
    result.unrecognizedNeeds = [...new Set([...(result.unrecognizedNeeds ?? []), ...normalized.unknown])];
    result.required = [...new Set(result.required)].filter(n => result.needs.includes(n));
    if (result.needs.some(n => !(n in SERVICE_LABELS)))
        fail('未知服务需求。');
    if (result.weight !== null && (!Number.isFinite(result.weight) || result.weight <= 0 || result.weight > 300))
        fail('請輸入有效體重。');
    if (result.months !== null && (!Number.isInteger(result.months) || result.months < 0 || result.months > 216))
        fail('月龄应为 0–216 的整数。');
    for (const field of ['walking', 'stairs', 'wheelchairType', 'equipment'])
        result[field] = String(result[field]).trim().slice(0, 150);
    result.updatedAt = s.demoClock;
    return result;
}
export function assess(profile, kind, aircraft, clock, carrier = 'CX') {
    const missing = [];
    if (kind === 'bassinet') {
        if (bassinetAvailability(aircraft, carrier) === 'verify')
            return { applicability: 'manual', missing: ['需核實承運航司與機型適用性'] };
        if (bassinetAvailability(aircraft, carrier) === 'unavailable')
            return { applicability: 'unavailable', missing: [] };
        if (profile.months !== null && profile.months > RULES.bassinetMaxMonths)
            return { applicability: 'manual', missing: ['已記錄嬰兒籃需求；旅客年齡不符合目前適用條件，需核對'] };
        if (profile.months === null)
            missing.push('宝宝月龄');
        if (profile.weight === null)
            missing.push('宝宝体重');
        if (Date.parse(clock) - Date.parse(profile.updatedAt) > RULES.profileReviewDays * 86400000)
            missing.push('重新核对月龄、体重');
        if (missing.length)
            return { applicability: 'missing', missing };
        if ((profile.months ?? 0) > RULES.bassinetMaxMonths || (profile.weight ?? 0) > RULES.bassinetMaxKg)
            return { applicability: 'manual', missing: ['需人工核实适用条件'] };
    }
    if (kind === 'wheelchair') {
        if (!profile.walking)
            missing.push('步行协助需要');
        if (!profile.stairs)
            missing.push('登梯协助需要');
    }
    if (kind === 'ownWheelchair') {
        if (!profile.wheelchairType)
            missing.push('轮椅类型');
        if (!profile.equipment)
            missing.push('设备尺寸、重量；电动设备须核实电池信息');
        if (!missing.length)
            return { applicability: 'manual', missing: ['设备需人工核实，不推测电池类型'] };
    }
    return { applicability: missing.length ? 'missing' : 'eligible', missing };
}
export function carePreview(s, t) {
    guard(s, t.familyId);
    return t.members.filter(m => permitted(s, t.familyId, m.personId, 'service')).flatMap(m => {
        const p = s.profiles[profileKey(t.familyId, m.personId)];
        if (!p)
            return [];
        return t.route.segments.flatMap((leg, i) => p.needs.map(kind => ({ personId: m.personId, kind, segmentId: `${t.id}-v${t.version}-s${i}`, label: `${leg.origin} — ${leg.destination}`, profile: p, ...assess(profileForAssessment(s, p, t.route.date), kind, leg.aircraft, s.demoClock, leg.operatingCarrier), deadline: new Date(leg.departureUtc - RULES.deadlines[kind] * 3600000).toISOString() })));
    });
}
function archiveTrip(t, s) { t.previous = { version: t.version, number: t.route.number, aircraft: t.route.aircraft, services: requestsFor(s, t).map(r => ({ personId: r.personId, kind: r.kind, progress: r.progress })) }; t.version++; }
function importProfiles(s, t, reconfirm = false) {
    const relations = s.relationships.filter(r => r.familyId === t.familyId && t.members.some(m => m.personId === r.caregiverId) && t.members.some(m => m.personId === r.dependentId));
    const changed = t.snapshots.some(snap => snap.profileVersion !== s.profiles[profileKey(t.familyId, snap.personId)]?.version) || (t.snapshots.length > 0 && JSON.stringify(t.relationships) !== JSON.stringify(relations));
    if (changed && requestsFor(s, t).length)
        archiveTrip(t, s);
    t.snapshots = t.members.filter(m => permitted(s, t.familyId, m.personId, 'service')).map(m => ({ personId: m.personId, profileVersion: s.profiles[profileKey(t.familyId, m.personId)].version, profile: clone(s.profiles[profileKey(t.familyId, m.personId)]) }));
    t.relationships = clone(s.relationships.filter(r => r.familyId === t.familyId && t.members.some(m => m.personId === r.caregiverId) && t.members.some(m => m.personId === r.dependentId)));
    for (const preview of carePreview(s, t)) {
        const key = `${t.familyId}|${t.id}|${t.version}|${preview.personId}|${preview.segmentId}|${preview.kind}`;
        if (Object.values(s.requests).some(r => r.key === key))
            continue;
        const requestId = id(s, 'request');
        s.requests[requestId] = { id: requestId, familyId: t.familyId, tripId: t.id, tripVersion: t.version, personId: preview.personId, segmentId: preview.segmentId, kind: preview.kind, applicability: preview.applicability, progress: preview.applicability === 'missing' ? 'missing' : preview.applicability === 'unavailable' ? 'unavailable' : reconfirm ? 'reconfirm' : 'review', missing: preview.missing, deadline: preview.deadline, key, attempt: 0, receipt: null, ticket: null, history: ['需求快照已确认带入，尚未提交'], manualQueried: false };
    }
    t.needsReview = false;
}
export function requestEnvelope(s, r) { return { epoch: s.epoch, familyId: r.familyId, tripId: r.tripId, version: r.tripVersion, requestId: r.id, attempt: r.attempt }; }
export function eligibleCompanions(s, t) { return t.members.filter(m => age(s.persons[m.personId], s.demoClock) >= 18).map(m => m.personId); }
export function validateMembers(s, t) {
    if (!t.members.length)
        fail('请至少选择一位实际同行人。');
    for (const m of t.members) {
        if (!membership(s, t.familyId, m.personId))
            fail('同行人不属于这个家庭。');
        if (!m.occupiesSeat) {
            if (age(s.persons[m.personId], s.demoClock) >= 2)
                fail('满两岁的旅客需占座。');
            if (!m.companionId || !eligibleCompanions(s, t).includes(m.companionId))
                fail('不占座婴儿必须有本次同行的成年陪同人。');
        }
    }
    const adults = t.members.filter(m => !m.occupiesSeat).map(m => m.companionId);
    if (new Set(adults).size !== adults.length)
        fail('每位不佔座嬰兒需要一位獨立成年陪同人。');
    for (const r of s.relationships.filter(r => r.familyId === t.familyId && r.required))
        if (t.members.some(m => m.personId === r.dependentId) && !t.members.some(m => m.personId === r.caregiverId))
            fail('必要照护关系中的照护人也需要同行。');
}
export function candidates(s, t) { return recoveryCandidates(s, t).map(c => { try {
    validateMembers(s, t);
}
catch (e) {
    c.eligible = false;
    c.reasons.push(e.message);
    if (c.evaluation) {
        c.evaluation.status = 'unavailable';
        c.evaluation.reasons = c.reasons;
    }
} return c; }); }
export function studentOptions(plan) {
    validatePlan(plan);
    const c = { origin: plan.origin, destination: plan.destination, outboundDate: plan.departure, returnDate: '', travelType: 'oneway', travelerIds: [plan.personId], familyId: '', cabin: 'economy', bags: plan.bags, budget: plan.budget, departurePeriod: 'any', flexible: false }, result = searchFlights(c), labels = recommendations(result.outbound);
    return result.outbound.filter(o => o.legs.every(l => l.arrival) && o.total !== null && o.fare !== null && o.tax !== null && o.changeFee !== null).map(o => ({ id: o.id, label: (labels.get(o.id) ?? []).join('／') || '相符航班', route: flightRoute(o, plan.budget), base: o.fare, tax: o.tax, includedBags: o.includedBags, baggage: o.baggageCost ?? 0, hotel: 0, total: o.total, changeFee: o.changeFee, reason: '來自有限日期的模擬時刻表；個人住宿與交通費用另行核對。', overBudget: o.total > plan.budget }));
}
function validDate(value) { const n = Date.parse(value + 'T00:00:00Z'); return /^20\d\d-\d\d-\d\d$/.test(value) && Number.isFinite(n) && new Date(n).toISOString().slice(0, 10) === value; }
export function validatePlan(p) { for (const key of ['start', 'exam', 'holiday', 'holidayEnd', 'graduation', 'dorm', 'departure', 'visa'])
    if (!validDate(p[key]))
        fail('请填写有效的校历、出发和签证日期。'); if (p.exam < p.start || p.graduation < p.exam || p.holidayEnd < p.holiday)
    fail('考试、毕业或假期结束日期的顺序不正确。'); if (p.dorm > p.start)
    fail('宿舍开放晚于开学，请核对校历。'); if (!Number.isInteger(p.bags) || p.bags < 0 || p.bags > 5)
    fail('行李件数应为 0–5。'); validateTrip({ origin: p.origin, destination: p.destination, date: p.departure, budget: p.budget }); }
export function planWarnings(p) { const warnings = []; const options = studentOptions(p), arrival = options[0]?.route.arrivalDate; if (!options.length)
    warnings.push('目前條件沒有相符的航班；請查詢並調整條件。'); if (arrival && p.scenario === 'move' && arrival < p.dorm && !p.accommodation)
    warnings.push('抵达早于宿舍开放，请调整日期或确认临时住宿。'); if (arrival && p.scenario === 'move' && arrival > p.start)
    warnings.push('抵达晚于开学日期，请调整计划。'); if (p.visa < p.departure)
    warnings.push('填写的签证有效期早于出发，请自行核实文件。');
else if (p.visa < p.graduation)
    warnings.push('签证日期早于毕业节点，请核对后续安排；这不是入境许可判断。'); if (p.scenario === 'return' && (p.departure < p.holiday || p.departure > p.holidayEnd))
    warnings.push('学期往返日期不在填写的假期窗口内。'); if (p.scenario === 'graduate' && p.departure < p.graduation)
    warnings.push('回国日期早于毕业节点，请核对。'); return warnings; }
export const taskKey = (s, p, taskId, tripId = null) => `${account(s, p)?.id ?? 'guest'}|${taskId}|${s.demoClock.slice(0, 7)}${TASKS.find(t => t.id === taskId)?.period === 'flight' ? '|' + tripId : ''}`;
export function monthlyEarned(s, p) { const member = account(s, p); return s.ledger.filter(l => l.memberId === member?.id && l.taskId && rewardMonth(l.at) === rewardMonth(s.demoClock)).reduce((n, l) => n + l.amount, 0); }
function canReward(s, p, f) { if (p === s.actorId && account(s, p))
    return true; return !!f && s.persons[p]?.guardianIds.includes(s.actorId) && age(s.persons[p], s.demoClock) < 18 && permitted(s, f, p, 'miles'); }
function addReward(s, progress) {
    const def = TASKS.find(t => t.id === progress.taskId);
    if (s.ledger.some(l => l.key === progress.key)) {
        progress.status = 'credited';
        return;
    }
    const pending = s.ledger.filter(l => l.memberId === progress.memberId && l.taskId && rewardMonth(l.at) === rewardMonth(s.demoClock)).reduce((n, l) => n + l.amount, 0);
    if (pending + def.reward > MONTHLY_REWARD_CAP) {
        progress.status = 'failed';
        return;
    }
    const qualifying = def.qualifying && TASK_REWARDS_EXTEND_EXPIRY;
    s.ledger.push({ id: id(s, 'ledger'), memberId: progress.memberId, amount: def.reward, kind: progress.taskId === 'flight-milestone' ? 'flight' : 'task', key: progress.key, at: s.demoClock, qualifying, taskId: def.id });
    progress.status = 'credited';
    if (qualifying)
        s.accounts[progress.memberId].expiry = new Date(Date.parse(s.demoClock) + 18 * 30 * 86400000).toISOString().slice(0, 10);
    event(s, 'reward_credited', { memberId: progress.memberId, ...(progress.familyId ? { familyId: progress.familyId } : {}), ...(progress.tripId ? { tripId: progress.tripId } : {}) }, 'reward-' + progress.key);
}
export function reduce(previous, action) {
    const s = clone(previous);
    switch (action.type) {
        case 'switchFamily':
            guard(s, action.familyId);
            s.activeFamilyId = action.familyId;
            break;
        case 'identity':
            if (!s.persons[action.personId])
                fail('無法識別目前帳號。');
            s.actorId = action.personId;
            s.activeFamilyId = familiesFor(s)[0]?.id ?? null;
            if (!s.plans[s.actorId])
                s.plans[s.actorId] = newPlan(s.actorId);
            break;
        case 'createFamily': {
            if (!account(s, s.actorId))
                fail('請先建立帳號並保存。');
            const name = action.name.trim().slice(0, 30);
            if (!name)
                fail('请填写家庭名称。');
            const f = id(s, 'family');
            s.families[f] = { id: f, name, currentTripId: null, goal: 30000, archived: false };
            s.memberships.push({ familyId: f, personId: s.actorId, role: 'owner', label: '本人', active: true });
            s.profiles[profileKey(f, s.actorId)] = emptyProfile(f, s.actorId);
            s.activeFamilyId = f;
            break;
        }
        case 'renameFamily':
            own(s, action.familyId);
            if (!action.name.trim())
                fail('家庭名称不能为空。');
            s.families[action.familyId].name = action.name.trim().slice(0, 30);
            break;
        case 'archiveFamily':
            own(s, action.familyId);
            s.families[action.familyId].archived = true;
            s.activeFamilyId = familiesFor(s)[0]?.id ?? null;
            break;
        case 'leaveFamily': {
            guard(s, action.familyId);
            if (membership(s, action.familyId)?.role === 'owner')
                fail('管理员请先转移角色或归档家庭。');
            membership(s, action.familyId).active = false;
            s.activeFamilyId = familiesFor(s)[0]?.id ?? null;
            break;
        }
        case 'role':
            own(s, action.familyId);
            if (action.personId === s.actorId)
                fail('不能移除最後一位管理員。');
            if (!membership(s, action.familyId, action.personId))
                fail('成员不在家庭中。');
            membership(s, action.familyId, action.personId).role = action.role;
            break;
        case 'invite': {
            own(s, action.familyId);
            if (!s.persons[action.personId])
                fail('請選擇家庭成員。');
            if (membership(s, action.familyId, action.personId))
                fail('这个人已在家庭中，无需重复邀请。');
            if (s.invitations.some(i => i.familyId === action.familyId && i.personId === action.personId && i.status === 'pending'))
                fail('邀請已建立，等待受邀者接受。');
            s.invitations.push({ id: id(s, 'invite'), familyId: action.familyId, personId: action.personId, role: action.role, status: 'pending', kind: account(s, action.personId) ? 'member' : 'register' });
            break;
        }
        case 'acceptInvite': {
            const i = s.invitations.find(i => i.id === action.invitationId);
            if (!i)
                fail('邀请不存在。');
            if (i.status === 'accepted')
                break;
            if (!action.agree)
                fail('需要被邀请人明确接受。');
            if (s.actorId !== i.personId && membership(s, i.familyId)?.role !== 'owner')
                fail('沒有處理這份邀請的權限。');
            if (!account(s, i.personId)) {
                if (age(s.persons[i.personId], s.demoClock) < MIN_MEMBER_AGE)
                    fail('未满两岁的宝宝保留旅客档案，不创建里数账户。');
                if (age(s.persons[i.personId], s.demoClock) < 18 && !s.persons[i.personId].guardianIds.includes(s.actorId))
                    fail('未成年非会员须先由关联监护人核对开户。');
                register(s, i.personId);
            }
            if (!membership(s, i.familyId, i.personId))
                s.memberships.push({ familyId: i.familyId, personId: i.personId, role: i.role, label: '受邀成员', active: true });
            s.profiles[profileKey(i.familyId, i.personId)] ??= emptyProfile(i.familyId, i.personId);
            i.status = 'accepted';
            event(s, 'family_invitation_accepted', { familyId: i.familyId, personId: i.personId }, 'invite-' + i.id);
            break;
        }
        case 'person': {
            if (s.actorId !== action.personId && !(age(s.persons[action.personId], s.demoClock) < 18 && s.persons[action.personId]?.guardianIds.includes(s.actorId)))
                fail('身份资料仅由本人或未成年人的监护人修改。');
            if (!action.name.trim())
                fail('姓名不能为空。');
            s.persons[action.personId].name = action.name.trim().slice(0, 30);
            s.persons[action.personId].displayName = action.name.trim().slice(0, 30);
            s.persons[action.personId].displayNames = {};
            s.persons[action.personId].nickname = action.nickname.trim().slice(0, 30);
            break;
        }
        case 'newPerson': {
            own(s, action.familyId);
            if (!action.name.trim() || !validDate(action.dob) || action.dob > s.demoClock.slice(0, 10))
                fail('請填寫有效的姓名和出生日期。');
            const pid = id(s, 'person');
            const p = { id: pid, name: action.name.trim().slice(0, 30), nickname: action.name.trim().slice(0, 30), dob: action.dob, guardianIds: [] };
            if (age(p, s.demoClock) < 18 && !action.guardianConfirmed)
                fail('为未成年人创建档案前，请明确核对監護關係。');
            if (age(p, s.demoClock) < 18)
                p.guardianIds = [s.actorId];
            s.persons[pid] = p;
            s.memberships.push({ familyId: action.familyId, personId: pid, role: 'viewer', label: '新增旅客', active: true });
            s.profiles[profileKey(action.familyId, pid)] = emptyProfile(action.familyId, pid);
            if (p.guardianIds.length)
                s.consents.push({ id: id(s, 'consent'), familyId: action.familyId, personId: pid, granteeId: s.actorId, scopes: ['care:view', 'care:edit', 'service', 'passport', 'miles'], grantedBy: s.actorId, active: true });
            break;
        }
        case 'consent': {
            guard(s, action.familyId);
            const p = s.persons[action.personId];
            if (s.actorId !== p.id && !(age(p, s.demoClock) < 18 && p.guardianIds.includes(s.actorId)))
                fail('共享资料须由本人或未成年人的监护人授权。');
            if (!membership(s, action.familyId, action.granteeId))
                fail('被授权人须在目标家庭中。');
            let c = s.consents.find(c => c.familyId === action.familyId && c.personId === p.id && c.granteeId === action.granteeId);
            if (!c) {
                c = { id: id(s, 'consent'), familyId: action.familyId, personId: p.id, granteeId: action.granteeId, grantedBy: s.actorId, scopes: [], active: false };
                s.consents.push(c);
            }
            c.scopes = [...action.scopes];
            c.active = action.agree;
            c.grantedBy = s.actorId;
            break;
        }
        case 'register': {
            const p = s.persons[action.personId];
            if (!p || !action.agree)
                fail('請先核對資料並同意建立帳號。');
            if (age(p, s.demoClock) < MIN_MEMBER_AGE)
                fail('未满两岁的宝宝仅建立旅客档案。');
            if (age(p, s.demoClock) < 18 && !p.guardianIds.includes(action.guardianId ?? ''))
                fail('请由已关联的监护人核对。');
            if (p.id !== s.actorId && !p.guardianIds.includes(s.actorId))
                fail('只有本人或监护人可以发起注册。');
            register(s, p.id);
            break;
        }
        case 'care': {
            const p = action.profile;
            checkCare(s, p.familyId, p.personId, 'care:edit');
            const next = normalizeProfile(s, p);
            next.version = (s.profiles[profileKey(p.familyId, p.personId)]?.version ?? 0) + 1;
            s.profiles[profileKey(p.familyId, p.personId)] = next;
            for (const t of Object.values(s.trips))
                if (t.familyId === p.familyId && t.snapshots.some(x => x.personId === p.personId) && t.status !== 'completed')
                    t.needsReview = true;
            event(s, 'care_saved', { familyId: p.familyId, personId: p.personId }, `care-${p.familyId}-${p.personId}-${next.version}`);
            break;
        }
        case 'copyCare': {
            if (!action.confirmed)
                fail('复制前请确认来源、目标和内容。');
            if (!permitted(s, action.fromFamily, action.personId, 'care:view'))
                fail('无权读取来源家庭的需求。');
            checkCare(s, action.toFamily, action.personId, 'care:edit');
            const p = clone(s.profiles[profileKey(action.fromFamily, action.personId)]);
            p.familyId = action.toFamily;
            return reduce(s, { type: 'care', profile: p });
        }
        case 'relationship': {
            checkCare(s, action.familyId, action.dependentId, 'care:edit');
            if (!membership(s, action.familyId, action.caregiverId) || age(s.persons[action.caregiverId], s.demoClock) < 18 || action.caregiverId === action.dependentId)
                fail('请选择本家庭中的成年照护人。');
            s.relationships = s.relationships.filter(r => !(r.familyId === action.familyId && r.dependentId === action.dependentId));
            s.relationships.push({ familyId: action.familyId, dependentId: action.dependentId, caregiverId: action.caregiverId, required: action.required });
            for (const t of Object.values(s.trips))
                if (t.familyId === action.familyId && t.snapshots.length)
                    t.needsReview = true;
            break;
        }
        case 'members': {
            const t = getTrip(s, action.familyId, action.tripId);
            if (t.status === 'completed')
                fail('已完成的飞行记录不能修改。');
            const members = [...new Set(action.personIds)].map(personId => ({ personId, occupiesSeat: age(s.persons[personId], s.demoClock) >= 2, companionId: age(s.persons[personId], s.demoClock) < 2 ? s.relationships.find(r => r.familyId === t.familyId && r.dependentId === personId)?.caregiverId ?? null : null }));
            if (JSON.stringify(members) !== JSON.stringify(t.members)) {
                archiveTrip(t, s);
                t.members = members;
                t.snapshots = [];
                t.relationships = [];
                t.needsReview = true;
            }
            validateMembers(s, t);
            break;
        }
        case 'route': {
            guard(s, action.familyId, true);
            const input = validateTrip(action.input), family = s.families[action.familyId];
            let t = currentTrip(s, family.id);
            if (!t) {
                const tripId = id(s, 'trip');
                t = { id: tripId, familyId: family.id, version: 1, route: buildItinerary(input), members: [], snapshots: [], relationships: [], status: 'planned', checklist: {}, needsReview: false, noCandidates: false };
                s.trips[tripId] = t;
                family.currentTripId = tripId;
            }
            else {
                archiveTrip(t, s);
                t.route = buildItinerary(input);
                t.snapshots = [];
                t.relationships = [];
                t.status = 'planned';
                t.needsReview = true;
                t.noCandidates = false;
                delete t.event;
            }
            const occupied = t.members.filter(m => m.occupiesSeat).length;
            const total = t.route.adultFare * occupied + t.route.infantFare * (t.members.length - occupied);
            if (total > input.budget)
                fail('目前同行旅客的參考票價超出預算。');
            break;
        }
        case 'importCare': {
            const t = getTrip(s, action.familyId, action.tripId);
            if (!action.confirmed)
                fail('请先预览并确认资料用途。');
            if (t.status === 'completed')
                fail('已完成行程不再接受申请。');
            validateMembers(s, t);
            importProfiles(s, t);
            break;
        }
        case 'submit': {
            const r = s.requests[action.requestId];
            if (!r)
                fail('申请不存在。');
            checkCare(s, r.familyId, r.personId, 'service');
            const t = s.trips[r.tripId];
            if (r.tripVersion !== t.version)
                fail('行程已变更，请核对当前版本。');
            if (t.status === 'completed' || segmentCancelled(s, t.id, r.segmentId) || s.journeys?.items[t.id]?.segments.some(seg => seg.id === r.segmentId && seg.actualLanding))
                fail('本航段不能再提交行前服務，請查看紀錄或整理服務問題。');
            if (['submitted', 'confirmed'].includes(r.progress) || currentCase(s, r))
                break;
            if (r.progress === 'unknown' && !r.manualQueried)
                fail('结果未知，请先查询原请求，不要重复提交。');
            if (['missing', 'unavailable'].includes(r.applicability))
                fail('请先补充资料或选择可用方案。');
            if (r.applicability === 'manual' && !r.ticket)
                fail('这个需求需要先授权创建人工核实工单。');
            if (Date.parse(s.demoClock) > Date.parse(r.deadline) && !r.ticket)
                fail('已过此服务的辦理期限，请转人工核实。');
            if (r.attempt === 0)
                r.identitySnapshot = { personId: r.personId, displayName: displayName(s.persons[r.personId]), bookingName: s.persons[r.personId].bookingName, capturedAt: s.demoClock, legacy: false };
            r.consentAt ??= s.demoClock;
            serviceEvent(r, 'sending', s.demoClock);
            r.progress = 'submitted';
            r.attempt++;
            r.receipt = null;
            r.manualQueried = false;
            r.history.push('已发送模拟申请，等待受理回执');
            event(s, 'application_submitted', { familyId: r.familyId, tripId: r.tripId, personId: r.personId }, 'submit-' + r.key);
            break;
        }
        case 'receipt': {
            const e = action.envelope, r = s.requests[e.requestId];
            if (e.epoch !== s.epoch || !r || r.familyId !== e.familyId || r.tripId !== e.tripId || r.tripVersion !== e.version || r.attempt !== e.attempt)
                break;
            if (s.trips[r.tripId]?.version !== e.version || segmentCancelled(s, r.tripId, r.segmentId) || r.progress === 'reconfirm') {
                r.lateReceipts ??= [];
                if (!r.lateReceipts.some(x => x.attempt === e.attempt && x.result === action.result))
                    r.lateReceipts.push({ at: s.demoClock, result: action.result, attempt: e.attempt });
                break;
            }
            if (r.progress !== 'submitted')
                break;
            if (action.result === 'accepted') {
                r.receipt = `ACK-${r.id}-${r.attempt}`;
                r.history.push('模拟受理成功，尚未批准服务');
                serviceEvent(r, 'accepted', s.demoClock);
            }
            else if (action.result === 'timeout') {
                r.progress = 'unknown';
                serviceEvent(r, 'unknown', s.demoClock);
                r.history.push('等待回执超时，须查询原请求');
            }
            else {
                r.progress = 'review';
                serviceEvent(r, 'failed', s.demoClock);
                r.history.push('模拟发送失败，可重试原申请');
            }
            break;
        }
        case 'query': {
            const r = s.requests[action.requestId];
            if (!r)
                fail('申请不存在。');
            checkCare(s, r.familyId, r.personId, 'service');
            if (r.progress !== 'unknown')
                fail('只有结果待核实的请求需要查询。');
            r.manualQueried = true;
            if (action.found) {
                r.progress = 'submitted';
                r.receipt = `ACK-${r.id}-${r.attempt}`;
                r.history.push('查询原请求：已受理，未重复提交');
                serviceEvent(r, 'accepted', s.demoClock);
            }
            else {
                r.progress = 'review';
                r.history.push('查询原请求：明确未受理，可用原标识重试');
            }
            break;
        }
        case 'ticket': {
            const r = s.requests[action.requestId];
            if (!r || !action.authorized)
                fail('保存跟進紀錄前需要預覽並授權。');
            checkCare(s, r.familyId, r.personId, 'service');
            if (r.tripVersion !== s.trips[r.tripId].version)
                fail('请使用当前行程版本。');
            if (segmentCancelled(s, r.tripId, r.segmentId) || s.trips[r.tripId].status === 'completed')
                fail('請先處理航班變更或查看歷史紀錄。');
            if (!currentCase(s, r)) {
                createFollowUp(s, r);
                r.history.push('已授权创建模拟人工工单；不代表服务获批');
            }
            break;
        }
        case 'confirmService': {
            const r = s.requests[action.requestId];
            if (!r)
                fail('申请不存在。');
            checkCare(s, r.familyId, r.personId, 'service');
            if (r.tripVersion !== s.trips[r.tripId].version)
                fail('旧回执不能确认新行程。');
            if (['unavailable', 'missing'].includes(r.applicability))
                fail('该申请不满足必要条件，工单不能代替适用性核对。');
            if (r.progress !== 'submitted' || !r.receipt)
                fail('需要先收到受理回執。');
            r.progress = 'confirmed';
            serviceEvent(r, 'confirmed', s.demoClock);
            r.history.push('模拟业务确认：仅适用于此成员、航段与行程版本');
            break;
        }
        case 'disruption': {
            const t = getTrip(s, action.familyId, action.tripId);
            if (t.status === 'completed')
                fail('已完成行程不能取消。');
            t.noCandidates = action.event === 'none';
            t.event = action.event === 'aircraft' ? 'aircraft' : 'cancel';
            t.status = 'cancelled';
            break;
        }
        case 'rebook': {
            if (tripDecision(s, action.tripId).cancelled)
                fail('已取消的行程不可改簽，請新增行程。');
            const t = getTrip(s, action.familyId, action.tripId);
            if (!action.confirmed || t.status !== 'cancelled')
                fail('请先加载异常并确认候选方案。');
            const c = candidates(s, t).find(c => c.id === action.candidateId);
            if (!c?.eligible)
                fail('该方案不满足同行或必要照护条件。');
            if (action.expectedFingerprint && c.evaluation?.fingerprint !== action.expectedFingerprint)
                fail('旅客、行程、候選或費用已變更，請重新預覽確認。');
            const previousSnapshots = clone(t.snapshots), relationships = clone(t.relationships);
            archiveTrip(t, s);
            t.route = c.route;
            t.candidateSeatGroups = c.seatGroups;
            t.candidateSeats = clone(c.evaluation?.assignments ?? {});
            t.status = 'changed';
            t.noCandidates = false;
            if (s.dual)
                for (const task of Object.values({ ...s.dual.tasks }).filter(x => x.tripId === t.id && x.version === t.version - 1)) {
                    s.dual.tasks[task.taskId + ':history:v' + task.version] = { ...task, taskId: task.taskId + ':history:v' + task.version };
                    s.dual.tasks[task.taskId] = { ...task, version: t.version, status: ['documents', 'packing', 'eligibility'].includes(task.kind) ? task.status : 'reconfirm', next: ['documents', 'packing', 'eligibility'].includes(task.kind) ? task.next : '改簽後請核對受影響的時間與服務安排' };
                }
            t.snapshots = previousSnapshots;
            t.relationships = relationships;
            // Copy the trip snapshot, never silently replace it with later long-term profile edits.
            for (const snap of t.snapshots)
                for (const [i, leg] of t.route.segments.entries())
                    for (const kind of snap.profile.needs) {
                        const a = assess(snap.profile, kind, leg.aircraft, s.demoClock, leg.operatingCarrier), rid = id(s, 'request'), segmentId = `${t.id}-v${t.version}-s${i}`, key = `${t.familyId}|${t.id}|${t.version}|${snap.personId}|${segmentId}|${kind}`;
                        s.requests[rid] = { id: rid, familyId: t.familyId, tripId: t.id, tripVersion: t.version, personId: snap.personId, segmentId, kind, caregiverId: kind === 'adjacent' ? t.relationships.find(x => x.dependentId === snap.personId)?.caregiverId : undefined, ...a, progress: a.applicability === 'unavailable' ? 'unavailable' : a.applicability === 'missing' ? 'missing' : 'reconfirm', deadline: new Date(leg.departureUtc - RULES.deadlines[kind] * 3600000).toISOString(), key, attempt: 0, receipt: null, ticket: null, history: ['原需求已带入；原服务确认未继承'], manualQueried: false };
                    }
            event(s, 'candidate_selected', { familyId: t.familyId, tripId: t.id }, `candidate-${t.id}-v${t.version}`);
            break;
        }
        case 'completeFlight': {
            const t = getTrip(s, action.familyId, action.tripId);
            if (s.seedVersion)
                fail('請在行程助手逐段接收落地及飛行完成紀錄；不能一次完成整趟往返。');
            if (t.status === 'cancelled')
                fail('取消航班不能生成飞行记录。');
            if (t.status === 'completed')
                break;
            validateMembers(s, t);
            t.status = 'completed';
            for (const m of t.members) {
                const p = s.persons[m.personId], acc = account(s, p.id);
                if (!acc || age(p, s.demoClock) < 2)
                    continue;
                for (const [i, leg] of t.route.segments.entries()) {
                    const segmentKey = `${t.id}-v${t.version}-s${i}-${p.id}`;
                    if (s.stamps.some(st => st.segmentKey === segmentKey))
                        continue;
                    s.stamps.push({ id: id(s, 'stamp'), personId: p.id, segmentKey, familyId: t.familyId, city: airport(leg.destination).city, aircraft: leg.aircraft, date: leg.arrivalDate, flight: t.route.number, sharedFamilies: [t.familyId] });
                    event(s, 'passport_stamped', { personId: p.id, familyId: t.familyId, tripId: t.id }, 'stamp-' + segmentKey);
                    if (age(p, s.demoClock) <= 17) {
                        const key = `${acc.id}|flight-milestone|${s.demoClock.slice(0, 7)}|${segmentKey}`;
                        const count = s.ledger.filter(l => l.memberId === acc.id && l.taskId === 'flight-milestone' && rewardMonth(l.at) === rewardMonth(s.demoClock)).length;
                        if (count < 2) {
                            const progress = { key, personId: p.id, memberId: acc.id, taskId: 'flight-milestone', period: s.demoClock.slice(0, 7), familyId: t.familyId, tripId: t.id, status: 'processing', attempt: 1 };
                            s.tasks[key] = progress;
                            addReward(s, progress);
                        }
                    }
                }
            }
            break;
        }
        case 'check': {
            const t = getTrip(s, action.familyId, action.tripId);
            if (action.key === 'onboard' && t.status === 'cancelled')
                fail('取消航班不能进入机上场景，请先确认替代行程。');
            t.checklist[action.key] = action.value;
            break;
        }
        case 'plan':
            if (!canPlan(s))
                fail('此功能適用於學生帳戶');
            if (action.plan.personId !== s.actorId)
                fail('学生计划属于当前个人空间。');
            validateCalendarPlan(action.plan);
            s.plans[s.actorId] = clone(action.plan);
            s.plans[s.actorId].saved = false;
            break;
        case 'savePlan':
        case 'subscribe': {
            if (s.dual)
                requireStudent(s, action.personId);
            if (action.personId !== s.actorId || !account(s, s.actorId))
                fail('請先建立帳號以保存資料及提醒。');
            const p = s.plans[s.actorId];
            validateCalendarPlan(p);
            if (action.type === 'savePlan') {
                p.saved = true;
                if (p.calendarConfirmed)
                    saveCalendarVersion(s, p);
                event(s, 'plan_saved', { personId: s.actorId, memberId: account(s, s.actorId).id }, id(s, 'plan-save'));
            }
            else
                p.subscribed = true;
            break;
        }
        case 'sharePlan': {
            if (s.dual)
                requireStudent(s, action.personId);
            if (action.personId !== s.actorId || !account(s, s.actorId))
                fail('只能分享本人的已注册计划。');
            guard(s, action.familyId);
            s.plans[s.actorId].sharedWith = { familyId: action.familyId, scope: action.scope };
            break;
        }
        case 'completeTask': {
            if (s.familyTaskRewards?.completions.some(c => c.familyId === action.familyId && c.taskDefinitionId === action.taskId && (c.businessScopeKey === s.selectedTripId)))
                fail('這項共同任務已由家庭完成，請領取本人的家庭資格。');
            const def = TASKS.find(t => t.id === action.taskId);
            if (!def || def.kind === 'milestone')
                fail('此任务通过飞行事件完成。');
            if (!canReward(s, action.personId, action.familyId))
                fail('奖励仅可发给本人或已授权管理的儿童会员。');
            if (def.kind === 'quiz' && action.answer !== def.answer)
                fail('还差一点：先确认当地时区、交通和住宿安排，再试一次。');
            if (def.kind === 'read' && !action.confirmed)
                fail('请阅读并确认准备内容。');
            if (def.kind === 'learn') {
                requireStudent(s, action.personId);
                if (s.dual)
                    fail('請使用學期規劃中的三項準備任務');
                const p = s.plans[action.personId];
                if (!p?.calendarConfirmed || !p.checks.documents || !p.checks.bags)
                    fail('先确认校历、证件日期提醒和行李清单。');
            }
            if (['photo', 'hunt'].includes(def.kind) && !action.confirmed)
                fail('请完成图片预览或机上准备核对。');
            if (def.kind === 'hunt' && (!action.familyId || currentTrip(s, action.familyId)?.status === 'cancelled' || !currentTrip(s, action.familyId) || !(currentTrip(s, action.familyId).checklist.onboard || currentTrip(s, action.familyId).status === 'completed')))
                fail('此任務適用於機上階段。');
            const key = taskKey(s, action.personId, def.id);
            s.tasks[key] ??= { key, personId: action.personId, memberId: account(s, action.personId).id, taskId: def.id, period: s.demoClock.slice(0, 7), familyId: action.familyId, tripId: null, status: 'available', attempt: 0 };
            break;
        }
        case 'claim': {
            const p = s.tasks[action.key];
            if (p && s.familyTaskRewards?.completions.some(c => c.familyId === p.familyId && c.taskDefinitionId === p.taskId && (c.businessScopeKey === p.tripId || !p.tripId && c.completedAt.slice(0, 7) === p.period)))
                fail('這項共同任務已有家庭獎勵資格，不能從舊入口重複領取。');
            if (s.dual && p?.taskId === 'calendar-learn')
                fail('請使用新的學期準備任務；舊流水保留');
            if (!p || !canReward(s, p.personId, p.familyId))
                fail('没有领取这项奖励的权限。');
            if (['credited', 'processing'].includes(p.status))
                break;
            const learned = Object.values(s.learning?.events ?? {}).filter(e => e.memberId === p.memberId && ['processing', 'unknown'].includes(e.status)).reduce((n, e) => n + e.amount, 0);
            const reserved = learned + feedbackReserved(s, p.memberId) + Object.values(s.tasks).filter(t => t.memberId === p.memberId && t.status === 'processing' && t.period === p.period).reduce((n, t) => n + (TASKS.find(d => d.id === t.taskId)?.reward ?? 0), 0);
            if (monthlyEarned(s, p.personId) + reserved + TASKS.find(t => t.id === p.taskId).reward > MONTHLY_REWARD_CAP)
                fail('已達本月獎勵上限。');
            p.status = 'processing';
            p.attempt++;
            break;
        }
        case 'rewardReceipt': {
            const p = s.tasks[action.key];
            if (action.epoch !== s.epoch || !p || p.status !== 'processing' || p.attempt !== action.attempt)
                break;
            if (action.success)
                addReward(s, p);
            else
                p.status = 'failed';
            break;
        }
        case 'clock':
            if (!Number.isFinite(Date.parse(action.value)))
                fail('演示时间无效。');
            s.demoClock = new Date(action.value).toISOString();
            break;
        case 'mockMode':
            s.mockMode = action.mode;
            break;
        case 'adult': {
            const p = s.persons[action.personId];
            if (s.actorId !== p.id || age(p, s.demoClock) < 18)
                fail('成年后由本人确认后续共享。');
            s.adultSharing[p.id] = action.share;
            for (const c of s.consents.filter(c => c.personId === p.id && p.guardianIds.includes(c.granteeId))) {
                c.active = action.share;
                c.scopes = c.scopes.filter(x => !['care:edit', 'service'].includes(x));
            }
            break;
        }
        case 'verifyStudent':
            if (s.actorId !== action.personId || !account(s, s.actorId))
                fail('请使用本人会员账号。');
            account(s, s.actorId).studentVerified = true;
            break;
        case 'claimKit': {
            if (action.personId !== s.actorId || age(s.persons[s.actorId], s.demoClock) < 18 || !account(s, s.actorId))
                fail('18 岁后由会员本人领取。');
            s.milestones['solo-kit:' + s.actorId] = true;
            event(s, 'solo_kit_claimed', { personId: s.actorId }, 'solo-kit:' + s.actorId);
            break;
        }
        case 'goal':
            own(s, action.familyId);
            if (!Number.isInteger(action.amount) || action.amount < 1000 || action.amount > 1000000)
                fail('请输入 1,000–1,000,000 的目标里数。');
            s.families[action.familyId].goal = action.amount;
            break;
    }
    return migrateIdentity(s);
}
function register(s, p) { if (account(s, p))
    return; const memberId = id(s, 'member'); s.accounts[memberId] = { id: memberId, personId: p, joinedAt: s.demoClock.slice(0, 10), expiry: '2029-03-14', studentVerified: false }; event(s, 'registration', { personId: p, memberId }, 'register-' + memberId); }
export function assistantContext(s, f, student = false) { if (student) {
    if (!canPlan(s))
        return { restricted: true };
    const p = s.plans[s.actorId];
    return { plan: p, membership: !!account(s, s.actorId) };
} if (!f || !membership(s, f))
    return { family: null }; const t = currentTrip(s, f); return { family: s.families[f].name, role: membership(s, f).role, trip: t ? { id: t.id, version: t.version, origin: t.route.origin, destination: t.route.destination, members: t.members.length } : null, profiles: familyMembers(s, f).filter(m => permitted(s, f, m.personId, 'care:view')).map(m => ({ name: s.persons[m.personId].name, profile: s.profiles[profileKey(f, m.personId)] })), requests: t ? visibleRequests(s, t) : [] }; }
export function assistantReply(s, f, text, student = false) {
    if (student || /开学|校历/.test(text)) {
        if (!canPlan(s))
            return { role: 'assistant', text: '此功能適用於學生帳戶。你仍可使用一般航班試算。' };
        const p = s.plans[s.actorId];
        return { role: 'assistant', text: `你的个人计划为 ${p.departure} 出发，${p.start} 开学。${planWarnings(p).join(' ') || '当前填写的日期未发现冲突。'}修改日期后请重新比较方案，再保存计划。`, action: 'student' };
    }
    if (!f || !membership(s, f))
        return { role: 'assistant', text: '请先选择你有权限访问的家庭，或在学期规划中试算。' };
    const t = currentTrip(s, f), requests = t ? visibleRequests(s, t) : [];
    if (/奖励|领取|里数/.test(text)) {
        const earned = monthlyEarned(s, s.actorId);
        return { role: 'assistant', text: `同一会员、同一任务和周期只入账一次，切换家庭不会重置。你本月已入账 ${earned} 里，本月上限 ${MONTHLY_REWARD_CAP} 里。登录和浏览不延长里数有效期。`, action: 'rewards' };
    }
    if (/航班|替代|区别|取消/.test(text) && t) {
        const cs = candidates(s, t).filter(c => c.eligible);
        return { role: 'assistant', text: cs.length ? `当前是${s.families[f].name}的行程 v${t.version}。较早方案优先时间，婴儿篮${cs[0].bassinet === 'unavailable' ? '机型不提供' : '仍待确认'}；较晚方案可申请相关服务，但需新回执。${t.members.length} 位旅客需要 ${t.members.filter(m => m.occupiesSeat).length} 个独立座位。` : '当前没有满足条件的方案，应保留全家记录并转人工。', action: 'recovery' };
    }
    if (/轮椅|外婆|宝宝|摇篮/.test(text)) {
        const profiles = familyMembers(s, f).filter(m => permitted(s, f, m.personId, 'care:view')).map(m => s.profiles[profileKey(f, m.personId)]);
        const needs = profiles.flatMap(p => p.needs.flatMap(k => assess(p, k, t?.route.aircraft ?? 'A330', s.demoClock).missing));
        return { role: 'assistant', text: needs.length ? `当前获授权的档案还需补充：${[...new Set(needs)].join('、')}。可在照护档案中核对；保存不会自动提交申请。` : '请在下方使用“提取照护需求”，确认成员与缺项后再保存。不会根据年龄推测轮椅需求。', action: 'care' };
    }
    if (/准备|没|还有/.test(text)) {
        const pending = requests.filter(r => r.progress !== 'confirmed');
        return { role: 'assistant', text: `${s.families[f].name}目前有 ${pending.length} 项可见服务尚未确认。${!t?.snapshots.length ? '还没有带入本次行程的需求快照。' : ''}${t?.needsReview ? '长期档案有更新，本次行程需要复核。' : ''}先查看出行准备，再处理缺项和回执。`, action: 'preparation' };
    }
    return { role: 'assistant', text: '我能协助检查准备进度、解释替代方案和奖励规则。其他输入请补充具体成员和需求，或使用页面表单。' };
}
export function extraction(s, f, text) { guard(s, f); if (/不需要|不要|不用|取消/.test(text))
    return []; const members = familyMembers(s, f); const definitions = [[/輪椅|轮椅|走不了太远|走不远/, 'wheelchair'], [/摇篮|搖籃|婴儿篮|嬰兒籃/, 'bassinet'], [/坐在一起|相邻|相鄰/, 'adjacent'], [/儿童餐|兒童餐/, 'childMeal'], [/婴儿餐|嬰兒餐/, 'infantMeal'], [/素食|特殊餐/, 'specialMeal']]; const named = members.filter(m => { const p = s.persons[m.personId]; return [p.name, p.displayName, p.nickname].filter(Boolean).some(n => text.includes(n)); }); return definitions.filter(([re]) => re.test(text)).map(([, kind]) => ({ kind, personIds: (named.length ? named : members).map(m => m.personId) })); }
export function restore(raw) {
    if (!raw)
        return { state: seed(), recovered: false };
    try {
        const s = JSON.parse(raw);
        if (s.schemaVersion !== 3)
            throw Error('schema');
        for (const field of ['persons', 'accounts', 'families', 'profiles', 'trips', 'requests', 'plans', 'tasks', 'messages', 'adultSharing'])
            if (!s[field] || typeof s[field] !== 'object' || Array.isArray(s[field]))
                throw Error(field);
        for (const field of ['memberships', 'relationships', 'ledger', 'stamps', 'consents', 'events', 'invitations'])
            if (!Array.isArray(s[field]))
                throw Error(field);
        if (!s.persons[s.actorId] || !s.epoch || !Number.isInteger(s.counter) || !Number.isFinite(Date.parse(s.demoClock)))
            throw Error('root');
        initFunds(s, !s.funds);
        const memberPeople = Object.values(s.accounts).map(a => a.personId);
        if (new Set(memberPeople).size !== memberPeople.length || memberPeople.some(p => !s.persons[p] || age(s.persons[p], s.demoClock) < 2))
            throw Error('accounts');
        if (s.memberships.some(m => !s.families[m.familyId] || !s.persons[m.personId] || !['owner', 'editor', 'viewer'].includes(m.role)))
            throw Error('members');
        for (const p of Object.values(s.profiles))
            if (!s.persons[p.personId] || !s.families[p.familyId] || !Array.isArray(p.needs) || !Array.isArray(p.required) || p.needs.some(n => !(n in SERVICE_LABELS)))
                throw Error('profiles');
        for (const t of Object.values(s.trips)) {
            if (!s.families[t.familyId] || !Array.isArray(t.members) || !Array.isArray(t.snapshots) || !Array.isArray(t.relationships) || !Array.isArray(t.route?.segments) || !Number.isInteger(t.version))
                throw Error('trips');
            validateTrip(t.route);
        }
        if (s.ledger.some(l => !s.accounts[l.memberId] || !Number.isFinite(l.amount)) || new Set(s.ledger.map(l => l.key)).size !== s.ledger.length || new Set(s.stamps.map(st => st.segmentKey)).size !== s.stamps.length)
            throw Error('ledger');
        for (const p of Object.values(s.plans))
            if (p.saved)
                validateCalendarPlan(p);
        if (s.activeFamilyId && !familiesFor(s).some(f => f.id === s.activeFamilyId))
            s.activeFamilyId = familiesFor(s)[0]?.id ?? null;
        // The page may close while a mock request is in flight. Never manufacture success on reload.
        for (const r of Object.values(s.requests)) {
            if (!s.trips[r.tripId] || r.familyId !== s.trips[r.tripId].familyId || !s.persons[r.personId])
                throw Error('requests');
            if (r.progress === 'submitted' && !r.receipt) {
                r.progress = 'unknown';
                r.history.push('页面恢复：查询原请求后继续');
            }
        }
        for (const f of Object.values(s.funds)) {
            if (!s.persons[f.ownerId] || !Array.isArray(f.invited) || !Number.isInteger(f.target) || !['open', 'refunding', 'cancelled', 'redeemed'].includes(f.status))
                throw Error('fund');
            validateTrip({ origin: f.origin, destination: f.destination, date: f.from, budget: 300000 });
        }
        for (const c of Object.values(s.supports)) {
            if (!s.funds[c.fundId] || !s.persons[c.personId] || !Number.isInteger(c.amount) || c.amount <= 0)
                throw Error('support');
            if (c.status === 'pending' && !s.dual?.transactions[c.id])
                c.status = 'failed';
        }
        for (const t of Object.values(s.tasks))
            if (t.status === 'processing')
                t.status = 'failed';
        return { state: migrateIdentity(s), recovered: false };
    }
    catch {
        return { state: seed(), recovered: true };
    }
}
// Called only after validated completion evidence. Same ledger/task contract as the legacy flight path.
export function creditFlightMilestone(s, personId, segmentKey, tripId, familyId, clock) { const acc = account(s, personId); if (!acc || age(s.persons[personId], clock) > 17 || age(s.persons[personId], clock) < 2)
    return; const period = clock.slice(0, 7), key = acc.id + '|flight-milestone|' + period + '|' + segmentKey; if (s.ledger.some(l => l.key === key) || s.ledger.filter(l => l.memberId === acc.id && l.taskId === 'flight-milestone' && l.at.slice(0, 7) === period).length >= 2)
    return; const progress = { key, personId, memberId: acc.id, taskId: 'flight-milestone', period, familyId, tripId, status: 'processing', attempt: 1 }; s.tasks[key] = progress; const previous = s.demoClock; s.demoClock = clock; addReward(s, progress); s.demoClock = previous; }
