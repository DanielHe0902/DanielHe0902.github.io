import { serviceController, readableTrip, requestHistory } from './service-ui.js';
import { serviceState } from './service-state.js';
import { brandLockup, allianceMark } from './brand-ui.js';
import { planCarePreview } from './plan-care.js';
import { flightChangeController } from './flight-change-ui.js';
import { calendarController } from './calendar-ui.js';
import { validateCalendarPlan, calendarPatch } from './calendar-import.js';
import { confirmCalendar } from './learning.js';
import { schoolLabel } from './product-copy.js';
import { passportPage, stampViews, stampDetail } from './passport.js';
import { passportStamp, exportPassport } from './passport-visual.js';
import { rewardBoard } from './home-benefits.js';
import { flightSummary } from './flight-ui.js';
import { itineraryPreview, saveItinerary } from './itinerary.js';
import { installCompletedExamples } from './completed-examples.js';
import { runtimeState, updateRuntimeClock } from './runtime.js';
import * as E from './experience.js';
import { bindUX, showFormError, focusMain, focusIdentity, restoreFocus } from './ux.js';
import { discoveryHome, personalCenter, personalSubpage, plansSection } from './experience-ui.js';
import { experienceController } from './experience-controller.js';
import { applyCareDrafts } from './recognition.js';
import { workbench, primaryNavigation } from './workbench.js';
import { assignmentList } from './recovery-ui.js';
import { watchRelease } from './release-update.js';
import { RELEASE } from './release-meta.js';
import * as B from './booking.js';
import { featureController, featureSections } from './feature-ui.js';
import { runLinkLanding } from './link-entry.js';
import { StartupError, waitForStartupRetry } from './startup-error.js';
import { canReadJourneyReview } from './journey-data.js';
import { guideContext } from './guide.js';
import { canPlan } from './capabilities.js';
import { message } from './messages.js';
import { restrictedPlanner } from './demo-ui.js';
import * as M from './demo.js';
import { DemoStorage, demoSpaceId } from './demo-store.js';
import { demoView, accountSwitch, notifications, tripProblem } from './demo-ui.js';
import { demoController } from './demo-controller.js';
import { businessView, freshBusiness, screenButton } from './business.js';
import { tc, sc, localize, observeLocale } from './locale.js';
import * as J from './transit.js';
import { journeyView, journeyNotifications } from './transit-ui.js';
import { journeyModel, saveServiceFeedback } from './journey-context.js';
import { assistantProvider, validateToolRequest, configureProvider } from './provider.js';
import { displayName, personLabel } from './identity.js';
import { BRAND } from '../web/brand.js';
import { GuideAssistant } from './assistant.js';
import { reduceFund, canSeeFund } from './fund.js';
import { fundUI } from './fund-ui.js';
import { fundView } from './journey.js';
import { COPY, ROLES, SERVICE_LABELS, TASKS, SCHOOLS } from './config.js';
import * as D from './domain.js';
import { AIRPORTS, buildItinerary } from '../web/travel.js';
import { esc, avatar, icon, btn, chip, date, money } from './ui.js';
import { homeView, careView, preparationView, recoveryView, studentView } from './views.js';
if (await runLinkLanding())
    await new Promise(() => { });
let selectedFund;
let editingPlanId;
let intakeText = '', intakeContext = '', intakePending = 0;
let presentation = freshBusiness();
let homePreference = 'family';
let tripFilter = sessionStorage.getItem('cx2-trip-filter') ?? 'all';
let renderedView = null;
const restored = { state: runtimeState(), warning: '' };
let space = '', storage;
function rootLoading() { const el = document.querySelector('#app'); if (el)
    el.innerHTML = '<main class="workspace"><section class="panel" role="status" data-trip-state="loading">正在載入帳號與行程…</section></main>'; }
let initial;
while (true) {
    rootLoading();
    try {
        try {
            space = demoSpaceId();
        }
        catch (e) {
            throw new StartupError('session', e);
        }
        storage = new DemoStorage(space);
        initial = await storage.open(restored.state, s => installCompletedExamples(M.syncFamilyJourney(J.initJourneys(s))));
        break;
    }
    catch (e) {
        await waitForStartupRetry(e, space);
    }
}
const accountSessionKey = 'cx2-account-sessions:' + space + ':' + initial.journeyRelease?.version;
let accountSessions = {};
try {
    accountSessions = JSON.parse(sessionStorage.getItem(accountSessionKey) ?? '{}');
}
catch { }
const queryAccount = new URLSearchParams(location.search).get('account');
let activeAccount = queryAccount && initial.dual.accounts[queryAccount] ? queryAccount : sessionStorage.getItem('cx2-active-account:' + space) ?? M.PARENT_ACCOUNT;
if (!initial.dual.accounts[activeAccount])
    activeAccount = M.PARENT_ACCOUNT;
let state = M.activateAccount(initial, activeAccount, accountSessions[activeAccount]), view = 'home', dirty = false, toastTimer;
state.demoSpaceId = space;
let persistedSnapshot = D.clone(state), routeIssue = null;
let ui = { careDraft: null, planDraft: null, passportId: null, passportPage: 0, rewardPerson: null };
const calendarImport = calendarController({ state: () => state, plan: () => ui.planDraft ?? state.plans[state.actorId], set: (p, month) => { ui.planDraft = p; if (month)
        ui.calendarMonth = month; dirty = true; render(); }, render: () => render(), open: () => setRoute('student') });
const root = document.querySelector('#app'), dialog = document.querySelector('#modal');
const get = (selector) => document.querySelector(selector);
const fId = () => { if (!state.activeFamilyId)
    throw Error('請先建立家庭或接受邀請。'); D.guard(state, state.activeFamilyId); return state.activeFamilyId; };
const trip = () => { const x = M.selectTrip(state), t = x.status === 'ok' ? state.trips[x.id] : D.currentTrip(state, fId()); if (!t)
    throw Error('请先创建行程。'); return t; };
const personName = (p) => esc(displayName(state.persons[p]) ?? '成员');
function toast(text) { const box = get('#toast'); box.textContent = tc(text); box.classList.add('visible'); clearTimeout(toastTimer); toastTimer = setTimeout(() => box.classList.remove('visible'), 4200); }
function saveSession() { if (!state.activeAccountId)
    return; accountSessions[state.activeAccountId] = { familyId: state.activeFamilyId, tripId: state.selectedTripId, view, panel: D.clone(presentation) }; sessionStorage.setItem('cx2-active-account:' + space, state.activeAccountId); sessionStorage.setItem(accountSessionKey, JSON.stringify(accountSessions)); }
function persist() { saveSession(); const before = persistedSnapshot, after = D.clone(state); persistedSnapshot = after; void storage.saveDelta(before, after).catch(e => toast('保存失败：' + e.message)); }
async function refreshBusiness(redraw = true) { const shared = await storage.read(); const current = { familyId: state.activeFamilyId, tripId: state.selectedTripId }, id = state.activeAccountId; state = M.activateAccount(M.syncFamilyJourney(shared), id, current); state.demoSpaceId = space; persistedSnapshot = D.clone(state); guide.sync(); if (redraw)
    render(); }
function switchAccount(accountId) { transition(() => { calendarImport.cancel(true); flightChanges.reset(); services.reset(); close(); saveSession(); guide.contextChanged(); state = M.activateAccount(state, accountId, accountSessions[accountId]); state.demoSpaceId = space; persistedSnapshot = D.clone(state); ui = { careDraft: null, planDraft: null, passportId: null, passportPage: 0, rewardPerson: null }; homePreference = M.studentAccount(state) ? 'student' : 'family'; guide.contextChanged(); const saved = accountSessions[accountId]; setRoute(saved?.view ?? 'home'); if (saved?.panel) {
    presentation = D.clone(saved.panel);
    syncPanelUrl();
    render();
} saveSession(); }); }
function act(action, redraw = true) { state = action.type.startsWith("fund") ? reduceFund(state, action) : D.reduce(state, action); if (!M.studentAccount(state) && ['createFamily', 'route', 'switchFamily'].includes(action.type))
    state.selectedTripId = D.currentTrip(state, state.activeFamilyId ?? '')?.id ?? 'none:' + state.activeFamilyId; M.syncFamilyJourney(state); persist(); if (redraw)
    render(); }
function path(v) { if (v === 'home')
    return '/'; if (v === 'assistant')
    return '/assistant'; if (v === 'me')
    return '/me'; if (['preferences', 'favorites', 'subscriptions'].includes(v))
    return '/me/' + v; if (v === 'planning')
    return '/plans/' + encodeURIComponent(editingPlanId ?? 'new'); if (v === 'trips')
    return '/journeys'; if (state.dual && ['preparation', 'recovery', 'journey'].includes(v)) {
    const x = M.selectTrip(state);
    if (x.status === 'ok')
        return '/trips/' + x.id + '/' + v;
} const f = state.activeFamilyId, t = f ? D.currentTrip(state, f) : null; return v === 'journey' ? '/trips/' + (J.currentJourney(state)?.id ?? 'none') + '/journey' : v === 'fund' ? '/student/fund' : v === 'student' ? '/student/planner' : f ? '/families/' + f + (v === 'care' ? '/' + v : '/trips/' + (t?.id ?? 'new') + '/' + v) : '/'; }
const homeScroll = new Map();
function setRoute(v, replace = false) { if (view === 'home' && presentation.home === 'default')
    homeScroll.set(state.activeAccountId, window.scrollY); guide.suspendPanel(); intakePending++; routeIssue = null; presentation = freshBusiness(); view = v; saveSession(); if (location.pathname + location.search !== path(v))
    (replace ? history.replaceState : history.pushState).call(history, {}, '', path(v)); render(); window.scrollTo({ top: v === 'home' ? homeScroll.get(state.activeAccountId) ?? 0 : 0, behavior: 'instant' }); focusMain(); }
function readRoute() { routeIssue = null; const parts = location.pathname.split('/').filter(Boolean); if (parts[0] === 'assistant') {
    view = 'assistant';
    return;
} if (parts[0] === 'me') {
    view = ['preferences', 'favorites', 'subscriptions'].includes(parts[1]) ? parts[1] : 'me';
    return;
} if (parts[0] === 'plans') {
    editingPlanId = decodeURIComponent(parts[1] ?? '');
    view = 'planning';
    return;
} if (parts[0] === 'journeys') {
    view = 'trips';
    return;
} if (parts[0] === 'trips' && state.journeyRelease?.retired.includes(parts[1]) && !state.trips[parts[1]] && !state.journeys?.items[parts[1]]) {
    view = 'preparation';
    routeIssue = { status: 'error', message: '此行程已移除' };
    return;
} if (state.dual && parts[0] === 'trips' && ['journey', 'preparation', 'recovery'].includes(parts[2])) {
    const x = M.selectTrip(state, parts[1]);
    view = parts[2];
    if (x.status !== 'ok') {
        routeIssue = x;
        return;
    }
    state.selectedTripId = x.id;
    if (x.kind === 'family')
        state.activeFamilyId = state.trips[x.id].familyId;
    if (state.journeys?.items[x.id])
        state.journeys.selectedId = x.id;
    saveSession();
    return;
} if (parts[0] === 'trips' && parts[2] === 'journey') {
    const j = state.journeys?.items[parts[1]];
    if (j && J.canReadJourney(state, j)) {
        state.journeys.selectedId = j.id;
        if (j.familyId)
            state.activeFamilyId = j.familyId;
        view = 'journey';
    }
    else {
        view = 'home';
        toast('当前身份没有此行程的授权。');
    }
    return;
} if (parts[0] === 'student') {
    view = parts[1] === 'fund' ? 'fund' : 'student';
    const token = new URLSearchParams(location.search).get('invite');
    if (token) {
        const f = Object.values(state.funds).find(f => f.token === token && canSeeFund(state, f));
        if (f)
            selectedFund = f.id;
        else
            toast('目前無法讀取這份邀請，請在原瀏覽器開啟連結。');
    }
    return;
} if (parts[0] === 'families' && parts[2] === 'trips' && state.tripCleanup?.retired.includes(parts[3])) {
    view = 'preparation';
    routeIssue = { status: 'error', message: '此行程已移除' };
    return;
} if (parts[0] === 'families' && parts[1]) {
    if (D.familiesFor(state).some(f => f.id === parts[1])) {
        state.activeFamilyId = parts[1];
        if (!M.studentAccount(state))
            state.selectedTripId = D.currentTrip(state, parts[1])?.id ?? 'none:' + parts[1];
        if (parts[2] === 'trips' && parts[3] && parts[3] !== 'new') {
            const x = M.selectTrip(state, parts[3]);
            if (x.status !== 'ok') {
                routeIssue = x;
                view = parts.at(-1);
                return;
            }
            state.selectedTripId = x.id;
        }
    }
    else {
        if (state.sceneMigration?.retired.includes(parts[1]) && D.familiesFor(state).some(f => f.id === M.FAMILY)) {
            state.activeFamilyId = M.FAMILY;
            view = parts.at(-1) === 'care' ? 'care' : 'home';
            history.replaceState({}, '', path(view));
            toast('行程已更新，已返回家庭。');
        }
        else {
            view = 'home';
            toast('这个家庭不在当前身份的授权范围内。');
        }
        return;
    }
    const v = parts.at(-1);
    if (['home', 'care', 'preparation', 'recovery'].includes(v ?? ''))
        view = v;
} }
const panels = { home: ['default', 'tasks', 'passport', 'ledger'], student: ['input', 'options', 'year'], care: ['overview', 'all'], preparation: ['checklist', 'travellers', 'documents', 'services', 'detail'], fund: ['entry', 'detail', 'legacy'], journey: ['auto', 'overview', 'transfer', 'arrival', 'posttrip'] };
function readLocation() { presentation = freshBusiness(); readRoute(); const q = new URLSearchParams(location.search), panel = q.get('panel'); if (panel && panels[view]?.includes(panel))
    presentation[view] = panel; presentation.request = q.get('request'); }
