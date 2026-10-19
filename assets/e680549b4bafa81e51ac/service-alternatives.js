import * as D from '/assets/e680549b4bafa81e51ac/domain.js';
import { publishNotice } from '/assets/e680549b4bafa81e51ac/reminders.js';
function authorized(s, id) { const r = s.requests[id], t = r && s.trips[r.tripId], j = t && s.journeys?.items[t.id], leg = j?.segments.find(x => x.id === r.segmentId); if (!r || !t || t.version !== r.tripVersion || !D.permitted(s, r.familyId, r.personId, 'service') || !leg || leg.actualLanding || Date.parse(s.demoClock) >= Date.parse(leg.departure))
    throw Error('僅可處理有授權且尚未出發的目前航段；旅後請使用服務查詢／回報。'); return r; }
export function simulateUnavailable(s, requestId) { const r = authorized(s, requestId); if (r.kind !== 'childMeal')
    throw Error('本輪樣例只模擬兒童餐供應結果'); if (r.evidence)
    return s; r.evidence = { reason: '演示供應商回覆：本航段兒童餐配額已用完。尚未確認其他選项符合需求。', recordId: 'MOCK-UNAVAILABLE-' + crypto.randomUUID(), ruleVersion: 'demo-meal-capacity-2027.1', at: s.demoClock }; r.progress = 'unavailable'; r.history.push(r.evidence.recordId + ' · ' + r.evidence.reason); return s; }
export function chooseAlternative(s, id, option) {
    const r = authorized(s, id);
    if (r.progress !== 'unavailable' || !r.evidence || !['recheck', 'own-meal'].includes(option))
        throw Error('請先核對明確的不可滿足結果與替代條件');
    s.serviceCases ??= {};
    const old = Object.values(s.serviceCases).find(x => x.requestId === id);
    if (old)
        return s;
    const cid = 'CASE-' + crypto.randomUUID(), next = cid + ':request';
    s.requests[next] = { ...structuredClone(r), id: next, key: next, attempt: 1, receipt: 'MOCK-ACCEPTED-' + cid, ticket: cid, progress: 'submitted', history: ['與原申請 ' + id + ' 關聯；人工已受理，並非服務確認'], evidence: undefined, supersededBy: undefined, parentRequestId: id };
    s.serviceCases[cid] = { id: cid, requestId: id, nextRequestId: next, personId: r.personId, authorId: s.actorId, tripId: r.tripId, version: r.tripVersion, option, status: 'accepted', at: s.demoClock };
    r.supersededBy = next;
    return s;
}
export function followServiceCase(s, id) {
    const c = s.serviceCases?.[id];
    if (!c)
        throw Error('找不到人工紀錄');
    const original = s.requests[c.requestId];
    if (!D.permitted(s, original.familyId, c.personId, 'service'))
        throw Error('沒有查看此服務的授權');
    if (c.status === 'confirmed')
        return s;
    const next = s.requests[c.nextRequestId];
    if (!next || s.trips[c.tripId]?.version !== c.version)
        throw Error('行程版本已變更，請按原工單人工核實，不自動確認新航段');
    if (s.mockMode === 'timeout') {
        c.status = 'unknown';
        c.result = '人工回覆逾時，保留原工單，請稍後查詢。';
        next.progress = 'unknown';
        return s;
    }
    if (s.mockMode === 'failure' || c.option === 'own-meal') {
        c.status = 'unresolved';
        c.result = '尚無可確認的替代餐食。自行備餐的攜帶、加熱及飲食適用性仍須人工核實。';
        next.progress = 'unknown';
        return s;
    }
    c.status = 'confirmed';
    c.result = '演示供應商追加配額，已確認本航段兒童餐；原不可滿足結果保留。';
    next.progress = 'confirmed';
    next.receipt = 'MOCK-CONFIRMED-' + id;
    next.history.push(s.demoClock + ' · ' + c.result);
    publishNotice(s, 'service-case:' + id, c.authorId, '人工服務結果已更新', c.result, { tripId: c.tripId });
    return s;
}
export function visibleServiceCases(s, tripId) { return Object.values(s.serviceCases ?? {}).filter(c => c.tripId === tripId && D.permitted(s, s.requests[c.requestId].familyId, c.personId, 'service')); }
