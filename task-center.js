import { feedbackReserved } from './feedback.js';
import { TASKS, MONTHLY_REWARD_CAP } from './config.js';
import { earned } from './learning.js';
import { tripDecision } from './trip-decision.js';
export const FAMILY_TASKS = ['destination-quiz', 'family-lesson', 'window-memory'];
export function familyTaskStore(s) { return s.familyTaskRewards ??= { version: 1, completions: [], entitlements: {} }; }
export function familyTaskScope(s) { const f = s.activeFamilyId; if (!f || !s.memberships.some(m => m.familyId === f && m.personId === s.actorId && m.active))
    return null; const trips = Object.values(s.trips).filter(t => t.familyId === f && t.members.some(m => m.personId === s.actorId) && !tripDecision(s, t.id).userCancelled); return trips.find(t => t.id === s.selectedTripId) ?? trips.find(t => t.status !== 'completed') ?? trips.at(-1) ?? null; }
export function familyCompletionKey(familyId, definition, tripId) { return ['family-task', familyId, definition, tripId].join(':'); }
export function legacyFamilyCovered(s, id, tripId) { return Object.values(s.tasks).some(t => t.taskId === id && t.familyId === s.trips[tripId]?.familyId && (t.tripId === tripId || !t.tripId && t.period === s.demoClock.slice(0, 7)) && ['processing', 'credited'].includes(t.status)); }
export function completeFamilyTask(s, id, tripId, evidence, testPolicy) { const def = TASKS.find(t => t.id === id), t = s.trips[tripId]; if (!def || !FAMILY_TASKS.includes(id) || !t || !s.memberships.some(m => m.active && m.familyId === t.familyId && m.personId === s.actorId) || !t.members.some(m => m.personId === s.actorId) || tripDecision(s, tripId).userCancelled)
    throw Error('此帳號目前不能完成這項家庭任務。'); if (testPolicy && (!s.demoSpaceId?.startsWith('qa-') || testPolicy.reward !== 20))
    throw Error('測試獎勵設定不可用於一般資料空間。'); const amount = testPolicy?.reward ?? def.reward; const store = familyTaskStore(s), key = familyCompletionKey(t.familyId, id, tripId); if (store.completions.some(x => x.key === key))
    return s; if (legacyFamilyCovered(s, id, tripId))
    throw Error('此活動已有舊版獎勵紀錄，不重複發放。'); if (def.kind === 'quiz' && evidence.answer !== def.answer)
    throw Error('請再核對目的地準備重點。'); if (def.kind === 'read' && !evidence.checked)
    throw Error('請先共同核對隨身準備清單。'); if (def.kind === 'photo' && (t.status !== 'completed' || !evidence.photoSelected))
    throw Error('旅程完成後，選擇本地照片再確認共同回憶。'); const beneficiaries = [...new Set(s.memberships.filter(m => m.familyId === t.familyId && m.active).map(m => m.personId))]; if (beneficiaries.length > 8 || beneficiaries.length * amount > 960)
    throw Error('本次家庭獎勵超出活動人數或總額上限，請聯絡支援。'); const c = { key, familyId: t.familyId, taskDefinitionId: id, businessScopeKey: tripId, completedBy: s.actorId, completedAt: s.demoClock, ruleVersion: 1, beneficiaries, amount, evidence: { ...evidence } }; store.completions.push(c); for (const pid of beneficiaries) {
    const member = Object.values(s.accounts).find(a => a.personId === pid);
    const k = key + ':beneficiary:' + pid;
    store.entitlements[k] = { key: k, completionKey: key, personId: pid, memberId: member?.id, amount, status: member ? 'available' : 'unlinked' };
} return s; }
export function claimFamilyReward(s, key) { const active = s.dual?.accounts[s.activeAccountId ?? '']; if (!active || active.personId !== s.actorId)
    throw Error('請使用本人的會員帳戶領取。'); const store = familyTaskStore(s), e = store.entitlements[key]; if (!e || e.personId !== s.actorId)
    throw Error('只能領取本人的家庭獎勵資格。'); const c = store.completions.find(c => c.key === e.completionKey); if (!c?.beneficiaries.includes(s.actorId) || e.amount !== c.amount)
    throw Error('獎勵資格需要核實。'); const member = Object.values(s.accounts).find(a => a.personId === e.personId); if (!member) {
    e.status = 'unlinked';
    e.reason = '請先關聯本人會員帳戶，獎勵資格已保留。';
    return s;
} if (e.memberId && e.memberId !== member.id)
    throw Error('受益會員關聯已改變，請先核實原領取紀錄。'); e.memberId = member.id; const old = s.ledger.find(l => l.key === key); if (old) {
    e.status = 'credited';
    e.receipt = old.id;
    return s;
} if (e.status === 'credited')
    return s; const reserved = feedbackReserved(s, member.id) + Object.values(s.learning?.events ?? {}).filter(x => x.memberId === member.id && ['processing', 'unknown'].includes(x.status)).reduce((n, x) => n + x.amount, 0) + Object.values(s.tasks).filter(x => x.memberId === member.id && x.status === 'processing').reduce((n, x) => n + (TASKS.find(t => t.id === x.taskId)?.reward ?? 0), 0) + Object.values(store.entitlements).filter(x => x.key !== key && x.memberId === member.id && x.status === 'unknown').reduce((n, x) => n + x.amount, 0); if (earned(s, member.id) + reserved + e.amount > MONTHLY_REWARD_CAP) {
    e.status = 'capped';
    e.reason = '本月獎勵已達上限，資格保留，未入帳。';
    return s;
} if (e.status === 'unknown')
    throw Error('請先查詢原領取結果，不要重複提交。'); if (s.mockMode === 'timeout') {
    e.status = 'unknown';
    e.receipt = 'FAMILY-' + crypto.randomUUID();
    e.reason = '原領取結果待核實；請查詢同一請求。';
    return s;
} if (s.mockMode === 'failure') {
    e.status = 'failed';
    e.reason = '本次未入帳，可按原資格重試。';
    return s;
} const receipt = 'FAMILY-' + crypto.randomUUID(); s.ledger.push({ id: receipt, key, memberId: member.id, amount: e.amount, kind: 'task', taskId: c.taskDefinitionId, qualifying: false, at: s.demoClock }); e.status = 'credited'; e.receipt = receipt; delete e.reason; return s; }
export function queryFamilyReward(s, key) { const e = s.familyTaskRewards?.entitlements[key]; if (!e || e.personId !== s.actorId || e.status !== 'unknown' || !e.receipt)
    throw Error('沒有可查詢的本人領取請求。'); const receipt = e.receipt, mode = s.mockMode; e.status = 'available'; s.mockMode = 'success'; try {
    claimFamilyReward(s, key);
    const row = s.ledger.find(l => l.key === key);
    if (row) {
        row.id = receipt;
        e.receipt = receipt;
    }
}
finally {
    s.mockMode = mode;
} return s; }
export function familyTaskRows(s) { const t = familyTaskScope(s); return FAMILY_TASKS.map(id => { const def = TASKS.find(t => t.id === id), key = t ? familyCompletionKey(t.familyId, id, t.id) : '', completion = s.familyTaskRewards?.completions.find(c => c.key === key), entitlement = key ? s.familyTaskRewards?.entitlements[key + ':beneficiary:' + s.actorId] : undefined, legacy = !!t && legacyFamilyCovered(s, id, t.id); return { def, trip: t, key, completion, entitlement, legacy, locked: !t || def.kind === 'photo' && t.status !== 'completed' }; }); }
