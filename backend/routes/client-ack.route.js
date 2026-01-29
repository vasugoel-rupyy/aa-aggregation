const express = require("express");
const { markDocumentRenderSuccess } = require("../db/mysql");

const router = express.Router();

router.post("/client/render-success", express.json(), async (req, res) => {
  const { requestId } = req.body;

  if (!requestId) return res.status(400).end();

  await markDocumentRenderSuccess(requestId);

  console.log("[CLIENT_RENDER_SUCCESS]", requestId);

  res.status(204).end();
});

module.exports = router;
