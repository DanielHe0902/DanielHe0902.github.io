import * as D from '/assets/8ff1587e8661fef5dadb/domain.js';
import { MONTHLY_REWARD_CAP, TASKS } from '/assets/8ff1587e8661fef5dadb/config.js';
import { rewardMonth, earned } from '/assets/8ff1587e8661fef5dadb/learning.js';
import { publishNotice } from '/assets/8ff1587e8661fef5dadb/reminders.js';
export const FEEDBACK_RULES = { campaign: 'trip-feedback-2027', amount: 20, monthlyCap: 100 };
export function feedbackKey(s, tripId) { return 'feedback:' + D.account(s, s.actorId)?.id + ':' + tripId + ':' + FEEDBACK_RULES.campaign; }
export function feedbackEligible(s, tripId) { const j = s.journeys?.items[tripId], t = s.trips[tripId]; return !!D.account(s, s.actorId) && !!j && j.segments.length > 0 && j.segments.every(x => x.completed && x.actualLanding && Date.parse(x.actualLanding) <= Date.parse(s.demoClock)) && (j.familyId ? !!D.membership(s, j.familyId) && !!t?.members.some(x => x.personId === s.actorId) : j.ownerId === s.actorId); }
export function feedbackReserved(s, memberId) { return Object.values(s.feedbackRewards ?? {}).filter(x => x.memberId === memberId && ['processing', 'unknown'].includes(x.status)).reduce((n, x) => n + x.amount, 0); }
export function submitFeedback(s, tripId, body) { if (!feedbackEligible(s, tripId))
    throw Error('須由實際同行會員，在整趟行程全部航段確認完成後提交。'); if (!['清楚', '不清楚'].includes(body.preparation) || !['滿意', '不滿意', '不適用／未使用'].includes(body.care) || !['沒有', '仍需跟進'].includes(body.followup) || body.text.length > 300)
    throw Error('請完成體驗選項；補充文字最多 300 字。'); s.feedbackRewards ??= {}; const key = feedbackKey(s, tripId), old = s.feedbackRewards[key]; if (old) {
    Object.assign(old, body);
    return s;
} const a = D.account(s, s.actorId); s.feedbackRewards[key] = { key, personId: s.actorId, memberId: a.id, accountId: s.activeAccountId, tripId, ...body, submittedAt: s.demoClock, status: 'submitted', amount: FEEDBACK_RULES.amount, attempt: 0 }; return s; }
function mine(s, key) { const e = s.feedbackRewards?.[key]; if (!e || e.personId !== s.actorId || e.accountId !== s.activeAccountId)
    throw Error('請由原提交會員本人操作。'); return e; }
export function claimFeedback(s, key, now = Date.now()) {
    const e = mine(s, key);
    if (['credited', 'processing'].includes(e.status))
        return s;
    if (e.status === 'unknown')
        throw Error('結果尚未確認；先查詢原請求，不能重送。');
    if (!feedbackEligible(s, e.tripId)) {
        e.status = 'ineligible';
        e.reason = '未找到適用的完整出行紀錄';
        return s;
    }
    const pending = feedbackReserved(s, e.memberId) + Object.values(s.learning?.events ?? {}).filter(x => x.memberId === e.memberId && ['processing', 'unknown'].includes(x.status)).reduce((n, x) => n + x.amount, 0) + Object.values(s.tasks).filter(x => x.memberId === e.memberId && x.status === 'processing').reduce((n, x) => n + (TASKS.find(t => t.id === x.taskId)?.reward ?? 0), 0);
    const own = s.ledger.filter(x => x.memberId === e.memberId && x.taskId === 'trip-feedback' && rewardMonth(x.at) === rewardMonth(s.demoClock)).reduce((n, x) => n + x.amount, 0);
    if (own + feedbackReserved(s, e.memberId) + e.amount > FEEDBACK_RULES.monthlyCap || earned(s, e.memberId) + pending + e.amount > MONTHLY_REWARD_CAP) {
        e.status = 'capped';
        e.reason = '已達本月活動或總獎勵上限';
        return s;
    }
    e.status = 'processing';
    e.attempt++;
    e.mode = s.mockMode;
    e.dueAt = now + (e.mode === 'delay' ? 8000 : 900);
    delete e.reason;
    return s;
}
export function settleFeedback(s, key, query = false, now = Date.now()) {
    const e = s.feedbackRewards?.[key];
    if (!e || !['processing', 'unknown'].includes(e.status) || !query && (e.dueAt ?? Infinity) > now)
        return s;
    if (query)
        mine(s, key);
    if (e.mode === 'timeout' && !query) {
        e.status = 'unknown';
        e.reason = '回執逾時；保留額度，請查詢原請求';
        return s;
    }
    if (e.mode === 'failure') {
        e.status = 'failed';
        e.reason = '服務暫不可用，尚未入帳，可重試原請求';
        return s;
    }
    if (s.ledger.some(l => l.key === key)) {
        e.status = 'credited';
        return s;
    }
    const personState = { ...s, actorId: e.personId };
    if (!feedbackEligible(personState, e.tripId)) {
        e.status = 'ineligible';
        e.reason = '出行紀錄或本人資格已變更';
        return s;
    }
    const own = s.ledger.filter(x => x.memberId === e.memberId && x.taskId === 'trip-feedback' && rewardMonth(x.at) === rewardMonth(s.demoClock)).reduce((n, x) => n + x.amount, 0);
    if (own + e.amount > FEEDBACK_RULES.monthlyCap || earned(s, e.memberId) + e.amount > MONTHLY_REWARD_CAP) {
        e.status = 'capped';
        e.reason = '已達本月獎勵上限';
        return s;
    }
    e.receipt = 'FEEDBACK-' + crypto.randomUUID();
    s.ledger.push({ id: e.receipt, key: e.key, memberId: e.memberId, amount: e.amount, kind: 'task', taskId: 'trip-feedback', at: s.demoClock, qualifying: false });
    e.status = 'credited';
    delete e.reason;
    publishNotice(s, 'award:' + key, e.personId, '旅程體驗獎勵已入帳', e.amount + ' Asia Miles 已加入你的個人帳本；未轉入回家基金。', { type: 'reward', tripId: e.tripId });
    return s;
}
