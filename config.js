import { BRAND } from '../web/brand.js';
export const DEMO_CLOCK = '2027-09-14T03:05:00.000Z';
export const FEATURE_HOME_FUND = true; // Local restricted-support mechanism proposal, not a live loyalty policy.
export const MIN_MEMBER_AGE = 2;
export const MONTHLY_REWARD_CAP = 500;
export const TASK_REWARDS_EXTEND_EXPIRY = false; // Pending business approval. Never infer renewal from engagement.
export const RULES = { bassinetMaxMonths: 24, bassinetMaxKg: 12, profileReviewDays: 30, deadlines: { bassinet: 48, wheelchair: 48, ownWheelchair: 96, aisle: 24, adjacent: 24, infantMeal: 48, childMeal: 48, specialMeal: 48 } };
export const SERVICE_LABELS = { bassinet: '婴儿篮', wheelchair: '机场轮椅', ownWheelchair: '自带轮椅', aisle: '过道座位', adjacent: '照护者相邻座位', infantMeal: '婴儿餐', childMeal: '儿童餐', specialMeal: '特殊餐' };
export const APPLICABILITY = { eligible: '初步符合', missing: '待补资料', unavailable: '机型不提供', manual: '需人工核实' };
export const PROGRESS = { missing: '待补资料', review: '待用户确认', submitted: '已提交', confirmed: '已确认', reconfirm: '需重新确认', unavailable: '无法满足', unknown: '结果待核实' };
export const ROLES = { owner: '管理员', editor: '协作者', viewer: '仅查看' };
export const TASKS = [
    { id: 'destination-quiz', title: '出发前，认识目的地', kind: 'quiz', reward: 120, period: 'month', condition: '答对一道目的地准备题', options: ['确认当地时区、交通和住宿安排', '只看出发地时间', '落地后再决定所有安排'], answer: 0, body: '前往新的目的地前，哪项准备最能减少抵达后的不确定性？', qualifying: false },
    { id: 'family-lesson', title: '和孩子一起做好随身准备', kind: 'read', reward: 80, period: 'month', condition: '阅读并核对亲子随身清单', body: '把必需的随身用品放在容易取用的位置；和孩子约定走散时向工作人员求助；提前确认同行照护人及需要核实的服务。请在自己的座位上或候机区完成，不需要离座探索。', qualifying: false },
    { id: 'calendar-learn', title: '学了就赚 · 确认学期准备', kind: 'learn', reward: 100, period: 'month', condition: '确认校历、证件日期提醒与行李清单', body: '核對校曆、文件及行李準備；完成任務後可查看獎勵進度。', qualifying: false },
    { id: 'window-memory', title: '舷窗记忆 · 留住这一程', kind: 'photo', reward: 120, period: 'month', condition: '选择一张本地图片并确认旅程记忆', body: '选择一张旅程图片，在自己的设备预览。图片不上传、不写入会员档案，只记录任务完成状态。', qualifying: false },
    { id: 'cabin-discovery', title: '机上探索 · 安心出发', kind: 'hunt', reward: 80, period: 'month', condition: '航班场景解锁，完成三个安全准备点', body: '核對安全卡、閱讀燈和呼叫按鈕，留在座位上即可完成。', qualifying: false },
    { id: 'flight-milestone', title: '成长护照 · 新航段', kind: 'milestone', reward: 50, period: 'flight', condition: '完成飛行後，每月最多 2 次', body: '按完成航段唯一编号记账，订票或取消不产生奖励。', qualifying: false }
];
export const SCHOOLS = [
    { name: '倫敦示例大學 · 2027 春季（虛構校曆）', destination: 'LHR', start: '2027-01-11', dorm: '2027-01-08', exam: '2027-05-15', holiday: '2027-02-01', holidayEnd: '2027-02-15', graduation: '2027-07-01' },
    { name: '伦敦示例大学 · 演示校历', destination: 'LHR', start: '2027-09-20', dorm: '2027-09-18', exam: '2028-05-15', holiday: '2027-12-18', holidayEnd: '2028-01-10', graduation: '2028-07-01' },
    { name: '东京示例学院 · 演示校历', destination: 'NRT', start: '2027-10-04', dorm: '2027-10-01', exam: '2028-02-14', holiday: '2027-12-24', holidayEnd: '2028-01-11', graduation: '2028-03-20' },
    { name: '悉尼示例大学 · 演示校历', destination: 'SYD', start: '2028-02-21', dorm: '2028-02-18', exam: '2028-06-12', holiday: '2028-07-01', holidayEnd: '2028-07-24', graduation: '2028-12-15' }
];
export const COPY = { brand: BRAND.names[BRAND.locale], team: BRAND.team, demo: '概念 Demo · 演示数据', assistant: BRAND.assistant, local: '仅在当前浏览器保存虚构资料', nav: { trips: '我的旅程', home: '首頁', student: '學期規劃', care: '家庭照護', preparation: '行前準備', recovery: '行程應變', journey: '行程助手', fund: '回家基金' } };
