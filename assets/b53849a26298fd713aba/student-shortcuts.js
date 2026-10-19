import { readSavedCalendar } from '/assets/b53849a26298fd713aba/student-calendar.js';
import { studentCapability, requireStudent } from '/assets/b53849a26298fd713aba/capabilities.js';
import { newTravelPlan } from '/assets/b53849a26298fd713aba/experience.js';
import { AIRPORTS } from '/assets/b53849a26298fd713aba/web/travel.js';
const validAirport = (value) => AIRPORTS.some(a => a.code === value) ? value : '';
export function confirmedStudentLocations(s) {
    requireStudent(s);
    const p = readSavedCalendar(s)?.plan, confirmed = !!p;
    return { home: confirmed ? validAirport(p.homeAirport) : '', school: confirmed && p.school.trim() ? validAirport(p.destination) : '', calendar: confirmed ? p : null };
}
export function studentIntentPlan(s, intent, existing) {
    requireStudent(s);
    const known = confirmedStudentLocations(s), p = existing ? structuredClone(existing) : newTravelPlan(s);
    if (p.personId !== s.actorId || p.accountId !== s.activeAccountId)
        throw Error('請由學生本人繼續此草稿。');
    p.intent = intent;
    p.title = intent === 'home' ? '我的回家行程' : '我的返校行程';
    p.mode = 'itinerary';
    p.studentPlanning = intent === 'school';
    p.destination = p.destination || (intent === 'home' ? known.home : known.school);
    p.awaitingSchool = intent === 'school' && !known.school;
    // Neither a saved school nor a home airport proves the traveler's current location.
    if (!existing)
        p.origin = '';
    p.calendarNotes = known.calendar ? ['學校：' + known.calendar.school, '宿舍開放：' + (known.calendar.dorm || '待補充'), '開學：' + known.calendar.start, '假期：' + known.calendar.holiday + ' — ' + known.calendar.holidayEnd] : [];
    if (known.calendar) {
        p.bags = known.calendar.bags;
        p.budget = known.calendar.budget;
        p.calendarRef = readSavedCalendar(s)?.calendarId;
    }
    return p;
}
export function studentShortcuts(s) { if (!studentCapability(s))
    return ''; const p = s.plans[s.actorId]; return '<div class="student-shortcuts" aria-label="學生出行快捷操作"><button class="button secondary" data-student-intent="home">我想回家</button><button class="button secondary" data-student-intent="school">我要回校</button><button class="text-link" data-home-learn="calendar">' + (p?.saved && p.calendarConfirmed ? '查看校曆' : '導入校曆') + ' →</button></div>'; }
