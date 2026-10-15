
require("dotenv").config();

const app = require("./app");
const { poolPromise } = require("./config/db");

const PORT = process.env.PORT || 5000;

async function startServer() {
  try {
    await poolPromise;

    app.listen(PORT, () => {
      console.log(`Express server running at http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("Unable to connect to SQL Server:", error.message);
    process.exitCode = 1;
  }
}

startServer();

