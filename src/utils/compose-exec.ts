/**
 * Compose Exec
 * CLI wrapper для docker-compose команд
 */

import { execSync } from 'child_process';
import { logger } from './logger.js';

export class ComposeExec {
  /**
   * Выполнить docker-compose команду
   */
  static run(
    composeFile: string,
    args: string[],
    options: { cwd?: string } = {}
  ): string {
    // Строим команду: docker-compose -f <file> <args>
    const cmd = `docker-compose -f ${composeFile} ${args.join(' ')}`;

    logger.debug(`Executing docker-compose: ${cmd}`);
    if (options.cwd) {
      logger.debug(`Working directory: ${options.cwd}`);
    }

    try {
      const output = execSync(cmd, {
        cwd: options.cwd,
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      return output;
    } catch (error: any) {
      logger.error('docker-compose command failed:', error);
      const errorMessage = error.message || String(error);
      throw new Error(`docker-compose failed: ${errorMessage}`);
    }
  }
}

