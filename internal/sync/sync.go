package sync

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io/ioutil"
	"net/http"
	"os"
	"path/filepath"
	"time"

	"osnotes/internal/storage"

	"github.com/go-git/go-git/v5"
	"github.com/go-git/go-git/v5/plumbing"
	"github.com/go-git/go-git/v5/plumbing/object"
	githttp "github.com/go-git/go-git/v5/plumbing/transport/http"
)

type GitConfig struct {
	LocalPath string
	RemoteURL string
	Username  string
	Token     string
	Email     string
}

type SyncStatus struct {
	LastSynced time.Time
	Conflicts  []string
}

type Syncer interface {
	Clone(ctx context.Context, cfg GitConfig) error
	Pull(ctx context.Context, cfg GitConfig) (*SyncStatus, error)
	CommitAndPush(ctx context.Context, cfg GitConfig, message string) error
	CheckAndCreateRepo(ctx context.Context, token string, username string, repoName string) (string, error)
}

type GitSyncManager struct{}

func NewGitSyncManager() *GitSyncManager {
	return &GitSyncManager{}
}

func (m *GitSyncManager) Clone(ctx context.Context, cfg GitConfig) error {
	_, err := git.PlainCloneContext(ctx, cfg.LocalPath, false, &git.CloneOptions{
		URL:      cfg.RemoteURL,
		Progress: os.Stdout,
		Auth: &githttp.BasicAuth{
			Username: cfg.Username,
			Password: cfg.Token,
		},
	})
	return err
}

func (m *GitSyncManager) Pull(ctx context.Context, cfg GitConfig) (*SyncStatus, error) {
	repo, err := git.PlainOpen(cfg.LocalPath)
	if err != nil {
		return nil, err
	}
	w, err := repo.Worktree()
	if err != nil {
		return nil, err
	}
	err = w.PullContext(ctx, &git.PullOptions{
		RemoteName: "origin",
		Auth: &githttp.BasicAuth{
			Username: cfg.Username,
			Password: cfg.Token,
		},
	})
	if err != nil && !errors.Is(err, git.NoErrAlreadyUpToDate) {
		return nil, err
	}
	return &SyncStatus{
		LastSynced: time.Now(),
		Conflicts:  []string{},
	}, nil
}

func (m *GitSyncManager) CommitAndPush(ctx context.Context, cfg GitConfig, message string) error {
	repo, err := git.PlainOpen(cfg.LocalPath)
	if err != nil {
		return err
	}
	w, err := repo.Worktree()
	if err != nil {
		return err
	}
	_, err = w.Add(".")
	if err != nil {
		return err
	}
	_, err = w.Commit(message, &git.CommitOptions{
		Author: &object.Signature{
			Name:  cfg.Username,
			Email: cfg.Email,
			When:  time.Now(),
		},
	})
	if err != nil {
		return err
	}
	return repo.PushContext(ctx, &git.PushOptions{
		RemoteName: "origin",
		Auth: &githttp.BasicAuth{
			Username: cfg.Username,
			Password: cfg.Token,
		},
	})
}

func (m *GitSyncManager) CheckAndCreateRepo(ctx context.Context, token string, username string, repoName string) (string, error) {
	url := "https://api.github.com/user/repos"
	body := fmt.Sprintf(`{"name":"%s","private":true,"auto_init":false}`, repoName)
	req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewBufferString(body))
	if err != nil {
		return "", err
	}
	req.Header.Set("Authorization", "token "+token)
	req.Header.Set("Content-Type", "application/json")
	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	if resp.StatusCode == http.StatusCreated || resp.StatusCode == http.StatusUnprocessableEntity {
		return fmt.Sprintf("https://github.com/%s/%s.git", username, repoName), nil
	}
	respBody, _ := ioutil.ReadAll(resp.Body)
	var ghErr struct {
		Message string `json:"message"`
	}
	_ = json.Unmarshal(respBody, &ghErr)
	if ghErr.Message != "" {
		return "", fmt.Errorf("GitHub API Error: %s (Status: %s)", ghErr.Message, resp.Status)
	}
	return "", fmt.Errorf("unexpected status: %s (Body: %s)", resp.Status, string(respBody))
}

