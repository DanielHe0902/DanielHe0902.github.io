import { tripDecision, unresolvedChange } from '/assets/ee1ad71b9a14d41f146c/trip-decision.js';
import { preparationTasks } from '/assets/ee1ad71b9a14d41f146c/preparation-state.js';
import { serviceState, serviceName } from '/assets/ee1ad71b9a14d41f146c/service-state.js';
import * as D from '/assets/ee1ad71b9a14d41f146c/domain.js';
import * as M from '/assets/ee1ad71b9a14d41f146c/demo.js';
import { journeyModel } from '/assets/ee1ad71b9a14d41f146c/journey-context.js';
import { AIRPORTS } from '/assets/ee1ad71b9a14d41f146c/web/travel.js';
export const THEMES = ['家庭相聚', '城市文化', '求學出行', '自然休憩'];
const item = (contentId, title, description, destination, theme, from, until, seasonal = false, scope = 'all') => ({ contentId, version: 1, type: seasonal ? 'theme' : 'destination', title, description, destination, theme, image: null, alt: destination + ' 目的地路線卡', from, until, zone: 'Asia/Hong_Kong', language: 'zh-Hant', scope, source: 'demo', action: 'plan', budgetHint: 12000, seasonal });
export const CONTENT = [
    item('tokyo-together', '東京，留一段時間給彼此', '看東京塔點亮夜色，走進淺草與街區小店，安排自己的城市漫遊。', 'NRT', '家庭相聚', '2026-01-01T00:00:00+08:00', '2035-01-01T00:00:00+08:00'),
    item('london-culture', '倫敦，在課堂之外遇見世界', '從泰晤士河畔的塔橋到博物館，在街頭讀懂倫敦的歷史與日常。', 'LHR', '城市文化', '2026-01-01T00:00:00+08:00', '2035-01-01T00:00:00+08:00'),
    item('taipei-slow', '台北，把步伐放慢一點', '登高望見台北 101，再走進夜市與老街，品嚐一座城市的生活滋味。', 'TPE', '自然休憩', '2026-01-01T00:00:00+08:00', '2035-01-01T00:00:00+08:00'),
    item('spring-home-2027', '新歲相聚，回家的路有期', '一份團聚旅行想法，從自己的出發地與日期開始。', 'HKG', '家庭相聚', '2027-01-01T00:00:00+08:00', '2027-02-21T00:00:00+08:00', true),
    item('christmas-2026', '冬日倫敦，探索節慶街景', '假期靈感，不含優惠或任何已確定的出行安排。', 'LHR', '城市文化', '2026-11-15T00:00:00+08:00', '2026-12-27T00:00:00+08:00', true),
    item('summer-2027', '夏日台北，讓下一程慢下來', '用你自選的時間和預算，留一段城市與自然的空間。', 'TPE', '自然休憩', '2027-06-01T00:00:00+08:00', '2027-09-01T00:00:00+08:00', true),
    item('study-2027', '新學期，從容啟程', '校曆和私人文件留在本人學期規劃中；先保存旅行想法也可以。', 'LHR', '求學出行', '2027-08-01T00:00:00+08:00', '2027-10-15T00:00:00+08:00', true, 'student')
];
export function experience(s) { return s.experience ?? { version: 1, preferences: {}, favorites: {}, plans: {} }; }
export function initExperience(s) { s.experience ??= { version: 1, preferences: {}, favorites: {}, plans: {} }; return s.experience; }
export function prefs(s, accountId = s.activeAccountId ?? s.actorId) { return experience(s).preferences[accountId] ?? { themes: [], origin: '', budget: null, tripReminders: true, festivalReminders: true, contentReminders: false }; }
export function contentNow(s) { return s.dual ? Date.parse(s.demoClock) : Date.now(); }
export function contentAvailable(s, c, at = contentNow(s)) { return at >= Date.parse(c.from) && at < Date.parse(c.until) && (c.scope === 'all' || M.studentAccount(s)); }
export function visibleContent(s, at = contentNow(s)) { const p = prefs(s); return CONTENT.filter(c => contentAvailable(s, c, at)).sort((a, b) => Number(b.seasonal) - Number(a.seasonal) || Number(p.themes.includes(b.theme)) - Number(p.themes.includes(a.theme))).slice(0, 3); }
export function findContent(id) { return CONTENT.find(c => c.contentId === id); }
function assertAccount(s, id) { if ((s.activeAccountId ?? s.actorId) !== id || !D.account(s, s.actorId))
    throw Error('帳號或授權已變更，請重新核對。'); }
