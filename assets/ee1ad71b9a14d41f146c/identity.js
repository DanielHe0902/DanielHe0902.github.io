export const displayName = (p, locale = 'zh-CN') => p?.displayNames?.[locale] || p?.displayName || p?.name || '未录入姓名';
export const personLabel = (s, id) => displayName(s.persons[id]);
export const memberId = (s, id) => Object.values(s.accounts).find(a => a.personId === id)?.id ?? null;
export const initials = (p) => Array.from(displayName(p)).slice(0, /^[A-Za-z]/.test(displayName(p)) ? 2 : 1).join('');
export function relationshipLabel(s, familyId, personId) { const m = s.memberships.find(m => m.familyId === familyId && m.personId === personId && m.active); if (!m)
    return '未记录关系'; if (personId === s.actorId)
    return '本人'; return m.referencePersonId ? `${m.label}（相对 ${personLabel(s, m.referencePersonId)}）` : '家庭角色：' + m.label; }
export const travelers = (s, t) => t.members.map(m => ({ ...m, tripMemberId: m.tripMemberId ?? `${t.id}:${m.personId}`, displayName: personLabel(s, m.personId), memberId: memberId(s, m.personId) }));
export function migrateIdentity(s) {
    if (!s.identityVersion) {
        for (const p of Object.values(s.persons)) {
            p.displayName ??= p.id === 'lin' && p.name === '林浩' && p.nickname === 'Taylor' ? 'Taylor' : p.name;
            if (p.id === 'lin' && p.displayName === 'Taylor')
                p.displayNames = { ...p.displayNames, en: 'Taylor' };
        }
        for (const m of s.memberships) {
            if (['a', 'b', 'c'].includes(m.familyId) && m.personId !== 'grandma')
                m.referencePersonId = 'lin';
            if (m.familyId === 'd')
                m.referencePersonId = 'student';
        }
        s.identityVersion = 1;
    }
    for (const t of Object.values(s.trips))
        for (const m of t.members)
            m.tripMemberId ??= t.id + ':' + m.personId;
    for (const r of Object.values(s.requests))
        r.identitySnapshot ??= { displayName: personLabel(s, r.personId), personId: r.personId, bookingName: s.persons[r.personId]?.bookingName, capturedAt: s.demoClock, legacy: r.attempt > 0 };
    return s;
}
