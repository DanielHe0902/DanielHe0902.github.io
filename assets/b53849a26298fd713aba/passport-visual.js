import { BRAND } from '/assets/b53849a26298fd713aba/web/brand.js';
import { airport } from '/assets/b53849a26298fd713aba/web/travel.js';
import { esc } from '/assets/b53849a26298fd713aba/ui.js';
export const artURL = (name) => new URL('./web/assets/passport/' + name + '.svg', import.meta.url).href;
const cities = { HKG: { name: '香港', art: 'hong-kong' }, NRT: { name: '東京', art: 'tokyo' }, TPE: { name: '台北', art: 'taipei' } };
export const cityVisual = (code) => cities[code] ?? { name: airport(code)?.city ?? code, art: 'city' };
export function aircraftVisual(type) { const value = (type ?? '').trim(); return /^A350(?:-(?:900|1000))?$/.test(value) ? { label: 'Airbus ' + value, art: 'a350' } : value && /^(A\d{3}|B\d{3})(?:neo|-\d{3})?$/.test(value) ? { label: value, art: 'aircraft' } : { label: '機型待確認', art: 'aircraft' }; }
// Presentation aliases only. Operational IDs, catalogs and events are untouched.
const flightNames = {
    'CX-DEMO H501': '東京去程', 'CX-DEMO H502': '香港回程', 'CX-DEMO H401': '台北去程', 'CX-DEMO H402': '香港回程',
    ...Object.fromEntries(['401', '402', '403', '404', '405', '501', '502', '503', '505', '507', '251', '252', '253', '254', '255', '701', '702', '830', '831', '901', '452', '460', '468'].map(n => ['CX-DEMO ' + n, 'CX ' + n]))
};
export const flightLabel = (flight) => flight.includes(' / ') ? flight.split(' / ').map(flightLabel).join(' / ') : flightNames[flight] ?? (flight.startsWith('CX-DEMO') ? '航班資料待確認' : flight);
export function passportStamp(st, size = 'standard', interactive = true) { const city = cityVisual(st.city), aircraft = aircraftVisual(st.aircraft), tag = interactive ? 'button' : 'div'; return '<' + tag + (interactive ? ' type="button" data-action="passport-stamp" data-person="' + esc(st.personId) + '" data-stamp="' + esc(st.id) + '" aria-label="' + esc(city.name + ' · ' + st.date + ' · ' + (st.pending ? '待完成' : '已完成') + ' · ' + (st.personName ?? '') + '，查看飛行紀錄') + '"' : '') + ' class="passport-stamp stamp-' + size + (st.pending ? ' passport-stamp-pending' : '') + '"><span class="stamp-city"><strong>' + esc(city.name) + '</strong><span>' + esc(st.city) + '</span></span><img class="stamp-landmark" src="' + artURL(city.art) + '" width="240" height="90" alt=""><span class="stamp-aircraft"><img src="' + artURL(aircraft.art) + '" width="80" height="24" alt=""><span>' + (st.pending && aircraft.art !== 'aircraft' ? '<small>預計機型</small>' : '') + esc(aircraft.label) + '</span></span><span class="stamp-bottom"><time datetime="' + esc(st.date) + '">' + esc(st.date) + '</time><span class="stamp-status">' + (st.pending ? '待完成' : '已完成') + '</span></span>' + (st.personName ? '<span class="stamp-owner">' + esc(st.personName) + '</span>' : '') + '</' + tag + '>'; }
export async function exportPassport(name, year, records) {
    const canvas = document.createElement('canvas');
    canvas.width = 1080;
    canvas.height = Math.max(1020, 410 + Math.ceil(records.length / 2) * 360);
    const c = canvas.getContext('2d');
    c.fillStyle = '#faf9f6';
    c.fillRect(0, 0, canvas.width, canvas.height);
    c.fillStyle = '#2b4037';
    c.font = '30px sans-serif';
    c.fillText(BRAND.names[BRAND.locale] + ' · ' + BRAND.names.en, 70, 90);
    c.font = 'bold 48px sans-serif';
    c.fillText(name + '的成長旅程', 70, 170);
    c.font = '28px sans-serif';
    c.fillText(year + ' 年度飛行足跡 · ' + records.length + ' 枚已完成章', 70, 228);
    const image = async (name) => { const im = new Image(); im.src = artURL(name); await im.decode(); return im; };
    for (const [i, st] of records.entries()) {
        const x = 70 + (i % 2) * 490, y = 290 + Math.floor(i / 2) * 360, city = cityVisual(st.city), aircraft = aircraftVisual(st.aircraft);
        c.fillStyle = '#fff';
        c.strokeStyle = '#7b8e84';
        c.lineWidth = 2;
        c.beginPath();
        c.roundRect(x, y, 450, 320, 16);
        c.fill();
        c.stroke();
        c.strokeStyle = '#dee4e1';
        c.strokeRect(x + 10, y + 10, 430, 300);
        c.fillStyle = '#286f70';
        c.font = 'bold 32px sans-serif';
        c.fillText(city.name, x + 24, y + 48);
        c.font = '22px sans-serif';
        c.fillText(st.city, x + 360, y + 45);
        c.drawImage(await image(city.art), x + 30, y + 66, 390, 146);
        c.drawImage(await image(aircraft.art), x + 22, y + 220, 100, 30);
        c.font = '22px sans-serif';
        c.fillText(aircraft.label, x + 132, y + 243);
        c.fillStyle = '#333b38';
        c.font = '23px sans-serif';
        c.fillText(st.date, x + 24, y + 290);
        c.fillText('已完成', x + 338, y + 290);
    }
    if (!records.length) {
        c.font = '28px sans-serif';
        c.fillText('期待下一段完成的旅程。', 70, 350);
    }
    return new Promise((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(Error('圖片未能產生，請重試。')), 'image/png'));
}