function syncPanelUrl() { if (!panels[view])
    return; const key = view; const q = new URLSearchParams(location.search); q.set('panel', presentation[key]); if (presentation.request && view === 'preparation')
    q.set('request', presentation.request);
else
    q.delete('request'); history.replaceState({}, '', path(view) + '?' + q); }
function safe(fn) { try {
    fn();
}
catch (e) {
    toast(e.message);
} }
let modalReturnFocus = null;
function modal(title, body, actions = []) { delete dialog.dataset.bookingSuccess; if (!dialog.open)
    modalReturnFocus = focusIdentity(document.activeElement); dialog.innerHTML = '<div class="modal-head"><h2 id="modal-title">' + title + '</h2><button class="button ghost" id="close-modal" aria-label="关闭窗口">' + icon('close') + '</button></div><div class="modal-body">' + body + '<p id="modal-error" class="error" role="alert"></p></div><div class="modal-actions"><button class="button secondary" id="cancel-modal">取消</button>' + actions.map((a, i) => '<button class="button ' + (a.style ?? '') + '" data-modal-index="' + i + '">' + a.label + '</button>').join('') + '</div>'; localize(dialog); get('#close-modal').addEventListener('click', () => { close(); render(); }); get('#cancel-modal').addEventListener('click', () => { close(); render(); }); dialog.querySelectorAll('[data-modal-index]').forEach(b => b.addEventListener('click', () => { try {
    Promise.resolve(actions[Number(b.dataset.modalIndex)].run()).catch(e => { const target = get('#modal-error'); if (target)
        target.textContent = tc(e.message);
    else
        toast(e.message); });
}
catch (e) {
    get('#modal-error').textContent = tc(e.message);
} })); if (!dialog.open)
    dialog.showModal(); }
const close = () => { if (dialog.querySelector('.flight-change-popup'))
    flightChanges.dismissPopup(); const wasOpen = dialog.open; dialog.close(); dialog.replaceChildren(); if (wasOpen)
    queueMicrotask(() => { if (!dialog.open)
        restoreFocus(modalReturnFocus); }); };
const demoControlsUI = demoController({ state: () => state, storage, refresh: refreshBusiness, modal, close, toast, route: setRoute, screen: goScreen, transition, savePlan: () => { if (ui.planDraft) {
        act({ type: "plan", plan: ui.planDraft }, false);
        ui.planDraft = null;
        dirty = false;
    } if (!canPlan(state))
        throw Error(message("STUDENT_ACCESS_REQUIRED")); } });
const features = featureController({ state: () => state, storage, refresh: refreshBusiness, modal, close, toast, route: setRoute, screen: goScreen, transition, savePlan: () => { } });
const fundControls = fundUI({ state: () => state, act, modal, close, render, toast, registration, navigate: v => v === 'fund' ? goScreen('fund:legacy') : setRoute(v), select: id => selectedFund = id, current: () => selectedFund });
function showFlightPopup(e, html) { if (!dialog.open)
    return false; if (dialog.dataset.bookingSuccess) {
    modal('航班有變更', html, []);
    get('#cancel-modal').textContent = '稍後處理';
}
else {
    dialog.querySelector('[data-modal-flight-change]')?.remove();
    dialog.querySelector('.modal-body')?.insertAdjacentHTML('afterbegin', '<div data-modal-flight-change>' + html + '</div>');
} flightChanges.bind(); return true; }
function transition(next) { if (experienceUI.guard(next))
    return; if (!dirty) {
    next();
    return;
} modal('还有未保存的修改', '<p>保存到原来的家庭或个人空间后再切换，还是放弃这次编辑？</p>', [{ label: '保存并切换', run: async () => { await saveDraft(); close(); next(); } }, { label: '放弃修改', style: 'danger', run: () => { dirty = false; intakeText = ''; intakePending++; ui.careDraft = null; ui.assistantCare = undefined; ui.planDraft = null; close(); next(); } }]); }
async function saveCareBatch(profiles) { const context = guideContext(state), account = state.activeAccountId, selection = { familyId: state.activeFamilyId, tripId: state.selectedTripId }; const result = await storage.write(current => applyCareDrafts(M.activateAccount(current, account, selection), profiles, context)); if (state.activeAccountId !== account || state.activeFamilyId !== selection.familyId)
    throw Error('資料已儲存至原帳號；目前頁面已切換。'); state = M.activateAccount(M.syncFamilyJourney(result), account, selection); persistedSnapshot = D.clone(state); }
async function saveDraft() { if (intakeText.trim())
    throw Error('請先在照護頁整理並確認需求，或選擇放棄修改。'); if (ui.careDraft)
    await saveCareBatch(ui.assistantCare ? Object.values({ ...ui.assistantCare.profiles, [ui.careDraft.personId]: ui.careDraft }) : [ui.careDraft]); if (ui.planDraft)
    act({ type: 'plan', plan: ui.planDraft }, false); dirty = false; ui.careDraft = null; ui.assistantCare = undefined; ui.planDraft = null; }
const flightChanges = flightChangeController({ showPopup: showFlightPopup, state: () => state, render, toast, write: async (fn, redraw = true) => { const account = state.activeAccountId, selection = { familyId: state.activeFamilyId, tripId: state.selectedTripId }; await storage.write(s => fn(M.activateAccount(s, account, selection))); await refreshBusiness(redraw); }, open: e => transition(() => { close(); guide.contextChanged(); services.reset(); state.activeFamilyId = state.journeys?.items[e.tripId]?.familyId ?? state.activeFamilyId; state.selectedTripId = e.tripId; state.journeys.selectedId = e.tripId; guide.openChange(); setRoute('assistant'); }) });
const services = serviceController({ state: () => state, render, toast, write: async (fn) => { const account = state.activeAccountId, selection = { familyId: state.activeFamilyId, tripId: state.selectedTripId }; await storage.write(s => fn(M.activateAccount(s, account, selection))); await refreshBusiness(); }, open: () => { flightChanges.reset(); guide.openService(); setRoute('assistant'); } });
const guide = new GuideAssistant({ clearChange: () => flightChanges.reset(), clearService: () => services.reset(), servicePanel: () => services.panel(), serviceText: text => services.text(text), changePanel: () => flightChanges.panel(), changeText: text => flightChanges.text(text), persistBooking: persistConversationBooking, saveBooking: saveConversationBooking, saveTravelPlan: confirmTravelPlan, selectedPerson: () => ui.careDraft?.personId, state: () => ui.planDraft ? { ...state, plans: { ...state.plans, [state.actorId]: ui.planDraft } } : state, render, navigate: (v, x) => navigateGuide(v, undefined, x), switchFamily: id => navigateGuide(view, id), reveal: revealGuide, cancelTrip: () => { throw Error('請先向航空公司核對實際行程狀態。'); } });
async function persistConversationBooking(plan, action = 'draft') { const accountId = state.activeAccountId, epoch = state.epoch, scope = { familyId: state.activeFamilyId, tripId: state.selectedTripId }; if (plan.accountId !== accountId)
    throw Error('帳號已切換。'); const updated = await storage.write(current => { if (current.epoch !== epoch)
    throw Error('資料空間已變更。'); return B.persistBooking(M.activateAccount(current, accountId, scope), plan, action); }); if (state.activeAccountId !== accountId)
    throw Error('帳號已切換，原草稿已保留。'); state.booking = structuredClone(updated.booking); persistedSnapshot.booking = structuredClone(updated.booking); return structuredClone(updated.booking.sessions[plan.id]); }
async function saveConversationBooking(plan) {
    const accountId = state.activeAccountId, epoch = state.epoch, scope = { familyId: state.activeFamilyId, tripId: state.selectedTripId };
    if (plan.accountId !== accountId)
        throw Error('帳號已切換。');
    let updated;
    try {
        updated = await storage.write(current => { if (current.epoch !== epoch)
            throw Error('資料空間已變更。'); return B.saveBooking(M.activateAccount(current, accountId, scope), plan); });
    }
    catch (e) {
        const recovered = await storage.read();
        if (!recovered.booking?.receipts[plan.booking.requestId])
            throw e;
        updated = recovered;
    }
    const saved = structuredClone(updated.booking.sessions[plan.id]);
    if (state.activeAccountId !== accountId || state.epoch !== epoch)
        return saved;
    const receipt = updated.dual.notifications[saved.booking.notificationId];
    guide.suspendPanel();
    await refreshBusiness();
    setRoute('home');
    modal(receipt.title, '<p>' + esc(receipt.text) + '</p>', [{ label: '查看行程', run: () => { close(); state.selectedTripId = plan.id; state.journeys.selectedId = plan.id; if (plan.familyId)
                state.activeFamilyId = plan.familyId; setRoute('preparation'); } }, { label: '繼續瀏覽首頁', run: () => close() }]);
    const dismiss = document.querySelector('#cancel-modal');
    if (dismiss)
        dismiss.textContent = '關閉';
    document.querySelector('[data-modal-index="1"]')?.classList.add('secondary');
    dialog.dataset.bookingSuccess = plan.id;
    return saved;
}
function confirmTravelPlan(plan) { return new Promise(resolve => { try {
    if (plan.mode === 'itinerary')
        itineraryPreview(state, plan);
    else
        E.validatePlan(state, plan);
}
catch (e) {
    const message = e.message;
    const names = message.includes('起點') ? ['origin', 'destination'] : message.includes('日期') ? ['start', 'end'] : message.includes('預算') ? ['budget'] : message.includes('名稱') ? ['title'] : [];
    showFormError(get('[data-experience-plan-form]'), message, names);
    resolve(null);
    return;
} const accountId = state.activeAccountId, scope = { familyId: state.activeFamilyId, tripId: state.selectedTripId }, epoch = state.epoch; let saved = false; modal(plan.mode === 'itinerary' ? (plan.replacesTripVersion ? '確認更換航班' : '確認新增行程') : '確認儲存旅行草稿', '<h3>' + esc(plan.title) + '</h3><p>' + (plan.origin || '起點待定') + ' → ' + (plan.destination || '目的地待定') + '</p><p>日期：' + (plan.start || '待定') + (plan.end ? ' — ' + plan.end : ' · 單程') + ' · 預算上限 HKD ' + (plan.budget ?? '待定') + '</p><p>打算同行：' + (plan.travelerIds.map(id => esc(displayName(state.persons[id]))).join('、') || '尚未決定') + '</p>' + (plan.mode === 'itinerary' ? '<p>範圍：' + esc(plan.familyId ? state.families[plan.familyId].name : '本人個人行程') + ' · ' + plan.travelerIds.length + ' 位旅客／' + plan.travelerIds.filter(id => D.age(state.persons[id], plan.start) >= 2).length + ' 個獨立座位</p>' + (plan.selectedFlight ? flightSummary(plan.selectedFlight.outbound) + (plan.selectedFlight.inbound ? flightSummary(plan.selectedFlight.inbound) : '') : '') + '<h3>本次特殊需求</h3><p>' + esc(planCarePreview(state, plan).map(r => r.label).join('；') || '未勾選特殊需求') + '</p><p>需求僅保存為草稿，服務尚未提交或確認。</p>' + '<p>儲存後可查看出行準備事項。</p>' : '<p>只儲存本人草稿；不建立航班、不邀請家人或扣款。</p>'), [{ label: plan.mode === 'itinerary' ? (plan.replacesTripVersion ? '確認更換航班' : '確認新增行程') : '確認儲存草稿', run: async () => { if (state.activeAccountId !== accountId || state.activeFamilyId !== scope.familyId || state.epoch !== epoch)
            throw Error('帳號或範圍已切換，請重新確認。'); const updated = await storage.write(current => { if (current.epoch !== epoch)
            throw Error('資料已更新，請重新核對。'); const scoped = M.activateAccount(current, accountId, scope); return plan.mode === 'itinerary' ? saveItinerary(scoped, plan) : E.saveTravelPlan(scoped, plan); }); saved = true; const result = plan.mode === 'itinerary' ? { ...plan, version: (plan.replacesTripVersion ?? 0) + 1 } : E.experience(updated).plans[plan.id]; await refreshBusiness(); close(); if (plan.mode === 'itinerary') {
            guide.suspendPanel();
            setRoute('home');
            toast('行程已保存，可以開始核對出發準備。');
        } resolve(result); } }]); dialog.addEventListener('close', () => { if (!saved)
    resolve(null); }, { once: true }); }); }
