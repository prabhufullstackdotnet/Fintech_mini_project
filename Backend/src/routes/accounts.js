
const express = require("express");
const { poolPromise } = require("../config/db");

const router = express.Router();

router.get("/", async (req, res, next) => {
  try {
    const pool = await poolPromise;

    // Uses the Account Master table from your database.
    const result = await pool.request().query(`
      SELECT *
      FROM dbo.tbl_Accounts
      ORDER BY acc_AccountId;
    `);

    res.status(200).json({
      success: true,
      message: "Accounts retrieved successfully.",
      count: result.recordset.length,
      data: result.recordset,
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
