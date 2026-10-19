import { userCancelledSegment } from '/assets/ee1ad71b9a14d41f146c/trip-decision.js';
import { prefs, CONTENT, contentAvailable } from '/assets/ee1ad71b9a14d41f146c/experience.js';
import * as D from '/assets/ee1ad71b9a14d41f146c/domain.js';
import { FUND } from '/assets/ee1ad71b9a14d41f146c/demo.js';
import { serviceState } from '/assets/ee1ad71b9a14d41f146c/service-state.js';
export const FESTIVALS = [{ id: 'spring-2027', name: '春節團聚', at: '2027-02-06T02:00:00Z' }, { id: 'autumn-2027', name: '中秋團聚', at: '2027-09-15T02:00:00Z' }, { id: 'birthday-2027', name: '生日關懷', at: '2027-10-01T02:00:00Z' }];
export function initReminders(s) { s.reminders ??= {}; s.subscriptions ??= {}; s.festivalInvited ??= {}; return s; }
export function publishNotice(s, id, personId, title, body, extra = {}) { initReminders(s); s.reminders[id] ??= { id, personId, type: 'update', node: id, dueAt: s.demoClock, status: 'sent', sentAt: s.demoClock, title, body, read: false, ...extra }; }
export function visibleReminders(s, includeHistory = false) { return Object.values(s.reminders ?? {}).filter(r => r.personId === s.actorId && (includeHistory || r.status === 'sent') && (!r.tripId || readable(s, r.tripId, r.personId))); }
function settings(s, personId) { const account = Object.values(s.dual?.accounts ?? {}).find(a => a.personId === personId); return prefs(s, account?.accountId ?? personId); }
function readable(s, tripId, personId) { const j = s.journeys?.items[tripId], t = s.trips[tripId]; return !!j && (j.familyId ? !!D.membership(s, j.familyId, personId) && !!t?.members.some(m => m.personId === personId) : j.ownerId === personId || j.grants.includes(personId)); }
export function subscribeFestival(s, node, active) { initReminders(s); const f = s.funds[FUND]; if (!f || !FESTIVALS.some(x => x.id === node) || !D.account(s, s.actorId))
    throw Error('未知提醒節點或未登入'); if (s.actorId !== f.ownerId && !s.festivalInvited[FUND]?.includes(s.actorId))
    throw Error('學生尚未開放你訂閱此目標的節日提醒'); const id = s.actorId + ':' + FUND + ':' + node; s.subscriptions[id] = { id, personId: s.actorId, fundId: FUND, node, active }; return s; }
export function allowFestival(s, personId, allow) { initReminders(s); if (s.funds[FUND]?.ownerId !== s.actorId || personId === s.actorId || !D.account(s, personId))
    throw Error('只能由目標本人開放提醒訂閱'); const ids = new Set(s.festivalInvited[FUND] ?? []); allow ? ids.add(personId) : ids.delete(personId); s.festivalInvited[FUND] = [...ids]; return s; }
