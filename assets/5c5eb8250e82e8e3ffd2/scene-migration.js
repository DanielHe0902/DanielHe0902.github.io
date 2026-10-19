const fixtures = { a: ['lin', 'mei', 'child', 'baby', 'grandma'], b: ['lin', 'father', 'mother'], c: ['lin', 'mei', 'inlawDad', 'inlawMom'], d: ['student', 'father', 'mother'] };
/** Retire confirmed fixture identities, keeping their historical facts and scope. */
export function migrateScenes(s) {
    if (!s.dual || s.sceneMigration?.version === 1)
        return s;
    const retired = [], review = [];
    for (const [id, people] of Object.entries(fixtures)) {
        const f = s.families[id];
        if (!f)
            continue;
        if (!people.every(p => s.memberships.some(m => m.familyId === id && m.personId === p))) {
            review.push(id + ': 舊演示成員簽名不符，保留原狀');
            continue;
        }
        f.archived = true;
        retired.push(id);
        for (const t of Object.values(s.trips).filter(t => t.familyId === id))
            review.push(t.id + ': 同行人或授權範圍不同，保留原家庭歷史，不自動合併');
    }
    if (s.activeFamilyId && retired.includes(s.activeFamilyId))
        s.activeFamilyId = 'lin-family';
    if (s.selectedTripId && s.trips[s.selectedTripId] && retired.includes(s.trips[s.selectedTripId].familyId))
        delete s.selectedTripId;
    if (s.journeys) {
        const selected = s.journeys.items[s.journeys.selectedId ?? ''];
        if (selected?.familyId && retired.includes(selected.familyId))
            s.journeys.selectedId = null;
        for (const id of ['student-term-2027', 'lin-student-return-2027']) {
            const j = s.journeys.items[id];
            if (j && j.ownerId === 'student' && j.familyId === null) {
                j.purpose = 'student';
                j.studentPlanId = 'student:' + id;
                j.arrivalArrangementId = 'arrival:' + id;
                j.planSnapshot = { school: j.school.name, holiday: id === 'lin-student-return-2027' ? '2027-02-01' : '2027-12-18', bags: s.plans.student?.bags ?? 2 };
            }
        }
        for (const j of Object.values(s.journeys.items))
            if (j.familyId) {
                j.purpose = 'family';
                delete j.studentPlanId;
                delete j.arrivalArrangementId;
                delete j.planSnapshot;
            }
    }
    s.sceneMigration = { version: 1, at: s.demoClock, canonicalFamilyId: 'lin-family', retired, review, links: { 'lin-tokyo-2027': 'lin-family', 'lin-student-return-2027': 'personal:student', 'lin-home-2027': 'fund:student' } };
    return s;
}
