const express = require("express");
const axios = require("axios");
const zlib = require("zlib");
const os = require("os");

const router = express.Router();

function supportsGzip(req) {
  const enc = req.headers["accept-encoding"] || "";
  return enc.includes("gzip");
}

function pipeStream(readable, writable, req) {
  return new Promise((resolve, reject) => {
    const onClose = () => {
      readable.destroy();
      reject(new Error("Client disconnected"));
    };

    req.on("close", onClose);

    readable.on("error", reject);
    writable.on("error", reject);

    readable.on("end", () => {
      req.off("close", onClose);
      resolve();
    });

    readable.pipe(writable, { end: false });
  });
}

router.get("/aa/aggregated-response", async (req, res) => {
  let out = res;
  let gzip;

  const startCpu = process.cpuUsage();
  const startTime = process.hrtime.bigint();
  const numCores = os.cpus().length;

  try {
    res.setHeader("Content-Type", "application/json");

    if (supportsGzip(req)) {
      res.setHeader("Content-Encoding", "gzip");
      gzip = zlib.createGzip({ level: zlib.constants.Z_BEST_SPEED });
      gzip.pipe(res);
      out = gzip;

      req.on("close", () => {
        gzip.destroy();
      });
    }

    out.write('{"statement":');

    const statementRes = await axios.get(
      "http://localhost:3000/internal/statement?count=5000",
      {
        responseType: "stream",
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
      },
    );

    await pipeStream(statementRes.data, out, req);

    out.write(',"analytics":');

    const analyticsRes = await axios.get(
      "http://localhost:3000/internal/analytics?count=5000",
      {
        responseType: "stream",
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
      },
    );

    await pipeStream(analyticsRes.data, out, req);

    out.write(',"document":');

    const documentMeta = {
      filename: "statement.pdf",
      sizeMB: 50,
      downloadUrl: "/internal/document?mb=750",
    };

    out.write(JSON.stringify(documentMeta));

    out.write("}");
    out.end();

    const endCpu = process.cpuUsage(startCpu);
    const endTime = process.hrtime.bigint();

    const cpuMs = (endCpu.user + endCpu.system) / 1000;
    const wallMs = Number(endTime - startTime) / 1e6;
    const cpuUsagePercent = (cpuMs / wallMs / numCores) * 100;

    console.log("[STATS]", {
      cpuMs: Math.round(cpuMs),
      wallMs: Math.round(wallMs),
      cpuUsagePercent: cpuUsagePercent.toFixed(2) + "%",
    });
  } catch (err) {
    if (err.message === "Client disconnected") {
      console.log("[INFO] Client disconnected, stopped aggregation");
      return;
    }

    console.error("Streaming aggregation failed:", err);

    if (!res.headersSent) {
      res.status(500).json({ error: "Aggregation failed" });
    } else {
      res.destroy();
    }
  }
});

module.exports = router;
