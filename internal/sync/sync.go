package sync

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"net/http"
	"os"
	"time"

	"github.com/go-git/go-git/v5"
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
	CheckAndCreateRepo(ctx context.Context, token string, repoName string) (string, error)
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

func (m *GitSyncManager) CheckAndCreateRepo(ctx context.Context, token string, repoName string) (string, error) {
	url := "https://api.github.com/user/repos"
	body := fmt.Sprintf(`{"name":"%s","private":true,"auto_init":true}`, repoName)
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
	if resp.StatusCode == http.StatusCreated {
		return fmt.Sprintf("https://github.com/user/%s.git", repoName), nil
	}
	if resp.StatusCode == http.StatusUnprocessableEntity {
		return fmt.Sprintf("https://github.com/user/%s.git", repoName), nil
	}
	return "", fmt.Errorf("unexpected status: %s", resp.Status)
}
