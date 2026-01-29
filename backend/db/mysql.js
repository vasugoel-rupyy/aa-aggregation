const mysql = require("mysql2/promise");

let pool = null;

async function initMySQL() {
  if (pool) return pool;

  try {
    pool = mysql.createPool({
      host: "localhost",
      user: "aa_user",
      password: "aa_pass",
      database: "aa_observability",
      connectionLimit: 5,
      waitForConnections: true,
      queueLimit: 50,
    });

    await pool.execute("SELECT 1");
    console.log("[DB] MySQL connected (observability)");
    return pool;
  } catch (err) {
    console.error("[DB] MySQL unavailable, telemetry disabled:", err.message);
    pool = null;
    return null;
  }
}

async function ensurePool() {
  if (!pool) await initMySQL();
  return pool;
}

function safeJson(value) {
  try {
    return JSON.stringify(value);
  } catch {
    return null;
  }
}

process.on("SIGINT", closeMySQL);
process.on("SIGTERM", closeMySQL);

async function closeMySQL() {
  if (!pool) return;
  try {
    await pool.end();
  } finally {
    pool = null;
  }
}

async function writeClientRequest(e) {
  if (!(await ensurePool())) return;

  try {
    await pool.execute(
      `
      INSERT INTO client_requests
      (request_id, received_at, client_ip, http_method, path,
       headers_json, payload_json, payload_size_bytes, connection_closed_early)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        e.requestId,
        e.receivedAt,
        e.clientIp,
        e.httpMethod,
        e.path,
        safeJson(e.headers ?? {}),
        safeJson(e.payload ?? {}),
        e.payloadSizeBytes ?? 0,
        e.connectionClosedEarly ?? false,
      ],
    );
  } catch (err) {
    console.error("[DB] client_requests insert failed:", err.message);
  }
}

async function writeInternalServiceCall(e) {
  if (!(await ensurePool())) return;

  try {
    await pool.execute(
      `
      INSERT INTO internal_service_calls
      (request_id, service_name, endpoint, request_payload_json,
       response_payload_json, started_at, completed_at,
       duration_ms, http_status, error_type)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        e.requestId,
        e.serviceName,
        e.endpoint,
        safeJson(e.requestPayload),
        safeJson(e.responsePayload),
        e.startedAt,
        e.completedAt,
        e.durationMs,
        e.httpStatus,
        e.errorType,
      ],
    );
  } catch (err) {
    console.error("[DB] internal_service_calls insert failed:", err.message);
  }
}

async function writeClientResponse(e) {
  if (!(await ensurePool())) return;

  try {
    await pool.execute(
      `
      INSERT INTO client_responses
      (request_id, sent_at, http_status, headers_json,
       payload_json, payload_size_bytes, bytes_sent,
       outcome, error_type, error_message)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        e.requestId,
        e.sentAt,
        e.httpStatus,
        safeJson(e.headers ?? {}),
        safeJson(e.payload ?? null),
        e.payloadSizeBytes ?? 0,
        e.bytesSent ?? 0,
        e.outcome,
        e.errorType,
        e.errorMessage,
      ],
    );
  } catch (err) {
    console.error("[DB] client_responses insert failed:", err.message);
  }
}

async function markClientRenderFailure({
  requestId,
  errorType,
  errorMessage,
}) {
  if (!(await ensurePool())) return;

  try {
    await pool.execute(
      `
      UPDATE document_responses
      SET
        outcome = 'ERROR',
        error_type = ?,
        error_message = ?
      WHERE request_id = ?
      `,
      [errorType, errorMessage, requestId],
    );

    await pool.execute(
      `
      UPDATE client_responses
      SET
        outcome = 'ERROR',
        error_type = ?,
        error_message = ?
      WHERE request_id = ?
      `,
      [errorType, errorMessage, requestId],
    );
  } catch (err) {
    console.error("[DB] markClientRenderFailure failed:", err.message);
  }
}


async function writeDocumentEvent(e) {
  if (!(await ensurePool())) return;

  try {
    await pool.execute(
      `
      INSERT INTO document_events
      (request_id, document_name, received_at, completed_at,
       duration_ms, document_size_mb, bytes_sent,
       outcome, error_type, connection_closed_early)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        e.requestId,
        e.documentName,
        e.receivedAt,
        e.completedAt,
        e.durationMs,
        e.documentSizeMb,
        e.bytesSent,
        e.outcome,
        e.errorType,
        e.connectionClosedEarly,
      ],
    );
  } catch (err) {
    console.error("[DB] document_events insert failed:", err.message);
  }
}
async function writeDocumentResponse(e) {
  if (!(await ensurePool())) return;

  try {
    await pool.execute(
      `
      INSERT INTO document_responses
      (request_id, document_name, content_type, size_bytes,
       checksum_sha256, storage_type, storage_location, created_at,
       outcome, error_type, error_message)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        e.requestId,
        e.documentName,
        e.contentType,
        e.sizeBytes,
        e.checksumSha256,
        e.storageType,
        e.storageLocation,
        e.createdAt,
        e.outcome,
        e.errorType,
        e.errorMessage,
      ],
    );
  } catch (err) {
    console.error("[DB] document_responses insert failed:", err.message);
  }
}

async function markDocumentPending({
  requestId,
  documentName,
  sizeBytes,
  storageLocation,
  createdAt,
}) {
  if (!(await ensurePool())) return;

  await pool.execute(
    `
    INSERT INTO document_responses
    (request_id, document_name, content_type, size_bytes,
     checksum_sha256, storage_type, storage_location, created_at,
     outcome)
    VALUES (?, ?, 'application/pdf', ?, NULL, 'INLINE', ?, ?, 'PENDING')
    `,
    [requestId, documentName, sizeBytes, storageLocation, createdAt],
  );
}

async function markDocumentRenderSuccess(requestId) {
  if (!(await ensurePool())) return;

  await pool.execute(
    `
    UPDATE document_responses
    SET outcome = 'SUCCESS'
    WHERE request_id = ?
    `,
    [requestId],
  );
}


module.exports = {
  initMySQL,
  writeClientRequest,
  writeInternalServiceCall,
  writeClientResponse,
  writeDocumentEvent,
  writeDocumentResponse,
  markClientRenderFailure,
  markDocumentPending,
  markDocumentRenderSuccess,
};
