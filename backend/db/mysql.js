const mysql = require("mysql2/promise");

let pool = null;

async function initMySQL() {
  try {
    pool = mysql.createPool({
      host: "localhost",
      user: "aa_user",
      password: "aa_pass",
      database: "aa_observability",

      connectionLimit: 5,

      waitForConnections: false,
      queueLimit: 0,
    });

    await pool.query("SELECT 1");
    console.log("MySQL connected (observability)");
  } catch (err) {
    console.error("MySQL unavailable, continuing without DB:", err.message);
    pool = null;
  }
}

async function writeDocumentEvent(event) {
  if (!pool) return;

  try {
    await pool.execute(
      `
      INSERT INTO document_events (
        request_id,
        document_name,
        received_at,
        completed_at,
        duration_ms,
        document_size_mb,
        bytes_sent,
        outcome,
        error_type,
        connection_closed_early
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        event.requestId,
        event.documentName,
        event.receivedAt,
        event.completedAt,
        event.durationMs,
        event.documentSizeMb,
        event.bytesSent,
        event.outcome,
        event.errorType,
        event.connectionClosedEarly,
      ],
    );
  } catch (err) {
    console.error("Failed to persist document event:", err.message);
  }
}

async function writeRequestEvent(event) {
  if (!pool) return;

  let conn;
  try {
    conn = await pool.getConnection();

    console.log(
      "[DB] Using connection",
      conn.threadId,
      "for request",
      event.requestId,
    );

    await conn.execute(
      `
      INSERT INTO request_events (
        request_id,
        received_at,
        completed_at,
        duration_ms,
        outcome,
        error_type,
        document_size_mb,
        bytes_sent,
        heap_used_mb,
        rss_mb,
        connection_closed_early
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        event.requestId,
        event.receivedAt,
        event.completedAt,
        event.durationMs,
        event.outcome,
        event.errorType,
        event.documentSizeMb,
        event.bytesSent,
        event.heapUsedMb,
        event.rssMb,
        event.connectionClosedEarly,
      ],
    );
  } catch (err) {
    console.error("Failed to persist request event:", err.message);
  } finally {
    if (conn) conn.release();
  }
}

module.exports = {
  initMySQL,
  writeRequestEvent,
  writeDocumentEvent,
};
