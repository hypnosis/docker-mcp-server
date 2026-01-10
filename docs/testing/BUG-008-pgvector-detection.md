# BUG-008: detectServiceType не распознает pgvector и другие PostgreSQL варианты

**Приоритет:** 🟡 СРЕДНИЙ  
**Статус:** ✅ ИСПРАВЛЕНО  
**Дата обнаружения:** 2026-01-10  
**Дата исправления:** 2026-01-10

## Описание

Функция `detectServiceType()` в `ComposeParser` и `ProjectDiscovery` не распознавала PostgreSQL варианты типа `ankane/pgvector`, `timescaledb`, `postgis`, определяя их как `generic`.

## Воспроизведение

```yaml
postgres:
  image: ankane/pgvector:latest  # ❌ Определялось как "generic"
```

## Проблема

```typescript
if (image.includes('postgres')) return 'postgresql';
```
Не находит "postgres" в "ankane/pgvector:latest".

## Исправление

Добавлена поддержка PostgreSQL вариантов и MariaDB:

```typescript
// PostgreSQL variants: postgres, postgresql, pgvector, timescaledb, postgis
if (image.includes('postgres') || image.includes('pgvector') || 
    image.includes('timescale') || image.includes('postgis')) {
  return 'postgresql';
}

if (image.includes('mysql') || image.includes('mariadb')) return 'mysql';
```

## Файлы изменены

- `src/discovery/compose-parser.ts` - обновлен `detectServiceType()`
- `src/discovery/project-discovery.ts` - обновлен `detectServiceType()` (дубликат)

## Результат

✅ `ankane/pgvector:latest` → `postgresql`  
✅ `timescaledb/timescaledb:latest` → `postgresql`  
✅ `postgis/postgis:latest` → `postgresql`  
✅ `mariadb:latest` → `mysql`
