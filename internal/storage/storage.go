package storage

import (
	"encoding/json"
	"io/ioutil"
	"os"
	"path/filepath"
	"sync"
	"time"
)

type Folder struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	IsSystem  bool   `json:"is_system"`
	CreatedAt int64  `json:"created_at"`
}

type NoteMetadata struct {
	ID        string   `json:"id"`
	FolderID  string   `json:"folder_id"`
	Title     string   `json:"title"`
	Tags      []string `json:"tags"`
	CreatedAt int64    `json:"created_at"`
	UpdatedAt int64    `json:"updated_at"`
	IsDeleted bool     `json:"is_deleted"`
}

type MetaData struct {
	Version    int            `json:"version"`
	LastSynced int64          `json:"last_synced"`
	Folders    []Folder       `json:"folders"`
	Notes      []NoteMetadata `json:"notes"`
}

type StorageManager struct {
	mu      sync.RWMutex
	baseDir string
	meta    MetaData
}

func NewStorageManager(baseDir string) (*StorageManager, error) {
	if err := os.MkdirAll(filepath.Join(baseDir, "notes"), 0755); err != nil {
		return nil, err
	}
	sm := &StorageManager{
		baseDir: baseDir,
		meta: MetaData{
			Version: 1,
			Folders: []Folder{},
			Notes:   []NoteMetadata{},
		},
	}
	if err := sm.loadMeta(); err != nil {
		if os.IsNotExist(err) {
			sm.meta.Folders = []Folder{
				{ID: "notes-default", Name: "Заметки", IsSystem: true, CreatedAt: time.Now().UnixNano() / 1e6},
			}
			if err := sm.saveMeta(); err != nil {
				return nil, err
			}
		} else {
			return nil, err
		}
	}
	return sm, nil
}

func (sm *StorageManager) loadMeta() error {
	path := filepath.Join(sm.baseDir, "meta.json")
	data, err := ioutil.ReadFile(path)
	if err != nil {
		return err
	}
	return json.Unmarshal(data, &sm.meta)
}

func (sm *StorageManager) Reload() error {
	sm.mu.Lock()
	defer sm.mu.Unlock()
	return sm.loadMeta()
}

func (sm *StorageManager) saveMeta() error {
	path := filepath.Join(sm.baseDir, "meta.json")
	tempPath := path + ".tmp"
	data, err := json.MarshalIndent(sm.meta, "", "  ")
	if err != nil {
		return err
	}
	if err := ioutil.WriteFile(tempPath, data, 0644); err != nil {
		return err
	}
	return os.Rename(tempPath, path)
}

func (sm *StorageManager) GetFolders() []Folder {
	sm.mu.RLock()
	defer sm.mu.RUnlock()
	return sm.meta.Folders
}

func (sm *StorageManager) CreateFolder(name string) Folder {
	sm.mu.Lock()
	defer sm.mu.Unlock()
	f := Folder{
		ID:        "folder_" + string(time.Now().UnixNano()),
		Name:      name,
		IsSystem:  false,
		CreatedAt: time.Now().UnixNano() / 1e6,
	}
	sm.meta.Folders = append(sm.meta.Folders, f)
	_ = sm.saveMeta()
	return f
}

func (sm *StorageManager) DeleteFolder(id string) {
	sm.mu.Lock()
	defer sm.mu.Unlock()
	var newFolders []Folder
	for _, f := range sm.meta.Folders {
		if f.ID != id || f.IsSystem {
			newFolders = append(newFolders, f)
		}
	}
	sm.meta.Folders = newFolders
	for i, n := range sm.meta.Notes {
		if n.FolderID == id {
			sm.meta.Notes[i].FolderID = "notes-default"
			sm.meta.Notes[i].UpdatedAt = time.Now().UnixNano() / 1e6
		}
	}
	_ = sm.saveMeta()
}

func (sm *StorageManager) GetNotes() []NoteMetadata {
	sm.mu.RLock()
	defer sm.mu.RUnlock()
	return sm.meta.Notes
}

func (sm *StorageManager) SaveNoteMetadata(meta NoteMetadata) {
	sm.mu.Lock()
	defer sm.mu.Unlock()
	found := false
	for i, n := range sm.meta.Notes {
		if n.ID == meta.ID {
			sm.meta.Notes[i] = meta
			found = true
			break
		}
	}
	if !found {
		sm.meta.Notes = append(sm.meta.Notes, meta)
	}
	_ = sm.saveMeta()
}

func (sm *StorageManager) DeleteNoteMetadata(id string) {
	sm.mu.Lock()
	defer sm.mu.Unlock()
	for i, n := range sm.meta.Notes {
		if n.ID == id {
			sm.meta.Notes[i].IsDeleted = true
			sm.meta.Notes[i].UpdatedAt = time.Now().UnixNano() / 1e6
			break
		}
	}
	_ = sm.saveMeta()
}

func (sm *StorageManager) GetNotePath(id string) string {
	return filepath.Join(sm.baseDir, "notes", id+".bin")
}

func (sm *StorageManager) ReadNoteFile(id string) ([]byte, error) {
	return ioutil.ReadFile(sm.GetNotePath(id))
}

func (sm *StorageManager) WriteNoteFile(id string, content []byte) error {
	path := sm.GetNotePath(id)
	tempPath := path + ".tmp"
	if err := ioutil.WriteFile(tempPath, content, 0644); err != nil {
		return err
	}
	return os.Rename(tempPath, path)
}
