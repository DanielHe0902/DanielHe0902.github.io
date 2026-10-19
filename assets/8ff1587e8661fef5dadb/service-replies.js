import { serviceEvent, serviceName } from '/assets/8ff1587e8661fef5dadb/service-state.js';
import { segmentCancelled } from '/assets/8ff1587e8661fef5dadb/segment-status.js';
export function notifyService(s, r, accountId, key, text) { if (!s.dual)
    return; const id = 'service-result:' + r.id + ':' + r.attempt + ':' + key; s.dual.notifications[id] ??= { id, accountId, transactionId: id, tripId: r.tripId, requestId: r.id, title: key === 'accepted' ? '照護申請已提交' : '照護服務有新回覆', text: serviceName(s, r) + ' · ' + text, kind: 'service', createdAt: new Date().toISOString(), read: false }; }
/** Operator-installed rules only. Ordinary requests never auto-approve. */
export function scheduleRecordingReplies(s, r, accountId, now) { const config = s.recordingServiceRules; if (!config || config.spaceId !== s.demoSpaceId || !/^(recording-|qa-)/.test(config.spaceId) || !r.receipt)
    return; const rule = config.rules.find(x => x.personId === r.personId && x.kind === r.kind); if (!rule)
    return; const id = 'reply:' + r.id + ':' + r.attempt; s.serviceReplies ??= {}; s.serviceReplies[id] ??= { id, source: 'builtin-service-reply', ruleVersion: config.version, envelope: { epoch: s.epoch, requestId: r.id, familyId: r.familyId, tripId: r.tripId, version: r.tripVersion, attempt: r.attempt }, segmentId: r.segmentId, receipt: r.receipt, personId: r.personId, kind: r.kind, accountId, dueAt: now + rule.delayMs, result: rule.result, missing: rule.missing ?? [], status: 'pending' }; }
export function applyServiceReply(s, e, now = Date.now()) {
    s.serviceReplies ??= {};
    const old = s.serviceReplies[e.id];
    if (old && old.status !== 'pending')
        return s;
    const r = s.requests[e.envelope.requestId], t = r && s.trips[r.tripId];
    const valid = e.source === 'builtin-service-reply' && !!e.ruleVersion && r && t && e.envelope.epoch === s.epoch && t.version === e.envelope.version && r.tripVersion === e.envelope.version && r.tripId === e.envelope.tripId && r.familyId === e.envelope.familyId && r.attempt === e.envelope.attempt && r.segmentId === e.segmentId && r.personId === e.personId && r.kind === e.kind && r.receipt === e.receipt && r.progress === 'submitted' && !segmentCancelled(s, r.tripId, r.segmentId);
    const stored = s.serviceReplies[e.id] = { ...structuredClone(e), status: valid ? 'applied' : 'stale', appliedAt: now };
    if (!valid)
        return s;
    r.serviceReply = structuredClone(stored);
    if (e.result === 'confirmed') {
        r.progress = 'confirmed';
        r.replyMissing = [];
        serviceEvent(r, 'confirmed', new Date(now).toISOString());
        notifyService(s, r, e.accountId, e.id, '本航段服務已確認。');
    }
    else {
        r.replyMissing = [...e.missing];
        serviceEvent(r, 'case-missing', new Date(now).toISOString());
        notifyService(s, r, e.accountId, e.id, '請補充：' + e.missing.join('、'));
    }
    return s;
}
export function settleServiceReplies(s, now = Date.now()) { for (const e of Object.values(s.serviceReplies ?? {}))
    if (e.status === 'pending' && e.dueAt <= now)
        applyServiceReply(s, e, now); return s; }