function startPlanning(contentId, planId) { if (!contentId && !planId) {
    void guide.beginBooking().catch(e => toast(e.message));
    return;
} editingPlanId = planId; guide.beginPlan(contentId, planId); render(); }
const experienceUI = experienceController({ state: () => state, storage, refresh: refreshBusiness, modal, close, toast, route: setRoute, screen: goScreen, transition, savePlan: () => { }, plan: startPlanning });
function navigateGuide(v, familyId, x) { return new Promise(resolve => { const go = () => { if (familyId) {
    act({ type: "switchFamily", familyId }, false);
    ui.careDraft = null;
    ui.passportId = null;
    guide.contextChanged();
} if (v === view && !familyId)
    render();
else
    setRoute(v); }; if (!dirty || (!familyId && v === view && ((v === "student" && ui.planDraft) || (v === "care" && x?.careTask && ui.careDraft && (ui.careDraft.personId === x.personId || ui.assistantCare && !ui.assistantCare.edited))))) {
    go();
    resolve(true);
    return;
} let settled = false; const finish = (go) => { if (settled)
    return; settled = true; if (go) {
    if (familyId) {
        act({ type: "switchFamily", familyId }, false);
        ui.careDraft = null;
        ui.passportId = null;
        guide.contextChanged();
    }
    if (v === view && !familyId)
        render();
    else
        setRoute(v);
} resolve(go); }; modal('还有未保存的修改', '<p>先保存到当前空间，或放弃草稿后继续引导。</p>', [{ label: '保存并切换', run: async () => { await saveDraft(); finish(true); close(); } }, { label: '放弃修改', style: 'danger', run: () => { dirty = false; intakeText = ''; ui.careDraft = null; ui.assistantCare = undefined; ui.planDraft = null; finish(true); close(); } }]); dialog.addEventListener('close', () => finish(false), { once: true }); }); }
function revealGuide(x, prepare = true) { if (x.view === 'student' && !canPlan(state))
    throw Error(message('STUDENT_ACCESS_REQUIRED')); if (x.target === 'recovery-candidates')
    presentation.preparation = 'checklist'; if (x.target === 'fund-action' && state.dual)
    selectedFund = M.FUND; if (x.target === 'passport-records')
    presentation.home = 'passport'; if (x.target === 'family-tasks')
    presentation.home = 'tasks'; if (x.view === 'student')
    presentation.student = 'input'; if (x.target === 'fund-action')
    presentation.fund = 'detail'; if (x.view === 'journey')
    presentation.journey = ['arrival-conflict', 'campus-transport', 'contact-draft'].includes(x.target) ? 'arrival' : ['posttrip-summary', 'trip-passport'].includes(x.target) ? 'posttrip' : 'transfer'; if (x.target === 'care-member' && x.personId && (prepare || !ui.careDraft)) {
    if (x.careTask) {
        const old = ui.assistantCare, profiles = {};
        for (const pid of x.careTask.personIds) {
            profiles[pid] = D.clone(ui.careDraft?.personId === pid ? ui.careDraft : old?.profiles[pid] ?? state.profiles[fId() + ':' + pid]);
            for (const need of x.careTask.needs.filter(n => n.personId === pid))
                if (!profiles[pid].needs.includes(need.service))
                    profiles[pid].needs.push(need.service);
            Object.assign(profiles[pid], x.careTask.fields?.[pid] ?? {});
        }
        ui.assistantCare = { task: D.clone(x.careTask), profiles, existing: x.existingRequestIds ?? [], edited: false };
        ui.careDraft = profiles[x.personId];
    }
    else {
        ui.careDraft = D.clone(state.profiles[fId() + ':' + x.personId]);
        if (prepare && x.service && !ui.careDraft.needs.includes(x.service))
            ui.careDraft.needs.push(x.service);
    }
    dirty = true;
} if (prepare && x.target === 'student-dates' && (x.school || x.start)) {
    ui.planDraft = D.clone(ui.planDraft ?? state.plans[state.actorId]);
    if (x.school)
        ui.planDraft.school = x.school;
    if (x.start)
        ui.planDraft.start = x.start;
    dirty = true;
} if (x.target === 'passport-records') {
    ui.passportId = x.personId ?? null;
    ui.passportPage = 0;
} if (x.target === 'fund-action')
    selectedFund = state.dual ? M.FUND : Object.values(state.funds).find(f => f.ownerId === state.actorId)?.id; syncPanelUrl(); render(); if (prepare && x.supportAmount)
    demoControlsUI.preview(x.supportAmount); }
function goScreen(key) {
    guide.suspendPanel();
    const [area, panel] = key.split(':');
    const allowed = { home: ['default', 'tasks', 'passport', 'ledger'], student: ['input', 'options', 'year'], care: ['overview', 'all'], preparation: ['checklist', 'travellers', 'documents', 'services', 'detail'], fund: ['entry', 'detail', 'legacy'], journey: ['auto', 'overview', 'transfer', 'arrival', 'posttrip'] };
    if (!allowed[area]?.includes(panel))
        return;
    if (area === 'care')
        ui.careDraft = null;
    if (area === 'fund' && panel === 'legacy' && (!selectedFund || selectedFund === M.FUND))
        selectedFund = Object.values(state.funds).find(f => f.id !== M.FUND && canSeeFund(state, f))?.id;
    if (area !== view) {
        presentation = freshBusiness();
        view = area;
    }
    presentation[area] = panel;
    history.pushState({}, '', path(view) + '?panel=' + panel + (view === 'preparation' && presentation.request ? '&request=' + encodeURIComponent(presentation.request) : ''));
    render();
    window.scrollTo({ top: 0, behavior: 'instant' });
    focusMain();
}
function render() {
    const retainFocus = document.visibilityState === 'visible' && document.hasFocus();
    updateRuntimeClock(state);
    if (state.activeFamilyId && !D.canAccessFamily(state, state.activeFamilyId)) {
        state.activeFamilyId = null;
        ui.careDraft = null;
        ui.assistantCare = undefined;
    }
    guide.captureScroll();
    const intakeKey = state.activeAccountId + ':' + state.activeFamilyId;
    if (intakeContext !== intakeKey) {
        intakeText = '';
        intakeContext = intakeKey;
        intakePending++;
    }
    const disclosures = Array.from(document.querySelectorAll('details[data-disclosure][open]')).map(el => el.dataset.disclosure);
    guide.setHomeMode(view === 'assistant' || view === 'planning');
    const oldProgress = new Map(Array.from(document.querySelectorAll('[data-progress-id]')).map(e => [e.dataset.progressId, e.querySelector('i')?.style.width]));
    const changed = view !== renderedView;
    renderedView = view;
    const focusSelector = focusIdentity(document.activeElement);
    const focused = document.activeElement, focusId = focused?.id, focusName = focused?.getAttribute("name"), focusForm = focused?.closest("form")?.id, selection = focused && ('selectionStart' in focused) ? focused.selectionStart : null;
    guide.sync();
    ui.assistantHome = guide.home();
    ui.homePreference = homePreference;
    const actor = state.persons[state.actorId], member = D.account(state, state.actorId);
    const denied = view === 'student' && !canPlan(state);
    const legacyBody = denied || view === 'trips' ? '' : view === 'journey' ? journeyView(state) : view === 'fund' ? fundView(state, selectedFund) : view === 'student' ? studentView(state, ui) : view === 'care' ? careView(state, ui) : view === 'preparation' ? preparationView(state) : view === 'recovery' ? recoveryView(state) : homeView(state, ui);
    let body = denied ? restrictedPlanner() : routeIssue ? tripProblem(state, routeIssue.status, routeIssue.message) : (view === 'fund' && presentation.fund === 'legacy' ? legacyBody : (demoView(state, ui, view, presentation) ?? businessView(state, ui, view, legacyBody, presentation)));
    if (!denied && !routeIssue)
        body = workbench(state, view, presentation, body, tripFilter);
    if (view === 'home' && presentation.home === 'default')
        body = discoveryHome(state);
    if (view === 'home' && presentation.home === 'tasks')
        body = rewardBoard(state);
    if (view === 'home' && presentation.home === 'passport')
        body = passportPage(state, ui.passportId);
    if (view === 'assistant')
        body = guide.home(true);
    if (view === 'planning') {
        const plan = E.ownPlans(state).find(p => p.id === editingPlanId);
        if (plan && !guide.hasPlan(plan.id))
            guide.beginPlan(undefined, plan.id);
        body = plan ? guide.home(true) : '<section class="panel"><h1>無權存取計劃</h1><p>這份計劃不在目前帳號範圍，或尚未儲存。</p><button class="button" data-view="home">返回首頁</button></section>';
    }
    if (view === 'me')
        body = personalCenter(state);
    if (view === 'preferences' || view === 'favorites' || view === 'subscriptions')
        body = personalSubpage(state, view);
    if (view === 'trips')
        body = plansSection(state, true);
    if (view === 'care' || view === 'fund' || view === 'home' && presentation.home !== 'default')
        body = '<div class="personal-breadcrumb"><button class="text-link" data-view="me">← 我的</button><span>' + esc(view === 'care' ? '我的家人' : view === 'fund' ? '我的回家目標' : '我的會員記錄') + '</span></div>' + body;
    document.title = tc(view === 'home' && presentation.home === 'passport' ? '成長護照' : { assistant: '有期助手', me: '我的', preferences: '出行偏好', favorites: '我的收藏', subscriptions: '訂閱與通知', planning: '我的旅行計劃' }[view] ?? COPY.nav[view]) + ' · ' + BRAND.names[BRAND.locale] + ' | ' + BRAND.names.en;
    root.innerHTML = '<header class="business-header">' + brandLockup() + '<nav aria-label="主導覽">' + primaryNavigation(view, presentation) + '</nav><div class="business-context">' + familyBar() + '<details class="account-menu"><summary><span class="account-avatar" aria-hidden="true">' + esc(displayName(actor).slice(0, 1)) + '</span>' + esc(displayName(actor)) + ' · ' + message(M.studentAccount(state) ? 'student' : 'parent') + ' ▾</summary><div class="account-popover">' + accountSwitch(state) + btn('家庭管理', state.activeFamilyId ? 'manage-family' : 'create-family', '', 'ghost') + screenButton('個人里數帳本', 'home:ledger') + (state.activeFamilyId ? btn('我的資料與授權', 'member-info', 'data-person="' + state.actorId + '"', 'ghost') : '') + '<hr>' + '' + '</div></details>' + '<button class="text-link notification-tool" data-feature="notifications" aria-label="通知中心">' + icon('bell') + '<span class="notification-label">消息</span>' + (M.visibleNotifications(state).filter(n => !n.read).length ? '<span class="notification-count">' + M.visibleNotifications(state).filter(n => !n.read).length + '</span>' : '') + '</button>' + allianceMark() + '</div></header><div class="workspace">' + '<main id="main" class="' + (view === 'home' && presentation.home === 'default' ? 'discovery-main' : view === 'assistant' || view === 'planning' ? 'assistant-page' : '') + '" tabindex="-1"' + (changed ? ' data-enter="true"' : '') + '>' + journeyRecoveryNotice() + notifications(state) + (routeIssue ? '' : journeyNotifications(state)) + (['preparation', 'recovery', 'journey'].includes(view) && !routeIssue ? tripSelector() : '') + body + retainedDraftPanel() + featureSections(state, view) + '</main></div>' + guide.chrome() + flightChanges.popup();
    localize(root);
    disclosures.forEach(key => root.querySelectorAll('details[data-disclosure]').forEach(d => { if (d.dataset.disclosure === key)
        d.open = true; }));
    const careTarget = get('#care-form');
    if (careTarget) {
        careTarget.removeAttribute('data-guide-id');
        const service = ui.assistantCare?.task.needs.find(n => n.personId === ui.careDraft?.personId)?.service;
        const selector = service === 'ownWheelchair' ? 'select[name="wheelchairType"]' : service === 'bassinet' ? 'input[name="months"]' : service && service !== 'wheelchair' ? 'input[name="need"][value="' + service + '"]' : 'select[name="walking"]';
        const field = careTarget.querySelector(selector)?.closest('.field,.check');
        (field ?? careTarget).setAttribute('data-guide-id', 'care-member');
    }
    const schoolTarget = get('#student-form');
    if (schoolTarget) {
        schoolTarget.setAttribute('data-guide-id', 'student-dates');
        schoolTarget.setAttribute('tabindex', '-1');
    }
    if (view === 'student' && presentation.student === 'input') {
        const form = root.querySelector('#student-form');
        form?.insertAdjacentHTML('beforebegin', calendarImport.panel(ui.planDraft ?? state.plans[state.actorId]));
    }
    bindForms();
    guide.bind();
    calendarImport.bind();
    flightChanges.bind();
    services.bind();
    bindUX(root);
    if (retainFocus && !changed && focusSelector && !dialog.open)
        restoreFocus(focusSelector);
    document.querySelectorAll('nav [data-view]').forEach(el => el.setAttribute('aria-label', el.textContent ?? ''));
    if (retainFocus && (focusId || focusName && focusForm)) {
        const next = focusId ? document.getElementById(focusId) : document.querySelector("#" + CSS.escape(focusForm) + " [name=" + CSS.escape(focusName) + "]");
        if (next) {
            next.focus({ preventScroll: true });
            if (selection !== null && (next instanceof HTMLTextAreaElement || next instanceof HTMLInputElement && ["text", "search", "tel", "url", "password"].includes(next.type)))
                next.setSelectionRange(selection, selection);
        }
    }
    if (!matchMedia('(prefers-reduced-motion: reduce)').matches)
        document.querySelectorAll('[data-progress-id]').forEach(el => { const bar = el.querySelector('i'), old = oldProgress.get(el.dataset.progressId), next = bar.style.width; if (old && old !== next) {
            bar.style.width = old;
            requestAnimationFrame(() => { if (bar.isConnected)
                bar.style.width = next; });
        } });
    document.querySelectorAll('[data-home-preference]').forEach(el => el.addEventListener('click', () => { homePreference = el.dataset.homePreference; render(); }));
}
function journeyRecoveryNotice() { const ids = Object.keys(state.journeyRecovery?.records ?? {}).filter(id => canReadJourneyReview(state, id)); return ids.length ? '<section class="notice warning" data-journey-recovery><strong>' + ids.length + ' 段舊行程資料待核實</strong><p>原始記錄已保留，尚未補造或確認任何航段。你可以繼續使用其他完整行程及會員功能。</p></section>' : ''; }
function tripSelector() { const ids = [...new Set([...Object.keys(state.trips), ...Object.keys(state.journeys?.items ?? {})])].filter(id => M.canReadTrip(state, id)); return '<label class="trip-selector"><span>' + message('selectTrip') + '</span><select id="trip-switch" aria-label="' + message('selectTrip') + '"><option value="" disabled ' + (!ids.includes(state.selectedTripId ?? '') ? 'selected' : '') + '>' + message('chooseTrip') + '</option>' + ids.map(id => { const t = state.trips[id], j = state.journeys?.items[id]; return '<option value="' + id + '" ' + (id === state.selectedTripId ? 'selected' : '') + '>' + esc(id === M.STUDENT_TRIP ? message('studentTrip') : id === M.FAMILY_TRIP ? message('familyTrip') : t ? state.families[t.familyId].name + ' · ' + t.route.origin + ' → ' + t.route.destination : j.segments.map(x => x.from).join(' → ') + ' → ' + J.lastLeg(j).to + ' · 個人行程') + ' · ' + (j ? J.fullTime(j.segments[0].departure).slice(0, 10) : t.route.date) + '</option>'; }).join('') + '</select></label><p class="meta" data-shared-clock>目前時間：' + J.fullTime(state.demoClock) + '（香港時間）</p>'; }
function familyBar() { const personal = M.studentAccount(state) && (view === 'student' || view === 'fund' || view === 'home' && presentation.home !== 'tasks' && presentation.home !== 'passport' || ['preparation', 'recovery', 'journey'].includes(view) && M.selectTrip(state).status === 'ok' && ('kind' in M.selectTrip(state) && M.selectTrip(state).kind === 'student')); if (personal)
    return ''; const families = D.familiesFor(state); if (!families.length)
    return ''; if (families.length === 1)
    return '<span class="family-context family-label">' + esc(families[0].name) + '</span>'; return '<div class="family-context"><label class="sr-only" for="family-switch">切换家庭</label><select id="family-switch" title="' + esc(state.families[state.activeFamilyId ?? '']?.name ?? '家庭空間') + '" ' + (!families.length ? 'disabled' : '') + '>' + (families.length ? families.map(f => '<option value="' + f.id + '" ' + (f.id === state.activeFamilyId ? 'selected' : '') + '>' + esc(f.name) + '</option>').join('') : '<option>个人空间 · 暂无家庭</option>') + '</select></div>'; }
