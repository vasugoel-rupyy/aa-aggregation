const express = require("express");
const app = express();
const cors = require("cors");

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


app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

// setInterval(() => {
//   const mem = process.memoryUsage();
//   console.log("[MEM]", {
//     rssMB: Math.round(mem.rss / 1024 / 1024),
//     heapUsedMB: Math.round(mem.heapUsed / 1024 / 1024),
//     heapTotalMB: Math.round(mem.heapTotal / 1024 / 1024),
//   });
// }, 1000);
