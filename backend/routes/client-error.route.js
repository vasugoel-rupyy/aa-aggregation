const express = require("express");
const { markClientRenderFailure } = require("../db/mysql");

const router = express.Router();

router.post("/client/error", express.json(), async (req, res) => {
  const { requestId, errorType, meta } = req.body;

  if (!requestId || !errorType) {
    return res.status(400).end();
  }

  await markClientRenderFailure({
    requestId,
    errorType,
    errorMessage: "Client failed to render PDF",
  });

  console.error("[CLIENT_RENDER_FAILURE]", {
    requestId,
    errorType,
    meta,
  });

  res.status(204).end();
});

module.exports = router;
