import { FAMILY_TASKS } from './task-center.js';
import { familyTaskPanel } from './task-center-ui.js';
import { passportSummary } from './passport.js';
import * as D from './domain.js';
import * as M from './demo.js';
import { fundsFor, fundTotals } from './fund.js';
import { learningRows, earned, claimLearning } from './learning.js';
import { TASKS, MONTHLY_REWARD_CAP } from './config.js';
import { esc, icon } from './ui.js';
import { displayName } from './identity.js';
import { message } from './messages.js';
export function homeFund(s) { const visible = fundsFor(s).filter(f => f.ownerId === s.actorId || f.id !== M.FUND || M.canSupport(s, s.actorId, f.id)), open = visible.filter(f => f.status === 'open'); return open.find(f => f.id === M.FUND) ?? open[0] ?? visible.find(f => f.id === M.FUND) ?? visible[0] ?? null; }
export function memberRewardRows(s) {
    const a = M.demoAccount(s);
    if (!a)
        return [];
    const capped = earned(s, a.memberId) >= MONTHLY_REWARD_CAP, rows = [];
    for (const row of learningRows(s)) {
        const task = Object.values(s.dual?.tasks ?? {}).find(t => t.personId === s.actorId && t.kind === row.kind && s.journeys?.items[t.tripId]?.version === t.version && M.canReadTrip(s, t.tripId));
        const e = row.event;
        let blocked = false;
        if (e && ['available', 'capped', 'failed'].includes(e.status)) {
            try {
                const draft = structuredClone(s);
                claimLearning(draft, e.key);
                blocked = draft.learning.events[e.key].status !== 'processing';
            }
            catch {
                blocked = true;
            }
        }
        const status = blocked ? '暫不可領取 · 請核對資格或本月額度' : row.covered ? '舊版已覆蓋' : e ? message(e.status) : row.kind !== 'calendar' && !task ? '建立行程後可核對' : capped ? '本月獎勵已達上限' : '待完成';
        const action = row.covered || e?.status === 'credited' ? '' : e ? `<button class="text-link" data-demo-action="${e.status === 'unknown' ? 'learn-query' : 'learn-claim'}" data-key="${esc(e.key)}" ${(blocked || ['processing', 'ineligible'].includes(e.status)) ? 'disabled' : ''}>${e.status === 'processing' ? '處理中' : e.status === 'unknown' ? '查詢結果' : e.status === 'failed' ? '重試領取' : '領取'}</button>` : row.kind === 'calendar' || task ? `<button class="text-link" data-home-learn="${row.kind}" ${task ? `data-task-id="${task.taskId}"` : ''}>去完成 →</button>` : '';
        rows.push({ id: 'learn-' + row.kind, title: row.title, condition: row.condition, amount: row.amount, status, action, priority: e?.status === 'credited' || row.covered ? 7 : blocked ? 6 : e?.status === 'available' || e?.status === 'capped' ? 0 : e && ['unknown', 'processing', 'failed'].includes(e.status) ? 1 : row.kind === 'calendar' || task ? 2 : 5 });
    }
    for (const task of TASKS.filter(t => ['quiz', 'read', 'photo', 'hunt'].includes(t.kind) && !FAMILY_TASKS.includes(t.id))) {
        const key = D.taskKey(s, s.actorId, task.id), progress = s.tasks[key], trip = s.activeFamilyId ? D.currentTrip(s, s.activeFamilyId) : null, locked = task.kind === 'hunt' && !(trip?.checklist.onboard || trip?.status === 'completed'), status = progress ? message(progress.status) : locked ? '航班上解鎖' : capped ? '本月獎勵已達上限' : '待完成';
        let unavailable = false;
        if (progress && ['available', 'failed', 'capped'].includes(progress.status)) {
            try {
                D.reduce(s, { type: 'claim', key });
            }
            catch {
                unavailable = true;
            }
        }
        const action = progress ? ['credited', 'processing'].includes(progress.status) || unavailable ? '' : `<button class="text-link" data-action="claim" data-key="${esc(key)}">${progress.status === 'failed' ? '重試領取' : '領取'}</button>` : locked ? '' : `<button class="text-link" data-action="task" data-task="${task.id}" data-person="${s.actorId}">去完成 →</button>`;
        rows.push({ id: task.id, title: task.title, condition: task.condition, amount: task.reward, status: unavailable ? '暫不可領取 · 請核對資格或本月額度' : status, action, priority: unavailable ? 6 : progress?.status === 'available' ? 0 : progress?.status === 'processing' ? 1 : locked ? 6 : progress?.status === 'credited' ? 7 : 3 });
    }
    return rows.sort((a, b) => a.priority - b.priority);
}
function rewardRows(s, limit) { return memberRewardRows(s).filter(r => limit === undefined || r.priority !== 7).slice(0, limit).map(r => `<article class="home-reward-row" data-reward-id="${r.id}"><div><h3>${esc(r.title)}</h3><p>${esc(r.condition)}</p><small>${esc(r.status)} · +${r.amount} 里數</small></div>${r.action}</article>`).join('') || '<p>目前沒有適用於此帳號的獎勵任務。</p>'; }
export function rewardBoard(s) { return `<div class="task-center"><h1>旅程任務</h1><p>共同完成家庭準備，各自累積會員獎勵。</p><div class="task-boards">${familyTaskPanel(s)}<section class="task-board" aria-labelledby="personal-tasks-title"><h2 id="personal-tasks-title">我的任務板</h2><p>${esc(displayName(s.persons[s.actorId]))} 的個人準備與領取記錄。</p><p class="meta">確認領取後，獎勵只入本人帳戶。</p>${rewardRows(s)}<button class="text-link" data-screen="home:ledger">查看本人里數記錄 →</button></section></div></div>`; }
export function homeBenefits(s) { const f = homeFund(s), student = M.studentAccount(s), balance = f ? fundTotals(s, f).available : 0; return `<section class="home-benefits" aria-label="會員功能摘要"><article class="home-benefit" data-home-fund-summary><div class="section-title"><h2>${icon('care')} 回家基金</h2></div>${f ? `<h3>${student ? '我的回家目標' : '支持' + esc(displayName(s.persons[f.ownerId])) + '回家'}</h3><p class="field-hint">${esc(f.destination || '目的地待定')}${f.from && f.until ? ' · 目標期間 ' + esc(f.from) + ' — ' + esc(f.until) : ' · 日期待定'}<br>這是支持目標，尚未關聯訂位。</p><div class="fund-progress-label"><strong data-home-fund-balance>${balance.toLocaleString('en-US')}</strong><span>／${f.target.toLocaleString('en-US')} 受限里數</span></div><progress value="${Math.min(balance, f.target)}" max="${f.target}" aria-label="目前回家目標的已到帳受限支持"></progress><p class="field-hint">${f.status === 'open' ? '此目標已到帳且未使用的支持；普通里數另列。' : f.status === 'redeemed' ? '此目標已兌換；歷史支持保留，不再收集。' : f.status === 'refunding' ? '此目標正在退款，不再收集支持。' : '此目標已關閉。'}</p><button class="text-link" data-home-fund="${f.id}">${student ? '查看回家基金' : f.status === 'open' ? '提供支持' : '查看支持記錄'} →</button>${student ? '<button class="text-link" data-student-intent="home">規劃回家行程 →</button>' : ''}` : `<p>${student ? '下一次回家的目標，可以先於機票建立。' : '暫無獲授權的回家目標。待家人建立目標並授權後，即可提供支持。'}</p>${student ? '<button class="text-link" data-action="fund-create">建立回家目標 →</button>' : ''}`}</article><article class="home-benefit" data-home-rewards><div class="section-title"><h2>${icon('check')} 獎勵任務</h2><button class="text-link" data-screen="home:tasks">查看全部 →</button></div>${rewardRows(s, 1)}<p class="field-hint">獎勵計入本人普通里數，與回家基金分開。</p></article>${passportSummary(s)}</section>`; }
