import { requireStudent, studentCapability } from '/assets/8ff1587e8661fef5dadb/capabilities.js';
import { validateCalendarPlan } from '/assets/8ff1587e8661fef5dadb/calendar-import.js';
import * as F from '/assets/8ff1587e8661fef5dadb/flights.js';
import { airport } from '/assets/8ff1587e8661fef5dadb/web/travel.js';
import { addDays, localParts, localDeparture } from '/assets/8ff1587e8661fef5dadb/flight-time.js';
export function calendarTermKey(p) { return [p.school.trim().toLowerCase(), p.start].map(encodeURIComponent).join(':'); }
export function saveCalendarVersion(s, p) { requireStudent(s, p.personId); validateCalendarPlan(p); if (!p.saved || !p.calendarConfirmed)
    throw Error('請先核對並保存校曆。'); const a = s.dual.accounts[s.activeAccountId], term = calendarTermKey(p), id = 'calendar:' + a.memberId + ':' + term; const store = s.calendars ??= { selected: {}, versions: {} }; const versions = store.versions[id] ??= []; const fingerprint = (x) => JSON.stringify({ ...x, selected: null, checks: {}, subscribed: false }); let row = versions.at(-1); if (!row || fingerprint(row.plan) !== fingerprint(p)) {
    row = { calendarId: id, calendarVersion: (row?.calendarVersion ?? 0) + 1, ownerMemberId: a.memberId, ownerPersonId: p.personId, selectedTermId: term, academicYear: p.start.slice(0, 4), savedAt: s.demoClock, plan: structuredClone(p) };
    versions.push(row);
} store.selected[a.memberId] = id; return row; }
export function readSavedCalendar(s) { if (!studentCapability(s))
    return null; const a = s.dual?.accounts[s.activeAccountId]; if (!a)
    return null; const id = s.calendars?.selected[a.memberId], row = id ? s.calendars?.versions[id]?.at(-1) : undefined; if (row)
    return row.ownerMemberId === a.memberId && row.ownerPersonId === s.actorId ? row : null; const p = s.plans[s.actorId]; if (!p?.saved || !p.calendarConfirmed)
    return null; try {
    validateCalendarPlan(p);
}
catch {
    return null;
} return { calendarId: 'calendar:' + a.memberId + ':' + calendarTermKey(p), calendarVersion: 1, ownerMemberId: a.memberId, ownerPersonId: s.actorId, selectedTermId: calendarTermKey(p), academicYear: p.start.slice(0, 4), savedAt: '', plan: p }; }
export function calendarContext(s) { const r = readSavedCalendar(s); if (!r)
    return null; const p = r.plan; return { calendarId: r.calendarId, calendarVersion: r.calendarVersion, selectedTermId: r.selectedTermId, school: p.school, start: p.start, dorm: p.dorm, homeAirport: p.homeAirport ?? '', schoolAirport: p.destination, budget: p.budget, bags: p.bags }; }
