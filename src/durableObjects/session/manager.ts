import type { SessionData } from "./types";
import { deserializeSessionAttachment } from "./serialization";

/**
 * Manages WebSocket sessions and their associated data
 */
export class SessionManager {
  private sessions: Map<WebSocket, SessionData>;
  private deviceToWebSocket: Map<string, WebSocket>;

  constructor() {
    this.sessions = new Map();
    this.deviceToWebSocket = new Map();
  }

  /**
   * Restore sessions from hibernated WebSockets
   */
  restoreFromHibernation(websockets: WebSocket[]): void {
    websockets.forEach((ws) => {
      const result = deserializeSessionAttachment(ws);
      result.match({
        ok: (sessionData) => {
          this.sessions.set(ws, sessionData);
          this.deviceToWebSocket.set(sessionData.deviceId, ws);
        },
        err: (error) => {
          console.error(
            "[SESSION MANAGER] Failed to restore session:",
            error.message,
          );
        },
      });
    });
  }

  /**
   * Add a new session
   */
  addSession(ws: WebSocket, sessionData: SessionData): void {
    this.sessions.set(ws, sessionData);
    this.deviceToWebSocket.set(sessionData.deviceId, ws);
  }

  /**
   * Get session data for a WebSocket
   */
  getSession(ws: WebSocket): SessionData | undefined {
    return this.sessions.get(ws);
  }

  /**
   * Remove a session
   */
  removeSession(ws: WebSocket): boolean {
    const session = this.sessions.get(ws);
    if (session) {
      this.deviceToWebSocket.delete(session.deviceId);
    }
    return this.sessions.delete(ws);
  }

  /**
   * Get all active deviceIds
   */
  getAllDeviceIds(): string[] {
    return Array.from(this.sessions.values()).map((s) => s.deviceId);
  }

  /**
   * Get the number of active sessions
   */
  getSessionCount(): number {
    return this.sessions.size;
  }

  /**
   * Get all sessions (for iteration)
   */
  getAllSessions(): Map<WebSocket, SessionData> {
    return this.sessions;
  }

  /**
   * Get WebSocket by deviceId
   */
  getWebSocketByDeviceId(deviceId: string): WebSocket | undefined {
    return this.deviceToWebSocket.get(deviceId);
  }
}
