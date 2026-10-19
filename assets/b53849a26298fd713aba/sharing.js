import * as D from '/assets/b53849a26298fd713aba/domain.js';
import { emptyProfile } from '/assets/b53849a26298fd713aba/seed.js';
import { publishNotice } from '/assets/b53849a26298fd713aba/reminders.js';
export function createLink(s, kind, targetId, role = 'viewer') {
    if (kind === 'family') {
        if (!D.canAccessFamily(s, targetId) || D.membership(s, targetId)?.role !== 'owner')
            throw Error('只有有效家庭的管理員可建立邀請');
        if (!['viewer', 'editor'].includes(role))
            throw Error('邀請不授予管理員權限');
    }
    else if (s.funds[targetId]?.ownerId !== s.actorId || s.funds[targetId]?.status !== 'open')
        throw Error('只有本人可分享有效的回家目標');
    s.shareLinks ??= {};
    const token = crypto.randomUUID().replaceAll('-', '') + crypto.randomUUID().replaceAll('-', '');
    s.shareLinks[token] = { token, kind, targetId, creatorId: s.actorId, ...(kind === 'family' ? { role } : {}), createdAt: s.demoClock, expiresAt: new Date(Date.parse(s.demoClock) + 30 * 86400000).toISOString(), status: 'pending' };
    return token;
}
export function linkStatus(s, l) { return l.status === 'revoked' ? 'revoked' : Date.parse(s.demoClock) >= Date.parse(l.expiresAt) ? 'expired' : l.status; }
export function validLink(s, token, kind) {
    const l = s.shareLinks?.[token];
    if (!l || l.kind !== kind || !Number.isFinite(Date.parse(l.expiresAt)) || !Number.isFinite(Date.parse(s.demoClock)) || !['pending', 'accepted'].includes(l.status) || ['revoked', 'expired'].includes(linkStatus(s, l)))
        throw Error('連結已失效、已撤銷或用途不符');
    if (kind === 'family') {
        if (!s.families[l.targetId] || s.families[l.targetId].archived)
            throw Error('受邀家庭已不存在或已歸檔，請聯絡邀請人。');
        if (!l.role || !['viewer', 'editor'].includes(l.role))
            throw Error('邀請角色無效，請取得新的邀請連結。');
        if (!D.canAccessFamily(s, l.targetId, l.creatorId) || D.membership(s, l.targetId, l.creatorId)?.role !== 'owner')
            throw Error('邀請人的家庭管理權限已變更，請取得新的邀請連結。');
    }
    if (kind === 'fund' && s.funds[l.targetId]?.status !== 'open')
        throw Error('回家目標已關閉');
    return l;
}
export function revokeLink(s, token) { const l = s.shareLinks?.[token]; if (!l || l.creatorId !== s.actorId)
    throw Error('只能撤銷本人建立的連結'); l.status = 'revoked'; return s; }
/** Public DTO: no member list, care data, exact personal identity, transactions or DOB. */
export function linkPreview(s, token, kind) { const l = validLink(s, token, kind); return kind === 'family' ? { kind, title: '加入受邀家庭', family: s.families[l.targetId]?.name, inviter: '家庭管理員', role: l.role === 'editor' ? '協作者' : '僅查看', scope: '家庭摘要；不包含照護代辦、證件、成年成員私有行程或里數授權。', expiresAt: l.expiresAt, status: linkStatus(s, l) } : { kind, title: '支持一段回家路', beneficiary: '受邀學生', route: s.funds[l.targetId].origin + ' → ' + s.funds[l.targetId].destination, from: s.funds[l.targetId].from, until: s.funds[l.targetId].until, target: s.funds[l.targetId].target, scope: '只支持此學生本人的機票；不建立家庭成員關係。', expiresAt: l.expiresAt, status: linkStatus(s, l) }; }
export function registerLinkIdentity(s, alias, name) { alias = alias.trim().toLowerCase(); name = name.trim(); if (!/^[a-z0-9_-]{3,40}$/.test(alias) || !name || name.length > 30)
    throw Error('請填寫 3–40 位英文／數字登入名稱和 1–30 字顯示名稱'); s.linkIdentities ??= {}; s.externalAccounts ??= {}; if (s.linkIdentities[alias])
    return s.linkIdentities[alias]; const pid = 'guest-' + crypto.randomUUID(), mid = 'member-' + crypto.randomUUID(), accountId = 'invited-' + crypto.randomUUID(); s.persons[pid] = { id: pid, name, displayName: name, nickname: name, dob: '1990-01-01', guardianIds: [] }; s.accounts[mid] = { id: mid, personId: pid, joinedAt: s.demoClock.slice(0, 10), expiry: '2028-07-01', studentVerified: false }; s.externalAccounts[accountId] = { accountId, personId: pid, memberId: mid, role: 'parent', defaultTripId: '', workspace: '受邀者', ledgerRef: mid }; const key = 'sample-opening:' + mid; s.ledger.push({ id: key, key, memberId: mid, amount: 5000, kind: 'opening', at: s.demoClock, qualifying: false }); return s.linkIdentities[alias] = { alias, personId: pid, accountId }; }
