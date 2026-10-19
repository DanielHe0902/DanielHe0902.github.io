import { flightLabel } from '/assets/8ff1587e8661fef5dadb/passport-visual.js';
import { SERVICE_LABELS } from '/assets/8ff1587e8661fef5dadb/config.js';
import { displayName } from '/assets/8ff1587e8661fef5dadb/identity.js';
// These are recognized application-generated labels, never user messages or notes.
export function generatedTripTitle(j) {
    const names = { 'demo-history-202607-tokyo': '東京夏日家庭旅行', 'demo-history-202609-taipei': '台北週末家庭旅行' };
    return j.historicalExample && names[j.id] && j.title === names[j.id] + ' · 已完成示例' ? names[j.id] : j.title ?? '我的旅程';
}
export function assistantTemplate(text) {
    const found = text.match(/^(?:已)?找到 (\d+) 組(?:符合目前條件的)?內置示例航班。[\s\S]*$/);
    if (found)
        return '已找到 ' + found[1] + ' 個符合條件的航班選項。請選擇航班，再核對並儲存行程。';
    const known = { '這些是目前有效的演示旅行靈感。選一張「一起規劃」，目的地會帶入草稿；日期和同行仍由你決定。': '選一個目的地開始規劃；日期和同行由你決定。', '真实模型连接未完成，已降级为演示助手；以下仅使用已知本地状态。': '小期暫時無法連線，我會先用目前資料幫你定位下一步。' };
    return known[text] ?? text;
}
export function bookingNotice(s, n) {
    if (n.kind !== 'booking')
        return { title: n.title ?? '本站消息', text: n.text };
    const p = s.booking?.sessions[n.tripId ?? ''];
    if (!p?.booking?.savedTripId)
        return { title: n.title === '行程已儲存 · 模擬預訂完成' ? '行程已儲存' : n.title ?? '行程已儲存', text: n.text };
    const care = { ...p.booking.careSaved, ...(p.booking.care ? { [p.booking.care.personId]: p.booking.care } : {}) };
    return { title: '行程已儲存', text: p.start + (p.end ? ' — ' + p.end : '') + ' · ' + p.origin + ' → ' + p.destination + ' · ' + p.travelerIds.length + ' 位旅客 · ' + (p.cabin === 'business' ? '商務艙' : '經濟艙') + ' · ' + p.selectedFlight?.outbound.legs.map(l => flightLabel(l.flight)).join('、') + (Object.keys(care).length ? '；' + Object.values(care).map(c => displayName(s.persons[c.personId]) + '的' + c.kinds.map(k => SERVICE_LABELS[k]).join('、')).join('；') + '已記錄。服務待確認。' : '。') + '你可以在出行準備中查看後續進度。' };
}
export const schoolLabel = (value) => ({
    '倫敦示例大學 · 2027 春季（虛構校曆）': '倫敦學期計劃 · 2027 春季',
    '伦敦示例大学 · 演示校历': '倫敦學期計劃 · 2027 秋季',
    '东京示例学院 · 演示校历': '東京學期計劃',
    '悉尼示例大学 · 演示校历': '悉尼學期計劃',
    '伦敦有期示例大学（模拟院校）': '倫敦學期計劃'
}[value] ?? value);
// Answer capability questions explicitly, without interrupting an active draft.
export function capabilityAnswer(text) {
    const q = text.normalize("NFKC");
    if (/(是否|真的|真實|真实|已經|已经|有沒有|有没有|會不會|会不会|有否).{0,12}(出票|訂票|订票|鎖位|锁位|扣款)|(出票|鎖位|锁位|扣款).{0,8}(了嗎|了吗|成功|真實|真实)/.test(q))
        return "目前儲存的是行程規劃，沒有出票、鎖位或扣款。正式預訂需要向航空公司完成。";
    if (/(資料|数据|數據|航班|價格|价格).{0,12}(來源|来源|真實|真实|即時|实时)|(來源|来源).{0,8}(哪|什麼|什么)/.test(q))
        return "航班選項來自內置參考目錄，價格與容量不是即時航空公司庫存。小期使用已連接的模型協助整理條件。";
    if (/(輪椅|轮椅|服務|服务|座位).{0,12}(真的|是否|已經|已经|確認了嗎|确认了吗).{0,8}(確認|确认|安排|成功)?/.test(q))
        return "記錄需求不代表航空公司已確認服務。請在出行準備中核對每項服務的狀態，以相應回執為準。";
    return null;
}
// Legacy application audit strings remain stored verbatim.
export const serviceHistoryLabel = (value) => ({ "已发送模拟申请，等待受理回执": "需求已提交，等待處理結果", "模拟受理成功，尚未批准服务": "需求已受理，服務仍待確認", "模拟发送失败，可重试原申请": "提交失敗，可重試原申請", "已授权创建模拟人工工单；不代表服务获批": "已保存人工跟進紀錄；服務仍待確認", "模拟业务确认：仅适用于此成员、航段与行程版本": "服務結果確認：仅适用于此成员、航段与行程版本" }[value] ?? value);
