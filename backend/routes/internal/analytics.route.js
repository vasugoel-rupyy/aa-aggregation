const express = require("express");
const router = express.Router();

router.get("/internal/analytics", (req, res) => {
  res.json({ analytics: "ok", count: Number(req.query.count || 1) });
});

module.exports = router;
