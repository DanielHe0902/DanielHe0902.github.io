import { bookingNotice } from '/assets/b53849a26298fd713aba/product-copy.js';
import * as D from '/assets/b53849a26298fd713aba/domain.js';
import * as M from '/assets/b53849a26298fd713aba/demo.js';
import * as J from '/assets/b53849a26298fd713aba/transit.js';
import * as R from '/assets/b53849a26298fd713aba/reminders.js';
import * as F from '/assets/b53849a26298fd713aba/feedback.js';
import * as S from '/assets/b53849a26298fd713aba/sharing.js';
import * as A from '/assets/b53849a26298fd713aba/service-alternatives.js';
import { esc, chip } from '/assets/b53849a26298fd713aba/ui.js';
const button = (label, id, data = '', style = 'secondary') => `<button class="button ${style}" data-feature="${id}" ${data}>${label}</button>`;
const statuses = { planned: '待到達節點', sent: '已發送', cancelled: '已取消', merged: '已合併至較近節點', skipped: '已過期略過', pending: '待接受', accepted: '已接受', revoked: '已撤銷', expired: '已過期', submitted: '已提交體驗', processing: '獎勵核驗中', credited: '已入帳', unknown: '結果待核實', failed: '失敗可重試', capped: '已達本月上限', ineligible: '未符合資格', confirmed: '已確認', unresolved: '仍需人工跟進' };
export function reminderPanel(s, view) { if (!['preparation', 'fund'].includes(view))
    return ''; const rows = R.visibleReminders(s, view !== 'home').filter(r => view === 'fund' ? r.fundId === M.FUND : view === 'preparation' ? r.tripId === s.selectedTripId : true).sort((a, b) => b.dueAt.localeCompare(a.dueAt)); return `<section class="panel reminder-panel" id="reminder-records"><div class="section-title"><h2>${view === 'home' ? '重要通知' : '提醒記錄'}</h2>${button('通知中心', 'notifications')}</div>${rows.length ? rows.slice(0, view === 'home' ? 3 : 12).map(r => `<article class="reminder-row" data-reminder-id="${r.id}"><div><strong>${esc(r.title)}</strong><p>${esc(r.body)}</p><small>${statuses[r.status]} · ${r.node} · ${J.fullTime(r.sentAt ?? r.dueAt)} 香港時間${r.departure ? ' · 出發 ' + J.fullTime(r.departure, r.departureZone ?? 'Asia/Hong_Kong') + ' ' + (r.departureZone ?? 'Asia/Hong_Kong') : ''}</small></div>${r.status === 'sent' ? button(r.fundId ? '查看目標' : '查看準備', 'notice', `data-id="${r.id}"`) : ''}</article>`).join('') : '<p>目前沒有待查看的提醒。</p>'}<p class="meta">頁面開啟及恢復時檢查最新提醒。</p></section>`; }
export function familyInvitePanel(s) { if (!s.activeFamilyId || D.membership(s, s.activeFamilyId)?.role !== 'owner')
    return ''; return `<section class="panel compact-action"><div><h2>邀請家人</h2><p>選擇協作者或僅查看；加入家庭後仍須另行授權照護及確認同行。</p></div>${button('邀請家人', 'invite', '', '')}</section>`; }
export function feedbackPanel(s) { const j = J.currentJourney(s); if (!j)
    return ''; const e = s.feedbackRewards?.[F.feedbackKey(s, j.id)], eligible = F.feedbackEligible(s, j.id); return `<section class="panel" id="trip-feedback"><h2>分享本次出行體驗</h2><p>整趟行程完成後，實際同行會員可獲 20 Asia Miles。每人每趟一次，每月最多 100；與其他活動合計每月最多 500。</p>${e ? `<p data-feedback-status="${e.status}">${chip(statuses[e.status])} ${esc(e.reason ?? '')}</p><p>準備：${e.preparation} · 照護：${e.care} · ${e.followup}</p><p>${esc(e.text)}</p>${e.receipt ? `<small>個人普通里數 +${e.amount}</small>` : ''}` : ''}<div class="button-row">${button(e ? '編輯體驗' : '分享本次出行體驗', 'feedback', `data-trip="${j.id}" ${!eligible ? 'disabled' : ''}`)}${e && ['submitted', 'failed', 'capped'].includes(e.status) ? button(e.status === 'failed' ? '重試原獎勵請求' : '申請體驗獎勵', 'feedback-claim', `data-key="${e.key}"`, '') : e?.status === 'unknown' ? button('查詢原獎勵請求', 'feedback-query', `data-key="${e.key}"`) : ''}</div>${!eligible ? '<p class="meta">尚未符合：須本人實際同行，且本次全部航段均有完成紀錄。去程結束不代表往返結束。</p>' : ''}<p class="meta">負面體驗同樣符合活動條件。獎勵不代表服務問題已解決，不改寫航司原回執，不自動轉入基金。</p></section>`; }
