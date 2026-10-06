const PDFDocument = require('pdfkit');
const EmiInstallment = require('../models/EmiInstallment');
const Payment = require('../models/Payment');
const safely = require('../core/safely');
const { fetchLoanForViewer } = require('../services/loanAccess');

const money = (n) => 'Rs. ' + Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const day = (d) => (d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-');

const instalmentText = (nums) => {
    const runsInOrder = nums.every((n, i) => i === 0 || n === nums[i - 1] + 1);
    return nums.length > 2 && runsInOrder ? `${nums[0]}-${nums[nums.length - 1]}` : nums.join(', ');
};

function sectionTitle(pdf, text) {
    pdf.moveDown(0.8);
    pdf.font('Helvetica-Bold').fontSize(12).fillColor('#1f3a5f').text(text, pdf.page.margins.left);
    pdf.fillColor('#000').moveDown(0.3);
}

function detailLines(pdf, pairs) {
    const left = pdf.page.margins.left;
    pairs.forEach(([label, value]) => {
        const y = pdf.y;
        pdf.font('Helvetica-Bold').fontSize(9.5).text(label, left, y, { width: 140 });
        pdf.font('Helvetica').text(String(value), left + 140, y, { width: 360 });
        pdf.moveDown(0.25);
    });
}

function table(pdf, headers, widths, rows) {
    const left = pdf.page.margins.left;
    const fullWidth = widths.reduce((a, b) => a + b, 0);
    const bottomLimit = pdf.page.height - pdf.page.margins.bottom - 18;

    const drawRow = (cells, isHeader) => {
        if (pdf.y > bottomLimit) pdf.addPage();
        const y = pdf.y;
        let x = left;

        pdf.font(isHeader ? 'Helvetica-Bold' : 'Helvetica').fontSize(8.5);
        cells.forEach((cell, i) => {
            pdf.text(String(cell), x + 3, y, { width: widths[i] - 6, lineBreak: false, ellipsis: true });
            x += widths[i];
        });

        pdf.y = y + 15;
        if (isHeader) {
            pdf.moveTo(left, pdf.y - 3).lineTo(left + fullWidth, pdf.y - 3).strokeColor('#8a8a8a').stroke();
        }
    };

    drawRow(headers, true);
    if (!rows.length) {
        pdf.font('Helvetica-Oblique').fontSize(9).text('No records yet', left + 3, pdf.y);
        return;
    }
    rows.forEach((cells) => drawRow(cells, false));
}

const downloadStatement = safely(async (req, res) => {
    const loan = await fetchLoanForViewer(req.params.id, req);
    const [rows, payments] = await Promise.all([
        EmiInstallment.find({ loan: loan._id }).sort({ installmentNo: 1 }),
        Payment.find({ loan: loan._id }).sort({ paidAt: 1 })
    ]);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="statement-${loan.refNo}.pdf"`);

    const pdf = new PDFDocument({ size: 'A4', margin: 40 });
    pdf.pipe(res);

    pdf.font('Helvetica-Bold').fontSize(18).text('LoanDesk - Loan Statement', { align: 'center' });
    pdf.font('Helvetica').fontSize(9).fillColor('#666')
        .text(`Generated on ${new Date().toLocaleString('en-IN')}`, { align: 'center' })
        .fillColor('#000');

    sectionTitle(pdf, 'Loan details');
    detailLines(pdf, [
        ['Reference no.', loan.refNo],
        ['Customer', loan.customer ? `${loan.customer.fullName} (${loan.customer.email})` : '-'],
        ['Loan type', loan.loanType ? loan.loanType.name : '-'],
        ['Status', loan.status.replace('_', ' ').toUpperCase()],
        ['Principal', money(loan.amount)],
        ['Interest rate', `${loan.interestRate}% p.a.`],
        ['Tenure', `${loan.tenureMonths} months`],
        ['Monthly EMI', money(loan.emi)],
        ['Total interest', money(loan.totalInterest)],
        ['Total payable', money(loan.totalPayable)],
        ['Paid so far', money(loan.amountPaid)],
        ['Outstanding', money(loan.outstanding)],
        ['Applied on', day(loan.createdAt)],
        ['Closed on', day(loan.closedAt)]
    ]);

    sectionTitle(pdf, 'Payment history');
    table(
        pdf,
        ['Date', 'Transaction', 'Mode', 'Type', 'Instalments', 'Amount'],
        [70, 125, 60, 70, 95, 95],
        payments.map((p) => [day(p.paidAt), p.txnRef, p.mode.toUpperCase(), p.kind, instalmentText(p.installments), money(p.amount)])
    );

    sectionTitle(pdf, 'EMI schedule');
    table(
        pdf,
        ['#', 'Due date', 'EMI', 'Principal', 'Interest', 'Balance', 'Status'],
        [30, 75, 80, 80, 75, 95, 80],
        rows.map((r) => [r.installmentNo, day(r.dueDate), money(r.amount), money(r.principalPart), money(r.interestPart), money(r.closingBalance), r.status])
    );

    pdf.end();
});

module.exports = { downloadStatement };
