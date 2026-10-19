import { tripDecision, cancellationRecord } from '/assets/ee1ad71b9a14d41f146c/trip-decision.js';
import { preparationTasks } from '/assets/ee1ad71b9a14d41f146c/preparation-state.js';
import { serviceActionLabel } from '/assets/ee1ad71b9a14d41f146c/service-state.js';
import { serviceState } from '/assets/ee1ad71b9a14d41f146c/service-state.js';
import { flightLabel } from '/assets/ee1ad71b9a14d41f146c/passport-visual.js';
import { bookingCareRecords } from '/assets/ee1ad71b9a14d41f146c/booking-ui.js';
import { checkConstraints } from '/assets/ee1ad71b9a14d41f146c/flights.js';
import { flightSummary } from '/assets/ee1ad71b9a14d41f146c/flight-ui.js';
import { airport } from '/assets/ee1ad71b9a14d41f146c/web/travel.js';
import { recoveryPanel } from '/assets/ee1ad71b9a14d41f146c/recovery-ui.js';
import { journeyModel } from '/assets/ee1ad71b9a14d41f146c/journey-context.js';
import { learningCard } from '/assets/ee1ad71b9a14d41f146c/learning-ui.js';
import * as D from '/assets/ee1ad71b9a14d41f146c/domain.js';
import * as J from '/assets/ee1ad71b9a14d41f146c/transit.js';
import { fundsFor, fundTotals } from '/assets/ee1ad71b9a14d41f146c/fund.js';
import { displayName, relationshipLabel } from '/assets/ee1ad71b9a14d41f146c/identity.js';
import { SERVICE_LABELS } from '/assets/ee1ad71b9a14d41f146c/config.js';
import { preparationSummary } from '/assets/ee1ad71b9a14d41f146c/guide.js';
import { esc, btn, chip, heading, date, icon } from '/assets/ee1ad71b9a14d41f146c/ui.js';
export const freshBusiness = () => ({ home: 'default', student: 'input', care: 'overview', preparation: 'checklist', fund: 'entry', journey: 'auto', request: null });
export const screenButton = (label, screen, style = 'ghost') => `<button class="button ${style}" data-screen="${screen}">${label}</button>`;
const back = (label, screen) => `<div class="business-breadcrumb">${screenButton(label, screen)}<span aria-hidden="true">/</span></div>`;
const details = (label, body, key) => body ? `<details class="business-details" data-disclosure="${key}"><summary>${label}</summary><div class="disclosure-body">${body}</div></details>` : '';
const parse = (html) => { const t = document.createElement('template'); t.innerHTML = html; return t.content; };
const take = (root, selector) => root.querySelector(selector)?.outerHTML ?? '';
const remove = (root, selector) => root.querySelectorAll(selector).forEach(e => e.remove());
const n = (s, id) => esc(displayName(s.persons[id]));
const tripStrip = (s, edit = false) => { const t = s.activeFamilyId ? D.currentTrip(s, s.activeFamilyId) : null; return t ? `<section class="trip-strip"><strong>${t.route.origin} → ${t.route.destination}</strong><span>${date(t.route.date)}</span><span>${esc(flightLabel(t.route.number))}</span><span>${t.members.length}位旅客 · ${t.members.filter(m => m.occupiesSeat).length}個座位</span>${edit ? `<button class="text-link" data-edit-trip="${t.id}">調整行程</button>` : ''}</section>` : ''; };
export function businessView(s, ui, view, legacy, b) {
    if (['care', 'preparation', 'recovery'].includes(view) && !D.canAccessFamily(s, s.activeFamilyId))
        return legacy;
    if (['preparation', 'recovery'].includes(view) && s.selectedTripId && tripDecision(s, s.selectedTripId).userCancelled)
        return cancellationRecord(s, s.selectedTripId);
    const root = parse(legacy);
    if (view === 'home')
        return home(s, ui, root, b);
    if (view === 'student')
        return student(s, ui, root, b);
    if (view === 'care')
        return care(s, ui, root, b);
    if (view === 'preparation')
        return preparation(s, root, b);
    if (view === 'recovery') {
        const t = s.activeFamilyId ? D.currentTrip(s, s.activeFamilyId) : null;
        return t ? recoveryPanel(s, t) : recovery(s, root);
    }
    if (view === 'fund')
        return fund(s, root, b);
    if (view === 'journey')
        return `<div data-guide-id="journey-context" tabindex="-1">${journey(s, root, b)}</div>`;
    return legacy;
}
function home(s, ui, root, b) {
    if (b.home === 'tasks') {
        const tasks = root.querySelector('.task-panel');
        if (!tasks)
            return back('首頁', 'home:default') + heading('', '家庭任務', '選擇一個家庭，查看已授權的任務。');
        const cards = Array.from(tasks.querySelectorAll('.task-card'));
        if (cards.length > 3) {
            const rest = cards.slice(3).map(x => { const h = x.outerHTML; x.remove(); return h; }).join('');
            tasks.insertAdjacentHTML('beforeend', details('查看其他任務', rest, 'more-tasks'));
        }
        const shared = Array.from(root.children).find(e => e.querySelector('h2')?.textContent === '家人共享的学期安排');
        return back('首頁', 'home:default') + heading('', '家庭任務', '選擇一項準備任務，繼續累積出行記錄。') + take(root, '.goal-card') + tasks.outerHTML + details('家人共享的學期安排', shared?.outerHTML ?? '', 'shared-plans') + `<div class="button-row spaced">${screenButton('成長護照 →', 'home:passport', 'secondary')}${screenButton('查看個人里數帳本', 'home:ledger')}</div>`;
    }
    if (b.home === 'passport') {
        const book = root.querySelector('.passport-book');
        if (book) {
            remove(book, '.passport-mini,.passport-seal');
            const h = book.querySelector('h2');
            if (h)
                h.textContent = '飛行足跡';
        }
        return back('首頁', 'home:default') + heading('', '成長護照', '保留每一段已完成的飛行記錄。') + (book?.outerHTML ?? '<section class="panel">請先選擇已授權的家庭。</section>');
    }
    if (b.home === 'ledger')
        return back('家庭任務', 'home:tasks') + heading('', '個人里數帳本', '里數分別持有，按會員與交易記錄核對。') + (Array.from(root.children).find(e => e.querySelector('.ledger-preview'))?.outerHTML ?? '');
    const family = s.activeFamilyId ? s.families[s.activeFamilyId] : null;
    const t = family ? D.currentTrip(s, family.id) : null;
    const personal = J.currentJourney(s), studentJourney = personal && !personal.familyId;
    const summary = family ? preparationSummary(s, family.id) : null;
    const cards = [['學期航程規劃', '按校曆安排你的出行。', 'student', 'calendar', '開始規劃'], ['家庭照護', '管理家人的照護需求。', 'care', 'care', '管理照護'], ['行前準備', '核對出發前的重要事項。', 'preparation', 'check', '查看清單']];
    return `<div class="page-heading"><div><p class="context-label">${esc(family?.name ?? '個人空間')}</p><h1>你好，${n(s, s.actorId)}。</h1><p>管理旅程，也照顧重要的人。</p></div></div>${ui.assistantHome ?? ''}<section class="home-entry-section"><h2>常用功能</h2><div class="business-entry-grid">${cards.map(([title, copy, v, i, label]) => `<article class="panel entry-card">${icon(i)}<h3>${title}</h3><p>${copy}</p><button class="text-link" data-view="${v}">${label} →</button></article>`).join('')}</div></section><section class="home-next"><h2>接下來的旅程</h2>${studentJourney ? `<div class="trip-strip"><strong>${personal.segments.map(x => x.from).join(' → ')} → ${J.lastLeg(personal).to}</strong><span>${esc(J.journeySummary(personal))}</span><button class="text-link" data-view="journey">查看行程指引 →</button></div>` : t ? `<div class="trip-strip"><strong>${t.route.origin} → ${t.route.destination}</strong><span>${date(t.route.date)} · ${t.members.length}位旅客</span>${chip(summary?.title ?? '準備下一程', 'warning')}<button class="text-link" data-view="${t.status === 'cancelled' ? 'recovery' : 'preparation'}">${t.status === 'cancelled' ? '查看替代安排' : '繼續準備'} →</button></div>` : `<div class="trip-strip"><span>還沒有下一趟行程。</span>${family ? btn('建立行程', 'route', '', 'secondary') : btn('建立家庭資料', 'create-family', '', 'secondary')}</div>`}</section>`;
}
function student(s, ui, root, b) {
    const p = ui.planDraft ?? s.plans[s.actorId];
    const form = root.querySelector('#student-form');
    if (!form)
        return root.textContent ?? '';
    const results = root.querySelector('.planner-results');
    const warnings = Array.from(results.children).filter(e => e.classList.contains('notice'));
    const warn = warnings[0]?.outerHTML ?? '';
    const save = take(root, '.page-heading [data-action="save-plan"]').replace('<button ', '<button type="button" ');
    if (b.student === 'input') {
        const fields = Array.from(form.querySelectorAll('.field'));
        const names = ['schoolSample', 'school', 'homeAirport', 'scenario', 'origin', 'destination', 'departure', 'start', 'dorm', 'budget', 'bags'];
        const primary = names.map(name => fields.find(f => f.querySelector(`[name="${name}"]`))?.outerHTML ?? '').join('');
        const advanced = fields.filter(f => !names.some(name => f.querySelector(`[name="${name}"]`))).map(f => f.outerHTML).join('');
        form.innerHTML = `<div class="form-grid">${primary}</div>${btn('預覽並導入校曆', 'calendar-preview', 'type="button"', 'secondary')}<p class="field-hint">可選擇校曆範本或手動填寫。核對並保存後才完成校曆任務；不會自動領取里數。</p>${details('證件及其他校曆', `<div class="form-grid">${advanced}</div>${take(results, '.calendar-panel')}`, 'student-calendar')}${warn}<div class="button-row form-actions"><button class="button" type="submit">查看航程方案</button>${save}</div><p class="meta">簽證日期僅作提醒，請自行核對實際文件要求。</p>`;
        return heading('', '學期航程規劃', '按校曆、預算與行李需求安排出發。') + `<section class="panel business-form">${form.outerHTML}</section>` + learningCard(s);
    }
    if (b.student === 'year') {
        const tail = Array.from(results.children).filter(e => e.matches('section') && !e.classList.contains('calendar-panel'));
        return back('比較方案', 'student:options') + heading('', '整學年計劃', `${n(s, s.actorId)} · ${esc(p.school)}`, save) + tail.map(e => e.outerHTML).join('');
    }
    return back('學期航程規劃', 'student:input') + heading('', '查詢學期航班', '選擇航班後，再核對校曆與抵達安排。', save) + '<section class="panel"><p>航班查詢與首頁新增行程共用同一份時刻表與保存校驗。</p><button class="button" data-action="student-flights">查詢航班</button></section>' + screenButton('查看整學年計劃', 'student:year', 'secondary');
}
function care(s, ui, root, b) {
    const f = s.activeFamilyId;
    if (!f || !D.canAccessFamily(s, f))
        return take(root, '.page-heading') + take(root, '.empty');
    if (ui.careDraft) {
        const card = root.querySelector('#care-form')?.closest('.member-card'), form = card?.querySelector('#care-form');
        if (!form)
            return take(root, '.member-grid');
        const main = form.querySelector('.checks-grid');
        const other = Array.from(main.children).filter(e => !e.querySelector('[value="bassinet"],[value="infantMeal"],[value="adjacent"]'));
        if (ui.careDraft.months !== null && ui.careDraft.months < 24) {
            const rest = other.map(e => { const h = e.outerHTML; e.remove(); return h; }).join('');
            main.insertAdjacentHTML('afterend', details('其他服務需求', rest, 'care-services'));
        }
        const footer = form.querySelector('.button-row');
        footer?.insertAdjacentHTML('beforebegin', '<p class="meta">儲存不會改動已提交申請；請在行前準備中重新預覽。</p>');
        return back('家庭照護', 'care:overview') + heading('', '編輯照護需求', `${n(s, ui.careDraft.personId)} · ${esc(s.families[f].name)}`) + take(root, '.assistant-care-draft') + `<section class="panel business-form">${form.outerHTML}</section>${bookingCareRecords(s, ui.careDraft.personId)}`;
    }
    if (b.care === 'all')
        return back('家庭照護', 'care:overview') + heading('', '全部家庭成員', '查看已授權的需求與照護關係。', btn('家庭管理', 'manage-family', '', 'secondary')) + take(root, '.care-intake') + take(root, '.member-grid');
    const members = D.familyMembers(s, f), write = D.canAccessFamily(s, f) && D.membership(s, f)?.role !== 'viewer';
    const ordered = [...members].sort((a, b) => Number(b.personId === s.actorId) - Number(a.personId === s.actorId));
    // Keep the complete demo family in reach; each row still checks its own care permission.
    const shown = ordered.slice(0, 6);
    return bookingCareRecords(s) + heading('', '家庭照護', esc(s.families[f].name) + ' · 為家人保留常用照護需求。') + take(root, '.care-intake') + `<section class="panel"><div class="section-title"><div><h2>${esc(s.families[f].name)}</h2><p class="meta">${members.length}位成員 · ${write ? '可管理已授權資料' : '僅查看'}</p></div>${screenButton('管理照護資料', 'care:all', 'primary')}</div><div class="business-member-list">${shown.map(m => { const p = s.profiles[f + ':' + m.personId], can = D.permitted(s, f, m.personId, 'care:view'), edit = D.permitted(s, f, m.personId, 'care:edit'), missing = can && p?.needs.includes('bassinet') && !p.weight; return `<div class="business-member-row"><strong>${n(s, m.personId)}</strong><span>${esc(relationshipLabel(s, f, m.personId))}</span><span>${!can ? '照護詳情未授權' : missing ? '體重待補' : p?.needs.length ? '已保存常用需求' : '暫無照護需求'}</span>${edit ? btn(missing ? '補充資料 →' : '編輯 →', 'edit-care', `data-person="${m.personId}"`, 'ghost') : btn('資料與授權', 'member-info', `data-person="${m.personId}"`, 'ghost')}</div>`; }).join('')}</div>${screenButton(`查看全部${members.length}位成員 →`, 'care:all')}</section><div class="trip-strip spaced"><div><strong>照護關係</strong><span>管理同行時的照護安排。</span></div>${screenButton('查看關係 →', 'care:all')}</div><p class="meta">照護資料會在準備行程時帶入，服務申請需另外確認。</p>`;
}
function preparation(s, root, b) {
    const f = s.activeFamilyId, t = f ? D.currentTrip(s, f) : null;
    if (!f || !t)
        return take(root, '.page-heading') + take(root, '.empty');
    const write = D.canAccessFamily(s, f) && D.membership(s, f)?.role !== 'viewer', rs = D.visibleRequests(s, t);
    const cards = Array.from(root.querySelectorAll('.request-card'));
    const checklist = Array.from(root.children).find(e => e.querySelector('.checklist'));
    if (b.preparation === 'travellers')
        return back('行前準備', 'preparation:checklist') + heading('', '同行人與座位', '確認实际同行與必要照護關係。') + take(root, '.preparation-top') + (Array.from(root.children).find(e => e.querySelector('.seat-layout'))?.outerHTML ?? '');
    if (b.preparation === 'documents')
        return back('行前準備', 'preparation:checklist') + heading('', '核對出發事項', '文件、照護人與服務回執需分別確認。') + tripStrip(s) + (checklist?.outerHTML ?? '');
    if (b.preparation === 'detail') {
        const r = rs.find(x => x.id === b.request);
        if (!r) {
            b.preparation = 'services';
            return preparation(s, root, b);
        }
        const card = cards[rs.indexOf(r)];
        const supplement = card.querySelector('[data-view="care"]');
        if (supplement && D.permitted(s, f, r.personId, 'care:edit'))
            supplement.outerHTML = `<button class="button secondary" data-business-care="${r.personId}">前往補充照護資料</button>`;
        return back('所有服務', 'preparation:services') + heading('', SERVICE_LABELS[r.kind], `${n(s, r.personId)} · ${esc(flightLabel(t.route.number))}`) + tripStrip(s) + `<div class="single-service">${card.outerHTML}</div>`;
    }
    if (b.preparation === 'services') {
        const headingNode = root.querySelector('[data-guide-id="preparation-tasks"]');
        return back('行前準備', 'preparation:checklist') + heading('', '服務辦理進度', '先確認資料用途，再逐項核對回執。') + tripStrip(s) + (headingNode?.outerHTML ?? '') + (rs.length ? `<section class="panel service-list">${rs.map(r => `<div class="service-row"><div><strong>${SERVICE_LABELS[r.kind]}</strong><small>${n(s, r.personId)} · 航段 ${Number(r.segmentId.split('-s').at(-1)) + 1}</small></div>${chip(serviceState(s, r).label, serviceState(s, r).owner === 'user' ? 'warning' : 'neutral')}<button class="text-link" data-service-detail="${r.id}">查看詳情 →</button></div>`).join('')}</section>` : take(root, '.empty'));
    }
    const tasks = preparationTasks(s, t.id), completed = tasks.filter(x => x.status === 'done').length, states = rs.map(r => serviceState(s, r));
    return heading('', '行前準備', '先核對出發準備，再查看照護申請與服務結果。') + tripStrip(s, write) + `<section class="panel" data-guide-id="preparation-tasks" tabindex="-1"><div class="section-title"><h2>準備清單</h2><span class="meta">${completed} / ${tasks.length} 項已核對</span></div><div class="preparation-list">${tasks.map(x => `<div class="preparation-row" data-task-id="${esc(x.taskId)}"><div class="preparation-copy"><strong>${esc(x.title)}</strong><p class="meta">${esc(x.next)}</p></div>${chip(x.status === 'done' ? '已核對' : '待你處理', x.status === 'done' ? 'neutral' : 'warning')}${x.taskId.endsWith(':care') ? `<button class="text-link" data-service-assistant="${t.id}">${serviceActionLabel(s, t.id)}</button>` : `<button class="text-link" data-demo-action="task" data-id="${x.taskId}">${x.status === 'done' ? '查看' : '核對'}</button>`}</div>`).join('')}</div><div class="service-progress-summary"><h3>照護服務</h3><p>待你處理 ${states.filter(x => x.owner === 'user').length} 項 · 待國泰確認 ${states.filter(x => x.owner === 'airline').length} 項 · 專人跟進 ${states.filter(x => x.owner === 'support').length} 項 · 已確認 ${states.filter(x => x.confirmed).length} / ${states.length} 項</p><p class="meta">家庭資料帶入後，按本次航段確認提交；服務結果以獨立回覆為準。</p></div><div class="button-row form-actions">${write ? `<button class="button" data-service-assistant="${t.id}">${serviceActionLabel(s, t.id)}</button>` : ''}${screenButton('查看所有服務', 'preparation:services', 'secondary')}</div></section>`;
}
function recovery(s, root) { const f = s.activeFamilyId, t = f ? D.currentTrip(s, f) : null; return t ? recoveryPanel(s, t) : take(root, '.empty'); }
function fund(s, root, b) {
    const picker = root.querySelector('#fund-switch');
    const visible = fundsFor(s);
    const f = visible.find(x => x.id === picker?.value) ?? visible.find(x => x.ownerId === s.actorId) ?? visible[0];
    if (!f)
        return take(root, '.page-heading') + take(root, '.empty');
    if (b.fund === 'entry' && !new URLSearchParams(location.search).has('invite'))
        return heading('', '回家基金', '由親友支持你的回家旅程。') + `<section class="panel fund-entry"><h2>${f.ownerId === s.actorId ? '我的回家目標' : '獲邀支持的回家目標'}</h2><p>目前可查看${visible.length}個回家目標。</p><p class="muted">下一步：查看目標與親友支持。</p>${screenButton('查看基金 →', 'fund:detail', 'primary')}</section>` + details('回家基金如何運作', '<p>親友支持保留給受益學生本人的合資格機票；不可提現或轉出。</p>', 'fund-how');
    const total = fundTotals(s, f), owner = f.ownerId === s.actorId;
    const records = root.querySelector('.fund-columns > .panel');
    const history = records ? Array.from(records.querySelectorAll('.support-list > article')) : [];
    const recent = history.slice(-2).map(x => x.outerHTML).join('');
    const older = history.slice(0, -2).map(x => x.outerHTML).join('');
    const invite = take(root, '.fund-main .button-row');
    const columns = root.querySelector('.fund-columns');
    const extra = columns?.lastElementChild;
    return back('回家基金', 'fund:entry') + heading('', '我的回家基金', esc(f.title), take(root, '.page-heading [data-action="fund-create"]')) + take(root, '.fund-picker') + `<section class="panel fund-summary"><div><span class="meta">目標航線</span><h2>${f.origin} → ${f.destination}</h2></div><div><span class="meta">出行窗口</span><p>${date(f.from)} — ${date(f.until)}</p></div><div><span class="meta">已確認支持</span><p><strong>${total.confirmed.toLocaleString()}</strong> / ${f.target.toLocaleString()}里</p><div class="progress-track" data-progress-id="fund-${f.id}"><i style="width:${Math.min(100, total.confirmed / f.target * 100)}%"></i></div></div></section><section class="panel spaced"><h2>最近支持</h2><div class="support-list">${recent || '<p class="muted">目前沒有支持記錄。</p>'}</div>${older ? details('查看所有支持記錄', `<div class="support-list">${older}</div>`, 'fund-records') : ''}</section><div class="fund-primary spaced">${invite}</div>` + details('兌換條件與目標管理', extra?.outerHTML ?? '', 'fund-redemption') + details('支持狀態與使用規則', take(root, '.fund-stats') + take(root, '.fund-side') + (f.status === 'refunding' && owner ? btn('原路退回', 'fund-refund', `data-fund="${f.id}"`) : ''), 'fund-rules') + `<p class="meta">只供${n(s, f.ownerId)}本人兌換，不可提現或轉出。</p>`;
}
function journey(s, root, b) {
    const j = J.currentJourney(s);
    if (!j)
        return take(root, '.page-heading') + take(root, '.panel');
    const vm = journeyModel(s, j);
    if (!vm.student)
        return take(root, '.page-heading') + take(root, '#posttrip-section');
    const leg = J.lastLeg(j), phase = b.journey === 'auto' ? vm.defaultPanel : b.journey;
    const tabs = `<nav class="business-tabs" aria-label="行程階段">${(j.familyId ? [['posttrip', '旅後']] : [['transfer', j.segments.length > 1 ? (vm.transferActive ? '轉機' : '航班計劃') : '航班資訊'], ['arrival', '抵達與到校'], ['posttrip', '旅後']]).map(([id, label]) => `<button data-screen="journey:${id}" aria-current="${phase === id ? 'page' : 'false'}">${label}</button>`).join('')}</nav>`;
    if (phase === 'posttrip')
        return heading('', vm.showPosttrip ? '旅後記錄' : '行程紀錄（尚未結束）', `${n(s, j.ownerId)} · ${leg.from} → ${leg.to}`) + tabs + take(root, '#posttrip-section');
    if (phase === 'arrival' && j.selectedFlight) {
        const selected = j.selectedFlight.outbound, c = j.ownerId === s.actorId ? j.planningConstraints : undefined, leg = j.segments[selected.legs.length - 1];
        const current = { ...selected, legs: selected.legs.map((x, i) => ({ ...x, arrival: j.segments[i].actualLanding ?? j.segments[i].estimatedArrival ?? j.segments[i].scheduledArrival })) }, check = checkConstraints(current, c), zone = selected.legs.at(-1).arrivalZone;
        return heading('', '去程抵達安排', selected.origin + ' → ' + selected.destination + ' · ' + zone) + tabs + '<section class="panel" data-guide-id="arrival-conflict"><h2>航班與個人安排</h2>' + flightSummary(selected) + '<p>即時預計抵達：' + (leg.estimatedArrival ? J.fullTime(leg.estimatedArrival, zone) : '尚無資料') + '；實際抵達：' + (leg.actualLanding ? J.fullTime(leg.actualLanding, zone) : '尚無紀錄') + '</p>' + (c ? '<h3>' + esc(c.school ?? '到校與住宿') + '</h3><p>宿舍開放：' + esc(c.dormOpen?.replace('T', ' ') || '未填寫') + ' · 報到期限：' + esc(c.reportBy?.replace('T', ' ') || '未填寫') + ' · 接機集合：' + esc(c.pickupAt?.replace('T', ' ') || '未填寫') + '</p><p>估算到校：' + (check.readyAt ? J.fullTime(check.readyAt, zone) : '待確認') + ' · 通關 ' + c.immigrationMinutes + '、取行李 ' + c.baggageMinutes + '、交通 ' + c.transportMinutes + ' 分鐘。上述緩衝皆為個人估算。</p>' + check.notes.map(n => '<p class="notice warning">' + esc(n) + '</p>').join('') : '<p>尚未填寫本人到校與接機安排。</p>') + '<p class="meta">此處核對去程目的地；回程保留自己的日期與航段。估算不代表已落地、已預訂接機或完成準備。</p></section>';
    }
    if (phase === 'arrival') {
        const section = root.querySelector('#arrival-section');
        section.removeAttribute('hidden');
        const progress = Array.from(section.children).find(x => x.querySelector('.arrival-steps'));
        if (progress) {
            progress.insertAdjacentHTML('beforebegin', details('更新我的抵達進度', progress.outerHTML, 'arrival-progress'));
            progress.remove();
        }
        const conflict = section.querySelector('[data-guide-id="arrival-conflict"]');
        if (conflict) {
            const facts = take(conflict, '.journey-facts');
            remove(conflict, '.journey-facts');
            conflict.insertAdjacentHTML('beforeend', details('接機與入住時間明細', facts, 'arrival-times'));
        }
        remove(section, ':scope > h2');
        return heading('', '抵達後安排', `${esc(j.school.name)} · 目的地當地時間`) + tabs + section.outerHTML;
    }
    const transfer = root.querySelector('#transfer-section');
    transfer.removeAttribute('hidden');
    const flight = transfer.querySelector('[data-guide-id="next-flight"]');
    if (j.segments.length === 1 && !j.selectedFlight)
        return heading('', '出發與航班資訊', vm.summary) + tabs + flight.outerHTML;
    if (!vm.transferActive)
        return heading('', '航班與轉機計劃', vm.summary) + tabs + `<section class="panel" data-guide-id="journey-context" data-timeline="planned"><h2>${j.segments.map(x => x.from).join(' → ')} → ${leg.to}</h2>${j.segments.map((seg, i) => `<article class="spaced"><h3>第 ${i + 1} 段 · ${seg.from} → ${seg.to}</h3><p>${esc(flightLabel(seg.flight))} · 計劃起飛 ${J.fullTime(seg.departure, airport(seg.from)?.zone ?? 'Asia/Hong_Kong')}（${seg.from} 當地時間）</p><p>計劃抵達 ${J.fullTime(seg.scheduledArrival, seg.zone)}${seg.estimatedArrival ? ' · 預計抵達 ' + J.fullTime(seg.estimatedArrival, seg.zone) : ' · 尚無即時預計抵達資料'}（${seg.to} 當地時間）</p><p>${J.hasLanded(j, seg) ? '實際抵達 ' + J.fullTime(seg.actualLanding, seg.zone) : Date.parse(seg.departure) > Date.parse(j.now) ? '尚未出發，沒有實際抵達紀錄。' : '已過計劃起飛時間，實際出行狀態待核實。'}</p></article>`).join('')}<p class="meta">取得前序航段實際抵達紀錄並進入轉機時段後，才提供即時轉機餘量；未來的計劃不代表已起飛。</p></section>`;
    const route = transfer.querySelector('[data-guide-id="transfer-route"]');
    const buffer = transfer.querySelector('[data-guide-id="transfer-buffer"]');
    const secondary = Array.from(flight.querySelectorAll('.journey-facts dt')).filter(x => /预计抵达|实际落地/.test(x.textContent ?? ''));
    let detail = '';
    for (const dt of secondary) {
        detail += dt.outerHTML + (dt.nextElementSibling?.outerHTML ?? '');
        dt.nextElementSibling?.remove();
        dt.remove();
    }
    flight.insertAdjacentHTML('beforeend', details('抵達時間', `<dl class="journey-facts">${detail}</dl>`, 'flight-arrival'));
    route.classList.add('business-transfer-route');
    const more = Array.from(route.querySelectorAll(':scope > p,:scope > a')).map(x => { const h = x.outerHTML; x.remove(); return h; }).join('');
    route.insertAdjacentHTML('beforeend', details('行李與轉機資訊', more, 'transfer-information'));
    return heading('', '轉機指引', `${n(s, j.ownerId)} · ${J.localTime(j.now)}（香港時間）`) + tabs + `<div class="business-transfer-grid">${flight.outerHTML}${buffer.outerHTML}</div>` + route.outerHTML;
}