export function serviceAlternativePanel(s) { const x = M.selectTrip(s); if (x.status !== 'ok' || x.kind !== 'family')
    return ''; const t = s.trips[x.id], rows = Object.values(s.requests).filter(r => r.tripId === t.id && r.tripVersion === t.version && r.evidence && D.permitted(s, r.familyId, r.personId, 'service')); if (!rows.length)
    return ''; return `<section class="panel" id="service-alternatives" data-guide-id="service-alternatives" tabindex="-1"><h2>無法滿足與後續處理</h2>${rows.map(r => { const c = A.visibleServiceCases(s, t.id).find(c => c.requestId === r.id), j = s.journeys?.items[t.id], seg = j?.segments.find(x => x.id === r.segmentId), ended = !!seg?.actualLanding || Date.parse(s.demoClock) >= Date.parse(seg?.departure ?? ''); return `<article class="service-followup"><h3>${esc(s.persons[r.personId].name)} · 兒童餐 · ${seg?.from} → ${seg?.to}</h3><p>${esc(r.evidence.reason)}</p><small>更新時間 ${J.fullTime(r.evidence.at)} 香港時間</small>${c ? `<p>跟進狀態 · ${statuses[c.status]}</p><p>${esc(c.result ?? '人工已受理，尚未確認餐食。')}</p>${button('查詢跟進結果', 'case-query', `data-id="${c.id}"`)}` : button(ended ? '查看旅後處理紀錄' : '查看替代與人工核實', 'alternative', `data-id="${r.id}" ${ended ? 'disabled' : ''}`)}<p class="meta">保留原申請；新回執另行記錄，不宣稱其他餐食符合健康需要。</p></article>`; }).join('')}</section>`; }
export function fundSharingPanel(s) { const f = s.funds[M.FUND]; if (!f)
    return ''; const owner = s.actorId === f.ownerId, canSubscribe = owner || s.festivalInvited?.[f.id]?.includes(s.actorId); return `<section class="panel" id="fund-sharing"><div class="section-title"><h2>邀請親友支持</h2>${owner ? button('建立／管理分享連結', 'fund-link') : ''}</div><p>連結只開放此目標摘要；支持者須登入及再次確認金額。支持不會自動加入家庭。</p></section><section class="panel" id="festival-settings"><h2>回家節點提醒</h2>${owner ? ['father', ...f.invited].filter((id, i, all) => id !== f.ownerId && all.indexOf(id) === i && D.account(s, id)).map(id => `<label class="check"><input type="checkbox" data-feature-toggle="allow-festival" data-person="${id}" ${s.festivalInvited?.[f.id]?.includes(id) ? 'checked' : ''}>允許${esc(s.persons[id].name)}自行訂閱此目標提醒（不代他訂閱）</label>`).join('') : ''}${canSubscribe ? R.FESTIVALS.map(node => `<label class="check"><input type="checkbox" data-feature-toggle="subscribe" data-node="${node.id}" ${s.subscriptions?.[s.actorId + ':' + f.id + ':' + node.id]?.active ? 'checked' : ''}>提醒我：${node.name} · ${J.fullTime(node.at)} 香港時間</label>`).join('') : '<p>學生尚未開放你訂閱此目標的節日提醒。</p>'}<p class="meta">提前 14／7 天提醒；可隨時取消，不會自動提供支持。</p></section>`; }