function journeyCommit(next) { state = next; persist(); render(); }
function bindJourney() {
    document.querySelectorAll('[data-care-task-person]').forEach(el => el.onclick = () => { const p = ui.assistantCare?.profiles[el.dataset.careTaskPerson]; if (!p || !D.permitted(state, fId(), p.personId, 'care:edit'))
        return; ui.careDraft = p; render(); });
    document.querySelectorAll('[data-care-existing]').forEach(el => el.onclick = () => transition(() => { const r = state.requests[el.dataset.careExisting]; if (!r || !D.permitted(state, r.familyId, r.personId, 'service'))
        return; state.selectedTripId = r.tripId; setRoute('preparation'); presentation.preparation = 'detail'; presentation.request = r.id; syncPanelUrl(); render(); }));
    document.querySelectorAll('[data-notification-trip]').forEach(el => el.onclick = () => transition(() => { const j = state.journeys?.items[el.dataset.notificationTrip]; if (!j || !J.canReadJourney(state, j))
        return; guide.contextChanged(); if (j.familyId)
        state.activeFamilyId = j.familyId; state.selectedTripId = j.id; state.journeys.selectedId = j.id; persist(); setRoute('journey'); void guide.impact(j.notification.target); }));
    get('#journey-node')?.addEventListener('change', e => safe(() => { const j = J.currentJourney(state); journeyCommit(J.userJourneyAction(state, j.id, j.revision, 'node', e.target.value)); }));
    document.querySelectorAll('[data-journey-impact]').forEach(el => el.onclick = () => { const j = J.currentJourney(state); state = J.userJourneyAction(state, j.id, j.revision, 'seen', ''); persist(); void guide.impact(el.dataset.journeyImpact); });
    document.querySelectorAll('[data-journey-action]').forEach(el => el.onclick = () => safe(() => {
        const j = J.currentJourney(state), kind = el.dataset.journeyAction, value = el.dataset.value ?? '', bound = { id: j.id, revision: j.revision, actor: state.actorId, epoch: state.epoch };
        const valid = () => { if (state.actorId !== bound.actor || state.epoch !== bound.epoch || J.currentJourney(state)?.id !== bound.id || state.journeys?.items[bound.id]?.revision !== bound.revision)
            throw Error('操作对象或行程已经变化，请关闭后重新确认。'); };
        let body = '<p>为 ' + esc(personLabel(state, j.ownerId)) + ' 确认当前行程的操作 · 数据修订 ' + j.revision + '。</p>';
        if (kind === 'draft')
            body += '<p>将根据当前预计时间与所选交通生成草稿和待办，不发送消息或修改预订。</p>';
        if (kind === 'feedback') {
            features.feedback(j.id);
            return;
        }
        if (kind === 'feedback')
            body += '<label class="field"><span>本次出行体验（不改写服务确认回执）</span><textarea id="journey-feedback" maxlength="300" rows="3"></textarea></label>';
        if (kind === 'share') {
            const ids = [...new Set(state.memberships.filter(m => m.active && !state.families[m.familyId]?.archived && m.personId === j.ownerId).flatMap(m => D.familyMembers(state, m.familyId).map(x => x.personId)))].filter(x => x !== j.ownerId);
            body += '<p>预览：' + esc(personLabel(state, j.ownerId)) + ' 已自行确认安全抵达。仅分享这一状态，不包含地址、实时位置和照护资料。</p>' + ids.map(id => '<label class="check"><input type="checkbox" name="arrival-recipient" value="' + id + '">' + esc(personLabel(state, id)) + '</label>').join('') + '<p>確認將記錄你選擇的資料共享範圍。</p>';
        }
        modal(kind === 'share' ? '预览并授权报平安' : kind === 'feedback' ? '旅后反馈' : kind === 'draft' ? '创建联系草稿' : '确认我的行程进度', body, [{ label: '确认此操作', run: () => { valid(); let next = state; if (kind === 'school-arrived')
                    next = J.ingestEvent(state, J.makeEvent(j, 'school_arrived', {}, 'user_report'));
                else if (kind === 'feedback') {
                    const text = get('#journey-feedback').value.trim();
                    if (!text)
                        throw Error('请填写本次体验。');
                    next = J.ingestEvent(state, J.makeEvent(j, 'feedback_completed', { text }, 'user_report'));
                }
                else {
                    const v = kind === 'share' ? Array.from(dialog.querySelectorAll('input[name="arrival-recipient"]:checked')).map(e => e.value).join(',') : value;
                    next = J.userJourneyAction(state, j.id, j.revision, kind, v);
                } close(); journeyCommit(next); } }]);
    }));
}
function bindServiceRecords() {
    document.querySelectorAll('[data-future-service]').forEach(el => el.onclick = () => safe(() => { const j = J.currentJourney(state), x = j ? journeyModel(state, j).services.find(x => x.r.id === el.dataset.futureService) : undefined; if (!x || x.ended)
        throw Error('此航段已結束，請查看紀錄。'); if (['review', 'reconfirm'].includes(x.r.progress) && ['eligible', 'manual'].includes(x.r.applicability))
        submitModal(x.r.id);
    else
        modal('核對此未完成航段', '<p>' + personName(x.r.personId) + ' · ' + esc(x.label) + ' · ' + esc(x.status) + '</p><p>' + esc(x.r.missing.join('、') || '請按原受理回執及既有服務渠道核實。') + '</p><p>尚無新的服務確認；請聯絡原訂位服務方核對此航段，切勿為已抵達航段重複申請。</p>'); }));
    document.querySelectorAll('[data-service-record]').forEach(el => el.onclick = () => safe(() => { const r = state.requests[el.dataset.serviceRecord]; if (!r || !D.permitted(state, r.familyId, r.personId, 'care:view'))
        throw Error('目前沒有查看權限。'); modal('服務紀錄', readableTrip(state, r.tripId, r.segmentId) + '<p>' + personName(r.personId) + ' · ' + SERVICE_LABELS[r.kind] + ' · ' + serviceState(state, r).label + '</p>' + requestHistory(state, r)); }));
    document.querySelectorAll('[data-service-feedback]').forEach(el => el.onclick = () => safe(() => {
        const j = J.currentJourney(state);
        if (!j)
            return;
        const x = journeyModel(state, j).services.find(x => x.r.id === el.dataset.serviceFeedback);
        if (!x)
            throw Error('請重新核對本次服務。');
        const bound = { id: j.id, version: j.version, revision: j.revision, actor: state.actorId, account: state.activeAccountId, epoch: state.epoch, family: state.activeFamilyId };
        const valid = () => { if (state.actorId !== bound.actor || state.epoch !== bound.epoch || state.selectedTripId !== bound.id || J.currentJourney(state)?.revision !== bound.revision)
            throw Error('帳號或行程已變更，請重新核對。'); };
        const preview = (text) => { valid(); if (!text.trim())
            throw Error('請描述實際情況。'); modal('預覽服務問題草稿', '<p>旅客：' + personName(x.r.personId) + ' · ' + esc(x.label) + '</p><p>航段：' + esc(j.segments.find(seg => seg.id === x.r.segmentId)?.flight ?? '') + '</p><p>' + esc(text) + '</p><p>只保存上述問題、旅客及原申請識別資訊。請自行使用既有訂位／支援渠道聯絡服務方，本站未接入旅後客服受理接口。</p>', [{ label: '確認保存本地草稿', run: () => { valid(); void storage.write(current => { M.activateAccount(current, bound.account, { familyId: bound.family, tripId: bound.id }); const currentJ = current.journeys.items[bound.id]; if (current.epoch !== bound.epoch || currentJ.version !== bound.version || currentJ.revision !== bound.revision)
                    throw Error('行程已更新，請重新預覽。'); return saveServiceFeedback(current, currentJ, current.requests[x.r.id], text); }).then(async () => { close(); await refreshBusiness(); toast('已保存問題草稿；未發送，未建立客服個案。'); }).catch(e => { get('#modal-error').textContent = tc(e.message); }); } }]); };
        modal('回報本航段服務問題', '<p>' + personName(x.r.personId) + '的' + esc(x.label) + ' · 不會改寫原申請狀態。</p><label class="field"><span>實際情況（最多 300 字）</span><textarea id="service-feedback-text" maxlength="300" rows="3">' + esc(x.feedback?.text ?? '') + '</textarea></label>', [{ label: '預覽需保存的資料', run: () => preview(get('#service-feedback-text').value.trim()) }]);
    }));
}
function bindForms() {
    document.querySelectorAll('[data-trip-filter]').forEach(el => el.onclick = () => { tripFilter = el.dataset.tripFilter; sessionStorage.setItem('cx2-trip-filter', tripFilter); render(); });
    document.querySelectorAll('[data-work-trip]').forEach(el => el.onclick = () => transition(() => { const x = M.selectTrip(state, el.dataset.workTrip); if (x.status !== 'ok')
        throw Error(x.message); state.selectedTripId = x.id; state.journeys.selectedId = x.id; if (state.trips[x.id])
        state.activeFamilyId = state.trips[x.id].familyId; saveSession(); goScreen('journey:overview'); }));
    bindServiceRecords();
    demoControlsUI.bind();
    features.bind();
    experienceUI.bind();
    get('#trip-switch')?.addEventListener('change', e => { const id = e.target.value; transition(() => { if (!M.canReadTrip(state, id))
        throw Error('目前帳號無權存取這段行程'); guide.contextChanged(); state.selectedTripId = id; if (state.trips[id])
        state.activeFamilyId = state.trips[id].familyId; if (state.journeys?.items[id])
        state.journeys.selectedId = id; saveSession(); setRoute(view); }); });
    get('#account-switch')?.addEventListener('change', e => switchAccount(e.target.value));
    bindJourney();
    fundControls.bind();
    get('#family-switch')?.addEventListener('change', e => { const next = e.target.value; transition(() => { guide.contextChanged(); act({ type: 'switchFamily', familyId: next }, false); if (!M.studentAccount(state))
        state.selectedTripId = D.currentTrip(state, next)?.id ?? 'none:' + next; saveSession(); guide.contextChanged(); ui.careDraft = null; ui.passportId = null; ui.passportPage = 0; setRoute(view); }); });
    get('#mock-mode')?.addEventListener('change', e => safe(() => act({ type: 'mockMode', mode: e.target.value })));
    get('#reward-person')?.addEventListener('change', e => { ui.rewardPerson = e.target.value; render(); });
    get('#passport-person')?.addEventListener('change', e => { ui.passportId = e.target.value; ui.passportPage = 0; render(); });
    const care = get('#care-form');
    care?.addEventListener('input', () => { ui.careDraft = readCare(care); if (ui.assistantCare) {
        ui.assistantCare.profiles[ui.careDraft.personId] = ui.careDraft;
        ui.assistantCare.edited = true;
    } dirty = true; });
    care?.addEventListener('submit', e => { e.preventDefault(); safe(() => { const draft = readCare(care), context = guideContext(state); modal('確認儲存照護資料', '<p>' + esc(displayName(state.persons[draft.personId])) + ' · ' + draft.needs.map(k => SERVICE_LABELS[k]).join('、') + '</p><p>只更新這位成員的長期資料；不會提交或修改任何航段申請。</p>', [{ label: '確認儲存', run: async () => { if (JSON.stringify(context) !== JSON.stringify(guideContext(state)) || state.profiles[draft.familyId + ':' + draft.personId]?.version !== draft.version)
                throw Error('資料或授權已變更，請重新核對。'); await saveCareBatch([draft]); if (ui.assistantCare) {
                delete ui.assistantCare.profiles[draft.personId];
                ui.assistantCare.task.personIds = ui.assistantCare.task.personIds.filter(id => id !== draft.personId);
                ui.assistantCare.task.needs = ui.assistantCare.task.needs.filter(n => n.personId !== draft.personId);
                ui.careDraft = Object.values(ui.assistantCare.profiles)[0] ?? null;
                if (!ui.careDraft)
                    ui.assistantCare = undefined;
            }
            else
                ui.careDraft = null; dirty = !!ui.careDraft; close(); render(); toast('檔案已儲存；已有申請保持原樣，請複核行程快照。'); } }]); }); });
    const plan = get('#student-form');
    plan?.addEventListener('input', e => { calendarImport.edited(); ui.planDraft = readPlan(plan); const r = ui.planDraft.calendarImport, name = e.target.name; if (r && name in calendarPatch(r)) {
        r.reviewed = false;
        const box = get('[data-calendar-reviewed]');
        if (box)
            box.checked = false;
    } dirty = true; });
    plan?.addEventListener('change', e => { const r = ui.planDraft?.calendarImport; if (r && e.target.name in calendarPatch(r))
        render(); });
    plan?.addEventListener('submit', e => { e.preventDefault(); safe(() => { act({ type: 'plan', plan: readPlan(plan) }, false); ui.planDraft = null; dirty = false; presentation.student = 'input'; guide.beginStudentPlan(); render(); toast('已帶入查詢條件；請查詢並選擇航班，校曆不會改寫航班時間。'); }); });
    const intakeBox = get('#intake');
    if (intakeBox) {
        intakeBox.value = intakeText;
        intakeBox.addEventListener('input', () => { intakeText = intakeBox.value; intakePending++; dirty = !!intakeText.trim() || !!ui.careDraft || !!ui.planDraft; });
    }
    get('#intake-form')?.addEventListener('submit', e => { e.preventDefault(); void intake(sc(intakeText)); });
    get('#members-form')?.addEventListener('submit', e => { e.preventDefault(); safe(() => { const t = trip(); act({ type: 'members', familyId: fId(), tripId: t.id, personIds: new FormData(e.target).getAll('person').map(String) }); toast('已确认实际同行人，请预览本次照护需求。'); }); });
    document.querySelectorAll('[data-trip-check]').forEach(el => el.addEventListener('change', () => safe(() => act({ type: 'check', familyId: fId(), tripId: trip().id, key: el.dataset.tripCheck, value: el.checked }))));
    document.querySelectorAll('[data-learn-check]').forEach(el => el.addEventListener('change', () => safe(() => { const p = D.clone(ui.planDraft ?? state.plans[state.actorId]); if (el.dataset.learnCheck === 'calendar')
        p.calendarConfirmed = el.checked;
    else
        p.checks[el.dataset.learnCheck] = el.checked; act({ type: 'plan', plan: p }, false); ui.planDraft = null; dirty = false; render(); })));
}
function readCare(form) { const d = new FormData(form), p = D.clone(ui.careDraft ?? state.profiles[fId() + ':' + form.dataset.person]); p.needs = d.getAll('need').map(String); p.required = d.getAll('required').map(String); for (const k of ['months', 'weight'])
    if (d.has(k))
        p[k] = d.get(k) === '' ? null : Number(d.get(k)); for (const k of ['walking', 'stairs', 'wheelchairType', 'equipment'])
    if (d.has(k))
        p[k] = String(d.get(k) ?? ''); return p; }
