/**
 * Schema Helpers
 * Common schema definitions for MCP tools
 */

/**
 * SSH configuration schema for direct SSH connection
 * Can be used instead of profile parameter
 */
export const sshConfigSchema = {
  type: 'object' as const,
  description: 'Direct SSH configuration (overrides profile parameter)',
  properties: {
    host: {
      type: 'string',
      description: 'Server address (IP or domain)',
    },
    username: {
      type: 'string',
      description: 'SSH username',
    },
    port: {
      type: 'number',
      description: 'SSH port (default: 22)',
    },
    privateKeyPath: {
      type: 'string',
      description: 'Path to private SSH key (supports ~ for home directory)',
    },
    password: {
      type: 'string',
      description: 'SSH password (not recommended, use privateKeyPath instead)',
    },
    passphrase: {
      type: 'string',
      description: 'Passphrase for encrypted private key',
    },
    projectsPath: {
      type: 'string',
      description: 'Base path for Docker projects on remote server (e.g., /var/www)',
    },
  },
  required: ['host', 'username'],
};

/**
 * Profile parameter schema
 */
export const profileSchema = {
  type: 'string' as const,
  description: 'Profile name from DOCKER_PROFILES environment variable (default: uses default profile from config)',
};

/**
 * Get common connection parameters (profile + ssh)
 * Use this in tool schemas for consistent SSH/profile support
 */
export function getConnectionParams() {
  return {
    profile: profileSchema,
    ssh: sshConfigSchema,
  };
}
