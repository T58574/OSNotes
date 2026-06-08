package main

import (
	"bytes"
	"context"
	"crypto/rand"
	"encoding/json"
	"errors"
	"fmt"
	"io/ioutil"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"osnotes/internal/crypto"
	"osnotes/internal/storage"
	gitsync "osnotes/internal/sync"

	"github.com/go-git/go-git/v5"
	gitconfig "github.com/go-git/go-git/v5/config"
	"github.com/wailsapp/wails/v2/pkg/runtime"
)

type SyncConfig struct {
	RemoteURL string `json:"remote_url"`
	Username  string `json:"username"`
	Token     string `json:"token"`
	Email     string `json:"email"`
}

type AppConfig struct {
	Salt            []byte     `json:"salt"`
	SyncConfig      SyncConfig `json:"sync_config"`
	PasswordEnabled bool       `json:"password_enabled"`
	Verifier        []byte     `json:"verifier"`
	ClientID        string     `json:"client_id,omitempty"`
	ClientSecret    string     `json:"client_secret,omitempty"`
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

func (a *App) ConnectWithGitHubCLI() (string, error) {
	_, err := exec.LookPath("gh")
	if err != nil {
		return "", errors.New("GitHub CLI (gh) не найден в системе. Установите gh (https://cli.github.com/) и авторизуйтесь: 'gh auth login'.")
	}
	cmd := exec.Command("gh", "auth", "token")
	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr
	if err := cmd.Run(); err != nil {
		return "", fmt.Errorf("GitHub CLI не авторизован: %s. Выполните 'gh auth login' в терминале.", strings.TrimSpace(stderr.String()))
	}
	token := strings.TrimSpace(stdout.String())
	if token == "" {
		return "", errors.New("GitHub CLI вернул пустой токен. Пожалуйста, выполните 'gh auth login'.")
	}
	return a.setupGitHubSync(token)
}

func fetchGitHubUserInfo(token string) (string, string, error) {
	req, err := http.NewRequest("GET", "https://api.github.com/user", nil)
	if err != nil {
		return "", "", err
	}
	req.Header.Set("Authorization", "token "+token)
	req.Header.Set("Accept", "application/json")
	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return "", "", err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		respBody, _ := ioutil.ReadAll(resp.Body)
		var ghErr struct {
			Message string `json:"message"`
		}
		_ = json.Unmarshal(respBody, &ghErr)
		if ghErr.Message != "" {
			return "", "", fmt.Errorf("GitHub API Error: %s (Status: %s)", ghErr.Message, resp.Status)
		}
		return "", "", fmt.Errorf("github api returned status %s (Body: %s)", resp.Status, string(respBody))
	}
	var u struct {
		Login string `json:"login"`
		Email string `json:"email"`
	}
	dec := json.NewDecoder(resp.Body)
	if err := dec.Decode(&u); err != nil {
		return "", "", err
	}
	email := u.Email
	if email == "" {
		email = fmt.Sprintf("%s@users.noreply.github.com", u.Login)
	}
	return u.Login, email, nil
}

func (a *App) setupGitHubSync(token string) (string, error) {
	username, email, err := fetchGitHubUserInfo(token)
	if err != nil {
		return "", fmt.Errorf("ошибка получения данных пользователя: %w", err)
	}
	repoURL, err := a.syncManager.CheckAndCreateRepo(context.Background(), token, username, "ios-notes-data")
	if err != nil {
		return "", fmt.Errorf("ошибка проверки/создания репозитория: %w", err)
	}
	cfg := SyncConfig{
		RemoteURL: repoURL,
		Username:  username,
		Token:     token,
		Email:     email,
	}
	a.mu.Lock()
	a.config.SyncConfig = cfg
	_ = a.saveConfig()
	a.mu.Unlock()
	gitCfg := gitsync.GitConfig{
		LocalPath: a.repoDir,
		RemoteURL: repoURL,
		Username:  username,
		Token:     token,
		Email:     email,
	}
	dotGit := filepath.Join(a.repoDir, ".git")
	_, statErr := os.Stat(dotGit)
	if os.IsNotExist(statErr) {
		files, _ := ioutil.ReadDir(a.repoDir)
		hasLocalFiles := false
		for _, f := range files {
			if f.Name() != ".git" {
				hasLocalFiles = true
				break
			}
		}
		if hasLocalFiles {
			tempBackupDir := filepath.Join(a.baseDir, "repo_backup")
			_ = os.RemoveAll(tempBackupDir)
			_ = os.MkdirAll(tempBackupDir, 0755)
			copyDirectory(a.repoDir, tempBackupDir)
			_ = os.RemoveAll(a.repoDir)
			_ = os.MkdirAll(a.repoDir, 0755)
			cloneErr := a.syncManager.Clone(context.Background(), gitCfg)
			if cloneErr != nil {
				_ = os.RemoveAll(a.repoDir)
				_ = os.MkdirAll(a.repoDir, 0755)
				copyDirectory(tempBackupDir, a.repoDir)
				_ = os.RemoveAll(tempBackupDir)
				r, initErr := git.PlainInit(a.repoDir, false)
				if initErr == nil {
					_, _ = r.CreateRemote(&gitconfig.RemoteConfig{
						Name: "origin",
						URLs: []string{repoURL},
					})
					_ = a.syncManager.CommitAndPush(context.Background(), gitCfg, "initial sync")
				}
			} else {
				copyDirectory(tempBackupDir, a.repoDir)
				_ = os.RemoveAll(tempBackupDir)
				_ = a.syncManager.CommitAndPush(context.Background(), gitCfg, "merged local notes")
			}
		} else {
			_ = a.syncManager.Clone(context.Background(), gitCfg)
		}
	} else {
		_, _ = a.syncManager.Pull(context.Background(), gitCfg)
	}
	return username, nil
}

func copyDirectory(src, dst string) {
	_ = filepath.Walk(src, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		rel, err := filepath.Rel(src, path)
		if err != nil {
			return err
		}
		if rel == ".git" || (len(rel) >= 5 && rel[:5] == ".git/") {
			return nil
		}
		target := filepath.Join(dst, rel)
		if info.IsDir() {
			return os.MkdirAll(target, info.Mode())
		}
		data, err := ioutil.ReadFile(path)
		if err != nil {
			return err
		}
		return ioutil.WriteFile(target, data, info.Mode())
	})
}

func (a *App) OpenURL(urlStr string) {
	runtime.BrowserOpenURL(a.ctx, urlStr)
}
