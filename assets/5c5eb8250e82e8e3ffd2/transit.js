import { segmentCancelled } from '/assets/5c5eb8250e82e8e3ffd2/segment-status.js';
import { advanceDemoTime, synchronizeClocks } from '/assets/5c5eb8250e82e8e3ffd2/timeline.js';
import { journeyNeedsReview } from '/assets/5c5eb8250e82e8e3ffd2/journey-data.js';
import { journeyModel } from '/assets/5c5eb8250e82e8e3ffd2/journey-context.js';
import * as D from '/assets/5c5eb8250e82e8e3ffd2/domain.js';
import { personLabel } from '/assets/5c5eb8250e82e8e3ffd2/identity.js';
export const STUDENT_TRIP = 'student-term-2027';
const START = '2027-09-18T02:00:00.000Z';
export const plannedOrEstimated = (seg) => seg.estimatedArrival || seg.scheduledArrival;
export const fullTime = (iso, zone = 'Asia/Hong_Kong') => new Intl.DateTimeFormat('zh-HK', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(iso));
export const hasLanded = (j, seg) => !!seg.actualLanding && Date.parse(seg.actualLanding) >= Date.parse(seg.departure) && Date.parse(seg.actualLanding) <= Date.parse(j.now);
export const transferActive = (j) => !j.familyId && j.segments.length > 1 && hasLanded(j, j.segments[0]) && !hasLanded(j, lastLeg(j)) && Date.parse(j.now) < Date.parse(lastLeg(j).departure);
export const localTime = (iso, zone = 'Asia/Hong_Kong') => iso ? new Intl.DateTimeFormat('zh-CN', { timeZone: zone, month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(iso)) : '待核实';
export const nodeLabels = { unknown: '尚未确认位置', deplaned: '刚下机', security: '转机安检前', cleared: '已完成转机安检', gate: '登机口附近' };
export function initJourneys(s) {
    s.journeys ??= { items: {}, selectedId: null, log: [], processed: [] };
    if (!s.journeyRelease && !s.journeys.items[STUDENT_TRIP] && !journeyNeedsReview(s, STUDENT_TRIP) && s.persons.student) {
        const p = s.plans.student, at = s.dual ? s.demoClock : START;
        s.journeys.items[STUDENT_TRIP] = { id: STUDENT_TRIP, ownerId: 'student', familyId: null, purpose: 'student', studentPlanId: 'student:' + STUDENT_TRIP, arrivalArrangementId: 'arrival:' + STUDENT_TRIP, planSnapshot: { school: p?.school ?? '示例大學', holiday: '2027-12-18', bags: p?.bags ?? 2 }, version: 1, revision: 1, now: s.dual ? s.demoClock : START, sceneStep: 0, generation: 0,
            segments: [{ id: STUDENT_TRIP + '-v1-s0', flight: 'CX-DEMO 301', from: 'PVG', to: 'HKG', zone: 'Asia/Hong_Kong', departure: '2027-09-17T23:15:00Z', scheduledArrival: '2027-09-18T01:45:00Z', estimatedArrival: '2027-09-18T01:45:00Z', actualLanding: s.dual ? undefined : '2027-09-18T01:45:00Z', aircraft: 'A330', terminal: 'T1', gate: '22', updatedAt: at }, { id: STUDENT_TRIP + '-v1-s1', flight: 'CX-DEMO 901', from: 'HKG', to: 'LHR', zone: 'Europe/London', departure: '2027-09-18T03:30:00Z', scheduledArrival: '2027-09-18T16:30:00Z', estimatedArrival: '2027-09-18T16:30:00Z', aircraft: 'A350', terminal: 'T1', gate: '24', boardingStart: '2027-09-18T02:40:00Z', latestGate: '2027-09-18T03:00:00Z', updatedAt: at }], node: 'unknown', nodeAt: at, routeAt: at, walkMinutes: 12, securityMinutes: 15, reserveMinutes: 10, recheck: 'unknown', arrivalNode: 0, school: { name: p?.school ?? '伦敦示例大学', address: '示例宿舍 A · 地址待本人核对（虚构）', dormOpen: '2027-09-18T08:00:00Z', dormClose: '2027-09-18T20:00:00Z', confirmed: false }, pickup: { at: '2027-09-18T18:00:00Z', point: 'LHR 到达层 · 示例集合点 A，须向学校核实', status: 'sample', updatedAt: at }, pending: [], sharedTo: [], grants: [], fieldTimes: {} };
    }
    return s;
}
export const canReadJourney = (s, j) => !j.familyId ? (j.ownerId === s.actorId || j.grants.includes(s.actorId)) : (!s.families[j.familyId]?.archived && !!D.membership(s, j.familyId) && (j.id !== 'lin-tokyo-2027' || D.membership(s, j.familyId)?.role !== 'viewer' || !!s.trips[j.id]?.members.some(m => m.personId === s.actorId)));
export function currentJourney(s) { if (!s.journeys)
    return undefined; if (s.dual && s.selectedTripId) {
    const exact = s.journeys.items[s.selectedTripId];
    return exact && canReadJourney(s, exact) ? exact : undefined;
} const selected = s.journeys.items[s.journeys.selectedId ?? '']; if (selected && canReadJourney(s, selected) && (selected.familyId === null || selected.familyId === s.activeFamilyId))
    return selected; return Object.values(s.journeys.items).find(j => j.ownerId === s.actorId && j.familyId === null) ?? Object.values(s.journeys.items).find(j => j.familyId === s.activeFamilyId && canReadJourney(s, j)); }
export const lastLeg = (j) => j.segments[j.segments.length - 1];
export function remainingRoute(j) { return [{ label: '抵达转机安检', minutes: j.node === 'deplaned' ? 5 : 0 }, { label: '转机安检（必要流程）', minutes: ['deplaned', 'security'].includes(j.node) ? j.securityMinutes : 0 }, { label: '前往 ' + lastLeg(j).gate + ' 号登机口', minutes: j.node === 'gate' ? 0 : j.walkMinutes }].filter(x => x.minutes > 0); }
export function transferBuffer(j, activity = 20) {
    const leg = lastLeg(j);
    const age = (Date.parse(j.now) - Date.parse(j.routeAt)) / 60000;
    const positionAge = (Date.parse(j.now) - Date.parse(j.nodeAt)) / 60000;
    const missing = !transferActive(j) || j.node === 'unknown' || !leg.latestGate || !Number.isFinite(Date.parse(leg.latestGate)) || !Number.isFinite(j.walkMinutes) || age < 0 || positionAge < 0 || age > 60 || positionAge > 30 || j.walkMinutes < 0;
    const necessary = remainingRoute(j).reduce((a, x) => a + x.minutes, 0), until = leg.latestGate ? (Date.parse(leg.latestGate) - Date.parse(j.now)) / 60000 : NaN, buffer = until - necessary - j.reserveMinutes;
    return { known: !missing, necessary, until, buffer, activity, canEat: !missing && buffer >= activity + 5, reason: missing ? '信息不足，无法可靠评估。请确认当前位置、路线及登机最晚到场时间。' : `距最晚到场 ${Math.floor(until)} 分钟 − 剩余必要流程 ${necessary} 分钟 − 保守预留 ${j.reserveMinutes} 分钟 = ${Math.floor(buffer)} 分钟；用餐另需约 ${activity} 分钟。` };
}
export const transports = [{ id: 'rail', label: '轨道交通 + 校园步行', minutes: 90, cost: '參考 £25–40／人', note: '需要换乘和携带行李；实际班次、无障碍条件待核实' }, { id: 'car', label: '持牌出租车 / 已核实接送', minutes: 60, cost: '參考 £70–110／車', note: '车辆容量、儿童座椅和无障碍条件需与提供方核实' }];
export function arrivalAssessment(j) { const leg = lastLeg(j), base = Date.parse(leg.actualLanding ?? plannedOrEstimated(leg)), pickupAt = base + (j.planningConstraints ? j.planningConstraints.immigrationMinutes + j.planningConstraints.baggageMinutes : 60) * 60000, transport = transports.find(t => t.id === j.selectedTransport) ?? transports[0], schoolAt = pickupAt + (j.planningConstraints?.transportMinutes ?? transport.minutes) * 60000; return { pickupAt: new Date(pickupAt).toISOString(), schoolAt: new Date(schoolAt).toISOString(), pickupConflict: j.pickup.status === 'cancelled' || pickupAt > Date.parse(j.pickup.at), dormConflict: schoolAt > Date.parse(j.school.dormClose) || schoolAt < Date.parse(j.school.dormOpen), transport }; }
export function journeySummary(j) { if (!j.segments.some(x => hasLanded(j, x)))
    return Date.parse(j.now) < Date.parse(j.segments[0].departure) ? '尚未出發 · 請先核對行程與行前安排' : '已過計劃起飛時間 · 實際出行狀態待核實'; if (j.arrivalNode === 4)
    return '已由本人确认到宿舍 · 查看旅后事项'; if (lastLeg(j).actualLanding)
    return '已落地 · 请确认入境、行李与接机进度'; return '下一步：确认当前位置，完成转机流程并前往 ' + lastLeg(j).gate + ' 号登机口'; }
function notify(j, text, target, severity) { j.notification = { revision: j.revision, text, target, severity, seen: false, at: j.now }; }
export function ingestEvent(state, e) {
    const s = synchronizeClocks(D.clone(state));
    initJourneys(s);
    const store = s.journeys, j = store.items[e.tripId];
    let result = '已应用';
    const log = (why) => { store.log.push({ event: e, result: why }); store.log = store.log.slice(-150); return s; };
    if (store.processed.includes(e.id))
        return log('重复事件 · 已忽略');
    store.processed.push(e.id);
    if (!j || !canReadJourney(s, j))
        return log('无授权或未知行程 · 已忽略');
    if (e.version !== j.version || e.familyId !== undefined && e.familyId !== j.familyId || j.familyId && s.trips[j.id]?.version !== j.version)
        return log('旧行程版本 · 已忽略');
    const seg = j.segments.find(x => x.id === e.segmentId), key = e.kind + ':' + (e.segmentId ?? j.id);
    if (!Number.isFinite(Date.parse(e.occurredAt)) || Date.parse(e.occurredAt) > Date.parse(j.now) + 60000 || Date.parse(e.receivedAt) < Date.parse(e.occurredAt))
        return log('无效或未来事件时间 · 待核实');
    if (j.fieldTimes[key] && Date.parse(e.occurredAt) <= Date.parse(j.fieldTimes[key]))
        return log('乱序或过期事件 · 已忽略');
    if (['eta_changed', 'gate_changed', 'boarding_updated', 'landed', 'flight_completed'].includes(e.kind) && !seg)
        return log('不适用航段 · 已忽略');
    if (e.source === 'live')
        return log('实时数据供应商未接入 · 待核实');
    if (e.source === 'user_report' && !['school_arrived', 'feedback_completed'].includes(e.kind))
        return log('用户报告不能代替航司记录 · 待核实');
    const validDate = (x) => typeof x === 'string' && Number.isFinite(Date.parse(x));
    if (['landed', 'flight_completed'].includes(e.kind) && segmentCancelled(s, j.id, seg.id))
        return log('已取消航段不能生成抵達或已飛紀錄');
    if (e.kind === 'eta_changed') {
        if (!validDate(e.payload.at) || Date.parse(String(e.payload.at)) < Date.parse(seg.departure))
            return log('无效预计抵达时间');
        seg.estimatedArrival = String(e.payload.at);
        const a = arrivalAssessment(j);
        if (!journeyModel(s, j).student)
            notify(j, '本次航班預計抵達時間已更新，請核對同行人的接送安排。', 'posttrip-summary', 'confirm');
        else
            notify(j, `预计抵达已更新：${a.pickupConflict ? '可能赶不上学校接机；' : '接机暂未发现冲突；'}${a.dormConflict ? '预计到校超出宿舍窗口，需联系学校。' : '请核对入住确认。'}`, 'arrival-conflict', 'confirm');
    }
    if (e.kind === 'gate_changed') {
        if (typeof e.payload.gate !== 'string' || !/^[A-Z0-9-]{1,8}$/.test(e.payload.gate) || typeof e.payload.walkMinutes !== 'number' || e.payload.walkMinutes < 0 || e.payload.walkMinutes > 90)
            return log('无效登机口或路线');
        seg.gate = e.payload.gate;
        j.walkMinutes = e.payload.walkMinutes;
        j.routeAt = e.occurredAt;
        notify(j, '登机口已变更为 ' + seg.gate + '，请查看新的路线；之前的用餐建议已更新。', 'transfer-route', 'urgent');
    }
    if (e.kind === 'boarding_updated') {
        if (e.payload.latestGate !== null && !validDate(e.payload.latestGate))
            return log('无效登机期限');
        seg.latestGate = e.payload.latestGate === null ? undefined : String(e.payload.latestGate);
        notify(j, '登机最晚到场信息已更新，请重新核对余量。', 'transfer-route', 'urgent');
    }
    if (['pickup_changed', 'school_arrived'].includes(e.kind) && !journeyModel(s, j).student)
        return log('本行程未關聯學生抵達安排');
    if (e.kind === 'pickup_changed') {
        if (!validDate(e.payload.at))
            return log('无效接机时间');
        j.pickup.at = String(e.payload.at);
        j.pickup.status = e.payload.cancelled === true ? 'cancelled' : 'sample';
        j.pickup.updatedAt = e.occurredAt;
        notify(j, '学校接机安排已更新，请核对集合信息。', 'arrival-conflict', 'confirm');
    }
    if (e.kind === 'landed') {
        if (!validDate(e.payload.at) || j.segments.slice(0, j.segments.indexOf(seg)).some(x => !hasLanded(j, x) && !segmentCancelled(s, j.id, x.id)) || Date.parse(String(e.payload.at)) > Date.parse(j.now) || Date.parse(String(e.payload.at)) < Date.parse(seg.departure))
            return log('实际落地时间待核实');
        seg.actualLanding = String(e.payload.at);
        notify(j, j.familyId ? '已收到家庭航班落地记录，请核对旅后服务。' : '已收到实际落地记录。入境、取行李和到校尚需你确认。', j.familyId ? 'posttrip-summary' : 'arrival-conflict', 'info');
    }
    if (e.kind === 'flight_completed') {
        if (!seg.actualLanding || Date.parse(seg.actualLanding) > Date.parse(j.now))
            return log('尚无实际落地证据 · 待核实');
        if (typeof e.payload.aircraft !== 'string' || !['A330', 'A350', 'B777'].includes(e.payload.aircraft))
            return log('实际机型待核实');
        seg.aircraft = e.payload.aircraft;
        seg.completed = true;
        const ids = j.familyId ? (s.trips[j.id]?.members ?? []).map(m => m.personId) : [j.ownerId];
        for (const pid of ids) {
            if (!D.account(s, pid) || D.age(s.persons[pid], j.now) < 2)
                continue;
            const segmentKey = seg.id + '-' + pid;
            if (!s.stamps.some(x => x.segmentKey === segmentKey))
                s.stamps.push({ id: 'stamp:' + segmentKey, personId: pid, segmentKey, familyId: j.familyId ?? 'personal', city: seg.to, aircraft: seg.aircraft, date: seg.actualLanding.slice(0, 10), flight: seg.flight, sharedFamilies: j.familyId ? [j.familyId] : [] });
            D.creditFlightMilestone(s, pid, segmentKey, j.id, j.familyId, j.now);
        }
        if (j.familyId && j.segments.every(x => x.completed))
            s.trips[j.id].status = 'completed';
        notify(j, '已确认的飞行记录已写入护照；尚未解决的服务继续保留。', 'posttrip-summary', 'info');
    }
    if (e.kind === 'school_arrived') {
        if (s.actorId !== j.ownerId || !lastLeg(j).actualLanding || j.arrivalNode < 3)
            return log('先确认入境、行李与前往宿舍进度');
        j.arrivalNode = 4;
        notify(j, '你已确认抵达宿舍。可预览报平安消息并自行选择授权对象。', 'posttrip-summary', 'info');
    }
    if (e.kind === 'service_result') {
        const r = s.requests[String(e.payload.requestId)];
        if (!r || r.tripId !== j.id || r.tripVersion !== j.version || r.segmentId !== e.segmentId || !D.permitted(s, r.familyId, r.personId, 'service'))
            return log('服务对象或授权不匹配');
        if (e.payload.progress !== 'confirmed' || r.progress !== 'submitted' || !r.receipt)
            return log('服务回执条件不满足');
        r.progress = 'confirmed';
        r.history.push('旅程事件：服務結果確認');
        notify(j, '一项服务收到服務結果確認；其他服务保持原状态。', 'posttrip-summary', 'info');
    }
    if (e.kind === 'feedback_completed') {
        if (!journeyModel(s, j).permissions.feedback || typeof e.payload.text !== 'string' || !e.payload.text.trim() || e.payload.text.length > 300)
            return log('請在取得本次實際抵達紀錄且具備授權後填寫體驗');
        if (j.feedback)
            return log('本航段反馈已完成 · 不重复记录');
        j.feedback = e.payload.text;
    }
    j.fieldTimes[key] = e.occurredAt;
    j.revision++;
    if (seg)
        seg.updatedAt = e.occurredAt;
    if (j.notification)
        j.notification.revision = j.revision;
    return log(result);
}
export function userJourneyAction(state, id, revision, type, value) {
    const s = D.clone(state);
    initJourneys(s);
    const j = s.journeys.items[id];
    if (!j || !canReadJourney(s, j) || j.revision !== revision)
        throw Error('行程或操作内容已更新，请重新核对。');
    if (type === 'seen') {
        if (j.notification)
            j.notification.seen = true;
        return s;
    }
    if (s.actorId !== j.ownerId)
        throw Error('此操作须旅客本人确认。');
    if (['arrival-node', 'transport', 'draft', 'share'].includes(type) && !journeyModel(s, j).student)
        throw Error('此行程未關聯學生抵達安排。');
    if (type === 'node') {
        if (!transferActive(j))
            throw Error('尚未進入有效轉機時段，請先核對實際抵達紀錄。');
        if (!(value in nodeLabels))
            throw Error('未知位置');
        j.node = value;
        j.nodeAt = j.now;
    }
    else if (type === 'arrival-node') {
        const n = Number(value);
        if (!hasLanded(j, lastLeg(j)) || n !== j.arrivalNode + 1 || n > 3)
            throw Error('请按实际进度确认，不使用预计抵达时间。');
        j.arrivalNode = n;
    }
    else if (type === 'transport') {
        if (!transports.some(t => t.id === value))
            throw Error('未知交通选项');
        j.selectedTransport = value;
        delete j.draft;
    }
    else if (type === 'draft') {
        const a = arrivalAssessment(j);
        j.draft = { text: `您好，我是 ${personLabel(s, j.ownerId)}。本次 ${lastLeg(j).flight} 预计抵达 ${localTime(plannedOrEstimated(lastLeg(j)), 'Europe/London')}（伦敦时间）。我考虑使用${a.transport.label}，预计 ${localTime(a.schoolAt, 'Europe/London')} 到校。请协助核实接机安排及宿舍入住窗口。谢谢。`, status: 'draft', revision: j.revision + 1 };
        j.pending = [...new Set([...j.pending, '联系学校核实接机', '核实宿舍晚到入住'])];
    }
    else if (type === 'share') {
        const recipients = value.split(',').filter(Boolean);
        const allowed = s.memberships.filter(m => m.active && !s.families[m.familyId]?.archived && m.personId === j.ownerId).flatMap(m => D.familyMembers(s, m.familyId).map(x => x.personId)).filter(x => x !== j.ownerId);
        if (j.arrivalNode !== 4 || !recipients.length || recipients.some(x => !allowed.includes(x)))
            throw Error('请选择获授权家庭中的接收人并先确认到校。');
        j.sharedTo = [...new Set([...j.sharedTo, ...recipients])];
    }
    else
        throw Error('未注册的操作');
    j.revision++;
    return s;
}
export function makeEvent(j, kind, payload, source = 'mock', segmentId = lastLeg(j).id) { return { id: crypto.randomUUID(), kind, tripId: j.id, segmentId, ...(j.familyId ? { familyId: j.familyId } : {}), version: j.version, occurredAt: j.now, receivedAt: j.now, source, payload }; }
export function sceneStep(state) {
    let s = D.clone(state);
    synchronizeClocks(s);
    let j = currentJourney(s);
    if (!j)
        throw Error('先選擇演示場景');
    if (j.sceneStep >= 4 && !(s.seedVersion && j.familyId))
        return s;
    const move = (at) => { if (s.dual)
        advanceDemoTime(s, at);
    else
        j.now = new Date(Math.max(Date.parse(j.now), Date.parse(at))).toISOString(); };
    const leg = lastLeg(j), plus = (at, minutes) => new Date(Date.parse(at) + minutes * 60000).toISOString();
    if (j.id === 'lin-student-return-2027' && j.segments.length === 1) {
        const kind = j.sceneStep < 2 ? 'eta_changed' : j.sceneStep === 2 ? 'landed' : 'flight_completed';
        if (kind === 'eta_changed') {
            move(plus(leg.departure, 30));
            j.sceneStep = 2;
            return ingestEvent(s, makeEvent(j, kind, { at: plannedOrEstimated(leg) }));
        }
        move(plannedOrEstimated(leg));
        j.sceneStep++;
        return ingestEvent(s, makeEvent(j, kind, kind === 'landed' ? { at: leg.estimatedArrival } : { aircraft: leg.aircraft }));
    }
    if (j.familyId) {
        if (s.seedVersion) {
            const active = j.segments.find(x => !x.completed);
            if (!active)
                return s;
            if (s.trips[j.id]?.status === 'cancelled')
                throw Error('請先確認有效替代航班');
            move(plus(plannedOrEstimated(active), 1));
            const kind = active.actualLanding ? 'flight_completed' : 'landed';
            j.sceneStep++;
            return ingestEvent(s, makeEvent(j, kind, kind === 'landed' ? { at: plannedOrEstimated(active) } : { aircraft: active.aircraft }, 'mock', active.id));
        }
        if (s.trips[j.id]?.status === 'cancelled')
            throw Error('原航班已取消，請先選擇可行的新航班。');
        if (j.sceneStep < 2)
            j.sceneStep = 2;
        move(plus(plannedOrEstimated(leg), 1));
        const kind = j.sceneStep === 2 ? 'landed' : 'flight_completed';
        j.sceneStep++;
        return ingestEvent(s, makeEvent(j, kind, kind === 'landed' ? { at: leg.estimatedArrival } : { aircraft: leg.aircraft }));
    }
    const kind = ['gate_changed', 'eta_changed', 'landed', 'flight_completed'][j.sceneStep];
    if (j.sceneStep === 0) {
        const first = j.segments[0];
        move(plus(plannedOrEstimated(first), 16));
        if (!hasLanded(j, first)) {
            s = ingestEvent(s, makeEvent(j, 'landed', { at: plannedOrEstimated(first) }, 'mock', first.id));
            j = currentJourney(s);
        }
        j.routeAt = j.now;
    }
    if (j.sceneStep === 1)
        move(plus(leg.departure, -20));
    const delayed = plus(leg.scheduledArrival, 180);
    if (j.sceneStep >= 2)
        move(delayed);
    const payload = kind === 'gate_changed' ? { gate: '62', walkMinutes: 32 } : kind === 'eta_changed' ? { at: delayed } : kind === 'landed' ? { at: leg.estimatedArrival } : { aircraft: leg.aircraft };
    if (kind === 'flight_completed' && j.id === 'lin-student-return-2027' && j.segments.length > 1) {
        for (const earlier of j.segments.slice(0, -1)) {
            if (earlier.actualLanding && !earlier.completed) {
                s = ingestEvent(s, makeEvent(j, 'flight_completed', { aircraft: earlier.aircraft }, 'mock', earlier.id));
                j = currentJourney(s);
            }
        }
    }
    j.sceneStep++;
    return ingestEvent(s, makeEvent(j, kind, payload));
}
export function selectScene(state, scene) { let s = D.reduce(state, { type: 'identity', personId: scene === 'student' ? 'student' : 'lin' }); initJourneys(s); if (scene === 'student')
    s.journeys.selectedId = STUDENT_TRIP;
else {
    const t = s.trips['trip-a'];
    s.activeFamilyId = 'a';
    if (!s.journeys.items[t.id] || s.journeys.items[t.id].version !== t.version) {
        const base = D.clone(s.journeys.items[STUDENT_TRIP]);
        base.id = t.id;
        base.ownerId = 'lin';
        base.familyId = 'a';
        base.purpose = 'family';
        delete base.studentPlanId;
        delete base.arrivalArrangementId;
        delete base.planSnapshot;
        base.version = t.version;
        base.segments = t.route.segments.map((seg, i) => ({ id: `${t.id}-v${t.version}-s${i}`, flight: t.route.number, from: seg.origin, to: seg.destination, zone: 'Asia/Tokyo', departure: new Date(seg.departureUtc).toISOString(), scheduledArrival: new Date(seg.arrivalUtc).toISOString(), estimatedArrival: new Date(seg.arrivalUtc).toISOString(), aircraft: seg.aircraft, terminal: 'T1', gate: '24', latestGate: '2027-09-18T03:00:00Z', updatedAt: START }));
        base.now = new Date(Date.parse(lastLeg(base).departure) - 3600000).toISOString();
        base.sceneStep = 2;
        base.arrivalNode = 0;
        base.feedback = undefined;
        base.draft = undefined;
        base.sharedTo = [];
        base.notification = undefined;
        base.fieldTimes = {};
        s.journeys.items[t.id] = base;
    }
    s.journeys.selectedId = t.id;
} return s; }
export function resetScene(state) { const s = D.clone(state), j = currentJourney(s); if (!j)
    return s; if (j.id === STUDENT_TRIP) {
    delete s.journeys.items[j.id];
    initJourneys(s);
    const fresh = s.journeys.items[j.id];
    fresh.generation = j.generation + 1;
    fresh.revision = j.revision + 1;
    fresh.feedback = j.feedback;
    fresh.grants = j.grants;
    fresh.school = j.school;
    fresh.pending = j.pending;
}
else {
    delete s.journeys.items[j.id];
    const fresh = selectScene(s, 'family');
    fresh.journeys.items[j.id].feedback = j.feedback;
    fresh.journeys.items[j.id].revision = j.revision + 1;
    return fresh;
} return s; }
