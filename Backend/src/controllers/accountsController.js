const { poolPromise, sql } = require('../config/db');
async function getAccounts(req, res, next) {
  try {
    const pool = await poolPromise;
    const result = await pool.request().input('IncludeInactive', sql.Bit, false).execute('dbo.sp_GetAccounts');
    res.json({ success: true, data: result.recordset });
  } catch (err) { next(err); }
}
module.exports = { getAccounts };
