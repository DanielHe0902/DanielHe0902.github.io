import { importDraftCare, submitServiceBatch, batchRows } from './service-flow.js';
import { flightLabel } from './passport-visual.js';
import { newTravelPlan } from './experience.js';
import * as D from './domain.js';
import { tripFamilies, tripPeople, saveItinerary, itineraryPreview } from './itinerary.js';
import { offerQuery } from './flight-service.js';
import { criteriaFor, criteriaKey, validateSnapshot } from './flights.js';
import { EXAMPLE_CATALOG } from '../web/example-flights.js';
import { aircraftLayout, seatsAdjacent } from './aircraft-care.js';
import { SERVICE_LABELS } from './config.js';
import { displayName } from './identity.js';
export function installBookingPreferences(s) { if (!s.bookingPreferencesInstalled) {
    s.experience ??= { version: 1, preferences: {}, favorites: {}, plans: {} };
    if (s.dual?.accounts['demo-parent']?.personId === 'father' && !s.experience.preferences['demo-parent'])
        s.experience.preferences['demo-parent'] = { themes: [], origin: 'HKG', budget: null, tripReminders: true, festivalReminders: true, contentReminders: false };
    s.bookingPreferencesInstalled = true;
} return s; }
export function bookingStore(s) { return s.booking ??= { sessions: {}, care: {}, receipts: {} }; }
export function newBooking(s) { const p = newTravelPlan(s); p.travelerIds = []; p.travelType = 'oneway'; p.flightSource = 'reference'; p.cathayOnly = true; p.directOnly = false; p.booking = { taskId: crypto.randomUUID(), phase: 'collecting_conditions', revision: 0, queryRevision: 0, travelerScope: 'unspecified', travelersConfirmed: false, cabinConfirmed: false, careRecordIds: [], requestId: crypto.randomUUID() }; return p; }
/** Called with one operation ID per intentional new action; retries return its own draft. */
export function startNewPlanningSession(s, operationId) { const account = s.activeAccountId ?? s.actorId, store = bookingStore(s); const old = Object.values(store.sessions).find(p => p.accountId === account && p.booking?.startOperationId === operationId); if (old)
    return structuredClone(old); const p = newBooking(s); p.booking.taskId = crypto.randomUUID(); p.booking.startOperationId = operationId; store.sessions[p.id] = structuredClone(p); return p; }
export function bookingScope(s, p) { if (p.accountId !== (s.activeAccountId ?? s.actorId) || p.personId !== s.actorId)
    throw Error('帳號已切換，請在原帳號繼續規劃。'); if (p.familyId && (p.familyId !== s.activeFamilyId || !tripFamilies(s).some(f => f.id === p.familyId)))
    throw Error('目前沒有規劃這個家庭行程的權限。'); if (p.travelerIds.some(id => !s.persons[id] || !tripPeople(s, p.familyId ?? '').some(x => x.id === id)))
    throw Error('同行成員已變更，請重新核對。'); }
