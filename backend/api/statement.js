const express = require("express");
const router = express.Router();

const PORT = 3000;

router.get("/internal/statement", (req, res) => {
  const count = Number(req.query.count || 1000);

  const transactions = [];

  for (let i = 0; i < count; i++) {
    transactions.push({
      id: i,
      amount: Math.floor(Math.random() * 10000),
      mode: "UPI",
      merchant: "Test Merchant",
      timestamp: Date.now(),
    });
  }

  res.json({
    accountId: "ACC123",
    transactions,
  });
});

module.exports = router;