function readPlan(form) { const d = new FormData(form), p = D.clone(ui.planDraft ?? state.plans[state.actorId]); for (const k of ['school', 'start', 'exam', 'holiday', 'holidayEnd', 'graduation', 'dorm', 'departure', 'visa', 'origin', 'destination', 'homeAirport'])
    p[k] = String(d.get(k) ?? ''); p.budget = Number(d.get('budget')); p.bags = Number(d.get('bags')); p.scenario = d.get('scenario'); p.selected = null; p.saved = false; p.calendarConfirmed = false; return p; }
function registration(continuation, personId = state.actorId) { const p = state.persons[personId], a = D.age(p, state.demoClock); if (D.account(state, personId)) {
    continuation();
    return;
} modal('建立帳號 · 保存這段旅程', '<p>为 ' + esc(displayName(p)) + ' 建立帳號。你的表單和已選方案會保留。</p>' + chip(a < 2 ? '尚未符合入會年齡' : '年齡符合入會條件', a < 2 ? 'warning' : 'neutral') + (a < 18 ? '<label class="field"><span>监护人核对</span><select id="register-guardian">' + p.guardianIds.map(id => '<option value="' + id + '">' + esc(displayName(state.persons[id])) + '</option>').join('') + '</select></label>' : '') + '<label class="check spaced"><input id="register-agree" type="checkbox">已核對資料，同意建立帳號</label>', [{ label: '建立帳號並繼續', run: () => { act({ type: 'register', personId, agree: get('#register-agree').checked, guardianId: get('#register-guardian')?.value }, false); close(); continuation(); } }]); }
function planUpdate(fn) { if (!canPlan(state))
    throw Error(message('STUDENT_ACCESS_REQUIRED')); const p = D.clone(ui.planDraft ?? state.plans[state.actorId]); fn(p); act({ type: 'plan', plan: p }, false); ui.planDraft = null; dirty = false; render(); }
function manageFamily() { const f = fId(), owner = D.membership(state, f)?.role === 'owner'; modal('管理 ' + esc(state.families[f].name), btn('创建家庭', 'create-family', '', 'secondary') + '<p class="meta">家庭角色、照护关系和法律监护分别记录。邀请不会自动共享照护资料。</p><label class="field"><span>家庭名称</span><input id="family-name" value="' + esc(state.families[f].name) + '" ' + (!owner ? 'disabled' : '') + '></label>' + btn('保存名称', 'rename-family', !owner ? 'disabled' : '', 'secondary') + '<div class="management-members">' + D.familyMembers(state, f).map(m => '<div><span>' + personName(m.personId) + '<small>' + ROLES[m.role] + ' · ' + (D.account(state, m.personId) ? '已关联会员' : '旅客档案') + '</small></span>' + btn('资料与授权', 'member-info', 'data-person="' + m.personId + '"', 'ghost') + (owner && m.personId !== state.actorId ? '<select data-role-person="' + m.personId + '" aria-label="' + personName(m.personId) + '的角色">' + Object.entries(ROLES).map(([r, label]) => '<option value="' + r + '" ' + (m.role === r ? 'selected' : '') + '>' + label + '</option>').join('') + '</select>' : '') + '</div>').join('') + '</div>' + (owner ? '<hr>' + btn('邀請家人', 'invite', '', 'secondary') + btn('新增旅客档案', 'new-person', '', 'ghost') : '') + '<hr>' + btn(owner ? '归档此家庭' : '退出此家庭', owner ? 'archive-family' : 'leave-family', '', 'danger') + '<p class="meta">退出或归档不删除个人会员、里数和成长记录。</p>'); dialog.querySelectorAll('[data-role-person]').forEach(el => el.addEventListener('change', () => safe(() => { act({ type: 'role', familyId: f, personId: el.dataset.rolePerson, role: el.value }); toast('家庭角色已更新，授权范围未自动扩大。'); }))); }
function memberInfo(personId) { const p = state.persons[personId], a = D.age(p, state.demoClock), acc = D.account(state, personId), f = fId(), ownPerson = state.actorId === personId || (a < 18 && p.guardianIds.includes(state.actorId)); modal(personName(personId) + '的会员与授权', '<div class="member-head">' + avatar(displayName(p)) + '<div><h2>' + personName(personId) + '</h2><p>' + a + ' 岁 · ' + (acc ? '已关联个人会员' : '旅客档案') + '</p></div></div>' + (acc && D.permitted(state, f, personId, 'miles') ? '<p>个人 Asia Miles：' + D.balance(state, personId).toLocaleString() + ' 里 · 有效期 ' + acc.expiry + '</p>' : '') + '<p class="meta">监护人：' + (p.guardianIds.map(personName).join('、') || '无关联 / 成年人本人管理') + '。管理员身份不替代监护关系。</p>' + (!acc ? (a < 2 ? '<div class="notice">未满两岁，仅保留旅客照护档案，没有里数账户。</div>' : btn('監護核對並建立帳號', 'register-child', 'data-person="' + personId + '"', 'secondary')) : '') + (ownPerson ? '<hr><h3>个人身份资料</h3><label class="field"><span>姓名（虚构）</span><input id="person-name" value="' + esc(displayName(p)) + '"></label><label class="field"><span>昵称</span><input id="person-nickname" value="' + esc(p.nickname) + '"></label>' + btn('保存身份资料', 'save-person', 'data-person="' + personId + '"', 'secondary') + '<hr><h3>本家庭共享范围</h3><label class="field"><span>共享给谁</span><select id="consent-grantee">' + D.familyMembers(state, f).filter(m => m.personId !== personId).map(m => '<option value="' + m.personId + '">' + personName(m.personId) + '</option>').join('') + '</select></label><div class="checks-grid">' + [['care:view', '查看照护需求'], ['care:edit', '编辑照护需求'], ['service', '協助提交服務需求'], ['passport', '查看授权成长记录'], ['miles', '参考个人里数']].map(([v, l]) => '<label class="check"><input type="checkbox" name="consent-scope" value="' + v + '">' + l + '</label>').join('') + '</div>' + btn('同意所选范围', 'consent', 'data-person="' + personId + '" data-agree="1"', 'secondary') + btn('撤回对此人的共享', 'consent', 'data-person="' + personId + '" data-agree="0"', 'ghost') : '<div class="notice">你不能替这位成年人扩大资料共享范围。可切换到本人帳號核对。</div>') + '<p class="meta">转里数不在本次授权范围内。满足相关账户、飞行记录和转移规则后才可办理，不以入会一年作为唯一条件。</p>'); }
async function intake(text) {
    const f = fId(), actor = state.actorId, account = state.activeAccountId, epoch = state.epoch, request = ++intakePending;
    const valid = () => state.activeFamilyId === f && state.actorId === actor && state.activeAccountId === account && state.epoch === epoch && request === intakePending;
    const error = (text) => { if (valid()) {
        const box = get('#intake-error');
        if (box)
            box.textContent = tc(text);
    } };
    error('正在整理本次需求…');
    try {
        const requestId = crypto.randomUUID(), reply = await assistantProvider().understand({ requestId, context: guideContext(state), text });
        if (!valid())
            return;
        if (!validateToolRequest(reply, requestId))
            throw Error('需求回應未通過校驗，請使用結構化表單。');
        if (reply.cancel) {
            error(reply.message ?? '已停止整理，沒有修改資料。');
            return;
        }
        const items = D.extraction(state, f, text);
        if (!items.length) {
            error('請明確寫出服務需要，例如輪椅、相鄰座位或兒童餐；不會只按年齡或稱呼猜測需求。');
            return;
        }
        error('需求草稿已整理，請核對成員與缺項。');
        const viewOnly = D.membership(state, f)?.role === 'viewer';
        const missing = items.map(item => item.kind === 'wheelchair' ? '輪椅：請核對步行、登梯與設備需要' : item.kind === 'bassinet' ? '嬰兒籃：請核對月齡、體重與機型' : '請核對本人的偏好及實際同行安排');
        modal('核對照護需求草稿', '<p>僅使用你輸入的內容與目前家庭成員，不讀取未授權的照護詳情。</p>' + items.map((item, i) => '<label class="field"><span>' + esc(SERVICE_LABELS[item.kind]) + ' · ' + (item.personIds.length === 1 ? '候選成員' : '請澄清成員') + '</span><select id="extract-' + i + '"><option value="">請確認對應成員</option>' + item.personIds.map(p => '<option value="' + p + '" ' + (item.personIds.length === 1 ? 'selected' : '') + '>' + personName(p) + '</option>').join('') + '</select></label>').join('') + '<ul>' + missing.map(x => '<li>' + esc(x) + '</li>').join('') + '</ul>' + (viewOnly ? '<p class="notice">目前僅可查看，儲存修改需取得授權。草稿尚未交接；請自行聯絡家庭管理員或成員本人。</p>' : '<p>確認只新增需求；已有申請不會被改寫，也不會自動提交。</p>'), viewOnly ? [] : [{ label: '確認並儲存需求', run: () => {
                    if (!valid())
                        throw Error('帳號或家庭已變更，請重新整理需求。');
                    const selected = items.map((item, i) => ({ kind: item.kind, personId: get('#extract-' + i).value }));
                    if (selected.some(x => !x.personId || !D.permitted(state, f, x.personId, 'care:edit')))
                        throw Error('請選擇具備編輯授權的成員；未授權資料不會儲存。');
                    void storage.write(current => { M.activateAccount(current, account, { familyId: f, tripId: state.selectedTripId }); if (current.epoch !== epoch)
                        throw Error('資料空間已變更'); let next = current; for (const item of selected) {
                        if (!D.permitted(next, f, item.personId, 'care:edit'))
                            throw Error('授權已變更，請重新核對。');
                        const p = D.clone(next.profiles[f + ':' + item.personId]);
                        p.needs = [...new Set([...p.needs, item.kind])];
                        next = D.reduce(next, { type: 'care', profile: p });
                    } return next; }).then(async () => { if (!valid())
                        return; intakeText = ''; dirty = !!ui.careDraft || !!ui.planDraft; close(); await refreshBusiness(); toast('已更新對應成員的需求；請在結構化表單補充所列資料。'); }).catch(e => { if (valid())
                        get('#modal-error').textContent = tc(e.message); });
                } }]);
    }
    catch (e) {
        error(e.message + ' 可繼續使用結構化編輯。');
    }
}
function importCare() { void services.open(trip().id).catch(e => toast(e.message)); }
function submitModal(requestId) { const r = state.requests[requestId]; if (r)
    void services.open(r.tripId).catch(e => toast(e.message)); }
