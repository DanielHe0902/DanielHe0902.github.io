import { tripForChange, canChange, changeTitle, changeSummary, eventCandidates, migrationRows, confirmChange, refundPreview, confirmRefund } from '/assets/5c5eb8250e82e8e3ffd2/flight-change.js';
import { esc, icon, money } from '/assets/5c5eb8250e82e8e3ffd2/ui.js';
import { SERVICE_LABELS } from '/assets/5c5eb8250e82e8e3ffd2/config.js';
import { tripDemand } from '/assets/5c5eb8250e82e8e3ffd2/recovery.js';
import { candidateGroups, candidateContent, otherCandidates, passengerSeats } from '/assets/5c5eb8250e82e8e3ffd2/recovery-presentation.js';
export function flightChangeController(h) {
    let claiming = false;
    let eventId = '', accountId = '', branch = 'start', chosen = '', busy = false, error = '', popupId = '';
    const tabId = crypto.randomUUID();
    const current = () => { const e = h.state().flightChanges?.events[eventId]; return e && accountId === h.state().activeAccountId && canChange(h.state(), e) ? e : null; };
    async function open(id) { const e = h.state().flightChanges?.events[id]; if (!e || !canChange(h.state(), e))
        throw Error('此變更不在目前帳號的授權範圍。'); eventId = id; accountId = h.state().activeAccountId; branch = 'start'; chosen = ''; error = ''; popupId = ''; await h.write(s => { for (const n of Object.values(s.dual?.notifications ?? {}))
        if (n.eventId === id && n.accountId === accountId)
            n.read = true; return s; }); if (eventId !== id || accountId !== h.state().activeAccountId)
        return; h.open(e); }
    function panel() {
        const e = current();
        if (!e)
            return '';
        const s = h.state(), t = tripForChange(s, e.tripId), d = tripDemand(t), write = canChange(s, e, true), btn = (text, action, attrs = '', disabled = false) => `<button type="button" class="button ${action === 'back' ? 'secondary' : ''}" data-change-action="${action}" ${attrs} ${disabled || busy ? 'disabled' : ''}>${text}</button>`, summary = `${d.travellerCount} 位旅客 · ${d.requiredSeatCount} 個獨立座位`;
        let body = '';
        if (e.status !== 'open')
            body = `<h3>${e.status === 'rebooked' ? '行程已更新' : e.status === 'refund-processing' ? '行程取消 · 退票處理中' : '行程取消'}</h3><p>${e.status === 'rebooked' ? '已帶入原照護需求；新航段輪椅、餐食及座位安排須等待獨立回執。' : e.status === 'refund-processing' ? '正在處理；最終金額與退回時間待確認。' : '此段行程已由你取消，紀錄已保留。'}</p>${e.refund ? '<p>退票申請已記錄，等待處理結果。</p>' : ''}<button class="button secondary" data-view="preparation">查看行程與服務進度</button>`;
        else if (branch === 'start' || !write)
            body = `<p>我已帶入本次同行名單與照護需求。你想怎樣安排？</p><div class="button-row">${btn('比較全家同行航班', 'rebook', '', !write)}${btn(e.order?.paid ? '查看退票安排' : '取消這段計劃', 'refund', '', !write)}</div>${write ? '' : '<p>請由家庭管理員或獲授權成員辦理。</p>'}`;
        else if (branch === 'refund') {
            const p = refundPreview(s, e.id);
            body = `<h3>${p.paid ? '核對退票申請' : '核對取消計劃'}</h3><p>範圍：${e.before.departureDate} ${e.before.origin} → ${e.before.destination}，${p.passengers} 位旅客。其他航段維持原安排。</p>${p.paid ? `<dl class="change-facts"><div><dt>原航段金額</dt><dd>${esc(p.currency)} ${e.order.affectedAmount.toLocaleString()}</dd></div><div><dt>手續費</dt><dd>${p.fee === null ? '待核實' : money(p.fee)}</dd></div><div><dt>預計退回</dt><dd>${p.amount === null ? '待核實' : money(p.amount)}</dd></div></dl><p>提交後進入處理中。最終金額、原付款方式及退回時間待確認。</p>` : '<p>這是未付款的行程計劃，沒有退款金額。</p>'}<div class="button-row">${btn(p.paid ? '確認提交退票申請' : '確認取消這段計劃', 'confirm-refund', `data-fingerprint="${esc(p.fingerprint)}"`)}${btn('返回比較', 'back')}</div>`;
        }
        else {
            const cs = eventCandidates(s, e), c = cs.find(c => c.id === chosen);
            if (c) {
                const rows = migrationRows(s, e, c);
                body = `<h3>照護資料已帶入，請核對新安排</h3>${flight(c)}<p>${summary}</p><div class="change-migration">${rows.map(r => `<article><strong>${esc(s.persons[r.personId]?.name)} · ${esc(SERVICE_LABELS[r.kind] ?? r.kind)}</strong><p>${r.caregiverId ? '照護者：' + esc(s.persons[r.caregiverId]?.name) + ' · ' : ''}${r.status === 'unavailable' ? '此機型不提供' : r.status === 'verify' ? '需人工核實' : '資料已帶入，待新航段回執'}</p></article>`).join('')}<article><strong>照護者相鄰座位</strong>${passengerSeats(s, c)}</article></div><p>參考差額 ${c.feeKnown ? money(c.difference) : '待核實'}；最終票價與適用費用待確認。</p><div class="button-row">${btn('確認更新行程', 'confirm', `data-candidate="${c.id}" data-fingerprint="${esc(c.evaluation.fingerprint)}"`, !c.eligible)}${btn('重新選擇', 'back')}</div>`;
            }
            else {
                const groups = candidateGroups(cs);
                body = `<h3>全家同行，照護不中斷</h3><p>${d.travellerCount} 位旅客；保留本次照護需求，先比較機型與時間。</p>${cs.some(c => c.evaluation?.services.some(x => x.kind === 'bassinet')) ? '<p>較早的 Airbus A321neo 不提供嬰兒籃；較晚的適用機型可繼續提出申請，供應仍待確認。</p>' : ''}<div class="change-candidates">${groups.primary.map((c, i) => `<article class="change-candidate" data-change-candidate="${c.id}">${candidateContent(s, c, i)}${btn(c.eligible ? '選擇並核對照護' : '不符合本次必要照護需求', 'select', `data-candidate="${c.id}"`, !c.eligible)}</article>`).join('')}</div>${otherCandidates(groups.other)}${!cs.some(c => c.eligible) ? '<p>目前沒有符合本次必要條件的航班，請保留需求並核實其他安排。</p>' : ''}${btn('返回變更選項', 'back')}`;
            }
            ;
        }
        return `<section class="flight-change-task" data-flight-change-task="${esc(e.id)}"><div class="section-title"><h2>${changeTitle(e)}</h2><button type="button" class="text-link" data-change-action="leave">${e.status === 'open' ? '稍後處理' : '返回助手'}</button></div><div class="original-flight"><strong>${e.type === 'cancel' ? '原航班已取消' : '原航班有變更'}</strong><p>${esc(changeSummary(e))} · ${e.before.departure} → ${e.before.arrival}</p></div>${e.bassinetConfirmationRequired && e.status === 'open' ? '<p class="notice">已保留先確認嬰兒籃供應再改簽的條件。目前尚未取得新航班的名額確認，暫不能提交改簽。</p>' : ''}${body}${error ? `<p role="alert" class="error">${esc(error)}</p>` : ''}${busy ? '<p role="status">正在保存安排…</p>' : ''}</section>`;
    }
    function flight(c) { const leg = c.route.segments[0]; return `<div class="change-flight"><strong>${esc(c.route.number.replace('CX-DEMO', 'CX'))} · ${esc(leg.aircraft)}</strong><p>${leg.origin} ${leg.departureDate} ${leg.departure} → ${leg.destination} ${leg.arrivalDate} ${leg.arrival}</p><small>出發與抵達均為機場當地時間 · ${esc(c.cabin ?? 'economy') === 'business' ? '商務艙' : '經濟艙'}</small></div>`; }
    function text(value) { if (!current() || current().status !== 'open')
        return false; if (/(?:必須|必须|先).*(?:確認|确认).*(?:嬰兒籃|婴儿篮|名額|名额)|confirm.*bassinet.*before/i.test(value)) {
        const id = current().id;
        void h.write(s => { if (!canChange(s, s.flightChanges.events[id], true))
            throw Error('目前沒有修改安排的權限。'); s.flightChanges.events[id].bassinetConfirmationRequired = true; return s; }).then(() => { branch = 'rebook'; chosen = ''; error = '已保留必須先確認嬰兒籃供應的條件。目前尚未取得對應新航班的確認，暫不能提交改簽。'; h.render(); }).catch(e => { error = e.message; h.render(); });
        return true;
    } if (!canChange(h.state(), current(), true)) {
        error = '請由獲授權家庭成員辦理。';
        h.render();
        return true;
    } if (/退票|退款|refund|取消/i.test(value)) {
        branch = 'refund';
        chosen = '';
    }
    else if (/改簽|改签|航班|同行|rebook|flight/i.test(value)) {
        branch = 'rebook';
        chosen = '';
    }
    else if (/稍後|稍后|later/.test(value)) {
        eventId = '';
    }
    else {
        error = '請選擇航班或退票安排；正式變更前會再讓你核對確認。';
    } h.render(); return true; }
    async function action(el) { const e = current(); if (!e)
        return; const a = el.dataset.changeAction; error = ''; if (a === 'leave') {
        eventId = '';
        h.render();
        return;
    } if (e.status !== 'open')
        return; if (a === 'rebook' || a === 'refund') {
        branch = a;
        chosen = '';
        h.render();
        return;
    } if (a === 'select') {
        if (!eventCandidates(h.state(), e).find(c => c.id === el.dataset.candidate)?.eligible)
            return;
        chosen = el.dataset.candidate;
        h.render();
        return;
    } if (a === 'back') {
        if (chosen)
            chosen = '';
        else
            branch = 'start';
        h.render();
        return;
    } if (busy)
        return; busy = true; h.render(); try {
        await h.write(s => a === 'confirm-refund' ? confirmRefund(s, e.id, el.dataset.fingerprint) : confirmChange(s, e.id, el.dataset.candidate, el.dataset.fingerprint));
    }
    catch (err) {
        error = err.message;
    }
    finally {
        busy = false;
        h.render();
    } }
    function bind() { document.querySelectorAll('[data-flight-event]').forEach(el => el.onclick = () => void open(el.dataset.flightEvent).catch(e => h.toast(e.message))); document.querySelectorAll('[data-change-action]').forEach(el => el.onclick = () => void action(el)); document.querySelectorAll('[data-change-dismiss]').forEach(el => el.onclick = () => { popupId = ''; const wrapper = el.closest('[data-modal-flight-change]'); if (wrapper)
        wrapper.remove();
    else if (el.closest('dialog'))
        document.querySelector('#cancel-modal')?.click(); h.render(); }); }
    async function claimPopup() {
        const active = () => document.visibilityState === 'visible' && document.hasFocus();
        if (claiming || !active() || popupId)
            return;
        const available = (e) => !e.popupClaim || !e.popupVisibleAt && Date.now() - Date.parse(e.popupClaim.at) > 2000;
        const s = h.state(), e = Object.values(s.flightChanges?.events ?? {}).find(e => e.status === 'open' && available(e) && canChange(s, e, true));
        if (!e)
            return;
        claiming = true;
        const account = s.activeAccountId;
        let claimed = false;
        try {
            await h.write(current => { const event = current.flightChanges?.events[e.id]; if (active() && h.state().activeAccountId === account && event && available(event) && canChange(current, event, true)) {
                event.popupClaim = { accountId: account, tabId, at: new Date().toISOString() };
                claimed = true;
            } return current; }, false);
            if (!claimed)
                return;
            if (!active() || h.state().activeAccountId !== account) {
                await h.write(s => { const event = s.flightChanges?.events[e.id]; if (event?.popupClaim?.tabId === tabId && !event.popupVisibleAt)
                    delete event.popupClaim; return s; }, false);
                return;
            }
            // Choose the modal host before rendering the page so one event never has two popups.
            popupId = e.id;
            const html = popup();
            h.showPopup?.(e, html);
            h.render();
            const visible = Date.now();
            await h.write(s => { const event = s.flightChanges?.events[e.id]; if (event?.popupClaim?.tabId === tabId)
                event.popupVisibleAt ??= visible; return s; }, false);
            return true;
        }
        finally {
            claiming = false;
        }
    }
    function popup() { if (document.querySelector('dialog[open] .flight-change-popup'))
        return ''; const e = h.state().flightChanges?.events[popupId]; if (!e || !canChange(h.state(), e) || e.status !== 'open')
        return ''; return `<aside class="flight-change-popup" role="status" aria-live="polite"><div class="section-title">${icon('bell')}<strong>${changeTitle(e)}</strong></div><p>${esc(changeSummary(e))}</p><div class="button-row"><button class="button" data-flight-event="${esc(e.id)}">查看變更與安排</button><button class="text-link" data-change-dismiss>稍後處理</button></div></aside>`; }
    return { panel, text, bind, popup, claimPopup, open, dismissPopup: () => { popupId = ''; }, reset: () => { eventId = ''; popupId = ''; } };
}
