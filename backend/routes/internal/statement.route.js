const express = require("express");
const router = express.Router();

router.get("/internal/statement", (req, res) => {
  res.json({ statement: "ok", count: Number(req.query.count || 1) });
});

module.exports = router;