export function linkAccount(s, accountId) { return s.dual?.accounts[accountId] ?? s.externalAccounts?.[accountId]; }
export function authenticateLink(s, token, kind, accountId) { validLink(s, token, kind); const a = linkAccount(s, accountId); if (!a)
    throw Error('請先登入帳號'); s.actorId = a.personId; s.activeAccountId = a.accountId; return s; }
export function acceptFamilyLink(s, token, accountId, agree) {
    const l = validLink(s, token, 'family'), a = linkAccount(s, accountId);
    if (!a || !s.persons[a.personId] || s.accounts[a.memberId]?.personId !== a.personId)
        throw Error('請先登入有效的會員帳號');
    if (!agree)
        throw Error('請明確同意加入及角色範圍');
    if (l.acceptedBy && l.acceptedBy !== a.personId)
        throw Error('此邀請已由另一位成員接受');
    const active = D.membership(s, l.targetId, a.personId);
    if (l.status === 'accepted') {
        if (!active)
            throw Error('此邀請已使用；離開家庭後，請取得新的邀請連結。');
        return s;
    }
    if (!active) {
        // Rejoin the same person, preserving recorded kinship, never a former access role.
        const prior = s.memberships.find(m => m.familyId === l.targetId && m.personId === a.personId && !m.active && m.label !== '受邀家人') ?? s.memberships.find(m => m.familyId === l.targetId && m.personId === a.personId && !m.active);
        if (prior) {
            prior.active = true;
            prior.role = l.role;
        }
        else
            s.memberships.push({ familyId: l.targetId, personId: a.personId, role: l.role, label: '受邀家人', active: true });
        s.profiles[l.targetId + ':' + a.personId] ??= emptyProfile(l.targetId, a.personId);
    }
    l.status = 'accepted';
    l.acceptedBy = a.personId;
    l.acceptedAt = s.demoClock;
    D.event(s, 'family_link_accepted', { personId: a.personId, memberId: a.memberId, familyId: l.targetId }, 'family-link:' + token);
    publishNotice(s, 'invitation:' + token, l.creatorId, '家人已接受邀請', '受邀者已加入家庭。照護授權、里數支持及實際同行名單保持獨立。', { type: 'membership' });
    return s;
}
export function authorizeFundLink(s, token, accountId) { const l = validLink(s, token, 'fund'); authenticateLink(s, token, 'fund', accountId); if (s.actorId === s.funds[l.targetId].ownerId)
    throw Error('本人不能資助自己的回家目標'); const f = s.funds[l.targetId]; if (!f.invited.includes(s.actorId))
    f.invited.push(s.actorId); if (!s.dual.grants.some(g => g.granteeId === s.actorId && g.fundId === f.id))
    s.dual.grants.push({ personId: f.ownerId, granteeId: s.actorId, fundId: f.id, fields: ['beneficiary', 'title', 'route', 'travelWindow', 'target'], support: true }); return s; }
export function shareUrl(s, l, origin) { return origin + (l.kind === 'family' ? '/join/' : '/fund-share/') + l.token + '?space=' + encodeURIComponent(s.demoSpaceId); }
