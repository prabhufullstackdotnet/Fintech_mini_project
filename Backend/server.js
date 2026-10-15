
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const { poolPromise } = require("./src/config/db");
const accountsRouter = require("./routes/accounts");
const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("Financial Journal Entry Management System API is running!");
});

app.get("/api/health", async (req, res) => {
  try {
    await poolPromise;

    res.json({
      success: true,
      message: "Database connection successful!",
      database: process.env.DB_NAME,
    });
  } catch (error) {
    console.error(error.message);

    res.status(500).json({
      success: false,
      message: "Database connection failed. Check server settings.",
    });
  }
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Express server running at http://localhost:${PORT}`);
});


// Accounts endpoints
app.use("/api/accounts", accountsRouter);