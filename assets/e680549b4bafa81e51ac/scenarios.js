import * as M from '/assets/e680549b4bafa81e51ac/demo.js';
import * as D from '/assets/e680549b4bafa81e51ac/domain.js';
import * as J from '/assets/e680549b4bafa81e51ac/transit.js';
import { STORY } from '/assets/e680549b4bafa81e51ac/story.js';
import { FESTIVALS } from '/assets/e680549b4bafa81e51ac/reminders.js';
import { esc } from '/assets/e680549b4bafa81e51ac/ui.js';
import { providerMode, providerLabel } from '/assets/e680549b4bafa81e51ac/provider.js';
export const DemoScenarioRegistry = [
    { id: 'family-normal', label: '家庭出行：正常準備', account: M.PARENT_ACCOUNT, trip: M.FAMILY_TRIP, mode: 'normal' },
    { id: 'family-cancel', label: '家庭出行：航班取消，有可行替代', account: M.PARENT_ACCOUNT, trip: M.FAMILY_TRIP, mode: 'exception' },
    { id: 'family-none', label: '家庭出行：無可行候選（進階）', account: M.PARENT_ACCOUNT, trip: M.FAMILY_TRIP, mode: 'exception' },
    { id: 'student-normal', label: '學生返校：正常準備', account: M.STUDENT_ACCOUNT, trip: M.STUDENT_TRIP, mode: 'normal' },
    { id: 'student-delay', label: '學生返校：接機／入住受影響', account: M.STUDENT_ACCOUNT, trip: M.STUDENT_TRIP, mode: 'exception' },
    { id: 'student-gate', label: '學生轉機：登機口變更', account: M.STUDENT_ACCOUNT, trip: M.STUDENT_TRIP, mode: 'normal' },
    { id: 'family-arrival', label: '家庭：抵達與旅後跟進', account: M.PARENT_ACCOUNT, trip: M.FAMILY_TRIP, mode: 'normal' },
    { id: 'student-arrival', label: '學生：抵達與旅後跟進', account: M.STUDENT_ACCOUNT, trip: M.STUDENT_TRIP, mode: 'normal' }
];
export function loadScenario(state, id, restore = false) {
    let s = D.clone(state);
    const def = DemoScenarioRegistry.find(x => x.id === id);
    if (!def)
        throw Error('未知場景');
    if (s.activeAccountId !== def.account)
        throw Error('請先確認切換至場景指定帳號');
    if (s.scenario?.id === id && !restore)
        return s;
    const t = s.trips[def.trip], j = s.journeys?.items[def.trip];
    if (!j || !M.canReadTrip(s, def.trip))
        throw Error('場景行程不存在或未獲授權');
    if (Date.parse(s.demoClock) >= Date.parse(t ? STORY.out : STORY.schoolFlight) || j.segments.some(x => x.actualLanding))
        throw Error('此空間已推進至出行階段，請建立隔離沙盒重新載入；原帳務與飛行歷史會保留。');
    s.selectedTripId = def.trip;
    s.journeys.selectedId = def.trip;
    if (t)
        s.activeFamilyId = t.familyId;
    s.storyHistory ??= {};
    s.storyHistory['scenario:' + id + ':v' + j.version + ':' + s.demoClock] = structuredClone({ trip: t, journey: j });
    if (t) {
        s = M.setScene(s, def.mode);
        s.trips[t.id].noCandidates = id === 'family-none';
    }
    else {
        // Restore the known direct return leg before optionally loading a transfer variant.
        if (j.segments.length > 1) {
            j.segments = [structuredClone(j.segments.at(-1))];
            j.segments[0].from = 'HKG';
        }
        const draft = j.draft;
        s = M.setScene(s, def.mode);
        if (draft)
            s.journeys.items[def.trip].draft = draft;
        const next = s.journeys.items[def.trip];
        if (id === 'student-gate') {
            const last = next.segments[0];
            Object.assign(last, { id: next.id + '-v' + next.version + '-s1', departure: STORY.delayedFlight, estimatedArrival: STORY.delayedArrival, gate: '24', terminal: 'T1', boardingStart: '2027-01-18T05:10:00Z', latestGate: '2027-01-18T05:30:00Z' });
            next.segments.unshift({ id: next.id + '-v' + next.version + '-s0', flight: 'CX-DEMO 301', from: 'PVG', to: 'HKG', zone: 'Asia/Hong_Kong', departure: '2027-01-18T00:00:00Z', scheduledArrival: '2027-01-18T02:30:00Z', estimatedArrival: '2027-01-18T02:30:00Z', aircraft: 'A330', terminal: 'T1', gate: '22', updatedAt: s.demoClock });
            next.walkMinutes = 12;
            next.securityMinutes = 15;
            next.reserveMinutes = 10;
        }
    }
    s = M.syncFamilyJourney(s);
    s.scenario = { id, tripId: def.trip, loadedAt: s.demoClock, log: [...(s.scenario?.log ?? []).slice(-14), '載入 ' + def.label + ' · ' + s.demoClock] };
    return s;
}
export function canAdvance(s) { const j = J.currentJourney(s); if (!j)
    return '請先選擇可訪問的行程'; if (s.trips[j.id]?.status === 'cancelled')
    return '原航班已取消，先選擇並確認替代方案'; if (j.familyId ? D.membership(s, j.familyId)?.role === 'viewer' : j.ownerId !== s.actorId)
    return '目前帳號沒有推進此行程的授權'; if (j.segments.every(x => x.completed))
    return '整趟行程已完成'; return ''; }
