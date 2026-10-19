import { airport } from '/assets/ee1ad71b9a14d41f146c/web/travel.js';
/** Resolve a local airport wall time. Reject DST gaps and ambiguous folds. */
export function localDeparture(day, time, code, providerZone) {
    const zone = providerZone ?? airport(code)?.zone;
    if (!zone || !/^\d{4}-\d{2}-\d{2}$/.test(day) || !/^\d{2}:\d{2}$/.test(time))
        throw Error('請填寫完整日期與當地時間。');
    const wall = Date.parse(day + 'T' + time + ':00Z');
    if (!Number.isFinite(wall) || new Date(wall).toISOString().slice(0, 16) !== day + 'T' + time)
        throw Error('日期或時間無效。');
    const format = new Intl.DateTimeFormat('en-GB', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
    const local = (utc) => { const p = Object.fromEntries(format.formatToParts(utc).map(x => [x.type, x.value])); return Date.parse(`${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:00Z`); };
    let utc = wall;
    for (let i = 0; i < 4; i++)
        utc += wall - local(utc);
    if (local(utc) !== wall)
        throw Error('此當地時間不存在，請核對夏令時間與日期。');
    if (local(utc - 3600000) === wall || local(utc + 3600000) === wall)
        throw Error('此時間位於夏令時間重複時段，請改用可明確核對的時間。');
    return new Date(utc).toISOString();
}
export const addDays = (day, n) => new Date(Date.parse(day + 'T12:00:00Z') + n * 86400000).toISOString().slice(0, 10);
export function localParts(iso, zone) { const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(iso)).map(x => [x.type, x.value])); return { day: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}` }; }
