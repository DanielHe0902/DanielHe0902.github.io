import * as E from '/assets/ee1ad71b9a14d41f146c/experience.js';
import * as M from '/assets/ee1ad71b9a14d41f146c/demo.js';
import { esc } from '/assets/ee1ad71b9a14d41f146c/ui.js';
export function experienceController(h) {
    const draftKey = () => 'cx2-preference-draft:' + h.state().demoSpaceId + ':' + h.state().activeAccountId;
    const readDraft = () => { try {
        return JSON.parse(sessionStorage.getItem(draftKey()) ?? 'null');
    }
    catch {
        return null;
    } };
    const clearDraft = () => sessionStorage.removeItem(draftKey());
    function draftSummary(input) { return `<p>主題：${input.themes.map(esc).join('、') || '未指定'} · 起點：${esc(input.origin) || '未指定'} · 預算：${input.budget ?? '未指定'}</p><p>行程提醒：${input.tripReminders ? '開啟' : '關閉'} · 回家節點：${input.festivalReminders ? '開啟' : '關閉'} · 主題內容：${input.contentReminders ? '開啟' : '關閉'}</p>`; }
    function guard(next) { const draft = readDraft(); if (!draft)
        return false; const account = h.state().activeAccountId, key = draftKey(); h.modal('尚有未儲存的設定', draftSummary(draft.input) + '<p>儲存至目前帳號後繼續，或放棄這次修改。取消會保留輸入。</p>', [{ label: '儲存並繼續', run: async () => { await write(s => E.savePreferences(s, account, draft.input), account); sessionStorage.removeItem(key); h.close(); next(); } }, { label: '放棄修改', style: 'danger', run: () => { sessionStorage.removeItem(key); h.close(); next(); } }]); return true; }
    const fail = (e) => { const node = document.querySelector('#modal-error'); if (node)
        node.textContent = e.message;
    else
        h.toast(e.message); };
    const write = async (fn, bound = h.state().activeAccountId) => { const current = h.state(), scope = { familyId: current.activeFamilyId, tripId: current.selectedTripId }; if (current.activeAccountId !== bound)
        throw Error('帳號已切換，請重新核對。'); await h.storage.write(s => fn(M.activateAccount(s, bound, scope))); await h.refresh(); };
    const run = (fn) => { try {
        Promise.resolve(fn()).catch(fail);
    }
    catch (e) {
        fail(e);
    } };
    function saveSettings(input, title) { const accountId = h.state().activeAccountId, person = h.state().persons[h.state().actorId].name; h.modal(title, `<p>只套用至 ${esc(person)}。</p><p>主題：${input.themes.map(esc).join('、') || '未指定'} · 起點：${input.origin || '未指定'} · 預算上限：${input.budget ?? '未指定'}</p><p>行程提醒：${input.tripReminders ? '開啟' : '關閉'} · 回家節點：${input.festivalReminders ? '開啟' : '關閉'} · 主題內容：${input.contentReminders ? '開啟' : '關閉'}</p><p>不會變更既有行程、交易或共享授權；既有通知保留。</p>`, [{ label: '確認儲存', run: async () => { await write(s => E.savePreferences(s, accountId, input), accountId); clearDraft(); h.close(); await h.refresh(); h.toast('已儲存至目前帳號，後續規劃與站內排程會遵守這些選擇。'); } }]); }
    function bind() {
        const personal = document.querySelector('[data-preferences-form],[data-subscriptions-form]');
        if (personal) {
            const kind = personal.hasAttribute('data-preferences-form') ? 'preferences' : 'subscriptions', draft = readDraft();
            if (draft?.kind === kind) {
                personal.querySelectorAll('input,select').forEach(el => { const value = draft.input[el.name]; if (el instanceof HTMLInputElement && el.type === 'checkbox')
                    el.checked = Array.isArray(value) ? value.includes(el.value) : !!value;
                else
                    el.value = String(value ?? ''); });
            }
            const remember = () => { const data = new FormData(personal), input = kind === 'preferences' ? { ...E.prefs(h.state()), themes: data.getAll('themes').map(String), origin: String(data.get('origin')), budget: data.get('budget') ? Number(data.get('budget')) : null } : { ...E.prefs(h.state()), tripReminders: data.has('tripReminders'), festivalReminders: data.has('festivalReminders'), contentReminders: data.has('contentReminders') }; if (JSON.stringify(input) === JSON.stringify(E.prefs(h.state())))
                clearDraft();
            else
                sessionStorage.setItem(draftKey(), JSON.stringify({ kind, input })); };
            personal.addEventListener('input', remember);
            personal.addEventListener('change', remember);
        }
        document.querySelectorAll('[data-content-plan]').forEach(el => el.onclick = () => run(() => h.transition(() => h.plan(el.dataset.contentPlan))));
        document.querySelectorAll('[data-new-plan]').forEach(el => el.onclick = () => run(() => h.transition(() => h.plan())));
        document.querySelectorAll('[data-edit-trip]').forEach(el => el.onclick = () => run(() => h.transition(() => h.plan(undefined, el.dataset.editTrip))));
        document.querySelectorAll('[data-edit-plan]').forEach(el => el.onclick = () => run(() => h.transition(() => h.plan(undefined, el.dataset.editPlan))));
        document.querySelectorAll('[data-content-favorite]').forEach(el => el.onclick = () => run(async () => { const s = h.state(), id = el.dataset.contentFavorite, save = !E.savedFavorites(s).some(f => f.contentId === id), account = s.activeAccountId; await write(s => E.setFavorite(s, account, id, save), account); h.toast(save ? '已加入本帳號收藏。' : '已取消收藏。'); }));
        document.querySelectorAll('[data-experience-trip],[data-trip-overview]').forEach(el => el.onclick = () => run(() => h.transition(() => { const s = h.state(), id = (el.dataset.experienceTrip ?? el.dataset.tripOverview), x = M.selectTrip(s, id); if (x.status !== 'ok')
            throw Error(x.message); s.selectedTripId = id; s.journeys.selectedId = id; if (s.trips[id])
            s.activeFamilyId = s.trips[id].familyId; const phase = el.dataset.phase; if (phase === 'overview')
            h.screen('journey:overview');
        else if (phase === 'posttrip')
            h.screen('journey:posttrip');
        else if (phase === 'during')
            h.screen('journey:auto');
        else
            h.route(phase === 'recovery' ? 'recovery' : 'preparation'); const target = document.querySelector('[data-guide-id="' + (phase === 'recovery' ? 'recovery-candidates' : phase === 'preparation' ? 'preparation-tasks' : 'journey-context') + '"]'); if (target) {
            target.classList.add('guide-highlight');
            target.setAttribute('tabindex', '-1');
            target.focus({ preventScroll: true });
        } })));
        document.querySelector('[data-preferences-form]')?.addEventListener('submit', e => { e.preventDefault(); run(() => { const data = new FormData(e.target), input = { ...E.prefs(h.state()), themes: data.getAll('themes').map(String), origin: String(data.get('origin')), budget: data.get('budget') ? Number(data.get('budget')) : null }; E.savePreferences(structuredClone(h.state()), h.state().activeAccountId, input); saveSettings(input, '儲存我的出行偏好'); }); });
        document.querySelector('[data-subscriptions-form]')?.addEventListener('submit', e => { e.preventDefault(); const data = new FormData(e.target); saveSettings({ ...E.prefs(h.state()), tripReminders: data.has('tripReminders'), festivalReminders: data.has('festivalReminders'), contentReminders: data.has('contentReminders') }, '更新本站提醒訂閱'); });
    }
    return { bind, guard, clearDraft };
}
