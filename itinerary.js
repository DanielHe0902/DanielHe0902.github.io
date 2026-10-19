import { tripDecision } from './trip-decision.js';
import { scheduleFirstConfirmation } from './flight-change.js';
import { importDraftCare, ensureTripCare } from './service-flow.js';
import { planCarePreview, savePlanCare } from './plan-care.js';
import { RULES } from './config.js';
import { airport } from '../web/travel.js';
import * as D from './domain.js';
import { validatePlan, initExperience, newTravelPlan } from './experience.js';
export function tripFamilies(s) { return D.familiesFor(s).filter(f => ['owner', 'editor'].includes(D.membership(s, f.id)?.role ?? '')); }
export function tripPeople(s, familyId) { return familyId && tripFamilies(s).some(f => f.id === familyId) ? D.familyMembers(s, familyId).map(m => s.persons[m.personId]) : [s.persons[s.actorId]]; }
export { localDeparture } from './flight-time.js';
import { localParts, localDeparture } from './flight-time.js';
import { validateSnapshot, checkConstraints, flightRoute } from './flights.js';
export function planForJourney(s, id) {
    const j = s.journeys?.items[id];
    if (!j || j.ownerId !== s.actorId)
        return undefined;
    const snap = j.selectedFlight, first = j.segments[0], last = j.segments.at(-1);
    const p = { ...newTravelPlan(s), id: j.id, title: j.title ?? '我的行程', origin: first.from, destination: last.to === first.from ? first.to : last.to, start: localParts(first.departure, airport(first.from).zone).day, end: last.to === first.from ? localParts(last.departure, airport(last.from).zone).day : '', familyId: j.familyId ?? '', travelerIds: s.trips[id]?.members.map(m => m.personId) ?? [j.ownerId], budget: j.planning?.budget ?? null, theme: j.planning?.theme ?? '', replacesTripVersion: j.version, studentPlanning: j.purpose === 'student', constraints: j.planningConstraints ? structuredClone(j.planningConstraints) : undefined };
    p.careNeeds = Object.fromEntries((s.trips[id]?.snapshots ?? []).map(x => [x.personId, [...x.profile.needs]]));
    if (snap)
        Object.assign(p, { flightSource: snap.providerOffer ? 'reference' : 'simulation', cabin: snap.criteria.cabin, bags: snap.criteria.bags, departurePeriod: snap.criteria.departurePeriod, flexible: snap.criteria.flexible, travelType: snap.criteria.travelType });
    return p;
}
export function itineraryPreview(s, p) {
    validatePlan(s, p);
    planCarePreview(s, p);
    if (s.tripCleanup?.retired.includes(p.id))
        throw Error('此行程已移除，請建立新的行程。');
    const familyId = p.familyId ?? '';
    if (familyId && !tripFamilies(s).some(f => f.id === familyId))
        throw Error('目前帳號沒有建立這個家庭行程的權限。');
    if (!p.origin || !p.destination || !p.start)
        throw Error('請填寫路線與出發日期，再查詢航班。');
    const travelers = [...new Set(p.travelerIds)];
    if (!travelers.length || travelers.some(id => !tripPeople(s, familyId).some(x => x.id === id)) || !familyId && (travelers.length !== 1 || travelers[0] !== s.actorId))
        throw Error('請選擇目前獲授權範圍內的實際同行旅客。');
    for (const id of travelers)
        if (D.age(s.persons[id], p.start) < 18 && !s.persons[id].guardianIds.some(g => travelers.includes(g)))
            throw Error('未成年旅客須與已關聯的監護人同行。');
    if (familyId)
        for (const pair of s.relationships.filter(r => r.familyId === familyId && r.required))
            if (travelers.includes(pair.dependentId) && !travelers.includes(pair.caregiverId))
                throw Error('必要照護對象須與其照護人同行；請調整同行人或先核對照護關係。');
    const snapshot = validateSnapshot(p), existing = s.journeys?.items[p.id];
    if (existing) {
        if (p.replacesTripVersion !== existing.version)
            throw Error('這段行程已保存或版本已更新，請重新開啟更換航班。');
        if (existing.ownerId !== s.actorId || Date.parse(existing.segments[0].departure) <= Date.parse(s.demoClock) || existing.segments.some(x => x.completed || x.actualLanding) || s.trips[p.id]?.status === 'cancelled')
            throw Error('只有行程建立者可調整尚未出發的規劃；已受影響航班請使用行程應變。');
        if (existing.familyId !== (familyId || null))
            throw Error('更換航班不能改變原行程授權範圍。');
    }
    const version = (existing?.version ?? 0) + 1;
    const segments = [...snapshot.outbound.legs, ...(snapshot.inbound?.legs ?? [])].map((l, i) => ({ id: p.id + '-v' + version + '-s' + i, flight: l.flight, from: l.from, to: l.to, zone: l.arrivalZone, departure: l.departure, scheduledArrival: l.arrival, aircraft: l.aircraft, terminal: '待核實', gate: '待公布', updatedAt: s.demoClock }));
    if (Date.parse(segments[0].departure) <= Date.parse(s.demoClock))
        throw Error('出發時間已過，請選擇未來航班。');
    const feasibility = checkConstraints(snapshot.outbound, p.constraints);
    if (p.constraints && (!p.constraints.accepted || Object.values(p.constraints).some(v => typeof v === 'number' && (!Number.isFinite(v) || v < 0 || v > 1440))))
        throw Error('請先核對抵達安排與估算緩衝，再勾選確認。');
    return { familyId: familyId || null, travelers, segments, seatCount: travelers.length, snapshot, feasibility };
}
export function saveItinerary(s, p) {
    if (tripDecision(s, p.id).cancelled)
        throw Error('已取消的行程不可重新儲存，請新增行程。');
    const preview = itineraryPreview(s, p), old = s.journeys?.items[p.id], oldTrip = s.trips[p.id], version = (old?.version ?? 0) + 1;
    const history = old ? [...(old.flightHistory ?? []), { version: old.version, at: s.demoClock, segments: structuredClone(old.segments), snapshot: old.selectedFlight ? structuredClone(old.selectedFlight) : undefined, source: old.flightSource ?? '用戶錄入／未核驗' }] : [];
    const { familyId, travelers, segments } = preview, at = s.demoClock;
    const j = { ...old, id: p.id, ownerId: s.actorId, familyId, purpose: familyId ? 'family' : p.studentPlanning ? 'student' : 'general', ...(p.studentPlanning ? { studentPlanId: 'student:' + p.id, arrivalArrangementId: 'arrival:' + p.id, planSnapshot: { school: p.constraints?.school ?? '', holiday: s.plans[s.actorId]?.holiday, bags: p.bags ?? 1 } } : {}), userManaged: true, title: p.title, planning: { budget: p.budget, theme: p.theme }, selectedFlight: structuredClone(preview.snapshot), planningConstraints: p.constraints ? structuredClone(p.constraints) : undefined, flightHistory: history, flightSource: preview.snapshot.source, version, revision: (old?.revision ?? 0) + 1, now: at, sceneStep: 0, generation: 1, segments, node: 'unknown', nodeAt: at, routeAt: at, walkMinutes: 0, securityMinutes: 0, reserveMinutes: 10, recheck: 'unknown', arrivalNode: 0, school: { name: '', address: '', dormOpen: '', dormClose: '', confirmed: false }, pickup: { at: '', point: '', status: 'sample', updatedAt: at }, pending: [], sharedTo: old?.sharedTo ?? [], grants: old?.grants ?? [], fieldTimes: {} };
    s.journeys ??= { items: {}, selectedId: null, log: [], processed: [] };
    s.journeys.items[p.id] = j;
    if (p.studentPlanning && p.constraints) {
        j.school = { name: p.constraints.school ?? '', address: '', dormOpen: p.constraints.dormOpen ? localDeparture(p.constraints.dormOpen.slice(0, 10), p.constraints.dormOpen.slice(11, 16), p.destination) : '', dormClose: '', confirmed: false };
    }
    if (familyId) {
        const route = flightRoute(preview.snapshot.outbound, p.budget ?? 300000);
        if (preview.snapshot.inbound) {
            const back = flightRoute(preview.snapshot.inbound, p.budget ?? 300000);
            route.segments.push(...back.segments);
            route.total += back.total;
        }
        const t = { id: p.id, title: p.title, userManaged: true, familyId, version, route, members: travelers.map(personId => ({ personId, occupiesSeat: D.age(s.persons[personId], p.start) >= 2, companionId: D.age(s.persons[personId], p.start) < 2 ? (s.relationships.find(r => r.familyId === familyId && r.dependentId === personId && travelers.includes(r.caregiverId))?.caregiverId ?? s.persons[personId].guardianIds.find(g => travelers.includes(g)) ?? null) : null, tripMemberId: p.id + ':' + personId })), snapshots: oldTrip ? structuredClone(oldTrip.snapshots) : [], relationships: (oldTrip?.relationships ?? s.relationships).filter(r => r.familyId === familyId && travelers.includes(r.dependentId) && travelers.includes(r.caregiverId)).map(r => ({ ...r })), status: 'planned', checklist: {}, needsReview: false, noCandidates: false };
        s.trips[p.id] = t;
        s.families[familyId].currentTripId = p.id;
    }
    if (old) {
        for (const r of Object.values(s.requests).filter(r => r.tripId === p.id && r.tripVersion === old.version && !r.supersededBy && !r.withdrawnAt)) {
            const index = old.segments.findIndex(seg => seg.id === r.segmentId), replacement = segments[index];
            if (!replacement || !travelers.includes(r.personId)) {
                r.supersededBy = 'flight-change:' + version;
                r.history.push('行程變更，舊申請保留為歷史，不適用於新航段');
                continue;
            }
            const id = crypto.randomUUID();
            s.requests[id] = { ...structuredClone(r), id, segmentId: replacement.id, tripVersion: version, key: r.key + ':flight-v' + version, progress: r.applicability === 'missing' ? 'missing' : 'reconfirm', attempt: 0, receipt: null, ticket: null, followUpId: undefined, consentAt: undefined, timeline: [], manualQueried: false, deadline: new Date(Date.parse(replacement.departure) - RULES.deadlines[r.kind] * 3600000).toISOString(), history: ['航班已更換；原申請與回執保留於舊版本，新航段需要重新核實'], supersededBy: undefined };
            r.supersededBy = id;
        }
        for (const t of Object.values({ ...s.dual.tasks }).filter(t => t.tripId === p.id && t.version === old.version)) {
            s.dual.tasks[t.taskId + ':history:v' + t.version] = { ...t, taskId: t.taskId + ':history:v' + t.version };
            t.version = version;
            t.status = 'reconfirm';
        }
    }
    if (familyId) {
        importDraftCare(s, p);
        savePlanCare(s, p, s.trips[p.id]);
        s.trips[p.id].careImportedFor = [...new Set([...(s.trips[p.id].careImportedFor ?? []), ...Object.keys(p.careNeeds ?? {})])];
        ensureTripCare(s, s.trips[p.id]);
    }
    const deadline = new Date(Math.max(Date.parse(at), Date.parse(segments[0].departure) - 24 * 3600000)).toISOString();
    const rows = [['documents', '核對同行旅客與出行文件', '核對姓名、護照與目的地入境要求。'], ['packing', '準備行李清單', '按實際票價條件核對隨身與託運行李。'], ['transport', '確認機場交通與住宿', '自行核對接送、住宿及聯絡方式。']];
    for (const [kind, title, next] of rows) {
        const taskId = 'user-task:' + p.id + ':' + kind;
        s.dual.tasks[taskId] = { taskId, tripId: p.id, version, personId: s.actorId, title, kind, next, status: 'pending', deadline };
    }
    if (familyId && travelers.some(id => p.careNeeds?.[id]?.length || s.profiles[familyId + ':' + id]?.needs.length)) {
        const taskId = 'user-task:' + p.id + ':care';
        s.dual.tasks[taskId] = { taskId, tripId: p.id, version, personId: s.actorId, title: '核對本次家人照護需求', kind: 'documents', next: '查看本行程的需求草稿，補齊資料後再預覽並提交申請；尚未確認任何服務。', status: 'pending', deadline };
    }
    delete initExperience(s).plans[p.id];
    s.selectedTripId = p.id;
    s.journeys.selectedId = p.id;
    s.dual.accounts[s.activeAccountId].defaultTripId = p.id;
    s.dual.revision++;
    if (!old)
        scheduleFirstConfirmation(s, p.id, p.booking?.requestId ?? p.id);
    return s;
}
