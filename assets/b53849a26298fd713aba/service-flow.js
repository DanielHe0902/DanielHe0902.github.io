import { CARE_REGISTRY, normalizedProfile, profileForAssessment } from '/assets/b53849a26298fd713aba/care-registry.js';
import * as D from '/assets/b53849a26298fd713aba/domain.js';
import { careKinds, savePlanCare } from '/assets/b53849a26298fd713aba/plan-care.js';
import { currentCase, createFollowUp, serviceEvent, serviceState } from '/assets/b53849a26298fd713aba/service-state.js';
import { segmentCancelled } from '/assets/b53849a26298fd713aba/segment-status.js';
import { RULES } from '/assets/b53849a26298fd713aba/config.js';
import { scheduleRecordingReplies, settleServiceReplies, notifyService } from '/assets/b53849a26298fd713aba/service-replies.js';
export function ensureSnapshotRequests(s, t) { let changed = false; for (const snap of t.snapshots) {
    if (!t.members.some(m => m.personId === snap.personId) || !D.permitted(s, t.familyId, snap.personId, 'service') || !D.permitted(s, t.familyId, snap.personId, 'care:view'))
        continue;
    for (const [i, leg] of t.route.segments.entries())
        for (const kind of snap.profile.needs) {
            const segmentId = t.id + '-v' + t.version + '-s' + i;
            if (segmentCancelled(s, t.id, segmentId))
                continue;
            const existing = Object.values(s.requests).find(r => r.tripId === t.id && r.tripVersion === t.version && r.segmentId === segmentId && r.personId === snap.personId && r.kind === kind);
            if (existing)
                continue;
            const caregiverId = kind === 'adjacent' ? t.relationships.find(r => r.dependentId === snap.personId)?.caregiverId : undefined, assessment = kind === 'adjacent' && !caregiverId ? { applicability: 'missing', missing: ['本次同行照護者'] } : D.assess(profileForAssessment(s, snap.profile, t.route.date), kind, leg.aircraft, s.demoClock, leg.operatingCarrier), id = crypto.randomUUID();
            s.requests[id] = { id, familyId: t.familyId, tripId: t.id, tripVersion: t.version, segmentId, personId: snap.personId, kind, caregiverId, ...assessment, progress: assessment.applicability === 'missing' ? 'missing' : assessment.applicability === 'unavailable' ? 'unavailable' : 'review', deadline: new Date(leg.departureUtc - RULES.deadlines[kind] * 3600000).toISOString(), key: [t.familyId, t.id, t.version, snap.personId, segmentId, kind, caregiverId ?? ''].join('|'), attempt: 0, receipt: null, ticket: null, history: [], manualQueried: false };
            serviceEvent(s.requests[id], 'draft', s.demoClock);
            changed = true;
        }
} return changed; }
export function updateTripCare(s, tripId, pid, input, caregiverId, supplement = '') {
    const t = s.trips[tripId];
    if (!t || !['planned', 'changed'].includes(t.status) || !t.members.some(m => m.personId === pid) || !D.permitted(s, t.familyId, pid, 'service') || !D.permitted(s, t.familyId, pid, 'care:edit'))
        throw Error('目前沒有修改本次需求的授權。');
    const p = { familyId: t.familyId, start: t.route.date }, allowed = careKinds(s, p, pid);
    if (input.needs.some(k => !allowed.includes(k)))
        throw Error('請核對旅客年齡與服務。');
    if (caregiverId && (!t.members.some(m => m.personId === caregiverId) || D.age(s.persons[caregiverId], t.route.date) < 18 || caregiverId === pid || !D.permitted(s, t.familyId, caregiverId, 'service')))
        throw Error('請選擇本次已授權的成年同行照護者。');
    for (const key of ['weight', 'months'])
        if (input[key] !== null && (!Number.isFinite(input[key]) || input[key] < 0 || input[key] > (key === 'weight' ? 300 : 216)))
            throw Error('請填寫有效的' + (key === 'weight' ? '體重' : '月齡') + '。');
    const requests = D.requestsFor(s, t).filter(r => r.personId === pid);
    for (const r of requests) {
        const c = currentCase(s, r), locked = r.attempt > 0 || !!c;
        if (locked && (!input.needs.includes(r.kind) || r.kind === 'adjacent' && t.relationships.find(x => x.dependentId === pid)?.caregiverId !== caregiverId))
            throw Error('已提交或已有跟進個案的安排需保留，請核對原申請。');
    }
    if (requests.some(r => r.replyMissing?.length || currentCase(s, r)?.status === 'missing') && !supplement.trim())
        throw Error('請補充回覆要求的資料。');
    const profile = structuredClone(input);
    profile.personId = pid;
    profile.familyId = t.familyId;
    profile.needs = [...new Set(profile.needs)];
    profile.required = profile.required.filter(k => profile.needs.includes(k));
    profile.updatedAt = s.demoClock;
    t.snapshots = t.snapshots.filter(x => x.personId !== pid);
    t.snapshots.push({ personId: pid, profileVersion: profile.version, profile });
    t.careImportedFor ??= [];
    if (!t.careImportedFor.includes(pid))
        t.careImportedFor.push(pid);
    const previous = t.relationships.find(x => x.dependentId === pid);
    t.relationships = t.relationships.filter(x => x.dependentId !== pid);
    if (caregiverId)
        t.relationships.push({ familyId: t.familyId, dependentId: pid, caregiverId, required: previous?.required ?? false });
    for (const r of requests) {
        if (!profile.needs.includes(r.kind)) {
            r.withdrawnAt = s.demoClock;
            continue;
        }
        const c = currentCase(s, r);
        if (r.replyMissing?.length) {
            if (!supplement.trim())
                throw Error('請補充回覆要求的資料。');
            r.history.push('已補充回覆所需資料：' + supplement.trim());
            r.replyMissing = [];
            serviceEvent(r, 'supplemented', s.demoClock);
            continue;
        }
        if (c?.status === 'missing') {
            r.history.push('已補充所需資料：' + supplement.trim());
            c.missing = [];
            c.status = 'waiting';
            c.updatedAt = s.demoClock;
            serviceEvent(r, 'supplemented', s.demoClock);
            continue;
        }
        if (r.attempt || c)
            continue;
        const index = t.route.segments.findIndex((_, i) => r.segmentId === t.id + '-v' + t.version + '-s' + i), assessment = r.kind === 'adjacent' && !caregiverId ? { applicability: 'missing', missing: ['本次同行照護者'] } : D.assess(profileForAssessment(s, profile, t.route.date), r.kind, t.route.segments[index].aircraft, s.demoClock, t.route.segments[index].operatingCarrier);
        Object.assign(r, assessment);
        r.caregiverId = r.kind === 'adjacent' ? caregiverId : undefined;
        r.progress = assessment.applicability === 'missing' ? 'missing' : assessment.applicability === 'unavailable' ? 'unavailable' : 'review';
    }
    for (const r of Object.values(s.requests))
        if (r.tripId === t.id && r.tripVersion === t.version && r.personId === pid && r.withdrawnAt && profile.needs.includes(r.kind))
            delete r.withdrawnAt;
    ensureSnapshotRequests(s, t);
    return s;
}
/** Built-in timeout means an accepted request whose response was lost. No external airline claim. */
export function queryServiceResult(s, id) { const r = s.requests[id], t = r && s.trips[r.tripId]; if (!r || !t || !D.permitted(s, t.familyId, r.personId, 'service') || !batchRows(s, t.id).some(x => x.r.id === id && x.allowed))
    throw Error('目前沒有辦理此申請的權限。'); const job = Object.values(s.serviceJobs ?? {}).find(j => j.requestId === id && j.envelope.version === r.tripVersion && j.envelope.attempt === r.attempt); if (!job || job.status !== 'settled')
    throw Error('原申請結果仍待核實，請稍後查詢。'); return D.reduce(s, { type: 'query', requestId: id, found: job.mode !== 'failure' }); }