export function nextTripPanel(s) {
    const journeys = Object.values(s.journeys?.items ?? {}).filter(j => M.canReadTrip(s, j.id) && (j.familyId ? s.trips[j.id]?.members.some(m => m.personId === s.actorId) : j.ownerId === s.actorId));
    const ranked = journeys.flatMap(j => j.segments.filter(x => !x.completed).map(seg => ({ j, seg, cancelled: s.trips[j.id]?.status === 'cancelled' }))).sort((a, b) => Number(b.cancelled) - Number(a.cancelled) || Date.parse(a.seg.departure) - Date.parse(b.seg.departure));
    const next = ranked[0];
    return '<section class="panel next-actual-trip"><h2>' + (next?.cancelled ? '需要跟進的行程' : next && Date.parse(next.seg.departure) < Date.parse(s.demoClock) ? '目前旅程' : '我的下一程') + '</h2>' + (next ? '<p><strong>' + next.seg.from + ' → ' + next.seg.to + '</strong> · ' + J.fullTime(next.seg.departure) + ' 香港時間 · ' + (next.j.familyId ? '家庭旅行 · ' + s.trips[next.j.id].members.length + ' 位旅客' : '本人返校') + '</p><p>' + (next.cancelled ? '主要待辦：原航班已取消，請核對同行旅客並比較替代方案。' : next.seg.actualLanding ? '主要待辦：核對本航段紀錄及後續行程。' : '主要待辦：核對這段行程的文件、行李與服務安排。') + '</p>' + button(next.cancelled ? '處理行程變更' : '查看這段準備', 'trip', 'data-trip="' + next.j.id + '"' + (next.cancelled ? ' data-recovery="true"' : '')) : '<p>目前沒有未完成的本人行程。</p>') + '</section>';
}
export function featureSections(s, view) { if (!s.seedVersion)
    return ''; return (view === 'care' ? familyInvitePanel(s) : '') + (['preparation', 'recovery', 'journey'].includes(view) ? serviceAlternativePanel(s) : '') + (view === 'journey' ? feedbackPanel(s) : '') + (view === 'fund' ? fundSharingPanel(s) : '') + reminderPanel(s, view); }
