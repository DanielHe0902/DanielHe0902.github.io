import * as D from '/assets/ee1ad71b9a14d41f146c/domain.js';
import { displayName, relationshipLabel } from '/assets/ee1ad71b9a14d41f146c/identity.js';
import { sc } from '/assets/ee1ad71b9a14d41f146c/locale.js';
const chars = { '輪': '轮', '預': '预', '訂': '订', '幫': '帮', '媽': '妈', '親': '亲', '陳': '陈', '護': '护', '頁': '页', '轉': '转', '資': '资', '帶': '带', '這': '这', '剛': '刚', '說': '说', '過': '过', '現': '现', '還': '还', '雙': '双', '來': '来', '時': '时', '東': '东', '與': '与', '請': '请', '規': '规', '則': '则', '選': '选', '擇': '择', '裡': '里', '嬰': '婴', '籃': '篮', '搖': '摇', '無': '无', '辦': '办', '別': '别', '個': '个', '爺': '爷', '為': '为', '麼': '么', '義': '义', '單': '单', '兩': '两', '詢': '询', '況': '况', '託': '托', '運': '运', '隨': '随', '電': '电', '誰': '谁', '對': '对', '應': '应', '認': '认', '錯': '错', '誤': '误', '換': '换', '進': '进', '開': '开', '關': '关', '於': '于' };
export const normalizeCare = (s) => sc(s).replace(/[\u3400-\u9fff]/g, c => chars[c] ?? c).toLowerCase().trim();
const uniq = (xs) => [...new Set(xs)];
const slot = (status, source = 'text', candidates) => ({ status, source, ...(candidates ? { candidates } : {}) });
const maternal = ['外婆', '外祖母', '姥姥'];
const paternal = ['奶奶', '嫲嫲', '祖母'];
function aliases(raw) { const x = normalizeCare(raw); return maternal.includes(x) ? maternal : paternal.includes(x) ? paternal : ['妈妈', '母亲'].includes(x) ? ['妈妈', '母亲'] : ['爸爸', '父亲'].includes(x) ? ['爸爸', '父亲'] : [x]; }
const mentions = (q, v) => (v === '祖母' ? q.replaceAll('外祖母', '') : q).includes(v);
export function recognitionMembers(s, f) { return (D.canAccessFamily(s, f) ? D.familyMembers(s, f) : []).filter(m => !!s.persons[m.personId]).map(m => ({ id: m.personId, name: displayName(s.persons[m.personId]), label: relationshipLabel(s, f, m.personId), editable: D.permitted(s, f, m.personId, 'care:edit') })); }
export function resolveMember(s, f, text, previous, pagePerson) {
    const members = recognitionMembers(s, f), original = normalizeCare(text), correction = /不是.+[，,]?是|改为|改成|换成/.test(original);
    let q = original;
    if (correction)
        q = q.replace(/^.*?(?:不是[^，,]*?[，,]?是|改为|改成|换成)/, '');
    const names = members.filter(m => { const p = s.persons[m.id]; return uniq([p.name, p.displayName ?? '', ...Object.values(p.displayNames ?? {}), ...(p.aliases ?? [])]).some(n => n.length >= 2 && q.includes(normalizeCare(n))); }).map(m => m.id);
    const entries = [...(s.families[f]?.assistantNames ?? []), ...D.familyMembers(s, f).filter(m => m.referencePersonId).map(m => ({ personId: m.personId, aliases: [m.label], anchorPersonId: m.referencePersonId }))];
    const common = uniq(entries.filter(e => !e.anchorPersonId && e.aliases.some(a => aliases(a).some(v => mentions(q, v)))).map(e => e.personId)).filter(id => members.some(m => m.id === id));
    const relative = uniq(entries.filter(e => e.anchorPersonId === s.actorId && e.aliases.some(a => aliases(a).some(v => mentions(q, v)))).map(e => e.personId)).filter(id => members.some(m => m.id === id));
    const explicitMine = /我的|我外婆|我妈妈|我母亲|my /.test(q);
    let ids = names.length ? names : common.length ? common : relative;
    const conflict = names.length && common.some(id => !names.includes(id)) || explicitMine && relative.length && common.some(id => !relative.includes(id));
    if (conflict)
        ids = uniq([...names, ...common, ...relative]);
    if (ids.length)
        return { ids, slot: slot(conflict ? 'conflict' : ids.length > 1 ? 'ambiguous' : correction ? 'corrected' : 'resolved', 'text', ids), correction };
    if (/(?:^|[，, ])我(?:要|需|想)|给我|为我/.test(q) && !/(帮我|不是我)/.test(q))
        return { ids: [s.actorId], slot: slot('resolved'), correction };
    // A partial name or an unresolved relationship is not an omitted subject.
    const partial = members.filter(m => { const name = normalizeCare(m.name); return name.length >= 2 && Array.from({ length: name.length - 1 }, (_, i) => name.slice(i, i + 2)).some(n => q.includes(n)); }).map(m => m.id);
    if (partial.length)
        return { ids: partial, slot: slot('ambiguous', 'text', partial), correction };
    if (/外婆|外祖母|姥姥|奶奶|嫲嫲|祖母|阿婆|婆婆|grandma|妈妈|母亲|爸爸|父亲/.test(q))
        return { ids: [], slot: slot('missing'), correction };
    if (previous?.personIds.length === 1 && /她|他|这位|刚才那位|东京|去程|回程|航段|提交|申请|轮椅|那次|那趟|餐|步行|楼梯|登梯|kg|公斤|个月|月龄/.test(q))
        return { ids: previous.personIds, slot: slot('resolved', 'conversation'), correction };
    if (/她|他|这位|刚才那位/.test(q))
        return { ids: previous?.personIds ?? [], slot: slot('ambiguous', 'conversation', previous?.personIds ?? []), correction };
    if (pagePerson && members.some(m => m.id === pagePerson))
        return { ids: [pagePerson], slot: slot('resolved', 'page'), correction };
    return { ids: [], slot: slot('missing'), correction };
}
export function careServices(text) { const q = normalizeCare(text), out = []; if (/轮椅|wheelchair/.test(q))
    out.push(/自带|自己.*轮椅|电动|托运/.test(q) ? 'ownWheelchair' : 'wheelchair'); if (/婴儿篮|摇篮/.test(q))
    out.push('bassinet'); if (/素食|特殊餐|特别餐/.test(q))
    out.push('specialMeal'); if (/儿童餐/.test(q))
    out.push('childMeal'); if (/婴儿餐/.test(q))
    out.push('infantMeal'); if (/相邻|邻座|鄰座|坐一起|坐在一起/.test(q))
    out.push('adjacent'); return out; }