export function importDraftCare(s, p) {
    if (!p.familyId || !p.selectedFlight)
        return;
    p.careNeeds ??= {};
    p.careImportAudit = [];
    const people = new Set([...s.memberships.filter(m => m.familyId === p.familyId && m.active).map(m => m.personId), ...p.travelerIds]);
    for (const id of people) {
        const audit = { personId: id, outcome: 'no-record' };
        p.careImportAudit.push(audit);
        if (!p.travelerIds.includes(id)) {
            audit.outcome = 'not-traveling';
            continue;
        }
        if (!D.permitted(s, p.familyId, id, 'care:view') || !D.permitted(s, p.familyId, id, 'service')) {
            audit.outcome = 'not-authorized';
            continue;
        }
        if (id in p.careNeeds) {
            audit.outcome = 'reused-or-overridden';
            continue;
        }
        const profile = s.profiles[p.familyId + ':' + id];
        if (profile) {
            p.careNeeds[id] = normalizedProfile(profile).needs;
            audit.outcome = 'imported';
            audit.profileVersion = profile.version;
        }
    }
}
/** Only fill absent member snapshots; never overwrite current-trip edits or submit. */
export function ensureTripCare(s, t) { if (t.status === 'completed' || t.route.segments.every((_, i) => segmentCancelled(s, t.id, t.id + '-v' + t.version + '-s' + i)) || !D.canAccessFamily(s, t.familyId))
    return false; let changed = false; for (const m of t.members) {
    const pid = m.personId;
    if (t.snapshots.some(x => x.personId === pid) || t.careImportedFor?.includes(pid) || !D.permitted(s, t.familyId, pid, 'care:view') || !D.permitted(s, t.familyId, pid, 'service'))
        continue;
    const profile = s.profiles[t.familyId + ':' + pid];
    if (!profile)
        continue;
    const p = { familyId: t.familyId, travelerIds: t.members.map(m => m.personId), start: t.route.date, careNeeds: { [pid]: profile.needs } };
    p.careNeeds[pid] = profile.needs.filter(k => careKinds(s, p, pid).includes(k));
    savePlanCare(s, p, t);
    t.careImportedFor ??= [];
    t.careImportedFor.push(pid);
    changed = true;
} return ensureSnapshotRequests(s, t) || changed; }
export function repairTripCare(s) { for (const [key, p] of Object.entries(s.profiles))
    s.profiles[key] = normalizedProfile(p); for (const t of Object.values(s.trips)) {
    for (const snap of t.snapshots)
        snap.profile = normalizedProfile(snap.profile);
    ensureTripCare(s, t);
} return s; }
export function batchRows(s, tripId) { const t = s.trips[tripId]; if (!t)
    return []; return D.visibleRequests(s, t).filter(r => !r.supersededBy).map(r => { const current = t.version === r.tripVersion && !segmentCancelled(s, t.id, r.segmentId) && t.status !== 'completed' && t.route.segments.some((leg, i) => r.segmentId === t.id + '-v' + t.version + '-s' + i && leg.departureUtc > Date.parse(s.demoClock)), allowed = current && D.permitted(s, t.familyId, r.personId, 'service'); const state = serviceState(s, r); let action = 'wait'; if (allowed && (r.replyMissing?.length || currentCase(s, r)?.status === 'missing'))
    action = 'missing';
else if (allowed && !currentCase(s, r) && !['confirmed', 'submitted', 'unknown'].includes(r.progress)) {
    action = r.applicability === 'unavailable' ? 'blocked' : r.applicability === 'missing' ? 'missing' : r.applicability === 'manual' ? 'missing' : Date.parse(r.deadline) < Date.parse(s.demoClock) ? 'blocked' : CARE_REGISTRY[r.kind].route === 'support' ? 'case' : 'submit';
} return { r, state, action, allowed }; }); }
export function batchConsentKey(s, tripId) { const t = s.trips[tripId]; return JSON.stringify({ version: t?.version, members: t?.members, snapshots: t?.snapshots, relationships: t?.relationships, account: s.activeAccountId }); }
export function submitServiceBatch(s, tripId, ids, now = Date.now(), expectedScope) { if (expectedScope && expectedScope !== batchConsentKey(s, tripId))
    throw Error('旅客、資料或授權範圍已變更，請重新核對本次提交。'); const rows = batchRows(s, tripId); if (new Set(ids).size !== ids.length || ids.some(id => !rows.some(x => x.r.id === id && x.allowed)))
    throw Error('本次服務或授權已變更，請重新核對。'); s.serviceJobs ??= {}; for (const id of ids) {
    const row = batchRows(s, tripId).find(x => x.r.id === id);
    if (!['submit', 'case'].includes(row.action))
        continue;
    const r = s.requests[id];
    r.consentAt = s.demoClock;
    serviceEvent(r, 'consent', s.demoClock);
    if (row.action === 'case') {
        const c = createFollowUp(s, r);
        c.routeSource = 'wheelchair-support';
        const rules = s.recordingServiceRules;
        if (rules && rules.spaceId === s.demoSpaceId && /^(qa-|recording-)/.test(rules.spaceId)) {
            const rule = rules.rules.find(x => x.personId === r.personId && x.kind === r.kind);
            if (rule?.result === 'missing' && c.status === 'waiting') {
                c.status = 'missing';
                c.missing = [...(rule.missing ?? [])];
                serviceEvent(r, 'case-missing', s.demoClock);
            }
        }
        continue;
    }
    s = D.reduce(s, { type: 'submit', requestId: id });
    const current = s.requests[id], key = current.key + ':attempt:' + current.attempt;
    s.serviceJobs ??= {};
    s.serviceJobs[key] ??= { id: key, requestId: id, envelope: D.requestEnvelope(s, current), mode: s.mockMode, dueAt: now + (s.mockMode === 'delay' ? 8000 : 900), status: 'pending', accountId: s.activeAccountId };
} return s; }
export function settleServiceJobs(s, now = Date.now()) { for (const job of Object.values(s.serviceJobs ?? {})) {
    if (job.status !== 'pending')
        continue;
    const r = s.requests[job.requestId], t = r && s.trips[r.tripId];
    if (!r || !t || t.version !== job.envelope.version || segmentCancelled(s, r.tripId, r.segmentId) || r.progress === 'reconfirm') {
        s.serviceJobs[job.id].status = 'stopped';
        continue;
    }
    if (job.dueAt > now)
        continue;
    s = D.reduce(s, { type: 'receipt', envelope: job.envelope, result: job.mode === 'failure' ? 'failure' : job.mode === 'timeout' ? 'timeout' : 'accepted' });
    s.serviceJobs[job.id].status = 'settled';
    if (s.requests[job.requestId]?.receipt) {
        notifyService(s, s.requests[job.requestId], job.accountId, 'accepted', '申請已提交，等待國泰確認。');
        scheduleRecordingReplies(s, s.requests[job.requestId], job.accountId, now);
    }
} return settleServiceReplies(s, now); }
