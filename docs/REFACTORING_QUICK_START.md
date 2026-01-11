# Quick Start: Profile Client Pool Refactoring

> **Для нового агента:** Быстрый старт рефакторинга

## 🎯 Цель

Мигрировать с `getDockerClient(sshConfig)` на `getDockerClientForProfile(profileName)`

## 🐛 Проблема в одной строке

Два профиля с одним `host`, но разными SSH ключами используют ОДИН клиент → security bug + строгая проверка не работает.

## ✅ Решение в одной строке

Кэшировать клиенты по имени профиля, а не по host.

## 📋 План (8 phases, ~15 часов)

1. ✅ **Подготовка** — найти все `getDockerClient(sshConfig)`
2. ✅ **Managers** — изменить конструкторы (принимать `profileName`)
3. ✅ **Tools** — убрать `resolveSSHConfig()`, передавать `args.profile`
4. ✅ **Adapters** — обновить database adapters
5. ✅ **Cleanup** — удалить старую систему singleton
6. ✅ **Tests** — обновить все тесты
7. ✅ **Docs** — CHANGELOG + ARCHITECTURE
8. ✅ **Release** — версия 1.4.0

## 🔍 Ключевые файлы для изменения

### Managers (Phase 2)
```
src/managers/container-manager.ts   ← constructor(profileName?)
src/managers/compose-manager.ts     ← constructor(profileName?)
src/managers/env-manager.ts         ← проверить, нужно ли
```

### Tools (Phase 3)
```
src/tools/container-tools.ts   ← убрать resolveSSHConfig, использовать args.profile
src/tools/executor-tool.ts     ← аналогично
src/tools/database-tools.ts    ← аналогично
src/tools/env-tools.ts         ← аналогично
```

### Database Adapters (Phase 4)
```
src/adapters/postgresql.ts   ← обновить конструктор
src/adapters/redis.ts        ← обновить конструктор
src/adapters/sqlite.ts       ← обновить конструктор
```

### Core (Phase 5)
```
src/utils/docker-client.ts   ← удалить getDockerClient(sshConfig) singleton
```

## 💻 Пример изменения

### ContainerManager

```typescript
// БЫЛО:
export class ContainerManager {
  constructor(sshConfig?: SSHConfig | null) {
    this.isRemote = !!sshConfig;
    this.dockerClient = getDockerClient(sshConfig);  // ← Старая система
    this.docker = this.dockerClient.getClient();
  }
}

// СТАНЕТ:
export class ContainerManager {
  constructor(profileName?: string) {  // ← Новый параметр
    this.dockerClient = getDockerClientForProfile(profileName);  // ← Новая система
    this.isRemote = this.dockerClient.isRemote;
    this.docker = this.dockerClient.getClient();
  }
}
```

### ContainerTools

```typescript
// БЫЛО:
private async handleList(args: any) {
  const sshConfig = resolveSSHConfig(args);  // ← Убрать
  const containerManager = new ContainerManager(sshConfig);
  // ...
}

// СТАНЕТ:
private async handleList(args: any) {
  const containerManager = new ContainerManager(args.profile);  // ← Напрямую
  // ...
}
```

## 🧪 Критичный тест для проверки

```typescript
// tests/e2e/profile-bug-fix.test.ts
describe('Profile Client Pool Bug Fix', () => {
  it('should use different clients for different profiles with same host', async () => {
    // Два профиля: один host, разные ключи
    const profiles = {
      'prod-admin': { 
        host: 'prod.example.com', 
        privateKeyPath: '~/.ssh/id_rsa_admin' 
      },
      'prod-readonly': { 
        host: 'prod.example.com', 
        privateKeyPath: '~/.ssh/id_rsa_readonly' 
      }
    };
    
    // Первый вызов — admin ключ
    const client1 = getDockerClientForProfile('prod-admin');
    await client1.ping(); // ✅ Должен работать
    
    // Второй вызов — readonly ключ
    const client2 = getDockerClientForProfile('prod-readonly');
    
    // ❗ Проверка: разные клиенты для разных профилей
    expect(client1).not.toBe(client2);
  });
});
```

## 📚 Полная документация

Читай: [REFACTORING_PROFILE_CLIENT_POOL.md](./REFACTORING_PROFILE_CLIENT_POOL.md)

## ✅ Checklist для нового агента

### Начало работы
- [ ] Прочитать полный план: `REFACTORING_PROFILE_CLIENT_POOL.md`
- [ ] Создать feature branch: `git checkout -b refactor/profile-client-pool`
- [ ] Запустить тесты (baseline): `npm run test`

### Phase 1: Анализ
- [ ] Найти все `getDockerClient(` в src/
- [ ] Найти все `new.*Manager(` в src/tools/
- [ ] Найти все `constructor.*sshConfig` в src/managers/
- [ ] Создать список файлов для изменения

### Phase 2-8: Выполнение
- [ ] Следовать плану в `REFACTORING_PROFILE_CLIENT_POOL.md`
- [ ] После каждой фазы: `npm run build && npm run test`
- [ ] Коммитить после каждой фазы

### Завершение
- [ ] Все тесты проходят
- [ ] Версия обновлена: 1.4.0
- [ ] CHANGELOG.md обновлен
- [ ] Финальный коммит
- [ ] Push в репозиторий

## 🚀 Команды

```bash
# Анализ
grep -r "getDockerClient(" src/
grep -r "new.*Manager(" src/tools/
grep -r "constructor.*sshConfig" src/managers/

# Сборка и тесты
npm run build
npm run test
npm run test:e2e

# Git
git checkout -b refactor/profile-client-pool
git add .
git commit -m "refactor: migrate to profile-based client pool"
git push origin refactor/profile-client-pool
```

## 💡 Важные моменты

1. **Breaking change** — версия 1.4.0 (minor)
2. **Migration guide** — обязателен в CHANGELOG
3. **Тесты** — главный приоритет после кода
4. **Производительность** — не должна ухудшиться
5. **Security** — главная причина рефакторинга

## 📞 Если что-то непонятно

Читай полный документ: `docs/REFACTORING_PROFILE_CLIENT_POOL.md`

Он содержит:
- Детальное описание проблемы
- Диаграммы текущего и нового flow
- Примеры кода для каждого файла
- Риски и их митигацию
- Оценки времени

---

**Готов к запуску!** 🚀
