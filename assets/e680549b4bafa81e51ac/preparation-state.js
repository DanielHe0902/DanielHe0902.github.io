import { tripDecision } from '/assets/e680549b4bafa81e51ac/trip-decision.js';
import { currentTasks } from '/assets/e680549b4bafa81e51ac/demo.js';
import { visibleRequests } from '/assets/e680549b4bafa81e51ac/domain.js';
import { serviceState } from '/assets/e680549b4bafa81e51ac/service-state.js';
/** Same personal preparation tasks on home and detail. Service approval is never a checkbox. */
export function preparationTasks(s, id) { if (tripDecision(s, id).userCancelled)
    return []; const t = s.trips[id], rs = t ? visibleRequests(s, t) : []; return currentTasks({ ...s, selectedTripId: id }).filter(x => !['wheelchair', 'meal', 'seating'].includes(x.kind)).map(x => x.taskId.endsWith(':care') ? { ...x, title: '確認本次家庭照護需求', status: rs.length && rs.every(r => !!r.consentAt) ? 'done' : 'pending', next: rs.some(r => serviceState(s, r).owner === 'user') ? '整理並提交本次照護申請' : '查看本次服務進度' } : x); }