/** Date-only school nodes stay local dates. Unknown necessary fees are not zero. */
export function rankSchoolOptions(p, options) {
    const normalized = options.map(o => o.arrivalInstant !== undefined && o.arrivalZone ? { ...o, arrivalDate: localParts(new Date(o.arrivalInstant).toISOString(), o.arrivalZone).day, arrivalTime: localParts(new Date(o.arrivalInstant).toISOString(), o.arrivalZone).time } : o);
    const valid = normalized.filter(o => o.connectionAllowed !== false && /^\d{4}-\d{2}-\d{2}$/.test(o.arrivalDate) && (p.startTime ? !!o.arrivalTime && o.arrivalDate + 'T' + o.arrivalTime < p.start + 'T' + p.startTime : o.arrivalDate < p.start));
    const price = (o) => o.baggageKnown && o.total !== null ? o.total : Infinity;
    const beforeDorm = (o) => p.dormTime ? o.arrivalDate + 'T' + (o.arrivalTime ?? '00:00') < p.dorm + 'T' + p.dormTime : o.arrivalDate < p.dorm;
    // Equal airfare is not a saving: prefer an available dorm over an avoidable stay.
    const priced = valid.filter(o => price(o) !== Infinity).sort((a, b) => price(a) - price(b) || Number(beforeDorm(a)) - Number(beforeDorm(b)) || a.stops - b.stops || a.id.localeCompare(b.id));
    const cheapest = priced[0] ?? null;
    const invalidWindow = p.dormTime && p.startTime ? p.dorm + 'T' + p.dormTime >= p.start + 'T' + p.startTime : p.dorm >= p.start;
    const conflict = !p.dorm ? '請補充並保存宿舍開放日期。' : invalidWindow ? '宿舍開放不早於到校日期，請核對住宿與報到安排。' : '';
    const stable = conflict ? [] : valid.filter(o => p.dormTime ? !!o.arrivalTime && o.arrivalDate + 'T' + o.arrivalTime >= p.dorm + 'T' + p.dormTime : o.arrivalDate >= p.dorm).sort((a, b) => a.stops - b.stops || price(a) - price(b) || a.id.localeCompare(b.id));
    return { cheapest, stablest: stable[0] ?? null, conflict, lodgingGapDays: cheapest && p.dorm && cheapest.arrivalDate < p.dorm ? Math.round((Date.parse(p.dorm) - Date.parse(cheapest.arrivalDate)) / 86400000) : 0, earlySameDay: !!(cheapest && p.dormTime && cheapest.arrivalDate === p.dorm && cheapest.arrivalTime && cheapest.arrivalTime < p.dormTime), unknownPrice: valid.some(o => !o.baggageKnown || o.total === null), same: !!cheapest && stable[0]?.id === cheapest.id };
}
/** Only reviewed file times matching the chosen saved dates are constraints. */
export function schoolWindow(c, p) {
    const zone = airport(c.destination)?.zone ?? 'Asia/Hong_Kong', r = c.calendarImport;
    const time = (kind, date, field) => {
        if (!r?.reviewed || r.choices[field] === 'existing')
            return undefined;
        const e = r.events.find(e => e.scope === r.scope && e.kind === kind && e.start === date && !e.issue && e.dateType === 'date-time' && e.startTime);
        if (!e)
            return undefined;
        if (!e.timezone)
            throw Error('校曆含具體時間但未提供時區，請先核對後再比較航程。');
        return localParts(localDeparture(e.start, e.startTime, c.destination, e.timezone), zone);
    };
    const d = time('dorm', c.dorm, 'dorm'), start = time('teaching', c.start, 'start');
    const window = { dorm: d?.day ?? c.dorm, dormTime: d?.time, start: start?.day ?? c.start, startTime: start?.time, bags: c.bags };
    const limits = p.constraints;
    if (limits?.reportBy && limits.reportBy < window.start + 'T' + (window.startTime ?? '00:00')) {
        window.start = limits.reportBy.slice(0, 10);
        window.startTime = limits.reportBy.slice(11, 16);
    }
    if (limits?.dormOpen && limits.dormOpen > window.dorm + 'T' + (window.dormTime ?? '00:00')) {
        window.dorm = limits.dormOpen.slice(0, 10);
        window.dormTime = limits.dormOpen.slice(11, 16);
    }
    return { ...window, zone };
}
export function schoolStrategies(s, p) {
    const saved = readSavedCalendar(s);
    if (!saved)
        throw Error('請先核對並保存本人的校曆。');
    const c = saved.plan, window = schoolWindow(c, p);
    if (!c.dorm)
        throw Error('已讀取校曆；請補充並保存宿舍開放日期。');
    if (window.start <= localParts(new Date().toISOString(), window.zone).day)
        throw Error('所選學期的開學日已過，請明確選擇適用學期。');
    const conflict = rankSchoolOptions(window, []).conflict;
    if (conflict)
        throw Error(conflict);
    const from = p.start || addDays(window.dorm, -7), until = p.start || addDays(window.start, window.startTime ? 0 : -1);
    if ((Date.parse(until) - Date.parse(from)) / 86400000 > 45)
        throw Error('請先確認較窄的出發日期範圍（最多 45 日）。');
    const options = [];
    for (let date = from; date <= until; date = addDays(date, 1)) {
        const q = F.criteriaFor({ ...p, start: date, end: '', travelType: 'oneway', bags: c.bags });
        options.push(...F.searchFlights(q).outbound.filter(o => !p.directOnly || o.legs.length === 1));
    }
    const buffer = p.constraints ? p.constraints.immigrationMinutes + p.constraints.baggageMinutes + p.constraints.transportMinutes : 0;
    if (!Number.isFinite(buffer) || buffer < 0)
        throw Error('請核對通關、行李與交通估算。');
    const rows = options.map(option => {
        const last = option.legs.at(-1), arrivalInstant = last.arrival ? Date.parse(last.arrival) + buffer * 60000 : undefined;
        const checks = F.checkConstraints(option, p.constraints);
        return { id: option.id, arrivalDate: last.arrivalLocal?.day ?? '', arrivalTime: last.arrivalLocal?.time, arrivalInstant, arrivalZone: window.zone, total: option.total, baggageKnown: option.includedBags !== null && (option.includedBags >= c.bags || option.baggageCost !== null), stops: option.legs.length - 1, connectionAllowed: !checks.notes.some(n => /報到|接機|時段偏好/.test(n)), option };
    });
    return { calendar: calendarContext(s), window, buffer, from, until, ...rankSchoolOptions(window, rows) };
}
export function selectSchoolStrategy(s, p, id) { const result = schoolStrategies(s, p), chosen = [result.cheapest, result.stablest].find(o => o?.id === id)?.option; if (!chosen)
    throw Error('方案或校曆已更新，請重新比較。'); const next = { ...p, start: chosen.date, end: '', travelType: 'oneway', bags: result.calendar.bags, flightSource: 'simulation' }; next.flightSearch = F.searchFlights(F.criteriaFor(next)); return F.selectFlight(next, id, 'outbound'); }
