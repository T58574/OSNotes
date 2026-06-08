# [OSNotes - Desktop iOS-style Notes App]

This project is a high-performance desktop notes application designed with an iOS Notes aesthetic. It runs as a secure and local-only native desktop application powered by **Wails (Go + TypeScript)**.

## [Technical Stack]

- **Core Framework**: Wails (v2/v3) for native multi-platform compilation (yielding a single `.exe` on Windows).
- **Frontend**: TypeScript + HTML/CSS/JS using premium aesthetic standards. Communication with the backend occurs through automatic Wails JS/TS bindings.
- **Backend**: Golang (Go) for system-level operations and local security.
- **Storage**: Flat files on the local filesystem with a `meta.json` indexing file.
- **Security**: AES-256 GCM (Galois/Counter Mode) encryption for End-to-End Encryption (E2EE). The master key is derived via PBKDF2 from a user-defined password (optional). Verification is performed using an encrypted static `verifier` token saved in the config.
- **Settings**: Grouped preferences storing accent color, note font size, themes, and sorting order in local storage.

## [Architectural Overview]

The backend is organized into decoupled modules with clear boundaries:

1. **Storage Module (`internal/storage`)**:
   - Manages CRUD operations on local files.
   - Maintains and updates `meta.json` safely using atomic write techniques: writing to a temporary file `meta.json.tmp` first, then calling `os.Rename` to avoid data corruption under Windows file locks.
   - Generates unique note IDs and tracks timestamps.

2. **Crypto Module (`internal/crypto`)**:
   - Key derivation using PBKDF2 from user master password.
   - AES-256 GCM encryption/decryption of note payloads.
   - Ensures zero plaintext leakage in notes saved on disk.

3. **App Runtime Module**:
   - Acts as the Wails entry point and orchestrates lifecycle events (startup, shutdown).

## [Directory Structure]

The local application directory is located at `~/.osnotes/`:

```
~/.osnotes/
├── config.json          (Contains encryption salt, verifier, and password config)
└── repo/                (The local directory containing metadata and notes)
    ├── meta.json        (Plaintext note metadata cache)
    └── notes/
        └── *.bin        (Encrypted note body files)
```

## [Data Schema (meta.json)]

The local state is tracked inside a single `meta.json` file structured as follows:

```json
{
  "version": 1,
  "last_synced": 1780838400000,
  "folders": [
    {
      "id": "work",
      "name": "Работа",
      "is_system": false,
      "created_at": 1780838400000
    }
  ],
  "notes": [
    {
      "id": "note_1780838400_abcde12345",
      "folder_id": "work",
      "title": "Идеи для проекта",
      "tags": ["идеи", "дизайн"],
      "created_at": 1780838400000,
      "updated_at": 1780838500000,
      "is_deleted": false
    }
  ]
}
```

Each note body is stored as a separate file under `repo/notes/<note_id>.bin` (encrypted content) matching local cache structure.

## [Key Guidelines]
- **No Comments in Code Blocks**: Strictly enforce zero-comment code blocks in Go and TS source files.
- **Performance First**: Zero or minimal memory allocations during cryptography. Avoid high-overhead reflection.
- **Reliability**: Atomic file writing to prevent data corruption.
