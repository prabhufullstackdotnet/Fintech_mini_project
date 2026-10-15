
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");

const accountsRouter = require("./routes/accounts");
const journalEntriesRouter = require("./routes/journalEntries");
const errorHandler = require("./middleware/errorHandler");

const app = express();

app.use(helmet());

app.use(cors({
  origin: process.env.CLIENT_ORIGIN || "http://localhost:5173",
}));

app.use(express.json({ limit: "1mb" }));

app.get("/", (req, res) => {
  res.send("Financial Journal Entry Management System API is running!");
});

app.use("/api/accounts", accountsRouter);
app.use("/api/journal-entries", journalEntriesRouter);

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
});

app.use(errorHandler);

module.exports = app;
