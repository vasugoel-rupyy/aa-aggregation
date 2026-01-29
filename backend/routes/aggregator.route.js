const express = require("express");
const axios = require("axios");
const { v4: uuidv4 } = require("uuid");

const {
  writeClientRequest,
  writeInternalServiceCall,
  writeClientResponse,
} = require("../db/mysql");

const {
  createAggregationContext,
  finalizeContext,
  computeCpuStats,
} = require("../services/aggregationContext");

const {
  createResponseCapture,
  writeChunk,
  pipeStream,
} = require("../services/streamUtils");

const { maybeWrapGzip } = require("../services/gzip");

const router = express.Router();

router.get("/aa/aggregated-response", async (req, res) => {
  const requestId = uuidv4();
  const receivedAt = new Date();

  const ctx = createAggregationContext(requestId, receivedAt);
  const capture = createResponseCapture();

  writeClientRequest({
    requestId,
    receivedAt,
    clientIp: req.ip,
    httpMethod: req.method,
    path: req.originalUrl,
    headers: req.headers,
    payload: null,
    payloadSizeBytes: 0,
    connectionClosedEarly: false,
  });

  res.on("close", () => {
    if (!ctx.finalized && !res.writableEnded) {
      ctx.connectionClosedEarly = true;
      finalizeContext(ctx, "PARTIAL", "CLIENT_DISCONNECT");
    }
  });

  let out = maybeWrapGzip(req, res);

  try {
    res.setHeader("Content-Type", "application/json");

    writeChunk(out, ctx, capture.capture, '{"statement":');

    const stmtRes = await axios.get(
      "http://localhost:3000/internal/statement?count=1",
      { responseType: "stream" },
    );

    const stmtMs = await pipeStream(stmtRes.data, out, ctx, capture.capture);

    writeInternalServiceCall({
      requestId,
      serviceName: "statement",
      endpoint: "/internal/statement",
      requestPayload: null,
      responsePayload: null,
      startedAt: receivedAt,
      completedAt: new Date(),
      durationMs: stmtMs,
      httpStatus: 200,
      errorType: null,
    });

    writeChunk(out, ctx, capture.capture, ',"analytics":');

    const analyticsRes = await axios.get(
      "http://localhost:3000/internal/analytics?count=1",
      { responseType: "stream" },
    );

    const analyticsMs = await pipeStream(
      analyticsRes.data,
      out,
      ctx,
      capture.capture,
    );

    writeInternalServiceCall({
      requestId,
      serviceName: "analytics",
      endpoint: "/internal/analytics",
      requestPayload: null,
      responsePayload: null,
      startedAt: receivedAt,
      completedAt: new Date(),
      durationMs: analyticsMs,
      httpStatus: 200,
      errorType: null,
    });

    writeChunk(out, ctx, capture.capture, ',"document":');

    const documentMeta = {
      filename: "statement.pdf",
      downloadUrl: `/internal/document?mb=500&requestId=${requestId}`,
    };

    writeClientRequest({
      requestId,
      receivedAt: new Date(),
      clientIp: req.ip,
      httpMethod: "GET",
      path: documentMeta.downloadUrl,
      headers: { referer: req.originalUrl, "x-origin": "aggregator" },
      payload: null,
      payloadSizeBytes: 0,
      connectionClosedEarly: false,
    });

    writeInternalServiceCall({
      requestId,
      serviceName: "document",
      endpoint: "/internal/document",
      requestPayload: { mb: 5 },
      responsePayload: documentMeta,
      startedAt: new Date(),
      completedAt: new Date(),
      durationMs: 0,
      httpStatus: 200,
      errorType: null,
    });

    writeChunk(out, ctx, capture.capture, JSON.stringify(documentMeta));
    writeChunk(out, ctx, capture.capture, "}");
    out.end();

    finalizeContext(ctx, "SUCCESS");

    writeClientResponse({
      requestId,
      sentAt: ctx.completedAt,
      httpStatus: res.statusCode,
      headers: res.getHeaders(),
      payload: capture.getPayload(),
      payloadSizeBytes: capture.getCapturedBytes(),
      bytesSent: ctx.bytesSent,
      outcome: ctx.outcome,
      errorType: ctx.errorType,
      errorMessage: ctx.errorType ? "Client failed to render document" : null,
    });


    console.log("[AGG_STATS]", {
      requestId,
      ...computeCpuStats(ctx),
    });
  } catch (err) {
    if (!res.headersSent) {
      res.status(500).json({ error: "Aggregation failed" });
    } else {
      res.destroy();
    }

    finalizeContext(ctx, "ERROR", err.message);

  }
});

module.exports = router;