/** Deterministic scheduling runs inside the same IndexedDB write as time/business changes. */
export function runSchedules(s) {
    if (!s.seedVersion)
        return s;
    initReminders(s);
    const records = s.reminders, now = Date.parse(s.demoClock), valid = new Set();
    const schedule = (r, expired, merge = false) => { valid.add(r.id); const old = records[r.id]; if (old?.status === 'sent' || old?.status === 'merged' || old?.status === 'skipped')
        return; records[r.id] = { ...r, status: merge ? 'merged' : now >= expired ? 'skipped' : now >= Date.parse(r.dueAt) ? 'sent' : 'planned', sentAt: !merge && now >= Date.parse(r.dueAt) && now < expired ? s.demoClock : undefined }; };
    for (const j of Object.values(s.journeys?.items ?? {})) {
        const t = s.trips[j.id];
        if (t?.status === 'completed' || t?.status === 'cancelled' && !t.flightChangeId)
            continue;
        const people = j.familyId ? (t?.members.map(m => m.personId) ?? []).filter(p => readable(s, j.id, p) && !!D.account(s, p)) : [j.ownerId];
        for (const [index, seg] of j.segments.entries()) {
            if (userCancelledSegment(s, j.id, seg.id))
                continue;
            if (index === 0 && t?.status === 'cancelled' && t.flightChangeId)
                continue;
            if (seg.completed || seg.actualLanding)
                continue;
            const dep = Date.parse(seg.departure);
            for (const personId of people) {
                if (!settings(s, personId).tripReminders)
                    continue;
                const needs = Object.values(s.dual?.tasks ?? {}).filter(x => x.tripId === j.id && x.version === j.version && x.status !== 'done' && (x.personId === personId || j.familyId && D.permitted({ ...s, actorId: personId }, j.familyId, x.personId, 'care:view')));
                const services = Object.values(s.requests).filter(r => r.tripId === j.id && r.tripVersion === j.version && r.segmentId === seg.id && !r.supersededBy && !r.withdrawnAt && serviceState(s, r).owner === 'user' && D.permitted({ ...s, actorId: personId }, r.familyId, r.personId, 'service'));
                const summary = needs.length || services.length ? `${needs.length} 項準備、${services.length} 項服務仍需核對。請查看有權限處理的事項。` : '目前已核對可見事項；出發前再確認文件與航班。';
                for (const hours of [72, 24]) {
                    const id = `departure:${personId}:${j.id}:leg${index}:${hours}`;
                    schedule({ id, personId, type: 'departure', tripId: j.id, segmentIndex: index, node: 'T−' + hours + 'h', dueAt: new Date(dep - hours * 3600000).toISOString(), departure: seg.departure, departureZone: seg.from === 'NRT' ? 'Asia/Tokyo' : seg.from === 'LHR' ? 'Europe/London' : 'Asia/Hong_Kong', version: j.version, status: 'planned', title: `${seg.from} → ${seg.to} · 出發前 ${hours} 小時`, body: summary, read: false }, dep, hours === 72 && now >= dep - 24 * 3600000 && records[id]?.status !== 'sent');
                }
                for (const r of services) {
                    const due = Date.parse(r.deadline);
                    if (due >= dep - 72 * 3600000)
                        continue;
                    const id = `deadline:${personId}:${j.id}:leg${index}:${r.personId}:${r.kind}`;
                    schedule({ id, personId, type: 'deadline', tripId: j.id, segmentIndex: index, node: '服務期限', dueAt: new Date(due - 24 * 3600000).toISOString(), departure: seg.departure, departureZone: seg.from === 'NRT' ? 'Asia/Tokyo' : seg.from === 'LHR' ? 'Europe/London' : 'Asia/Hong_Kong', version: j.version, status: 'planned', title: '服務申請期限早於出發前 72 小時', body: '請提前核對服務資料；申請截止 ' + r.deadline + '。逾期請向人工核實可行性。', read: false }, dep);
                }
                const previous = Object.values(records).find(r => r.personId === personId && r.tripId === j.id && r.segmentIndex === index && r.type === 'departure' && r.status === 'sent' && r.departure !== seg.departure);
                if (previous)
                    publishNotice(s, `reschedule:${personId}:${j.id}:${index}:${seg.departure}`, personId, '行程時間已更新', '已重算尚未發送的節點；已發送的 72/24 小時提醒不重發。', { tripId: j.id, segmentIndex: index, version: j.version });
            }
        }
    }
    for (const sub of Object.values(s.subscriptions)) {
        const f = s.funds[sub.fundId], event = FESTIVALS.find(e => e.id === sub.node);
        if (!settings(s, sub.personId).festivalReminders || !sub.active || !f || f.status !== 'open' || !event || sub.personId !== f.ownerId && !s.festivalInvited[f.id]?.includes(sub.personId))
            continue;
        const confirmed = Object.values(s.supports).filter(x => x.fundId === f.id && x.status === 'confirmed').reduce((n, x) => n + x.amount, 0);
        if (confirmed >= f.target)
            continue;
        for (const days of [14, 7]) {
            const id = `festival:${sub.personId}:${f.id}:${event.id}:${days}`, at = Date.parse(event.at);
            schedule({ id, personId: sub.personId, type: 'festival', fundId: f.id, node: days + ' 天前', dueAt: new Date(at - days * 86400000).toISOString(), status: 'planned', title: event.name, body: `你訂閱的回家目標提醒 · 提前 ${days} 天。查看目標不會扣款。`, read: false }, at, days === 14 && now >= at - 7 * 86400000 && records[id]?.status !== 'sent');
        }
    }
    for (const a of Object.values(s.dual?.accounts ?? {})) {
        if (!settings(s, a.personId).contentReminders)
            continue;
        const accountState = { ...s, actorId: a.personId, activeAccountId: a.accountId };
        for (const c of CONTENT) {
            if (!c.seasonal || !contentAvailable(accountState, c, now))
                continue;
            const id = 'content:' + a.personId + ':' + c.contentId + ':v' + c.version;
            schedule({ id, personId: a.personId, type: 'update', node: '主題靈感', dueAt: c.from, status: 'planned', title: c.title, body: '你訂閱的旅行靈感已更新，前往首頁探索下一段旅程。', read: false }, Date.parse(c.until));
        }
    }
    for (const r of Object.values(records))
        if ((['departure', 'deadline', 'festival'].includes(r.type) || r.id.startsWith('content:')) && !valid.has(r.id) && r.status === 'planned')
            r.status = 'cancelled';
    return s;
}
