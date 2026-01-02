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
      
      // Извлекаем полное сообщение об ошибке (включая stderr)
      let errorMessage = error.message || String(error);
      
      // Если есть stderr, добавляем его к сообщению
      if (error.stderr) {
        const stderr = error.stderr.toString ? error.stderr.toString() : String(error.stderr);
        if (stderr && !errorMessage.includes(stderr)) {
          errorMessage = `${errorMessage}\n${stderr}`;
        }
      }
      
      // Если есть stdout (может содержать полезную информацию)
      if (error.stdout) {
        const stdout = error.stdout.toString ? error.stdout.toString() : String(error.stdout);
        if (stdout && stdout.trim()) {
          errorMessage = `${errorMessage}\n${stdout}`;
        }
      }
      
      throw new Error(`docker-compose failed: ${errorMessage}`);
    }
  }
}

