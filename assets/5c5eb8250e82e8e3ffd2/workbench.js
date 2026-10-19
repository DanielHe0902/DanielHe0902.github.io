import { tripDecision, cancellationRecord, unresolvedChange } from '/assets/5c5eb8250e82e8e3ffd2/trip-decision.js';
import { flightLabel } from '/assets/5c5eb8250e82e8e3ffd2/passport-visual.js';
import * as M from '/assets/5c5eb8250e82e8e3ffd2/demo.js';
import * as J from '/assets/5c5eb8250e82e8e3ffd2/transit.js';
import { journeyModel } from '/assets/5c5eb8250e82e8e3ffd2/journey-context.js';
import { canPlan } from '/assets/5c5eb8250e82e8e3ffd2/capabilities.js';
import { esc, icon } from '/assets/5c5eb8250e82e8e3ffd2/ui.js';
export const TRIP_VIEWS = ['trips', 'student', 'preparation', 'recovery', 'journey'];
export function primaryView(view, b) { return view === 'assistant' ? 'assistant' : ['me', 'preferences', 'favorites', 'subscriptions', 'care', 'fund'].includes(view) || view === 'home' && b?.home !== 'default' && !!b ? 'me' : 'home'; }
export function primaryNavigation(view, b) { const active = primaryView(view, b); return [['assistant', '有期助手', 'spark'], ['home', '首頁', 'home'], ['me', '我的', 'passport']].map(([key, label, symbol]) => '<button data-view="' + key + '" class="nav-item ' + (active === key ? 'active' : '') + '" ' + (active === key ? 'aria-current="page"' : '') + '>' + icon(symbol) + '<span>' + label + '</span></button>').join(''); }
const button = (label, view) => `<button class="text-link" data-view="${view}">${label}</button>`;
export function memberEntries(s) {
    const student = M.studentAccount(s), fund = M.fundSummary(s);
    const card = (symbol, title, copy, action, meta = '') => `<article><span class="member-entry-icon">${icon(symbol)}</span><div><h3>${title}</h3><p>${copy}</p><div class="member-entry-footer">${action}${meta}</div></div></article>`;
    return `<section class="member-entry-section"><h2>會員功能</h2><div class="member-entry-grid">${card('check', '家庭任務', '查看本人可參與的任務、資格與領取進度。', '<button class="text-link" data-screen="home:tasks">查看任務 →</button>')}${card('passport', '成長護照', student ? '查看自己的飛行足跡與已授權紀錄。' : '查看已授權孩子的飛行成長紀錄。', '<button class="text-link" data-screen="home:passport">查看護照 →</button>')}${card('care', '家庭照護', '照顧重要的人，查看家庭成員與已授權照護需求。', button('查看家庭照護 →', 'care'))}${card('homeward', student ? '回家基金' : '支持回家', student ? '與家人分享回家目標，查看親友送來的支持。' : '讓牽掛化成一段回家路，支持林晴的返鄉目標。', button(student ? '查看回家基金 →' : '支持林晴回家 →', 'fund'), fund ? `<span class="member-entry-meta">受限支持 <strong data-fund-balance>${fund.balance.toLocaleString('en-US')}</strong> 里數</span>` : '')}</div></section>`;
}
export function journeyOverview(s) { const j = J.currentJourney(s); if (!j)
    return '<section class="panel">選擇可查看的行程，或先進行規劃。</section>'; const vm = journeyModel(s, j); return `<section class="panel" data-guide-id="journey-context"><h2>行程總覽</h2><p>${esc(vm.summary)}</p><p>${vm.travelers.length} 位旅客</p><div class="leg-progress">${vm.segments.map(({ seg, phase }, i) => `<article><h3>第 ${i + 1} 段 · ${seg.from} → ${seg.to}</h3><p>${esc(flightLabel(seg.flight))}</p><p>${J.fullTime(seg.departure, seg.from === 'NRT' ? 'Asia/Tokyo' : seg.from === 'LHR' ? 'Europe/London' : 'Asia/Hong_Kong')} 出發地當地時間</p><p>${({ planned: '尚未出發', awaiting: '實際狀態待核實', arrived: '已抵達 · 飛行記錄待確認', completed: '已完成', cancelled: '已取消' })[phase]}</p></article>`).join('')}</div><p>查看不同階段不會推進事件；去程結束不等於往返結束。</p>${s.trips[j.id]?.previous ? button('查看歷史變更', 'recovery') : ''}</section>`; }
