import { profileForAssessment } from '/assets/b53849a26298fd713aba/care-registry.js';
import { planCareForm } from '/assets/b53849a26298fd713aba/plan-care.js';
import { assess } from '/assets/b53849a26298fd713aba/domain.js';
import { flightLabel } from '/assets/b53849a26298fd713aba/passport-visual.js';
import { displayName } from '/assets/b53849a26298fd713aba/identity.js';
import { esc } from '/assets/b53849a26298fd713aba/ui.js';
import { offerCards } from '/assets/b53849a26298fd713aba/flight-service.js';
import { bookingMissing, caregiverChoices, visibleBookingCare } from '/assets/b53849a26298fd713aba/booking.js';
import { SERVICE_LABELS } from '/assets/b53849a26298fd713aba/config.js';
export function bookingPanel(s, p) {
    const b = p.booking;
    const period = { any: '不限時段', morning: '上午 06:00–11:59', afternoon: '下午 12:00–17:59', evening: '晚上 18:00–23:59' }[p.departurePeriod ?? 'any'];
    const summary = '<div class="booking-conditions"><strong>' + esc(p.origin || '出發地待定') + ' → ' + esc(p.destination || '目的地待定') + '</strong><span>' + esc(p.start || '日期待定') + (p.end ? ' — ' + esc(p.end) : ' · 單程') + '</span><span>' + (b.travelersConfirmed ? p.travelerIds.length + ' 位旅客' : '同行待確認') + ' · ' + (b.cabinConfirmed ? (p.cabin === 'business' ? '商務艙' : '經濟艙') : '艙等待確認') + ' · ' + period + '</span></div><details class="booking-people"><summary>實際同行成員' + (p.travelerIds.length ? '（' + p.travelerIds.length + ' 位）' : '') + '</summary><p>' + p.travelerIds.map(id => esc(displayName(s.persons[id]))).join('、') + '</p></details>';
    const missing = bookingMissing(p);
    const busy = p.providerLoading || b.phase === 'saving';
    let body = '';
    if (!p.selectedFlight) {
        body = missing.length ? '<p class="booking-next">還需確認：' + missing.join('、') + '。直接告訴小期即可。</p>' : offerCards(p);
        if (!b.travelersConfirmed && b.explicitCount && p.familyId)
            body += '<fieldset class="booking-member-choices"><legend>請選擇本次同行的 ' + b.explicitCount + ' 位成員</legend>' + p.travelerIds.map(id => '<label class="check"><input type="checkbox" data-booking-member="' + esc(id) + '">' + esc(displayName(s.persons[id])) + '</label>').join('') + '<button class="button secondary" data-booking-members-confirm>確認同行成員</button></fieldset>';
    }
    else {
        const f = p.selectedFlight.outbound, c = b.care, back = p.selectedFlight.inbound, total = f.total === null || back?.total === null ? null : f.total + (back?.total ?? 0);
        body = '<section class="booking-preview" data-booking-preview="' + (c?.confirmed ? 'final' : 'initial') + '" tabindex="-1"><div class="section-title"><h3>' + (c?.confirmed ? '最後核對，準備儲存' : '已選航班 · 行程預覽') + '</h3></div>' + [...f.legs, ...(back?.legs ?? [])].map(l => '<div class="booking-flight"><div><strong>' + esc(flightLabel(l.flight)) + '</strong><p>' + esc(l.departureLocal.day) + ' · ' + esc(l.from) + ' → ' + esc(l.to) + '</p></div><div class="booking-times"><strong>' + esc(l.departureLocal.time) + ' → ' + esc(l.arrivalLocal?.time ?? '待核實') + '</strong><span>出發／抵達地當地時間</span></div></div>').join('') + '<div class="booking-facts"><p><span>全體旅客參考總價</span><strong>' + (total === null ? '價格待確認' : 'HKD ' + total.toLocaleString('en-US')) + '</strong></p><p><span>託運行李</span><strong>' + (f.includedBags === null ? '待確認' : '每人 ' + f.includedBags + ' 件') + '</strong></p><p><span>同行旅客</span><strong>' + p.travelerIds.length + ' 位 · ' + (p.cabin === 'business' ? '商務艙' : '經濟艙') + '</strong></p></div>';
        body += '<div class="booking-imported-care"><h4>本次照護需求</h4>' + Object.entries(p.careNeeds ?? {}).flatMap(([pid, kinds]) => kinds.map(k => { const pair = s.relationships.find(r => r.familyId === p.familyId && r.dependentId === pid && p.travelerIds.includes(r.caregiverId)), profile = s.profiles[p.familyId + ':' + pid], a = profile ? assess(profileForAssessment(s, profile, p.start), k, f.legs[0].aircraft, s.demoClock, f.legs[0].operator) : null; return '<p>' + esc(displayName(s.persons[pid])) + ' · ' + esc(SERVICE_LABELS[k]) + (k === 'adjacent' && pair ? ' · 照護者 ' + esc(displayName(s.persons[pair.caregiverId])) : '') + (a?.applicability === 'unavailable' ? ' · 此機型無法提供' : a?.missing.length ? ' · 需核對 ' + esc(a.missing.join('、')) : ' · 資料已記錄，服務待確認') + '</p>'; })).join('') + '<p class="field-hint">來自已授權家庭檔案；本次對話修改優先，長期檔案保持原狀。</p><details><summary>修改本次需求</summary>' + planCareForm(s, p) + '</details></div>';
        for (const saved of Object.values(b.careSaved ?? {}).filter(x => x.personId !== c?.personId))
            body += '<p class="booking-care-summary"><strong>' + esc(displayName(s.persons[saved.personId])) + '</strong> · ' + saved.kinds.map(k => esc(SERVICE_LABELS[k])).join('、') + (saved.caregiverId ? ' · 照護者 ' + esc(displayName(s.persons[saved.caregiverId])) : '') + '</p>';
        if (c) {
            body += '<section class="booking-care" data-booking-care><h4>' + esc(displayName(s.persons[c.personId])) + '的本次照護安排</h4><p>' + c.kinds.map(k => esc(SERVICE_LABELS[k])).join('、') + '</p>';
            if (c.kinds.includes('adjacent'))
                body += '<label class="field"><span>同行照護者</span><select data-booking-caregiver ' + (c.confirmed ? 'disabled' : '') + '><option value="">選擇本次同行照護者</option>' + caregiverChoices(s, p, c.personId).map(id => '<option value="' + id + '" ' + (id === c.caregiverId ? 'selected' : '') + '>' + esc(displayName(s.persons[id])) + '</option>').join('') + '</select></label>';
            body += c.layoutKnown && Object.keys(c.seats).length ? '<div class="booking-seat-candidates"><strong>鄰座安排 · 待確認</strong><ul>' + Object.entries(c.seats).map(([id, seat]) => '<li><span>' + esc(displayName(s.persons[id])) + '</span><strong>' + esc(seat) + '</strong></li>').join('') + '</ul><p class="field-hint">按同排、同側核對相鄰，並保留其他必要照護關係。</p></div>' : '<p class="field-hint">相鄰需求已保留；座位號碼及機艙安排待核實。</p>';
            body += c.confirmed ? '<p class="notice">已同步家庭照護 · 本次規劃中的安排／行程待儲存。航空公司服務仍待確認。</p>' : '<p class="field-hint">確認後只同步本次規劃需求，不改長期健康檔案、不提交航空公司服務。</p><button class="button" data-booking-confirm-care ' + (busy || c.kinds.includes('adjacent') && !c.caregiverId ? 'disabled' : '') + '>確認安排</button>';
            body += '</section>';
        }
        body += '<p class="booking-next">' + (c && !c.confirmed ? '核對以上安排，確認後會更新行程預覽。' : '還有其他需要照顧的地方嗎？可以直接告訴小期。') + '</p><div class="button-row">' + (!c || c.confirmed ? '<button class="button" data-booking-save ' + (busy ? 'disabled' : '') + '>' + (b.phase === 'saving' ? '正在儲存…' : '只儲存行程') + '</button>' + (Object.values(p.careNeeds ?? {}).some(k => k.length) ? '<button class="button" data-booking-save data-submit-services ' + (busy ? 'disabled' : '') + '>確認行程並提交服務</button><p class="field-hint">同意使用以上旅客及照護資料提交服務；輪椅事項建立跟進個案；超過期限或適用性衝突的項目保留待核實，缺項待補。服務須待結果確認。</p>' : '') : '') + '<button class="text-link" data-booking-change-flight ' + (busy ? 'disabled' : '') + '>更換航班</button><button class="text-link" data-booking-add-needs>繼續補充需求</button></div></section>';
    }
    return '<section class="conversational-booking" data-booking-phase="' + b.phase + '" data-booking-id="' + p.id + '" data-query-revision="' + b.queryRevision + '">' + summary + (b.error ? '<p role="alert" class="notice warning">' + esc(b.error) + '</p>' : '') + body + '<div class="booking-secondary"><button class="text-link" data-booking-manual>手動修改條件</button><button class="text-link" data-booking-cancel>取消本次規劃</button></div></section>';
}
export function bookingCareRecords(s, pid) {
    const rows = visibleBookingCare(s, pid);
    return rows.length ? '<section class="panel booking-care-records"><h3>本次旅程照護安排</h3>' + rows.map(r => '<article data-booking-care-record="' + esc(r.id) + '"><h4>' + esc(displayName(s.persons[r.personId])) + '</h4><p>' + r.needs.map(k => esc(SERVICE_LABELS[k])).join('、') + (r.caregiverId ? ' · 照護者 ' + esc(displayName(s.persons[r.caregiverId])) : '') + '</p><p>' + esc(s.booking?.sessions[r.draftId]?.title ?? '本次規劃') + ' · ' + (r.status === 'planning' ? '本次規劃中的安排／行程待儲存' : '已連結本次行程／服務待確認') + '</p></article>').join('') + '</section>' : '';
}
