/**
 * SQL Validator
 * Валидация опасных SQL команд для защиты от случайных удалений
 */

export class SQLValidator {
  private dangerousPatterns = [
    /DROP\s+DATABASE/i,
    /DROP\s+TABLE/i,
    /TRUNCATE\s+TABLE/i,
    /DELETE\s+FROM\s+\w+\s*;/i, // DELETE без WHERE
    /UPDATE\s+\w+\s+SET\s+.*\s*;/i, // UPDATE без WHERE (упрощенная проверка)
  ];

  /**
   * Валидировать SQL запрос
   * Бросает ошибку если опасный
   */
  validate(sql: string): void {
    // Проверяем включена ли валидация
    if (!SQLValidator.isEnabled()) {
      return;
    }

    for (const pattern of this.dangerousPatterns) {
      if (pattern.test(sql)) {
        throw new Error(
          `🚨 DANGEROUS SQL DETECTED: This query may cause data loss.\n` +
          `Pattern: ${pattern.source}\n` +
          `Query: ${sql}\n\n` +
          `If you're sure, disable validation: DOCKER_MCP_VALIDATE_SQL=false`
        );
      }
    }
  }

  /**
   * Проверить включена ли валидация
   * По умолчанию: ВКЛ (защита)
   * Отключение: DOCKER_MCP_VALIDATE_SQL=false
   */
  static isEnabled(): boolean {
    return process.env.DOCKER_MCP_VALIDATE_SQL !== 'false';
  }
}

/**
 * Singleton instance
 */
export const sqlValidator = new SQLValidator();

