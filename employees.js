const TAX_BANDS = [{ amount: 800000, rate: 0 }, { amount: 2200000, rate: .15 }, { amount: 9000000, rate: .18 }, { amount: 13000000, rate: .21 }, { amount: 25000000, rate: .23 }, { amount: Infinity, rate: .25 }];
const $ = (id) => document.getElementById(id);
const money = (value) => new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(Math.max(0, value));
const number = (value) => Number(value) || 0;
const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[character]));
let employees = [{ id: 1, name: '', salary: 500000 }];

function tax(income) { let remaining = Math.max(0, income); let total = 0; for (const band of TAX_BANDS) { const portion = Math.min(remaining, band.amount); if (portion <= 0) break; total += portion * band.rate; remaining -= portion; } return total; }
function allocations() { return Object.fromEntries([...document.querySelectorAll('.allocation')].map((input) => [input.dataset.key, Math.max(0, number(input.value))])); }
function validAllocation() { const total = Object.values(allocations()).reduce((sum, value) => sum + value, 0); $('allocation-total').textContent = `${total.toFixed(2).replace(/\.00$/, '')}%`; const valid = Math.abs(total - 100) < .005; $('allocation-status').textContent = valid ? 'Ready to calculate' : `${Math.abs(100 - total).toFixed(2).replace(/\.00$/, '')}% ${total < 100 ? 'remaining' : 'over'}`; $('allocation-status').classList.toggle('invalid', !valid); return valid; }
function calculate(grossMonthly) { const parts = allocations(); const basic = grossMonthly * parts.basic / 100; const housing = grossMonthly * parts.housing / 100; const transport = grossMonthly * parts.transport / 100; const other = grossMonthly * parts.other / 100; const pension = $('shared-pension').checked ? (basic + housing + transport) * .08 : 0; const nhf = $('shared-nhf').checked ? basic * .025 : 0; const rentRelief = Math.min(number($('shared-rent').value) * .2, 500000); const annualGross = grossMonthly * 12; const paye = tax(Math.max(0, annualGross - (pension + nhf) * 12 - rentRelief)) / 12; return { gross: grossMonthly, basic, housing, transport, other, paye, pension, nhf, net: Math.max(0, grossMonthly - paye - pension - nhf), rentRelief }; }
function grossForNet(target) { let low = target; let high = target * 2 + 100000; while (calculate(high).net < target) high *= 1.5; for (let i = 0; i < 60; i += 1) { const mid = (low + high) / 2; if (calculate(mid).net < target) low = mid; else high = mid; } return calculate(high); }
function renderInputs() { const container = $('employee-rows'); container.innerHTML = employees.map((employee) => `<div class="employee-row" data-id="${escapeHtml(employee.id)}"><input class="employee-name" type="text" placeholder="Employee full name" value="${escapeHtml(employee.name)}"><div class="row-money"><span>₦</span><input class="employee-salary" type="number" step="any" value="${escapeHtml(employee.salary)}"></div><button class="remove-employee" type="button" title="Remove employee">×</button></div>`).join(''); $('empty-state').classList.toggle('hidden', employees.length > 0); document.querySelectorAll('.employee-name').forEach((input) => input.addEventListener('input', updateEmployee)); document.querySelectorAll('.employee-salary').forEach((input) => input.addEventListener('input', updateEmployee)); document.querySelectorAll('.remove-employee').forEach((button) => button.addEventListener('click', removeEmployee)); }
function updateEmployee(event) { const row = event.target.closest('.employee-row'); const employee = employees.find((item) => item.id === Number(row.dataset.id)); if (event.target.classList.contains('employee-name')) employee.name = event.target.value; else employee.salary = number(event.target.value); calculateAll(); }
function removeEmployee(event) { employees = employees.filter((item) => item.id !== Number(event.target.closest('.employee-row').dataset.id)); renderInputs(); calculateAll(); }
function calculateAll() { if (!validAllocation()) { $('results-body').innerHTML = ''; $('report-summary').textContent = 'Complete the allocation to 100% before calculating'; return; } const mode = $('batch-mode').value; const unit = $('batch-unit').value; const results = employees.map((employee) => ({ employee, result: mode === 'net' ? grossForNet(employee.salary * (unit === 'annual' ? 1 / 12 : 1)) : calculate(employee.salary * (unit === 'annual' ? 1 / 12 : 1)) })); $('results-body').innerHTML = results.map(({ employee, result }) => `<tr><td>${escapeHtml(employee.name || 'Unnamed employee')}</td><td>${money(result.gross)}</td><td>${money(result.basic)}</td><td>${money(result.housing)}</td><td>${money(result.transport)}</td><td>${money(result.other)}</td><td>${money(result.paye)}</td><td>${money(result.pension)}</td><td>${money(result.nhf)}</td><td><strong>${money(result.net)}</strong></td></tr>`).join(''); $('total-net').textContent = money(results.reduce((sum, item) => sum + item.result.net, 0)); $('report-summary').textContent = `${results.length} employee${results.length === 1 ? '' : 's'} / ${mode === 'net' ? 'net targets to gross' : 'gross to net'} / ${unit}`; }
$('add-employee').addEventListener('click', () => { employees.push({ id: Date.now(), name: '', salary: 0 }); renderInputs(); document.querySelector('.employee-row:last-child .employee-name').focus(); }); document.querySelectorAll('.allocation').forEach((input) => input.addEventListener('input', calculateAll)); $('shared-rent').addEventListener('input', calculateAll); $('shared-pension').addEventListener('change', calculateAll); $('shared-nhf').addEventListener('change', calculateAll); $('batch-mode').addEventListener('change', calculateAll); $('batch-unit').addEventListener('change', () => { $('salary-column').textContent = $('batch-mode').value === 'net' ? `Target net / ${$('batch-unit').value}` : `Gross salary / ${$('batch-unit').value}`; calculateAll(); }); $('print').addEventListener('click', () => window.print()); renderInputs(); calculateAll();
const today = new Date();
$('batch-payroll-month').value = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
function batchSnapshot() {
	return { employees: employees.map((employee) => ({ ...employee })), allocations: allocations(), rent: $('shared-rent').value, pension: $('shared-pension').checked, nhf: $('shared-nhf').checked, mode: $('batch-mode').value, unit: $('batch-unit').value };
}
function openBatchPayroll(record) {
	const snapshot = record.snapshot;
	if (!snapshot) {
		$('report-summary').textContent = 'Older record - please recalculate and save again';
		return;
	}
	$('batch-payroll-month').value = record.period;
	employees = snapshot.employees.map((employee) => ({ ...employee }));
	Object.entries(snapshot.allocations).forEach(([key, value]) => { document.querySelector(`[data-key="${key}"]`).value = value; });
	$('shared-rent').value = snapshot.rent;
	$('shared-pension').checked = snapshot.pension;
	$('shared-nhf').checked = snapshot.nhf;
	$('batch-mode').value = snapshot.mode;
	$('batch-unit').value = snapshot.unit;
	$('salary-column').textContent = snapshot.mode === 'net' ? `Target net / ${snapshot.unit}` : `Gross salary / ${snapshot.unit}`;
	renderInputs();
	calculateAll();
}
function navigateToBatchPayroll(record) {
	window.location.href = `${window.location.pathname}?payroll=${encodeURIComponent(record.id)}`;
}
const batchArchive = { type: 'batch', search: $('batch-archive-search'), list: $('batch-archive-list'), empty: $('batch-archive-empty'), onOpen: navigateToBatchPayroll };
$('batch-archive-search').addEventListener('input', () => archiveRender(batchArchive));
$('save-batch-payroll').addEventListener('click', () => {
	if (!employees.length || !validAllocation() || !$('batch-payroll-month').value) return;
	const mode = $('batch-mode').value;
	const unit = $('batch-unit').value;
	const results = employees.map((employee) => ({ employee, result: mode === 'net' ? grossForNet(employee.salary * (unit === 'annual' ? 1 / 12 : 1)) : calculate(employee.salary * (unit === 'annual' ? 1 / 12 : 1)) }));
	archiveAdd({ type: 'batch', period: $('batch-payroll-month').value, title: 'Team payroll', count: results.length, totalNet: results.reduce((sum, item) => sum + item.result.net, 0), snapshot: batchSnapshot() });
	archiveRender(batchArchive);
});
archiveRender(batchArchive);
const savedBatchId = new URLSearchParams(window.location.search).get('payroll');
const savedBatchRecord = archiveLoad().find((record) => String(record.id) === savedBatchId && record.type === 'batch');
if (savedBatchRecord) openBatchPayroll(savedBatchRecord);