export function parseCareTask(s, context, text, requestId, previous, pagePerson) {
    const q = normalizeCare(text), services = careServices(q), follow = !!previous && /东京|那次|那趟|去程|回程|航段|她|他|这位|刚才|不是|改成|改为|先别|先不要|提交|申请|轮椅|资料|不用|机场提供|自己的|步行|楼梯|登梯|kg|公斤|个月|月龄/.test(q);
    if (!services.length && !/照护|家庭照顧/.test(q) && !follow)
        return undefined;
    const f = context.familyId ?? '', members = recognitionMembers(s, f), resolved = resolveMember(s, f, q, follow ? previous : undefined, pagePerson);
    const goal = /什么意思|按钮.*(意思|功能)|规则|只想看|有什么要求|可以.*吗|有.*服务吗/.test(q) ? 'rules' : /先别|先不要|现在.*不要|不需要|不用|不要申请|暂停/.test(q) ? 'hold' : /进度|状态|申请.*(怎样|如何|怎么样)|查.*申请/.test(q) ? 'status' : /确认提交|现在提交/.test(q) ? 'confirm' : services.length || follow ? 'prepare' : 'navigate';
    const t = { requestId, conversationId: previous?.conversationId ?? requestId, context: { ...context }, goal, needs: [], personIds: resolved.ids, services: services.length ? services : follow ? previous.services : [], tripId: follow ? previous.tripId : undefined, tripVersion: follow ? previous.tripVersion : undefined, segmentIds: follow ? [...previous.segmentIds] : [], slots: { member: resolved.slot, service: slot(services.length ? 'resolved' : follow && previous.services.length ? 'resolved' : 'missing', services.length ? 'text' : 'conversation'), trip: slot('missing'), segments: slot('missing') }, candidates: resolved.ids, tripCandidates: [], routeKey: 'care', targetKey: 'care-member', nextAction: 'navigate', correction: resolved.correction, rental: /租.*轮椅|轮椅.*租/.test(q) };
    if (goal === 'hold' && previous) {
        t.personIds = [...previous.personIds];
        t.needs = structuredClone(previous.needs);
        t.services = [...previous.services];
        t.slots.member = slot('resolved', 'conversation');
        t.slots.service = slot('negated');
    }
    const dataMissing = !s.families[f] || D.familyMembers(s, f).some(m => !s.persons[m.personId]);
    if (dataMissing)
        t.dataError = true;
    // Separate clauses bind each service to its own person, instead of flattening both lists.
    for (const clause of q.split(/[，,；;。]/)) {
        const ks = careServices(clause);
        if (!ks.length || /不需要|不用/.test(clause))
            continue;
        const rr = resolveMember(s, f, clause, follow ? previous : undefined, pagePerson);
        if (rr.ids.length === 1 && !['ambiguous', 'conflict'].includes(rr.slot.status))
            for (const service of ks)
                t.needs.push({ personId: rr.ids[0], service });
    }
    if (!t.needs.length && t.personIds.length === 1 && !['ambiguous', 'conflict'].includes(t.slots.member.status))
        t.needs = t.services.map(service => ({ personId: t.personIds[0], service }));
    if (t.needs.length && q.split(/[，,；;。]/).filter(c => careServices(c).length).length > 1) {
        t.personIds = uniq(t.needs.map(n => n.personId));
        t.slots.member = slot('resolved');
        t.candidates = t.personIds;
    }
    const trips = Object.values(s.trips).filter(tr => tr.familyId === f && t.personIds.every(id => tr.members.some(m => m.personId === id)) && tr.status !== 'completed');
    const explicitTrips = trips.filter(tr => q.includes(normalizeCare(tr.route.destination)) || q.includes(tr.route.date) || /东京/.test(q) && ['NRT', 'HND'].includes(tr.route.destination));
    const tr = explicitTrips.length === 1 ? explicitTrips[0] : trips.find(tr => tr.id === (t.tripId ?? context.tripId));
    if (tr) {
        t.tripId = tr.id;
        t.tripVersion = tr.version;
        t.slots.trip = slot('resolved', explicitTrips.length ? 'text' : 'saved');
        const all = tr.route.segments.map((_, i) => tr.id + '-v' + tr.version + '-s' + i);
        if (/去程.*回程|往返|来回|两个航段/.test(q))
            t.segmentIds = all;
        else if (/回程/.test(q))
            t.segmentIds = all.slice(-1);
        else if (/去程/.test(q))
            t.segmentIds = all.slice(0, 1);
        t.segmentIds = t.segmentIds.filter(id => all.includes(id));
        t.slots.segments = slot(t.segmentIds.length ? 'resolved' : 'missing', /去程|回程|往返|来回/.test(q) ? 'text' : 'conversation');
    }
    t.tripCandidates = (explicitTrips.length > 1 ? explicitTrips : trips).map(tr => tr.id);
    t.fields = {};
    if (follow && !t.correction)
        for (const id of t.personIds)
            if (previous?.fields?.[id])
                t.fields[id] = { ...previous.fields[id] };
    for (const clause of q.split(/[，,；;。]/)) {
        const rr = resolveMember(s, f, clause, t, pagePerson);
        if (rr.ids.length !== 1 || !t.personIds.includes(rr.ids[0]))
            continue;
        const fields = t.fields[rr.ids[0]] ?? {};
        if (/短距离.*(步行|能走)|短距离可走/.test(clause))
            fields.walking = '短距离可步行，长距离需协助';
        else if (/不能.*(步行|走路)|全程需协助/.test(clause))
            fields.walking = '全程需协助';
        if (/不能.*(登梯|上楼梯)|登梯.*需.*协助/.test(clause))
            fields.stairs = '需要协助';
        else if (/可.*(独立登梯|自行登梯)/.test(clause))
            fields.stairs = '可独立登梯';
        if (/自带.*手动轮椅/.test(clause))
            fields.wheelchairType = '手动';
        else if (/自带.*电动轮椅/.test(clause))
            fields.wheelchairType = '电动，设备待核实';
        const months = clause.match(/(\d+)\s*(?:个月|月龄)/), weight = clause.match(/(\d+(?:\.\d+)?)\s*(?:kg|公斤|千克)/);
        if (months && +months[1] <= 216)
            fields.months = +months[1];
        if (weight && +weight[1] > 0 && +weight[1] <= 300)
            fields.weight = +weight[1];
        if (Object.keys(fields).length)
            t.fields[rr.ids[0]] = fields;
    }
    if (t.dataError || goal === 'rules' || goal === 'hold' || t.rental) {
        t.nextAction = 'answer';
        return t;
    }
    if (t.slots.member.status === 'conflict' || t.slots.member.status === 'ambiguous' || !t.personIds.length) {
        t.nextAction = 'clarify';
        t.reason = t.slots.member.status;
        if (!t.candidates.length && t.reason === 'missing' && /^(?:我想|请|帮我)?(?:给家人|帮家人|为家人|需要|申请|准备|预定|预约|安排|轮椅|家庭照护)/.test(q) && !/外婆|奶奶|grandma|阿婆|婆婆|妈妈|母亲/.test(q))
            t.candidates = members.filter(m => m.editable).map(m => m.id);
        return t;
    }
    return t;
}
export function validateCareTask(s, t, context) { if (!validCareFields(t))
    return false; if (JSON.stringify(t.context) !== JSON.stringify(context) || t.context.familyId !== context.familyId)
    return false; const f = context.familyId; if (!f || !D.membership(s, f))
    return false; if (t.needs.some(n => !t.personIds.includes(n.personId) || !['wheelchair', 'ownWheelchair', 'bassinet', 'specialMeal', 'infantMeal', 'childMeal', 'adjacent', 'aisle'].includes(n.service)))
    return false; if (t.personIds.some(id => !D.familyMembers(s, f).some(m => m.personId === id) || !D.permitted(s, f, id, 'care:edit') || !s.profiles[f + ':' + id]))
    return false; if (t.tripId) {
    const tr = s.trips[t.tripId];
    if (!tr || tr.familyId !== f || tr.version !== t.tripVersion || t.personIds.some(id => !tr.members.some(m => m.personId === id)) || t.segmentIds.some(id => !tr.route.segments.some((_, i) => tr.id + '-v' + tr.version + '-s' + i === id)))
        return false;
} return true; }
export const recognitionDiagnostics = (t, result) => ({ requestId: t.requestId, memberSource: t.slots.member.source, candidateCount: t.candidates.length, slots: Object.fromEntries(Object.entries(t.slots).map(([k, v]) => [k, v.status])), reason: t.reason, route: t.routeKey, result });
export function careDirectory(s, c) { const f = c.familyId; if (!f)
    return []; return recognitionMembers(s, f).filter(m => m.editable).map(m => ({ personId: m.id, names: uniq([m.name, ...Object.values(s.persons[m.id].displayNames ?? {}), ...(s.persons[m.id].aliases ?? [])]).slice(0, 10), aliases: (s.families[f].assistantNames ?? []).filter(a => a.personId === m.id && (!a.anchorPersonId || a.anchorPersonId === s.actorId)).flatMap(a => a.aliases).slice(0, 15) })); }
