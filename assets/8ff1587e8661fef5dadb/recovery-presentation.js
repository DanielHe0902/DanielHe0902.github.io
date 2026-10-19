import { normalizeAircraft } from '/assets/8ff1587e8661fef5dadb/aircraft-care.js';
import { flightLabel } from '/assets/8ff1587e8661fef5dadb/passport-visual.js';
import { esc, money } from '/assets/8ff1587e8661fef5dadb/ui.js';
/** Explicit allowlist: internal inventory, reasons and fingerprints never enter passenger/model text. */
export function passengerCandidate(c) {
    const e = c.evaluation, type = normalizeAircraft(c.route.aircraft), bassinet = e.services.find(x => x.kind === 'bassinet');
    const complete = !!type && e.availableSeatCount !== null;
    const seated = Object.values(e.assignments), together = complete && seated.length === e.requiredSeatCount && new Set(seated).size === seated.length && e.pairs.every(p => p.result === 'pass') && e.availableSeatCount >= e.requiredSeatCount;
    return { id: c.id, flight: flightLabel(c.route.number), aircraft: type ? 'Airbus ' + type : '機型待確認', complete, eligible: c.eligible, travellers: e.travellerCount,
        together: together ? '符合目前同行條件' : '暫未能確認全家同行安排',
        conflict: bassinet?.status === 'unavailable', care: bassinet?.status === 'unavailable' ? '此機型不提供嬰兒籃' : bassinet?.status === 'verify' ? '嬰兒籃適用性待核實' : bassinet ? '可申請嬰兒籃，待確認供應' : e.services.length ? '照護資料可帶入，服務待確認' : '可繼續核對座位安排',
        fee: c.feeKnown ? money(c.difference) : '待核實' };
}
export function candidateGroups(cs) { return { primary: cs.filter(c => passengerCandidate(c).complete).slice(0, 2), other: cs.filter(c => !passengerCandidate(c).complete) }; }
export function passengerSeats(s, c) { return `<details class="candidate-seats"><summary>查看座位安排</summary><p>${Object.entries(c.evaluation?.assignments ?? {}).map(([pid, seat]) => esc(s.persons[pid]?.displayName ?? s.persons[pid]?.name ?? '同行旅客') + ' ' + esc(seat)).join(' · ')}</p><p class="meta">候選安排，座位仍待確認。</p></details>`; }
export function candidateContent(s, c, index = 0) { const p = passengerCandidate(c), l = c.route.segments[0]; return `<h3>${index === 0 ? '較早出發' : '較晚出發'}</h3><p>${esc(p.flight)} · ${esc(l.departureDate)}</p><div class="candidate-time"><strong>${esc(l.departure)}</strong><span>→</span><strong>${esc(l.arrival)}</strong></div><p>${esc(l.origin)} → ${esc(l.destination)} · ${esc(l.arrivalDate)}</p><p class="meta">出發與抵達均為當地時間</p><p class="candidate-aircraft">${esc(p.aircraft)}</p><p>全家同行：${p.together}</p><div class="${p.conflict ? 'notice warning' : 'candidate-care'}"><strong>${p.care}</strong>${p.conflict ? '<p>你的行程已包含嬰兒籃需求，這班航班無法延續此項安排。請選擇支援嬰兒籃的航班，保留照護需求。</p>' : ''}</div><p>參考差額：${p.fee}</p>${passengerSeats(s, c)}`; }
export function otherCandidates(cs) { return cs.length ? `<details class="other-candidates"><summary>其他待核實航班</summary>${cs.map(c => `<p>${esc(flightLabel(c.route.number))} · ${esc(c.route.date)} · 暫未能確認此班機是否適合全家同行，請查看其他航班。</p>`).join('')}</details>` : ''; }