export function featureController(h) {
    const fail = (e) => { const box = document.querySelector('#modal-error'); if (box)
        box.textContent = e.message;
    else
        h.toast(e.message); };
    const run = (fn) => void fn().catch(fail);
    const write = async (fn, bound = h.state().activeAccountId) => { if (bound !== h.state().activeAccountId)
        throw Error('帳號已切換，請重新核對'); const c = h.state(); await h.storage.write(s => { M.activateAccount(s, bound, { familyId: c.activeFamilyId, tripId: c.selectedTripId }); return fn(s); }); await h.refresh(); };
    function links(kind) {
        const s = h.state(), target = kind === 'family' ? s.activeFamilyId : M.FUND, rows = Object.values(s.shareLinks ?? {}).filter(l => l.kind === kind && l.targetId === target && l.creatorId === s.actorId), bound = s.activeAccountId;
        h.modal(kind === 'family' ? '邀請家人' : '分享回家目標', `<p>${kind === 'family' ? '接受後只建立家庭成員關係，不代授照護、证件、里數或私人行程權限，也不增加已存在行程的乘客。' : '公開內容只包含目標用途、航線、日期窗口與所需里數。'}</p>${kind === 'family' ? '<label class="field"><span>受邀角色</span><select id="new-link-role"><option value="viewer">僅查看</option><option value="editor">協作者</option></select></label>' : ''}<p class="meta">生成連結後可自行複製；沒有發送郵件或簡訊。同瀏覽器同源多標籤可用。</p>${kind === 'fund' ? `<div class="notice"><h3>公開摘要預覽</h3><p>受邀學生 · ${esc(s.funds[target].origin)} → ${esc(s.funds[target].destination)}</p><p>${esc(s.funds[target].from)} — ${esc(s.funds[target].until)} · 目標 ${s.funds[target].target.toLocaleString('en-US')} 里數</p><p>點擊建立即確認以此白名單分享，不包含個人餘額、證件或其他行程。</p></div>` : ''}${rows.map(l => `<article class="share-row"><p>${statuses[S.linkStatus(s, l)]} · ${l.role === 'editor' ? '協作者' : kind === 'family' ? '僅查看' : '基金摘要'} · 到期 ${J.fullTime(l.expiresAt)}</p><input readonly aria-label="分享連結" value="${esc(S.shareUrl(s, l, location.origin))}"><div class="button-row">${button('複製連結', 'copy-link', `data-token="${l.token}"`)}${button('分享', 'native-share', `data-token="${l.token}"`)}<a class="button secondary" href="${esc(S.shareUrl(s, l, location.origin))}" target="_blank" rel="noopener">開啟連結</a>${!['revoked', 'expired'].includes(S.linkStatus(s, l)) ? button('撤銷', 'revoke-link', `data-token="${l.token}"`) : ''}</div></article>`).join('')}`, [{ label: kind === 'family' ? '建立家庭邀請連結' : '建立新的分享連結', run: () => { const role = (document.querySelector('#new-link-role')?.value ?? 'viewer'); run(async () => { await write(s => { S.createLink(s, kind, target, role); return s; }, bound); links(kind); }); } }]);
        bind();
    }
    function feedback(tripId) { const s = h.state(), e = s.feedbackRewards?.[F.feedbackKey(s, tripId)], bound = s.activeAccountId; if (!F.feedbackEligible(s, tripId))
        throw Error('整趟行程尚未完成，或你不是實際旅客。'); h.modal('分享本次出行體驗', `<p>回報會員：${esc(s.persons[s.actorId].name)}。負面回報同樣有效；未使用服務可選不適用。</p><label class="field"><span>行前準備是否清楚</span><select id="feedback-prep">${['清楚', '不清楚'].map(v => `<option ${e?.preparation === v ? 'selected' : ''}>${v}</option>`).join('')}</select></label><label class="field"><span>照護服務體驗</span><select id="feedback-care">${['不適用／未使用', '滿意', '不滿意'].map(v => `<option ${e?.care === v ? 'selected' : ''}>${v}</option>`).join('')}</select></label><label class="field"><span>仍需跟進問題</span><select id="feedback-followup">${['沒有', '仍需跟進'].map(v => `<option ${e?.followup === v ? 'selected' : ''}>${v}</option>`).join('')}</select></label><label class="field"><span>補充（選填，最多 300 字）</span><textarea id="feedback-text" maxlength="300">${esc(e?.text ?? '')}</textarea></label><p>先保存體驗，再申請 20 里數獎勵。里數歸本人；不改寫服務回執、不自動關閉跟進。</p>`, [{ label: '保存體驗', run: () => { const val = (id) => document.getElementById(id).value, body = { preparation: val('feedback-prep'), care: val('feedback-care'), followup: val('feedback-followup'), text: val('feedback-text') }; run(async () => { await write(s => F.submitFeedback(s, tripId, body), bound); h.close(); }); } }]); }
    const handlers = {
        invite: () => links('family'), 'fund-link': () => links('fund'),
        'copy-link': el => { const s = h.state(), l = s.shareLinks[el.dataset.token]; run(async () => { await navigator.clipboard.writeText(S.shareUrl(s, l, location.origin)); h.toast('已複製可開啟的連結；尚未發送邀請。'); }); },
        'native-share': el => { const s = h.state(), url = S.shareUrl(s, s.shareLinks[el.dataset.token], location.origin); run(async () => { if (navigator.share)
            await navigator.share({ title: '國泰有期 · 受邀連結', url });
        else {
            await navigator.clipboard.writeText(url);
            h.toast('此瀏覽器不支援系統分享，已複製連結。');
        } }); },
        'revoke-link': el => run(async () => { const kind = h.state().shareLinks[el.dataset.token].kind; await write(s => S.revokeLink(s, el.dataset.token)); links(kind); }),
        trip: el => { const id = el.dataset.trip; if (!M.canReadTrip(h.state(), id))
            throw Error('無權查看此行程'); h.transition(() => { const s = h.state(); s.selectedTripId = id; s.journeys.selectedId = id; if (s.trips[id])
            s.activeFamilyId = s.trips[id].familyId; h.route(el.dataset.recovery === 'true' ? 'recovery' : 'preparation'); }); },
        'booking-notice': el => { const n = M.visibleNotifications(h.state()).find(n => n.id === el.dataset.id); if (!n)
            throw Error('這則消息不屬於目前帳號。'); run(async () => { await write(s => { const current = M.visibleNotifications(s).find(x => x.id === n.id); if (!current)
            throw Error('消息權限已變更。'); current.read = true; return s; }); h.close(); if (n.tripId) {
            const target = document.createElement('button');
            target.dataset.trip = n.tripId;
            handlers.trip(target);
            if (n.kind === 'service')
                h.screen('preparation:services');
        } }); },
        notice: el => { const r = R.visibleReminders(h.state(), true).find(x => x.id === el.dataset.id); if (!r)
            throw Error('提醒已失效或未獲授權'); run(async () => { await write(s => { s.reminders[r.id].read = true; return s; }); h.close(); if (r.tripId) {
            const el = document.createElement('button');
            el.dataset.trip = r.tripId;
            handlers.trip(el);
        }
        else
            h.route(r.fundId ? 'fund' : r.id.startsWith('content:') ? 'home' : 'care'); setTimeout(() => { const box = document.getElementById('reminder-records'); box?.classList.add('reminder-highlight'); box?.scrollIntoView({ block: 'center' }); }, 0); }); },
        notifications: () => { const s = h.state(); h.modal('通知中心', M.visibleNotifications(s).map(n => '<article class="reminder-row" data-message-id="' + esc(n.id) + '"><div><h3>' + esc(bookingNotice(s, n).title) + '</h3><p>' + esc(bookingNotice(s, n).text) + '</p><small>' + (n.read ? '已讀' : '未讀') + (n.eventId ? ' · ' + (s.flightChanges?.events[n.eventId]?.status === 'open' ? '待處理' : '已處理') : '') + '</small></div>' + (n.eventId ? '<button class="button secondary" data-flight-event="' + esc(n.eventId) + '">查看變更與安排</button>' : button(n.kind === 'service' ? '查看服務進度' : n.tripId ? '查看行程' : '標示已讀', 'booking-notice', 'data-id="' + esc(n.id) + '"')) + '</article>').join('') + R.visibleReminders(s, true).map(r => `<article class="reminder-row"><div><h3>${esc(r.title)}</h3><p>${esc(r.body)}</p><small>${statuses[r.status]} · ${J.fullTime(r.sentAt ?? r.dueAt)} 香港時間</small></div>${r.status === 'sent' ? button('查看', 'notice', `data-id="${r.id}"`) : ''}</article>`).join('') || '<p>目前沒有通知。</p>'); bind(); },
        feedback: el => feedback(el.dataset.trip),
        'feedback-claim': el => run(async () => { await write(s => F.claimFeedback(s, el.dataset.key)); }),
        'feedback-query': el => run(async () => { await write(s => F.settleFeedback(s, el.dataset.key, true)); }),
        'unavailable': () => { const s = h.state(), j = J.currentJourney(s), r = Object.values(s.requests).find(r => r.tripId === j?.id && r.tripVersion === j.version && r.kind === 'childMeal' && !r.supersededBy && !j.segments.find(seg => seg.id === r.segmentId)?.actualLanding); if (!r)
            throw Error('目前行程沒有適用的兒童餐申請'); h.modal('記錄服務結果', '<p>本航段兒童餐配額用完，將寫入不可滿足原因、規則版本及結果編號。不是未知結果，也不代表其他餐食安全適用。</p>', [{ label: '記錄結果', run: () => run(async () => { await write(s => A.simulateUnavailable(s, r.id)); h.close(); h.route('preparation'); }) }]); },
        alternative: el => { const s = h.state(), r = s.requests[el.dataset.id], bound = s.activeAccountId; h.modal('比較處理方式', `<p>${esc(r.evidence?.reason ?? '')}</p><label class="field"><span>後續處理</span><select id="service-option"><option value="recheck">人工重新核實原兒童餐配額（尚未確認）</option><option value="own-meal">詢問自行備餐的限制與可行性（不保證適用）</option></select></label><p>均保留照護條件；不自動替換為普通餐。原申請及結果保留，新工單另行受理。</p>`, [{ label: '選擇並核實', run: () => { const option = document.getElementById('service-option').value; run(async () => { await write(s => A.chooseAlternative(s, r.id, option), bound); h.close(); }); } }]); },
        'case-query': el => run(async () => { await write(s => A.followServiceCase(s, el.dataset.id)); })
    };
    function bind() { document.querySelectorAll('[data-feature]').forEach(el => { el.onclick = () => { try {
        handlers[el.dataset.feature]?.(el);
    }
    catch (e) {
        fail(e);
    } }; }); document.querySelectorAll('[data-feature-toggle]').forEach(el => { el.onchange = () => run(async () => { await write(s => el.dataset.featureToggle === 'allow-festival' ? R.allowFestival(s, el.dataset.person, el.checked) : R.subscribeFestival(s, el.dataset.node, el.checked)); }); }); }
    return { bind, feedback, links };
}
