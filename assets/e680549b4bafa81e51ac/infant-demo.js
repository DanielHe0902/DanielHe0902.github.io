export const INFANT_DEMO_MIGRATION = 'lin-xiaoyu-infant-2026-10-19-v1';
// Stable birthday: three months old for the October presentation. Never move it
// on refresh or use a demo clock to keep the child artificially young.
export const INFANT_DEMO_DOB = '2026-07-01';
export const infantDemoCare = { needs: ['bassinet', 'infantMeal', 'adjacent'], required: ['bassinet', 'adjacent'], months: 3, weight: 5 };
/** Repair only the recognized old demo child, once. Saved trips are snapshots. */
export function migrateDemoInfant(s) {
    if (s.infantDemoMigration || s.dual?.accounts['demo-parent']?.personId !== 'father' || s.dual?.accounts['demo-student']?.personId !== 'student' || !s.families['lin-family'])
        return s;
    const person = s.persons['lin-child'], profile = s.profiles['lin-family:lin-child'];
    if (!person || !profile)
        return s;
    const recognized = person.dob === '2017-06-12' || person.dob === INFANT_DEMO_DOB;
    s.infantDemoMigration = { id: INFANT_DEMO_MIGRATION, at: new Date().toISOString(), changed: recognized, before: recognized ? { dob: person.dob, profile: structuredClone(profile) } : undefined };
    if (!recognized)
        return s; // Preserve an independently edited birthday.
    person.dob = INFANT_DEMO_DOB;
    profile.needs = [...new Set([...profile.needs.map(n => n === 'childMeal' ? 'infantMeal' : n), ...infantDemoCare.needs])];
    profile.required = [...new Set([...profile.required.filter(n => n !== 'childMeal'), ...infantDemoCare.required])];
    profile.months = 3;
    profile.weight ??= 5;
    profile.version++;
    profile.updatedAt = s.infantDemoMigration.at;
    return s;
}
