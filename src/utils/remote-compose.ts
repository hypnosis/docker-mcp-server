/**
 * Remote Compose File Reader
 * Utility for reading and parsing remote docker-compose.yml files via SSH
 */

import { logger } from './logger.js';
import { readRemoteFile } from './ssh-exec.js';
import { ComposeParser } from '../discovery/compose-parser.js';
import type { SSHConfig } from './ssh-config.js';
import type { ProjectConfig } from '../discovery/types.js';

/**
 * Result of reading remote compose file
 */
export interface RemoteComposeResult {
  /** YAML content as string */
  content: string;
  /** Full path to compose file on remote server */
  filePath: string;
}

/**
 * Read remote docker-compose.yml file content (RAW YAML)
 * 
 * @param projectName - Project name
 * @param sshConfig - SSH configuration
 * @returns Raw YAML content and file path
 */
export async function readRemoteComposeContent(
  projectName: string,
  sshConfig: SSHConfig
): Promise<RemoteComposeResult> {
  const projectsPath = sshConfig.projectsPath || '/var/www';
  const possiblePaths = [
    `${projectsPath}/${projectName}/docker-compose.yml`,
    `${projectsPath}/${projectName}/compose.yml`,
    `${projectsPath}/${projectName}/docker-compose.yaml`,
    `${projectsPath}/${projectName}/compose.yaml`,
  ];
  
  let composeContent: string | null = null;
  let composeFile: string = '';
  
  for (const remoteComposePath of possiblePaths) {
    try {
      logger.debug(`Trying to read remote compose file: ${remoteComposePath}`);
      composeContent = await readRemoteFile(remoteComposePath, {
        sshConfig,
        timeout: 30000,
      });
      composeFile = remoteComposePath;
      logger.info(`Successfully read remote compose file from: ${remoteComposePath}`);
      break;
    } catch (error: any) {
      logger.debug(`Failed to read from ${remoteComposePath}: ${error.message}`);
    }
  }
  
  if (!composeContent) {
    throw new Error(
      `Remote compose file not found for project '${projectName}' in ${projectsPath}. ` +
      `Tried: docker-compose.yml, compose.yml, docker-compose.yaml, compose.yaml`
    );
  }
  
  return {
    content: composeContent,
    filePath: composeFile,
  };
}

/**
 * Read and PARSE remote docker-compose.yml file
 * 
 * @param projectName - Project name
 * @param sshConfig - SSH configuration
 * @returns Parsed project configuration with services
 */
export async function readRemoteComposeFile(
  projectName: string,
  sshConfig: SSHConfig
): Promise<ProjectConfig> {
  // Read raw content
  const { content, filePath } = await readRemoteComposeContent(projectName, sshConfig);
  
  // Parse compose file
  const composeParser = new ComposeParser();
  const projectConfig = composeParser.parseFromString(content, filePath);
  
  // Set project name and remote path
  projectConfig.name = projectName;
  projectConfig.composeFile = filePath;
  projectConfig.projectDir = `${sshConfig.projectsPath || '/var/www'}/${projectName}`;
  
  logger.info(`Parsed remote compose file: ${Object.keys(projectConfig.services).length} services found`);
  
  return projectConfig;
}