func (m *GitSyncManager) SafeSync(ctx context.Context, cfg GitConfig, message string) error {
	repo, err := git.PlainOpen(cfg.LocalPath)
	if err != nil {
		return err
	}
	err = repo.FetchContext(ctx, &git.FetchOptions{
		RemoteName: "origin",
		Auth: &githttp.BasicAuth{
			Username: cfg.Username,
			Password: cfg.Token,
		},
	})
	if err != nil && !errors.Is(err, git.NoErrAlreadyUpToDate) {
		return err
	}
	localRef, err := repo.Head()
	if err != nil {
		return err
	}
	localHash := localRef.Hash()
	branchName := localRef.Name().Short()
	remoteRefName := "refs/remotes/origin/" + branchName
	remoteRef, err := repo.Reference(plumbing.ReferenceName(remoteRefName), true)
	if err != nil {
		return m.CommitAndPush(ctx, cfg, message)
	}
	remoteHash := remoteRef.Hash()
	if localHash == remoteHash {
		w, err := repo.Worktree()
		if err != nil {
			return err
		}
		status, err := w.Status()
		if err != nil {
			return err
		}
		if status.IsClean() {
			return nil
		}
		return m.CommitAndPush(ctx, cfg, message)
	}
	localMetaBytes, err := ioutil.ReadFile(filepath.Join(cfg.LocalPath, "meta.json"))
	var localMeta storage.MetaData
	if err == nil {
		_ = json.Unmarshal(localMetaBytes, &localMeta)
	}
	var remoteMeta storage.MetaData
	hasRemoteMeta := false
	remoteCommit, err := repo.CommitObject(remoteHash)
	if err == nil {
		remoteTree, err := remoteCommit.Tree()
		if err == nil {
			remoteMetaFile, err := remoteTree.File("meta.json")
			if err == nil {
				remoteMetaStr, err := remoteMetaFile.Contents()
				if err == nil {
					if err := json.Unmarshal([]byte(remoteMetaStr), &remoteMeta); err == nil {
						hasRemoteMeta = true
					}
				}
			}
		}
	}
	mergedFoldersMap := make(map[string]storage.Folder)
	for _, f := range remoteMeta.Folders {
		mergedFoldersMap[f.ID] = f
	}
	for _, f := range localMeta.Folders {
		if existing, exists := mergedFoldersMap[f.ID]; exists {
			if f.CreatedAt > existing.CreatedAt {
				mergedFoldersMap[f.ID] = f
			}
		} else {
			mergedFoldersMap[f.ID] = f
		}
	}
	var mergedFolders []storage.Folder
	for _, f := range mergedFoldersMap {
		mergedFolders = append(mergedFolders, f)
	}
	mergedNotesMap := make(map[string]storage.NoteMetadata)
	for _, n := range remoteMeta.Notes {
		mergedNotesMap[n.ID] = n
	}
	for _, n := range localMeta.Notes {
		if existing, exists := mergedNotesMap[n.ID]; exists {
			if n.UpdatedAt > existing.UpdatedAt {
				mergedNotesMap[n.ID] = n
			}
		} else {
			mergedNotesMap[n.ID] = n
		}
	}
	var mergedNotes []storage.NoteMetadata
	for _, n := range mergedNotesMap {
		mergedNotes = append(mergedNotes, n)
	}
	type fileToSave struct {
		Path    string
		Content []byte
	}
	var filesToWrite []fileToSave
	if hasRemoteMeta && remoteCommit != nil {
		remoteTree, err := remoteCommit.Tree()
		if err == nil {
			for _, n := range mergedNotes {
				var localNoteHas bool
				var localNoteUpdated int64
				for _, ln := range localMeta.Notes {
					if ln.ID == n.ID {
						localNoteHas = true
						localNoteUpdated = ln.UpdatedAt
						break
					}
				}
				needRemoteCopy := false
				if !localNoteHas {
					needRemoteCopy = true
				} else {
					var remoteNoteUpdated int64
					for _, rn := range remoteMeta.Notes {
						if rn.ID == n.ID {
							remoteNoteUpdated = rn.UpdatedAt
							break
						}
					}
					if remoteNoteUpdated > localNoteUpdated {
						needRemoteCopy = true
					}
				}
				if needRemoteCopy {
					remoteNotePath := "notes/" + n.ID + ".bin"
					remoteFile, err := remoteTree.File(remoteNotePath)
					if err == nil {
						content, err := remoteFile.Contents()
						if err == nil {
							filesToWrite = append(filesToWrite, fileToSave{
								Path:    filepath.Join(cfg.LocalPath, "notes", n.ID+".bin"),
								Content: []byte(content),
							})
						}
					}
				}
			}
		}
	}
	mergedMeta := storage.MetaData{
		Version:    1,
		LastSynced: time.Now().UnixNano() / 1e6,
		Folders:    mergedFolders,
		Notes:      mergedNotes,
	}
	mergedMetaBytes, err := json.MarshalIndent(mergedMeta, "", "  ")
	if err != nil {
		return err
	}
	w, err := repo.Worktree()
	if err != nil {
		return err
	}
	err = w.Reset(&git.ResetOptions{
		Commit: remoteHash,
		Mode:   git.HardReset,
	})
	if err != nil {
		return err
	}
	err = ioutil.WriteFile(filepath.Join(cfg.LocalPath, "meta.json"), mergedMetaBytes, 0644)
	if err != nil {
		return err
	}
	for _, f := range filesToWrite {
		_ = os.MkdirAll(filepath.Dir(f.Path), 0755)
		_ = ioutil.WriteFile(f.Path, f.Content, 0644)
	}
	_, err = w.Add(".")
	if err != nil {
		return err
	}
	_, err = w.Commit(message, &git.CommitOptions{
		Author: &object.Signature{
			Name:  cfg.Username,
			Email: cfg.Email,
			When:  time.Now(),
		},
	})
	if err != nil {
		return err
	}
	return repo.PushContext(ctx, &git.PushOptions{
		RemoteName: "origin",
		Auth: &githttp.BasicAuth{
			Username: cfg.Username,
			Password: cfg.Token,
		},
	})
}

