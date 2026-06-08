# OSNotes - Desktop iOS-style Notes App

Настольное приложение для заметок в стиле iOS с поддержкой E2EE шифрования и облачной синхронизации с GitHub.

## Требования

Для разработки и сборки приложения вам понадобятся:

- Go (1.23+)
- Node.js (v18+) и npm
- Wails CLI

Установка Wails CLI:

```bash
go install github.com/wailsapp/wails/v2/cmd/wails@latest
```

## Запуск в режиме разработки

Для запуска приложения с горячей перезагрузкой выполните:

```bash
wails dev
```

## Сборка EXE (для Windows)

Для компиляции готового исполняемого файла выполните:

```bash
wails build
```

После завершения сборки исполняемый файл будет доступен по пути:

```
build/bin/OSNotes.exe
```
