# [OSNotes - Desktop iOS-style Notes App]

This project is a high-performance desktop notes application designed with an iOS Notes aesthetic. It transitions from a client-only HTML/CSS/JS prototype into a robust, secure, and cloud-synced native desktop application powered by **Wails (Go + TypeScript)**.

## [Technical Stack]

- **Core Framework**: Wails (v2/v3) for native multi-platform compilation (yielding a single `.exe` on Windows).
- **Frontend**: TypeScript + HTML/CSS/JS using premium aesthetic standards (adapted via the `ui-ux-pro-max` design guidelines). Communication with the backend occurs through automatic Wails JS/TS bindings.
- **Backend**: Golang (Go) for system-level operations, security, and cloud synchronization.
- **Sync Engine**: `go-git` (pure Go implementation of Git, using credentials acquired from the local GitHub CLI `gh`).
- **Storage**: Flat files on the local filesystem with a `meta.json` indexing file.
- **Security**: AES-256 GCM (Galois/Counter Mode) encryption for End-to-End Encryption (E2EE). The master key is derived via PBKDF2 from a user-defined password (optional). Verification is performed using an encrypted static `verifier` token saved in the config.
- **Settings**: Grouped preferences storing accent color, note font size, themes, and sorting order in local storage.

## [Architectural Overview]

The backend is organized into decoupled modules with clear boundaries:

1. **Storage Module (`internal/storage`)**:
   - Manages CRUD operations on local files.
   - Maintains and updates `meta.json` safely using atomic write techniques: writing to a temporary file `meta.json.tmp` first, then calling `os.Rename` to avoid data corruption under Windows file locks.
   - Generates unique note IDs and tracks timestamps.

2. **Sync/Git Module (`internal/sync`)**:
   - Handles authentication by querying the local GitHub CLI (`gh auth token`) to fetch the active token, eliminating the need for complex OAuth setup and manual Personal Access Token (PAT) configuration.
   - Verifies and auto-creates the remote private GitHub repository (`ios-notes-data`) with the actual remote clone URL.
   - Automatically initializes Git tracking locally, performing a temporary backup and merge sequence to prevent overwriting existing local files when connecting to Git for the first time.
   - Performs git sync operations (Pull, Stage, Commit, Push) using `go-git`.
   - Credentials isolation: `config.json` containing encryption verifier and git credentials resides outside the synced repository directory.

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
├── config.json          (Contains encryption salt, verifier, password config, and sync credentials)
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
