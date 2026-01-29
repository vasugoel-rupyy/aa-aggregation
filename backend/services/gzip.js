const zlib = require("zlib");

function supportsGzip(req) {
  return (req.headers["accept-encoding"] || "").includes("gzip");
}

function maybeWrapGzip(req, res) {
  if (!supportsGzip(req)) return res;

  res.setHeader("Content-Encoding", "gzip");
  const gzip = zlib.createGzip({ level: zlib.constants.Z_BEST_SPEED });
  gzip.pipe(res);
  return gzip;
}

module.exports = { maybeWrapGzip };
