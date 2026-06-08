# [OSNotes - Desktop iOS-style Notes App]

This project is a high-performance desktop notes application designed with an iOS Notes aesthetic. It transitions from a client-only HTML/CSS/JS prototype into a robust, secure, and cloud-synced native desktop application powered by **Wails (Go + TypeScript)**.

## [Technical Stack]

- **Core Framework**: Wails (v2/v3) for native multi-platform compilation (yielding a single `.exe` on Windows).
- **Frontend**: TypeScript + HTML/CSS/JS using premium aesthetic standards (adapted via the `ui-ux-pro-max` design guidelines). Communication with the backend occurs through automatic Wails JS/TS bindings.
- **Backend**: Golang (Go) for system-level operations, security, and cloud synchronization.
- **Sync Engine**: `go-git` (pure Go implementation of Git, enabling git storage without needing a local CLI git client).
- **Storage**: Flat files on the local filesystem with a `meta.json` indexing file.
- **Security**: AES-256 GCM (Galois/Counter Mode) encryption for End-to-End Encryption (E2EE) before syncing files to GitHub. Master key is derived using PBKDF2 from a user-supplied Master Password.

## [Architectural Overview]

The backend is organized into decoupled modules with clear boundaries:

1. **Storage Module (`internal/storage`)**:
   - Manages CRUD operations on local files.
   - Maintains and updates `meta.json` safely using atomic write techniques: writing to a temporary file `meta.json.tmp` first, then calling `os.Rename` to avoid data corruption under Windows file locks.
   - Generates unique note IDs and tracks timestamps.

2. **Sync/Git Module (`internal/sync`)**:
   - Handles OAuth flow (spawning local redirect server or embedded webview).
   - Verifies and auto-creates the remote private GitHub repository (`ios-notes-data`).
   - Performs git sync operations (Pull, Stage, Commit, Push) using `go-git`.
   - Handles conflicts by adopting remote changes and writing local versions with `[Conflict YYYY-MM-DD_HH-MM]` suffixes.
   - Credentials isolation: `config.json` containing sensitive GitHub Personal Access Tokens resides outside the synced repository directory to prevent key leakage.

3. **Crypto Module (`internal/crypto`)**:
   - Key derivation using PBKDF2 from user master password.
   - AES-256 GCM encryption/decryption of note payloads.
   - Ensures zero plaintext leakage into the GitHub repository.

4. **App Runtime Module (`internal/app`)**:
   - Acts as the Wails entry point and orchestrates lifecycle events (startup, shutdown).
   - Coordinates background sync triggers (debounced modifications, offline-to-online transitions).

## [Directory Structure]

The local application directory is located at `~/.osnotes/`:

```
~/.osnotes/
├── config.json          (Contains encryption salt and git sync credentials, kept outside git)
└── repo/                (The actual synchronized local Git repository)
    ├── meta.json        (Plaintext note metadata cache)
    └── notes/
        └── *.bin        (Encrypted note body files synced with remote origin)
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

Each note body is stored as a separate file under `repo/notes/<note_id>.bin` (encrypted content for Git synchronization) and matching local cache structure.

## [Key Guidelines]
- **No Comments in Code Blocks**: Strictly enforce zero-comment code blocks in Go and TS source files.
- **Performance First**: Zero or minimal memory allocations during cryptography and git operations. Avoid high-overhead reflection.
- **Reliability**: Atomic file writing to prevent data corruption.
