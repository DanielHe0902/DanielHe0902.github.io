import { parseCareTask, validateCareTask, recognitionMembers } from './recognition.js';
import { journeyModel } from './journey-context.js';
import { canPlan, studentCapability } from './capabilities.js';
import { message } from './messages.js';
import { learningRows, earned } from './learning.js';
import { MONTHLY_REWARD_CAP } from './config.js';
import * as M from './demo.js';
import * as J from './transit.js';
import { displayName, personLabel, relationshipLabel } from './identity.js';
import { FEATURE_HOME_FUND, SERVICE_LABELS } from './config.js';
import * as D from './domain.js';
import { fundsFor } from './fund.js';
export const TARGET_ROUTES = { 'family-tasks': 'home', 'service-alternatives': 'preparation', 'learn-tasks': 'student', 'journey-context': 'journey', 'next-flight': 'journey', 'transfer-route': 'journey', 'transfer-buffer': 'journey', 'arrival-conflict': 'journey', 'campus-transport': 'journey', 'contact-draft': 'journey', 'posttrip-summary': 'journey', 'trip-passport': 'journey', 'student-dates': 'student', 'care-member': 'care', 'preparation-tasks': 'preparation', 'recovery-candidates': 'recovery', 'passport-records': 'home', 'fund-action': 'fund' };
export function guideContext(s, personal = false) { if (s.dual && M.demoAccount(s)) {
    const selected = M.selectTrip(s);
    return { accountId: s.activeAccountId, spaceId: s.demoSpaceId, actorId: s.actorId, familyId: personal ? null : s.activeFamilyId, tripId: selected.status === 'ok' ? selected.id : null, tripVersion: selected.status === 'ok' ? selected.version : 0, epoch: s.epoch, dataRevision: (s.dual.revision ?? 0) + (selected.status === 'ok' ? s.journeys?.items[selected.id]?.revision ?? 0 : 0) };
} const j = J.currentJourney(s); if (j && j.familyId === null && j.ownerId === s.actorId)
    return { actorId: s.actorId, familyId: null, tripId: j.id, tripVersion: j.version, dataRevision: j.revision, epoch: s.epoch }; const f = !personal && s.activeFamilyId && D.membership(s, s.activeFamilyId) ? s.activeFamilyId : null, t = f ? D.currentTrip(s, f) : null; return { actorId: s.actorId, familyId: f, tripId: t?.id ?? null, tripVersion: t?.version ?? 0, epoch: s.epoch, ...(j && j.familyId === f ? { dataRevision: j.revision } : {}) }; }
