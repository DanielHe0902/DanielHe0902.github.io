import { tripDecision } from '/assets/ee1ad71b9a14d41f146c/trip-decision.js';
import { currentTasks } from '/assets/ee1ad71b9a14d41f146c/demo.js';
import { visibleRequests } from '/assets/ee1ad71b9a14d41f146c/domain.js';
import { serviceState } from '/assets/ee1ad71b9a14d41f146c/service-state.js';
/** Same personal preparation tasks on home and detail. Service approval is never a checkbox. */
export function preparationTasks(s, id) { if (tripDecision(s, id).userCancelled)
    return []; const t = s.trips[id], rs = t ? visibleRequests(s, t) : []; return currentTasks({ ...s, selectedTripId: id }).filter(x => !['wheelchair', 'meal', 'seating'].includes(x.kind)).map(x => x.taskId.endsWith(':care') ? { ...x, title: '確認本次家庭照護需求', status: rs.length && rs.every(r => !!r.consentAt) ? 'done' : 'pending', next: rs.some(r => serviceState(s, r).owner === 'user') ? '整理並提交本次照護申請' : '查看本次服務進度' } : x); }