export function savePreferences(s, accountId, input) { assertAccount(s, accountId); if (input.themes.some(t => !THEMES.includes(t)) || input.origin && !AIRPORTS.some(a => a.code === input.origin) || input.budget !== null && (!Number.isInteger(input.budget) || input.budget < 100 || input.budget > 1000000))
    throw Error('請核對主題、出發地和預算。'); const next = { themes: [...new Set(input.themes)], origin: input.origin, budget: input.budget, tripReminders: !!input.tripReminders, festivalReminders: !!input.festivalReminders, contentReminders: !!input.contentReminders }; initExperience(s).preferences[accountId] = next; return s; }
export function setFavorite(s, accountId, id, save) { assertAccount(s, accountId); const store = initExperience(s); store.favorites[accountId] ??= {}; if (!save) {
    delete store.favorites[accountId][id];
    return s;
} const c = findContent(id); if (!c || !contentAvailable(s, c))
    throw Error('內容已結束或不適用；沒有新增收藏。'); store.favorites[accountId][id] = { contentId: c.contentId, version: c.version, title: c.title, savedAt: s.demoClock }; return s; }
export function savedFavorites(s) { return Object.values(experience(s).favorites[s.activeAccountId ?? s.actorId] ?? {}); }
export function planningPeople(s) { return Object.values(s.persons).filter(p => p.id === s.actorId || !!s.activeFamilyId && !!D.membership(s, s.activeFamilyId, p.id)); }
export function newTravelPlan(s, contentId) { const c = contentId ? findContent(contentId) : undefined; if (contentId && (!c || !contentAvailable(s, c)))
    throw Error('這項內容已結束；可另建自己的旅行想法。'); const p = prefs(s); return { id: crypto.randomUUID(), accountId: s.activeAccountId ?? s.actorId, personId: s.actorId, version: 0, title: c?.title ?? '我的旅行想法', contentId: c?.contentId, contentVersion: c?.version, destination: c?.destination ?? '', origin: p.origin, theme: c?.theme ?? p.themes[0] ?? '', start: '', end: '', budget: p.budget, mode: 'itinerary', familyId: '', travelerIds: [s.actorId], stage: 'planning', updatedAt: s.demoClock }; }
export function ownPlans(s) { return Object.values(experience(s).plans).filter(p => p.accountId === (s.activeAccountId ?? s.actorId) && p.personId === s.actorId).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)); }
export function validatePlan(s, p) { assertAccount(s, p.accountId); if (s.tripCleanup?.retired.includes(p.id))
    throw Error('此行程已移除，請建立新的行程。'); if (p.personId !== s.actorId || !p.id || !p.title.trim() || p.title.length > 100)
    throw Error('計劃身份或名稱無效。'); if (p.origin && !AIRPORTS.some(a => a.code === p.origin) || p.destination && !AIRPORTS.some(a => a.code === p.destination) || p.origin && p.origin === p.destination)
    throw Error('請選擇不同的有效起點和目的地。'); for (const day of [p.start, p.end])
    if (day && (!/^\d{4}-\d{2}-\d{2}$/.test(day) || new Date(day + 'T00:00:00Z').toISOString().slice(0, 10) !== day))
        throw Error('日期格式不正確。'); if (p.start && p.end && p.end < p.start)
    throw Error('回程日期不能早於出發日期。'); if (p.budget !== null && (!Number.isInteger(p.budget) || p.budget < 100 || p.budget > 1000000))
    throw Error('預算須為 100 至 1,000,000 的整數。'); if (p.theme && !THEMES.includes(p.theme) || p.travelerIds.some(id => !planningPeople(s).some(x => x.id === id)))
    throw Error('主題或同行成員已不在目前範圍。'); const old = experience(s).plans[p.id]; if (old && (old.accountId !== p.accountId || old.personId !== p.personId || old.version !== p.version) || !old && p.version !== 0)
    throw Error('計劃版本已變更，請載入最新資料再儲存。'); }
