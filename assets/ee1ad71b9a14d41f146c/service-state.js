import { permitted } from '/assets/ee1ad71b9a14d41f146c/domain.js';
import { SERVICE_LABELS } from '/assets/ee1ad71b9a14d41f146c/config.js';
import { airport } from '/assets/ee1ad71b9a14d41f146c/web/travel.js';
import { flightLabel } from '/assets/ee1ad71b9a14d41f146c/passport-visual.js';
import { segmentCancelled } from '/assets/ee1ad71b9a14d41f146c/segment-status.js';
export function serviceEvent(r, kind, at, note) { r.timeline ??= []; if (kind === 'case-created' && r.timeline.some(e => e.kind === kind))
    return; r.timeline.push({ kind, at, note }); }
export function currentCase(s, r) { const c = r.followUpId ? s.followUps?.[r.followUpId] : undefined; const key = [r.familyId, r.tripId, r.tripVersion, r.segmentId, r.personId, r.kind, r.caregiverId ?? ''].join('|'); return c && c.status !== 'closed' && c.key === key && c.requestId === r.id ? c : undefined; }
export function createFollowUp(s, r, now = s.demoClock) { s.followUps ??= {}; const key = [r.familyId, r.tripId, r.tripVersion, r.segmentId, r.personId, r.kind, r.caregiverId ?? ''].join('|'); let c = Object.values(s.followUps).find(c => c.key === key && c.status !== 'closed'); if (!c) {
    const id = r.ticket && !s.followUps[r.ticket] ? r.ticket : crypto.randomUUID();
    c = { id, key, requestId: r.id, status: 'waiting', createdAt: now, updatedAt: now, missing: [] };
    s.followUps[id] = c;
    serviceEvent(r, 'case-created', now);
} r.followUpId = c.id; r.ticket = c.id; r.consentAt ??= now; const accountId = s.activeAccountId; if (accountId && s.dual) {
    const id = 'service-case:' + c.id;
    s.dual.notifications[id] ??= { id, accountId, transactionId: c.id, tripId: r.tripId, title: '已建立跟進個案', text: serviceName(s, r) + '，等待處理及服務結果。', kind: 'service', createdAt: now, read: false };
} return c; }
/** Associate legacy persisted tickets once. Preserve every original audit entry. */
export function migrateServiceCases(s) { s.followUps ??= {}; for (const r of Object.values(s.requests)) {
    if (!r.ticket || r.followUpId)
        continue;
    const key = [r.familyId, r.tripId, r.tripVersion, r.segmentId, r.personId, r.kind, r.caregiverId ?? ''].join('|');
    const existing = Object.values(s.followUps).find(c => c.key === key && c.status !== 'closed');
    if (existing) {
        existing.aliases ??= [];
        if (r.ticket !== existing.id && !existing.aliases.includes(r.ticket))
            existing.aliases.push(r.ticket);
        r.followUpId = existing.id;
    }
    else {
        s.followUps[r.ticket] = { id: r.ticket, key, requestId: r.id, status: 'waiting', createdAt: '', updatedAt: '', missing: [], legacy: true };
        r.followUpId = r.ticket;
    }
} return s; }
export function repairAirlineMisroutes(s) { for (const r of Object.values(s.requests)) {
    const c = currentCase(s, r);
    if (!c || c.routeSource !== 'default-airline-misroute' || !['childMeal', 'infantMeal', 'specialMeal', 'bassinet', 'adjacent', 'aisle'].includes(r.kind) || r.receipt || r.progress === 'unknown' || r.applicability !== 'eligible' || Date.parse(r.deadline) < Date.parse(s.demoClock))
        continue;
    c.status = 'closed';
    c.retiredAt = s.demoClock;
    c.retiredReason = '已核實原自動路由錯誤，保留歷史，待確認航空服務提交。';
    r.history.push(c.retiredReason);
    serviceEvent(r, 'changed', s.demoClock, c.retiredReason);
} return s; }
export function serviceState(s, r) {
    const t = s.trips[r.tripId], c = currentCase(s, r);
    let code = 'draft', label = '待你確認提交', next = '確認資料用途後提交本次申請', owner = 'user';
    if (!t || t.version !== r.tripVersion || segmentCancelled(s, r.tripId, r.segmentId)) {
        code = 'changed';
        label = '原航段記錄';
        next = '查看目前航班安排';
        owner = 'none';
    }
    else if (r.replyMissing?.length) {
        code = 'missing';
        label = '待你補充資料';
        next = r.replyMissing.join('、');
    }
    else if (r.progress === 'confirmed') {
        code = 'confirmed';
        label = '已確認';
        next = '查看安排';
        owner = 'none';
    }
    else if (r.progress === 'submitted') {
        code = r.receipt ? 'accepted' : 'sending';
        label = r.receipt ? '待國泰確認' : '提交中';
        next = r.receipt ? '已取得提交回執，你目前不需要再次提交。' : '正在提交本次申請，請勿重複操作。';
        owner = r.receipt ? 'airline' : 'system';
    }
    else if (r.progress === 'unknown') {
        code = 'unknown';
        label = '正在核實提交結果';
        next = '查詢原申請結果';
        owner = 'system';
    }
    else if (c) {
        code = 'case';
        label = c.status === 'missing' ? '待你補充資料' : c.status === 'working' && (c.assignmentId || r.timeline?.some(e => e.kind === 'case-working')) ? '專人跟進中' : '跟進個案已建立';
        next = c.status === 'missing' ? c.missing.join('、') || '補充所需資料' : '等待專人處理，無需重複建立個案。';
        owner = c.status === 'missing' ? 'user' : 'support';
    }
    else if (r.progress === 'unavailable' || r.applicability === 'unavailable') {
        code = 'unavailable';
        label = '此機型無法提供';
        next = '查看替代安排';
    }
    else if (r.progress === 'missing' || r.applicability === 'missing') {
        code = 'missing';
        label = '待你補充資料';
        next = r.missing.join('、') || '補充所需資料';
    }
    else if (r.applicability === 'manual') {
        code = 'verify';
        label = '需核對適用條件';
        next = r.missing.join('、') || '核對服務適用條件';
    }
    else if (Date.parse(r.deadline) < Date.parse(s.demoClock)) {
        code = 'expired';
        label = '已過辦理期限';
        next = '此航段已超過申請窗口，請聯絡服務人員核實可行安排';
    }
    else if (r.progress === 'reconfirm') {
        code = 'reconfirm';
        label = '新航班需重新提交';
        next = '資料已帶入，確認後可提交本航段申請。';
    }
    else if (r.attempt) {
        code = 'failed';
        label = '提交失敗';
        next = '重試未完成的申請';
    }
    return { code, label, next, owner, confirmed: code === 'confirmed', activeCase: c };
}
export function serviceSummary(s, tripId) { const t = s.trips[tripId]; const rows = Object.values(s.requests).filter(r => r.tripId === tripId && r.tripVersion === t?.version && !r.supersededBy && !r.withdrawnAt && permitted(s, r.familyId, r.personId, 'service')).map(r => ({ r, state: serviceState(s, r) })); return { rows, user: rows.filter(x => x.state.owner === 'user').length, airline: rows.filter(x => x.state.owner === 'airline').length, support: rows.filter(x => x.state.owner === 'support').length, system: rows.filter(x => x.state.owner === 'system').length, confirmed: rows.filter(x => x.state.confirmed).length }; }
export function serviceActionLabel(s, tripId) { const q = serviceSummary(s, tripId); return q.rows.some(x => x.state.code === 'unavailable') ? '查看替代安排' : q.user ? (q.rows.filter(x => x.state.owner === 'user').every(x => x.state.code === 'missing') ? '補充所需資料' : '交給小期處理') : '查看服務進度'; }
export function serviceName(s, r) { return (s.persons[r.personId]?.displayName ?? s.persons[r.personId]?.name ?? '旅客') + ' · ' + (SERVICE_LABELS[r.kind] ?? '照護服務'); }
export function localDateTime(value, origin = 'HKG') { const d = new Date(value); return Number.isNaN(d.valueOf()) ? '日期待核對' : new Intl.DateTimeFormat('zh-TW', { timeZone: airport(origin)?.zone ?? 'Asia/Hong_Kong', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).format(d); }
export function tripDisplay(s, id, segmentId) { const j = s.journeys?.items[id], t = s.trips[id], seg = j?.segments.find(x => x.id === segmentId) ?? j?.segments[0], leg = t?.route.segments[0], from = seg?.from ?? leg?.origin ?? '', to = seg?.to ?? leg?.destination ?? '', flight = flightLabel(seg?.flight ?? t?.route.number ?? ''); return { route: [from, to].map(code => [airport(code)?.city, code].filter(Boolean).join(' ')).join(' → '), detail: localDateTime(seg?.departure ?? leg?.departureUtc ?? '', from) + ' · ' + flight + ' · ' + (t?.members.length ?? 1) + ' 位旅客', flight, origin: from }; }
const eventLabels = { supplemented: '已補充本次資料，等待處理', draft: '已整理本次需求', consent: '已確認資料用途', sending: '正在提交服務申請', accepted: '已取得提交回執，等待服務結果', failed: '提交失敗，可重試原申請', unknown: '提交結果待核實', 'case-created': '已建立跟進個案', 'case-working': '已交由專人處理', 'case-missing': '請補充所需資料', confirmed: '服務已確認', changed: '航班已變更，請重新核對安排' };
export function serviceTimeline(s, r) { const origin = tripDisplay(s, r.tripId, r.segmentId).origin; return (r.timeline ?? []).map(e => ({ at: localDateTime(e.at, origin), text: eventLabels[e.kind] })); }
