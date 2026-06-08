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

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

type AppConfig struct {
	Salt            []byte `json:"salt"`
	PasswordEnabled bool   `json:"password_enabled"`
	Verifier        []byte `json:"verifier"`
}

type App struct {
	ctx       context.Context
	mu        sync.RWMutex
	baseDir   string
	repoDir   string
	config    AppConfig
	storage   *storage.StorageManager
	encryptor *crypto.AESGCMEncryptor
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
		baseDir: baseDir,
		repoDir: filepath.Join(baseDir, "repo"),
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
	encryptor := crypto.NewAESGCMEncryptor([]byte(password), a.config.Salt)
	if len(a.config.Verifier) > 0 {
		decrypted, err := encryptor.Decrypt(a.config.Verifier)
		if err != nil || string(decrypted) != "osnotes_verifier" {
			return false, nil
		}
	} else {
		sm, err := storage.NewStorageManager(a.repoDir)
		if err != nil {
			return false, err
		}
		notes := sm.GetNotes()
		var firstNoteID string
		for _, n := range notes {
			if !n.IsDeleted {
				firstNoteID = n.ID
				break
			}
		}
		if firstNoteID != "" {
			data, err := sm.ReadNoteFile(firstNoteID)
			if err == nil {
				_, err = encryptor.Decrypt(data)
				if err != nil {
					return false, nil
				}
			}
		}
		v, err := encryptor.Encrypt([]byte("osnotes_verifier"))
		if err == nil {
			a.config.Verifier = v
			a.config.PasswordEnabled = (password != "")
			_ = a.saveConfig()
		}
	}
	sm, err := storage.NewStorageManager(a.repoDir)
	if err != nil {
		return false, err
	}
	a.encryptor = encryptor
	a.storage = sm
	return true, nil
}

func (a *App) IsLocked() bool {
	a.mu.RLock()
	defer a.mu.RUnlock()
	return a.encryptor == nil
}

func (a *App) IsPasswordEnabled() bool {
	a.mu.RLock()
	defer a.mu.RUnlock()
	return a.config.PasswordEnabled
}

func (a *App) AutoUnlockIfNeeded() (bool, error) {
	a.mu.RLock()
	enabled := a.config.PasswordEnabled
	a.mu.RUnlock()
	if !enabled {
		return a.Unlock("")
	}
	return false, nil
}

func (a *App) SetPasswordEnabled(enabled bool, currentPassword string, newPassword string) (bool, error) {
	a.mu.Lock()
	defer a.mu.Unlock()
	currentEncryptor := crypto.NewAESGCMEncryptor([]byte(currentPassword), a.config.Salt)
	if len(a.config.Verifier) > 0 {
		decrypted, err := currentEncryptor.Decrypt(a.config.Verifier)
		if err != nil || string(decrypted) != "osnotes_verifier" {
			return false, errors.New("invalid_password")
		}
	}
	newEncryptor := crypto.NewAESGCMEncryptor([]byte(newPassword), a.config.Salt)
	if a.storage == nil {
		sm, err := storage.NewStorageManager(a.repoDir)
		if err != nil {
			return false, err
		}
		a.storage = sm
	}
	notes := a.storage.GetNotes()
	for _, n := range notes {
		data, err := a.storage.ReadNoteFile(n.ID)
		if err == nil {
			decrypted, err := currentEncryptor.Decrypt(data)
			if err == nil {
				encrypted, err := newEncryptor.Encrypt(decrypted)
				if err == nil {
					_ = a.storage.WriteNoteFile(n.ID, encrypted)
				}
			}
		}
	}
	v, err := newEncryptor.Encrypt([]byte("osnotes_verifier"))
	if err != nil {
		return false, err
	}
	a.config.Verifier = v
	a.config.PasswordEnabled = enabled
	err = a.saveConfig()
	if err != nil {
		return false, err
	}
	a.encryptor = newEncryptor
	return true, nil
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

func (a *App) OpenURL(urlStr string) {
	runtime.BrowserOpenURL(a.ctx, urlStr)
}
