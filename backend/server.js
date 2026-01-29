const express = require("express");
const cors = require("cors");
const { initMySQL } = require("./db/mysql");

const app = express();
const PORT = 3000;

app.use(
  cors({
    origin: "http://localhost:3001",
    methods: ["GET", "POST"],
    credentials: true,
  }),
);

app.use(require("./routes/internal/statement.route"));
app.use(require("./routes/internal/analytics.route"));
app.use(require("./routes/internal/document.route"));
app.use(require("./routes/aggregator.route"));
app.use(require("./routes/client-error.route"));
app.use(require("./routes/client-ack.route"));

(async () => {
  await initMySQL();
})();

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
