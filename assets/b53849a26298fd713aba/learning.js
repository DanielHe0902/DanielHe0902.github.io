import { readSavedCalendar, calendarTermKey } from '/assets/b53849a26298fd713aba/student-calendar.js';
import { validateCalendarPlan } from '/assets/b53849a26298fd713aba/calendar-import.js';
import { feedbackReserved } from '/assets/b53849a26298fd713aba/feedback.js';
import { requireStudent, studentCapability } from '/assets/b53849a26298fd713aba/capabilities.js';
import { MONTHLY_REWARD_CAP } from '/assets/b53849a26298fd713aba/config.js';
import { message } from '/assets/b53849a26298fd713aba/messages.js';
export const LEARN = { calendar: { title: '導入並確認校曆', amount: 20, condition: '導入或手動填寫日期，核對後保存有效計劃' }, documents: { title: '核對簽證及證件要求', amount: 20, condition: '閱讀本次文件要求，保存已核對或仍需核實的記錄' }, packing: { title: '確認行李清單', amount: 10, condition: '核對本次隨身與託運需求，保存確認' } };
export const rewardMonth = (at) => (() => { const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Hong_Kong', year: 'numeric', month: '2-digit' }).formatToParts(new Date(at)); return parts.find(p => p.type === 'year').value + '-' + parts.find(p => p.type === 'month').value; })();
export function initLearning(s) { const first = !s.learning; s.learning ??= { version: 1, scopes: {}, events: {} }; for (const a of Object.values(s.dual?.accounts ?? {})) {
    if (a.role !== 'student')
        continue;
    s.learning.scopes[a.memberId] ??= 'semester:' + a.memberId + ':2027-spring';
    if (first && a.accountId === 'demo-student' && a.personId === 'student' && s.accounts[a.memberId])
        s.accounts[a.memberId].studentVerified = true;
} return s; }
function legacyTermMatches(scope, start) { const m = scope.match(/:(\d{4})-(spring|autumn)$/); return !!m && start.slice(0, 4) === m[1] && (m[2] === 'spring' ? Number(start.slice(5, 7)) <= 6 : Number(start.slice(5, 7)) >= 7); }
export function learnKey(s, kind) { const a = s.dual?.accounts[s.activeAccountId ?? '']; const calendar = readSavedCalendar(s), scope = kind === 'calendar' && calendar ? calendarTermKey(calendar.plan) : 'trip:' + s.selectedTripId; const old = Object.values(s.learning?.events ?? {}).find(e => e.memberId === a?.memberId && e.kind === kind && (e.scope === scope || kind === 'calendar' && e.scope === s.learning?.scopes[a?.memberId ?? ''] && legacyTermMatches(e.scope, calendar?.plan.start ?? ''))); return old?.key ?? 'learn:' + a?.memberId + ':' + scope + ':' + kind; }
export function earned(s, memberId) { return s.ledger.filter(l => l.memberId === memberId && l.taskId && rewardMonth(l.at) === rewardMonth(s.demoClock)).reduce((n, l) => n + l.amount, 0); }
export function legacyCovered(s, memberId) { return Object.values(s.tasks).some(t => t.memberId === memberId && t.taskId === 'calendar-learn' && ['processing', 'credited'].includes(t.status)); }
export function requireLearning(s, kind) { if (kind === 'calendar')
    requireStudent(s);
else if (!s.dual?.accounts[s.activeAccountId ?? ''] || s.dual.accounts[s.activeAccountId].personId !== s.actorId)
    throw Error('請使用本人的會員帳戶。'); }
export function completeLearning(s, kind, evidence) { requireLearning(s, kind); initLearning(s); const a = s.dual.accounts[s.activeAccountId]; if (!LEARN[kind])
    throw Error('未知準備任務'); if (!evidence.trim())
    throw Error('請先保存準備核對記錄'); if (kind === 'calendar' && !validCalendar(s.plans[s.actorId]))
    throw Error('請先核對並保存有效校曆'); if (kind !== 'calendar' && !Object.values(s.dual.tasks).some(t => t.personId === s.actorId && t.kind === kind && t.status === 'done' && t.tripId === s.selectedTripId))
    throw Error('請先保存本次準備清單的核對結果'); const key = learnKey(s, kind); s.learning.events[key] ??= { key, memberId: a.memberId, personId: a.personId, accountId: a.accountId, scope: kind === 'calendar' ? calendarTermKey(s.plans[s.actorId]) : 'trip:' + s.selectedTripId, kind, completedAt: s.demoClock, evidence, status: 'available', amount: LEARN[kind].amount, attempt: 0 }; return s; }
function validCalendar(p) { if (!p?.saved || !p.calendarConfirmed)
    return false; try {
    return validateCalendarPlan(p);
}
catch {
    return false;
} }
export function confirmCalendar(s, p) { requireStudent(s, p.personId); if (!validCalendar(p))
    throw Error('請先核對日期並保存有效學期計劃'); return completeLearning(s, 'calendar', '有效校曆已核對並保存；手動與導入採用同一標準'); }
export function claimLearning(s, key, now = Date.now()) { const e = s.learning?.events[key]; if (e)
    requireLearning(s, e.kind); if (!e || e.personId !== s.actorId || e.accountId !== s.activeAccountId)
    throw Error(message('STUDENT_ACCESS_REQUIRED')); if (['credited', 'processing'].includes(e.status))
    return s; if (e.status === 'unknown')
    throw Error(message('REQUEST_STATUS_UNKNOWN')); if (legacyCovered(s, e.memberId))
    throw Error('舊版合併準備獎勵已領取或正在核實，同一學期不再重發'); const reserved = feedbackReserved(s, e.memberId) + Object.values(s.learning.events).filter(x => x.memberId === e.memberId && ['processing', 'unknown'].includes(x.status)).reduce((n, x) => n + x.amount, 0) + Object.values(s.tasks).filter(t => t.memberId === e.memberId && t.status === 'processing').reduce((n, t) => n + legacyReward(t.taskId), 0); if (earned(s, e.memberId) + reserved + e.amount > MONTHLY_REWARD_CAP) {
    e.status = 'capped';
    e.reason = message('MONTHLY_LIMIT_REACHED');
    return s;
} e.status = 'processing'; e.attempt++; e.mode = s.mockMode; e.dueAt = now + (e.mode === 'delay' ? 8000 : 900); delete e.reason; return s; }
import { TASKS } from '/assets/b53849a26298fd713aba/config.js';
const legacyReward = (id) => TASKS.find(t => t.id === id)?.reward ?? 0;
export function settleLearning(s, key, query = false, now = Date.now()) { const e = s.learning?.events[key]; if (!e || !['processing', 'unknown'].includes(e.status) || !query && (e.dueAt ?? Infinity) > now)
    return s; if (query && (e.personId !== s.actorId || e.accountId !== s.activeAccountId))
    throw Error(message('STUDENT_ACCESS_REQUIRED')); if (e.mode === 'timeout' && !query) {
    e.status = 'unknown';
    e.reason = message('REQUEST_STATUS_UNKNOWN');
    return s;
} if (e.mode === 'failure') {
    e.status = 'failed';
    e.reason = '獎勵服務暫不可用，尚未入帳。可重試原請求。';
    return s;
} if (s.ledger.some(l => l.key === e.key)) {
    e.status = 'credited';
    return s;
} if (e.kind === 'calendar' && !s.accounts[e.memberId]?.studentVerified) {
    e.status = 'ineligible';
    e.reason = message('STUDENT_ACCESS_REQUIRED');
    return s;
} if (earned(s, e.memberId) + e.amount > MONTHLY_REWARD_CAP) {
    e.status = 'capped';
    e.reason = message('MONTHLY_LIMIT_REACHED');
    return s;
} e.receipt = 'LEARN-' + crypto.randomUUID(); s.ledger.push({ id: e.receipt, memberId: e.memberId, amount: e.amount, kind: 'task', key: e.key, at: s.demoClock, qualifying: false, taskId: 'learn-' + e.kind }); e.status = 'credited'; delete e.reason; return s; }
export function learningRows(s) { const a = s.dual?.accounts[s.activeAccountId]; if (!a)
    return []; return Object.keys(LEARN).filter(k => k !== 'calendar' || studentCapability(s)).map(kind => ({ kind, ...LEARN[kind], event: s.learning?.events[learnKey(s, kind)], covered: legacyCovered(s, a.memberId) })); }
