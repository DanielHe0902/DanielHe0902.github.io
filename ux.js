import { bindAirportPickers } from './airport-picker.js';
import { esc } from './ui.js';
const controls = (form) => Array.from(form.querySelectorAll('input,select,textarea'));
function clearFormErrors(form) {
    form.querySelectorAll('[data-ux-error]').forEach(node => node.remove());
    controls(form).forEach(field => {
        if (!field.dataset.uxInvalid)
            return;
        field.removeAttribute('aria-invalid');
        const ids = (field.getAttribute('aria-describedby') ?? '').split(' ').filter(id => !id.startsWith('ux-error-'));
        if (ids.length)
            field.setAttribute('aria-describedby', ids.join(' '));
        else
            field.removeAttribute('aria-describedby');
        delete field.dataset.uxInvalid;
    });
}
export function showFormError(form, message, names = []) {
    if (!form)
        return;
    clearFormErrors(form);
    const fields = controls(form).filter(field => names.includes(field.name));
    const summary = document.createElement('div');
    summary.className = 'form-error-summary';
    summary.dataset.uxError = 'summary';
    summary.setAttribute('role', 'alert');
    summary.tabIndex = -1;
    summary.innerHTML = '<strong>請先核對以下內容</strong><p>' + esc(message) + '</p>';
    fields.forEach((field, index) => {
        field.id ||= 'ux-field-' + index + '-' + field.name;
        field.setAttribute('aria-invalid', 'true');
        field.dataset.uxInvalid = 'true';
        const error = document.createElement('small');
        error.id = 'ux-error-' + index + '-' + field.name;
        error.dataset.uxError = 'field';
        error.className = 'field-error';
        error.textContent = message;
        field.setAttribute('aria-describedby', [field.getAttribute('aria-describedby'), error.id].filter(Boolean).join(' '));
        field.closest('.field,.check')?.append(error);
        const jump = document.createElement('button');
        jump.type = 'button';
        jump.className = 'text-link';
        jump.textContent = '檢查' + (field.labels?.[0]?.querySelector('span')?.textContent ?? field.labels?.[0]?.textContent?.replace(message, '') ?? field.closest('.field')?.querySelector('label')?.textContent ?? field.name).trim();
        jump.onclick = () => {
            for (let parent = field.parentElement; parent; parent = parent.parentElement) {
                if (parent instanceof HTMLDetailsElement)
                    parent.open = true;
                if (parent.hasAttribute('data-care-fields')) {
                    parent.hidden = false;
                    parent.querySelectorAll('input,select,textarea').forEach(control => control.disabled = false);
                }
            }
            (field.matches('[data-airport-select]') ? document.getElementById(field.id + '-query') : field)?.focus();
        };
        summary.append(jump);
    });
    form.prepend(summary);
    summary.focus();
}
export function bindUX(root) {
    bindAirportPickers(root);
    root.querySelectorAll('img[data-photo],.brand img').forEach(img => {
        const fallback = () => { img.hidden = true; img.closest('.destination-photo')?.classList.add('photo-unavailable'); };
        img.addEventListener('error', fallback);
        if (img.complete && !img.naturalWidth)
            fallback();
    });
    root.querySelectorAll('[data-experience-plan-form]').forEach(form => {
        const update = () => {
            const start = form.querySelector('[name=start]'), end = form.querySelector('[name=end]');
            if (end)
                end.min = start.value || '2000-01-01';
            form.querySelector('[data-date-selection]').textContent = start.value ? (start.value + (end ? (end.value ? ' → ' + end.value : ' · 請選擇回程日期') : ' · 單程')) : '';
            form.querySelector('[data-traveler-count]').textContent = form.querySelectorAll('[name=travelerIds]:checked').length + ' 位';
        };
        form.addEventListener('input', update);
        update();
    });
    root.querySelectorAll('form').forEach(form => {
        let invalidQueued = false;
        form.addEventListener('invalid', event => {
            event.preventDefault();
            if (invalidQueued)
                return;
            invalidQueued = true;
            queueMicrotask(() => {
                invalidQueued = false;
                const fields = controls(form).filter(field => field.willValidate && !field.validity.valid);
                if (!fields.length)
                    return;
                const first = fields[0];
                const message = first.validity.valueMissing ? '請填寫必填內容，再繼續預覽。'
                    : first instanceof HTMLInputElement && first.type === 'date' && (first.validity.rangeUnderflow || first.validity.rangeOverflow)
                        ? first.name === 'end' && first.validity.rangeUnderflow ? '回程日期不能早於出發日期。' : `請選擇 ${first.min} 至 ${first.max} 範圍內的日期。`
                        : first.validity.rangeUnderflow || first.validity.rangeOverflow ? `請輸入${first.getAttribute('min') ?? '允許的最小值'}至${first.getAttribute('max') ?? '允許的最大值'}範圍內的數值。`
                            : first.validity.stepMismatch ? '請按欄位要求輸入有效的數值間隔。' : '請核對輸入格式，再繼續。';
                showFormError(form, message, fields.map(field => field.name));
            });
        }, true);
        form.addEventListener('input', () => clearFormErrors(form));
    });
    const care = root.querySelector('#care-form');
    if (care) {
        const update = () => {
            const selected = Array.from(care.querySelectorAll('[name=need]:checked')).map(el => el.value);
            care.querySelectorAll('[data-care-fields]').forEach(group => {
                group.hidden = !group.dataset.careFields.split(' ').some(kind => selected.includes(kind));
                // Preserve dormant values in the draft without blocking an unrelated submission.
                group.querySelectorAll('input,select,textarea').forEach(field => field.disabled = group.hidden);
            });
        };
        care.addEventListener('change', update);
        update();
    }
}
export function focusMain() {
    if (document.querySelector('dialog[open]'))
        return;
    document.querySelector('#main')?.focus({ preventScroll: true });
}
export function focusIdentity(element) {
    if (!(element instanceof HTMLElement))
        return null;
    if (element.id)
        return '#' + CSS.escape(element.id);
    if (element.matches('.account-menu>summary'))
        return '.account-menu>summary';
    const form = element.closest('form');
    if (form) {
        const marker = Array.from(form.attributes).find(a => a.name.startsWith('data-'));
        const parent = form.id ? '#' + CSS.escape(form.id) : marker ? 'form[' + marker.name + '="' + CSS.escape(marker.value) + '"]' : null;
        const name = element.getAttribute('name');
        if (parent && name)
            return parent + ' [name="' + CSS.escape(name) + '"]' + (element instanceof HTMLInputElement && ['checkbox', 'radio'].includes(element.type) ? '[value="' + CSS.escape(element.value) + '"]' : '');
        if (parent && element.matches('button[type=submit]'))
            return parent + ' button[type=submit]';
    }
    if (element.matches('button,a')) {
        const attributes = Array.from(element.attributes).filter(a => a.name.startsWith('data-') && !a.name.startsWith('data-ux-'));
        if (attributes.length)
            return element.tagName.toLowerCase() + attributes.map(a => '[' + a.name + '="' + CSS.escape(a.value) + '"]').join('');
    }
    return null;
}
export function restoreFocus(selector) {
    const element = selector ? document.querySelector(selector) : null;
    if (element && element.getClientRects().length)
        element.focus({ preventScroll: true });
    else
        focusMain();
}
