(function () {
    'use strict';

    const $ = (sel, root = document) => root.querySelector(sel);
    const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
    const viewBox = $('#view');

    const MENUS = {
        customer: [['apply', 'Apply for Loan'], ['mine', 'My Loans'], ['calc', 'EMI Calculator']],
        officer: [['queue', 'Applications'], ['calc', 'EMI Calculator']],
        admin: [['reports', 'Reports'], ['queue', 'All Loans'], ['users', 'Users'], ['types', 'Loan Types'], ['calc', 'EMI Calculator']]
    };
    const ROLE_LABEL = { admin: 'Admin', officer: 'Loan Officer', customer: 'Customer' };
    const STATUS_LIST = ['pending', 'under_review', 'approved', 'rejected', 'closed'];
    const PAY_MODES = ['upi', 'card', 'netbanking', 'cash'];
    const DOC_HINTS = ['ID Proof', 'Address Proof', 'Income Proof', 'Bank Statement', 'Property Papers',
        'Admission Letter', 'Fee Structure', 'Vehicle Quotation', 'Other'];

    let currentTab = null;
    let typeCache = [];
    let loanFilters = {};
    let userFilters = {};

    function esc(value) {
        return String(value ?? '').replace(/[&<>"']/g, (ch) => (
            { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]
        ));
    }

    const rupees = (n) => '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });
    const shortDate = (d) => (d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');
    const dateTime = (d) => (d ? new Date(d).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '—');
    const nice = (text) => esc(String(text || '').replace(/_/g, ' '));
    const statusPill = (s) => `<span class="pill pill-${esc(s)}">${nice(s)}</span>`;
    const formValues = (form) => Object.fromEntries(new FormData(form).entries());
    const myRole = () => (Session.user ? Session.user.role : null);
    const isStaff = () => ['admin', 'officer'].includes(myRole());

    let toastTimer = null;
    function toast(message, kind = 'ok') {
        const box = $('#toast');
        box.textContent = message;
        box.className = `toast ${kind}`;
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => box.classList.add('hidden'), 4000);
    }

    async function attempt(task, successText) {
        try {
            const out = await task();
            if (successText) toast(successText);
            return out === undefined ? true : out;
        } catch (err) {
            toast(err.message, 'error');
            return undefined;
        }
    }

    function tableHtml(headers, rows, emptyText = 'Nothing to show yet', scroll = false) {
        if (!rows.length) return `<p class="empty">${emptyText}</p>`;
        const head = headers.map((h) => `<th>${h}</th>`).join('');
        const body = rows.map((cells) => `<tr>${cells.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('');
        return `<div class="table-wrap${scroll ? ' scroll' : ''}"><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`;
    }

    function pagerHtml(meta) {
        if (!meta) return '';
        if (meta.pages <= 1) return `<div class="pager"><span class="muted">${meta.total} record(s)</span></div>`;
        return `<div class="pager">
            <button class="btn small ghost" data-page="${meta.page - 1}" ${meta.page <= 1 ? 'disabled' : ''}>&lsaquo; Prev</button>
            <span>Page ${meta.page} of ${meta.pages} &middot; ${meta.total} records</span>
            <button class="btn small ghost" data-page="${meta.page + 1}" ${meta.page >= meta.pages ? 'disabled' : ''}>Next &rsaquo;</button>
        </div>`;
    }

    function statTiles(pairs) {
        return `<div class="tiles">${pairs.map(([label, value]) =>
            `<div class="tile"><span>${label}</span><strong>${value}</strong></div>`).join('')}</div>`;
    }

    function statusOptions(selected, firstLabel = 'All statuses') {
        return `<option value="">${firstLabel}</option>` + STATUS_LIST.map((s) =>
            `<option value="${s}" ${selected === s ? 'selected' : ''}>${nice(s)}</option>`).join('');
    }

    const modal = $('#modal');
    const modalBody = $('#modalBody');

    function openModal(html, wide = false) {
        modalBody.innerHTML = html;
        modalBody.onclick = null;
        modalBody.onsubmit = null;
        modal.classList.toggle('wide', wide);
        modal.classList.remove('hidden');
        return modalBody;
    }

    function closeModal() {
        modal.classList.add('hidden');
        modalBody.innerHTML = '';
    }

    modal.addEventListener('click', (e) => {
        if (e.target === modal || e.target.closest('[data-close]')) closeModal();
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeModal();
    });

    function showAuthScreen() {
        $('#appScreen').classList.add('hidden');
        $('#authScreen').classList.remove('hidden');
    }

    function switchAuthTab(which) {
        $$('[data-auth-tab]').forEach((b) => b.classList.toggle('active', b.dataset.authTab === which));
        $('#loginForm').classList.toggle('hidden', which !== 'login');
        $('#registerForm').classList.toggle('hidden', which !== 'register');
    }

    $$('[data-auth-tab]').forEach((btn) => btn.addEventListener('click', () => switchAuthTab(btn.dataset.authTab)));

    $$('[data-demo]').forEach((btn) => btn.addEventListener('click', () => {
        const [email, password] = btn.dataset.demo.split('|');
        switchAuthTab('login');
        $('#loginForm').email.value = email;
        $('#loginForm').password.value = password;
    }));

    $('#loginForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const res = await attempt(() => Api.call('/auth/login', { method: 'POST', body: formValues(e.target) }));
        if (!res) return;
        Session.save(res.data);
        e.target.reset();
        startDashboard();
    });

    $('#registerForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const values = formValues(e.target);
        if (!values.phone) delete values.phone;
        const res = await attempt(() => Api.call('/auth/register', { method: 'POST', body: values }), 'Welcome! Your account is ready.');
        if (!res) return;
        Session.save(res.data);
        e.target.reset();
        startDashboard();
    });

    $('#logoutBtn').addEventListener('click', () => {
        Session.clear();
        closeModal();
        showAuthScreen();
    });

    Api.onExpired = () => {
        Session.clear();
        closeModal();
        showAuthScreen();
    };

    async function startDashboard() {
        const me = await attempt(() => Api.call('/auth/me'));
        if (!me) {
            Session.clear();
            return showAuthScreen();
        }

        Session.save({ token: Session.token, user: { ...Session.user, fullName: me.data.fullName, role: me.data.role } });
        typeCache = [];
        loanFilters = { page: 1, status: '', search: '', loanType: '' };
        userFilters = { page: 1, search: '', role: '', deleted: '' };

        $('#authScreen').classList.add('hidden');
        $('#appScreen').classList.remove('hidden');
        $('#whoName').textContent = me.data.fullName;
        $('#whoRole').textContent = ROLE_LABEL[me.data.role];

        const items = MENUS[me.data.role];
        $('#mainNav').innerHTML = items.map(([key, label]) => `<button data-tab="${key}">${label}</button>`).join('');
        openTab(items[0][0]);
    }

    $('#mainNav').addEventListener('click', (e) => {
        const btn = e.target.closest('[data-tab]');
        if (btn) openTab(btn.dataset.tab);
    });

    function openTab(key) {
        currentTab = key;
        $$('#mainNav [data-tab]').forEach((b) => b.classList.toggle('active', b.dataset.tab === key));
        viewBox.onclick = null;
        viewBox.onsubmit = null;
        viewBox.onchange = null;
        viewBox.innerHTML = '<p class="muted">Loading…</p>';
        VIEWS[key]();
    }

    function drawCalculator() {
        viewBox.innerHTML = `
            <section class="card">
                <h2>EMI Calculator</h2>
                <p class="muted">Reducing balance: EMI = P &times; r &times; (1+r)<sup>n</sup> / ((1+r)<sup>n</sup> &minus; 1), r = yearly rate / 12 / 100</p>
                <form class="form-grid three">
                    <label>Loan amount (₹)<input name="amount" type="number" min="1" step="any" value="500000" required></label>
                    <label>Interest rate (% per year)<input name="annualRate" type="number" min="0" max="50" step="0.01" value="10.5" required></label>
                    <label>Tenure (months)<input name="tenureMonths" type="number" min="1" max="480" value="36" required></label>
                    <div class="form-actions"><button class="btn">Calculate</button></div>
                </form>
                <div id="calcResult"></div>
            </section>`;

        viewBox.onsubmit = async (e) => {
            e.preventDefault();
            const v = formValues(e.target);
            const res = await attempt(() => Api.call('/emi/calculate', {
                method: 'POST',
                body: { amount: Number(v.amount), annualRate: Number(v.annualRate), tenureMonths: Number(v.tenureMonths), includeSchedule: true }
            }));
            if (!res) return;

            const d = res.data;
            $('#calcResult').innerHTML =
                statTiles([['Monthly EMI', rupees(d.emi)], ['Total interest', rupees(d.totalInterest)], ['Total payable', rupees(d.totalPayable)]])
                + '<h3>Repayment schedule</h3>'
                + tableHtml(['#', 'Due date', 'EMI', 'Principal', 'Interest', 'Balance'],
                    d.schedule.map((r) => [r.installmentNo, shortDate(r.dueDate), rupees(r.amount), rupees(r.principalPart), rupees(r.interestPart), rupees(r.closingBalance)]),
                    '', true);
        };
    }

    async function drawApply() {
        const res = await attempt(() => Api.call('/loan-types'));
        if (!res) return;
        typeCache = res.data;

        viewBox.innerHTML = `
            <section class="card narrow">
                <h2>Apply for a Loan</h2>
                <form id="applyForm" class="form-grid">
                    <label class="span-2">Loan type
                        <select name="loanTypeId" required>
                            <option value="">— choose a loan type —</option>
                            ${typeCache.map((t) => `<option value="${t._id}">${esc(t.name)} · ${t.annualRate}% p.a.</option>`).join('')}
                        </select>
                    </label>
                    <div id="typeInfo" class="info span-2 hidden"></div>
                    <label>Amount (₹)<input name="amount" type="number" min="1" step="any" required></label>
                    <label>Tenure (months)<input name="tenureMonths" type="number" min="1" required></label>
                    <label>Monthly income (₹)<input name="monthlyIncome" type="number" min="0" step="any"></label>
                    <label>Employment
                        <select name="employmentType">
                            <option value="salaried">Salaried</option>
                            <option value="self_employed">Self employed</option>
                            <option value="student">Student</option>
                            <option value="other">Other</option>
                        </select>
                    </label>
                    <label class="span-2">Purpose<textarea name="purpose" rows="2" maxlength="300"></textarea></label>
                    <div id="emiPreview" class="span-2"></div>
                    <div class="form-actions span-2">
                        <button type="button" class="btn ghost" data-act="preview">Preview EMI</button>
                        <button class="btn">Submit application</button>
                    </div>
                </form>
            </section>`;

        const form = $('#applyForm');
        const chosenType = () => typeCache.find((t) => t._id === form.loanTypeId.value);

        viewBox.onchange = (e) => {
            if (e.target.name !== 'loanTypeId') return;
            const type = chosenType();
            const box = $('#typeInfo');
            if (!type) return box.classList.add('hidden');

            box.innerHTML = `<strong>${esc(type.name)}</strong> — ${esc(type.description)}<br>
                Rate <b>${type.annualRate}%</b> p.a. &middot; Amount ${rupees(type.minAmount)} – ${rupees(type.maxAmount)}
                &middot; Tenure ${type.minTenure}–${type.maxTenure} months<br>
                Documents needed: ${type.requiredDocuments.map(esc).join(', ') || '—'}`;
            box.classList.remove('hidden');
            form.amount.min = type.minAmount;
            form.amount.max = type.maxAmount;
            form.tenureMonths.min = type.minTenure;
            form.tenureMonths.max = type.maxTenure;
        };

        viewBox.onclick = async (e) => {
            if (!e.target.closest('[data-act="preview"]')) return;
            const type = chosenType();
            const amount = Number(form.amount.value);
            const tenureMonths = Number(form.tenureMonths.value);
            if (!type || !amount || !tenureMonths) return toast('Pick a loan type and enter amount and tenure first', 'error');

            const res = await attempt(() => Api.call('/emi/calculate', { method: 'POST', body: { amount, annualRate: type.annualRate, tenureMonths } }));
            if (res) {
                $('#emiPreview').innerHTML = statTiles([['Monthly EMI', rupees(res.data.emi)], ['Total interest', rupees(res.data.totalInterest)], ['Total payable', rupees(res.data.totalPayable)]]);
            }
        };

        viewBox.onsubmit = async (e) => {
            e.preventDefault();
            const v = formValues(form);
            const body = {
                loanTypeId: v.loanTypeId,
                amount: Number(v.amount),
                tenureMonths: Number(v.tenureMonths),
                employmentType: v.employmentType,
                purpose: v.purpose
            };
            if (v.monthlyIncome) body.monthlyIncome = Number(v.monthlyIncome);

            const res = await attempt(() => Api.call('/loans', { method: 'POST', body }), 'Application submitted. Now upload your documents.');
            if (res) {
                openTab('mine');
                openLoan(res.data._id);
            }
        };
    }

    async function drawLoans() {
        const staff = isStaff();
        if (staff && !typeCache.length) {
            const res = await attempt(() => Api.call(myRole() === 'admin' ? '/loan-types?all=true' : '/loan-types'));
            if (res) typeCache = res.data;
        }

        const title = staff ? (myRole() === 'admin' ? 'All Loans' : 'Loan Applications') : 'My Loans';
        viewBox.innerHTML = `
            <section class="card">
                <div class="card-head">
                    <h2>${title}</h2>
                    ${staff ? '' : '<button class="btn small" data-act="new">+ New application</button>'}
                </div>
                <form class="filters">
                    <input name="search" value="${esc(loanFilters.search)}"
                        placeholder="${staff ? 'Search ref no, customer name or email' : 'Search ref no or purpose'}">
                    <select name="status">${statusOptions(loanFilters.status)}</select>
                    ${staff ? `<select name="loanType"><option value="">All loan types</option>${typeCache.map((t) =>
                        `<option value="${t._id}" ${loanFilters.loanType === t._id ? 'selected' : ''}>${esc(t.name)}</option>`).join('')}</select>` : ''}
                    <button class="btn small">Filter</button>
                </form>
                <div id="loanRows"><p class="muted">Loading…</p></div>
            </section>`;

        viewBox.onsubmit = (e) => {
            e.preventDefault();
            Object.assign(loanFilters, formValues(e.target), { page: 1 });
            refreshLoanRows();
        };

        viewBox.onclick = (e) => {
            const pageBtn = e.target.closest('[data-page]');
            if (pageBtn) {
                loanFilters.page = Number(pageBtn.dataset.page);
                return refreshLoanRows();
            }
            const openBtn = e.target.closest('[data-loan]');
            if (openBtn) return openLoan(openBtn.dataset.loan);
            if (e.target.closest('[data-act="new"]')) openTab('apply');
        };

        refreshLoanRows();
    }

    async function refreshLoanRows() {
        const box = $('#loanRows');
        if (!box) return;

        const params = new URLSearchParams({ page: loanFilters.page, limit: 10 });
        ['status', 'search', 'loanType'].forEach((key) => {
            if (loanFilters[key]) params.set(key, loanFilters[key]);
        });

        const res = await attempt(() => Api.call(`/loans?${params}`));
        if (!res) return;

        const staff = isStaff();
        const headers = ['Ref no', ...(staff ? ['Customer'] : []), 'Type', 'Amount', 'Tenure', 'EMI', 'Status', 'Applied', ''];
        const rows = res.data.map((l) => [
            `<b>${esc(l.refNo)}</b>`,
            ...(staff ? [l.customer ? `${esc(l.customer.fullName)}<br><small class="muted">${esc(l.customer.email)}</small>` : '—'] : []),
            esc(l.loanType ? l.loanType.name : '—'),
            rupees(l.amount),
            `${l.tenureMonths} m`,
            rupees(l.emi),
            statusPill(l.status),
            shortDate(l.createdAt),
            `<button class="btn small ghost" data-loan="${l._id}">Open</button>`
        ]);

        box.innerHTML = tableHtml(headers, rows, staff ? 'No applications match these filters' : 'You have not applied for any loan yet')
            + pagerHtml(res.meta);
    }

    async function openLoan(loanId) {
        const res = await attempt(() => Api.call(`/loans/${loanId}`));
        if (!res) return;

        const { loan, documents, history } = res.data;
        const staff = isStaff();
        const customer = myRole() === 'customer';
        const isOpen = ['pending', 'under_review'].includes(loan.status);
        const hasPlan = ['approved', 'closed'].includes(loan.status);

        let plan = null;
        let payments = [];
        if (hasPlan) {
            const extra = await attempt(() => Promise.all([
                Api.call(`/loans/${loanId}/schedule`),
                Api.call(`/loans/${loanId}/payments?limit=50`)
            ]));
            if (extra) {
                plan = extra[0].data;
                payments = extra[1].data;
            }
        }
        const dueRows = plan ? plan.rows.filter((r) => r.status === 'due') : [];

        const facts = [
            ...(staff && loan.customer ? [['Customer', `${esc(loan.customer.fullName)}<br><small>${esc(loan.customer.email)} ${esc(loan.customer.phone)}</small>`]] : []),
            ['Loan type', esc(loan.loanType ? loan.loanType.name : '—')],
            ['Amount', rupees(loan.amount)],
            ['Interest', `${loan.interestRate}% p.a.`],
            ['Tenure', `${loan.tenureMonths} months`],
            ['Monthly EMI', rupees(loan.emi)],
            ['Total interest', rupees(loan.totalInterest)],
            ['Total payable', rupees(loan.totalPayable)],
            ['Paid', rupees(loan.amountPaid)],
            ['Outstanding', rupees(loan.outstanding)],
            ['Employment', nice(loan.employmentType)],
            ['Monthly income', loan.monthlyIncome ? rupees(loan.monthlyIncome) : '—'],
            ['Applied on', dateTime(loan.createdAt)],
            ['Decided on', dateTime(loan.decidedAt)],
            ['Purpose', esc(loan.purpose || '—')]
        ];

        const parts = [
            `<div class="modal-head"><h2>${esc(loan.refNo)}</h2>${statusPill(loan.status)}</div>`,
            `<dl class="facts">${facts.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl>`,
            '<div class="btn-row"><button class="btn small ghost" data-act="statement">Download statement (PDF)</button></div>'
        ];

        if (staff && isOpen) parts.push(officerPanel(loan));
        if (customer && loan.status === 'approved') parts.push(repayPanel(dueRows));
        parts.push(remarksBlock(loan, staff));
        parts.push(documentsBlock(documents, staff || isOpen, staff || isOpen));
        if (plan) parts.push(scheduleBlock(plan), paymentsBlock(payments));
        parts.push(historyBlock(history));
        if (staff && loan.status !== 'approved') {
            parts.push('<div class="danger-zone"><button class="btn small danger" data-act="delete">Delete application</button></div>');
        }

        const body = openModal(parts.join(''), true);
        body.onclick = (e) => {
            const el = e.target.closest('[data-act]');
            if (el) onLoanAction(el, loan);
        };
        body.onsubmit = (e) => {
            e.preventDefault();
            onLoanForm(e.target, loan);
        };
    }

    function officerPanel(loan) {
        return `
            <section class="panel">
                <h3>Officer actions</h3>
                ${loan.status === 'pending' ? '<p><button class="btn small ghost" data-act="review">Start review</button></p>' : ''}
                <label>Decision remark
                    <textarea id="decisionNote" rows="2" maxlength="500" placeholder="Required when rejecting"></textarea>
                </label>
                <div class="btn-row">
                    <button class="btn small success" data-act="approve">Approve</button>
                    <button class="btn small danger" data-act="reject">Reject</button>
                </div>
                <details>
                    <summary>Edit amount / tenure / rate</summary>
                    <form data-form="edit" class="form-grid three">
                        <label>Amount<input name="amount" type="number" step="any" min="1" value="${loan.amount}"></label>
                        <label>Tenure (months)<input name="tenureMonths" type="number" min="1" value="${loan.tenureMonths}"></label>
                        <label>Rate %<input name="interestRate" type="number" step="0.01" min="0" max="50" value="${loan.interestRate}"></label>
                        <div class="form-actions"><button class="btn small">Save changes</button></div>
                    </form>
                </details>
            </section>`;
    }

    function repayPanel(dueRows) {
        const next = dueRows[0];
        const nextText = next ? `${rupees(next.amount)} on ${shortDate(next.dueDate)}` : '—';
        const settleText = next ? rupees(next.openingBalance + next.interestPart) : '—';
        return `
            <section class="panel">
                <h3>Repay loan</h3>
                <p class="muted">${dueRows.length} instalment(s) left. Next due: <b>${nextText}</b>. Close early today for <b>${settleText}</b>.</p>
                <form data-form="repay" class="form-grid three">
                    <label>Instalments to pay<input name="installments" type="number" min="1" max="${dueRows.length}" value="1"></label>
                    <label>Payment mode<select name="mode">${PAY_MODES.map((m) => `<option value="${m}">${m.toUpperCase()}</option>`).join('')}</select></label>
                    <div class="form-actions">
                        <button class="btn small">Pay EMI</button>
                        <button type="button" class="btn small ghost" data-act="foreclose">Close loan early</button>
                    </div>
                </form>
                <p class="hint">Payments are simulated (no real money moves).</p>
            </section>`;
    }

    function remarksBlock(loan, staff) {
        const list = loan.remarks.length
            ? `<ul class="notes">${loan.remarks.slice().reverse().map((r) => `
                <li><b>${esc(r.authorName || 'Staff')}</b> <small class="muted">${nice(r.authorRole)} &middot; ${dateTime(r.createdAt)}</small><br>${esc(r.note)}</li>`).join('')}</ul>`
            : '<p class="empty">No remarks yet</p>';
        const form = staff
            ? '<form data-form="remark" class="inline-form"><input name="note" placeholder="Write a remark" maxlength="500" required><button class="btn small">Add remark</button></form>'
            : '';
        return `<section class="panel"><h3>Remarks</h3>${list}${form}</section>`;
    }

    function documentsBlock(documents, canUpload, canRemove) {
        const rows = documents.map((d) => [
            esc(d.docType),
            esc(d.originalName),
            `${Math.max(1, Math.round(d.sizeBytes / 1024))} KB`,
            shortDate(d.createdAt),
            `<button class="btn small ghost" data-act="get-doc" data-id="${d._id}" data-name="${esc(d.originalName)}">Download</button>`
            + (canRemove ? ` <button class="btn small ghost danger-text" data-act="drop-doc" data-id="${d._id}">Remove</button>` : '')
        ]);
        const upload = canUpload ? `
            <form data-form="upload" class="inline-form">
                <input name="docType" list="docHints" placeholder="Document type (e.g. ID Proof)" required>
                <datalist id="docHints">${DOC_HINTS.map((h) => `<option value="${h}">`).join('')}</datalist>
                <input type="file" name="file" accept=".pdf,.jpg,.jpeg,.png" required>
                <button class="btn small">Upload</button>
            </form>
            <p class="hint">PDF, JPG or PNG, up to 5 MB.</p>` : '';
        return `<section class="panel"><h3>Documents</h3>${tableHtml(['Type', 'File', 'Size', 'Uploaded', ''], rows, 'No documents uploaded')}${upload}</section>`;
    }

    function scheduleBlock(plan) {
        const rows = plan.rows.map((r) => [r.installmentNo, shortDate(r.dueDate), rupees(r.amount), rupees(r.principalPart),
            rupees(r.interestPart), rupees(r.closingBalance), statusPill(r.status === 'due' ? 'due' : r.status)]);
        return `<section class="panel"><h3>EMI schedule <small class="muted">(${plan.paidCount}/${plan.rows.length} settled)</small></h3>
            ${tableHtml(['#', 'Due date', 'EMI', 'Principal', 'Interest', 'Balance', 'Status'], rows, '', true)}</section>`;
    }

    function paymentsBlock(payments) {
        const rows = payments.map((p) => [dateTime(p.paidAt), esc(p.txnRef), esc(p.mode.toUpperCase()), nice(p.kind),
            esc(p.installments.join(', ')), rupees(p.amount)]);
        return `<section class="panel"><h3>Payment history</h3>
            ${tableHtml(['Date', 'Transaction', 'Mode', 'Type', 'Instalments', 'Amount'], rows, 'No payments yet')}</section>`;
    }

    function historyBlock(history) {
        if (!history.length) return '';
        return `<section class="panel"><h3>Activity</h3><ul class="timeline">${history.map((h) => `
            <li>
                <b>${nice(h.action)}</b>
                ${h.toStatus ? `<small>${h.fromStatus ? nice(h.fromStatus) + ' &rarr; ' : ''}${nice(h.toStatus)}</small>` : ''}
                <br><small class="muted">${esc(h.actor ? h.actor.fullName : 'system')} &middot; ${dateTime(h.createdAt)}</small>
                ${h.note ? `<div>${esc(h.note)}</div>` : ''}
            </li>`).join('')}</ul></section>`;
    }

    function afterLoanChange(loanId) {
        openLoan(loanId);
        if (currentTab === 'queue' || currentTab === 'mine') refreshLoanRows();
    }

    async function onLoanAction(el, loan) {
        const id = loan._id;
        const act = el.dataset.act;

        if (act === 'statement') {
            return attempt(() => Api.download(`/loans/${id}/statement`, `statement-${loan.refNo}.pdf`));
        }
        if (act === 'get-doc') {
            return attempt(() => Api.download(`/documents/${el.dataset.id}/download`, el.dataset.name));
        }
        if (act === 'review') {
            if (await attempt(() => Api.call(`/loans/${id}/review`, { method: 'PATCH' }), 'Moved to review')) afterLoanChange(id);
            return;
        }
        if (act === 'approve' || act === 'reject') {
            const remark = $('#decisionNote').value.trim();
            if (act === 'reject' && !remark) return toast('Please write a reason for rejecting', 'error');
            if (!confirm(`${act === 'approve' ? 'Approve' : 'Reject'} application ${loan.refNo}?`)) return;

            const body = { decision: act };
            if (remark) body.remark = remark;
            const done = await attempt(() => Api.call(`/loans/${id}/decision`, { method: 'POST', body }),
                act === 'approve' ? 'Loan approved, EMI schedule created' : 'Application rejected');
            if (done) afterLoanChange(id);
            return;
        }
        if (act === 'foreclose') {
            const mode = $('[data-form="repay"] [name="mode"]', modalBody).value;
            if (!confirm('Pay the remaining principal and close this loan now?')) return;
            const done = await attempt(() => Api.call(`/loans/${id}/repayments`, { method: 'POST', body: { mode, settleAll: true } }), 'Loan closed. Thank you!');
            if (done) afterLoanChange(id);
            return;
        }
        if (act === 'drop-doc') {
            if (!confirm('Remove this document?')) return;
            if (await attempt(() => Api.call(`/documents/${el.dataset.id}`, { method: 'DELETE' }), 'Document removed')) afterLoanChange(id);
            return;
        }
        if (act === 'delete') {
            if (!confirm(`Delete application ${loan.refNo}? It can still be found in the database (soft delete).`)) return;
            if (await attempt(() => Api.call(`/loans/${id}`, { method: 'DELETE' }), 'Application deleted')) {
                closeModal();
                refreshLoanRows();
            }
        }
    }

    async function onLoanForm(form, loan) {
        const id = loan._id;
        const v = formValues(form);
        let done;

        switch (form.dataset.form) {
            case 'remark':
                done = await attempt(() => Api.call(`/loans/${id}/remarks`, { method: 'POST', body: { note: v.note } }), 'Remark added');
                break;
            case 'upload':
                done = await attempt(() => Api.call(`/loans/${id}/documents`, { method: 'POST', form: new FormData(form) }), 'Document uploaded');
                break;
            case 'edit':
                done = await attempt(() => Api.call(`/loans/${id}`, {
                    method: 'PUT',
                    body: { amount: Number(v.amount), tenureMonths: Number(v.tenureMonths), interestRate: Number(v.interestRate) }
                }), 'Application updated');
                break;
            case 'repay':
                done = await attempt(() => Api.call(`/loans/${id}/repayments`, {
                    method: 'POST',
                    body: { mode: v.mode, installments: Number(v.installments) || 1 }
                }), 'Payment successful');
                break;
            default:
                return;
        }
        if (done) afterLoanChange(id);
    }

    let userRowsCache = [];

    function drawUsers() {
        viewBox.innerHTML = `
            <section class="card">
                <div class="card-head"><h2>Users</h2><button class="btn small" data-act="add-user">+ Add user</button></div>
                <form class="filters">
                    <input name="search" value="${esc(userFilters.search)}" placeholder="Search name, email or phone">
                    <select name="role">
                        <option value="">All roles</option>
                        ${Object.keys(ROLE_LABEL).map((r) => `<option value="${r}" ${userFilters.role === r ? 'selected' : ''}>${ROLE_LABEL[r]}</option>`).join('')}
                    </select>
                    <select name="deleted">
                        <option value="">Current users</option>
                        <option value="include" ${userFilters.deleted === 'include' ? 'selected' : ''}>Include deleted</option>
                        <option value="only" ${userFilters.deleted === 'only' ? 'selected' : ''}>Only deleted</option>
                    </select>
                    <button class="btn small">Filter</button>
                </form>
                <div id="userRows"><p class="muted">Loading…</p></div>
            </section>`;

        viewBox.onsubmit = (e) => {
            e.preventDefault();
            Object.assign(userFilters, formValues(e.target), { page: 1 });
            refreshUserRows();
        };

        viewBox.onclick = async (e) => {
            const pageBtn = e.target.closest('[data-page]');
            if (pageBtn) {
                userFilters.page = Number(pageBtn.dataset.page);
                return refreshUserRows();
            }
            const el = e.target.closest('[data-act]');
            if (!el) return;
            const user = userRowsCache.find((u) => u._id === el.dataset.id);

            if (el.dataset.act === 'add-user') return openUserForm(null);
            if (el.dataset.act === 'edit-user') return openUserForm(user);
            if (el.dataset.act === 'delete-user') {
                if (!confirm(`Delete ${user.fullName}? They will not be able to log in.`)) return;
                if (await attempt(() => Api.call(`/users/${user._id}`, { method: 'DELETE' }), 'User deleted')) refreshUserRows();
            }
            if (el.dataset.act === 'restore-user') {
                if (await attempt(() => Api.call(`/users/${user._id}/restore`, { method: 'PATCH' }), 'User restored')) refreshUserRows();
            }
        };

        refreshUserRows();
    }

    async function refreshUserRows() {
        const params = new URLSearchParams({ page: userFilters.page, limit: 10 });
        ['search', 'role', 'deleted'].forEach((key) => {
            if (userFilters[key]) params.set(key, userFilters[key]);
        });

        const res = await attempt(() => Api.call(`/users?${params}`));
        if (!res) return;
        userRowsCache = res.data;

        const rows = res.data.map((u) => {
            let state = u.isActive ? '<span class="pill pill-approved">active</span>' : '<span class="pill pill-pending">disabled</span>';
            if (u.isDeleted) state = '<span class="pill pill-rejected">deleted</span>';
            const actions = u.isDeleted
                ? `<button class="btn small ghost" data-act="restore-user" data-id="${u._id}">Restore</button>`
                : `<button class="btn small ghost" data-act="edit-user" data-id="${u._id}">Edit</button>
                   <button class="btn small ghost danger-text" data-act="delete-user" data-id="${u._id}">Delete</button>`;
            return [esc(u.fullName), esc(u.email), esc(u.phone || '—'), esc(u.role ? ROLE_LABEL[u.role.name] : '—'), state, dateTime(u.lastLoginAt), actions];
        });

        $('#userRows').innerHTML = tableHtml(['Name', 'Email', 'Phone', 'Role', 'Status', 'Last login', ''], rows, 'No users found') + pagerHtml(res.meta);
    }

    function openUserForm(user) {
        const roleSelect = Object.keys(ROLE_LABEL).map((r) =>
            `<option value="${r}" ${user && user.role && user.role.name === r ? 'selected' : ''}>${ROLE_LABEL[r]}</option>`).join('');

        const body = openModal(`
            <h2>${user ? 'Edit user' : 'Add user'}</h2>
            <form class="form-grid">
                <label>Full name<input name="fullName" value="${esc(user ? user.fullName : '')}" required minlength="2"></label>
                ${user ? `<label>Email<input value="${esc(user.email)}" disabled></label>` : '<label>Email<input name="email" type="email" required></label>'}
                <label>Phone<input name="phone" value="${esc(user ? user.phone : '')}"></label>
                <label>Role<select name="role">${roleSelect}</select></label>
                <label>${user ? 'New password (leave empty to keep)' : 'Password'}<input name="password" type="password" minlength="6" ${user ? '' : 'required'}></label>
                ${user ? `<label class="check"><input type="checkbox" name="isActive" ${user.isActive ? 'checked' : ''}> Account active</label>` : ''}
                <div class="form-actions span-2"><button class="btn">${user ? 'Save changes' : 'Create user'}</button></div>
            </form>`);

        body.onsubmit = async (e) => {
            e.preventDefault();
            const v = formValues(e.target);
            let done;

            if (user) {
                const payload = { fullName: v.fullName, phone: v.phone, role: v.role, isActive: e.target.isActive.checked };
                if (v.password) payload.password = v.password;
                done = await attempt(() => Api.call(`/users/${user._id}`, { method: 'PUT', body: payload }), 'User updated');
            } else {
                if (!v.phone) delete v.phone;
                done = await attempt(() => Api.call('/users', { method: 'POST', body: v }), 'User created');
            }

            if (done) {
                closeModal();
                refreshUserRows();
            }
        };
    }

    async function drawTypes() {
        const res = await attempt(() => Api.call('/loan-types?all=true'));
        if (!res) return;
        typeCache = res.data;

        const rows = typeCache.map((t) => [
            `<b>${esc(t.name)}</b><br><small class="muted">${esc(t.code)}</small>`,
            `<b>${t.annualRate}%</b>`,
            `${rupees(t.minAmount)} – ${rupees(t.maxAmount)}`,
            `${t.minTenure}–${t.maxTenure} m`,
            `<small>${t.requiredDocuments.map(esc).join(', ') || '—'}</small>`,
            t.isActive ? '<span class="pill pill-approved">active</span>' : '<span class="pill pill-pending">inactive</span>',
            `<button class="btn small ghost" data-act="edit-type" data-id="${t._id}">Edit</button>
             <button class="btn small ghost" data-act="rate-type" data-id="${t._id}">Rate</button>
             <button class="btn small ghost danger-text" data-act="delete-type" data-id="${t._id}">Delete</button>`
        ]);

        viewBox.innerHTML = `
            <section class="card">
                <div class="card-head"><h2>Loan Types &amp; Interest Rates</h2><button class="btn small" data-act="add-type">+ Add loan type</button></div>
                ${tableHtml(['Loan type', 'Rate (p.a.)', 'Amount range', 'Tenure', 'Documents', 'Status', ''], rows, 'No loan types yet')}
            </section>`;

        viewBox.onclick = async (e) => {
            const el = e.target.closest('[data-act]');
            if (!el) return;
            const type = typeCache.find((t) => t._id === el.dataset.id);

            if (el.dataset.act === 'add-type') return openTypeForm(null);
            if (el.dataset.act === 'edit-type') return openTypeForm(type);
            if (el.dataset.act === 'rate-type') return openRateForm(type);
            if (el.dataset.act === 'delete-type') {
                if (!confirm(`Delete ${type.name}? Existing loans keep working.`)) return;
                if (await attempt(() => Api.call(`/loan-types/${type._id}`, { method: 'DELETE' }), 'Loan type deleted')) drawTypes();
            }
        };
    }

    function openTypeForm(type) {
        const t = type || { name: '', code: '', description: '', minAmount: '', maxAmount: '', minTenure: '', maxTenure: '', requiredDocuments: [], isActive: true };

        const body = openModal(`
            <h2>${type ? 'Edit loan type' : 'Add loan type'}</h2>
            <form class="form-grid">
                <label>Name<input name="name" value="${esc(t.name)}" required></label>
                <label>Code<input name="code" value="${esc(t.code)}" required placeholder="e.g. GOLD"></label>
                <label class="span-2">Description<input name="description" value="${esc(t.description)}"></label>
                <label>Min amount (₹)<input name="minAmount" type="number" min="1" value="${t.minAmount}" required></label>
                <label>Max amount (₹)<input name="maxAmount" type="number" min="1" value="${t.maxAmount}" required></label>
                <label>Min tenure (months)<input name="minTenure" type="number" min="1" value="${t.minTenure}" required></label>
                <label>Max tenure (months)<input name="maxTenure" type="number" min="1" value="${t.maxTenure}" required></label>
                ${type ? '' : '<label>Interest rate (% p.a.)<input name="annualRate" type="number" step="0.01" min="0" max="50" required></label>'}
                <label class="span-2">Required documents (comma separated)<input name="requiredDocuments" value="${esc(t.requiredDocuments.join(', '))}"></label>
                <label class="check"><input type="checkbox" name="isActive" ${t.isActive ? 'checked' : ''}> Open for applications</label>
                <div class="form-actions span-2"><button class="btn">${type ? 'Save changes' : 'Create'}</button></div>
            </form>`);

        body.onsubmit = async (e) => {
            e.preventDefault();
            const v = formValues(e.target);
            const payload = {
                name: v.name,
                code: v.code,
                description: v.description,
                minAmount: Number(v.minAmount),
                maxAmount: Number(v.maxAmount),
                minTenure: Number(v.minTenure),
                maxTenure: Number(v.maxTenure),
                requiredDocuments: v.requiredDocuments.split(',').map((s) => s.trim()).filter(Boolean),
                isActive: e.target.isActive.checked
            };
            if (!type) payload.annualRate = Number(v.annualRate);

            const done = type
                ? await attempt(() => Api.call(`/loan-types/${type._id}`, { method: 'PUT', body: payload }), 'Loan type updated')
                : await attempt(() => Api.call('/loan-types', { method: 'POST', body: payload }), 'Loan type created');
            if (done) {
                closeModal();
                drawTypes();
            }
        };
    }

    async function openRateForm(type) {
        const res = await attempt(() => Api.call(`/loan-types/${type._id}`));
        if (!res) return;

        const history = res.data.rateHistory.slice().reverse().map((h) => [
            `<b>${h.rate}%</b>`, dateTime(h.changedAt), esc(h.changedBy ? h.changedBy.fullName : 'system')
        ]);

        const body = openModal(`
            <h2>Interest rate — ${esc(type.name)}</h2>
            <p class="muted">New rate applies to new applications only. Existing loans keep their rate.</p>
            <form class="inline-form">
                <input name="annualRate" type="number" step="0.01" min="0" max="50" value="${type.annualRate}" required>
                <button class="btn small">Update rate</button>
            </form>
            <h3>Rate history</h3>
            ${tableHtml(['Rate', 'Changed on', 'By'], history)}`);

        body.onsubmit = async (e) => {
            e.preventDefault();
            const annualRate = Number(e.target.annualRate.value);
            const done = await attempt(() => Api.call(`/loan-types/${type._id}/rate`, { method: 'PATCH', body: { annualRate } }), 'Interest rate updated');
            if (done) {
                closeModal();
                drawTypes();
            }
        };
    }

    async function drawReports() {
        const res = await attempt(() => Api.call('/reports/summary'));
        if (!res) return;
        const d = res.data;

        viewBox.innerHTML = `
            <section class="card">
                <h2>Overview</h2>
                ${statTiles([
                    ['Applications', d.totals.applications],
                    ['Amount disbursed', rupees(d.totals.disbursed)],
                    ['EMI collected', rupees(d.totals.collected)],
                    ['Outstanding', rupees(d.totals.outstanding)],
                    ['Customers', d.users.customer || 0],
                    ['Loan officers', d.users.officer || 0]
                ])}
            </section>
            <div class="two-col">
                <section class="card">
                    <h3>Loans by status</h3>
                    ${tableHtml(['Status', 'Count', 'Amount'], STATUS_LIST.map((s) => [statusPill(s), d.loansByStatus[s].count, rupees(d.loansByStatus[s].amount)]))}
                </section>
                <section class="card">
                    <h3>Loans by type</h3>
                    ${tableHtml(['Type', 'Applications', 'Approved', 'Disbursed'],
                        d.byLoanType.map((t) => [esc(t.name), t.applications, t.approved, rupees(t.disbursed)]), 'No applications yet')}
                </section>
            </div>
            <section class="card">
                <h3>Export loan report (CSV)</h3>
                <form class="filters">
                    <select name="status">${statusOptions('')}</select>
                    <label class="inline">From <input type="date" name="from"></label>
                    <label class="inline">To <input type="date" name="to"></label>
                    <button class="btn small">Download CSV</button>
                </form>
            </section>`;

        viewBox.onsubmit = (e) => {
            e.preventDefault();
            const params = new URLSearchParams();
            Object.entries(formValues(e.target)).forEach(([key, value]) => {
                if (value) params.set(key, value);
            });
            attempt(() => Api.download(`/reports/loans.csv?${params}`, 'loans-report.csv'));
        };
    }

    const VIEWS = {
        apply: drawApply,
        mine: drawLoans,
        queue: drawLoans,
        calc: drawCalculator,
        users: drawUsers,
        types: drawTypes,
        reports: drawReports
    };

    Session.load();
    if (Session.token) startDashboard();
    else showAuthScreen();
})();