export function saveTravelPlan(s, p) { validatePlan(s, p); const clean = { ...p, flightSearch: undefined, mode: 'draft', familyId: p.familyId, departureTime: p.departureTime, arrivalDay: p.arrivalDay, arrivalTime: p.arrivalTime, returnTime: p.returnTime, returnArrivalDay: p.returnArrivalDay, returnArrivalTime: p.returnArrivalTime, id: p.id, accountId: p.accountId, personId: p.personId, version: p.version + 1, title: p.title.trim(), contentId: p.contentId, contentVersion: p.contentVersion, origin: p.origin, destination: p.destination, theme: p.theme, start: p.start, end: p.end, budget: p.budget, travelerIds: [...new Set(p.travelerIds)], stage: 'planning', updatedAt: s.demoClock }; initExperience(s).plans[p.id] = clean; return s; }
export function rankedJourneys(s) { const now = Date.parse(s.demoClock); return Object.values(s.journeys?.items ?? {}).filter(j => M.canReadTrip(s, j.id)).map(j => { const vm = journeyModel(s, j), t = s.trips[j.id], seg = j.segments.find(x => !x.completed) ?? j.segments.at(-1), decision = tripDecision(s, j.id), affected = !decision.userCancelled && (unresolvedChange(s, j.id) || !decision.partiallyCancelled && t?.status === 'cancelled'), ended = vm.phase === 'completed', ongoing = !decision.userCancelled && !ended && (j.segments.some(x => x.actualLanding) || Date.parse(j.segments[0].departure) <= now); return { j, vm, seg, affected, ended, ongoing, ...decision, rank: affected ? 0 : ongoing ? 1 : ended ? 3 : 2 }; }).sort((a, b) => a.rank - b.rank || (a.ended ? Date.parse(b.seg.departure) - Date.parse(a.seg.departure) : Date.parse(a.seg.departure) - Date.parse(b.seg.departure))); }
export function journeyTasks(s, id) { const t = s.trips[id], j = s.journeys?.items[id]; if (!j)
    return { known: false, preparationDone: 0, preparationTotal: 0, serviceDone: 0, serviceTotal: 0, airline: 0, support: 0, done: 0, total: 0, pending: [] }; const tasks = preparationTasks(s, id).filter(x => x.personId === s.actorId || !!t && D.permitted(s, t.familyId, x.personId, 'care:view')); const requests = Object.values(s.requests).filter(r => r.tripId === id && r.tripVersion === j.version && !r.supersededBy && !r.withdrawnAt && D.permitted(s, r.familyId, r.personId, 'service') && !j.segments.find(seg => seg.id === r.segmentId)?.completed); return { preparationDone: tasks.filter(x => x.status === 'done').length, preparationTotal: tasks.length, serviceDone: requests.filter(r => serviceState(s, r).confirmed).length, serviceTotal: requests.length, airline: requests.filter(r => serviceState(s, r).owner === 'airline').length, support: requests.filter(r => serviceState(s, r).owner === 'support').length, known: tasks.length + requests.length > 0, done: tasks.filter(x => x.status === 'done').length + requests.filter(x => x.progress === 'confirmed').length, total: tasks.length + requests.length, pending: [...tasks.filter(x => x.status !== 'done').map(x => x.title), ...requests.filter(x => serviceState(s, x).owner === 'user').map(x => serviceName(s, x) + '：' + serviceState(s, x).next)] }; }
