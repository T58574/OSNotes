# 📝 OSNotes — Desktop Apple-Style Notes with E2EE & GitHub Sync

<div align="center">

[![Go](https://img.shields.io/badge/Go-1.23%2B-00ADD8?style=flat-square&logo=go&logoColor=white)](https://golang.org/)
[![Wails v2](https://img.shields.io/badge/Framework-Wails_v2-DF0000?style=flat-square&logo=wails&logoColor=white)](https://wails.io/)
[![React](https://img.shields.io/badge/React-18%2B-61DAFB?style=flat-square&logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Encryption](https://img.shields.io/badge/Security-AES--256_GCM-green?style=flat-square)](https://en.wikipedia.org/wiki/Galois/Counter_Mode)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)

**A desktop note-taking workstation styled after Apple iOS/macOS Notes featuring client-side AES-256 GCM end-to-end encryption, GitHub cloud sync, and custom theme engines.**

[Key Features](#-key-features) • [Architecture](#-architecture) • [Security Model](#-security--encryption-model) • [Quick Start](#-quick-start) • [License](#-license)

</div>

---

## 📖 Overview

**OSNotes** is a fast, offline-first desktop note-taking application crafted in **Go** and **React/TypeScript** via **Wails v2**. Built for privacy-conscious developers and writers who appreciate the minimalist design of Apple Notes, it adds true **zero-knowledge End-to-End Encryption (E2EE)** and seamless decentralized cloud backup directly into your private GitHub repository (`ios-notes-data`).

---

## ✨ Key Features

- 🔒 **Client-Side AES-256 GCM End-to-End Encryption (E2EE)**
  - Local notes are encrypted before writing to disk using authenticated AES-256 GCM. Master passwords are never written to disk or sent over the wire; key verification is handled via cryptographic hash verifiers.
- ☁️ **Hybrid GitHub Cloud Sync**
  - Seamless two-way synchronization with a private GitHub repository (`ios-notes-data`). Supports 1-click GitHub OAuth or Personal Access Tokens (PAT) with automated conflict resolution and delta merging.
- 🎨 **Authentic Apple Notes UI & Customization**
  - Polished iOS/macOS aesthetics with responsive two-pane sidebar, custom folder hierarchies, light/dark/system themes, accent color switchers, and dynamic typography scaling.
- ⚡ **Zero-Latency Native Execution**
  - Powered by Go and system WebView2, consuming minimal memory and starting up instantly.

---

## 🏗️ Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                   OSNotes React / TypeScript UI                  │
│       (Apple Notes Theme + Folder Hierarchy + Markdown Editor)   │
└─────────────────────────────────┬────────────────────────────────┘
                                  │ Wails v2 IPC Bridge
┌─────────────────────────────────▼────────────────────────────────┐
│                        Go Backend Core                           │
│                                                                  │
│  ┌────────────────────────┐  ┌────────────────────────────────┐  │
│  │ AES-256 GCM Encryptor  │  │ Local File Storage Engine      │  │
│  │ (PBKDF2 Key Derivation)│  │ (Encrypted JSON Payload)       │  │
│  └────────────────────────┘  └────────────────────────────────┘  │
│  ┌────────────────────────┐  ┌────────────────────────────────┐  │
│  │ GitHub Sync Engine     │  │ Conflict Resolution & Delta    │  │
│  │ (GitHub REST API / PAT)│  │ (Timestamp-based Merging)      │  │
│  └────────────────────────┘  └────────────────────────────────┘  │
└─────────────────────────────────┬────────────────────────────────┘
                                  │ Local Disk & GitHub Cloud
┌─────────────────────────────────▼────────────────────────────────┐
│           Encrypted Local Cache • Private GitHub Repo            │
└──────────────────────────────────────────────────────────────────┘
```

---

## 🔒 Security & Encryption Model

1. **Key Derivation**: User master password is run through `PBKDF2` (100,000 iterations, SHA-256) to produce a 256-bit AES key.
2. **Payload Encryption**: Each note is serialized to JSON and encrypted with AES-256 GCM using a unique 12-byte cryptographic nonce.
3. **Authentication Tag**: GCM generates a 16-byte authentication tag ensuring ciphertext integrity and preventing tampering.

---

## 🚀 Quick Start

### Prerequisites
- **Go**: `v1.21` or higher
- **Node.js**: `v18.0.0` or higher
- **Wails CLI**: `go install github.com/wailsapp/wails/v2/cmd/wails@latest`

### 1. Clone the Repository
```bash
git clone https://github.com/T58574/OSNotes.git
cd OSNotes
```

### 2. Run in Development Mode
```bash
wails dev
```

### 3. Build Standalone Production Executable
```bash
wails build -platform windows/amd64
```
Output binary will be generated at: `build/bin/OSNotes.exe`.

---

## 📜 License

Distributed under the **MIT License**. See [LICENSE](LICENSE) for details.
