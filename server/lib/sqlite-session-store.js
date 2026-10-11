const session = require("express-session");

class SQLiteSessionStore extends session.Store {
  constructor(db, options = {}) {
    super();
    this.db = db;
    this.defaultTtlMs = options.ttlMs || 2 * 60 * 60 * 1000;

    db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        sid TEXT PRIMARY KEY,
        expires_at INTEGER NOT NULL,
        data TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);
    `);

    this.stmtGet = db.prepare("SELECT expires_at, data FROM sessions WHERE sid = ?");
    this.stmtSet = db.prepare(`
      INSERT INTO sessions (sid, expires_at, data) VALUES (?, ?, ?)
      ON CONFLICT(sid) DO UPDATE SET expires_at = excluded.expires_at, data = excluded.data
    `);
    this.stmtTouch = db.prepare("UPDATE sessions SET expires_at = ? WHERE sid = ?");
    this.stmtDestroy = db.prepare("DELETE FROM sessions WHERE sid = ?");
    this.stmtCleanup = db.prepare("DELETE FROM sessions WHERE expires_at <= ?");

    this.cleanupTimer = setInterval(() => {
      try { this.stmtCleanup.run(Date.now()); } catch {}
    }, 15 * 60 * 1000);
    this.cleanupTimer.unref?.();
  }

  get(sid, callback) {
    try {
      const row = this.stmtGet.get(sid);
      if (!row) return callback(null, null);
      if (row.expires_at <= Date.now()) {
        this.stmtDestroy.run(sid);
        return callback(null, null);
      }
      return callback(null, JSON.parse(row.data));
    } catch (error) {
      return callback(error);
    }
  }

  set(sid, sess, callback = () => {}) {
    try {
      const expiry = sess.cookie?.expires
        ? new Date(sess.cookie.expires).getTime()
        : Date.now() + (Number(sess.cookie?.maxAge) || this.defaultTtlMs);
      this.stmtSet.run(sid, expiry, JSON.stringify(sess));
      callback(null);
    } catch (error) {
      callback(error);
    }
  }

  touch(sid, sess, callback = () => {}) {
    try {
      const expiry = sess.cookie?.expires
        ? new Date(sess.cookie.expires).getTime()
        : Date.now() + (Number(sess.cookie?.maxAge) || this.defaultTtlMs);
      this.stmtTouch.run(expiry, sid);
      callback(null);
    } catch (error) {
      callback(error);
    }
  }

  destroy(sid, callback = () => {}) {
    try {
      this.stmtDestroy.run(sid);
      callback(null);
    } catch (error) {
      callback(error);
    }
  }

  close() {
    clearInterval(this.cleanupTimer);
  }
}

module.exports = SQLiteSessionStore;
