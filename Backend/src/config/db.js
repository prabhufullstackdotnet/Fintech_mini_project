/*
require("dotenv").config();

const sql = require("mssql/msnodesqlv8");

const config = {
  server: process.env.DB_SERVER,
  database: process.env.DB_NAME,
  driver: "msnodesqlv8",
  options: {
    trustedConnection: true,
    trustServerCertificate: true,
  },
  connectionString:
    `Driver={ODBC Driver 18 for SQL Server};` +
    `Server=${process.env.DB_SERVER};` +
    `Database=${process.env.DB_NAME};` +
    `Trusted_Connection=Yes;` +
    `TrustServerCertificate=Yes;`,
};

const poolPromise = new sql.ConnectionPool(config)
  .connect()
  .then((pool) => {
    console.log("SQL Server connected successfully!");
    return pool;
  })
  .catch((error) => {
    console.error("Database connection failed:", error.message);
    throw error;
  });

module.exports = { sql, poolPromise };*/


require("dotenv").config();

const sql = require("mssql/msnodesqlv8");

const config = {
  connectionString:
    `Driver={ODBC Driver 18 for SQL Server};` +
    `Server=${process.env.DB_SERVER};` +
    `Database=${process.env.DB_NAME};` +
    `Trusted_Connection=Yes;` +
    `TrustServerCertificate=Yes;`,
};

const poolPromise = new sql.ConnectionPool(config)
  .connect()
  .then((pool) => {
    console.log("SQL Server connected successfully");
    return pool;
  });

module.exports = { sql, poolPromise };