function annualReport(personId) { const p = state.persons[personId]; if (!p.guardianIds.includes(state.actorId) && state.actorId !== personId)
    throw Error('分享預覽須由本人或已關聯監護人確認。'); const year = state.demoClock.slice(0, 4), records = stampViews(state, personId).filter(st => !st.pending && st.date.slice(0, 4) === year), accountId = state.activeAccountId; modal('年度成長報告 · 分享前預覽', '<div class="annual-card"><h2>' + esc(displayName(p)) + '的成長旅程</h2><p>' + year + ' · ' + records.length + ' 枚已完成章 · ' + new Set(records.map(st => st.city)).size + ' 座城市</p><div class="stamp-grid">' + (records.map(st => passportStamp(st, 'report', false)).join('') || '<p>期待下一段完成的旅程。</p>') + '</div></div><p class="meta">僅分享已獲授權的完成紀錄，不包含生日、未來行程或照護資料。</p><label class="check"><input id="report-agree" type="checkbox">我已預覽並同意匯出這份年報</label>', [{ label: '匯出年報圖片', run: async () => { if (!get('#report-agree').checked)
            throw Error('請先預覽並確認匯出內容。'); if (accountId !== state.activeAccountId)
            throw Error('帳號已變更，請重新預覽。'); const current = stampViews(state, personId).filter(st => !st.pending && st.date.slice(0, 4) === year); if (JSON.stringify(current) !== JSON.stringify(records))
            throw Error('紀錄或授權已變更，請重新預覽。'); const blob = await exportPassport(displayName(p), year, records); if (accountId !== state.activeAccountId || JSON.stringify(stampViews(state, personId).filter(st => !st.pending && st.date.slice(0, 4) === year)) !== JSON.stringify(records))
            throw Error('紀錄或授權已變更，請重新預覽。'); downloadBlob('cathay-connects-growth-' + year + '.png', blob); toast('已產生年報圖片。'); } }]); }
