import { tripDecision, cancellationRecord } from './trip-decision.js';
import { candidateGroups, candidateContent, otherCandidates } from './recovery-presentation.js';
import { flightLabel } from './passport-visual.js';
import * as D from './domain.js';
import { esc, btn } from './ui.js';
export const candidateStatus = { available: '可供選擇', 'pending-services': '可選擇 · 部分服務待確認', verify: '必要條件待核實', unavailable: '不可選擇' };
export function assignmentList(s, c) { return `<div class="seat-pairs">${Object.entries(c.evaluation?.assignments ?? {}).sort((a, b) => a[1].localeCompare(b[1], undefined, { numeric: true })).map(([id, seat]) => `<span data-seat-person="${esc(id)}">${esc(seat)} ${esc(s.persons[id]?.displayName ?? s.persons[id]?.name ?? '同行旅客')}</span>`).join('')}</div>`; }
export function recoveryPanel(s, t) {
    if (tripDecision(s, t.id).cancelled)
        return cancellationRecord(s, t.id);
    const cs = D.candidates(s, t), groups = candidateGroups(cs), write = D.membership(s, t.familyId)?.role !== 'viewer';
    if (t.status !== 'cancelled')
        return `<section class="panel" data-guide-id="recovery-candidates" data-trip-state="${t.status === 'changed' ? 'resolved' : 'normal'}"><h2>${t.status === 'changed' ? '新行程已建立' : '目前沒有待處理的行程變更'}</h2><p>${esc(flightLabel(t.route.number))} · ${t.route.date} ${t.route.departure} → ${t.route.arrival}</p><button class="button secondary" data-service-assistant="${t.id}">查看本航段服務</button></section>`;
    return `<section class="original-flight"><h2>原航班已取消</h2><p>${esc(flightLabel(t.route.number))} · ${t.route.date} · ${t.route.origin} → ${t.route.destination} · ${t.route.departure} → ${t.route.arrival}</p><p>小期已為你整理其他航班，並重新檢查全家的照護安排。</p></section><section data-guide-id="recovery-candidates" tabindex="-1"><h2>替代航班 · 先比較，再確認</h2><div class="demo-candidate-grid">${groups.primary.map((c, i) => `<article class="panel demo-candidate" data-candidate="${c.id}" data-evaluation="${c.evaluation.status}">${candidateContent(s, c, i)}${c.eligible && write ? btn('選擇方案 ' + (i + 1), 'rebook', `data-candidate="${c.id}"`, 'full') : '<button class="button full" disabled>不符合本次必要條件</button>'}</article>`).join('')}</div>${otherCandidates(groups.other)}</section>`;
}
