import { calendarContext, schoolStrategies, selectSchoolStrategy } from '/assets/8ff1587e8661fef5dadb/student-calendar.js';
import { assistantTemplate, capabilityAnswer } from '/assets/8ff1587e8661fef5dadb/product-copy.js';
import * as B from '/assets/8ff1587e8661fef5dadb/booking.js';
import { bookingPanel } from '/assets/8ff1587e8661fef5dadb/booking-ui.js';
import { studentIntentPlan } from '/assets/8ff1587e8661fef5dadb/student-shortcuts.js';
import * as F from '/assets/8ff1587e8661fef5dadb/flights.js';
import { connection, planningAPI, offerQuery, snapshotFromOffer } from '/assets/8ff1587e8661fef5dadb/flight-service.js';
import { flightSelection } from '/assets/8ff1587e8661fef5dadb/flight-ui.js';
import { planForJourney } from '/assets/8ff1587e8661fef5dadb/itinerary.js';
import * as E from '/assets/8ff1587e8661fef5dadb/experience.js';
import { planForm, readPlanForm, contentCard } from '/assets/8ff1587e8661fef5dadb/experience-ui.js';
import { parseCareTask, recognitionDiagnostics, careDirectory, applyCareProposal } from '/assets/8ff1587e8661fef5dadb/recognition.js';
import { sc } from '/assets/8ff1587e8661fef5dadb/locale.js';
import { assistantProvider, providerMode, MockAssistantProvider, validateToolRequest } from '/assets/8ff1587e8661fef5dadb/provider.js';
import * as J from '/assets/8ff1587e8661fef5dadb/transit.js';
import { displayName } from '/assets/8ff1587e8661fef5dadb/identity.js';
import { BRAND } from '/assets/8ff1587e8661fef5dadb/web/brand.js';
import { esc, icon } from '/assets/8ff1587e8661fef5dadb/ui.js';
import { guideContext, contextKey, sameContext, resolveGuide, validateResolution } from '/assets/8ff1587e8661fef5dadb/guide.js';
const STORAGE = 'cx2-chapters-conversations-v1';
const studentQuick = [['我到转机机场了，接下来去哪？', '位置、路线与登机期限', 'plane'], ['现在还来得及吃点东西吗？', '计算当前可支配余量', 'check'], ['飞机晚点了，学校接机还能赶上吗？', '接机与入住衔接', 'calendar'], ['我落地了，怎么去宿舍？', '交通与联系草稿', 'care']];
const quick = [['帮我规划下学期航程', '校历、日期与预算', 'calendar'], ['帮家人准备轮椅或婴儿篮', '确认成员，准备资料', 'care'], ['看看这趟旅行还有什么没办妥', '查看当前行程的待办', 'check'], ['航班变了，帮我看看全家的替代安排', '保留同行与照护需要', 'plane']];
const phaseLabels = { resolving: '正在理解需求', clarifying: '需要你确认', navigating: '正在打开页面', revealing: '正在定位内容', highlighting: '已定位 · 请核对', awaiting_confirmation: '下一步由你确认', completed: '引导完成', cancelled: '引导已停止', error: '暂时无法定位' };
export class GuideAssistant {
    host;
    conversations = {};
    key = '';
    context;
    inlineHome = false;
    focusPlan = false;
    scrolls = new Map();
    captureScroll() { document.querySelectorAll('.assistant-messages[data-conversation-key]').forEach(box => { const full = !!box.closest('.full-assistant'); this.scrolls.set(box.dataset.conversationKey, { top: full ? window.scrollY : box.scrollTop, count: Number(box.dataset.messageCount), full }); }); }
    restoreScroll() { document.querySelectorAll('.assistant-messages[data-conversation-key]').forEach(box => { const old = this.scrolls.get(box.dataset.conversationKey), full = !!box.closest('.full-assistant'); if (old && old.full === full && old.count === Number(box.dataset.messageCount)) {
        if (full)
            window.scrollTo({ top: old.top, behavior: 'instant' });
        else
            box.scrollTop = old.top;
    }
    else {
        const latest = Array.from(box.querySelectorAll('.assistant-message')).at(-1);
        if (latest) {
            if (full)
                latest.scrollIntoView({ block: 'start', behavior: 'instant' });
            else
                box.scrollTop = Math.max(0, latest.offsetTop - box.offsetTop - 16);
        }
        else if (!full)
            box.scrollTop = 0;
    } }); }
    openChange() { this.sync(); this.stashPlan(); this.cancel(false); this.opened = false; this.message('assistant', '已讀取這次航班變更，同行名單及原照護資料已帶入。請選擇後續安排。'); this.save(); }
    openService() { this.sync(); this.stashPlan(); this.cancel(false); this.opened = false; this.message('assistant', '已整理本次同行旅客的照護需求，請核對資料與提交範圍。'); this.save(); }
    suspendPanel() { this.opened = false; }
    stashPlan() { if (this.current.plan) {
        this.current.planDrafts ??= {};
        this.current.planDrafts[this.current.plan.id] = structuredClone(this.current.plan);
        this.save();
    } }
    localDrafts() { const drafts = Object.values({ ...this.host.state().booking?.sessions, ...this.current.planDrafts }).filter(p => p.accountId === (this.host.state().activeAccountId ?? this.host.state().actorId) && p.id !== this.current.plan?.id && !this.host.state().tripCleanup?.retired.includes(p.id) && (!p.booking || !['saved', 'cancelled'].includes(this.host.state().booking?.sessions[p.id]?.booking?.phase ?? p.booking.phase))); return drafts.length ? '<details class="assistant-local-drafts"><summary>繼續保留的規劃草稿（' + drafts.length + '）</summary>' + drafts.map(p => '<button class="text-link" data-resume-local-plan="' + esc(p.id) + '">' + esc(p.title) + ' →</button>').join('') + '</details>' : ''; }
    setHomeMode(value) { this.inlineHome = value; }
    opened = false;
    personal = false;
    returnFocus = null;
    controller = null;
    highlight = null;
    highlightTimer;
    constructor(host) {
        this.host = host;
        this.context = guideContext(host.state());
        try {
            const parsed = JSON.parse(sessionStorage.getItem(STORAGE + ':' + (this.host.state().journeyRelease?.version ?? 'legacy')) ?? '{}');
            for (const [key, c] of Object.entries(parsed)) {
                if (c && Array.isArray(c.messages) && typeof c.draft === 'string')
                    this.conversations[key] = { messages: c.messages.filter(m => ['user', 'assistant'].includes(m.role) && typeof m.text === 'string').slice(-40), draft: c.draft.slice(0, 500), lastInput: c.lastInput, aiId: typeof c.aiId === 'string' ? c.aiId : undefined, aiRevision: Number.isSafeInteger(c.aiRevision) ? c.aiRevision : undefined, aiHistory: Array.isArray(c.aiHistory) ? c.aiHistory.filter(m => m && ['user', 'assistant'].includes(m.role) && typeof m.text === 'string').slice(-6).map(m => ({ role: m.role, text: m.text.slice(0, 2400) })) : undefined, aiQuery: c.aiQuery && typeof c.aiQuery === 'object' && !Array.isArray(c.aiQuery) ? c.aiQuery : undefined, request: c.request?.context ? c.request : undefined, resolution: c.resolution, plan: c.plan?.accountId && !this.host.state().tripCleanup?.retired.includes(c.plan.id) ? (c.plan.booking ? structuredClone(this.host.state().booking?.sessions[c.plan.id] ?? c.plan) : c.plan) : undefined, planDrafts: c.planDrafts ?? {}, result: ['onboarding', 'destinations', 'summary'].includes(c.result ?? '') ? c.result : undefined, summaryTripId: c.summaryTripId };
            }
        }
        catch { }
        this.sync();
    }
    save() { try {
        sessionStorage.setItem(STORAGE + ':' + (this.host.state().journeyRelease?.version ?? 'legacy'), JSON.stringify(this.conversations));
    }
    catch { /* Business persistence reports storage errors separately. */ } }
    get current() { return this.conversations[this.key] ?? (this.conversations[this.key] = { messages: [], draft: '' }); }
    message(role, text) { this.current.messages.push({ role, text, revision: this.context.dataRevision }); this.current.messages = this.current.messages.slice(-40); this.save(); }
    phase(r, p) { r.phase = p; r.trace.push(p); this.save(); }
    sync() { const next = guideContext(this.host.state(), this.personal); if (!sameContext(next, this.context)) {
        if (!this.current.plan?.booking || contextKey(next) !== contextKey(this.context) || next.epoch !== this.context.epoch)
            this.cancel(false);
        this.context = next;
    } this.key = contextKey(this.context); }
    contextChanged() { this.cancel(false); this.personal = false; this.sync(); }
    clearHighlight() { if (this.highlight) {
        this.highlight.classList.remove('guide-highlight');
        const r = this.current.request;
        if (r?.phase === 'highlighting')
            this.phase(r, 'awaiting_confirmation');
    } this.highlight = null; clearTimeout(this.highlightTimer); }
    cancel(redraw = true) { this.controller?.abort(); this.controller = null; this.clearHighlight(); const r = this.current.request; if (r && !['completed', 'cancelled'].includes(r.phase))
        this.phase(r, 'cancelled'); if (redraw)
        this.host.render(); }
    welcome() { return '<div class="assistant-welcome"><p>你好，我是' + esc(BRAND.assistantName) + '。想規劃旅程、查看出行準備，還是整理家人的照護安排？</p></div>'; }
    suggestions() { const s = this.host.state(), student = !!s.dual?.accounts[s.activeAccountId ?? ''] && s.dual.accounts[s.activeAccountId].role === 'student'; const rows = [student ? '幫我看看返校行程還有什麼要準備' : '幫我看看全家的行程還有什麼沒辦妥', '怎麼用有期規劃第一次出行？', student ? '我想探索下一個目的地，有什麼推薦？' : '我想帶家人去旅行，有什麼目的地推薦？']; return (student ? '<button class="text-link" data-calendar-open>上傳校曆 PDF／JPG／DAT</button>' : '') + '<div class="assistant-suggestions">' + rows.map(text => '<button class="text-link" data-guide-prompt="' + esc(text) + '">' + esc(text) + ' <span aria-hidden="true">→</span></button>').join('') + '</div>'; }
    result() { const c = this.current, s = this.host.state(), change = this.host.changePanel?.(), service = this.host.servicePanel?.(); if (!c.resumeOffer && change)
        return change; if (!c.resumeOffer && service)
        return service; if (!c.resumeOffer && c.plan?.booking?.savedTripId)
        return '<div class="guide-card"><p>這段行程已儲存，可從首頁查看準備事項或另開新規劃。</p><button class="button" data-view="home">查看首頁行程</button><button class="text-link" data-booking-new>開始另一段旅程</button></div>'; if (c.resumeOffer)
        return '<div class="guide-card"><h3>如何處理目前草稿？</h3><p>新增行程會開啟獨立會話。你可以保留或放棄這份尚未保存的草稿。</p><div class="button-row"><button class="button" data-booking-resume>取消，繼續目前規劃</button><button class="button secondary" data-booking-new>保存草稿並新建</button><button class="text-link" data-booking-discard>放棄草稿並新建</button></div></div>'; if (c.plan?.booking && !c.plan.booking.manual && !['saved', 'cancelled'].includes(c.plan.booking.phase) && c.plan.accountId === (s.activeAccountId ?? s.actorId))
        return bookingPanel(s, c.plan); if ((!c.request || ['error', 'cancelled'].includes(c.request.phase)) && c.plan && c.plan.accountId === (s.activeAccountId ?? s.actorId))
        return planForm(s, c.plan); if (c.result === 'onboarding')
        return '<div class="guide-card"><ol><li>先告訴我想去哪、和誰同行。</li><li>再一起確認日期、預算和照護需求。</li><li>最後把選好的安排存成計劃，持續跟進出發準備。</li></ol><button class="button" data-new-plan>開始規劃</button></div>'; if (c.result === 'destinations')
        return '<div class="assistant-destinations">' + E.visibleContent(s).map(x => contentCard(s, x, true)).join('') + '</div>'; if (c.result === 'summary') {
        const row = E.rankedJourneys(s).find(x => x.j.id === c.summaryTripId);
        if (!row)
            return '<div class="guide-card"><p>目前沒有可讀取的相關行程，先建立旅行想法吧。</p><button class="button" data-new-plan>開始規劃</button></div>';
        const tasks = E.journeyTasks(s, row.j.id);
        return '<div class="guide-card" data-summary-trip="' + row.j.id + '"><h3>' + row.seg.from + ' → ' + row.seg.to + '</h3><p>' + J.fullTime(row.seg.departure) + ' 香港時間 · ' + row.vm.travelers.length + ' 位旅客</p><p>' + esc(row.affected ? '原航班已取消，先比較全體同行的替代方案。' : tasks.known ? '目前已核對 ' + tasks.done + ' / ' + tasks.total + ' 項。' : '準備資料尚未完整，請逐項核對。') + '</p><ul>' + tasks.pending.slice(0, 3).map(x => '<li>' + esc(x) + '</li>').join('') + '</ul><button class="button" data-experience-trip="' + row.j.id + '" data-phase="' + (row.affected ? 'recovery' : row.ended ? 'posttrip' : row.ongoing ? 'during' : 'preparation') + '">' + (row.affected ? '處理行程變更' : row.ended ? '查看旅後紀錄' : '打開具體準備項') + ' →</button></div>';
    } return ''; }
    messages() { const c = this.current, r = c.request, x = c.resolution, busy = r && ['resolving', 'navigating', 'revealing'].includes(r.phase); return (c.messages.length ? c.messages.map((m, index) => (c.plan?.booking && c.messages.length > 2 && index === 0 ? '<details class="booking-history"><summary>查看先前對話</summary>' : '') + '<div class="assistant-message ' + m.role + '" data-message-index="' + index + '" tabindex="-1">' + esc(m.role === 'assistant' ? assistantTemplate(m.text) : m.text) + (m.revision !== undefined && m.revision !== this.context.dataRevision ? '<small class="message-stale">行程已有更新，請以目前資料為準。</small>' : '') + '</div>' + (c.plan?.booking && c.messages.length > 2 && index === c.messages.length - 3 ? '</details>' : '')).join('') : this.welcome() + this.suggestions()) + (r ? '<div class="guide-card" data-guide-state="' + r.phase + '"><span class="chip">' + (r.phase === 'error' && r.intent === 'unknown' ? '尚未完成' : phaseLabels[r.phase]) + '</span>' + (busy ? '<p role="status">小期正在整理答案，通常需要幾十秒。你可以停止，保留目前輸入。</p><button class="text-link" data-guide-cancel>停止等待</button>' : x ? '<p>' + esc(x.message) + '</p>' : '') + (r.phase === 'clarifying' && x?.kind === 'clarify' ? '<div class="guide-choices">' + x.choices.map(o => '<button class="button secondary" data-guide-request="' + r.id + '" data-guide-choice="' + esc(o.id) + '">' + esc(o.label) + '</button>').join('') + '</div>' : '') + (['error', 'cancelled'].includes(r.phase) ? '<div class="button-row"><button class="button secondary" data-guide-retry>重新發送</button><button class="text-link" data-guide-manual-plan>用表單繼續規劃</button></div>' : '') + (r.target && !['cancelled', 'error'].includes(r.phase) ? '<button class="button secondary" data-guide-resume>返回定位位置</button>' : '') + '</div>' : '') + this.result() + this.localDrafts(); }
    jumps() { const c = this.current; if (!c.messages.length)
        return ''; return '<nav class="assistant-jumps" aria-label="對話快捷定位"><button class="text-link" data-assistant-jump="latest">最新回覆 ↓</button>' + (c.plan ? '<button class="text-link" data-assistant-jump="query">修改查詢條件</button>' : '') + (c.plan?.providerSearch ? '<button class="text-link" data-assistant-jump="results">航班結果 ↓</button>' : '') + '</nav>'; }
    home(full = false) { this.sync(); const c = this.current; return '<section class="panel home-assistant shared-assistant ' + (full ? 'full-assistant' : '') + '" aria-labelledby="home-assistant-title"><div class="assistant-header"><div><h2 id="home-assistant-title">' + esc(BRAND.assistantTitle) + '</h2></div>' + (full ? '' : '<button class="text-link" data-view="assistant" aria-label="展開完整助手">↗</button>') + '</div>' + this.jumps() + '<div class="assistant-messages" data-conversation-key="' + esc(this.key) + '" data-message-count="' + c.messages.length + '" aria-live="polite">' + this.messages() + '</div><div class="assistant-footer"><form data-guide-form><label class="composer-label" for="home-question">告訴' + esc(BRAND.assistantName) + '你的需求</label><div class="assistant-input-row"><textarea id="home-question" name="question" rows="2" maxlength="500" placeholder="告訴' + esc(BRAND.assistantName) + '，今天想從哪裡開始…" required>' + esc(c.draft) + '</textarea><button class="button" type="submit" aria-label="發送給' + esc(BRAND.assistantName) + '">發送</button></div></form>' + (c.modelError ? '<p role="status">這次處理尚未完成，可重新發送或用表單繼續。</p>' : '') + '</div></section>'; }
    chrome() { this.sync(); if (this.inlineHome)
        return ''; const c = this.current, r = c.request, x = c.resolution; return (!this.opened && r && !['cancelled', 'completed', 'clarifying', 'error'].includes(r.phase) ? '<div class="guide-status" role="status"><button data-guide-open><strong>' + phaseLabels[r.phase] + '</strong><span>' + esc(x?.message ?? '繼續目前引導') + '</span></button><button data-guide-cancel aria-label="停止目前引導">' + icon('close') + '</button></div>' : '') + '<button class="assistant-fab ' + (this.opened ? 'is-open' : '') + '" data-guide-open aria-label="打开有期助手" aria-expanded="' + this.opened + '">' + icon('spark') + '<span>有期助手</span></button>' + (this.opened ? '<dialog id="guide-dialog" class="assistant-drawer shared-assistant ' + (c.plan ? 'has-plan' : '') + '" aria-labelledby="guide-title"><div class="assistant-header"><div><h2 id="guide-title">' + esc(BRAND.assistantTitle) + '</h2></div><button class="button ghost" data-guide-close aria-label="关闭有期助手">' + icon('close') + '</button></div>' + this.jumps() + '<div class="assistant-messages" data-conversation-key="' + esc(this.key) + '" data-message-count="' + c.messages.length + '" aria-live="polite">' + this.messages() + '</div><div class="assistant-footer"><form data-guide-form><label class="composer-label" for="guide-question">繼續這段對話</label><div class="assistant-input-row"><textarea id="guide-question" name="question" rows="2" maxlength="500" placeholder="補充需求，或告訴我下一步…" required>' + esc(c.draft) + '</textarea><button class="button" type="submit">發送</button></div></form>' + (c.modelError ? '<p role="status">這次處理尚未完成，可重新發送或用表單繼續。</p>' : '') + '<div class="button-row"><button class="text-link" data-view="assistant">完整對話</button><button class="button ghost" data-guide-scope>' + (this.personal ? '回到目前家庭' : '切換到個人空間') + '</button><button class="button ghost" data-guide-human>人工與表單入口</button></div></div></dialog>' : ''); }
    beginning = false;
    async beginBooking(force = false, discard = false) { if (this.beginning)
        return; this.sync(); const old = this.current; if (!force && (old.draft.trim() || old.plan && !this.host.state().journeys?.items[old.plan.id] && (!old.plan.booking || !['saved', 'cancelled'].includes(old.plan.booking.phase)) && (old.messages.length > 1 || old.plan.selectedFlight || old.plan.start))) {
        old.resumeOffer = true;
        await this.host.navigate('assistant');
        this.host.render();
        return;
    } this.beginning = true; try {
        this.cancel(false);
        if (discard && old.plan?.booking)
            await this.persistCurrentBooking('cancel');
        else if (old.plan?.booking && !['saved', 'cancelled'].includes(old.plan.booking.phase))
            await this.persistCurrentBooking();
        if (discard) {
            if (old.plan && old.planDrafts)
                delete old.planDrafts[old.plan.id];
            if (!old.plan?.booking)
                old.plan = undefined;
            old.draft = '';
        }
        else
            this.stashPlan();
        this.conversations[this.key + ':history:' + (old.aiId ?? crypto.randomUUID())] = structuredClone(old);
        this.host.clearService?.();
        this.host.clearChange?.();
        this.opened = false;
        const p = B.startNewPlanningSession(structuredClone(this.host.state()), crypto.randomUUID());
        this.conversations[this.key] = { messages: [], draft: '', aiId: crypto.randomUUID(), aiRevision: 0, aiHistory: [], plan: p, planDrafts: old.planDrafts };
        this.message('assistant', '想去哪裡、哪一天出發？告訴我需求，我們一起選航班，再照顧同行的家人。');
        await this.persistCurrentBooking();
        await this.host.navigate('assistant');
        this.host.render();
        document.querySelector('#home-question')?.focus();
    }
    finally {
        this.beginning = false;
    } }
    async persistCurrentBooking(action = 'draft') { const p = this.current.plan; if (!p?.booking)
        return; const saved = await this.host.persistBooking(structuredClone(p), action); Object.assign(p, saved); this.save(); }
    bookingFailure(e) { const p = this.current.plan; if (p?.booking) {
        p.booking.error = e.message;
        if (p.booking.phase === 'saving')
            p.booking.phase = p.booking.care?.confirmed ? 'final_preview' : 'initial_preview';
    } this.save(); this.host.render(); }
    freshConversation() { this.scrolls.delete(this.key); const old = this.current; this.conversations[this.key + ':history:' + (old.aiId ?? crypto.randomUUID())] = structuredClone(old); this.conversations[this.key] = { messages: [], draft: '', aiId: crypto.randomUUID(), aiRevision: 0, aiHistory: [], planDrafts: old.planDrafts }; }
    beginPlan(contentId, planId) { this.host.clearChange?.(); this.host.clearService?.(); this.sync(); this.stashPlan(); const existing = planId ? (E.ownPlans(this.host.state()).find(p => p.id === planId) ?? planForJourney(this.host.state(), planId)) : undefined; if (planId && !existing)
        throw Error('目前帳號無權存取這份計劃。'); this.cancel(false); if (!existing)
        this.freshConversation(); this.current.request = undefined; this.current.resolution = undefined; this.current.result = undefined; const local = existing && (this.current.plan?.id === existing.id ? this.current.plan : this.current.planDrafts?.[existing.id]); this.current.plan = structuredClone(local && local.version === existing?.version ? local : existing ?? E.newTravelPlan(this.host.state(), contentId)); this.message('user', existing ? '繼續規劃：' + existing.title : contentId ? '一起規劃：' + this.current.plan.title : '開始規劃我的下一段旅程'); this.message('assistant', this.current.plan.destination ? '目的地 ' + this.current.plan.destination + ' 已帶入。請補充尚未決定的日期、出發地、預算和同行安排，也可以先保存想法。' : '先留下你的旅行想法，尚未確定的資料可以稍後補充。'); this.opened = true; this.focusPlan = true; this.save(); }
    beginStudentPlan() { this.beginPlan(); const s = this.host.state(), p = s.plans[s.actorId]; if (!p || s.dual?.accounts[s.activeAccountId]?.role !== 'student')
        throw Error('請由學生本人查詢學期航班。'); Object.assign(this.current.plan, { intent: 'school', title: '我的學期出行', origin: p.origin, destination: p.destination, start: p.departure, budget: p.budget, bags: p.bags, studentPlanning: true, calendarRef: calendarContext(s)?.calendarId }); this.save(); }
    async beginStudentIntent(intent) { this.host.clearChange?.(); this.host.clearService?.(); this.sync(); this.stashPlan(); this.cancel(false); this.freshConversation(); const c = this.current; c.request = undefined; c.resolution = undefined; c.result = undefined; c.plan = studentIntentPlan(this.host.state(), intent); this.save(); if (c.plan.awaitingSchool) {
        await this.host.navigate('student');
        this.message('assistant', '先在這裡確認學校與校曆。保存後會繼續原來的返校規劃，不用重填。');
    }
    else {
        this.opened = true;
        this.focusPlan = true;
        this.message('assistant', intent === 'home' ? '一起規劃回家。請核對家的機場、出發地與日期，再選擇航班。' : '學校目的地已帶入。請自行選擇出發地與日期，再查詢航班。');
    } this.host.render(); }
    resumeStudentIntent() { this.sync(); const p = this.current.plan; if (!p?.awaitingSchool)
        return; this.current.plan = studentIntentPlan(this.host.state(), p.intent ?? 'school', p); if (this.current.plan.awaitingSchool)
        return; this.current.request = undefined; this.opened = true; this.focusPlan = true; this.save(); }
    hasPlan(id) { return this.current.plan?.id === id; }
    bind() {
        this.restoreScroll();
        const booking = this.current.plan, careConversation = this.current, careKey = this.key;
        const guard = (fn) => { try {
            void Promise.resolve(fn()).catch(e => this.bookingFailure(e));
        }
        catch (e) {
            this.bookingFailure(e);
        } };
        document.querySelector('[data-booking-resume]')?.addEventListener('click', () => { this.current.resumeOffer = false; this.host.render(); document.querySelector('#home-question')?.focus(); });
        document.querySelector('[data-booking-new]')?.addEventListener('click', () => guard(() => this.beginBooking(true)));
        if (booking?.booking) {
            const b = booking.booking, rev = b.queryRevision;
            const valid = () => { if (this.current.plan !== booking || booking.booking.queryRevision !== rev || booking.accountId !== (this.host.state().activeAccountId ?? this.host.state().actorId))
                throw Error('這個操作已過期，請使用最新規劃。'); };
            document.querySelector('.conversational-booking [data-flight-search]')?.addEventListener('click', () => guard(async () => { valid(); await this.searchProvider(); }));
            document.querySelectorAll('[data-provider-select]').forEach(el => { if (!el.closest('[data-experience-plan-form]'))
                el.onclick = () => guard(async () => { valid(); await this.selectProvider(el.dataset.providerSelect); }); });
            document.querySelector('[data-booking-manual]')?.addEventListener('click', () => { b.manual = true; this.current.request = undefined; this.host.render(); });
            document.querySelector('[data-booking-change-flight]')?.addEventListener('click', () => guard(async () => { valid(); booking.selectedFlight = undefined; booking.providerSelection = undefined; b.phase = 'choosing_flight'; if (b.care)
                b.care.confirmed = false; await this.persistCurrentBooking(); this.host.render(); }));
            document.querySelectorAll('.booking-imported-care input[type="checkbox"]').forEach(el => el.addEventListener('change', () => guard(async () => { valid(); const pid = el.name.slice(5); booking.careNeeds ??= {}; booking.careNeeds[pid] = Array.from(document.querySelectorAll('.booking-imported-care input[type="checkbox"]')).filter(x => x.name === el.name && x.checked).map(x => x.value); delete b.careSaved?.[pid]; if (b.care?.personId === pid)
                b.care = undefined; await this.persistCurrentBooking(); this.host.render(); })));
            document.querySelector('[data-booking-add-needs]')?.addEventListener('click', () => document.querySelector('.shared-assistant textarea')?.focus());
            document.querySelector('[data-booking-caregiver]')?.addEventListener('change', e => guard(async () => { valid(); const c = b.care; c.caregiverId = undefined; B.proposeBookingCare(this.host.state(), booking, c.personId, c.kinds, e.target.value || undefined); await this.persistCurrentBooking(); this.host.render(); }));
            document.querySelector('[data-booking-confirm-care]')?.addEventListener('click', () => guard(async () => { valid(); await this.persistCurrentBooking('care'); valid(); this.message('assistant', '照護需求已同步至家人的本次規劃紀錄。請核對最後預覽，再儲存行程；服務仍待航空公司確認。'); this.host.render(); document.querySelector('[data-booking-preview]')?.scrollIntoView({ block: 'start' }); }));
            document.querySelector('[data-booking-cancel]')?.addEventListener('click', () => guard(async () => { valid(); await this.persistCurrentBooking('cancel'); valid(); this.current.plan = undefined; this.current.draft = ''; this.current.request = undefined; this.message('assistant', '本次規劃已取消；長期檔案與其他行程保持原狀。'); this.host.render(); }));
            document.querySelectorAll('[data-booking-save]').forEach(button => button.addEventListener('click', () => guard(async () => { valid(); b.submitServices = button.hasAttribute('data-submit-services'); if (b.phase === 'saving')
                return; b.phase = 'saving'; b.error = undefined; this.host.render(); const saved = await this.host.saveBooking(structuredClone(booking)); Object.assign(booking, saved); this.save(); })));
            document.querySelector('[data-booking-members-confirm]')?.addEventListener('click', () => guard(async () => { valid(); const ids = Array.from(document.querySelectorAll('[data-booking-member]:checked')).map(el => el.dataset.bookingMember); if (ids.length !== b.explicitCount)
                throw Error('請選擇 ' + b.explicitCount + ' 位同行成員。'); booking.travelerIds = ids.sort(); b.travelerScope = 'selected'; b.travelersConfirmed = true; b.error = undefined; B.invalidateBooking(booking); await this.persistCurrentBooking(); valid(); if (!B.bookingMissing(booking).length)
                await this.searchProvider();
            else
                this.host.render(); }));
        }
        document.querySelectorAll('[data-assistant-jump]').forEach(button => button.onclick = () => { const root = button.closest('.shared-assistant'), kind = button.dataset.assistantJump; let target = null; if (kind === 'query') {
            const details = root.querySelector('.plan-query');
            if (details) {
                details.open = true;
                target = details;
            }
        }
        else if (kind === 'results')
            target = root.querySelector('[data-provider-offers]');
        else
            target = Array.from(root.querySelectorAll('.assistant-message.assistant')).at(-1) ?? null; if (target) {
            target.setAttribute('tabindex', '-1');
            target.scrollIntoView({ block: 'start', behavior: 'instant' });
            target.focus({ preventScroll: true });
        } });
        document.querySelectorAll('[data-guide-retry]').forEach(el => el.onclick = () => { void this.send(this.current.draft || this.current.lastInput || ''); });
        document.querySelectorAll('[data-guide-manual-plan]').forEach(el => el.onclick = () => { this.cancel(false); if (!this.current.plan)
            this.beginPlan(); this.current.request = undefined; this.current.resolution = undefined; if (this.current.plan?.booking)
            this.current.plan.booking.manual = true; this.opened = true; this.focusPlan = true; this.save(); this.host.render(); });
        document.querySelectorAll('[data-booking-discard]').forEach(el => el.onclick = () => void this.beginBooking(true, true));
        document.querySelectorAll('[data-student-intent]').forEach(el => el.onclick = () => { void this.beginStudentIntent(el.dataset.studentIntent); });
        document.querySelectorAll('[data-resume-local-plan]').forEach(el => el.onclick = () => { const draft = this.current.planDrafts?.[el.dataset.resumeLocalPlan] ?? this.host.state().booking?.sessions[el.dataset.resumeLocalPlan]; if (!draft || draft.accountId !== (this.host.state().activeAccountId ?? this.host.state().actorId))
            return; this.stashPlan(); this.cancel(false); this.freshConversation(); this.host.clearChange?.(); this.host.clearService?.(); this.current.plan = structuredClone(draft.booking ? this.host.state().booking?.sessions[draft.id] ?? draft : draft); this.current.request = undefined; this.current.resolution = undefined; this.current.result = undefined; this.save(); this.host.render(); });
        document.querySelectorAll('[data-experience-plan-form]').forEach(form => {
            const remember = () => { if (this.current.plan) {
                const previous = this.current.plan;
                this.current.plan = readPlanForm(form, previous);
                const next = this.current.plan;
                if (F.criteriaKey(F.criteriaFor(previous)) !== F.criteriaKey(F.criteriaFor(next))) {
                    const output = form.querySelector('[data-flight-output]');
                    if (output)
                        output.innerHTML = flightSelection(next);
                }
                if (next.constraints && JSON.stringify({ ...next.constraints, accepted: false }) !== JSON.stringify({ ...previous.constraints, accepted: false })) {
                    const checkbox = form.querySelector('[name="constraint-accepted"]');
                    if (checkbox)
                        checkbox.checked = false;
                    if (next.selectedFlight) {
                        const check = F.checkConstraints(next.selectedFlight.outbound, next.constraints), box = form.querySelector('[data-arrival-check]');
                        if (box)
                            box.innerHTML = '<strong>抵達安排已重新檢查</strong><p>' + check.notes.map(esc).join('</p><p>') + '</p><p>估算到校：' + (check.readyAt ? J.fullTime(check.readyAt, next.selectedFlight.outbound.legs.at(-1).arrivalZone) : '待確認') + '</p>';
                    }
                }
                this.save();
            } };
            form.addEventListener('input', remember);
            form.addEventListener('change', e => { remember(); const name = e.target.name; if (this.current.plan) {
                if (name === 'travelType' && this.current.plan.travelType === 'oneway')
                    this.current.plan.end = '';
                if (name === 'familyId')
                    this.current.plan.travelerIds = [this.host.state().actorId];
                this.save();
                if (['mode', 'familyId', 'travelType', 'flightSource', 'travelerIds'].includes(name))
                    this.host.render();
            } });
            form.querySelector('[data-flight-search]')?.addEventListener('click', async () => {
                remember();
                if (this.current.plan?.flightSource !== 'simulation') {
                    await this.searchProvider();
                    return;
                }
                const draft = this.current.plan, conversation = this.current, key = this.key, criteria = F.criteriaFor(draft);
                let results;
                try {
                    results = F.searchFlights(criteria);
                }
                catch (e) {
                    const box = form.querySelector('[data-flight-error]') ?? form.appendChild(document.createElement('p'));
                    box.setAttribute('data-flight-error', '');
                    box.className = 'error';
                    box.setAttribute('role', 'alert');
                    box.textContent = e.message;
                    return;
                }
                draft.selectedFlight = undefined;
                draft.flightSearch = { ...results, status: 'loading' };
                this.save();
                this.host.render();
                await new Promise(r => setTimeout(r, 250));
                if (this.current !== conversation || key !== this.key || conversation.plan !== draft || F.criteriaKey(F.criteriaFor(draft)) !== results.criteriaKey)
                    return;
                draft.flightSearch = this.host.state().mockMode === 'failure' ? { ...results, status: 'failed', outbound: [], inbound: [], message: '查詢服務暫時失敗，請重試；尚未選擇或保存航班。' } : results;
                this.save();
                this.host.render();
                document.querySelector('[data-flight-results]')?.scrollIntoView({ block: 'start' });
            });
            form.querySelector('[data-school-strategies]')?.addEventListener('click', () => { remember(); try {
                this.current.plan.schoolStrategies = schoolStrategies(this.host.state(), this.current.plan);
                this.save();
                this.host.render();
                document.querySelector('.school-strategies')?.scrollIntoView({ block: 'start' });
            }
            catch (e) {
                this.message('assistant', e.message);
                this.host.render();
            } });
            form.querySelectorAll('[data-school-select]').forEach(el => el.onclick = () => { try {
                this.current.plan = selectSchoolStrategy(this.host.state(), this.current.plan, el.dataset.schoolSelect);
                this.save();
                this.host.render();
                document.querySelector('[data-selected-flight]')?.scrollIntoView({ block: 'start' });
            }
            catch (e) {
                this.message('assistant', e.message);
                this.host.render();
            } });
            form.querySelectorAll('[data-provider-select]').forEach(el => el.onclick = () => void this.selectProvider(el.dataset.providerSelect));
            form.querySelectorAll('[data-select-flight]').forEach(el => el.onclick = () => { remember(); try {
                this.current.plan = F.selectFlight(this.current.plan, el.dataset.selectFlight, el.dataset.flightDirection);
                this.save();
                this.host.render();
                document.querySelector('[data-selected-flight]')?.scrollIntoView({ block: 'center' });
            }
            catch (e) {
                this.message('assistant', e.message);
                this.host.render();
            } });
            form.querySelector('[data-change-flight]')?.addEventListener('click', () => { this.current.plan.selectedFlight = undefined; this.save(); this.host.render(); document.querySelector('[data-flight-results]')?.scrollIntoView({ block: 'start' }); });
            form.querySelector('[data-add-constraints]')?.addEventListener('click', () => { this.current.plan.constraints = { immigrationMinutes: 60, baggageMinutes: 30, transportMinutes: 60 }; this.save(); this.host.render(); });
            form.addEventListener('submit', e => { e.preventDefault(); if (!this.current.plan)
                return; const conversation = this.current, key = this.key, draft = readPlanForm(form, this.current.plan); conversation.plan = draft; this.save(); void this.host.saveTravelPlan(draft).then(saved => { if (!saved)
                return; conversation.plan = saved.mode === 'itinerary' ? undefined : saved; conversation.planDrafts ??= {}; if (saved.mode === 'itinerary')
                delete conversation.planDrafts[saved.id];
            else
                conversation.planDrafts[saved.id] = saved; this.save(); if (this.current === conversation && this.key === key) {
                this.message('assistant', saved.mode === 'itinerary' ? '行程規劃已保存，請在首頁查看出發準備。未出票或確認訂位。' : '草稿已儲存，可在首頁繼續規劃。');
                this.host.render();
            } }); });
        });
        const panel = document.querySelector('#guide-dialog');
        if (panel && !panel.open && !document.querySelector('#modal')?.open) {
            panel.showModal();
            panel.addEventListener('cancel', e => { e.preventDefault(); this.close(); });
            panel.addEventListener('keydown', e => { if (e.key !== 'Tab')
                return; const items = Array.from(panel.querySelectorAll('button:not(:disabled),textarea,input,select,a[href]')).filter(el => el.getClientRects().length); const first = items[0], last = items.at(-1); if (e.shiftKey && document.activeElement === first) {
                e.preventDefault();
                last?.focus();
            }
            else if (!e.shiftKey && document.activeElement === last) {
                e.preventDefault();
                first?.focus();
            } });
            this.restoreScroll();
        }
        if (this.focusPlan) {
            const form = document.querySelector('[data-experience-plan-form]');
            if (form) {
                form.scrollIntoView({ block: 'start', behavior: 'instant' });
                this.focusPlan = false;
            }
        }
        document.querySelectorAll('[data-guide-form]').forEach(form => { const input = form.querySelector('textarea'); input.addEventListener('input', () => { this.current.draft = input.value; this.save(); this.clearHighlight(); }); form.addEventListener('submit', e => { e.preventDefault(); void this.send(input.value); }); });
        document.querySelectorAll('[data-guide-open]').forEach(el => el.addEventListener('click', () => this.open(el)));
        document.querySelectorAll('[data-guide-close]').forEach(el => el.addEventListener('click', () => this.close()));
        document.querySelectorAll('[data-guide-cancel]').forEach(el => el.addEventListener('click', () => this.cancel()));
        document.querySelectorAll('[data-guide-prompt]').forEach(el => el.addEventListener('click', () => void this.send(el.dataset.guidePrompt)));
        document.querySelectorAll('[data-guide-choice]').forEach(el => el.addEventListener('click', () => void this.choose(el.dataset.guideChoice, el.dataset.guideRequest)));
        document.querySelector('[data-guide-resume]')?.addEventListener('click', () => { const r = this.current.request, x = this.current.resolution; if (r && x?.kind === 'navigate')
            void this.navigate(r, x, false); });
        panel?.querySelector('[data-guide-scope]')?.addEventListener('click', () => { this.cancel(false); this.personal = !this.personal; this.sync(); this.host.render(); });
        panel?.querySelector('[data-guide-human]')?.addEventListener('click', () => { this.message('assistant', '可使用导航中的照护档案、出行准备和学期表单继续。服务卡内“人工核实”会先展示授权摘要；这里不会发送消息给真实客服。'); this.host.render(); });
    }
    providerInput(p) { return { requestId: crypto.randomUUID(), account: this.host.state().activeAccountId ?? this.host.state().actorId, conversation: p.providerConversation ?? (p.providerConversation = crypto.randomUUID()), revision: p.providerRevision ?? 0 }; }
    async searchProvider() {
        const p = this.current.plan, conversation = this.current, key = this.key;
        p.providerRevision = (p.providerRevision ?? 0) + 1;
        const input = this.providerInput(p), version = input.revision;
        if (p.booking)
            p.booking.phase = 'searching_builtin';
        p.providerLoading = true;
        p.providerSearch = undefined;
        p.providerSelection = undefined;
        p.providerHandle = undefined;
        p.selectedFlight = undefined;
        p.providerError = undefined;
        this.save();
        this.host.render();
        try {
            const reply = await planningAPI('search', { ...input, query: offerQuery(this.host.state(), p) });
            if (this.current !== conversation || this.key !== key || conversation.plan !== p || p.providerRevision !== version)
                return;
            if (p.booking && reply.result && !B.queryMatches(this.host.state(), p, reply.result.query))
                throw Error('查詢回覆與實際旅客不符，請重新查詢。');
            p.providerSearch = reply.result;
            p.providerHandle = reply.handle;
            if (p.booking) {
                p.booking.phase = 'choosing_flight';
                p.booking.error = undefined;
                await this.persistCurrentBooking();
            }
        }
        catch (e) {
            if (this.current === conversation && this.key === key && conversation.plan === p && p.providerRevision === version)
                p.providerError = e.message;
        }
        finally {
            if (this.current === conversation && this.key === key && conversation.plan === p && p.providerRevision === version) {
                p.providerLoading = false;
                this.save();
                this.host.render();
                document.querySelector('[data-provider-offers]')?.scrollIntoView({ block: 'start' });
            }
        }
    }
    async selectProvider(id) {
        const p = this.current.plan, conversation = this.current, key = this.key, input = this.providerInput(p);
        p.providerLoading = true;
        p.providerError = undefined;
        this.host.render();
        const refreshContext = async () => { const refreshed = await planningAPI('search', { ...input, query: offerQuery(this.host.state(), p) }); if (this.current !== conversation || this.key !== key || conversation.plan !== p || p.providerRevision !== input.revision)
            return false; if (!refreshed.result?.offers.some(o => o.offerId === id))
            throw Error('原選擇已不符合最新條件，請重新選擇航班。'); p.providerHandle = refreshed.handle; p.providerSearch = refreshed.result; return true; };
        try {
            let reply;
            if (!p.providerHandle && p.booking && !await refreshContext())
                return;
            try {
                reply = await planningAPI('offer', { ...input, handle: p.providerHandle, offerId: id });
            }
            catch (e) {
                if (!p.booking || e.code !== 'offer_context_expired')
                    throw e;
                if (!await refreshContext())
                    return;
                reply = await planningAPI('offer', { ...input, handle: p.providerHandle, offerId: id });
            }
            if (this.current !== conversation || this.key !== key || conversation.plan !== p || p.providerRevision !== input.revision)
                return;
            if (!reply.offer)
                throw Error('未找到有效航班參考。');
            p.selectedFlight = snapshotFromOffer(p, reply.offer);
            p.providerSelection = reply.offer;
            B.importDraftCare(this.host.state(), p);
            const list = p.providerSearch?.offers;
            if (list) {
                const at = list.findIndex(o => o.offerId === id);
                if (at >= 0)
                    list[at] = reply.offer;
            }
            if (p.booking) {
                p.booking.phase = 'initial_preview';
                p.booking.error = undefined;
                if (p.booking.care) {
                    p.booking.care.confirmed = false;
                    B.refreshBookingSeats(this.host.state(), p);
                    p.booking.phase = 'confirming_care';
                }
                await this.persistCurrentBooking();
                if (this.current !== conversation || this.key !== key || conversation.plan !== p || p.providerRevision !== input.revision)
                    return;
                this.message('assistant', '已選好航班，並整理本次同行成員已授權的照護需求。你可以修改本次安排，再一起確認提交。');
            }
            else
                this.message('assistant', '已重新核對這份航班參考。請核對參考時刻及同行人，價格與庫存待確認，再預覽保存；尚未訂位。');
        }
        catch (e) {
            if (this.current === conversation && this.key === key && conversation.plan === p && p.providerRevision === input.revision) {
                p.providerError = e.message;
                if (p.booking)
                    p.booking.error = e.message;
            }
        }
        finally {
            if (this.current === conversation && this.key === key && conversation.plan === p && p.providerRevision === input.revision) {
                p.providerLoading = false;
                this.save();
                this.host.render();
                if (p.booking)
                    document.querySelector('[data-booking-preview]')?.scrollIntoView({ block: 'start' });
            }
        }
    }
    async sendModel(text, r, controller) {
        if (!this.current.plan && B.isFlightPlanningRequest(text))
            this.current.plan = B.newBooking(this.host.state());
        const c = this.current, key = this.key, s = this.host.state(), pendingPlan = c.plan;
        if (pendingPlan) {
            c.aiId = pendingPlan.providerConversation ?? c.aiId;
            c.aiHandle = pendingPlan.providerHandle;
            try {
                c.aiQuery = offerQuery(s, pendingPlan);
            }
            catch {
                c.aiQuery = undefined;
            }
        }
        c.aiId ??= crypto.randomUUID();
        c.aiRevision = (c.aiRevision ?? 0) + 1;
        const revision = c.aiRevision;
        try {
            const reply = await planningAPI('chat', { requestId: r.id, account: s.activeAccountId ?? s.actorId, conversation: c.aiId, revision, text, calendar: calendarContext(s), history: c.aiHistory ?? [], query: c.aiQuery, handle: c.aiHandle, offerId: c.plan?.providerSelection?.offerId, ...(pendingPlan?.booking ? { booking: B.bookingContext(s, pendingPlan) } : {}) }, controller.signal);
            if (controller.signal.aborted || this.current !== c || this.key !== key || c.aiRevision !== revision || c.plan !== pendingPlan || (pendingPlan?.booking ? (contextKey(r.context) !== contextKey(guideContext(this.host.state(), this.personal)) || r.context.epoch !== this.host.state().epoch) : !sameContext(r.context, guideContext(this.host.state(), this.personal))))
                return;
            c.modelError = false;
            c.aiHistory = [...(c.aiHistory ?? []), { role: 'user', text }, { role: 'assistant', text: reply.text ?? '' }].slice(-6);
            if (reply.query) {
                c.aiQuery = reply.query;
                c.aiHandle = reply.handle;
            }
            else if (reply.handle)
                c.aiHandle = reply.handle;
            if (reply.outcome === 'blocked') {
                this.message('assistant', reply.text ?? '這次查詢尚未完成，條件已保留。');
                c.draft = text;
                c.modelError = true;
                r.phase = 'error';
                c.resolution = undefined;
                this.save();
                this.host.render();
                return;
            }
            if (sc(c.draft) === text)
                c.draft = '';
            if (pendingPlan?.booking) {
                const p = pendingPlan;
                const q = reply.query ?? reply.result?.query;
                const patch = reply.patch ?? (q ? { origin: q.origin || null, destination: q.destination || null, outboundDate: q.outboundDate || null, returnDate: q.returnDate, cabin: q.cabin, departurePeriod: q.departurePeriod, ...(/全家|全家人|全部家人/.test(text) ? { travelerScope: 'all_family' } : /我自己|一个人|1人|一人/.test(text) ? { travelerScope: 'self' } : {}), ...(q.passengers?.length ? { explicitCount: q.passengers.length } : {}) } : {});
                B.applyBookingPatch(this.host.state(), p, patch);
                c.request = undefined;
                c.resolution = undefined;
                c.aiHandle = undefined;
                await this.persistCurrentBooking();
                if (controller.signal.aborted || this.current !== c || this.key !== key || c.aiRevision !== revision || c.plan !== p)
                    return;
                const missing = B.bookingMissing(p);
                if (missing.length) {
                    this.message('assistant', p.booking.error ?? ('已記下已知條件。還需要：' + missing.join('、') + '。'));
                }
                else if (!p.providerSearch) {
                    await this.searchProvider();
                    if (controller.signal.aborted || this.current !== c || this.key !== key || c.aiRevision !== revision || c.plan !== p)
                        return;
                    if (p.providerSearch && !p.providerError)
                        this.message('assistant', '已找到 ' + p.providerSearch.offers.length + ' 個符合條件的航班選項。請選擇你想搭乘的航班。');
                }
                else
                    this.message('assistant', reply.text ?? '條件與已選航班已保留，可繼續補充需求。');
                this.save();
                this.host.render();
                document.querySelector('[data-provider-offers], [data-booking-preview], .conversational-booking')?.scrollIntoView({ block: 'start' });
                return;
            }
            this.message('assistant', reply.offer ? '已核對所選航班，請查看行程預覽。' : reply.result ? (reply.result.offers.length ? `已找到 ${reply.result.offers.length} 個符合條件的航班選項。請選擇航班，再核對並儲存行程。` : reply.result.message) : reply.text ?? '請補充出發地與日期。');
            const q = reply.result?.query ?? reply.actions?.find(a => a.type === 'navigate_to_planning')?.query;
            if (q) {
                const p = c.plan ?? E.newTravelPlan(s);
                Object.assign(p, { mode: 'itinerary', flightSource: 'reference', origin: q.origin || p.origin, destination: q.destination || p.destination, start: q.outboundDate || p.start, end: q.returnDate ?? p.end, travelType: q.returnDate ? 'return' : 'oneway', cabin: q.cabin ?? p.cabin, departurePeriod: q.departurePeriod ?? 'any', bags: q.bags ?? p.bags, budget: q.budget ?? p.budget, flexible: q.flexible ?? p.flexible, cathayOnly: q.cathayOnly, directOnly: q.directOnly, providerSearch: reply.result, providerHandle: reply.handle, providerConversation: c.aiId, providerRevision: revision, providerError: undefined, providerLoading: false, providerSelection: undefined, selectedFlight: undefined });
                c.plan = p;
                c.request = undefined;
                c.resolution = undefined;
                c.result = undefined;
            }
            if (reply.offer && c.plan) {
                const list = c.plan.providerSearch?.offers, at = list?.findIndex(o => o.offerId === reply.offer.offerId) ?? -1;
                if (list && at >= 0)
                    list[at] = reply.offer;
                c.plan.providerHandle = reply.handle;
                c.plan.providerConversation = c.aiId;
                c.plan.providerRevision = revision;
                c.request = undefined;
                if (reply.actions?.some(a => a.type === 'prepare_plan_draft')) {
                    try {
                        c.plan.selectedFlight = snapshotFromOffer(c.plan, reply.offer);
                        c.plan.providerSelection = reply.offer;
                    }
                    catch (e) {
                        this.message('assistant', e.message + ' 請在表單選擇相符的實際同行成員。');
                    }
                }
            }
            const member = reply.actions?.find(a => a.type === 'member_feature');
            if (member && ['care', 'preparation', 'fund', 'passport', 'student', 'rules'].includes(member.feature ?? '')) {
                r.intent = member.feature;
                await this.run(r);
                return;
            }
            if (c.request === r) {
                c.request = undefined;
                c.resolution = undefined;
            }
        }
        catch (e) {
            if (controller.signal.aborted || this.current !== c || this.key !== key || c.aiRevision !== revision)
                return;
            this.message('assistant', e.message + ' 你的輸入與草稿已保留，可重新發送或用表單繼續。');
            c.draft = text;
            c.modelError = true;
            r.phase = 'error';
        }
        this.save();
        this.host.render();
    }
    open(el) { this.returnFocus = el ?? document.activeElement; this.opened = true; this.host.render(); document.querySelector('#guide-question')?.focus(); }
    close() { this.opened = false; this.host.render(); const el = this.returnFocus?.isConnected ? this.returnFocus : document.querySelector('.assistant-fab'); el?.focus(); }
    async send(text) {
        text = text.trim().slice(0, 500);
        if (!text)
            return;
        this.sync();
        const previous = this.current.request ? structuredClone(this.current.request) : undefined, resolution = this.current.resolution;
        this.message('user', text);
        if (this.host.serviceText?.(text) || this.host.changeText?.(text)) {
            this.current.draft = '';
            this.save();
            this.host.render();
            return;
        }
        this.current.draft = text;
        this.current.lastInput = text;
        this.stashPlan();
        text = sc(text);
        const capability = capabilityAnswer(text);
        if (capability) {
            this.current.draft = '';
            this.cancel(false);
            this.message('assistant', capability);
            this.save();
            this.host.render();
            return;
        }
        if (/第一次出行|怎么用有期/.test(text)) {
            this.cancel(false);
            this.current.request = undefined;
            this.current.plan = undefined;
            this.current.result = 'onboarding';
            this.message('assistant', '可以從三個小步驟開始；已有資料不必重填。');
            this.opened = true;
            this.host.render();
            return;
        }
        if (/目的地推荐|目的地.*推荐|下一個目的地|下一个目的地/.test(text)) {
            this.cancel(false);
            this.current.request = undefined;
            this.current.plan = undefined;
            this.current.result = 'destinations';
            this.message('assistant', '這些目的地可以作為下一段旅程的起點。選一張「一起規劃」，目的地會帶入草稿；日期和同行仍由你決定。');
            this.opened = true;
            this.host.render();
            return;
        }
        if (/看看全家.*没办妥|看看返校.*准备/.test(text)) {
            this.cancel(false);
            const rows = E.rankedJourneys(this.host.state()), row = /返校/.test(text) ? rows.find(x => x.j.ownerId === this.host.state().actorId && !x.j.familyId && !x.ended) : rows.find(x => !!x.j.familyId && !x.ended);
            this.current.request = undefined;
            this.current.plan = undefined;
            this.current.result = 'summary';
            this.current.summaryTripId = row?.j.id;
            this.message('assistant', row ? '已讀取目前可查看的行程。下面是即時待辦，點擊後可繼續核對。' : '目前沒有相關的有效行程，可以先建立自己的旅行計劃。');
            this.opened = true;
            this.host.render();
            return;
        }
        if (this.current.plan && /希望.*(下午|上午|晚上).*到|想.*(下午|上午|晚上).*到/.test(text)) {
            const p = this.current.plan;
            p.constraints = { immigrationMinutes: 60, baggageMinutes: 30, transportMinutes: 60, ...p.constraints, preferredArrival: text.includes('下午') ? 'afternoon' : text.includes('上午') ? 'morning' : 'evening', accepted: false };
            this.message('assistant', '已記下你的抵達時段偏好；航班計劃起降時間保持不變，選擇後會檢查是否符合。');
            this.save();
            this.host.render();
            return;
        }
        if (connection.model !== 'verified' && this.current.plan && /东京|東京|伦敦|倫敦|台北|香港|预算|預算|[0-9]{4}-[0-9]{2}-[0-9]{2}/.test(text) && !/轮椅|外婆|照护|取消|不用/.test(text)) {
            const p = this.current.plan;
            for (const [word, code] of [['东京', 'NRT'], ['伦敦', 'LHR'], ['台北', 'TPE'], ['香港', 'HKG']])
                if (text.includes(word))
                    p.destination = code;
            const days = text.match(/\d{4}-\d{2}-\d{2}/g);
            if (days) {
                p.start = days[0];
                if (days[1])
                    p.end = days[1];
            }
            const budget = text.match(/预算[^0-9]{0,4}(\d+)/);
            if (budget)
                p.budget = Number(budget[1]);
            p.selectedFlight = undefined;
            p.providerSearch = undefined;
            p.providerSelection = undefined;
            p.providerHandle = undefined;
            p.providerRevision = (p.providerRevision ?? 0) + 1;
            if (p.flightSearch)
                p.flightSearch.status = 'stale';
            this.message('assistant', '已把明確提供的資料帶入規劃草稿，請在表單核對後預覽儲存。');
            this.save();
            this.host.render();
            return;
        }
        this.current.result = undefined;
        const booking = this.current.plan, careConversation = this.current, careKey = this.key;
        if (booking?.booking && booking.selectedFlight) {
            const task = parseCareTask(this.host.state(), { ...this.context, familyId: booking.familyId ?? null, tripId: null, tripVersion: 0 }, text, crypto.randomUUID());
            if (task?.goal === 'hold') {
                this.message('assistant', '已停止這次照護引導；尚未確認的安排可修改，原行程與長期檔案未改動。');
                this.current.draft = '';
                this.host.render();
                return;
            }
            if (task && task.services.length) {
                this.cancel(false);
                this.current.request = undefined;
                this.current.draft = '';
                try {
                    if (task.personIds.length !== 1)
                        throw Error('請指出這次需要照護的同行成員。');
                    B.proposeBookingCare(this.host.state(), booking, task.personIds[0], task.services, undefined, task.correction);
                    await this.persistCurrentBooking();
                    if (this.current !== careConversation || this.key !== careKey)
                        return;
                    this.message('assistant', '已整理 ' + displayName(this.host.state().persons[task.personIds[0]]) + '的本次需求。' + (booking.booking.care?.caregiverId ? '已帶入同行的照護者，請核對安排。' : '請選擇同行照護者，再確認安排。'));
                }
                catch (e) {
                    booking.booking.error = e.message;
                }
                this.save();
                this.host.render();
                return;
            }
        }
        this.cancel(false);
        const context = { ...this.context }, controller = new AbortController();
        this.controller = controller;
        const r = { id: crypto.randomUUID(), context, intent: 'unknown', phase: 'resolving', text, trace: ['resolving'] };
        this.current.request = r;
        this.opened = true;
        this.host.render();
        const task = parseCareTask(this.host.state(), context, text, r.id, previous?.careTask && sameContext(previous.context, context) ? previous.careTask : undefined, this.host.selectedPerson?.());
        if (task && (providerMode === 'mock' || task.slots.member.status !== 'missing' || ['rules', 'hold'].includes(task.goal))) {
            r.careTask = task;
            r.intent = 'care';
            await this.run(r);
            return;
        }
        if (connection.model === 'verified') {
            await this.sendModel(text, r, controller);
            return;
        }
        let result;
        try {
            result = await assistantProvider().understand({ requestId: r.id, context, text, previous, careDirectory: careDirectory(this.host.state(), context), signal: controller.signal });
        }
        catch {
            if (controller.signal.aborted)
                return;
            this.message('assistant', '小期暫時無法連線，我會先用目前資料幫你定位下一步。');
            result = await new MockAssistantProvider().understand({ requestId: r.id, context, text, previous });
        }
        if (controller.signal.aborted || !sameContext(context, guideContext(this.host.state(), this.personal)) || this.current.request?.id !== r.id)
            return;
        if (!validateToolRequest(result, r.id)) {
            this.phase(r, 'error');
            this.host.render();
            return;
        }
        if (result.cancel) {
            this.current.resolution = { kind: 'answer', message: result.message ?? '这次引导已停止。' };
            this.phase(r, 'completed');
            this.host.render();
            return;
        }
        r.intent = result.intent;
        Object.assign(r, result.slots ?? {});
        if (result.care) {
            const semantic = applyCareProposal(this.host.state(), context, r.id, result.care, previous?.careTask);
            if (!semantic) {
                this.phase(r, 'error');
                this.current.resolution = { kind: 'answer', message: '語義建議中的對象或需求未通過授權校驗；已保留原草稿，請提供成員姓名。' };
                this.host.render();
                return;
            }
            r.careTask = semantic;
            r.intent = 'care';
        }
        else if (task) {
            r.careTask = task;
            r.intent = 'care';
        }
        if (previous?.phase === 'clarifying' && resolution?.kind === 'clarify' && resolution.reason === 'school' && r.intent === 'unknown') {
            r.intent = 'student';
            r.school = text;
            r.start = previous.start;
        }
        await this.run(r);
    }
    async impact(target) { const prompts = { 'transfer-route': '登机口变化，带我查看新的路线', 'arrival-conflict': '飞机晚点了，学校接机还能赶上吗？', 'posttrip-summary': '查看旅后摘要' }; if (prompts[target])
        await this.send(prompts[target]); }
    async choose(choice, requestId) {
        this.sync();
        const r = this.current.request, x = this.current.resolution;
        if (!r || r.id !== requestId || r.phase !== 'clarifying' || x?.kind !== 'clarify' || !x.choices.some(c => c.id === choice))
            return;
        if (choice.startsWith('family:')) {
            this.opened = false;
            this.host.render();
            if (!await this.host.switchFamily(choice.slice(7)))
                return;
            this.sync();
            const next = { ...r, id: crypto.randomUUID(), context: { ...this.context }, familyConfirmed: true, careTask: undefined, phase: 'resolving', trace: ['resolving'] };
            this.current.request = next;
            this.message('user', r.text);
            await this.run(next);
            return;
        }
        if (choice.startsWith('intent:')) {
            r.intent = choice.slice(7);
            await this.run(r);
            return;
        }
        if (choice.startsWith('service:')) {
            r.service = choice.slice(8);
            if (r.careTask) {
                r.careTask.services = [r.service];
                r.careTask.needs = r.careTask.needs.filter(n => n.service === r.service);
                r.careTask.slots.service = { status: 'resolved', source: 'choice' };
            }
            await this.run(r);
            return;
        }
        if (choice === 'confirm-cancellation') {
            if (!sameContext(r.context, this.context))
                return;
            this.host.cancelTrip();
            r.context = guideContext(this.host.state(), this.personal);
            this.context = r.context;
        }
        await this.run(r, choice);
    }
    async run(r, choice) { try {
        const x = resolveGuide(this.host.state(), r, choice);
        if (!validateResolution(this.host.state(), r, x))
            throw Error('权限或目标已变化，请重新发起。');
        this.current.resolution = x;
        if (x.kind === 'navigate') {
            r.target = x.target;
            r.personId = x.personId;
            r.service = x.service;
            await this.navigate(r, x, true);
        }
        else {
            this.phase(r, x.kind === 'clarify' ? 'clarifying' : 'completed');
            if (x.kind === 'answer')
                this.message('assistant', x.message);
            this.opened = true;
            this.host.render();
        }
    }
    catch (e) {
        this.phase(r, 'error');
        this.current.resolution = { kind: 'answer', message: e.message };
        this.opened = true;
        this.host.render();
    } }
    async navigate(r, x, prepare) {
        this.controller?.abort();
        const controller = new AbortController();
        this.controller = controller;
        const valid = () => !controller.signal.aborted && sameContext(r.context, guideContext(this.host.state(), this.personal)) && this.current.request?.id === r.id;
        this.phase(r, 'navigating');
        this.opened = false;
        this.host.render();
        if (!await this.host.navigate(x.view, x)) {
            this.phase(r, 'cancelled');
            r.careTask = undefined;
            this.current.resolution = { kind: 'answer', message: '已保留原有編輯，這次定位已取消，沒有變更對象或提交申請。' };
            this.host.render();
            return;
        }
        if (!valid())
            return;
        this.phase(r, 'revealing');
        this.host.reveal(x, prepare);
        try {
            const target = await this.waitForTarget(x, controller.signal);
            if (!valid())
                return;
            this.clearHighlight();
            this.highlight = target;
            target.classList.add('guide-highlight');
            target.scrollIntoView({ block: 'center', behavior: 'instant' });
            if (!target.hasAttribute('tabindex'))
                target.setAttribute('tabindex', '-1');
            target.focus({ preventScroll: true });
            this.phase(r, 'highlighting');
            this.message('assistant', x.message);
            if (x.careTask)
                document.documentElement.dataset.assistantDiagnostic = JSON.stringify(recognitionDiagnostics(x.careTask, 'highlighted'));
            target.addEventListener('input', () => this.clearHighlight(), { once: true });
            target.addEventListener('pointerdown', () => this.clearHighlight(), { once: true });
            const onKey = (e) => { if (e.key === 'Escape')
                this.clearHighlight(); };
            document.addEventListener('keydown', onKey, { signal: controller.signal });
            this.highlightTimer = setTimeout(() => { this.clearHighlight(); if (valid())
                this.phase(r, 'awaiting_confirmation'); }, 3000);
            // Update only the strip; replacing the page here would discard focus and highlight.
            const label = document.querySelector('.guide-status strong');
            if (label)
                label.textContent = '已定位 · 下一步由你确认';
            const note = document.querySelector('.guide-status span');
            if (note)
                note.textContent = x.message;
        }
        catch (e) {
            if (controller.signal.aborted)
                return;
            this.phase(r, 'error');
            this.current.resolution = { kind: 'answer', message: '页面已打开，但目标未就绪。可以使用页面表单，或重新发起引导。' };
            this.opened = true;
            this.host.render();
        }
    }
    waitForTarget(x, signal) {
        // The application owns these fixed target IDs. No model-provided selector or URL is evaluated.
        const find = () => document.querySelector('[data-guide-id="' + x.target + '"]');
        return new Promise((resolve, reject) => { const finish = (e) => { observer.disconnect(); clearTimeout(bound); signal.removeEventListener('abort', abort); if (e)
            reject(e);
        else {
            const target = find();
            for (let p = target.parentElement; p; p = p.parentElement)
                if (p instanceof HTMLDetailsElement)
                    p.open = true;
            resolve(target);
        } }; const observer = new MutationObserver(() => { if (find())
            finish(); }), abort = () => finish(new Error('cancelled')), bound = setTimeout(() => finish(new Error('target unavailable')), 2000); if (signal.aborted) {
            finish(new Error('cancelled'));
            return;
        } signal.addEventListener('abort', abort, { once: true }); if (find()) {
            finish();
            return;
        } observer.observe(document.querySelector('#app'), { childList: true, subtree: true }); });
    }
}
