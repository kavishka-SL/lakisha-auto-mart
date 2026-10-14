const isCompleted = job => String(job.jobStatus).toUpperCase() === 'COMPLETED';
const isBillable = job => !['REJECTED', 'CANCELLED'].includes(String(job.jobStatus).toUpperCase());

function visitReady(job, jobs) {
  return Number(job.pendingModifications || 0) === 0 && (!job.requestId || (
    String(job.requestStatus).toUpperCase() === 'COMPLETED' &&
    String(job.qualityCheckStatus).toUpperCase() === 'PASS'
  )) && jobs.every(isCompleted);
}

function groupInvoiceWork(rows) {
  const groups = new Map();
  for (const row of rows) {
    const key = row.requestId || row.jobCardId;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }

  const pending = [];
  const completed = rows.filter(row => row.invoiceId && row.jobCardId === row.billingJobId)
    .sort((a, b) => new Date(b.issueDate) - new Date(a.issueDate));
  for (const group of groups.values()) {
    const billable = group.filter(isBillable);
    const unpaid = billable.filter(row => !row.invoiceId);
    if (!unpaid.length || !visitReady(unpaid[0], billable)) continue;
    const first = unpaid[0];
    const paidInvoices = new Map(group.filter(row => row.invoiceId)
      .map(row => [row.invoiceId, Number(row.grandTotal || 0)]));
    pending.push({
      ...first,
      jobCount: unpaid.length,
      previouslyPaid: [...paidInvoices.values()].reduce((sum, amount) => sum + amount, 0)
    });
  }
  pending.sort((a, b) => new Date(b.createdDate) - new Date(a.createdDate));
  return { pending, completed };
}

module.exports = { groupInvoiceWork, visitReady };
