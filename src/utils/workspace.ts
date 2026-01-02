/**
 * Workspace Root Management
 * Хранит workspace root полученный от MCP клиента
 */

import { logger } from './logger.js';

/**
 * Глобальное хранилище workspace root
 * Устанавливается при инициализации MCP сервера через listRoots()
 */
class WorkspaceManager {
  private workspaceRoot: string | null = null;

  /**
   * Устанавливает workspace root из MCP client roots
   */
  setWorkspaceRoot(uri: string): void {
    // URI в формате file:///path/to/workspace
    const path = this.parseFileUri(uri);
    this.workspaceRoot = path;
    logger.info(`Workspace root set: ${path}`);
  }

  /**
   * Возвращает workspace root или null если не установлен
   */
  getWorkspaceRoot(): string | null {
    return this.workspaceRoot;
  }

  /**
   * Проверяет, установлен ли workspace root
   */
  hasWorkspaceRoot(): boolean {
    return this.workspaceRoot !== null;
  }

  /**
   * Парсит file:// URI в обычный путь
   */
  private parseFileUri(uri: string): string {
    if (uri.startsWith('file://')) {
      // file:///path/to/workspace -> /path/to/workspace
      return decodeURIComponent(uri.slice(7));
    }
    return uri;
  }

  /**
   * Очищает workspace root (для тестов)
   */
  clear(): void {
    this.workspaceRoot = null;
  }
}

// Singleton instance
export const workspaceManager = new WorkspaceManager();

