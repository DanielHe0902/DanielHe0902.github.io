import { bindFamilyTasks } from '/assets/5c5eb8250e82e8e3ffd2/task-center-ui.js';
import { readableTrip } from '/assets/5c5eb8250e82e8e3ffd2/service-ui.js';
import * as L from '/assets/5c5eb8250e82e8e3ffd2/learning.js';
import * as D from '/assets/5c5eb8250e82e8e3ffd2/domain.js';
import { message } from '/assets/5c5eb8250e82e8e3ffd2/messages.js';
import * as M from '/assets/5c5eb8250e82e8e3ffd2/demo.js';
import * as J from '/assets/5c5eb8250e82e8e3ffd2/transit.js';
import { availableMiles } from '/assets/5c5eb8250e82e8e3ffd2/fund.js';
import { esc } from '/assets/5c5eb8250e82e8e3ffd2/ui.js';
export function demoController(h) {
    const amountKey = () => 'cx2-support-amount:' + h.state().demoSpaceId + ':' + h.state().activeAccountId;
    const write = async (fn) => { const caller = h.state(), accountId = caller.activeAccountId, familyId = caller.activeFamilyId, tripId = caller.selectedTripId; await h.storage.write(s => { M.activateAccount(s, accountId, { familyId, tripId }); return fn(s); }); await h.refresh(); };
    let inFlight = false;
    let supportFeedback;
    function updateSupportFeedback() { if (!supportFeedback)
        return; const s = h.state(); if (s.activeAccountId !== supportFeedback.accountId) {
        supportFeedback = undefined;
        return;
    } const t = Object.values(s.dual?.transactions ?? {}).find(t => t.key === supportFeedback.key); if (!t || t.status === 'pending')
        return; supportFeedback = undefined; h.toast(t.status === 'confirmed' ? '支持已到賬：' + t.amount.toLocaleString('en-US') + ' 里數。請查看同一筆交易記錄。' : t.status === 'unknown' ? '支持結果待核實，請查詢原交易，勿重複提交。' : '支持未完成，請查看原交易結果；尚未入帳。'); }
    const error = (e) => { const box = document.querySelector('#modal-error'); if (box && document.querySelector('#modal')?.open)
        box.textContent = String(e.message);
    else
        h.toast(e.message); };
    async function run(fn) { try {
        await fn();
    }
    catch (e) {
        error(e);
    } }
    function preview(raw, key = crypto.randomUUID()) {
        const account = h.state().activeAccountId;
        h.close();
        void run(async () => { await h.refresh(); if (account !== h.state().activeAccountId)
            throw Error(message('CONTEXT_CHANGED')); showPreview(raw, key); });
    }
    function showPreview(raw, key) {
        const s = h.state(), draft = M.supportPreview(s, raw, key), a = M.demoAccount(s), f = M.fundSummary(s), available = draft.available, amount = draft.amount;
        sessionStorage.setItem('cx2-support-confirm:' + s.demoSpaceId + ':' + a.accountId, JSON.stringify(draft));
        h.modal('確認支持林晴回家', `<div class="notice"><strong>受益人：${esc(f.beneficiary)}</strong><p>${esc(f.title)} · ${f.origin} → ${f.destination}</p><p>支持 <strong>${amount.toLocaleString('en-US')} 里數</strong>；本人可用里數 ${available.toLocaleString('en-US')} → ${(available - amount).toLocaleString('en-US')}</p></div><p>這筆里數只進入林晴的受限回家目標，不會增加其普通餘額。</p><label class="check"><input type="checkbox" id="support-confirm-agree">我已核對受益人、目標與限制，確認這筆支持。</label>`, [{ label: '確認支持', run: () => { if (inFlight)
                    return; if (!document.querySelector('#support-confirm-agree')?.checked)
                    throw Error('请先核对并勾选确认'); if (h.state().activeAccountId !== draft.accountId)
                    throw Error('账号已切换，请重新核对'); inFlight = true; void run(async () => { try {
                    await write(s => M.confirmSupport(s, draft));
                    supportFeedback = { key: draft.key, accountId: draft.accountId };
                    h.close();
                    h.route('fund');
                    if (supportFeedback) {
                        h.toast('交易已提交，处理中。请以原交易记录核对结果。');
                        updateSupportFeedback();
                    }
                }
                finally {
                    inFlight = false;
                } }); } }]);
    }
    const handlers = {
        'text-repair': () => { const s = h.state(); const rows = (s.textDiagnostics ?? []).filter(d => { const [group, id, field] = d.path.split('.'); return ['persons', 'plans'].includes(group) && id === s.actorId && ['name', 'displayName', 'nickname', 'school'].includes(field) && s[group]?.[id]?.[field] === d.original; }); const owner = s.activeAccountId; h.modal('檢查我的文字資料', rows.length ? '<p>原文字已保留供核對。無法從問號還原內容，請自行重新填寫。</p>' + rows.map((d, i) => '<label class="field"><span>' + esc(d.path.endsWith('school') ? '學校名稱' : d.path.endsWith('nickname') ? '稱謂' : '顯示名稱') + '</span><input data-text-repair="' + i + '" value="' + esc(d.original) + '" maxlength="80"></label>').join('') : '<p>目前沒有需要你重新填寫的個人文字資料。已知文字問題已修復，餘額及歷史記錄均保留。</p>', rows.length ? [{ label: '保存重新填寫的文字', run: () => { if (owner !== h.state().activeAccountId)
                    throw Error(message('CONTEXT_CHANGED')); const values = rows.map((_, i) => document.querySelector('[data-text-repair="' + i + '"]').value.trim()); if (values.some(v => !v || /\?{3,}|\uFFFD/.test(v)))
                    throw Error('請填寫完整可讀的文字'); void run(async () => { await write(s => { rows.forEach((d, i) => { const [group, id, field] = d.path.split('.'); if (id !== s.actorId)
                    throw Error(message('CONTEXT_CHANGED')); s[group][id][field] = values[i]; }); return s; }); h.close(); }); } }] : []); },
        'learn-complete': el => {
            const kind = el.dataset.kind;
            L.requireLearning(h.state(), kind);
            const owner = h.state().activeAccountId;
            const definition = L.LEARN[kind];
            if (!definition)
                throw Error('未知準備任務');
            if (kind === 'calendar') {
                h.savePlan();
            }
            const copy = kind === 'calendar' ? '核對學校名稱、出發及開學日期、假期、考試與畢業日期。手動填寫與導入使用同一標準。' : kind === 'documents' ? '核對護照、簽證或入境要求、學生票證明及辦理時間。這是本人核對記錄，不要求上傳證件，也不代表獲批。' : '核對本次隨身及託運行李、必要用品及學生票行李條件。';
            h.modal(definition.title, '<p>' + copy + '</p><label class="check"><input id="learn-evidence" type="checkbox">我已閱讀並核對上述內容</label>' + (kind === 'documents' ? '<label class="field"><span>目前核對結果</span><select id="learn-doc-result"><option value="checked">已核對要求</option><option value="pending">仍需核實，已記錄待辦</option></select></label>' : '') + '<p class="meta">保存後只建立領取資格。獎勵另行領取，回執成功才入帳。</p>', [{ label: '保存核對記錄', run: () => { if (owner !== h.state().activeAccountId)
                        throw Error(message('CONTEXT_CHANGED')); if (!document.querySelector('#learn-evidence')?.checked)
                        throw Error('請先閱讀並核對'); const result = document.querySelector('#learn-doc-result')?.value; void run(async () => { await write(s => { L.requireLearning(s, kind); if (kind === 'calendar') {
                        const p = s.plans[s.actorId];
                        p.calendarConfirmed = true;
                        p.saved = true;
                        D.validatePlan(p);
                        return L.confirmCalendar(s, p);
                    } const task = M.currentTasks(s).find(t => t.personId === s.actorId && t.kind === kind); if (!task)
                        throw Error('請先選擇本人的有效行程，再核對這項準備。'); task.status = 'done'; return L.completeLearning(s, kind, result === 'pending' ? '已核對並記錄仍需核實的文件待辦' : '本人已核對並保存'); }); h.close(); h.toast('準備記錄已保存，可領取獎勵。'); }); } }]);
        },
        'learn-claim': el => { const key = el.dataset.key, owner = h.state().activeAccountId, e = h.state().learning?.events[key]; if (!e)
            throw Error('請先完成準備任務'); h.modal('領取準備獎勵', '<p>' + L.LEARN[e.kind].title + ' · ' + e.amount + ' 里數</p><p>只進入本人普通里數，不增加回家基金或其他成員餘額。</p>', [{ label: '確認領取', run: () => { if (owner !== h.state().activeAccountId)
                    throw Error(message('CONTEXT_CHANGED')); void run(async () => { await write(s => L.claimLearning(s, key)); h.close(); }); } }]); },
        'learn-query': el => void run(async () => { await write(s => L.settleLearning(s, el.dataset.key, true)); }),
        'support-preview': () => { const amount = document.querySelector('#support-amount')?.value ?? '3000'; let draft; try {
            draft = JSON.parse(sessionStorage.getItem('cx2-support-confirm:' + h.state().demoSpaceId + ':' + h.state().activeAccountId) ?? 'null');
        }
        catch { } const existing = draft && Object.values(h.state().dual.transactions).find(t => t.key === draft.key); if (existing?.status === 'pending' || existing?.status === 'unknown') {
            h.toast('已有处理中交易，请先查看或查询原交易。');
            return;
        } preview(amount, draft && !existing && String(draft.amount) === amount ? draft.key : crypto.randomUUID()); },
        query: el => void run(async () => { const id = el.dataset.id, a = h.state().activeAccountId; await write(s => { if (s.dual.transactions[id]?.accountId !== a)
            throw Error('只能查询本人交易'); return M.settleSupport(s, id, true); }); }),
        retry: el => void run(async () => { await write(s => M.retrySupport(s, el.dataset.id)); }),
        thanks: el => void run(async () => { await write(s => M.thankSupport(s, el.dataset.id)); h.toast('已送出感謝。'); }),
        notice: el => void run(async () => { await write(s => { const x = s.dual.notifications[el.dataset.id]; if (x?.accountId === s.activeAccountId)
            x.read = true; return s; }); h.route('fund'); }),
        transport: el => void run(async () => { await write(s => { const j = s.journeys.items[M.STUDENT_TRIP]; return J.userJourneyAction(s, j.id, j.revision, 'transport', el.dataset.id); }); }),
        contact: () => void run(async () => { await write(s => { const j = s.journeys.items[M.STUDENT_TRIP]; return J.userJourneyAction(s, j.id, j.revision, 'draft', ''); }); }),
        'arrival-confirm': () => { h.modal('記錄你已自行核實的安排', '<p>不會替你發送消息或預訂。只有收到對方確認後，才勾選相應項目。</p><label class="check"><input type="checkbox" id="pickup-verified">我已自行確認可用的接機或替代交通</label><label class="check"><input type="checkbox" id="dorm-verified">我已取得宿舍晚到入住確認</label><label class="check"><input type="checkbox" id="contact-saved">我已在自己的裝置保存交通與學校聯絡方式</label>', [{ label: '保存本人核實記錄', run: () => { const pickup = !!document.querySelector('#pickup-verified')?.checked, dorm = !!document.querySelector('#dorm-verified')?.checked, contact = !!document.querySelector('#contact-saved')?.checked; void run(async () => { await write(s => { if (s.actorId !== 'student')
                    throw Error('须由本人核实'); for (const [kind, done] of [['pickup', pickup], ['dorm', dorm], ['transport', contact]])
                    M.updateTask(s, 'dual-task:' + M.STUDENT_TRIP + ':' + kind, done); s.journeys.items[M.STUDENT_TRIP].school.confirmed = dorm; return s; }); h.close(); }); } }]); },
        task: el => { const s = h.state(), t = M.currentTasks(s).find(t => t.taskId === el.dataset.id); if (!t)
            throw Error('准备项不存在'); if (['wheelchair', 'seating', 'meal'].includes(t.kind)) {
            h.screen('preparation:services');
            return;
        } if (['pickup', 'dorm', 'transport'].includes(t.kind) && t.tripId === M.STUDENT_TRIP) {
            h.route('recovery');
            return;
        } h.modal(esc(t.title), `${readableTrip(s, t.tripId)}<p>本次核對旅客：${esc(s.persons[t.personId].name)}</p><p>操作人：${esc(s.persons[s.actorId].name)}</p><p>${esc(t.next)}</p><label class="check"><input type="checkbox" id="demo-task-check" ${t.status === 'done' ? 'checked' : ''}>我已完成本項核對</label>`, [{ label: '儲存核對結果', run: () => { const done = !!document.querySelector('#demo-task-check')?.checked; void run(async () => { await write(s => M.updateTask(s, t.taskId, done)); h.close(); }); } }]); },
        'open-parent': () => openTab(M.PARENT_ACCOUNT), 'open-student': () => openTab(M.STUDENT_ACCOUNT),
        'default-trip': () => { const a = M.demoAccount(h.state()); h.state().selectedTripId = a.defaultTripId; h.state().activeFamilyId = M.FAMILY; h.route('preparation'); }
    };
    function openTab(account) { const url = new URL('/?account=' + account + '&space=' + h.state().demoSpaceId, location.origin); window.open(url, '_blank', 'noopener'); }
    return { preview, legacyClaim(key) { const account = h.state().activeAccountId; void run(async () => { await write(s => D.reduce(s, { type: 'claim', key })); const p = (await h.storage.read()).tasks[key]; if (p?.status !== 'processing')
            return; const epoch = h.state().epoch, mode = h.state().mockMode; setTimeout(() => void run(async () => { await h.storage.write(s => { M.activateAccount(s, account); return D.reduce(s, { type: 'rewardReceipt', key, attempt: p.attempt, epoch, success: !['failure', 'timeout'].includes(mode) }); }); await h.refresh(); }), mode === 'delay' ? 8000 : 900); }); }, bind() { bindFamilyTasks(h); updateSupportFeedback(); document.querySelectorAll('[data-demo-action]').forEach(el => el.onclick = () => { try {
            handlers[el.dataset.demoAction]?.(el);
        }
        catch (e) {
            error(e);
        } }); const amount = document.querySelector('#support-amount'); if (amount) {
            amount.value = sessionStorage.getItem(amountKey()) ?? '3000';
            const update = () => { sessionStorage.setItem(amountKey(), amount.value); const box = document.querySelector('#support-preview'), error = document.querySelector('#support-error'), button = document.querySelector('[data-demo-action="support-preview"]'); try {
                const v = M.validateSupport(h.state(), h.state().actorId, M.FUND, amount.value);
                if (box)
                    box.textContent = '目前可用：' + availableMiles(h.state(), h.state().actorId).toLocaleString('en-US') + ' 里數；支持 ' + v.toLocaleString('en-US') + ' 里數後，可用餘額 ' + (availableMiles(h.state(), h.state().actorId) - v).toLocaleString('en-US') + ' 里數';
                if (error)
                    error.textContent = '';
                amount.setAttribute('aria-invalid', 'false');
                if (button)
                    button.disabled = false;
            }
            catch (e) {
                if (box)
                    box.textContent = '';
                if (error)
                    error.textContent = e.message;
                amount.setAttribute('aria-invalid', 'true');
                if (button)
                    button.disabled = true;
            } };
            amount.addEventListener('input', update);
            update();
        } } };
}
