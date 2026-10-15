function validateCreateEntry(body) {
  const errors = [];
  const entryNumber = typeof body.entryNumber === 'string' ? body.entryNumber.trim() : '';
  const entryDate = typeof body.entryDate === 'string' ? body.entryDate : '';
  const description = typeof body.description === 'string' ? body.description.trim() : '';
  const createdBy = body.createdBy == null ? null : String(body.createdBy).trim();
  const lines = body.lines;
  if (!entryNumber || entryNumber.length > 30) errors.push('Entry number is required and must be at most 30 characters.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(entryDate) || Number.isNaN(Date.parse(`${entryDate}T00:00:00Z`))) errors.push('Entry date must be a valid date in YYYY-MM-DD format.');
  if (!description || description.length > 500) errors.push('Description is required and must be at most 500 characters.');
  if (createdBy && createdBy.length > 100) errors.push('Created by must be at most 100 characters.');
  if (!Array.isArray(lines) || lines.length < 2 || lines.length > 500) errors.push('Provide between 2 and 500 journal entry lines.');
  let debit = 0; let credit = 0;
  if (Array.isArray(lines)) lines.forEach((line, index) => {
    const prefix = `Line ${index + 1}`;
    const accountId = Number(line.accountId);
    const d = Number(line.debit); const c = Number(line.credit);
    if (!Number.isInteger(accountId) || accountId <= 0) errors.push(`${prefix}: select a valid account.`);
    if (!Number.isFinite(d) || !Number.isFinite(c) || d < 0 || c < 0) errors.push(`${prefix}: debit and credit must be non-negative numbers.`);
    else {
      if ((d > 0 && c > 0) || (d === 0 && c === 0)) errors.push(`${prefix}: enter an amount on either Debit or Credit, not both.`);
      if (Math.max(d, c) > 999999999999999) errors.push(`${prefix}: amount is too large.`);
      debit += d; credit += c;
    }
    if (line.description != null && String(line.description).length > 250) errors.push(`${prefix}: line description must be at most 250 characters.`);
  });
  // Compare at 4 decimal places to match DECIMAL(19,4) in SQL Server.
  if (Array.isArray(lines) && lines.length >= 2 && Math.round(debit * 10000) !== Math.round(credit * 10000)) errors.push('Total debit must equal total credit.');
  return { errors, value: { entryNumber, entryDate, description, createdBy, lines: (Array.isArray(lines) ? lines : []).map((line) => ({ accountId: Number(line.accountId), debit: Number(line.debit), credit: Number(line.credit), description: line.description ? String(line.description).trim() : null })) } };
}
module.exports = { validateCreateEntry };
