const express = require("express");
const { validate: isValidUuid } = require("uuid");
const {
  markDocumentPending,
} = require("../../db/mysql");

const router = express.Router();

router.get("/internal/document", (req, res) => {
  const mb = Number(req.query.mb || 5);
  const totalBytes = mb * 1024 * 1024;
  const requestId = isValidUuid(req.query.requestId)
    ? req.query.requestId
    : null;

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", "inline");
  res.setHeader("X-Content-Type-Options", "nosniff");

  const createdAt = new Date();

  markDocumentPending({
    requestId,
    documentName: "statement.pdf",
    sizeBytes: totalBytes,
    storageLocation: `/internal/document?mb=${mb}&requestId=${requestId}`,
    createdAt,
  });

  const pdfHeader = Buffer.from(
    `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 300] >>
endobj
xref
0 4
0000000000 65535 f
0000000010 00000 n
0000000060 00000 n
0000000110 00000 n
trailer
<< /Size 4 /Root 1 0 R >>
startxref
170
%%EOF
`,
  );

  let sent = 0;

  function write(buf) {
    if (res.destroyed) return;
    res.write(buf);
  }

  write(pdfHeader);
  sent += pdfHeader.length;

  function sendChunk() {
    if (sent >= totalBytes) {
      res.end();
      return;
    }

    const size = Math.min(64 * 1024, totalBytes - sent);
    sent += size;

    write(Buffer.alloc(size, " "));
    setImmediate(sendChunk);
  }

  sendChunk();
});

module.exports = router;
