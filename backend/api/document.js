const express = require("express");
const router = express.Router();
const { v4: uuidv4 } = require("uuid");
const { validate: isValidUuid } = require("uuid");
const { writeDocumentEvent } = require("../db/mysql");

router.get("/internal/document", (req, res) => {
  const mb = Number(req.query.mb || 5);
  const totalBytes = mb * 1024 * 1024;
  const start = Date.now();

  const rawRequestId = req.query.requestId;
  const requestId = isValidUuid(rawRequestId) ? rawRequestId : null;

  const ctx = {
    requestId,
    documentName: "statement.pdf",

    receivedAt: new Date(),
    completedAt: null,
    durationMs: null,

    documentSizeMb: mb,
    bytesSent: 0,

    outcome: null,
    errorType: null,
    connectionClosedEarly: false,

    finalized: false,
  };

  console.log("[DOC] Serving", mb, "MB PDF");

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", 'inline; filename="statement.pdf"');

  function finalizeSuccess() {
    if (ctx.finalized) return;
    ctx.completedAt = new Date();
    ctx.durationMs = Date.now() - start;
    ctx.outcome = "SUCCESS";
    ctx.finalized = true;
    writeDocumentEvent(ctx);
  }

  function finalizePartial() {
    if (ctx.finalized) return;
    ctx.completedAt = new Date();
    ctx.durationMs = Date.now() - start;
    ctx.connectionClosedEarly = true;
    ctx.outcome = "PARTIAL";
    ctx.errorType = "CLIENT_DISCONNECT";
    ctx.finalized = true;
    writeDocumentEvent(ctx);
  }

  res.on("finish", finalizeSuccess);
  res.on("close", finalizePartial);

  let sent = 0;

  const pdfHeader = Buffer.from(
    `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] /Contents 4 0 R /Resources << >> >>
endobj
4 0 obj
<< /Length 0 >>
stream
endstream
endobj
xref
0 5
0000000000 65535 f 
0000000010 00000 n 
0000000060 00000 n 
0000000110 00000 n 
0000000200 00000 n 
trailer
<< /Size 5 /Root 1 0 R >>
startxref
260
%%EOF
`,
  );

  function safeWrite(buf) {
    if (res.writableEnded || res.destroyed) return false;
    ctx.bytesSent += buf.length;
    return res.write(buf);
  }

  safeWrite(pdfHeader);
  sent += pdfHeader.length;

  function sendChunk() {
    if (sent >= totalBytes) {
      res.end();
      console.log("[DOC] Finished sending");
      return;
    }

    const chunkSize = Math.min(64 * 1024, totalBytes - sent);
    const chunk = Buffer.alloc(chunkSize, " ");

    sent += chunkSize;

    if (safeWrite(chunk)) {
      setImmediate(sendChunk);
    } else {
      res.once("drain", sendChunk);
    }
  }

  sendChunk();
});

module.exports = router;
