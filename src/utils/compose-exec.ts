/**
 * Compose Exec
 * CLI wrapper для docker-compose команд
 */

import { execSync } from 'child_process';
import { logger } from './logger.js';
import type { SSHConfig } from './ssh-config.js';

export interface ComposeExecOptions {
  /** Рабочая директория */
  cwd?: string;
  /** SSH конфигурация для удаленного Docker */
  sshConfig?: SSHConfig | null;
  /** Docker context (альтернатива SSH config) */
  dockerContext?: string;
}

export class ComposeExec {
  /**
   * Выполнить docker-compose команду
   * Поддерживает SSH через DOCKER_HOST или Docker context
   */
  static run(
    composeFile: string,
    args: string[],
    options: ComposeExecOptions = {}
  ): string {
    // Строим команду: docker-compose -f <file> <args>
    let cmd = `docker-compose -f ${composeFile}`;

    // Добавляем Docker context (если указан)
    if (options.dockerContext) {
      cmd = `docker-compose --context ${options.dockerContext} -f ${composeFile}`;
      logger.debug(`Using Docker context: ${options.dockerContext}`);
    }

    cmd = `${cmd} ${args.join(' ')}`;

    logger.debug(`Executing docker-compose: ${cmd}`);
    if (options.cwd) {
      logger.debug(`Working directory: ${options.cwd}`);
    }

    // Подготавливаем окружение для выполнения команды
    const env = this.prepareEnvironment(options.sshConfig);

    try {
      const output = execSync(cmd, {
        cwd: options.cwd,
        env: env,
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

  /**
   * Подготовить переменные окружения для выполнения команды
   * Если указан SSH config, устанавливает DOCKER_HOST для удаленного Docker
   */
  private static prepareEnvironment(sshConfig?: SSHConfig | null): NodeJS.ProcessEnv {
    const env = { ...process.env };

    // Если указан SSH config, устанавливаем DOCKER_HOST
    if (sshConfig) {
      const dockerHost = `ssh://${sshConfig.username}@${sshConfig.host}:${sshConfig.port || 22}`;
      env.DOCKER_HOST = dockerHost;
      logger.debug(`Setting DOCKER_HOST=${dockerHost} for docker-compose`);
    }

    return env;
  }

  /**
   * Создать Docker context для SSH подключения
   * Используется как альтернатива DOCKER_HOST
   * 
   * Примечание: Эта функция создает контекст через Docker CLI.
   * Требует наличия Docker CLI и SSH доступа.
   */
  static async createDockerContext(
    contextName: string,
    sshConfig: SSHConfig
  ): Promise<void> {
    const dockerHost = `ssh://${sshConfig.username}@${sshConfig.host}:${sshConfig.port || 22}`;
    const cmd = `docker context create ${contextName} --docker "host=${dockerHost}"`;

    logger.debug(`Creating Docker context: ${cmd}`);

    try {
      execSync(cmd, {
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      logger.info(`Docker context "${contextName}" created successfully`);
    } catch (error: any) {
      // Если контекст уже существует, это не критично
      if (error.message && error.message.includes('already exists')) {
        logger.warn(`Docker context "${contextName}" already exists`);
        return;
      }
      
      logger.error(`Failed to create Docker context: ${error.message}`);
      throw new Error(`Failed to create Docker context "${contextName}": ${error.message}`);
    }
  }

  /**
   * Проверить существование Docker context
   */
  static async contextExists(contextName: string): Promise<boolean> {
    try {
      const cmd = `docker context ls --format json`;
      const output = execSync(cmd, {
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      const contexts = output
        .trim()
        .split('\n')
        .filter((line) => line.trim())
        .map((line) => JSON.parse(line));

      return contexts.some((ctx: any) => ctx.Name === contextName);
    } catch {
      return false;
    }
  }
}

