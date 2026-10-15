const { poolPromise, sql } = require('../config/db');
const { validateCreateEntry } = require('../validators/journalEntry');

async function createJournalEntry(req, res, next) {
  const { errors, value } = validateCreateEntry(req.body || {});
  if (errors.length) return res.status(400).json({ success: false, message: 'Validation failed.', errors });
  try {
    const pool = await poolPromise;
    const result = await pool.request()
      .input('EntryNumber', sql.VarChar(30), value.entryNumber)
      .input('EntryDate', sql.Date, value.entryDate)
      .input('Description', sql.VarChar(500), value.description)
      .input('CreatedBy', sql.VarChar(100), value.createdBy)
      .input('LinesJson', sql.NVarChar(sql.MAX), JSON.stringify(value.lines.map((l) => ({ AccountId: l.accountId, Debit: l.debit, Credit: l.credit, LineDescription: l.description }))))
      .execute('dbo.sp_CreateJournalEntry');
    res.status(201).json({ success: true, message: result.recordset?.[0]?.Message || 'Journal entry created.', data: result.recordset?.[0] });
  } catch (err) { next(err); }
}

async function listJournalEntries(req, res, next) {
  const page = Number.parseInt(req.query.page || '1', 10);
  const pageSize = Number.parseInt(req.query.pageSize || '10', 10);
  const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
  const fromDate = req.query.fromDate || null;
  const toDate = req.query.toDate || null;
  if (!Number.isInteger(page) || page < 1 || !Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) {
    return res.status(400).json({ success: false, message: 'Page must be >= 1 and pageSize must be between 1 and 100.' });
  }
  if (search.length > 100) return res.status(400).json({ success: false, message: 'Search must be at most 100 characters.' });
  const isDate = (d) => !d || (/^\d{4}-\d{2}-\d{2}$/.test(d) && !Number.isNaN(Date.parse(`${d}T00:00:00Z`)));
  if (!isDate(fromDate) || !isDate(toDate) || (fromDate && toDate && fromDate > toDate)) return res.status(400).json({ success: false, message: 'Provide valid fromDate/toDate values and ensure fromDate is not after toDate.' });
  try {
    const pool = await poolPromise;
    const result = await pool.request()
      .input('Page', sql.Int, page).input('PageSize', sql.Int, pageSize)
      .input('Search', sql.VarChar(100), search || null)
      .input('FromDate', sql.Date, fromDate).input('ToDate', sql.Date, toDate)
      .execute('dbo.sp_GetJournalEntries');
    const rows = result.recordset || [];
    const totalRecords = rows.length ? Number(rows[0].TotalRecords) : 0;
    res.json({ success: true, data: rows.map(({ TotalRecords, ...row }) => row), pagination: { page, pageSize, totalRecords, totalPages: Math.ceil(totalRecords / pageSize) } });
  } catch (err) { next(err); }
}

async function getJournalEntryById(req, res, next) {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id <= 0) return res.status(400).json({ success: false, message: 'Journal entry ID must be a positive integer.' });
  try {
    const pool = await poolPromise;
    const result = await pool.request().input('JournalEntryId', sql.BigInt, id).execute('dbo.sp_GetJournalEntryById');
    const header = result.recordsets?.[0]?.[0];
    if (!header) return res.status(404).json({ success: false, message: 'Journal entry not found.' });
    const lines = result.recordsets?.[1] || [];
    const auditResult = await pool.request()
      .input('JournalEntryId', sql.BigInt, id)
      .execute('dbo.sp_GetJournalEntryAuditLogs');
    const totals = lines.reduce((acc, line) => ({ debit: acc.debit + Number(line.jel_Debit), credit: acc.credit + Number(line.jel_Credit) }), { debit: 0, credit: 0 });
    res.json({ success: true, data: { ...header, lines, totals, auditLogs: auditResult.recordset || [] } });
  } catch (err) { next(err); }
}
module.exports = { createJournalEntry, listJournalEntries, getJournalEntryById };