export function bookingContext(s, p) { const b = p.booking; return { origin: p.origin, destination: p.destination, outboundDate: p.start, returnDate: p.end, cabin: b.cabinConfirmed ? p.cabin : null, departurePeriod: p.departurePeriod ?? 'any', travelerScope: b.travelerScope, explicitCount: b.explicitCount ?? null, travelerCount: b.travelersConfirmed ? p.travelerIds.length : null, familyCount: s.activeFamilyId && tripFamilies(s).some(f => f.id === s.activeFamilyId) ? D.familyMembers(s, s.activeFamilyId).length : null }; }
export function applyBookingPatch(s, p, patch) {
    bookingScope(s, p);
    const b = p.booking, before = criteriaKey(criteriaFor(p));
    b.error = undefined;
    for (const [key, field] of [['origin', 'origin'], ['destination', 'destination'], ['outboundDate', 'start'], ['returnDate', 'end'], ['departurePeriod', 'departurePeriod']]) {
        const value = patch[key];
        if (value !== null && value !== undefined)
            p[field] = value;
    }
    if (patch.cabin) {
        p.cabin = patch.cabin;
        b.cabinConfirmed = true;
    }
    if (patch.returnDate !== undefined && patch.returnDate !== null)
        p.travelType = patch.returnDate ? 'return' : 'oneway';
    if (patch.explicitCount != null) {
        if (!Number.isInteger(patch.explicitCount) || patch.explicitCount < 1 || patch.explicitCount > 8)
            throw Error('請核對實際同行人數（1 至 8 位）。');
        b.explicitCount = patch.explicitCount;
    }
    if (patch.travelerScope)
        b.travelerScope = patch.travelerScope;
    if (b.travelerScope === 'all_family') {
        const fid = p.familyId || s.activeFamilyId;
        if (!fid || !tripFamilies(s).some(f => f.id === fid))
            throw Error('目前沒有建立家庭行程的權限；可規劃本人行程。');
        const members = D.familyMembers(s, fid);
        if (!members.length || members.some(m => !s.persons[m.personId]?.dob))
            throw Error('家庭成員資料未完整載入，請重試。');
        p.familyId = fid;
        p.travelerIds = members.map(m => m.personId).sort();
        b.travelersConfirmed = b.explicitCount === undefined || b.explicitCount === members.length;
        if (!b.travelersConfirmed)
            b.error = '家庭共有 ' + members.length + ' 位成員，請選擇這次同行的 ' + b.explicitCount + ' 位。';
    }
    else if (b.travelerScope === 'self') {
        p.familyId = '';
        p.travelerIds = [s.actorId];
        b.travelersConfirmed = b.explicitCount === undefined || b.explicitCount === 1;
        if (!b.travelersConfirmed)
            b.error = '本人行程只有 1 位；請說明其他同行成員。';
    }
    if (p.travelType === 'oneway')
        p.end = '';
    p.lapInfantIds = p.start ? p.travelerIds.filter(id => D.age(s.persons[id], p.start) < 2) : [];
    const changed = before !== criteriaKey(criteriaFor(p));
    if (changed)
        invalidateBooking(p);
    p.title = (p.familyId ? '家庭旅行' : '我的旅行') + (p.destination ? ' · ' + p.origin + ' → ' + p.destination : '');
    return p;
}
export function invalidateBooking(p) { const b = p.booking; p.careNeeds = Object.fromEntries(Object.entries(p.careNeeds ?? {}).filter(([id]) => p.travelerIds.includes(id))); b.careSaved = Object.fromEntries(Object.entries(b.careSaved ?? {}).filter(([id]) => p.travelerIds.includes(id))); if (b.care && !p.travelerIds.includes(b.care.personId))
    b.care = Object.values(b.careSaved).at(-1); for (const c of Object.values({ ...b.careSaved, ...(b.care ? { [b.care.personId]: b.care } : {}) }))
    if (c.caregiverId && !p.travelerIds.includes(c.caregiverId))
        c.caregiverId = undefined; b.queryRevision++; b.phase = 'collecting_conditions'; for (const c of Object.values({ ...b.careSaved, ...(b.care ? { [b.care.personId]: b.care } : {}) })) {
    c.confirmed = false;
    c.seats = {};
} p.providerSearch = undefined; p.providerSelection = undefined; p.providerHandle = undefined; p.selectedFlight = undefined; p.providerError = undefined; p.providerRevision = (p.providerRevision ?? 0) + 1; }
export function bookingMissing(p) { const b = p.booking; return [!p.origin ? '出發機場' : '', !p.destination ? '目的地' : '', !p.start ? '出發日期' : '', !b.travelersConfirmed ? '實際同行成員' : '', !b.cabinConfirmed ? '艙等' : ''].filter(Boolean); }
export function samePassengers(a, b) { const key = (q) => JSON.stringify(q.passengers.map(x => [x.type, x.age ?? null]).sort()); return key(a) === key(b); }
export function queryMatches(s, p, q) { const expected = offerQuery(s, p); return ['origin', 'destination', 'outboundDate', 'returnDate', 'cabin', 'departurePeriod'].every(k => q[k] === expected[k]) && samePassengers(q, expected); }
export function caregiverChoices(s, p, pid) { return p.travelerIds.filter(id => id !== pid && D.age(s.persons[id], p.start) >= 18 && D.permitted(s, p.familyId, id, 'service')); }
export function proposeBookingCare(s, p, personId, kinds, caregiverId, replacePerson = false) {
    bookingScope(s, p);
    if (!p.selectedFlight)
        throw Error('先選擇航班，再確認本次照護安排。');
    if (!p.familyId || !p.travelerIds.includes(personId) || !D.permitted(s, p.familyId, personId, 'service') || !D.permitted(s, p.familyId, personId, 'care:edit'))
        throw Error('尚未獲授權為這位同行成員安排照護。');
    const previous = p.booking.care, stored = [...new Set(s.relationships.filter(r => r.familyId === p.familyId && r.dependentId === personId && p.travelerIds.includes(r.caregiverId) && caregiverChoices(s, p, personId).includes(r.caregiverId)).map(r => r.caregiverId))], chosen = caregiverId ?? (previous?.personId === personId ? previous.caregiverId : undefined) ?? (stored.length === 1 ? stored[0] : undefined);
    if (chosen && !caregiverChoices(s, p, personId).includes(chosen))
        throw Error('照護者須為本次已獲授權的成年同行成員。');
    if (previous && previous.personId !== personId && replacePerson) {
        p.careNeeds ??= {};
        p.careNeeds[previous.personId] = [];
        delete p.booking.careSaved?.[previous.personId];
    }
    p.booking.care = { personId, caregiverId: chosen, kinds: [...new Set(kinds)], confirmed: false, seats: {}, layoutKnown: false };
    p.booking.phase = chosen || !kinds.includes('adjacent') ? 'confirming_care' : 'collecting_care';
    p.careNeeds = { ...p.careNeeds, [personId]: kinds };
    refreshBookingSeats(s, p);
    return p;
}
export function refreshBookingSeats(s, p) {
    const c = p.booking.care;
    if (!c)
        return;
    const option = p.selectedFlight?.outbound;
    const row = EXAMPLE_CATALOG.find(r => option?.id.startsWith(r.id + ':'));
    const layout = aircraftLayout(option?.legs[0].aircraft ?? '', p.cabin);
    c.layoutKnown = !!layout.length;
    c.seats = {};
    if (row?.careServices && c.kinds.some(k => !row.careServices.includes(k)))
        throw Error('所選航班不支援這項照護條件，請更換航班；需求已保留。');
    if (!layout.length)
        return;
    const assigned = {}, pairs = s.relationships.filter(r => r.familyId === p.familyId && r.required && p.travelerIds.includes(r.dependentId) && p.travelerIds.includes(r.caregiverId)).map(r => ({ ...r }));
    for (const need of Object.values({ ...p.booking.careSaved, [c.personId]: c })) {
        if (!need.kinds.includes('adjacent'))
            continue;
        if (!need.caregiverId)
            return;
        const old = pairs.findIndex(r => r.dependentId === need.personId);
        if (old >= 0)
            pairs.splice(old, 1);
        pairs.push({ familyId: p.familyId, dependentId: need.personId, caregiverId: need.caregiverId, required: true });
    }
    const seatIds = layout.slice(0, option?.capacity ?? 0).map(x => x.id);
    const people = p.travelerIds.filter(id => D.age(s.persons[id], p.start) >= 2).sort((a, b) => pairs.filter(x => [x.caregiverId, x.dependentId].includes(b)).length - pairs.filter(x => [x.caregiverId, x.dependentId].includes(a)).length);
    const place = (n) => { if (n === people.length)
        return true; const pid = people[n]; for (const seat of seatIds) {
        if (Object.values(assigned).includes(seat))
            continue;
        assigned[pid] = seat;
        if (pairs.every(r => !assigned[r.caregiverId] || !assigned[r.dependentId] || seatsAdjacent(layout, assigned[r.caregiverId], assigned[r.dependentId])) && place(n + 1))
            return true;
        delete assigned[pid];
    } return false; };
    if (!place(0))
        throw Error('此座位佈局無法同時滿足全部同行與必要照護相鄰，請更換航班。');
    c.seats = assigned;
}
export function persistBooking(s, p, action = 'draft') {
    if (s.tripCleanup?.retired.includes(p.id))
        throw Error('此行程已移除，請建立新的行程。');
    bookingScope(s, p);
    const store = bookingStore(s), old = store.sessions[p.id], b = p.booking;
    if (!b)
        throw Error('規劃資料不存在。');
    if (old?.booking?.savedTripId)
        throw Error('這份行程已儲存，請從首頁開啟。');
    if ((old?.booking?.revision ?? 0) !== b.revision)
        throw Error('規劃已在另一頁更新，請重新載入這份草稿。');
    const next = structuredClone(p), nb = next.booking;
    next.providerLoading = false;
    nb.revision++;
    next.updatedAt = s.demoClock;
    if (action === 'care') {
        validateSnapshot(next);
        const c = nb.care;
        if (!c)
            throw Error('請先核對照護對象。');
        const arrangements = { ...nb.careSaved, [c.personId]: c };
        for (const [pid, need] of Object.entries(arrangements)) {
            if (!next.careNeeds?.[pid]?.length) {
                delete arrangements[pid];
                continue;
            }
            const checked = structuredClone(next);
            proposeBookingCare(s, checked, pid, need.kinds, need.caregiverId);
            if (need.kinds.includes('adjacent') && !need.caregiverId)
                throw Error('請選擇本次同行的照護者。');
        }
        nb.careSaved = arrangements;
        refreshBookingSeats(s, next);
        for (const r of Object.values(store.care))
            if (r.draftId === p.id && !arrangements[r.personId] && r.status === 'planning')
                r.status = 'cancelled';
        nb.careRecordIds = [];
        for (const need of Object.values(arrangements)) {
            need.confirmed = true;
            need.seats = { ...nb.care.seats };
            const id = 'booking-care:' + p.id + ':' + need.personId;
            store.care[id] = { id, draftId: p.id, accountId: p.accountId, familyId: p.familyId, personId: need.personId, caregiverId: need.caregiverId, needs: [...need.kinds], seats: { ...need.seats }, status: 'planning', updatedAt: s.demoClock };
            nb.careRecordIds.push(id);
        }
        nb.care.confirmed = true;
        nb.error = undefined;
        nb.phase = 'final_preview';
    }
    if (action === 'cancel') {
        nb.phase = 'cancelled';
        for (const r of Object.values(store.care))
            if (r.draftId === p.id && r.status === 'planning')
                r.status = 'cancelled';
    }
    for (const r of Object.values(store.care))
        if (r.draftId === p.id && r.status === 'planning' && !next.careNeeds?.[r.personId]?.length)
            r.status = 'cancelled';
    store.sessions[p.id] = next;
    return s;
}
export function bookingSummary(p) { return p.start + (p.end ? ' — ' + p.end : '') + ' · ' + p.origin + ' → ' + p.destination + ' · ' + p.travelerIds.length + ' 位旅客 · ' + (p.cabin === 'business' ? '商務艙' : '經濟艙'); }
export function saveBooking(s, p) {
    bookingScope(s, p);
    const store = bookingStore(s), b = p.booking, receipt = store.receipts[b.requestId];
    if (receipt) {
        if (receipt.accountId !== p.accountId || receipt.tripId !== p.id)
            throw Error('保存請求不屬於這份規劃。');
        return s;
    }
    const current = store.sessions[p.id];
    if (!current || current.booking.revision !== b.revision || current.booking.queryRevision !== b.queryRevision || current.booking.requestId !== b.requestId)
        throw Error('規劃版本已變更，請重新核對再儲存。');
    if (!['initial_preview', 'final_preview', 'saving'].includes(b.phase) || !p.selectedFlight || bookingMissing(p).length)
        throw Error('請先完成條件與航班選擇。');
    if (JSON.stringify(current.booking.care) !== JSON.stringify(b.care) || JSON.stringify(current.booking.careSaved) !== JSON.stringify(b.careSaved) || JSON.stringify(current.careNeeds) !== JSON.stringify(p.careNeeds))
        throw Error('照護需求已改變，請重新確認。');
    if (JSON.stringify(current.selectedFlight) !== JSON.stringify(p.selectedFlight) || criteriaKey(criteriaFor(current)) !== criteriaKey(criteriaFor(p)))
        throw Error('航班或同行人已改變，請重新預覽。');
    if (b.care) {
        if (!b.care.confirmed)
            throw Error('請先確認本次照護安排。');
        const needs = { ...b.careSaved, [b.care.personId]: b.care }, ids = b.careRecordIds;
        if (ids.length !== Object.keys(needs).length || ids.some(id => { const r = store.care[id], c = r && needs[r.personId]; return !r || !c || !c.confirmed || r.status !== 'planning' || r.accountId !== p.accountId || r.draftId !== p.id || r.caregiverId !== c.caregiverId || JSON.stringify(r.needs) !== JSON.stringify(c.kinds) || JSON.stringify(p.careNeeds?.[r.personId]) !== JSON.stringify(c.kinds); }))
            throw Error('照護安排已變更，請重新確認。');
        for (const c of Object.values(needs))
            proposeBookingCare(s, structuredClone(p), c.personId, c.kinds, c.caregiverId);
    }
    itineraryPreview(s, p);
    saveItinerary(s, p);
    if (b.care) {
        const t = s.trips[p.id];
        t.candidateSeats = { ...b.care.seats };
        for (const id of b.careRecordIds) {
            const r = store.care[id];
            if (r.caregiverId && r.needs.includes('adjacent')) {
                t.relationships = t.relationships.filter(x => x.dependentId !== r.personId);
                t.relationships.push({ familyId: p.familyId, dependentId: r.personId, caregiverId: r.caregiverId, required: true });
            }
            Object.assign(r, { status: 'linked', tripId: p.id, updatedAt: s.demoClock });
        }
    }
    const notificationId = 'booking-saved:' + b.requestId, title = '行程已儲存', text = bookingSummary(p) + ' · ' + p.selectedFlight.outbound.legs.map(l => flightLabel(l.flight)).join('、') + (b.care ? '；已記錄 ' + Object.values({ ...b.careSaved, [b.care.personId]: b.care }).map(c => displayName(s.persons[c.personId]) + '的' + c.kinds.map(k => SERVICE_LABELS[k]).join('、')).join('；') + '，服務待確認。' : '。');
    s.dual.notifications[notificationId] = { id: notificationId, accountId: p.accountId, transactionId: b.requestId, tripId: p.id, requestId: b.requestId, title, text, createdAt: s.demoClock, read: false, kind: 'booking' };
    store.receipts[b.requestId] = { requestId: b.requestId, accountId: p.accountId, tripId: p.id, notificationId, createdAt: s.demoClock };
    store.sessions[p.id] = { ...structuredClone(p), booking: { ...structuredClone(b), revision: b.revision + 1, phase: 'saved', savedTripId: p.id, notificationId } };
    return b.submitServices ? submitServiceBatch(s, p.id, batchRows(s, p.id).filter(x => ['submit', 'case'].includes(x.action)).map(x => x.r.id)) : s;
}
export { importDraftCare };
export function visibleBookingCare(s, pid) { return Object.values(s.booking?.care ?? {}).filter(r => r.familyId === s.activeFamilyId && r.status !== 'cancelled' && (!pid || r.personId === pid) && D.permitted(s, r.familyId, r.personId, 'care:view')); }
