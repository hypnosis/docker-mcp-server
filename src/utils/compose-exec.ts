/**
 * Compose Exec
 * CLI wrapper для docker-compose команд
 */

import { spawnSync } from 'child_process';
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
    // Используем docker compose (v2) вместо docker-compose (v1)
    // docker compose работает везде, docker-compose может отсутствовать
    let cmd = `docker compose -f ${composeFile}`;

    // Добавляем Docker context (если указан)
    if (options.dockerContext) {
      cmd = `docker compose --context ${options.dockerContext} -f ${composeFile}`;
      logger.debug(`Using Docker context: ${options.dockerContext}`);
    }

    cmd = `${cmd} ${args.join(' ')}`;

    logger.debug(`Executing docker compose: ${cmd}`);
    if (options.cwd) {
      logger.debug(`Working directory: ${options.cwd}`);
    }

    // Подготавливаем окружение для выполнения команды
    const env = this.prepareEnvironment(options.sshConfig);

    // Разбиваем команду на части для spawnSync
    const [command, ...commandArgs] = cmd.split(' ');

    const result = spawnSync(command, commandArgs, {
      cwd: options.cwd,
      env: env,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    // Проверяем exit code
    if (result.status !== 0 && result.status !== null) {
      // Команда завершилась с ошибкой
      let errorMessage = result.stderr || result.stdout || 'Unknown error';
      
      // Если есть stdout, добавляем его к сообщению
      if (result.stdout && result.stdout.trim()) {
        errorMessage = `${errorMessage}\n${result.stdout}`;
      }
      
      logger.error('docker compose command failed:', {
        status: result.status,
        stderr: result.stderr,
        stdout: result.stdout,
      });
      
      throw new Error(`docker compose failed: ${errorMessage}`);
    }

    // Команда выполнена успешно (status === 0 или null)
    // Возвращаем stdout, игнорируя stderr (он может содержать предупреждения)
    return result.stdout || '';
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

    const [command, ...args] = cmd.split(' ');
    const result = spawnSync(command, args, {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    if (result.status !== 0 && result.status !== null) {
      const errorMessage = result.stderr || result.stdout || 'Unknown error';
      
      // Если контекст уже существует, это не критично
      if (errorMessage.includes('already exists')) {
        logger.warn(`Docker context "${contextName}" already exists`);
        return;
      }
      
      logger.error(`Failed to create Docker context: ${errorMessage}`);
      throw new Error(`Failed to create Docker context "${contextName}": ${errorMessage}`);
    }
    
    logger.info(`Docker context "${contextName}" created successfully`);
  }

  /**
   * Проверить существование Docker context
   */
  static async contextExists(contextName: string): Promise<boolean> {
    try {
      const result = spawnSync('docker', ['context', 'ls', '--format', 'json'], {
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      if (result.status !== 0 && result.status !== null) {
        return false;
      }

      const output = result.stdout || '';
      const contexts = output
        .trim()
        .split('\n')
        .filter((line: string) => line.trim())
        .map((line: string) => JSON.parse(line));

      return contexts.some((ctx: any) => ctx.Name === contextName);
    } catch {
      return false;
    }
  }
}