let downloadUrl = null;
function downloadBlob(name, blob) { if (downloadUrl)
    URL.revokeObjectURL(downloadUrl); downloadUrl = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = downloadUrl; a.download = name; a.click(); const place = get('.modal-actions'); if (place) {
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = name;
    link.className = 'button secondary';
    link.textContent = '再次下载文件';
    place.append(link);
} }
function legacyTaskModal(taskId, personId) { const task = TASKS.find(t => t.id === taskId); modal(task.title, '<p>' + esc(task.body) + '</p>' + (task.kind === 'quiz' ? task.options.map((o, i) => '<label class="check quiz-option"><input type="radio" name="quiz-answer" value="' + i + '">' + o + '</label>').join('') : '<label class="check"><input id="read-confirm" type="checkbox">已经阅读并核对准备内容</label>') + '<p class="meta">完成后可领取 ' + task.reward + ' 里，记入 ' + personName(personId) + ' 的个人账户。</p>', [{ label: '确认完成', run: () => { act({ type: 'completeTask', personId, taskId, familyId: fId(), answer: Number(get('input[name="quiz-answer"]:checked')?.value ?? -1), confirmed: get('#read-confirm')?.checked }); close(); toast('已完成，可在任务卡领取奖励。'); } }]); }
const actions = {
    ...fundControls.actions,
    'calendar-month': el => { ui.calendarMonth = el.dataset.month; render(); },
    'calendar-day': el => planUpdate(p => { p.departure = el.dataset.date; p.selected = null; }),
    'seat-preference': () => { const t = trip(); act({ type: 'check', familyId: fId(), tripId: t.id, key: 'seatWindow', value: !t.checklist.seatWindow }); },
    'onboard': () => { const t = trip(); act({ type: 'check', familyId: fId(), tripId: t.id, key: 'onboard', value: true }); toast('已開啟機上探索任務。'); },
    'wait-care': el => { const t = trip(), key = 'wait-' + el.dataset.kind; modal(el.dataset.label + ' · 协助摘要', '<p>' + t.members.length + ' 位同行人 · ' + t.route.origin + ' — ' + t.route.destination + '</p><p>记录这次行程的协助意向，具体位置、服务和费用由工作人员核实。不会实际预约或发放权益。</p>', [{ label: '保存协助摘要', run: () => { act({ type: 'check', familyId: fId(), tripId: t.id, key, value: true }); close(); toast('协助意向已保存在这次家庭行程。'); } }]); },
    'batch-submit': () => batchSubmit(),
    'claim-kit': el => { act({ type: 'claimKit', personId: el.dataset.person }); close(); toast('独自出行礼包已领取，原账号与成长记录保留。'); },
    'kit-planner': el => { if (state.actorId !== el.dataset.person)
        throw Error('请切换到本人帳號后继续。'); close(); setRoute('student'); },
    'create-family': () => registration(() => modal('创建一个家庭空间', '<label class="field"><span>家庭名称</span><input id="new-family-name" placeholder="例如：周末一起出发" maxlength="30"></label><p class="meta">你将成为协作管理员，不自动成为其他成员的法律监护人。</p>', [{ label: '创建家庭', run: () => { act({ type: 'createFamily', name: get('#new-family-name').value }, false); close(); setRoute('home'); } }])),
    'manage-family': () => manageFamily(), 'rename-family': () => { act({ type: 'renameFamily', familyId: fId(), name: get('#family-name').value }); close(); toast('家庭名称已更新。'); },
    'new-person': () => modal('新增获授权的旅客档案', '<p>先保存旅客资料，不强制注册会员。</p><label class="field"><span>姓名</span><input id="new-person-name" maxlength="30"></label><label class="field"><span>出生日期</span><input id="new-person-dob" type="date" value="2020-06-01"></label><label class="check"><input id="new-person-guardian" type="checkbox">如为未成年人，我已核对自己是其監護人</label>', [{ label: '创建旅客档案', run: () => { act({ type: 'newPerson', familyId: fId(), name: get('#new-person-name').value, dob: get('#new-person-dob').value, guardianConfirmed: get('#new-person-guardian').checked }); manageFamily(); toast('旅客档案已创建。符合年龄条件后，可在成员资料中建立帳號。'); } }]),
    'invite': () => features.links('family'),
    'accept-invite': el => { const id = el.dataset.invitation; modal('接受邀請', '<p>接受后关联同一个 Person 与会员账户，不自动开启照护资料共享。</p><label class="check"><input id="invite-agree" type="checkbox">本人接受邀請及必要的註冊</label>', [{ label: '確認接受', run: () => { act({ type: 'acceptInvite', invitationId: id, agree: get('#invite-agree').checked }); close(); toast('已关联家庭成员，资料授权仍需单独确认。'); } }]); },
    'archive-family': () => modal('归档这个家庭？', '<p>家庭不再出现在切换器中。個人帳號、里數和成長記錄保留。</p>', [{ label: '归档家庭', run: () => { act({ type: 'archiveFamily', familyId: fId() }, false); close(); setRoute('home'); } }]),
    'leave-family': () => modal('退出这个家庭？', '<p>退出不删除个人会员、里数或成长记录。</p>', [{ label: '确认退出', run: () => { act({ type: 'leaveFamily', familyId: fId() }, false); close(); setRoute('home'); } }]),
    'member-info': el => memberInfo(el.dataset.person), 'save-person': el => { act({ type: 'person', personId: el.dataset.person, name: get('#person-name').value, nickname: get('#person-nickname').value }); close(); },
    'register-child': el => { const pid = el.dataset.person; close(); registration(() => { render(); toast('帳號已建立，成长记录仍属于同一个人。'); }, pid); },
    'consent': el => { const f = fId(); act({ type: 'consent', familyId: f, personId: el.dataset.person, granteeId: get('#consent-grantee').value, scopes: Array.from(dialog.querySelectorAll('input[name="consent-scope"]:checked')).map(x => x.value), agree: el.dataset.agree === '1' }); for (const key of Object.keys(state.messages))
        if (key.startsWith('family:' + f + ':'))
            delete state.messages[key]; persist(); close(); toast('已更新本家庭的共享范围。'); },
    'edit-care': el => { transition(() => { ui.careDraft = D.clone(state.profiles[fId() + ':' + el.dataset.person]); dirty = false; render(); }); }, 'cancel-care': () => { ui.careDraft = null; ui.assistantCare = undefined; dirty = false; render(); },
    'relationship': el => { const pid = el.dataset.person, f = fId(), r = state.relationships.find(x => x.familyId === f && x.dependentId === pid); modal('谁照顾 ' + personName(pid) + '？', '<label class="field"><span>本家庭成年照护人</span><select id="caregiver">' + D.familyMembers(state, f).filter(m => m.personId !== pid && D.age(state.persons[m.personId], state.demoClock) >= 18).map(m => '<option value="' + m.personId + '" ' + (r?.caregiverId === m.personId ? 'selected' : '') + '>' + personName(m.personId) + '</option>').join('') + '</select></label><label class="check"><input id="relationship-required" type="checkbox" ' + (r?.required ? 'checked' : '') + '>必要照护条件，改签时必须保持同行相邻</label><p class="meta">此设置不更改法律监护人关联。</p>', [{ label: '保存照护关系', run: () => { act({ type: 'relationship', familyId: f, dependentId: pid, caregiverId: get('#caregiver').value, required: get('#relationship-required').checked }); close(); } }]); },
    'copy-care': el => { const pid = el.dataset.person, target = fId(), sources = D.familiesFor(state).filter(f => f.id !== target && D.permitted(state, f.id, pid, 'care:view')); modal('从其他家庭复制需求', '<p>目标：' + esc(state.families[target].name) + ' / ' + personName(pid) + '</p><label class="field"><span>有权限读取的来源</span><select id="copy-family">' + sources.map(f => '<option value="' + f.id + '">' + esc(f.name) + '：' + state.profiles[f.id + ':' + pid].needs.map(k => SERVICE_LABELS[k]).join('、') + '</option>').join('') + '</select></label><p>复制所选成员的需求与字段，覆盖目标家庭的长期档案；不影响其他家庭或已提交申请。</p>', [{ label: '确认复制到此家庭', run: () => { const source = get('#copy-family').value; if (!source)
                throw Error('没有获授权的来源家庭。'); act({ type: 'copyCare', fromFamily: source, toFamily: target, personId: pid, confirmed: true }); close(); } }]); },
    'intake-submit': () => { }, 'route': () => startPlanning(), 'import-care': () => importCare(), 'submit': el => submitModal(el.dataset.request),
    'confirm-service': () => { throw Error('服務確認須由本航段的獨立回覆更新，不能手動勾選。'); },
    'query-request': el => { const rid = el.dataset.request; modal('查询原请求', '<p>先使用原请求标识核实受理结果。不会创建新申请。</p>', [{ label: '查詢結果：已受理', run: () => { act({ type: 'query', requestId: rid, found: true }); close(); } }, { label: '查詢結果：未受理', style: 'secondary', run: () => { act({ type: 'query', requestId: rid, found: false }); close(); } }]); },
    'ticket': el => { const r = state.requests[el.dataset.request]; void services.open(r.tripId); },
    'disrupt': el => { const t = trip(); act({ type: 'disruption', familyId: fId(), tripId: t.id, event: el.dataset.event }, false); setRoute('recovery'); },
    'rebook': el => { const t = trip(), f = fId(), c = D.candidates(state, t).find(c => c.id === el.dataset.candidate); if (!c?.eligible)
        throw Error('候選不符合必要條件，請重新比較。'); const account = state.activeAccountId, tripId = t.id, fingerprint = c.evaluation.fingerprint; modal('確認全家的新行程', '<h3>' + c.route.number + '</h3><p>' + c.route.date + ' ' + c.route.departure + ' → ' + c.route.arrival + '</p><p>' + c.evaluation.travellerCount + ' 位旅客，需要 ' + c.evaluation.requiredSeatCount + ' 個座位；參考差額 ' + money(c.difference) + '</p>' + assignmentList(state, c) + '<p>照護相鄰按示意座位塊通過。需求帶入，新服務仍須獨立回執。</p>', [{ label: '確認更新行程', run: () => { if (account !== state.activeAccountId || state.selectedTripId !== tripId)
                throw Error('帳號或行程已切換，請重新預覽。'); void (async () => { try {
                await storage.flush();
                await storage.write(shared => { M.activateAccount(shared, account, { familyId: f, tripId }); return M.syncFamilyJourney(D.reduce(shared, { type: 'rebook', familyId: f, tripId, candidateId: c.id, confirmed: true, expectedFingerprint: fingerprint })); });
                close();
                await refreshBusiness();
                toast('已建立新行程版本，請核對服務。');
            }
            catch (e) {
                const box = get('#modal-error');
                if (box)
                    box.textContent = tc(e.message);
            } })(); } }]); },
    'family-ticket': () => { const t = trip(); modal('全家行程人工核实', '<p>' + esc(state.families[fId()].name) + ' · ' + t.route.origin + ' — ' + t.route.destination + ' · ' + t.members.length + ' 位旅客</p><p>无匹配方案，保留现有记录和必要照护关系。</p>' + (t.checklist.manualTicket ? '<p>已保存本次行程跟進紀錄。</p>' : '<label class="check"><input id="family-ticket-agree" type="checkbox">授权使用上述摘要创建工单</label>'), t.checklist.manualTicket ? [] : [{ label: '保存跟進紀錄', run: () => { if (!get('#family-ticket-agree').checked)
                throw Error('请先授权。'); act({ type: 'check', familyId: fId(), tripId: t.id, key: 'manualTicket', value: true }); close(); toast('已保存跟進紀錄，原行程保持不变。'); } }]); },
    'align-dorm': () => planUpdate(p => { p.departure = p.dorm; p.accommodation = false; p.checks.accommodation = true; }),
    'confirm-accommodation': () => modal('自行落实提前抵达住宿', '<p>计划会保留提前抵达日期与住宿估价。请在真实出行前自行确认房源及费用。</p>', [{ label: '確認已安排住宿', run: () => { planUpdate(p => { p.accommodation = true; p.checks.accommodation = true; }); close(); } }]),
    'calendar-preview': () => { const value = get('select[name="schoolSample"]').value; if (value === '')
        throw Error('先选择一份校曆範本。'); const school = SCHOOLS[Number(value)]; modal('預覽校曆', '<h3>' + esc(schoolLabel(school.name)) + '</h3><div class="preview-list">' + Object.entries(school).filter(([k]) => !['name', 'destination'].includes(k)).map(([k, v]) => '<div><span>' + { start: '开学', dorm: '宿舍开放', exam: '考试', holiday: '假期开始', holidayEnd: '假期结束', graduation: '毕业' }[k] + '</span><strong>' + date(v) + '</strong></div>').join('') + '</div><p class="meta">導入後請核對日期，可按你的安排修改。</p>', [{ label: '导入到我的计划', run: () => registration(() => { planUpdate(p => { Object.assign(p, school); p.school = schoolLabel(school.name); p.calendarConfirmed = false; p.saved = false; p.selected = null; }); close(); }) }]); },
    'student-flights': () => { guide.beginStudentPlan(); render(); },
    'select-fare': () => { guide.beginStudentPlan(); render(); },
    'open-account': () => { document.querySelector('.account-menu').open = true; get('#account-switch')?.focus(); },
    'basic-search': () => modal('一般航班試算', '<p>所有身份均可使用一般航線試算；不讀取學生校曆或私人計劃。</p><label class="field"><span>起點</span><select id="search-origin">' + AIRPORTS.map(a => '<option value="' + a.code + '">' + a.code + ' · ' + a.city + '</option>').join('') + '</select></label><label class="field"><span>終點</span><select id="search-destination">' + AIRPORTS.map(a => '<option value="' + a.code + '" ' + (a.code === 'LHR' ? 'selected' : '') + '>' + a.code + ' · ' + a.city + '</option>').join('') + '</select></label><div id="search-result" aria-live="polite"></div>', [{ label: '試算航班', run: () => { const r = buildItinerary({ origin: get('#search-origin').value, destination: get('#search-destination').value, date: '2027-01-08', budget: 30000 }); get('#search-result').textContent = r.origin + ' → ' + r.destination + ' · ' + money(r.adultFare) + '（參考票價）'; } }]),
    'save-plan': () => { const form = get('#student-form'), p = form ? readPlan(form) : D.clone(ui.planDraft ?? state.plans[state.actorId]); validateCalendarPlan(p); modal('核對並保存校曆', '<p>' + esc(p.school) + ' · ' + esc(p.start) + ' 開學</p><p>請確認所有日期來自你已核對的校曆。保存後可自行領取校曆任務獎勵；不會自動入帳或建立行程。</p>', [{ label: '已核對，保存校曆', run: async () => { const accountId = state.activeAccountId, context = { familyId: state.activeFamilyId, tripId: state.selectedTripId }; await storage.write(current => { let s = M.activateAccount(current, accountId, context); s = D.reduce(s, { type: 'plan', plan: { ...p, calendarConfirmed: true } }); s = D.reduce(s, { type: 'savePlan', personId: s.actorId }); s.plans[s.actorId].calendarConfirmed = true; confirmCalendar(s, s.plans[s.actorId]); return s; }); ui.planDraft = null; dirty = false; close(); await refreshBusiness(); guide.resumeStudentIntent(); render(); toast('校曆已保存。獎勵可在任務區自行領取。'); } }]); },
    'subscribe': () => registration(() => { act({ type: 'subscribe', personId: state.actorId }); toast('已儲存訂閱。'); }),
    'share-plan': () => registration(() => modal('邀请家人协助这份计划', '<label class="field"><span>选择有权限的家庭</span><select id="share-family">' + D.familiesFor(state).map(f => '<option value="' + f.id + '">' + esc(f.name) + '</option>').join('') + '</select></label><label class="field"><span>允许共享的范围</span><select id="share-scope"><option value="dates">仅出发与开学日期</option><option value="summary">目标路线与上述日期</option></select></label><p class="meta">不共享签证、住宿资料或其他家庭记录。</p>', [{ label: '确认共享范围', run: () => { act({ type: 'sharePlan', personId: state.actorId, familyId: get('#share-family').value, scope: get('#share-scope').value }); close(); } }])),
    'complete-learn': () => registration(() => { act({ type: 'completeTask', personId: state.actorId, taskId: 'calendar-learn', familyId: null }); toast('已完成，可领取 100 里獎勵。'); }),
    'task': el => taskModal(el.dataset.task, el.dataset.person),
    'claim': el => { const key = el.dataset.key; if (state.dual) {
        const account = state.activeAccountId, progress = state.tasks[key], task = TASKS.find(t => t.id === progress?.taskId);
        if (!progress || progress.personId !== state.actorId || !task)
            throw Error('這項獎勵不屬於目前帳號。');
        modal('確認領取任務獎勵', '<p>' + esc(task.title) + ' · ' + task.reward + ' 里數</p><p>計入目前會員的普通里數，與回家基金分開。回執成功才入帳。</p>', [{ label: '確認領取', run: () => { if (account !== state.activeAccountId)
                    throw Error('帳號已變更，請重新核對。'); close(); demoControlsUI.legacyClaim(key); } }]);
        return;
    } act({ type: 'claim', key }, false); const p = state.tasks[key], epoch = state.epoch, mode = state.mockMode; render(); if (p.status === 'processing')
        setTimeout(() => act({ type: 'rewardReceipt', key, attempt: p.attempt, epoch, success: !['failure', 'timeout'].includes(mode) }), mode === 'delay' ? 8000 : 900); },
    'passport-prev': () => { ui.passportPage = Math.max(0, ui.passportPage - 1); render(); }, 'passport-next': () => { ui.passportPage++; render(); },
    'annual-report': el => annualReport(el.dataset.person),
    'passport-stamp': el => { modal('飛行紀錄', stampDetail(state, el.dataset.person, el.dataset.stamp), []); get('#cancel-modal').textContent = '關閉'; get('[data-passport-trip]')?.addEventListener('click', e => { const id = e.currentTarget.dataset.passportTrip; close(); const x = M.selectTrip(state, id); if (x.status !== 'ok')
        throw Error(x.message); state.selectedTripId = id; state.journeys.selectedId = id; if (state.trips[id])
        state.activeFamilyId = state.trips[id].familyId; goScreen(state.trips[id]?.status === 'completed' ? 'journey:posttrip' : 'preparation:checklist'); }); },
    'graduation': el => graduation(el.dataset.person),
    'verify-student': el => { const pid = el.dataset.person; modal('學生身份核對', '<p>請核對並記錄本人的學生身份。</p>', [{ label: '確認本人學生身份', run: () => { act({ type: 'verifyStudent', personId: pid }); close(); toast('已記錄學生身份，个人历史保持不变。'); } }]); },
    'goal': () => modal('设置家庭参考目标', '<label class="field"><span>下次旅行目标里数</span><input id="goal-amount" type="number" min="1000" max="1000000" value="' + state.families[fId()].goal + '"></label><p>只是目标和获授权参考汇总，不创建家庭共同钱包。</p>', [{ label: '保存目标', run: () => { act({ type: 'goal', familyId: fId(), amount: Number(get('#goal-amount').value) }); close(); } }]),
    'events': () => modal('操作記錄', '<p class="meta">记录匿名 ID 与业务事件，不记录照护内容。不计算虚构商业转化率。</p><div class="event-list">' + (state.events.length ? state.events.slice(-30).reverse().map(e => '<div><strong>' + e.type + '</strong><span>' + esc([e.familyId, e.tripId, e.personId, e.memberId].filter(Boolean).join(' · ')) + '</span><small>' + e.at + '</small></div>').join('') : '尚无事件，完成注册、保存、申请或奖励操作后会出现。') + '</div>'),
};
document.addEventListener('click', e => {
    const target = e.target;
    if (target.closest('[data-retained-draft]')) {
        const saved = JSON.parse(sessionStorage.getItem(draftKey() + ':retained') ?? 'null');
        if (saved)
            modal('本帳號保留草稿', '<p>此草稿來自舊行程或資料版本，未自動套用。請核對後在目前表單重新輸入；不會自動申請或扣款。</p><pre style="white-space:pre-wrap;overflow-wrap:anywhere">' + esc(JSON.stringify(saved, null, 2)) + '</pre>', []);
        return;
    }
    const screen = target.closest('[data-screen]');
    if (screen) {
        e.preventDefault();
        transition(() => goScreen(screen.dataset.screen));
        return;
    }
    const service = target.closest('[data-service-detail]');
    if (service) {
        presentation.request = service.dataset.serviceDetail;
        goScreen('preparation:detail');
        return;
    }
    const care = target.closest('[data-business-care]');
    if (care) {
        transition(() => { const id = care.dataset.businessCare; if (!D.permitted(state, fId(), id, 'care:edit'))
            return; ui.careDraft = D.clone(state.profiles[fId() + ':' + id]); setRoute('care'); });
        return;
    }
    const fund = target.closest('[data-home-fund]');
    if (fund) {
        transition(() => { selectedFund = fund.dataset.homeFund; presentation.fund = selectedFund === M.FUND ? 'detail' : 'legacy'; setRoute('fund'); });
        return;
    }
    const learn = target.closest('[data-home-learn]');
    if (learn) {
        transition(() => { if (learn.dataset.homeLearn === 'calendar') {
            setRoute('student');
            const target = document.querySelector('[data-guide-id="student-dates"]');
            target?.classList.add('guide-highlight');
            target?.focus();
        }
        else {
            const task = state.dual?.tasks[learn.dataset.taskId];
            if (!task || task.personId !== state.actorId)
                return;
            state.selectedTripId = task.tripId;
            state.journeys.selectedId = task.tripId;
            setRoute('preparation');
            const row = document.querySelector('[data-task-id="' + task.taskId + '"]');
            row?.classList.add('guide-highlight');
            row?.setAttribute('tabindex', '-1');
            row?.focus();
        } });
        return;
    }
    const nav = target.closest('[data-view]');
    if (nav) {
        e.preventDefault();
        transition(() => setRoute(nav.dataset.view));
        return;
    }
    const q = target.closest('[data-question]');
    if (q) {
        void guide.send(q.dataset.question);
        return;
    }
    const a = target.closest('[data-action]');
    if (a && !a.hasAttribute('disabled')) {
        if (a.getAttribute('type') === 'submit')
            return;
        safe(() => { const fn = actions[a.dataset.action]; if (fn) {
            if (['save-plan', 'calendar-preview', 'select-fare', 'align-dorm', 'confirm-accommodation', 'complete-learn', 'subscribe', 'share-plan'].includes(a.dataset.action) && !canPlan(state))
                throw Error(message('STUDENT_ACCESS_REQUIRED'));
            fn(a);
        }
        else
            throw Error('该功能仍在后续范围内。'); });
    }
});
window.addEventListener('popstate', () => { guide.cancel(false); transition(() => { readLocation(); render(); }); });
dialog.addEventListener('cancel', event => { event.preventDefault(); close(); render(); });
window.addEventListener('beforeunload', e => { if (dirty) {
    e.preventDefault();
    e.returnValue = '';
} });
storage.onChange = () => { void refreshBusiness().catch(e => toast('同步暂未完成：' + e.message)); };
setInterval(() => { void storage.settle().then(changed => { if (changed)
    return refreshBusiness(); }).catch(e => toast('交易待核实：' + e.message)); }, 700);
