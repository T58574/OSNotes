package main

import (
	"context"
	"crypto/rand"
	"encoding/json"
	"errors"
	"io/ioutil"
	"os"
	"path/filepath"
	"sync"
	"time"

	"osnotes/internal/crypto"
	"osnotes/internal/storage"
	gitsync "osnotes/internal/sync"
)

type SyncConfig struct {
	RemoteURL string `json:"remote_url"`
	Username  string `json:"username"`
	Token     string `json:"token"`
	Email     string `json:"email"`
}

type AppConfig struct {
	Salt       []byte     `json:"salt"`
	SyncConfig SyncConfig `json:"sync_config"`
}

type App struct {
	ctx         context.Context
	mu          sync.RWMutex
	baseDir     string
	repoDir     string
	config      AppConfig
	storage     *storage.StorageManager
	encryptor   *crypto.AESGCMEncryptor
	syncManager *gitsync.GitSyncManager
}

func NewApp() *App {
	home, err := os.UserHomeDir()
	var baseDir string
	if err != nil {
		baseDir = ".osnotes"
	} else {
		baseDir = filepath.Join(home, ".osnotes")
	}
	return &App{
		baseDir:     baseDir,
		repoDir:     filepath.Join(baseDir, "repo"),
		syncManager: gitsync.NewGitSyncManager(),
	}
}

func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
	_ = os.MkdirAll(a.baseDir, 0755)
	_ = a.loadConfig()
}

func (a *App) loadConfig() error {
	path := filepath.Join(a.baseDir, "config.json")
	data, err := ioutil.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			salt := make([]byte, 16)
			_, _ = rand.Read(salt)
			a.config = AppConfig{
				Salt: salt,
			}
			return a.saveConfig()
		}
		return err
	}
	return json.Unmarshal(data, &a.config)
}

func (a *App) saveConfig() error {
	path := filepath.Join(a.baseDir, "config.json")
	data, err := json.MarshalIndent(a.config, "", "  ")
	if err != nil {
		return err
	}
	return ioutil.WriteFile(path, data, 0644)
}

func (a *App) Unlock(password string) (bool, error) {
	a.mu.Lock()
	defer a.mu.Unlock()
	a.encryptor = crypto.NewAESGCMEncryptor([]byte(password), a.config.Salt)
	sm, err := storage.NewStorageManager(a.repoDir)
	if err != nil {
		a.encryptor = nil
		return false, err
	}
	a.storage = sm
	return true, nil
}

func (a *App) IsLocked() bool {
	a.mu.RLock()
	defer a.mu.RUnlock()
	return a.encryptor == nil
}

func (a *App) GetFolders() []storage.Folder {
	a.mu.RLock()
	defer a.mu.RUnlock()
	if a.storage == nil {
		return []storage.Folder{}
	}
	return a.storage.GetFolders()
}

func (a *App) CreateFolder(name string) storage.Folder {
	a.mu.Lock()
	defer a.mu.Unlock()
	if a.storage == nil {
		return storage.Folder{}
	}
	return a.storage.CreateFolder(name)
}

func (a *App) DeleteFolder(id string) {
	a.mu.Lock()
	defer a.mu.Unlock()
	if a.storage != nil {
		a.storage.DeleteFolder(id)
	}
}

func (a *App) GetNotes() []storage.NoteMetadata {
	a.mu.RLock()
	defer a.mu.RUnlock()
	if a.storage == nil {
		return []storage.NoteMetadata{}
	}
	var res []storage.NoteMetadata
	for _, n := range a.storage.GetNotes() {
		if !n.IsDeleted {
			res = append(res, n)
		}
	}
	return res
}

func (a *App) GetNoteContent(id string) (string, error) {
	a.mu.RLock()
	defer a.mu.RUnlock()
	if a.storage == nil || a.encryptor == nil {
		return "", errors.New("locked")
	}
	data, err := a.storage.ReadNoteFile(id)
	if err != nil {
		if os.IsNotExist(err) {
			return "", nil
		}
		return "", err
	}
	decrypted, err := a.encryptor.Decrypt(data)
	if err != nil {
		return "", err
	}
	return string(decrypted), nil
}

func (a *App) SaveNote(id string, folderID string, title string, body string) error {
	a.mu.Lock()
	defer a.mu.Unlock()
	if a.storage == nil || a.encryptor == nil {
		return errors.New("locked")
	}
	encrypted, err := a.encryptor.Encrypt([]byte(body))
	if err != nil {
		return err
	}
	if err := a.storage.WriteNoteFile(id, encrypted); err != nil {
		return err
	}
	notes := a.storage.GetNotes()
	var created int64 = time.Now().UnixNano() / 1e6
	for _, n := range notes {
		if n.ID == id {
			created = n.CreatedAt
			break
		}
	}
	meta := storage.NoteMetadata{
		ID:        id,
		FolderID:  folderID,
		Title:     title,
		Tags:      []string{},
		CreatedAt: created,
		UpdatedAt: time.Now().UnixNano() / 1e6,
		IsDeleted: false,
	}
	a.storage.SaveNoteMetadata(meta)
	return nil
}

func (a *App) DeleteNote(id string) error {
	a.mu.Lock()
	defer a.mu.Unlock()
	if a.storage == nil {
		return errors.New("locked")
	}
	a.storage.DeleteNoteMetadata(id)
	return nil
}

func (a *App) GetSyncConfig() SyncConfig {
	a.mu.RLock()
	defer a.mu.RUnlock()
	return a.config.SyncConfig
}

func (a *App) SaveSyncConfig(cfg SyncConfig) error {
	a.mu.Lock()
	defer a.mu.Unlock()
	a.config.SyncConfig = cfg
	return a.saveConfig()
}

func (a *App) Sync() error {
	a.mu.Lock()
	defer a.mu.Unlock()
	if a.storage == nil {
		return errors.New("locked")
	}
	cfg := a.config.SyncConfig
	if cfg.RemoteURL == "" || cfg.Token == "" {
		return errors.New("sync credentials missing")
	}
	gitCfg := gitsync.GitConfig{
		LocalPath: a.repoDir,
		RemoteURL: cfg.RemoteURL,
		Username:  cfg.Username,
		Token:     cfg.Token,
		Email:     cfg.Email,
	}
	_, err := os.Stat(filepath.Join(a.repoDir, ".git"))
	if os.IsNotExist(err) {
		err = a.syncManager.Clone(context.Background(), gitCfg)
		if err != nil {
			return err
		}
	} else {
		_, err = a.syncManager.Pull(context.Background(), gitCfg)
		if err != nil {
			return err
		}
	}
	err = a.syncManager.CommitAndPush(context.Background(), gitCfg, "sync notes "+time.Now().Format(time.RFC3339))
	if err != nil {
		return err
	}
	return nil
}
