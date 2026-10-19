import { userCancelledSegment, tripDecision } from '/assets/5c5eb8250e82e8e3ffd2/trip-decision.js';
import * as D from '/assets/5c5eb8250e82e8e3ffd2/domain.js';
import * as M from '/assets/5c5eb8250e82e8e3ffd2/demo.js';
import { recoveryCandidates, tripDemand } from '/assets/5c5eb8250e82e8e3ffd2/recovery.js';
import { flightRoute } from '/assets/5c5eb8250e82e8e3ffd2/flights.js';
import { serviceEvent } from '/assets/5c5eb8250e82e8e3ffd2/service-state.js';
import { runSchedules } from '/assets/5c5eb8250e82e8e3ffd2/reminders.js';
export const DISRUPTION_DELAY_MS = 60_000;
export function normalizeDisruptionTasks(s) { for (const task of s.flightChanges?.recording ?? []) {
    if (task.status !== 'scheduled')
        continue;
    const at = task.confirmedAt ?? task.armedAt;
    if (at === undefined)
        continue;
    task.confirmedAt = at;
    task.dueAt = at + DISRUPTION_DELAY_MS;
} return s; }
export const CHANGE_RULES = { delayMs: DISRUPTION_DELAY_MS, version: 'flight-change-1', bassinetSource: 'https://www.cathaypacific.com/cx/zh_TW/prepare-trip/help-for-passengers/travelling-with-children/safety-seats-and-devices/bassinet.html', verified: '2026-10-18' };
export function changeStore(s) { return s.flightChanges ??= { events: {}, recording: [] }; }
export function tripForChange(s, id) { if (s.trips[id])
    return s.trips[id]; const j = s.journeys?.items[id]; if (!j?.selectedFlight)
    return; const route = flightRoute(j.selectedFlight.outbound, 300000); if (j.selectedFlight.inbound)
    route.segments.push(...flightRoute(j.selectedFlight.inbound, 300000).segments); if (j.version > 1) {
    route.segments = j.segments.map((seg, i) => ({ ...route.segments[i] ?? route.segments[0], origin: seg.from, destination: seg.to, departureUtc: Date.parse(seg.departure), arrivalUtc: Date.parse(seg.scheduledArrival), aircraft: seg.aircraft ?? route.segments[0].aircraft }));
    route.number = j.segments[0].flight;
    route.origin = j.segments[0].from;
    route.destination = j.segments.at(-1).to;
} const e = Object.values(s.flightChanges?.events ?? {}).find(e => e.tripId === id && e.version === j.version && e.status === 'open'); return { id, familyId: '', version: j.version, route, members: [{ personId: j.ownerId, occupiesSeat: true, companionId: null }], snapshots: [], relationships: [], status: e?.type === 'cancel' ? 'cancelled' : 'planned', flightChangeId: e?.id, checklist: {}, needsReview: !!e, noCandidates: false }; }
export function canChange(s, e, write = false) { const t = tripForChange(s, e.tripId), j = s.journeys?.items[e.tripId]; if (!t || !e.recipients.includes(s.activeAccountId))
    return false; if (!t.familyId)
    return j?.ownerId === s.actorId; return M.canReadTrip(s, t.id) && (!write || e.processors.includes(s.activeAccountId) && ['owner', 'editor'].includes(D.membership(s, t.familyId)?.role ?? '') && t.snapshots.filter(x => x.profile.needs.length).every(x => D.permitted(s, t.familyId, x.personId, 'service'))); }
export function scheduleFirstConfirmation(s, tripId, operationId, now = Date.now()) { const store = changeStore(s), j = s.journeys?.items[tripId], t = tripForChange(s, tripId); if (!j || !t || j.version !== 1 || !j.selectedFlight || !j.segments.length || store.recording.some(c => c.tripId === tripId))
    return s; const segment = j.segments[0]; if (Date.parse(segment.departure) <= now)
    return s; const id = 'first-confirmation:' + operationId; store.recording.push({ id, spaceId: s.demoSpaceId ?? '', tripId, version: j.version, segmentIndex: 0, segmentId: segment.id, segmentFingerprint: JSON.stringify([segment.id, segment.flight, segment.departure, segment.from, segment.to]), operationId, accountId: s.activeAccountId, ownerId: j.ownerId, type: 'cancel', confirmedAt: now, armedAt: now, dueAt: now + DISRUPTION_DELAY_MS, status: 'scheduled' }); return s; }