// Clock checks schedule real reminders only; they never replay a scene or mark a flight flown.
async function checkRuntimeSchedules() { if (document.visibilityState !== 'visible' || dirty || dialog.open)
    return; try {
    await storage.write(s => updateRuntimeClock(s));
    await refreshBusiness();
}
catch { } }
setInterval(() => void checkRuntimeSchedules(), 60000);
document.addEventListener('visibilitychange', () => void checkRuntimeSchedules());
let disruptionChecking = false;
async function checkDisruption() { if (disruptionChecking)
    return; disruptionChecking = true; try {
    const changed = await storage.settle();
    if (changed)
        await refreshBusiness(false);
    const presented = await flightChanges.claimPopup();
    if (changed && !presented)
        render();
}
catch (e) {
    console.warn('Flight change check deferred');
}
finally {
    disruptionChecking = false;
} }
setInterval(() => { void checkDisruption(); }, 100);
window.addEventListener('pageshow', () => void checkDisruption());
document.addEventListener('visibilitychange', () => void checkDisruption());
void checkDisruption();
new MutationObserver(() => flightChanges.bind()).observe(dialog, { childList: true, subtree: true });
function retainedDraftPanel() { return sessionStorage.getItem(draftKey() + ':retained') ? '<section class="notice"><p>此帳號有舊版本草稿，尚未套用至目前行程。</p><button class="button secondary" data-retained-draft>查看保留草稿</button></section>' : ''; }
const draftKey = () => 'cx2-safe-draft:' + space + ':' + state.activeAccountId + ':' + state.tripCleanup?.id;
function saveReleaseDraft() { const data = { tripRelease: state.tripCleanup?.release, accountId: state.activeAccountId, seedVersion: state.seedVersion, familyId: state.activeFamilyId, tripId: state.selectedTripId, view, presentation, ui: { careDraft: ui.careDraft, planDraft: ui.planDraft, assistantCare: ui.assistantCare }, intakeText }; if (dirty || ui.careDraft || ui.planDraft || intakeText.trim())
    sessionStorage.setItem(draftKey(), JSON.stringify(data));
else {
    const old = JSON.parse(sessionStorage.getItem(draftKey()) ?? 'null');
    if (!old || old.seedVersion === state.seedVersion && old.familyId === state.activeFamilyId && old.tripId === state.selectedTripId)
        sessionStorage.removeItem(draftKey());
} }
readLocation();
try {
    const saved = JSON.parse(sessionStorage.getItem(draftKey()) ?? 'null');
    if (saved?.tripRelease === state.tripCleanup?.release && saved?.accountId === state.activeAccountId && saved.familyId === state.activeFamilyId && saved.tripId === state.selectedTripId && saved.seedVersion === state.seedVersion) {
        ui = { ...ui, ...saved.ui };
        intakeText = saved.intakeText ?? '';
        dirty = !!ui.careDraft || !!ui.planDraft || !!intakeText.trim();
        if (dirty) {
            view = saved.view;
            presentation = saved.presentation;
        }
    }
    else if (saved) {
        sessionStorage.setItem(draftKey() + ':retained', JSON.stringify(saved));
        toast('原帳號草稿已保留，因行程版本或上下文變更，請先核對再恢復。');
    }
}
catch { }
saveSession();
render();
document.documentElement.dataset.buildVersion = RELEASE.buildVersion;
document.documentElement.dataset.releaseId = RELEASE.releaseId;
document.documentElement.dataset.commitSha = RELEASE.commitSha;
watchRelease({ busy: () => dirty || dialog.open || Object.values(state.dual?.transactions ?? {}).some(t => ['pending', 'unknown'].includes(t.status)) || Object.values(state.learning?.events ?? {}).some(e => ['processing', 'unknown'].includes(e.status)) || Object.values(state.feedbackRewards ?? {}).some(e => ['processing', 'unknown'].includes(e.status)) || Object.values(state.tasks).some(t => t.status === 'processing') || Object.values(state.requests).some(r => r.progress === 'submitted' && !r.receipt || r.progress === 'unknown'), saveDrafts: saveReleaseDraft, flush: () => storage.flush() });
document.addEventListener('input', () => queueMicrotask(saveReleaseDraft));
window.addEventListener('pagehide', saveReleaseDraft);
function batchSubmit() { void services.open(trip().id).catch(e => toast(e.message)); }
function taskModal(taskId, personId) { const task = TASKS.find(t => t.id === taskId); if (!['photo', 'hunt'].includes(task.kind)) {
    legacyTaskModal(taskId, personId);
    return;
} const photo = task.kind === 'photo'; modal(task.title, `<p>${esc(task.body)}</p>${photo ? '<label class="field"><span>选择旅程图片（最多 5 MB）</span><input id="memory-photo" type="file" accept="image/png,image/jpeg,image/webp"></label><img id="memory-preview" alt="所选旅程图片预览" hidden><label class="check"><input id="memory-agree" type="checkbox">已预览这段旅程记忆</label>' : '<div class="discovery-cards">' + [['安全卡', '核对座椅附近的安全指引。'], ['阅读灯', '确认自己的灯光控制位置。'], ['呼叫按钮', '需要帮助时坐在座位上呼叫乘务员。']].map(([title, text]) => '<label class="discovery-card"><input class="discovery-check" type="checkbox"><strong>' + title + '</strong><span>' + text + '</span></label>').join('') + '</div>'}<p class="meta">完成后可领取 ${task.reward} 里獎勵，适用同一个人月度上限。</p>`, [{ label: '确认完成', run: () => { if (photo) {
            const file = get('#memory-photo').files?.[0];
            if (!file || !['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024 || !get('#memory-agree').checked)
                throw Error('请先选择并预览 5 MB 内的 PNG、JPEG 或 WebP 图片。');
        }
        else if (dialog.querySelectorAll('.discovery-check:checked').length !== 3)
            throw Error('请核对全部三个准备点。'); act({ type: 'completeTask', personId, taskId, familyId: fId(), confirmed: true }); close(); toast('准备完成，可在任务板领取个人奖励。'); } }]); if (photo) {
    let url;
    get('#memory-photo').addEventListener('change', () => { const file = get('#memory-photo').files?.[0], img = get('#memory-preview'); if (url)
        URL.revokeObjectURL(url); img.hidden = true; if (file && ['image/png', 'image/jpeg', 'image/webp'].includes(file.type) && file.size <= 5 * 1024 * 1024) {
        url = URL.createObjectURL(file);
        img.src = url;
        img.hidden = false;
    }
    else
        toast('请选择 5 MB 内的 PNG、JPEG 或 WebP 图片。'); });
    dialog.addEventListener('close', () => { if (url)
        URL.revokeObjectURL(url); }, { once: true });
} }
function graduation(pid) { const p = state.persons[pid], adult = D.age(p, state.demoClock) >= 18, self = state.actorId === pid, claimed = state.milestones['solo-kit:' + pid]; const stamps = state.stamps.filter(st => st.personId === pid && (self || st.sharedFamilies.includes(state.activeFamilyId ?? ''))); modal('18 岁 · 带着家的牵挂启程', `<div class="annual-card"><span class="eyebrow">下一段人生旅程</span><h2>${esc(displayName(p))}，下一程由你启航。</h2><div class="passport-seal">18<small>EVERY MILE IS YOURS</small></div><p>${stamps.length} 个获授权航段 · ${new Set(stamps.map(st => st.city)).size} 座城市<br>同一个会员账号，继续积累新的故事。</p></div><h3 class="spaced">首次独自出行礼包</h3><div class="checklist"><label class="check"><input type="checkbox">随身保留出行文件与行程副本</label><label class="check"><input type="checkbox">约定抵达后的联系时间与紧急联系人</label><label class="check"><input type="checkbox">核对机场接驳、住宿与托运行李</label></div><p>${claimed ? chip('礼包已领取，清单可反复查看') : chip(adult ? '可由本人领取' : '18 岁生日后解锁', 'gold')}</p><p class="meta">礼包是上述准备清单和学生规划入口，不包含真实优惠券。成年后账号和历史保留，监护代办权不自动延续；学生资格需单独验证。</p>${self && adult ? `<div class="button-row">${btn(claimed ? '已领取独行礼包' : '领取我的独行礼包', 'claim-kit', `data-person="${pid}" ${claimed ? 'disabled' : ''}`)}${btn('进入学期规划', 'kit-planner', `data-person="${pid}"`, 'secondary')}${!D.account(state, pid)?.studentVerified ? btn('单独核验学生身份', 'verify-student', `data-person="${pid}"`, 'ghost') : chip('學生身份已核對')}</div>` : '<p class="notice">請在右上角切換至學生本人查看。</p>'}`, self && adult ? [{ label: '本人同意继续分享成长记录', run: () => { act({ type: 'adult', personId: pid, share: true }); close(); } }, { label: '改为本人私密管理', style: 'secondary', run: () => { act({ type: 'adult', personId: pid, share: false }); close(); } }] : []); }
void configureProvider().then(changed => { if (changed)
    render(); });
observeLocale();
