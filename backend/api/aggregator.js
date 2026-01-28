const express = require("express");
const axios = require("axios");
const zlib = require("zlib");
const os = require("os");
const { writeRequestEvent } = require("../db/mysql");
const { v4: uuidv4 } = require("uuid");
const { write } = require("fs");

const router = express.Router();

function supportsGzip(req) {
  const enc = req.headers["accept-encoding"] || "";
  return enc.includes("gzip");
}

function writeChunk(out, res, ctx, chunk) {
  if (res.writableEnded || res.destroyed) return;

  ctx.bytesSent += Buffer.byteLength(chunk);
  out.write(chunk);
}

function pipeStream(readable, writable, req, ctx) {
  return new Promise((resolve, reject) => {
    const onClose = () => {
      readable.destroy();
      reject(new Error("Client disconnected"));
    };

    req.on("close", onClose);

    readable.on("error", reject);
    writable.on("error", reject);

    readable.on("data", (chunk) => {
      ctx.bytesSent += chunk.length;
    });

    readable.on("end", () => {
      req.off("close", onClose);
      resolve();
    });

    readable.pipe(writable, { end: false });
  });
}

router.get("/aa/aggregated-response", async (req, res) => {
  const requestId = uuidv4();

  const ctx = {
    requestId,
    receivedAt: new Date(),
    finalized: false,

    bytesSent: 0,

    completedAt: null,
    durationMs: null,

    outcome: null,
    errorType: null,

    documentSizeMb: null,

    heapUsedMb: null,
    rssMb: null,

    connectionClosedEarly: false,
  };

  res.on("finish", () => {
    if (ctx.finalized) return;

    ctx.completedAt = new Date();
    ctx.durationMs = ctx.completedAt - ctx.receivedAt;

    ctx.outcome = "SUCCESS";
  });

  res.on("close", () => {
    if (ctx.finalized) return;

    ctx.completedAt = new Date();
    ctx.durationMs = ctx.completedAt - ctx.receivedAt;

    ctx.connectionClosedEarly = true;

    if (ctx.outcome === "SUCCESS") {
      ctx.outcome = "PARTIAL";
      ctx.errorType = "CLIENT_DISCONNECT";
    } else {
      ctx.outcome = ctx.outcome || "PARTIAL";
      ctx.errorType = ctx.errorType || "CLIENT_DISCONNECT";
    }

    ctx.finalized = true;
    writeRequestEvent(ctx);
  });

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

    writeChunk(out, res, ctx, '{"statement":');

    const statementRes = await axios.get(
      "http://localhost:3000/internal/statement?count=1",
      {
        responseType: "stream",
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
      },
    );

    await pipeStream(statementRes.data, out, req, ctx);

    writeChunk(out, res, ctx, '{"analytics":');

    const analyticsRes = await axios.get(
      "http://localhost:3000/internal/analytics?count=1",
      {
        responseType: "stream",
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
      },
    );

    await pipeStream(analyticsRes.data, out, req, ctx);

    writeChunk(out, res, ctx, '{"document":');

    const documentMeta = {
      filename: "statement.pdf",
      sizeMB: 5,
      downloadUrl: `/internal/document?mb=5&requestId=${ctx.requestId}`,
    };

    out.write(JSON.stringify(documentMeta));

    out.write("}");
    out.end();

    if (!ctx.finalized) {
      ctx.completedAt = new Date();
      ctx.durationMs = ctx.completedAt - ctx.receivedAt;
      ctx.outcome = "SUCCESS";
      ctx.finalized = true;
      writeRequestEvent(ctx);
    }

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
    console.error("Aggregation failed:", err);
    console.error("Error message:", err.message);
    console.error("Stack:", err.stack);

    if (!res.headersSent) {
      res.status(500).json({ error: "Aggregation failed" });
    } else {
      res.destroy();
    }
  }
});

module.exports = router;
