const express = require("express");
const app = express();
const cors = require("cors");
const { initMySQL } = require("./db/mysql");

const PORT = 3000;
app.use(cors({ origin: "http://localhost:3001" }));

const statementRoutes = require("./api/statement");
const analyticsRoutes = require("./api/analytics");
const documentRoutes = require("./api/document");
const aggregatorRoutes = require("./api/aggregator");

app.use(statementRoutes);
app.use(analyticsRoutes);
app.use(documentRoutes);
app.use(aggregatorRoutes);

(async () => {
  try {
    await initMySQL();
  } catch (err) {
    console.error("Unexpected MySQL init failure:", err);
  }
})();

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
