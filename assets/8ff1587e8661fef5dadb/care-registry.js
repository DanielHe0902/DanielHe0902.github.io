/** Canonical services across profile, dialog, snapshot and routing. Eligibility never filters intent. */
export const CARE_REGISTRY = {
    wheelchair: { label: '機場輪椅', aliases: ['airportWheelchair', '机场轮椅', '機場輪椅'], route: 'support', fields: ['walking', 'stairs'] },
    ownWheelchair: { label: '自帶輪椅', aliases: ['own_wheelchair', '自带轮椅', '自帶輪椅'], route: 'support', fields: ['wheelchairType', 'equipment'] },
    aisle: { label: '過道座位', aliases: ['aisleSeat', '过道座位', '過道座位'], route: 'airline', fields: [] },
    adjacent: { label: '照護者相鄰座位', aliases: ['caregiverAdjacent', '照护者相邻座位', '照護者相鄰座位'], route: 'airline', fields: ['caregiverId'] },
    bassinet: { label: '嬰兒籃', aliases: ['babyBassinet', 'babyCot', '婴儿篮', '嬰兒籃', '搖籃', '摇篮'], route: 'airline', fields: ['months', 'weight'] },
    childMeal: { label: '兒童餐', aliases: ['child_meal', 'CHML', '儿童餐', '兒童餐'], route: 'airline', fields: [] },
    infantMeal: { label: '嬰兒餐', aliases: ['infant_meal', 'BBML', '婴儿餐', '嬰兒餐'], route: 'airline', fields: [] },
    specialMeal: { label: '特殊餐食', aliases: ['special_meal', '特殊餐', '特殊餐食'], route: 'airline', fields: [] },
};
export const CARE_KINDS = Object.keys(CARE_REGISTRY);
export function canonicalCare(value) { return CARE_KINDS.find(k => k === value || CARE_REGISTRY[k].aliases.includes(value)); }
export function normalizeNeeds(input, base = []) { const needs = new Set(base), unknown = []; const apply = (raw, on) => { const k = canonicalCare(raw); if (!k) {
    unknown.push(raw);
    return;
} if (on)
    needs.add(k);
else
    needs.delete(k); }; if (Array.isArray(input)) {
    needs.clear();
    input.forEach(x => typeof x === 'string' && apply(x, true));
}
else if (input && typeof input === 'object')
    for (const [k, v] of Object.entries(input))
        if (typeof v === 'boolean')
            apply(k, v); return { needs: [...needs], unknown: [...new Set(unknown)] }; }
export function normalizedProfile(p) { const result = normalizeNeeds(p.needs); return { ...p, needs: result.needs, required: normalizeNeeds(p.required).needs.filter(k => result.needs.includes(k)), ...((p.unrecognizedNeeds || result.unknown.length) ? { unrecognizedNeeds: [...new Set([...(p.unrecognizedNeeds ?? []), ...result.unknown])] } : {}) }; }
export function profileForAssessment(s, p, departure) { const copy = structuredClone(p), dob = s.persons[p.personId]?.dob; if (dob && /^\d{4}-\d{2}-\d{2}/.test(departure)) {
    const a = new Date(departure.slice(0, 10)), b = new Date(dob);
    const months = (a.getUTCFullYear() - b.getUTCFullYear()) * 12 + a.getUTCMonth() - b.getUTCMonth() - (a.getUTCDate() < b.getUTCDate() ? 1 : 0);
    if (months >= 24)
        copy.months = Math.max(copy.months ?? 0, months);
} return copy; }
