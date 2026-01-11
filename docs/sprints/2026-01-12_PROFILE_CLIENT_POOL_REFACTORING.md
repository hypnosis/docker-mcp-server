# 🎯 Спринт: Profile Client Pool Refactoring

**Статус:** ✅ ЧАСТИЧНО ЗАВЕРШЕНО (Agent #1)  
**Дата:** 2026-01-12  
**Приоритет:** HIGH (Security + Bug Fix)  
**Версия:** 1.3.2 → 1.4.0

---

## 📅 Цель

Мигрировать с `getDockerClient(sshConfig)` на `getDockerClientForProfile(profileName)` для исправления security бага с кэшированием SSH клиентов.

---

## 🐛 Проблема

Два профиля с одним `host`, но разными SSH ключами используют ОДИН клиент:
- Security issue: неправильный ключ может дать больше прав
- Строгая проверка не работает
- Непредсказуемое поведение

---

## ✅ Выполнено Agent #1

### Phase 1: Анализ зависимостей (1 час)
- ✅ Найдены все `getDockerClient(sshConfig)` в src/
- ✅ Найдены все `new Manager(sshConfig)` в tools
- ✅ Документирован текущий flow

### Phase 2: Рефакторинг Managers (2 часа)
- ✅ `ContainerManager`: constructor(profileName?)
- ✅ `ComposeManager`: constructor(profileName?)
- ✅ `EnvManager`: не трогали (локальный)

### Phase 3: Рефакторинг Tools (3 часа)
- ✅ `container-tools.ts`: убрали resolveSSHConfig()
- ✅ `executor-tool.ts`: аналогично
- ✅ `database-tools.ts`: обновили createAdapter()
- ✅ `env-tools.ts`: обновили getProject()
- ✅ `discovery-tools.ts`: use getDockerClientForProfile()
- ✅ `mcp-health-tool.ts`: обновили

### Phase 5: Cleanup (1 час)
- ✅ Удалили старый singleton (getDockerClient(sshConfig))
- ✅ Удалили resetDockerClient()
- ✅ Удалили cleanupDockerClient()
- ✅ Оставили только profile-based систему

### Дополнительно
- ✅ Обновили port-utils.ts
- ✅ Обновили index.ts
- ✅ Экспортировали loadProfileConfig() из docker-client.ts
- ✅ Git commit: f8f67088e5a07403328cc390ee51468715354168
- ✅ Build проходит: `npm run build` ✅

---

## ⏳ Осталось для Agent #2

### Phase 4: Рефакторинг Database Adapters (2-3 часа)
- [ ] `src/adapters/postgresql.ts` — обновить конструктор
- [ ] `src/adapters/redis.ts` — обновить конструктор
- [ ] `src/adapters/sqlite.ts` — обновить конструктор
- [ ] Решить: принимать profileName или DockerClient?

### Phase 6: Обновление тестов (2-3 часа)
- [ ] Unit тесты:
  - [ ] `tests/unit/utils/docker-client.test.ts`
  - [ ] `tests/unit/managers/container-manager.test.ts`
  - [ ] `tests/unit/tools/container-tools.test.ts`
- [ ] E2E тесты:
  - [ ] `tests/e2e/categories/profile-parameter.test.ts`
  - [ ] Добавить тест для багфикса (два профиля, один host)
- [ ] Integration тесты:
  - [ ] Создать тест: два профиля с разными ключами

### Phase 7: Документация (1 час)
- [ ] Обновить `CHANGELOG.md` (Migration Guide!)
- [ ] Обновить `ARCHITECTURE.md` (диаграммы)
- [ ] Обновить `DEVELOPER_ARCHITECTURE.md`

### Phase 8: Релиз (30 минут)
- [ ] Обновить версию в `package.json`: 1.3.2 → 1.4.0
- [ ] `npm run build`
- [ ] `npm run test` (все должны пройти)
- [ ] Git commit: "chore: release v1.4.0"
- [ ] Git tag: v1.4.0

---

## 📊 Статистика

### Agent #1 (выполнено)
- **Фазы:** 1, 2, 3, 5
- **Файлов изменено:** 11
- **Время:** ~7 часов
- **Build:** ✅ PASSED

### Agent #2 (осталось)
- **Фазы:** 4, 6, 7, 8
- **Время:** ~6-8 часов
- **Файлов на изменение:** ~20 (adapters + tests + docs)

---

## 🚀 Следующий шаг

Запустить **Agent #2** для завершения:
1. Рефакторинг Database Adapters
2. Обновление всех тестов
3. Документация
4. Релиз v1.4.0

**Команда для Agent #2:**
```
Продолжить рефакторинг Profile Client Pool.
Agent #1 выполнил Phase 1, 2, 3, 5 (core refactoring).
Нужно выполнить Phase 4, 6, 7, 8 (adapters, tests, docs, release).

Читай: docs/REFACTORING_QUICK_START.md и docs/sprints/2026-01-12_PROFILE_CLIENT_POOL_REFACTORING.md
```

---

## 📝 Референсы

- [REFACTORING_PROFILE_CLIENT_POOL.md](../REFACTORING_PROFILE_CLIENT_POOL.md) — Полный план
- [REFACTORING_QUICK_START.md](../REFACTORING_QUICK_START.md) — Быстрый старт
- [SESSION_2026-01-12_STRICT_SSH_AND_BUG_DISCOVERY.md](../SESSION_2026-01-12_STRICT_SSH_AND_BUG_DISCOVERY.md) — История бага
- [BUGS_PROFILE_SSH.md](../BUGS_PROFILE_SSH.md) — Документация багов

---

**Статус:** ✅ Agent #1 завершил свою часть успешно!  
**Git commit:** f8f67088e5a07403328cc390ee51468715354168  
**Build:** ✅ PASSED
