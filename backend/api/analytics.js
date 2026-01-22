const express = require("express");
const router = express.Router();

router.get("/internal/analytics", (req, res) => {
  const count = Number(req.query.count || 5000);

  const insights = [];

  for (let i = 0; i < count; i++) {
    insights.push({
      category: `category_${i}`,
      totalSpent: Math.random() * 100000,
      transactionCount: Math.floor(Math.random() * 500)
    });
  }

  res.json({
    userId: "USER123",
    insights
  });
});

module.exports = router;
