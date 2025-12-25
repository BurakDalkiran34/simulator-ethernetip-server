/**
 * Session Manager for Ethernet/IP connections
 */

export class SessionManager {
  constructor() {
    this.sessions = new Map();
    this.nextSessionHandle = 1;
  }

  /**
   * Create a new session
   * @returns {number} Session handle
   */
  createSession() {
    const handle = this.nextSessionHandle++;
    this.sessions.set(handle, {
      handle: handle,
      createdAt: Date.now(),
      lastActivity: Date.now()
    });
    return handle;
  }

  /**
   * Check if session exists
   * @param {number} handle - Session handle
   * @returns {boolean}
   */
  hasSession(handle) {
    return this.sessions.has(handle);
  }

  /**
   * Get session
   * @param {number} handle - Session handle
   * @returns {Object|null}
   */
  getSession(handle) {
    return this.sessions.get(handle) || null;
  }

  /**
   * Update session activity
   * @param {number} handle - Session handle
   */
  updateActivity(handle) {
    const session = this.sessions.get(handle);
    if (session) {
      session.lastActivity = Date.now();
    }
  }

  /**
   * Remove session
   * @param {number} handle - Session handle
   */
  removeSession(handle) {
    this.sessions.delete(handle);
  }

  /**
   * Clean up inactive sessions (older than timeout)
   * @param {number} timeoutMs - Timeout in milliseconds
   */
  cleanupInactive(timeoutMs = 300000) { // 5 minutes default
    const now = Date.now();
    for (const [handle, session] of this.sessions.entries()) {
      if (now - session.lastActivity > timeoutMs) {
        this.sessions.delete(handle);
      }
    }
  }

  /**
   * Get all active sessions
   * @returns {Array}
   */
  getAllSessions() {
    return Array.from(this.sessions.values());
  }
}

