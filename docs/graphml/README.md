# GraphML Диаграммы

> GraphML файлы для визуализации архитектуры системы

## 📊 Доступные Диаграммы

### architecture.graphml

Диаграмма архитектуры Docker MCP Server, показывающая:
- Все компоненты системы
- Связи между модулями
- Потоки данных
- Типы зависимостей

## 🛠️ Просмотр Диаграмм

### Вариант 1: yEd Graph Editor (Рекомендуется)

1. Скачать yEd: https://www.yworks.com/products/yed
2. Открыть файл `architecture.graphml`
3. Выбрать layout: `Hierarchical` или `Organic`
4. Экспортировать в PNG/PDF

### Вариант 2: Graphviz (если поддерживает GraphML)

```bash
# Установить graphviz
brew install graphviz  # Mac
sudo apt-get install graphviz  # Linux

# Конвертировать (если поддерживается)
dot -Tpng architecture.graphml -o architecture.png
```

### Вариант 3: Онлайн редакторы

- **GraphML Editor:** https://graphml.graphdrawing.org/editor.html
- **draw.io:** Импорт GraphML (экспериментально)
- **yEd Live:** https://www.yworks.com/yed-live/

### Вариант 4: VS Code Extension

1. Установить расширение "GraphML Preview"
2. Открыть `.graphml` файл
3. Использовать Preview панель

## 📝 Структура Диаграммы

### Узлы (Nodes)

- **Client Layer:** MCP Client (Cursor/Claude)
- **Server Layer:** MCP Server (index.ts)
- **Discovery:** Project Discovery, Compose Parser, Config Merger
- **Client:** Dockerode Client
- **Managers:** Container, Compose, Environment Managers
- **Adapters:** PostgreSQL, Redis, SQLite Adapters
- **Security:** Secrets Masker, SQL Validator
- **Tools:** Container, Database, Environment, Executor Tools
- **External:** Docker Engine
- **Utilities:** Logger, Cache

### Рёбра (Edges)

Типы связей:
- **protocol:** MCP Protocol
- **registration:** Регистрация tools
- **dependency:** Использование модуля
- **management:** Управление адаптерами
- **execution:** Выполнение команд
- **api:** Docker API
- **logging:** Логирование
- **optional:** Опциональная зависимость

## 🔄 Обновление Диаграммы

При изменении архитектуры:

1. Открыть `architecture.graphml` в yEd
2. Добавить/удалить узлы/рёбра
3. Обновить стили при необходимости
4. Сохранить файл
5. Экспортировать в PNG для документации (опционально)

## 📚 Связанные Документы

- [Developer Architecture](../DEVELOPER_ARCHITECTURE.md) — Детальная архитектура
- [Architecture](../ARCHITECTURE.md) — Общая архитектура
- [Sprints](../sprints/SPRINTS.md) — План разработки

---

**Обновлено:** 2025-01-01 (Sprint 3)