export function applyCareProposal(s, c, id, proposal, previous) {
    // The model can suggest a known person and service; never an arbitrary route, grant or form field.
    const ids = uniq(proposal.needs.map(n => n.personId)), allowed = careDirectory(s, c).map(m => m.personId);
    if (!ids.length || ids.some(id => !allowed.includes(id)))
        return undefined;
    const base = parseCareTask(s, c, '準備輪椅', id, previous);
    if (!base)
        return undefined;
    const task = { ...base, goal: proposal.goal, personIds: ids, needs: proposal.needs, services: [...new Set(proposal.needs.map(n => n.service))], candidates: ids, nextAction: 'navigate', reason: undefined, slots: { ...base.slots, member: slot('resolved', 'api'), service: slot('resolved', 'api') } };
    if (!validateCareTask(s, task, c)) {
        delete task.tripId;
        delete task.tripVersion;
        task.segmentIds = [];
        task.slots.trip = slot('missing');
        task.slots.segments = slot('missing');
    }
    return validateCareTask(s, task, c) ? task : undefined;
}
export function validCareFields(t) { return Object.entries(t.fields ?? {}).every(([id, f]) => t.personIds.includes(id) && Object.entries(f).every(([key, value]) => ['walking', 'stairs', 'wheelchairType'].includes(key) ? typeof value === 'string' && value.length <= 80 : key === 'months' ? typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 216 : key === 'weight' ? typeof value === 'number' && Number.isFinite(value) && value > 0 && value <= 300 : false)); }
/** Called within the existing IndexedDB readwrite transaction, after explicit confirmation. */
export function applyCareDrafts(s, profiles, c) { if (s.actorId !== c.actorId || s.activeAccountId !== c.accountId || s.activeFamilyId !== c.familyId || s.epoch !== c.epoch || c.tripId && s.trips[c.tripId] && s.trips[c.tripId].version !== c.tripVersion)
    throw Error('帳號、家庭或行程已更新，請重新核對。'); for (const p of profiles)
    if (p.familyId !== c.familyId || !D.permitted(s, p.familyId, p.personId, 'care:edit') || s.profiles[p.familyId + ':' + p.personId]?.version !== p.version)
        throw Error('照護資料或授權已更新，請重新核對。'); let next = s; for (const p of profiles)
    next = D.reduce(next, { type: 'care', profile: p }); return next; }