export function consolePanel(s, playing) {
    const j = J.currentJourney(s), t = j ? s.trips[j.id] : undefined, reason = canAdvance(s), count = t?.members.length ?? (j ? 1 : 0), seats = t?.members.filter(m => m.occupiesSeat).length ?? (j ? 1 : 0), before = !!j && Date.parse(s.demoClock) < Date.parse(j.segments[0].departure) && !j.segments.some(x => x.actualLanding);
    return `<aside id="demo-console" class="demo-controls" aria-label="統一演示控制台"><div class="section-title"><h2>演示控制</h2><button class="button ghost" data-action="demo" aria-label="收起演示控制">收起 ×</button></div><p>關閉面板不會暫停播放。當前：<strong data-play-state>${playing ? '播放中' : '已暫停'}</strong> · 模擬資料</p><details open data-disclosure="console-scenarios"><summary>場景</summary><label class="field"><span>選擇要載入的場景</span><select id="scenario-select">${DemoScenarioRegistry.map(x => `<option value="${x.id}" ${s.scenario?.id === x.id ? 'selected' : ''}>${x.label}</option>`).join('')}</select></label><button class="button secondary" data-scenario-load>預覽並載入場景</button><p class="meta">載入前會核對目標身份與行程；只瀏覽頁面不注入事件。</p></details><details open data-disclosure="console-time"><summary>時間與事件</summary><p>${J.fullTime(s.demoClock)} · Asia/Hong_Kong</p>${j ? `<p>航段：${j.segments.find(x => !x.actualLanding)?.from ?? '完成'} → ${j.segments.find(x => !x.actualLanding)?.to ?? ''}；目的地 ${j.segments.find(x => !x.actualLanding)?.zone ?? ''}</p>` : ''}<div class="button-row"><button class="button" data-event-next ${reason ? 'disabled' : ''}>單步事件</button><button class="button secondary" data-event-play ${reason && !playing ? 'disabled' : ''}>${playing ? '暫停播放' : '播放事件'}</button><button class="button secondary" data-event-clock ${!j ? 'disabled' : ''}>時鐘 +5 分鐘</button></div>${reason ? '<p class="meta">' + esc(reason) + '</p>' : ''}${before ? `<div class="button-row"><button class="button secondary" data-feature="clock" data-hours="72" ${Date.parse(j.segments[0].departure) - 72 * 3600000 < Date.parse(s.demoClock) ? 'disabled' : ''}>前往 72 小時節點</button><button class="button secondary" data-feature="clock" data-hours="24" ${Date.parse(j.segments[0].departure) - 24 * 3600000 < Date.parse(s.demoClock) ? 'disabled' : ''}>前往 24 小時節點</button>${t && s.actorId === 'father' ? '<button class="button secondary" data-feature="unavailable">模擬兒童餐無法滿足</button>' : ''}</div>` : ''}<p>早於目前時鐘的節點不可重播。服務回執與旅後反饋仍在原業務頁確認，控制台不代為批准或領獎。</p><details data-disclosure="console-festivals"><summary>基金節日時間（進階）</summary><div class="button-row">${FESTIVALS.map(x => `<button class="button secondary" data-feature="festival-clock" data-node="${x.id}" data-days="14">${x.name} 14 天前</button><button class="button secondary" data-feature="festival-clock" data-node="${x.id}" data-days="7">7 天前</button>`).join('')}</div></details></details><details data-disclosure="console-state"><summary>狀態與進階</summary><p>${esc(s.persons[s.actorId].name)} · ${esc(j?.id ?? '尚未選擇行程')} · v${j?.version ?? '—'}</p><p>${count} 位旅客 / ${seats} 個座位</p><p>助手 ${providerMode} · ${esc(providerLabel)}；行程資料 mock（唯讀）</p><label class="field"><span>模擬服務回執模式</span><select id="mock-mode">${[['success', '成功受理'], ['delay', '延遲 8 秒'], ['timeout', '逾時待核實'], ['failure', '失敗待重試']].map(([v, l]) => `<option value="${v}" ${s.mockMode === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label><div class="button-row"><button class="button secondary" data-event-reset>恢復目前場景</button><button class="button secondary" data-demo-sandbox>建立全新隔離沙盒</button></div><p>恢復不清空餘額、支持、邀請、授權及獎勵；已飛的場景請在新沙盒重播。</p><button class="button ghost" data-demo-action="text-repair">文字資料檢查</button><details data-disclosure="console-ledger-reset"><summary>清除本空間支持測試（另行確認）</summary><p>只供需重新測試支持交易的隔離空間；不屬於「恢復目前場景」。</p><button class="button ghost" data-demo-action="reset-support">預覽清除本空間支持交易</button></details><details data-disclosure="console-logs"><summary>測試日誌</summary><ol>${(s.scenario?.log ?? []).map(x => '<li>' + esc(x) + '</li>').join('')}${(s.journeys?.log ?? []).filter(x => M.canReadTrip(s, x.event.tripId)).slice(-12).reverse().map(x => '<li>' + esc(x.event.kind + ' · ' + x.result + ' · ' + x.event.occurredAt) + '</li>').join('') || '<li>尚無事件</li>'}</ol></details></details></aside>`;
}