export function workbench(s, view, b, body, filter = 'all') {
    if (!TRIP_VIEWS.includes(view))
        return body;
    const j = J.currentJourney(s), t = j ? s.trips[j.id] : undefined, affected = !!j && !tripDecision(s, j.id).userCancelled && (unresolvedChange(s, j.id) || !tripDecision(s, j.id).partiallyCancelled && t?.status === 'cancelled');
    const top = `<div class="workbench-heading"><${view === 'trips' ? 'h1' : 'h2'}>我的旅程</${view === 'trips' ? 'h1' : 'h2'}><div class="button-row">${button('行程列表', 'trips')}${canPlan(s) ? button('學期航程規劃', 'student') : '<button class="text-link" data-action="basic-search">一般航班試算</button><button class="text-link" data-action="route">規劃家庭行程</button>'}</div></div>`;
    if (view === 'trips') {
        const rows = Object.values(s.journeys?.items ?? {}).filter(x => M.canReadTrip(s, x.id));
        const group = (x) => { const vm = journeyModel(s, x); return vm.phase === 'completed' ? 'past' : vm.phase === 'planned' ? 'next' : 'current'; };
        return top + `<nav class="business-tabs" aria-label="行程篩選">${[['all', '全部'], ['current', '目前'], ['next', '接下來'], ['past', '已結束']].map(([id, label]) => `<button data-trip-filter="${id}" aria-current="${id === filter ? 'page' : 'false'}">${label}</button>`).join('')}</nav><div class="journey-list">${rows.filter(x => filter === 'all' || group(x) === filter).map(x => { const vm = journeyModel(s, x); return `<article class="panel"><div><h2>${x.familyId ? '家庭旅行' : '本人旅程'} · ${x.segments.map(seg => seg.from).join(' → ')} → ${J.lastLeg(x).to}</h2><p>${J.fullTime(x.segments[0].departure)} 香港時間 · ${vm.travelers.length} 位旅客</p><p>${esc(vm.summary)}</p></div><button class="button secondary" data-work-trip="${x.id}">查看旅程</button></article>`; }).join('') || '<section class="panel">此分類目前沒有可查看的行程。規劃入口仍可使用。</section>'}</div>`;
    }
    if (view === 'student')
        return top + body;
    const tab = view === 'journey' ? (b.journey === 'overview' ? 'overview' : b.journey === 'posttrip' ? 'posttrip' : 'during') : view;
    const tabs = `<nav class="business-tabs trip-work-tabs" aria-label="旅程子視圖"><button data-screen="journey:overview" aria-current="${tab === 'overview' ? 'page' : 'false'}">總覽</button><button data-view="preparation" aria-current="${tab === 'preparation' ? 'page' : 'false'}">行前準備</button><button data-screen="journey:transfer" aria-current="${tab === 'during' ? 'page' : 'false'}">旅途中</button><button data-screen="journey:posttrip" aria-current="${tab === 'posttrip' ? 'page' : 'false'}">旅後記錄</button>${affected || t?.previous ? `<button data-view="recovery" aria-current="${tab === 'recovery' ? 'page' : 'false'}">${affected ? '處理行程變更' : '歷史變更'}</button>` : ''}</nav>`;
    const strip = j && !body.includes('data-trip-id=') ? `<section class="trip-strip" data-trip-id="${j.id}" data-trip-version="${j.version}"><strong>${j.segments.map(x => x.from).join(' → ')} → ${J.lastLeg(j).to}</strong><span>${J.fullTime(j.segments[0].departure)} 香港時間</span><span>${t ? t.members.length : 1} 位旅客 · ${t ? t.members.filter(m => m.occupiesSeat).length : 1} 個座位</span><span>${esc(flightLabel(j.segments[0].flight))}</span></section>` : '';
    if (j && tripDecision(s, j.id).userCancelled)
        return top + strip + cancellationRecord(s, j.id);
    return top + strip + (affected ? `<div class="notice warning compact-impact"><strong>此行程受到影響</strong>${button('處理行程變更', 'recovery')}</div>` : '') + tabs + (view === 'journey' && b.journey === 'overview' ? journeyOverview(s) : body);
}
