// Only restore exact known fixture fields. Unknown notes remain intact.
export const damagedText = (text) => /\?{3,}|\uFFFD/.test(text);
export function migrateText(s) {
    if (s.textSchemaVersion === 1)
        return s;
    s.textDiagnostics ??= [];
    const restore = (obj, field, value, path) => { if (typeof obj?.[field] === 'string' && damagedText(obj[field])) {
        s.textDiagnostics.push({ path, original: obj[field] });
        obj[field] = value;
    } };
    for (const [id, name] of [['student', '林晴'], ['father', '林志明'], ['mother', '陳慧'], ['lin-elder', '王秀芳'], ['lin-child', '林小宇']]) {
        for (const field of ['name', 'displayName'])
            restore(s.persons[id], field, name, 'persons.' + id + '.' + field);
        for (const locale of ['zh-HK', 'zh-CN', 'en'])
            restore(s.persons[id]?.displayNames, locale, name, 'persons.' + id + '.displayNames.' + locale);
    }
    restore(s.families['lin-family'], 'name', '林家的家人', 'families.lin-family.name');
    restore(s.funds['lin-home-2027'], 'title', '林晴的回家基金', 'funds.lin-home-2027.title');
    restore(s.plans.student, 'school', '倫敦有期示例大學（模擬院校）', 'plans.student.school');
    const walk = (obj, path) => { if (!obj || typeof obj !== 'object')
        return; for (const [k, v] of Object.entries(obj)) {
        const p = path ? path + '.' + k : k;
        if (k === 'textDiagnostics')
            continue;
        if (typeof v === 'string' && damagedText(v) && !s.textDiagnostics.some(d => d.path === p))
            s.textDiagnostics.push({ path: p, original: v });
        else if (typeof v === 'object')
            walk(v, p);
    } };
    walk(s, '');
    s.textSchemaVersion = 1;
    return s;
}
