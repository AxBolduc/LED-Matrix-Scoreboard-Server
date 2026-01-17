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
          this.addSession(ws, sessionData);
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
    // Check if this deviceId already has an active WebSocket
    const existingWs = this.deviceToWebSocket.get(sessionData.deviceId);

    if (existingWs && existingWs !== ws) {
      console.log(
        `[SESSION MANAGER] Device ${sessionData.deviceId} reconnecting, cleaning up old connection`,
      );

      // Clean up the old WebSocket first
      this.removeSession(existingWs);

      // Optionally close the old WebSocket
      try {
        existingWs.close(1000, "Device reconnected");
      } catch (error) {
        console.error("[SESSION MANAGER] Error closing old WebSocket:", error);
      }
    }

    // Now add the new session
    this.sessions.set(ws, sessionData);
    this.deviceToWebSocket.set(sessionData.deviceId, ws);

    console.log(
      `[SESSION MANAGER] Session added for device ${sessionData.deviceId}. Total sessions: ${this.sessions.size}`,
    );
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
      console.log(
        `[SESSION MANAGER] Removing session ${session.id} for device ${session.deviceId}`,
      );
      this.deviceToWebSocket.delete(session.deviceId);
    } else {
      console.log("[SESSION MANAGER] Attempted to remove unknown session");
    }

    const removed = this.sessions.delete(ws);

    console.log(
      `[SESSION MANAGER] Session removed: ${removed}. Total sessions: ${this.sessions.size}`,
    );

    return removed;
  }

  /**
   * Get all active deviceIds
   */
  getAllDeviceIds(): string[] {
    return Array.from(this.deviceToWebSocket.keys());
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
