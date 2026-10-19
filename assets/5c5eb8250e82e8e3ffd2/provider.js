import { loadConnections, connection } from '/assets/5c5eb8250e82e8e3ffd2/flight-service.js';
import { apiFetch } from '/assets/5c5eb8250e82e8e3ffd2/api.js';
import { validCareProposal } from '/assets/5c5eb8250e82e8e3ffd2/web/assistant-contract.js';
import { guideIntent } from '/assets/5c5eb8250e82e8e3ffd2/guide.js';
export const INTENTS = ['student', 'care', 'preparation', 'recovery', 'passport', 'fund', 'rules', 'unknown', 'open_current_journey', 'explain_transfer_next_step', 'evaluate_transfer_activity', 'explain_gate_change', 'check_arrival_connection', 'open_campus_transport', 'prepare_arrival_contact', 'review_post_trip', 'open_trip_passport_record'];
export const TOOL_REGISTRY = { read_identity: { write: false }, read_trip: { write: false }, read_preparation: { write: false }, read_transfer: { write: false }, read_arrival: { write: false }, read_alternatives: { write: false }, read_posttrip: { write: false }, navigate_registered: { write: false }, save_care: { write: true }, save_student: { write: true }, submit_mock_service: { write: true }, create_contact_draft: { write: true }, confirm_school_arrival: { write: true }, share_arrival: { write: true }, submit_feedback: { write: true }, claim_reward: { write: true }, generate_share: { write: true } };
export function validateToolRequest(x, id) { if (!x || typeof x !== 'object')
    return false; const o = x; return (o.care === undefined || validCareProposal(o.care)) && o.requestId === id && INTENTS.includes(o.intent) && (!o.slots || typeof o.slots === 'object' && Object.keys(o.slots).every(k => ['service', 'school', 'start'].includes(k)) && (!o.slots.service || ['wheelchair', 'bassinet'].includes(o.slots.service)) && (!o.slots.school || typeof o.slots.school === 'string' && o.slots.school.length <= 80) && (!o.slots.start || /^20\d{2}-\d{2}-\d{2}$/.test(o.slots.start))) && (o.cancel === undefined || typeof o.cancel === 'boolean') && (!o.message || typeof o.message === 'string' && o.message.length <= 600) && Object.keys(o).every(k => ['requestId', 'intent', 'slots', 'cancel', 'message', 'care'].includes(k)); }
export class MockAssistantProvider {
    async understand(i) {
        if (i.signal?.aborted)
            throw new DOMException('Aborted', 'AbortError');
        const text = i.text;
        if (/不需要|先别|先不要|不要申请|不用.*轮椅|取消这项|暂停申请/.test(text))
            return { requestId: i.requestId, intent: 'unknown', cancel: true, message: '已停止这次引导，不修改已保存需求，也不提交申请。如需删除原有需求，请打开对应档案核对后保存。' };
        let intent = /里数.*到账|支持.*里数|准备进度|还缺.*准备|没办妥/.test(text) ? (/里数|支持/.test(text) ? 'fund' : 'preparation') : /吃|用餐|吃饭/.test(text) ? 'evaluate_transfer_activity' : /接机.*(赶|来得及|影响|调整)|晚点|抵达.*推迟/.test(text) ? 'check_arrival_connection' : /联系.*(学校|宿舍)|草稿/.test(text) ? 'prepare_arrival_contact' : /宿舍|到校|落地.*怎么|机场.*学校/.test(text) ? 'open_campus_transport' : /登机口.*(改|变)/.test(text) ? 'explain_gate_change' : /转机|现在去哪|接下来去哪/.test(text) ? 'explain_transfer_next_step' : /旅后|报平安|反馈|这次旅行.*处理|餐食.*(没|问题)|餐.*没有安排/.test(text) ? 'review_post_trip' : /本次.*(护照|飞行记录)/.test(text) ? 'open_trip_passport_record' : /行程助手|当前行程/.test(text) ? 'open_current_journey' : guideIntent(text);
        if (/另一个家庭|不是.*是|是妈妈不是外婆/.test(text) && i.previous)
            intent = i.previous.intent;
        const slots = {};
        if (intent === 'care') {
            if (/婴儿篮|摇篮/.test(text) && !/轮椅/.test(text))
                slots.service = 'bassinet';
            else if (/轮椅/.test(text) && !/婴儿篮|摇篮/.test(text))
                slots.service = 'wheelchair';
            else if (i.previous?.service === 'wheelchair' || i.previous?.service === 'bassinet')
                slots.service = i.previous.service;
        }
        const date = text.match(/\b(20\d{2}-\d{2}-\d{2})\b/)?.[1];
        if (date && Number.isFinite(Date.parse(date)) && new Date(date).toISOString().slice(0, 10) === date)
            slots.start = date;
        return { requestId: i.requestId, intent, slots };
    }
}
export class ApiAssistantProvider {
    fetcher;
    timeout;
    constructor(fetcher = globalThis.fetch.bind(globalThis), timeout = 8000) {
        this.fetcher = fetcher;
        this.timeout = timeout;
    }
    async understand(i) {
        const controller = new AbortController(), abort = () => controller.abort();
        i.signal?.addEventListener('abort', abort, { once: true });
        if (i.signal?.aborted)
            abort();
        const timer = setTimeout(abort, this.timeout);
        try {
            const response = await apiFetch('/api/assistant', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, signal: controller.signal, body: JSON.stringify({ requestId: i.requestId, text: i.text, previousIntent: i.previous?.intent, ...(i.careDirectory ? { careDirectory: i.careDirectory } : {}) }) }, this.fetcher);
            if (!response.ok)
                throw Error('模型连接暂不可用');
            const result = await response.json();
            if (!validateToolRequest(result, i.requestId))
                throw Error('模型工具请求未通过校验');
            return result;
        }
        finally {
            clearTimeout(timer);
            i.signal?.removeEventListener('abort', abort);
        }
    }
}
export let providerMode = 'mock';
export let providerLabel = '演示助手 + 模拟行程数据';
export async function configureProvider() { const before = providerLabel; await loadConnections(); try {
    const r = await apiFetch('/api/assistant/config');
    const c = await r.json();
    providerMode = c.assistant === 'api' ? 'api' : 'mock';
    providerLabel = providerMode === 'api' ? (c.configured ? '真实模型接入模式 + 模拟行程数据' : '模型未配置，使用降级演示 + 模拟行程数据') : '演示助手 + 模拟行程数据';
}
catch {
    providerMode = 'mock';
} if (connection.model === 'verified')
    providerLabel = 'AI 助手已連接 · 航班為內置示例'; return before !== providerLabel; }
export function assistantProvider() { return providerMode === 'api' ? new ApiAssistantProvider() : new MockAssistantProvider(); }