export const contextKey = (c) => [c.spaceId ?? 'legacy', c.accountId ?? c.actorId, c.familyId ?? 'personal', c.tripId ?? 'none'].join(':');
export const sameContext = (a, b) => JSON.stringify(a) === JSON.stringify(b);
export function resolveCareTask(s, r, t, choice) {
    const answer = (message) => ({ kind: 'answer', message }), f = r.context.familyId;
    if (t.dataError)
        return answer('家庭成員資料未完整載入，請重新載入後重試；沒有新增或修改需求。');
    if (t.goal === 'rules')
        return answer('輪椅協助用於機場行動支援；自帶輪椅需另行核對設備及電池。請在服務表單查看適用航段、期限與所需資料，預檢結果仍待航空公司確認。這次只解釋功能，沒有新增需求。');
    if (t.goal === 'hold')
        return answer('已停止本次待辦動作，未提交草稿仍保留；已保存需求和歷史申請均未修改或取消。');
    if (t.rental)
        return answer('輪椅租借與機場輪椅協助屬不同服務。小期可以準備機場協助或自帶設備資料，不能代辦輪椅租借。');
    if (!f)
        return answer('請先選擇已獲授權的家庭；目前沒有家庭照護操作範圍。');
    const members = recognitionMembers(s, f);
    if (!members.some(m => m.editable))
        return answer('目前沒有獲授權的照護編輯權限，請由本人或已獲授權照護者核對。');
    if (choice?.startsWith('trip:')) {
        const id = choice.slice(5);
        if (!t.tripCandidates.includes(id) || !s.trips[id])
            return answer('這個行程選項已失效。');
        t.tripId = id;
        t.tripVersion = s.trips[id].version;
        t.slots.trip = { status: 'resolved', source: 'choice' };
    }
    if (choice?.startsWith('member:')) {
        const id = choice.slice(7);
        if (!t.candidates.includes(id))
            return answer('這個成員選項已失效，請重新說明需求。');
        t.personIds = [id];
        t.needs = t.services.map(service => ({ personId: id, service }));
        t.slots.member = { status: 'resolved', source: 'choice' };
        t.nextAction = 'navigate';
        t.reason = undefined;
    }
    if (t.services.length > 1 && /或|或者/.test(r.text))
        return { kind: 'clarify', reason: 'service', message: '對象資料已保留。這次先準備哪項服務？', choices: t.services.map(service => ({ id: 'service:' + service, label: SERVICE_LABELS[service] })) };
    if (t.nextAction === 'clarify')
        return { kind: 'clarify', reason: 'member', message: t.slots.member.status === 'conflict' ? '姓名與已建立稱呼指向不同成員，這次要為哪位準備？' : t.candidates.length ? '請確認這次的服務對象。' : '目前找不到這個稱呼的已確認對應，請提供家庭成員姓名。', choices: t.candidates.filter(id => members.some(m => m.id === id && m.editable)).map(id => ({ id: 'member:' + id, label: displayName(s.persons[id]) + ' · ' + relationshipLabel(s, f, id) })) };
    if (!validateCareTask(s, t, r.context))
        return answer('目前沒有編輯這位成員照護資料的授權，或行程版本已變更。請由本人或已獲授權照護者核對後再試。');
    if (t.goal === 'confirm' && !t.tripId)
        return { kind: 'clarify', reason: 'trip', message: '成員與需求已保留。航段申請要用在哪一趟行程？確認行程後仍須核對申請摘要。', choices: t.tripCandidates.map(id => ({ id: 'trip:' + id, label: s.trips[id].route.origin + ' → ' + s.trips[id].route.destination + ' · ' + s.trips[id].route.date })) };
    const existing = Object.values(s.requests).filter(x => x.familyId === f && x.tripId === t.tripId && x.tripVersion === t.tripVersion && t.needs.some(n => n.personId === x.personId && n.service === x.kind) && D.permitted(s, f, x.personId, 'service') && (!t.segmentIds.length || t.segmentIds.includes(x.segmentId)));
    if (t.goal === 'status')
        return answer(existing.length ? existing.map(x => displayName(s.persons[x.personId]) + ' · ' + SERVICE_LABELS[x.kind] + '：' + ({ unknown: '狀態待核實', review: '待核對', draft: '待提交', submitted: '已提交', confirmed: '已確認', missing: '待補資料', unavailable: '無法滿足', reconfirm: '需要重新確認' }[x.progress] ?? '請核對回執')).join('；') : '這次行程沒有找到對應服務申請；尚未建立新申請。');
    return { kind: 'navigate', view: 'care', target: 'care-member', personId: t.personIds[0], service: t.needs[0]?.service, careTask: t, existingRequestIds: existing.map(x => x.id), message: '已打開 ' + t.personIds.map(id => displayName(s.persons[id])).join('、') + ' 的照護資料，需求已帶入本地草稿。' + (existing.length ? '已找到對應申請，請從「查看既有申請」繼續，沒有建立重複申請。' : '請核對後再儲存；航段申請仍需另外確認。') + (t.tripId ? '' : '辦理航段申請前再選擇行程。') };
}
export function guideIntent(text) {
    if (/(有.*服务吗|规则|是什么|如何收费|一般|可以.*吗)/.test(text) && !/(带我|帮我|申请|打开|看看)/.test(text))
        return 'rules';
    if (/(回家.*(基金|机票|支持)|支持.*回家|亲友.*支持|回家基金)/.test(text))
        return 'fund';
    if (/(成长|护照|年度|孩子.*记录)/.test(text))
        return 'passport';
    if (/(取消|延误|替代|航班变|改签)/.test(text))
        return 'recovery';
    if (/(轮椅|婴儿篮|摇篮|照护)/.test(text))
        return 'care';
    if (/(没准备|没办|准备好|准备.*(进度|旅行)|待办)/.test(text))
        return 'preparation';
    if (/(学期|开学|学校|校历|规划.*航)/.test(text))
        return 'student';
    return 'unknown';
}
export function preparationSummary(s, f) { const t = D.currentTrip(s, f); if (!t)
    return { title: '尚未建立行程', detail: '先选择目的地、日期和同行人。', pending: 0 }; const rs = D.visibleRequests(s, t), pending = rs.filter(r => r.progress !== 'confirmed'); if (!rs.length) {
    const preview = D.carePreview(s, t);
    return { title: '先核对并带入照护需求', detail: preview.length ? `${preview.length} 项获授权需求等待预览；其中 ${preview.filter(p => p.missing.length).length} 项需要补齐资料。` : '当前没有获授权的服务需求，请先核对同行成员。', pending: preview.length };
} const first = pending.find(r => r.missing.length) ?? pending[0]; return { title: pending.length ? `${pending.length} 项服务还需处理` : '当前可见服务均已确认', detail: first ? `${displayName(s.persons[first.personId])} · ${SERVICE_LABELS[first.kind]}${first.missing.length ? '：需核对 ' + first.missing.join('、') : '：请核对处理状态与回执。'}` : '出发前继续核对出行文件与照护关系。', pending: pending.length }; }
export function resolveGuide(s, r, choice, featureFund = FEATURE_HOME_FUND) {
    if (!sameContext(r.context, guideContext(s, r.context.familyId === null)))
        return { kind: 'answer', message: '上下文已变化，这条引导已停止。请在当前空间重新发起。' };
    const f = r.context.familyId, t = f ? D.currentTrip(s, f) : null;
    if (r.careTask && !r.familyConfirmed) {
        const available = D.familiesFor(s), named = available.filter(x => x.name.length > 2 && r.text.includes(x.name));
        if (named.some(x => x.id !== f) || available.length > 1 && /另一个家庭|两个家庭|两个家|两边|所有家庭/.test(r.text))
            return { kind: 'clarify', reason: 'family', message: '請先確認這次要處理的家庭；成員與服務會按該家庭的授權重新核對。', choices: (named.length ? named : available).map(x => ({ id: 'family:' + x.id, label: x.name })) };
    }
    const nav = (target, message, extra = {}) => ({ kind: 'navigate', view: TARGET_ROUTES[target], target, message, ...extra });
    const current = J.currentJourney(s), vm = current ? journeyModel(s, current) : undefined;
    if (current && /(無法滿足|无法满足|替代餐|人工核實|人工核实)/.test(r.text)) {
        const requests = Object.values(s.requests).filter(x => x.tripId === current.id && x.tripVersion === current.version && x.evidence && D.permitted(s, x.familyId, x.personId, 'service'));
        if (requests.length)
            return nav('service-alternatives', requests.map(x => personLabel(s, x.personId) + '：' + x.evidence.reason + '。' + (x.supersededBy ? '已有關聯新申請；請查看獨立回執及人工跟進。' : '可比較人工核實選項；選擇不表示確認。')).join(' '));
    }
    if (vm && (vm.showPosttrip && r.intent === 'preparation' || r.intent === 'review_post_trip' || r.intent === 'open_trip_passport_record' || /这次旅行.*(处理|跟进)|餐食.*(没|问题)|餐.*没有安排/.test(r.text))) {
        const follow = vm.services.filter(x => x.needsAttention);
        return nav('posttrip-summary', vm.summary + ' ' + (follow.length ? follow.map(x => displayName(s.persons[x.r.personId]) + '的' + x.label + '：' + x.next).join('；') : '目前沒有可見的待跟進服務。') + (vm.student ? ' 本次抵達安排：' + (current.arrivalNode === 4 ? '本人已確認到宿舍。' : '仍待本人確認到校。') : '') + ' 請核對具體旅客與航段，可在服務紀錄旁整理問題草稿，未向客服發送。');
    }
    if (vm?.student && current.segments.length === 1 && ['explain_transfer_next_step', 'evaluate_transfer_activity', 'explain_gate_change'].includes(r.intent))
        return nav('next-flight', vm.summary + ' 本次為直飛，沒有轉機步驟；請按現場資訊核對登機口與到場時間。');
    if (vm && !vm.student && ['check_arrival_connection', 'open_campus_transport', 'prepare_arrival_contact', 'explain_transfer_next_step', 'evaluate_transfer_activity', 'explain_gate_change', 'open_current_journey'].includes(r.intent))
        return nav('posttrip-summary', vm.summary + ' 本行程未關聯學生接機或宿舍安排，請查看實際旅客及各航段紀錄。');
    if (s.dual && M.demoAccount(s)) {
        if (/家庭任务|全家任务|查看任务/.test(r.text))
            return nav('family-tasks', '已開啟本人有權參與的家庭任務；查看不會完成或領獎。');
        if (r.intent === 'passport' && M.studentAccount(s))
            return nav('passport-records', '已開啟你本人的成年會員飛行足跡；不開放其他孩子的未授權紀錄。', { personId: s.actorId });
        if (r.intent === 'student' && !canPlan(s))
            return { kind: 'answer', message: message('STUDENT_ACCESS_REQUIRED') + ' 未共享的資料需要林晴另行授权。你仍可在我的旅程使用一般航班試算，或查看已授權基金。' };
        if (/学了就赚|学习奖励|领取.*里数|领奖|不能.*领|行李清单.*领/.test(r.text)) {
            if (!studentCapability(s))
                return { kind: 'answer', message: message('STUDENT_ACCESS_REQUIRED') };
            const a = M.demoAccount(s), rows = learningRows(s), summary = rows.map(x => x.title + '：' + (x.covered ? '舊版已覆蓋' : x.event ? message(x.event.status) : message('incomplete'))).join('；');
            return nav('learn-tasks', '學了就賺位於你的學期規劃。' + summary + '。本月已入帳 ' + earned(s, a.memberId) + ' / ' + MONTHLY_REWARD_CAP + ' 里數；相同完成事件只領一次，換月份不重發。領取前仍由你確認。');
        }
        if (/最多.*支持|支持.*上限/.test(r.text)) {
            if (!M.canSupport(s, s.actorId, M.FUND))
                return { kind: 'answer', message: message('CONSENT_REQUIRED') };
            return { kind: 'answer', message: '按目前最新可用餘額與 100 里數步長，你最多可支持 ' + M.maxSupport(s).toLocaleString('en-US') + ' 里數。預覽與確認時會再次核對。' };
        }
        if (s.actorId === 'father' && !J.currentJourney(s)?.grants.includes(s.actorId) && /(林晴|女儿|学生).*(签证|证件|护照|余额|私人|私下|航程|行程|聊天)/.test(r.text))
            return { kind: 'answer', message: '林晴是成年学生。你目前仅获授权查看回家基金目标摘要并提供支持；签证、证件、私人行程、普通余额与聊天需要林晴另行授权。' };
        if (/(爸爸|父亲).*(里数|支持).*(到|到账)|支持.*到账/.test(r.text)) {
            const summary = M.fundSummary(s), tx = M.visibleTransactions(s).filter(t => t.status === 'confirmed');
            return { kind: 'answer', message: summary ? ('回家基金实际已到账 ' + summary.balance.toLocaleString('en-US') + ' 里。' + (tx.length ? '最近记录 ' + tx.at(-1).id + '；受限支持不会增加你的普通余额。' : '目前没有成功交易，不能把聊天承诺当作到账。')) : '当前没有基金摘要授权。' };
        }
        if (r.intent === 'fund') {
            const match = r.text.match(/([+-]?[\d.,eE]+|NaN|Infinity|一百万)\s*(?:里|里数)/), raw = match?.[1];
            let amount;
            if (s.actorId === 'father' && raw) {
                try {
                    amount = M.validateSupport(s, s.actorId, M.FUND, raw);
                }
                catch (e) {
                    return { kind: 'answer', message: e.message };
                }
            }
            return nav('fund-action', s.actorId === 'father' ? '已打开获授权的林晴回家目标。预览后由你明确确认才會扣減里數。' : '已打开你的基金；这里只按实际成功交易显示到账。', s.actorId === 'father' && amount ? { supportAmount: amount } : {});
        }
        if (r.intent === 'preparation' || /还缺.*准备|准备进度|没办妥/.test(r.text)) {
            const tasks = M.currentTasks(s);
            return nav('preparation-tasks', tasks.length ? (tasks.filter(t => t.status !== 'done').length + ' 项准备尚需处理：' + tasks.filter(t => t.status !== 'done').map(t => t.title).join('、') + '。') : '此工作区还没有准备项。');
        }
        if (vm?.student && (r.intent === 'recovery' || /接机.*(影响|调整|赶)|航班.*接机/.test(r.text))) {
            const j = J.currentJourney(s), a = J.arrivalAssessment(j);
            return nav('recovery-candidates', '你的个人返校航班预计伦敦 ' + J.localTime(J.plannedOrEstimated(J.lastLeg(j)), 'Europe/London') + ' 抵达；预计 ' + J.localTime(a.schoolAt, 'Europe/London') + ' 到校。' + (a.pickupConflict ? '接机需重新安排。' : '') + (a.dormConflict ? '晚到入住尚需学校确认。' : ''));
        }
        if (vm?.showPosttrip && vm.purpose === 'family' && r.intent === 'recovery' && s.trips[vm.tripId]?.status !== 'cancelled')
            return nav('posttrip-summary', vm.summary + ' 請按本次服務紀錄核對後續事項。');
        if (vm?.tripId === M.FAMILY_TRIP && r.intent === 'recovery') {
            const t = s.trips[M.FAMILY_TRIP], cs = D.candidates(s, t);
            return nav('recovery-candidates', '本次 ' + t.members.length + ' 位旅客，需要 ' + t.members.filter(m => m.occupiesSeat).length + ' 個座位。' + cs.map((c, i) => '方案 ' + 'ABC'[i] + '：' + (c.eligible ? '可進入確認，服務待獨立回執' : '暫未能確認符合本次同行與照護條件，請比較其他航班')).join('。'));
        }
    }
    if (TARGET_ROUTES[{ open_current_journey: 'journey-context', explain_transfer_next_step: 'transfer-route', evaluate_transfer_activity: 'transfer-buffer', explain_gate_change: 'transfer-route', check_arrival_connection: 'arrival-conflict', open_campus_transport: 'campus-transport', prepare_arrival_contact: 'contact-draft', review_post_trip: 'posttrip-summary', open_trip_passport_record: 'trip-passport' }[r.intent]]) {
        const j = J.currentJourney(s);
        if (!j)
            return { kind: 'answer', message: '目前沒有已獲授權的途中行程，請先選擇行程。' };
        const leg = J.lastLeg(j), b = J.transferBuffer(j), a = J.arrivalAssessment(j);
        if (!J.transferActive(j) && ['explain_transfer_next_step', 'evaluate_transfer_activity', 'explain_gate_change'].includes(r.intent))
            return nav('journey-context', journeyModel(s, j).summary + ' 本行程尚未進入有效轉機時段，不能按未來的登機期限提供即時用餐或路線建議。');
        const targets = { open_current_journey: 'journey-context', explain_transfer_next_step: 'transfer-route', evaluate_transfer_activity: 'transfer-buffer', explain_gate_change: 'transfer-route', check_arrival_connection: 'arrival-conflict', open_campus_transport: 'campus-transport', prepare_arrival_contact: 'contact-draft', review_post_trip: 'posttrip-summary', open_trip_passport_record: 'trip-passport' };
        let message = journeyModel(s, j).summary;
        if (['explain_transfer_next_step', 'evaluate_transfer_activity', 'explain_gate_change'].includes(r.intent))
            message = '现在：前往 ' + leg.gate + ' 号登机口。' + b.reason + ' ' + (b.canEat ? '按样例估时可考虑短时用餐，但先核实现场安排。' : '请先完成转机，暂不建议安排用餐。') + ' 数据修订 ' + j.revision + ' · 香港时间 ' + J.localTime(leg.updatedAt);
        if (['check_arrival_connection', 'open_campus_transport', 'prepare_arrival_contact'].includes(r.intent))
            message = '预计到接机点 ' + J.localTime(a.pickupAt, 'Europe/London') + '、到校 ' + J.localTime(a.schoolAt, 'Europe/London') + '（伦敦时间）。' + (a.pickupConflict ? '可能赶不上学校接机。' : '请核实接机安排。') + (a.dormConflict ? '预计超出入住窗口。' : '') + ' 选择交通后可生成联系草稿；不会发送或修改预订。';
        if (r.intent === 'review_post_trip' || r.intent === 'open_trip_passport_record')
            message = '本次飞行记录：' + (leg.completed ? '已收到完成記錄' : '尚待完成回执') + '；到校：' + (j.arrivalNode === 4 ? '本人已确认' : '尚未确认') + '。尚未解决的服务继续保留，报平安须预览并选择授权对象。';
        return nav(targets[r.intent], message);
    }
    if (r.careTask)
        return resolveCareTask(s, r, r.careTask, choice);
    if (r.intent === 'rules')
        return { kind: 'answer', message: '可以在照护档案准备轮椅、婴儿篮等需求。资格、截止时间与机型需逐项核实；預檢結果仍待航空公司確認。你可以说“带我去看轮椅申请”。' };
    if (r.intent === 'unknown')
        return { kind: 'clarify', reason: 'intent', message: '我还不能确定要办理什么。请选择一个方向，或补充具体的家庭、成员与行程。', choices: [...(canPlan(s) ? [{ id: 'intent:student', label: '规划学期' }] : []), { id: 'intent:care', label: '准备照护' }, { id: 'intent:preparation', label: '检查准备' }, { id: 'intent:recovery', label: '查看替代安排' }, { id: 'intent:passport', label: '成长护照' }, { id: 'intent:fund', label: '回家基金' }] };
    if (r.intent === 'student') {
        const p = s.plans[s.actorId], school = r.school ?? p?.school;
        return nav('student-dates', '已打开学校与日期区域。核对学期、签证与行李后再重新计算；保存仍由你确认。', { school: r.school, start: r.start });
    }
    if (r.intent === 'fund') {
        if (!featureFund)
            return { kind: 'answer', message: '回家基金当前未开放。你仍可以在学期规划试算返乡航线。' };
        const mine = fundsFor(s).find(x => x.ownerId === s.actorId);
        return nav('fund-action', mine ? '已定位你的回家目标。使用“邀请亲友支持”预览邀请；分享和兑换仍需你确认。' : '已定位创建回家目标入口。先设置本人的航线和返乡窗口，再邀请亲友支持。');
    }
    if (!f)
        return { kind: 'answer', message: '当前是个人空间。请先在顶栏选择一个已授权家庭，或用结构化页面创建家庭后继续。' };
    // An explicit different family reference must be clarified through the actual switcher.
    const families = D.familiesFor(s), other = families.find(x => x.id !== f && r.text.includes(x.name) && x.name.length > 2);
    if (!r.familyConfirmed && (other || families.length > 1 && /(另一个家庭|是妈妈不是外婆|不是外婆，是妈妈|两个家庭|两个家|两边|所有家庭|爸妈家|父母家)/.test(r.text)))
        return { kind: 'clarify', reason: 'family', message: '这项需求可能涉及多个家庭。请先选择本次要办理的家庭，再确认成员与行程；不会合并各家的资料。', choices: families.map(f => ({ id: 'family:' + f.id, label: f.name })) };
    if (r.intent === 'care') {
        const task = parseCareTask(s, r.context, r.text, r.id);
        if (task) {
            r.careTask = task;
            return resolveCareTask(s, r, task, choice);
        }
        return { kind: 'answer', message: '請說明需要查看的照護資料或服務。' };
    }
    if (r.intent === 'passport') {
        const members = D.familyMembers(s, f).filter(m => { const a = D.age(s.persons[m.personId], s.demoClock); return a >= 2 && a <= 18 && D.account(s, m.personId) && D.permitted(s, f, m.personId, 'passport'); });
        const chosen = choice?.startsWith('member:') ? members.find(m => m.personId === choice.slice(7)) : members.length === 1 ? members[0] : undefined;
        if (chosen)
            return nav('passport-records', `已打开 ${displayName(s.persons[chosen.personId])} 的成长记录，仅展示本家庭获授权且已完成的飞行。`, { personId: chosen.personId });
        return members.length ? { kind: 'clarify', reason: 'member', message: '想查看哪位孩子的成长护照？', choices: members.map(m => ({ id: 'member:' + m.personId, label: displayName(s.persons[m.personId]) })) } : { kind: 'answer', message: '当前家庭没有获授权的儿童会员成长护照。可在成员资料中核对年龄、会员与共享范围。' };
    }
    if (!t)
        return { kind: 'answer', message: '這個家庭尚未建立行程。請在首頁選擇「＋ 新增行程」，填寫日期和同行人；家庭照護資料現在也可以先整理。' };
    if (r.intent === 'preparation') {
        const summary = preparationSummary(s, f);
        return nav('preparation-tasks', summary.title + '。' + summary.detail);
    }
    if (t.status === 'completed')
        return { kind: 'answer', message: '当前航段已经完成，不能再把它标记为取消。请先选择新的行程。' };
    if (s.tripCleanup && t.status !== 'cancelled')
        return { kind: 'answer', message: '目前未收到這段行程的已核實取消紀錄。請先向航空公司核對實際狀態；我不會替你製造取消事件。' };
    if (t.status !== 'cancelled')
        return { kind: 'clarify', reason: 'trip', message: `当前记录仍为正常行程：${t.route.number} · ${t.route.date} · ${t.route.origin} — ${t.route.destination}。是否以此行程查看變更後的替代安排？`, choices: D.membership(s, f)?.role === 'viewer' ? [] : [{ id: 'confirm-cancellation', label: '確認此行程，查看替代安排' }] };
    return nav('recovery-candidates', `已打开 ${s.families[f].name} 的替代安排。${D.candidates(s, t).filter(c => c.eligible).length} 个方案满足当前照护约束；改签需要单独确认。`);
}
export function validateResolution(s, r, x) { if (!sameContext(r.context, guideContext(s, r.context.familyId === null)))
    return false; if (x.kind !== 'navigate')
    return true; if (x.view === 'student' && !canPlan(s))
    return false; if (x.supportAmount !== undefined) {
    try {
        M.validateSupport(s, s.actorId, M.FUND, x.supportAmount);
    }
    catch {
        return false;
    }
} if (x.supportAmount !== undefined && (!s.dual || s.actorId !== 'father' || !Number.isInteger(x.supportAmount) || x.supportAmount <= 0 || x.supportAmount % 100 !== 0))
    return false; if (x.view === 'journey')
    return !!J.currentJourney(s) && TARGET_ROUTES[x.target] === 'journey'; if (x.school !== undefined && (typeof x.school !== 'string' || x.school.length > 80 || !x.school.trim()))
    return false; if (x.start !== undefined && (!/^20\d{2}-\d{2}-\d{2}$/.test(x.start) || !Number.isFinite(Date.parse(x.start))))
    return false; if (!sameContext(r.context, guideContext(s, r.context.familyId === null)) || TARGET_ROUTES[x.target] !== x.view)
    return false; if (x.target === 'passport-records' && M.studentAccount(s))
    return x.personId === s.actorId; if (x.personId && !D.familyMembers(s, r.context.familyId ?? '').some(m => m.personId === x.personId))
    return false; if (x.careTask && !validateCareTask(s, x.careTask, r.context))
    return false; if (x.target === 'care-member' && (!x.personId || !D.permitted(s, r.context.familyId, x.personId, 'care:edit') || (x.service !== undefined && !['wheelchair', 'ownWheelchair', 'bassinet', 'specialMeal', 'childMeal', 'infantMeal', 'adjacent', 'aisle'].includes(x.service))))
    return false; if (x.target === 'passport-records' && (!x.personId || !D.permitted(s, r.context.familyId, x.personId, 'passport')))
    return false; return true; }