/** Compatibility for pre-existing controlled tests only; normal bookings schedule at commit. */
export function armRecordingChange(s, space, tripId, now = Date.now()) { for (const config of s.flightChanges?.recording ?? []) {
    if (config.spaceId !== space || config.tripId !== tripId || config.status !== 'waiting-save')
        continue;
    const t = tripForChange(s, tripId);
    if (!t || t.version !== config.version || t.status !== 'planned' || t.route.segments[config.segmentIndex]?.departureUtc <= now) {
        config.status = 'invalidated';
        continue;
    }
    config.armedAt = now;
    config.confirmedAt = now;
    config.dueAt = now + DISRUPTION_DELAY_MS;
    config.status = 'scheduled';
} return s; }
export function deliverFlightChanges(s, space, now = Date.now()) {
    let changed = false;
    for (const config of s.flightChanges?.recording ?? []) {
        if (config.spaceId !== space || config.status !== 'scheduled' || (config.dueAt ?? Infinity) > now)
            continue;
        changed = true;
        const store = changeStore(s), t = tripForChange(s, config.tripId), segment = t?.route.segments[config.segmentIndex], j = s.journeys?.items[config.tripId], bound = j?.segments[config.segmentIndex];
        if (store.events[config.id]) {
            config.status = 'delivered';
            continue;
        }
        if (!t || userCancelledSegment(s, config.tripId, bound?.id ?? config.segmentId ?? '') || config.segmentFingerprint && config.segmentFingerprint !== JSON.stringify([bound?.id, bound?.flight, bound?.departure, bound?.from, bound?.to]) || t.version !== config.version || !segment || segment.departureUtc <= now || t.status !== 'planned' || config.segmentIndex !== 0) {
            config.status = 'invalidated';
            continue;
        }
        const recipients = Object.values(s.dual?.accounts ?? {}).filter(a => t.familyId ? (t.members.some(m => m.personId === a.personId) || j?.ownerId === a.personId) && s.memberships.some(m => m.personId === a.personId && m.familyId === t.familyId && m.active) : a.personId === j?.ownerId).map(a => a.accountId), processors = recipients.filter(id => !t.familyId || s.memberships.some(m => m.personId === s.dual.accounts[id].personId && m.familyId === t.familyId && m.active && m.role !== 'viewer'));
        const at = new Date(now).toISOString(), segmentId = `${t.id}-v${t.version}-s0`, oldRequests = Object.values(s.requests).filter(r => r.tripId === t.id && r.tripVersion === t.version && r.segmentId === segmentId), e = { id: config.id, tripId: t.id, segmentId, version: t.version, type: config.type, source: config.operationId ? 'builtin' : 'controlled-recording', happenedAt: at, receivedAt: at, before: structuredClone(segment), after: config.after ? structuredClone(config.after) : undefined, flight: t.route.number, recipients, processors, notificationIds: [], status: 'open', order: config.order, history: { route: structuredClone(t.route), requests: structuredClone(oldRequests) } };
        if (config.type !== 'cancel' && !config.after) {
            config.status = 'invalidated';
            continue;
        }
        if (config.type === 'cancel')
            t.status = 'cancelled';
        else {
            t.route.segments[0] = structuredClone(config.after);
            t.route.aircraft = config.after.aircraft;
            t.route.date = config.after.departureDate;
            t.route.departure = config.after.departure;
            const j = s.journeys?.items[t.id];
            if (j?.segments[0])
                Object.assign(j.segments[0], { departure: new Date(config.after.departureUtc).toISOString(), scheduledArrival: new Date(config.after.arrivalUtc).toISOString(), estimatedArrival: new Date(config.after.arrivalUtc).toISOString(), aircraft: config.after.aircraft, updatedAt: at });
        }
        t.needsReview = true;
        t.flightChangeId = e.id;
        for (const r of oldRequests) {
            serviceEvent(r, 'changed', at);
            r.progress = 'reconfirm';
            r.history.push('航班變更，原回執僅保留於歷史，需核對後續安排。');
            r.receipt = null;
        }
        store.events[e.id] = e;
        for (const accountId of recipients) {
            const id = 'flight-change:' + e.id + ':' + accountId;
            e.notificationIds.push(id);
            s.dual.notifications[id] = { id, accountId, transactionId: e.id, eventId: e.id, tripId: t.id, kind: 'flight-change', title: changeTitle(e), text: changeSummary(e), read: false, createdAt: at };
        }
        config.status = 'delivered';
        config.deliveredAt = now;
        s.dual.revision++;
        runSchedules(s);
    }
    return changed;
}
export const changeTitle = (e) => ['plan-cancelled', 'refund-processing'].includes(e.status) ? '行程取消' : e.type === 'cancel' ? '航班已取消' : e.type === 'delay' ? '航班時間有變更' : '航班機型有變更';
export const changeSummary = (e) => ['plan-cancelled', 'refund-processing'].includes(e.status) ? '此段行程已由你取消，紀錄已保留。' : `${e.before.departureDate} · ${e.before.origin} → ${e.before.destination} · ${e.flight.replace('CX-DEMO', 'CX')}。${e.type === 'cancel' ? '小期可以協助比較全家同行的替代安排。' : e.type === 'delay' ? `出發時間調整為 ${e.after?.departureDate} ${e.after?.departure}，請核對接駁與照護安排。` : `機型改為 ${e.after?.aircraft}，原照護安排需要重新核對。`}`;
export function eventCandidates(s, e) { if (!canChange(s, e))
    throw Error('目前沒有這段行程的查看權限。'); if (e.status !== 'open' || tripForChange(s, e.tripId).version !== e.version)
    return []; return recoveryCandidates(s, tripForChange(s, e.tripId)).map(c => { if (e.bassinetConfirmationRequired && c.evaluation?.services.some(x => x.kind === 'bassinet' && x.status !== 'confirmed')) {
    c.eligible = false;
    c.evaluation.status = 'verify';
    c.evaluation.fingerprint += ':bassinet-confirmation-required';
} return c; }); }
export function migrationRows(s, e, c) { const t = tripForChange(s, e.tripId), services = c.evaluation?.services ?? []; return services.map(x => ({ personId: x.personId, caregiverId: t.relationships.find(r => r.dependentId === x.personId)?.caregiverId, kind: x.kind, oldRequestId: e.history.requests.find(r => r.personId === x.personId && r.kind === x.kind)?.id, status: x.status })); }
function requireOpen(s, id) { const e = s.flightChanges?.events[id]; if (!e || !canChange(s, e, true))
    throw Error('請由獲授權的家庭成員辦理。'); if (e.status !== 'open')
    throw Error('此變更已處理或正在辦理退票，請查看目前結果。'); if (tripForChange(s, e.tripId).version !== e.version)
    throw Error('行程版本已更新，請重新查看。'); return e; }
