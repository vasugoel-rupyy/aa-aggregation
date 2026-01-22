const { Readable } = require("stream");
const express = require("express");
const router = express.Router();

router.get("/internal/document", (req, res) => {
  const mb = Number(req.query.mb || 5);
  const totalBytes = mb * 1024 * 1024;

  console.log("[DOC] Serving", mb, "MB PDF");

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", 'inline; filename="statement.pdf"');

  let sent = 0;
  let aborted = false;

  req.on("close", () => {
    aborted = true;
    console.log("[DOC] Client disconnected");
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

  // First send the valid PDF
  res.write(pdfHeader);
  sent += pdfHeader.length;

  function sendChunk() {
    if (aborted) return;

    if (sent >= totalBytes) {
      res.end();
      console.log("[DOC] Finished sending");
      return;
    }

    const chunkSize = Math.min(64 * 1024, totalBytes - sent);
    const chunk = Buffer.alloc(chunkSize, " "); // harmless filler

    sent += chunkSize;

    const ok = res.write(chunk);
    if (ok) {
      setImmediate(sendChunk);
    } else {
      res.once("drain", sendChunk);
    }
  }

  sendChunk();
});

module.exports = router;
