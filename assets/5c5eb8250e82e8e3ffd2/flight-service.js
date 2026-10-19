import { apiFetch } from '/assets/5c5eb8250e82e8e3ffd2/api.js';
import { flightLabel } from '/assets/5c5eb8250e82e8e3ffd2/passport-visual.js';
import { EXAMPLE_VERSION } from '/assets/5c5eb8250e82e8e3ffd2/web/example-flights.js';
import { criteriaFor, criteriaKey, searchFlights } from '/assets/5c5eb8250e82e8e3ffd2/flights.js';
import { localDeparture } from '/assets/5c5eb8250e82e8e3ffd2/flight-time.js';
import { esc } from '/assets/5c5eb8250e82e8e3ffd2/ui.js';
export const connection = { model: 'not_configured', flights: 'not_configured', environment: '', operations: 'not_connected' };
export async function loadConnections() { try {
    const r = await apiFetch('/api/planning/status');
    if (!r.ok)
        return;
    const c = await r.json();
    connection.model = c.model.state;
    connection.flights = c.flights.state;
    connection.environment = c.flights.environment ?? '';
}
catch { /* Explicit unavailable defaults. */ } }
const errors = { model_not_configured: '模型尚未連接，可使用現有表單與照護引導。', flights_not_configured: '航班暫時無法載入，可以先保存旅行想法。', invalid_query: '請補齊有效機場、今天起一年內的日期、旅客及艙等。', departure_date_past: '出發日期已早於出發地今天，請修改日期。', permission_denied: '供應商帳戶沒有這項查詢權限。', invalid_key: '服務憑證無效或已撤銷，請聯絡網站擁有者。', quota_exceeded: '供應商額度不足，請聯絡網站擁有者。', rate_limited: '查詢較頻繁，請稍後再試。', daily_limit: '今日查詢上限已用完，請明日再試。', cost_guard_unavailable: '模型服務暫時無法使用，請稍後再試。', timeout: '供應商回應逾時，請稍後手動重試。', offer_expired: '參考選擇已過期，請重新查詢並核對時刻。', offer_context_expired: '查詢已過期或帳戶已切換，請重新查詢。', offer_not_in_results: '這份參考不屬於目前查詢，請重新選擇。' };
export async function planningAPI(action, input, signal) {
    const c = new AbortController(), abort = () => c.abort(), timer = setTimeout(abort, 155000);
    signal?.addEventListener('abort', abort, { once: true });
    if (signal?.aborted)
        abort();
    try {
        const r = await apiFetch('/api/planning/' + action, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input), signal: c.signal });
        const x = await r.json();
        if (!r.ok)
            throw Object.assign(Error(errors[x.error] ?? '查詢暫時失敗；沒有產生航班或票價，請稍後重試。'), { code: x.error });
        if (x.requestId !== input.requestId || x.account !== input.account || x.conversation !== input.conversation || x.revision !== input.revision)
            throw Error('回覆已失效，請重新查詢。');
        return x;
    }
    finally {
        clearTimeout(timer);
        signal?.removeEventListener('abort', abort);
    }
}
export function offerQuery(s, p) {
    p.lapInfantIds = p.travelerIds.filter(id => s.persons[id] && new Date(p.start).getUTCFullYear() - Number(s.persons[id].dob.slice(0, 4)) - (p.start.slice(5) < s.persons[id].dob.slice(5) ? 1 : 0) < 2);
    const passengers = p.travelerIds.map(id => { const dob = s.persons[id]?.dob; if (!dob)
        throw Error('請先核對每位同行旅客的年齡類別。'); const age = new Date(p.start).getUTCFullYear() - Number(dob.slice(0, 4)) - (p.start.slice(5) < dob.slice(5) ? 1 : 0); if (!Number.isFinite(age) || age < 0)
        throw Error('請先核對旅客年齡與出發日期。'); return age >= 18 ? { type: 'adult' } : { type: age < 2 ? 'infant_without_seat' : 'child', age }; });
    return { ...(p.booking ? { requireKnownCapacity: true } : {}), origin: p.origin, destination: p.destination, outboundDate: p.start, returnDate: p.travelType === 'oneway' ? '' : p.end, passengers, cabin: p.cabin ?? 'economy', cathayOnly: !!p.cathayOnly, directOnly: !!p.directOnly, budget: p.budget, bags: p.bags ?? 1, flexible: !!p.flexible, departurePeriod: p.departurePeriod ?? 'any' };
}
export function offerCards(p) {
    const result = p.providerSearch;
    if (p.providerLoading)
        return '<p role="status" class="notice">正在整理航班…</p>';
    if (p.providerError)
        return '<p role="alert" class="notice warning">' + esc(p.providerError) + '</p><button type="button" class="text-link" data-flight-search>重新查詢</button>';
    if (!result)
        return '';
    const period = { any: '不限出發時段', morning: '上午 06:00–11:59', afternoon: '下午 12:00–17:59', evening: '晚上 18:00–23:59' }[result.query.departurePeriod ?? 'any'];
    const heading = '<div class="section-title"><h4>航班選項 · ' + result.offers.length + ' 個結果</h4><span class="meta">' + esc(period) + ' · 出發地當地時間</span></div>';
    return '<section class="provider-offers" data-provider-offers tabindex="-1">' + heading + (result.message ? '<p class="field-hint">' + esc(result.message) + '</p>' : '') + result.offers.map(o => {
        const chosen = p.providerSelection?.offerId === o.offerId, missing = o.slices.some(x => x.segments.some(l => !l.arrivingAt));
        const summary = o.slices.map((slice, i) => { const first = slice.segments[0], last = slice.segments.at(-1); return '<div class="offer-route-summary"><span class="offer-direction">' + (i ? '回程' : '去程') + '</span><div><strong>' + esc(first.departingAt.slice(11, 16)) + '</strong><span>' + esc(first.from) + ' · ' + esc(first.departingAt.slice(0, 10)) + '</span></div><span class="offer-connection">' + (slice.segments.length === 1 ? '直飛' : (slice.segments.length - 1) + ' 次轉機') + ' →</span><div><strong>' + esc(last.arrivingAt?.slice(11, 16) ?? '待確認') + '</strong><span>' + esc(last.to) + ' · ' + esc(last.arrivingAt?.slice(0, 10) ?? '日期待確認') + '</span></div></div><p class="offer-flight-name">' + slice.segments.map(l => esc(flightLabel((l.marketingCarrier.code ?? '') + (l.flightNumber ?? '')))).join(' · ') + '</p>'; }).join('');
        const details = o.slices.map((slice, i) => '<h5>' + (i ? '回程' : '去程') + '詳情</h5>' + slice.segments.map(l => '<div class="provider-segment"><p>' + esc(flightLabel((l.marketingCarrier.code ?? '') + (l.flightNumber ?? ''))) + ' · ' + esc(l.from) + ' ' + esc(l.departingAt.replace('T', ' ').slice(0, 16)) + ' → ' + esc(l.to) + ' ' + esc(l.arrivingAt?.replace('T', ' ').slice(0, 16) ?? '抵達時間待確認') + '</p><p class="field-hint">當地時區：' + esc(l.departureZone ?? '') + ' → ' + esc(l.arrivalZone ?? '') + '<br>適用日期：' + esc(l.reference.sourcePeriod) + (l.reference.url ? ' · <a href="' + esc(l.reference.url) + '" target="_blank" rel="noopener noreferrer">原時刻來源 ↗</a>' : '') + '</p></div>').join('') + '<p class="field-hint">' + (slice.price?.includedBags != null ? '每人託運 ' + slice.price.includedBags + ' 件；加購 HKD ' + slice.price.baggageCost : '行李額待確認') + '</p>').join('');
        return '<article class="flight-option provider-offer-compact ' + (chosen ? 'selected' : '') + '" data-provider-offer="' + esc(o.offerId) + '" ' + (chosen ? 'data-selected-flight' : '') + '>' + summary + '<div class="offer-choice-row"><div class="flight-price"><strong>' + (o.total === null ? '價格待確認' : 'HKD ' + Number(o.total).toLocaleString('en-US')) + '</strong><span>參考總價 · ' + o.travelerCount + ' 位 · ' + (result.query.cabin === 'business' ? '商務艙' : '經濟艙') + '</span></div><button type="button" class="button ' + (chosen ? 'secondary' : '') + '" data-provider-select="' + esc(o.offerId) + '" ' + (missing ? 'disabled' : '') + '>' + (chosen ? '已選擇 · 重新核對' : '選擇此航班') + '</button></div><details class="offer-details"><summary>航段、行李與資料來源</summary>' + details + '<p class="field-hint">票規與座位安排待確認。</p></details></article>';
    }).join('') + '</section>';
}
export function snapshotFromOffer(p, o) {
    if (o.travelerCount !== p.travelerIds.length)
        throw Error('查詢與草稿的實際同行人數不符，請重新查詢。');
    if (o.slices.length !== (p.end ? 2 : 1))
        throw Error('單程／往返條件已改變，請重新查詢。');
    if (!o.expiresAt || !Number.isFinite(Date.parse(o.expiresAt)) || Date.parse(o.expiresAt) <= Date.now())
        throw Error('出發日期已過，請選擇未來航班。');
    const fresh = searchFlights(criteriaFor(p));
    const option = (index) => { const slice = o.slices[index], expected = fresh[index ? 'inbound' : 'outbound'].find(x => x.id === slice.catalogId + ':' + (index ? p.end : p.start) + ':' + (p.cabin ?? 'economy')); if (o.catalogVersion !== EXAMPLE_VERSION || !expected || slice.segments.length !== expected.legs.length)
        throw Error('航班資料或條件已變更，請重新查詢。'); for (const [n, l] of slice.segments.entries()) {
        const e = expected.legs[n];
        if (l.operatingCarrier.code !== e.operator || !l.arrivingAt || l.from !== e.from || l.to !== e.to || (l.marketingCarrier.code ?? '') + (l.flightNumber ?? '') !== e.flight || localDeparture(l.departingAt.slice(0, 10), l.departingAt.slice(11, 16), l.from, l.departureZone ?? '') !== e.departure || localDeparture(l.arrivingAt.slice(0, 10), l.arrivingAt.slice(11, 16), l.to, l.arrivalZone ?? '') !== e.arrival || (l.aircraft ?? '待確認') !== e.aircraft)
            throw Error('航班快照與內置目錄不符，請重新查詢。');
    } for (const k of ['fare', 'tax', 'total', 'includedBags', 'baggageCost', 'capacity', 'changeFee'])
        if (slice.price?.[k] !== expected[k])
            throw Error('價格或條件已變更，請重新查詢。'); return structuredClone(expected); };
    const criteria = criteriaFor(p);
    return { criteria, criteriaKey: criteriaKey(criteria), outbound: option(0), ...(p.end ? { inbound: option(1) } : {}), queryAt: o.fetchedAt, validUntil: o.expiresAt, catalogVersion: o.catalogVersion ?? EXAMPLE_VERSION, selectedAt: new Date().toISOString(), source: '內置示例航班 · 價格及容量為演示資料', providerOffer: o };
}
