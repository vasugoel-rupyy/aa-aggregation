const MAX_CAPTURE_BYTES = 256 * 1024;

function createResponseCapture() {
  let capturedBytes = 0;
  const chunks = [];

  function capture(buf) {
    if (capturedBytes >= MAX_CAPTURE_BYTES) return;
    chunks.push(buf);
    capturedBytes += buf.length;
  }

  function getPayload() {
    return capturedBytes <= MAX_CAPTURE_BYTES
      ? Buffer.concat(chunks).toString("utf8")
      : "[TRUNCATED]";
  }

  return {
    capture,
    getPayload,
    getCapturedBytes: () => capturedBytes,
  };
}

function writeChunk(out, ctx, capture, chunk) {
  if (out.writableEnded || out.destroyed) return;
  const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
  ctx.bytesSent += buf.length;
  capture(buf);
  out.write(buf);
}

function pipeStream(readable, writable, ctx, capture) {
  const start = Date.now();

  return new Promise((resolve, reject) => {
    readable.on("data", (chunk) => {
      ctx.bytesSent += chunk.length;
      capture(chunk);
    });

    readable.on("error", reject);
    writable.on("error", reject);

    readable.on("end", () => resolve(Date.now() - start));
    readable.pipe(writable, { end: false });
  });
}

module.exports = {
  createResponseCapture,
  writeChunk,
  pipeStream,
};
