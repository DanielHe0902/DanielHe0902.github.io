import { apiFetch } from '/assets/5c5eb8250e82e8e3ffd2/api.js';
import { CALENDAR_LIMITS, CALENDAR_PARSER, calendarDate, sniffCalendar, decodeCalendarText, parseCalendarDat, validateCalendarResult } from '/assets/5c5eb8250e82e8e3ffd2/web/calendar-contract.js';
export const importFields = { teaching: 'start', exam: 'exam', holiday: 'holiday', dorm: 'dorm', graduation: 'graduation' };
export function calendarPatch(result) { const events = result.events.filter(e => e.scope === result.scope && calendarDate(e.start) && !e.issue), patch = {}; if (result.school && result.schoolEvidence)
    patch.school = result.school; for (const [kind, field] of Object.entries(importFields)) {
    const matches = events.filter(e => e.kind === kind).sort((a, b) => a.start.localeCompare(b.start));
    if (matches[0])
        patch[field] = matches[0].start;
    if (kind === 'holiday' && matches[0])
        patch.holidayEnd = matches[0].end;
} return patch; }
export function mergeCalendar(p, result) { const next = structuredClone(p), patch = calendarPatch(result); for (const [key, value] of Object.entries(patch)) {
    const old = String(p[key] ?? '');
    if (!old || old === value || result.choices[key] === 'file')
        next[key] = value;
} next.calendarImport = structuredClone(result); next.calendarConfirmed = false; next.saved = false; next.selected = null; return next; }
export function validateCalendarPlan(p) { if (!p.school.trim())
    throw Error('請填寫並核對學校名稱。'); if (!calendarDate(p.start))
    throw Error('請核對有效的開學日期。'); for (const key of ['exam', 'holiday', 'holidayEnd', 'graduation', 'dorm', 'departure', 'visa'])
    if (p[key] && !calendarDate(p[key]))
        throw Error(key + ' 日期無效。'); if (p.holiday && p.holidayEnd && p.holidayEnd < p.holiday)
    throw Error('假期結束早於開始，請核對。'); if (p.exam && p.exam < p.start || p.graduation && p.graduation < p.start)
    throw Error('考試或畢業日期早於開學，請核對適用學期。'); if (p.calendarImport) {
    const r = p.calendarImport;
    if (Object.entries(calendarPatch(r)).some(([key, value]) => String(p[key] ?? '') !== value && r.choices[key] !== 'existing'))
        throw Error('請先選擇如何處理日期差異。');
    if (!r.reviewed || !r.scope || r.events.filter(e => e.scope === r.scope).some(e => e.issue || !calendarDate(e.start) || !calendarDate(e.end) || e.end < e.start))
        throw Error('請先核對檔案中的日期、適用學期及差異。');
} return true; }
const cache = new Map();
export function clearCalendarCache() { cache.clear(); }
async function jpegPage(bytes, signal) {
    // Read SOF dimensions before decoding; reject large resources rather than allocating them.
    let width = 0, height = 0;
    for (let i = 2; i < bytes.length - 9;) {
        if (bytes[i] !== 255) {
            i++;
            continue;
        }
        const marker = bytes[i + 1];
        if (marker === 217 || marker === 218)
            break;
        const length = (bytes[i + 2] << 8) + bytes[i + 3];
        if (length < 2)
            break;
        if ([192, 193, 194, 195, 197, 198, 199, 201, 202, 203, 205, 206, 207].includes(marker)) {
            height = (bytes[i + 5] << 8) + bytes[i + 6];
            width = (bytes[i + 7] << 8) + bytes[i + 8];
            break;
        }
        i += length + 2;
    }
    if (!width || !height || width * height > CALENDAR_LIMITS.pixels || Math.max(width, height) > 8192)
        throw Error('圖片尺寸無效或過大；請使用 16 百萬像素以內的 JPG。');
    signal.throwIfAborted();
    const bitmap = await createImageBitmap(new Blob([bytes], { type: 'image/jpeg' }), { imageOrientation: 'from-image' });
    try {
        const scale = Math.min(1, Math.sqrt(CALENDAR_LIMITS.renderPixels / (bitmap.width * bitmap.height))), canvas = document.createElement('canvas');
        canvas.width = Math.round(bitmap.width * scale);
        canvas.height = Math.round(bitmap.height * scale);
        canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        const image = canvas.toDataURL('image/jpeg', 0.86);
        canvas.width = canvas.height = 0;
        if (image.length > 1500000)
            throw Error('圖片過大，請縮小後重試。');
        return { page: 1, text: '', image };
    }
    finally {
        bitmap.close();
    }
}
export async function importCalendarFile(file, context, signal, status) {
    status('讀取檔案');
    if (file.size > CALENDAR_LIMITS.bytes)
        throw Error('檔案超過 5 MB，請按學期拆分。');
    const bytes = new Uint8Array(await file.arrayBuffer());
    signal.throwIfAborted();
    const format = sniffCalendar(bytes, file.name), fingerprint = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))).map(x => x.toString(16).padStart(2, '0')).join(''), key = context.accountId + ':' + fingerprint, id = crypto.randomUUID();
    const hit = cache.get(key);
    if (hit)
        return { ...structuredClone(hit), filename: file.name, id, ...context, choices: {}, scope: [...new Set(hit.events.map(e => e.scope))].length === 1 ? hit.events[0].scope : '', reviewed: false };
    status('整理校曆');
    let pages, raw;
    if (format === 'pdf') {
        const { readCalendarPdf } = await import('/assets/5c5eb8250e82e8e3ffd2/web/pdf-reader.js');
        pages = await readCalendarPdf(bytes, signal);
    }
    else if (format === 'jpeg')
        pages = [await jpegPage(bytes, signal)];
    else {
        const text = decodeCalendarText(bytes);
        raw = parseCalendarDat(text);
        pages = [{ page: 1, text: raw?.canonicalText ?? text.replace(/\r?\n[ \t]/g, '') }];
    }
    signal.throwIfAborted();
    if (!raw) {
        const response = await apiFetch('/api/calendar/import', { method: 'POST', credentials: 'same-origin', signal, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ importSessionId: id, pages }) });
        const result = await response.json();
        if (!response.ok)
            throw Error(result.error ?? '校曆識別暫時不可用。');
        if (result.importSessionId !== id)
            throw Error('校曆回覆已過期。');
        raw = result;
    }
    const parsed = validateCalendarResult(raw, pages);
    signal.throwIfAborted();
    status('填入可核對欄位');
    const result = { fingerprint, filename: file.name, format, parser: CALENDAR_PARSER, ...parsed };
    cache.set(key, structuredClone(result));
    if (cache.size > 4)
        cache.delete(cache.keys().next().value);
    return { ...result, id, ...context, choices: {}, scope: [...new Set(parsed.events.map((e) => e.scope))].length === 1 ? parsed.events[0].scope : '', reviewed: false };
}
