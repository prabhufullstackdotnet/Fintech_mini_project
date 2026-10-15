
const express = require("express");
const { poolPromise } = require("../src/config/db");

const router = express.Router();

// GET /api/accounts
router.get("/", async (req, res) => {
  try {
    const pool = await poolPromise;

    const result = await pool
      .request()
      .execute("dbo.sp_GetAccounts");

    return res.status(200).json({
      success: true,
      message: "Accounts retrieved successfully.",
      count: result.recordset.length,
      data: result.recordset,
    });
  } catch (error) {
    console.error("Get Accounts API error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to retrieve accounts.",
    });
  }
});

module.exports = router;
