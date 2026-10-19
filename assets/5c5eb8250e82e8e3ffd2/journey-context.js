import { tripDecision } from '/assets/5c5eb8250e82e8e3ffd2/trip-decision.js';
import { serviceState } from '/assets/5c5eb8250e82e8e3ffd2/service-state.js';
import { segmentCancelled } from '/assets/5c5eb8250e82e8e3ffd2/segment-status.js';
import * as D from '/assets/5c5eb8250e82e8e3ffd2/domain.js';
import { canReadJourney, hasLanded, transferActive } from '/assets/5c5eb8250e82e8e3ffd2/transit.js';
import { SERVICE_LABELS, PROGRESS } from '/assets/5c5eb8250e82e8e3ffd2/config.js';
export function segmentPhase(s, j, seg) {
    if (seg.completed && hasLanded(j, seg))
        return 'completed';
    if (hasLanded(j, seg))
        return 'arrived';
    if (segmentCancelled(s, j.id, seg.id))
        return 'cancelled';
    return Date.parse(j.now) >= Date.parse(seg.departure) ? 'awaiting' : 'planned';
}
const unknown = new Set();
function diagnose(value) { if (!unknown.has(value)) {
    unknown.add(value);
    console.warn('Unknown service display value:', value);
} }
export function serviceLabel(kind) { if (!(kind in SERVICE_LABELS))
    diagnose(kind); return SERVICE_LABELS[kind] ?? '其他服務（類型待核實）'; }
export function progressLabel(progress) { if (!(progress in PROGRESS))
    diagnose(progress); return PROGRESS[progress] ?? '處理狀態待核實'; }
export function journeyModel(s, j) {
    const readable = canReadJourney(s, j), t = s.trips[j.id];
    const travelers = (j.familyId ? t?.members.map(m => m.personId) ?? [] : [j.ownerId]).filter(p => !!s.persons[p]);
    const valid = readable && !!j.segments.length && (!t || t.version === j.version);
    const purpose = j.familyId ? 'family' : j.purpose === 'student' && !!j.studentPlanId ? 'student' : 'general';
    const segments = j.segments.map(seg => ({ seg, phase: segmentPhase(s, j, seg) }));
    const past = segments.filter(x => x.phase === 'arrived' || x.phase === 'completed'), future = segments.filter(x => x.phase === 'planned' || x.phase === 'awaiting');
    const phase = !valid ? 'unknown' : segments.every(x => x.phase === 'cancelled') ? 'cancelled' : segments.every(x => x.phase === 'completed') ? 'completed' : past.length && future.length ? 'partial' : past.length === segments.length ? 'arrived' : segments.some(x => x.phase === 'awaiting') ? 'awaiting' : 'planned';
    const current = (future[0] ?? segments.at(-1));
    const student = valid && purpose === 'student' && !!j.arrivalArrangementId;
    const tasks = valid ? Object.values(s.dual?.tasks ?? {}).filter(x => x.tripId === j.id && x.version === j.version && travelers.includes(x.personId) && (!j.familyId || D.permitted(s, j.familyId, x.personId, 'care:view'))) : [];
    const requests = valid ? Object.values(s.requests).filter(r => r.tripId === j.id && r.tripVersion === j.version && !r.supersededBy && !r.withdrawnAt && travelers.includes(r.personId) && j.segments.some(seg => seg.id === r.segmentId) && D.permitted(s, r.familyId, r.personId, 'care:view')) : [];
    const services = requests.map(r => { const ended = past.some(x => x.seg.id === r.segmentId), feedback = j.serviceFeedback?.[r.id]; return { r, ended, feedback, needsAttention: !!feedback || !!r.ticket || r.progress !== 'confirmed', label: serviceLabel(r.kind), status: serviceState(s, r).label, next: feedback ? '已保存問題草稿，待你自行聯絡支援。未建立客服個案。' : r.ticket ? '已有跟進紀錄，請查看最後更新。' : ended ? (r.progress === 'confirmed' ? '已保留申請確認紀錄；不等同現場服務使用結果。' : '已保留本次申請紀錄，尚未取得完整服務結果。如本次服務有問題，可以回報情況或聯絡支援。') : phase === 'cancelled' ? '原航段已取消，紀錄僅供追溯。請先核對替代安排。' : '本航段尚未結束，請核對申請資料與現場服務安排。' }; });
    const feedbackAllowed = valid && past.length > 0 && (travelers.includes(s.actorId) || !!j.familyId && D.membership(s, j.familyId)?.role !== 'viewer');
    const holiday = student && j.planSnapshot?.holiday && j.planSnapshot.holiday >= j.now.slice(0, 10) ? j.planSnapshot.holiday : undefined;
    const summary = tripDecision(s, j.id).userCancelled ? '此段行程已由你取消，紀錄已保留。' : phase === 'cancelled' ? '航班已取消，尚無實際出行紀錄。' : phase === 'completed' ? '本行程所有航段已有完成紀錄。' : phase === 'arrived' ? '已收到實際抵達紀錄，飛行紀錄待同步。' : phase === 'partial' ? '部分航段已抵達；後續航段仍需準備。' : phase === 'awaiting' ? '已過計劃起飛時間；尚未取得實際出行紀錄，請核實航班狀態。' : '尚未出發，請核對行前準備與服務安排。';
    return { viewerAccountId: s.activeAccountId, permissions: { readable: valid, feedback: feedbackAllowed, owner: s.actorId === j.ownerId }, tripId: j.id, tripVersion: j.version, travelers, purpose, phase, transferActive: transferActive(j), current, segments, past, future, studentPlanId: student ? j.studentPlanId : null, arrivalArrangementId: student ? j.arrivalArrangementId : null, student, holiday, tasks, preparation: tasks.length ? { total: tasks.length, done: tasks.filter(x => x.status === 'done').length } : null, services, summary, showPosttrip: past.length > 0, defaultPanel: student ? (j.arrivalNode === 4 && past.length === segments.length ? 'posttrip' : current.phase === 'arrived' || current.phase === 'completed' ? 'arrival' : 'transfer') : 'posttrip' };
}
export function saveServiceFeedback(s, j, r, text) {
    const vm = journeyModel(s, j), service = vm.services.find(x => x.r.id === r.id);
    if (!vm.permissions.feedback || !service?.ended || !D.permitted(s, r.familyId, r.personId, 'service'))
        throw Error('沒有為本航段及旅客保存服務回報的授權。');
    if (!text.trim() || text.length > 300)
        throw Error('請填寫 1 至 300 字的實際情況。');
    j.serviceFeedback ??= {};
    j.serviceFeedback[r.id] = { id: 'feedback:' + r.id, requestId: r.id, personId: r.personId, segmentId: r.segmentId, tripVersion: j.version, authorId: s.actorId, text: text.trim(), at: j.now, status: 'draft' };
    j.revision++;
    return s;
}
