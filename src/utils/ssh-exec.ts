/**
 * SSH Command Execution Module
 * Execute commands and read files on remote servers via SSH
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { logger } from './logger.js';
import type { SSHConfig } from './ssh-config.js';

const execAsync = promisify(exec);

/**
 * SSH command execution options
 */
export interface SSHExecOptions {
  /** SSH config for connection */
  sshConfig: SSHConfig;
  /** Working directory for command execution */
  cwd?: string;
  /** Timeout in milliseconds (default: 30000) */
  timeout?: number;
  /** Max buffer size in bytes (default: 10MB) */
  maxBuffer?: number;
}

/**
 * SSH file reading options
 */
export interface SSHReadFileOptions {
  /** SSH config for connection */
  sshConfig: SSHConfig;
  /** Timeout in milliseconds (default: 30000) */
  timeout?: number;
}

/**
 * SSH command execution result
 */
export interface SSHExecResult {
  /** Command output (stdout) */
  stdout: string;
  /** Error output (stderr) */
  stderr: string;
  /** Exit code */
  code: number;
}

/**
 * Build SSH command string
 */
function buildSSHCommand(sshConfig: SSHConfig, remoteCommand: string): string {
  const args: string[] = [];

  // Add SSH options
  args.push('-o', 'StrictHostKeyChecking=no');
  args.push('-o', 'UserKnownHostsFile=/dev/null');
  args.push('-o', 'ConnectTimeout=10');

  // Add port if not default
  if (sshConfig.port && sshConfig.port !== 22) {
    args.push('-p', String(sshConfig.port));
  }

  // Add private key if specified
  if (sshConfig.privateKeyPath) {
    const keyPath = sshConfig.privateKeyPath.startsWith('~')
      ? sshConfig.privateKeyPath.replace('~', process.env.HOME || process.env.USERPROFILE || '')
      : sshConfig.privateKeyPath;
    args.push('-i', keyPath);
  }

  // Add username and host
  args.push(`${sshConfig.username}@${sshConfig.host}`);

  // Escape command for shell
  const escapedCommand = remoteCommand.replace(/'/g, "'\"'\"'");
  args.push(`'${escapedCommand}'`);

  return `ssh ${args.join(' ')}`;
}

/**
 * Execute command on remote server via SSH
 */
export async function execSSH(
  command: string,
  options: SSHExecOptions
): Promise<SSHExecResult> {
  const { sshConfig, cwd, timeout = 30000, maxBuffer = 10 * 1024 * 1024 } = options;

  // Build full command with working directory if specified
  let remoteCommand = command;
  if (cwd) {
    remoteCommand = `cd ${cwd.replace(/'/g, "'\"'\"'")} && ${command}`;
  }

  // Build SSH command
  const sshCommand = buildSSHCommand(sshConfig, remoteCommand);

  logger.debug(`Executing SSH command: ${sshCommand}`);

  try {
    const { stdout, stderr } = await execAsync(sshCommand, {
      timeout,
      maxBuffer,
      env: {
        ...process.env,
        // Don't pass SSH passphrase via env (use SSH agent instead)
      },
    });

    return {
      stdout: stdout.trim(),
      stderr: stderr.trim(),
      code: 0,
    };
  } catch (error: any) {
    // exec throws error on non-zero exit code
    const exitCode = error.code || 1;
    const stderr = error.stderr || error.message || '';
    const stdout = error.stdout || '';

    // Don't treat non-zero exit as error for commands that may return it
    return {
      stdout: stdout.trim(),
      stderr: stderr.trim(),
      code: exitCode,
    };
  }
}

/**
 * Read file from remote server via SSH
 */
export async function readRemoteFile(
  filePath: string,
  options: SSHReadFileOptions
): Promise<string> {
  const { sshConfig, timeout = 30000 } = options;

  // Escape path for shell
  const escapedPath = filePath.replace(/'/g, "'\"'\"'");
  const command = `cat '${escapedPath}'`;

  logger.debug(`Reading remote file: ${filePath}`);

  const result = await execSSH(command, {
    sshConfig,
    timeout,
  });

  if (result.code !== 0) {
    throw new Error(`Failed to read remote file ${filePath}: ${result.stderr || 'Unknown error'}`);
  }

  return result.stdout;
}

/**
 * Find files on remote server via SSH
 */
export async function findRemoteFiles(
  pattern: string,
  basePath: string,
  options: SSHExecOptions
): Promise<string[]> {
  const { sshConfig, timeout = 30000 } = options;

  // Escape paths for shell
  const escapedBasePath = basePath.replace(/'/g, "'\"'\"'");
  const escapedPattern = pattern.replace(/'/g, "'\"'\"'");

  // Build find command
  const command = `find '${escapedBasePath}' -name '${escapedPattern}' -type f 2>/dev/null || true`;

  logger.debug(`Finding remote files: ${command}`);

  const result = await execSSH(command, {
    sshConfig,
    timeout,
  });

  if (result.code !== 0) {
    logger.warn(`Find command returned non-zero exit code: ${result.stderr}`);
    return [];
  }

  // Split by newlines and filter empty strings
  const files = result.stdout
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0);

  return files;
}

/**
 * Check if file exists on remote server
 */
export async function remoteFileExists(
  filePath: string,
  options: SSHExecOptions
): Promise<boolean> {
  const { sshConfig, timeout = 10000 } = options;

  const escapedPath = filePath.replace(/'/g, "'\"'\"'");
  const command = `test -f '${escapedPath}' && echo 'exists' || echo 'not_found'`;

  const result = await execSSH(command, {
    sshConfig,
    timeout,
  });

  return result.stdout.trim() === 'exists';
}

/**
 * List directories on remote server
 */
export async function listRemoteDirectories(
  basePath: string,
  options: SSHExecOptions
): Promise<string[]> {
  const { sshConfig, timeout = 30000 } = options;

  const escapedPath = basePath.replace(/'/g, "'\"'\"'");
  const command = `find '${escapedPath}' -maxdepth 1 -type d ! -path '${escapedPath}' -printf '%P\\n' 2>/dev/null || ls -1 '${escapedPath}' | while read dir; do test -d "'${escapedPath}/'\"\$dir\" && echo \"\$dir\"; done`;

  logger.debug(`Listing remote directories: ${command}`);

  const result = await execSSH(command, {
    sshConfig,
    timeout,
  });

  if (result.code !== 0) {
    logger.warn(`List directories returned non-zero exit code: ${result.stderr}`);
    return [];
  }

  const dirs = result.stdout
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0);

  return dirs;
}
