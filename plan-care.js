import { CARE_KINDS, profileForAssessment } from './care-registry.js';
import * as D from './domain.js';
import { SERVICE_LABELS, RULES } from './config.js';
import { displayName } from './identity.js';
import { esc } from './ui.js';
export function careKinds(_s, _p, _pid) { return [...CARE_KINDS]; }
export function planCarePreview(s, p) { return Object.entries(p.careNeeds ?? {}).flatMap(([pid, kinds]) => { if (!kinds.length)
    return []; if (!p.familyId || !p.travelerIds.includes(pid) || !s.persons[pid] || !D.permitted(s, p.familyId, pid, 'service'))
    throw Error('照護需求只能指派給本次已獲授權的同行成員。'); const allowed = careKinds(s, p, pid); if (kinds.some(k => !allowed.includes(k)) || new Set(kinds).size !== kinds.length)
    throw Error('請重新核對服務與旅客年齡是否適用。'); return kinds.map(kind => { const profile = s.profiles[p.familyId + ':' + pid], leg = p.selectedFlight?.outbound.legs[0], a = profile && leg ? D.assess(profileForAssessment(s, profile, p.start), kind, leg.aircraft, s.demoClock, leg.operator) : null; return { personId: pid, kind, assessment: a, label: displayName(s.persons[pid]) + ' · ' + SERVICE_LABELS[kind] + (a?.applicability === 'unavailable' ? ' · 此機型無法提供' : a?.missing.length ? ' · ' + a.missing.join('、') : '') }; }); }); }
export function planCareForm(s, p) { if (!p.selectedFlight || !p.familyId)
    return ''; const people = p.travelerIds.filter(id => D.permitted(s, p.familyId, id, 'service')); return '<fieldset class="plan-field-group"><legend>本次同行人的特殊需求（選填）</legend><p class="field-hint">按實際需要勾選。保存的是本行程需求草稿；不修改長期檔案、不提交或確認服務。</p>' + people.map(pid => '<fieldset class="plan-care-person"><legend>' + esc(displayName(s.persons[pid])) + '</legend><div class="checks-grid">' + careKinds(s, p, pid).map(kind => '<label class="check"><input type="checkbox" name="care:' + pid + '" value="' + kind + '" ' + (p.careNeeds?.[pid]?.includes(kind) ? 'checked' : '') + '>' + esc(SERVICE_LABELS[kind]) + '</label>').join('') + '</div>' + ((s.profiles[p.familyId + ':' + pid]?.unrecognizedNeeds ?? []).length ? '<p class="notice">尚需核對的已記錄需求：' + esc(s.profiles[p.familyId + ':' + pid].unrecognizedNeeds.join('、')) + '</p>' : '') + '</fieldset>').join('') + '</fieldset>'; }
export function savePlanCare(s, p, t) { const rows = planCarePreview(s, p); for (const pid of [...new Set(rows.map(r => r.personId))]) {
    const original = t.snapshots.find(x => x.personId === pid)?.profile ?? s.profiles[t.familyId + ':' + pid], kinds = rows.filter(r => r.personId === pid).map(r => r.kind);
    const profile = { familyId: t.familyId, personId: pid, version: original?.version ?? 0, needs: kinds, required: [], weight: null, months: null, walking: '', stairs: '', wheelchairType: '', equipment: '', updatedAt: s.demoClock, ...(original ? structuredClone(original) : {}), };
    profile.needs = kinds;
    profile.required = profile.required.filter(k => kinds.includes(k));
    t.snapshots = t.snapshots.filter(x => x.personId !== pid);
    t.snapshots.push({ personId: pid, profileVersion: profile.version, profile });
    for (const [i, leg] of t.route.segments.entries())
        for (const kind of kinds) {
            const caregiverId = kind === 'adjacent' ? t.relationships.find(r => r.dependentId === pid)?.caregiverId : undefined, segmentId = t.id + '-v' + t.version + '-s' + i, key = [t.familyId, t.id, t.version, pid, segmentId, kind, caregiverId ?? ''].join('|');
            if (Object.values(s.requests).some(r => r.tripId === t.id && r.tripVersion === t.version && r.segmentId === segmentId && r.personId === pid && r.kind === kind))
                continue;
            const a = kind === 'adjacent' && !caregiverId ? { applicability: 'missing', missing: ['本次同行照護者'] } : D.assess(profileForAssessment(s, profile, t.route.date), kind, leg.aircraft, s.demoClock, leg.operatingCarrier), id = crypto.randomUUID();
            s.requests[id] = { id, familyId: t.familyId, tripId: t.id, tripVersion: t.version, personId: pid, segmentId, kind, caregiverId, ...a, progress: a.applicability === 'missing' ? 'missing' : a.applicability === 'unavailable' ? 'unavailable' : 'review', deadline: new Date(leg.departureUtc - RULES.deadlines[kind] * 3600000).toISOString(), key, attempt: 0, receipt: null, ticket: null, history: ['由行程預覽保存的需求草稿，尚未提交'], manualQueried: false };
        }
} }
