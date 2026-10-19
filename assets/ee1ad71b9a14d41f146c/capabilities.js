import { message } from '/assets/ee1ad71b9a14d41f146c/messages.js';
export function studentCapability(s, personId = s.actorId) {
    const member = Object.values(s.accounts).find(a => a.personId === personId);
    const a = s.dual?.accounts[s.activeAccountId ?? ''];
    return personId === s.actorId && !!member?.studentVerified && (!s.dual || a?.role === 'student' && a.personId === s.actorId && a.memberId === member.id);
}
export function requireStudent(s, personId = s.actorId) { if (!studentCapability(s, personId))
    throw Error(message('STUDENT_ACCESS_REQUIRED')); }
export function canPlan(s) { return studentCapability(s) || !s.dual && !Object.values(s.accounts).some(a => a.personId === s.actorId); }
export const canSearch = (_s) => true;