export function confirmChange(s, id, candidateId, fingerprint) {
    const previous = s.flightChanges?.events[id];
    if (previous?.status === 'rebooked' && canChange(s, previous, true))
        return s;
    const e = requireOpen(s, id), t = tripForChange(s, e.tripId), candidate = eventCandidates(s, e).find(c => c.id === candidateId);
    if (!candidate?.eligible || candidate.evaluation?.fingerprint !== fingerprint)
        throw Error('同行、航班或照護條件已變更，請重新預覽。');
    if (!t.familyId) {
        const next = structuredClone(s), j = next.journeys.items[t.id], leg = candidate.route.segments[0];
        j.flightHistory ??= [];
        j.flightHistory.push({ version: j.version, at: s.demoClock, segments: structuredClone(j.segments), snapshot: structuredClone(j.selectedFlight), source: j.flightSource ?? 'builtin' });
        if (j.selectedFlight && candidate.flightOption) {
            j.selectedFlight.outbound = structuredClone(candidate.flightOption);
            delete j.selectedFlight.providerOffer;
        }
        j.version++;
        j.revision++;
        j.segments[0] = { ...j.segments[0], id: t.id + '-v' + j.version + '-s0', flight: candidate.route.number, from: leg.origin, to: leg.destination, departure: new Date(leg.departureUtc).toISOString(), scheduledArrival: new Date(leg.arrivalUtc).toISOString(), aircraft: leg.aircraft, updatedAt: s.demoClock };
        next.flightChanges.events[id].status = 'rebooked';
        next.flightChanges.events[id].newVersion = j.version;
        finishNotice(next, next.flightChanges.events[id], '行程已更新', '已保留其餘航段，請核對新航班安排。');
        return next;
    }
    const unchangedRequests = Object.values(s.requests).filter(r => r.tripId === t.id && r.tripVersion === t.version && r.segmentId !== e.segmentId).map(r => structuredClone(r)), oldJourney = structuredClone(s.journeys?.items[t.id]);
    // Reducer works on a clone; neither the old effective trip nor requests are removed before validation.
    const input = structuredClone(s);
    input.trips[e.tripId].status = 'cancelled';
    const next = D.reduce(input, { type: 'rebook', familyId: t.familyId, tripId: t.id, candidateId, confirmed: true, expectedFingerprint: fingerprint });
    const event = next.flightChanges.events[id];
    event.status = 'rebooked';
    event.newVersion = next.trips[t.id].version;
    // Only the outbound changes. Keep subsequent request receipts and immutable segment IDs.
    for (const r of Object.values(next.requests).filter(r => r.tripId === t.id && r.tripVersion === event.newVersion && !r.segmentId.endsWith('-s0')))
        delete next.requests[r.id];
    for (const old of unchangedRequests) {
        const preserved = next.requests[old.id];
        if (preserved) {
            Object.assign(preserved, old, { tripVersion: event.newVersion });
            const c = old.followUpId ? next.followUps?.[old.followUpId] : undefined, oldKey = [old.familyId, old.tripId, old.tripVersion, old.segmentId, old.personId, old.kind, old.caregiverId ?? ''].join('|');
            if (c && c.requestId === old.id && c.key === oldKey) {
                c.scopeHistory ??= [];
                c.scopeHistory.push({ key: c.key, at: s.demoClock });
                c.key = [preserved.familyId, preserved.tripId, preserved.tripVersion, preserved.segmentId, preserved.personId, preserved.kind, preserved.caregiverId ?? ''].join('|');
            }
        }
    }
    for (const r of Object.values(next.requests).filter(r => r.tripId === t.id && r.tripVersion === event.newVersion && r.segmentId.endsWith('-s0'))) {
        r.parentRequestId = e.history.requests.find(old => old.personId === r.personId && old.kind === r.kind)?.id;
    }
    M.syncFamilyJourney(next);
    const j = next.journeys?.items[t.id];
    if (j && oldJourney) {
        j.flightHistory ??= [];
        j.flightHistory.push({ version: oldJourney.version, at: s.demoClock, segments: structuredClone(oldJourney.segments), snapshot: structuredClone(oldJourney.selectedFlight), source: oldJourney.flightSource ?? 'builtin' });
        if (oldJourney.selectedFlight && candidate.flightOption) {
            j.selectedFlight = structuredClone(oldJourney.selectedFlight);
            j.selectedFlight.outbound = structuredClone(candidate.flightOption);
            delete j.selectedFlight.providerOffer;
        }
        j.segments.splice(1, j.segments.length - 1, ...structuredClone(oldJourney.segments.slice(1)));
        j.school = oldJourney.school;
        j.pickup = oldJourney.pickup;
        j.grants = oldJourney.grants;
        j.sharedTo = oldJourney.sharedTo;
    }
    next.trips[t.id].needsReview = true;
    finishNotice(next, event, '行程已更新', '同行名單與照護資料已帶入。新航段服務待獨立確認。');
    runSchedules(next);
    return next;
}
export function refundPreview(s, id) { const e = requireOpen(s, id), paid = !!e.order?.paid; return { paid, amount: paid && e.order.fee !== null ? Math.max(0, e.order.affectedAmount - e.order.fee) : null, fee: e.order?.fee ?? null, currency: e.order?.currency ?? 'HKD', passengers: tripDemand(tripForChange(s, e.tripId)).travellerCount, fingerprint: JSON.stringify({ id, version: e.version, order: e.order, members: tripForChange(s, e.tripId).members }) }; }
export function confirmRefund(s, id, fingerprint) { const old = s.flightChanges?.events[id]; if (old && ['refund-processing', 'plan-cancelled'].includes(old.status) && canChange(s, old, true)) {
    if (old.cancellation?.fingerprint && old.cancellation.fingerprint !== fingerprint)
        throw Error('取消操作的範圍不一致，請查看現有紀錄。');
    return s;
} const e = requireOpen(s, id), preview = refundPreview(s, id); if (preview.fingerprint !== fingerprint)
    throw Error('退票範圍已改變，請重新核對。'); e.status = preview.paid ? 'refund-processing' : 'plan-cancelled'; if (preview.paid)
    e.refund = { id: 'refund:' + id, submittedAt: s.demoClock, amount: preview.amount, currency: preview.currency, status: 'processing' }; const t = tripForChange(s, e.tripId); t.status = tripDecision(s, t.id).userCancelled ? 'cancelled' : 'planned'; t.needsReview = false; e.cancellation = { requestId: 'cancel:' + e.id, expectedVersion: e.version, accountId: s.activeAccountId, confirmedAt: s.demoClock, fingerprint }; for (const task of s.flightChanges?.recording ?? [])
    if (task.tripId === e.tripId && task.status === 'scheduled' && (task.segmentId === e.segmentId || task.segmentIndex === Number(e.segmentId.split('-s').at(-1))))
        task.status = 'invalidated'; for (const job of Object.values(s.serviceJobs ?? {}))
    if (job.status === 'pending' && s.requests[job.requestId]?.segmentId === e.segmentId)
        job.status = 'stopped'; for (const n of Object.values(s.dual?.notifications ?? {}))
    if (n.eventId === e.id) {
        n.title = '行程取消';
        n.text = '此段行程已由你取消，紀錄已保留。';
    } finishNotice(s, e, preview.paid ? '退票申請已提交' : '這段計劃已取消', preview.paid ? '正在處理，最終金額及退回時間待確認。' : '已保留原旅程與照護歷史。其他航段維持原安排。'); runSchedules(s); return s; }
function finishNotice(s, e, title, text) { for (const accountId of e.recipients) {
    const id = 'flight-result:' + e.id + ':' + accountId;
    s.dual.notifications[id] ??= { id, accountId, eventId: e.id, tripId: e.tripId, transactionId: e.id, kind: 'flight-change', title, text, read: false, createdAt: s.demoClock };
} s.dual.revision++; }
