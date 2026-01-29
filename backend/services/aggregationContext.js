const os = require("os");

function createAggregationContext(requestId, receivedAt) {
  return {
    requestId,
    receivedAt,
    completedAt: null,
    durationMs: null,
    outcome: null,
    errorType: null,
    bytesSent: 0,
    documentSizeMb: null,
    heapUsedMb: null,
    rssMb: null,
    connectionClosedEarly: false,
    finalized: false,
    cpu: {
      start: process.cpuUsage(),
      hrStart: process.hrtime.bigint(),
      cores: os.cpus().length,
    },
  };
}

function finalizeContext(ctx, outcome, errorType = null) {
  if (ctx.finalized) return false;

  ctx.finalized = true;
  ctx.completedAt = new Date();
  ctx.durationMs = ctx.completedAt - ctx.receivedAt;
  ctx.outcome = outcome;
  ctx.errorType = errorType;

  const mem = process.memoryUsage();
  ctx.heapUsedMb = Math.round(mem.heapUsed / 1024 / 1024);
  ctx.rssMb = Math.round(mem.rss / 1024 / 1024);

  return true;
}

function computeCpuStats(ctx) {
  const cpuEnd = process.cpuUsage(ctx.cpu.start);
  const timeEnd = process.hrtime.bigint();

  const cpuMs = (cpuEnd.user + cpuEnd.system) / 1000;
  const wallMs = Number(timeEnd - ctx.cpu.hrStart) / 1e6;

  return {
    cpuMs: Math.round(cpuMs),
    wallMs: Math.round(wallMs),
    cpuPct: ((cpuMs / wallMs / ctx.cpu.cores) * 100).toFixed(2) + "%",
  };
}

module.exports = {
  createAggregationContext,
  finalizeContext,
  computeCpuStats,
};
