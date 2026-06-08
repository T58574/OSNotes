package crypto

import (
	"bytes"
	"testing"
)

func TestAESGCMEncryptor(t *testing.T) {
	password := []byte("super-secret-master-password")
	salt := []byte("random-salt-bytes")
	encryptor := NewAESGCMEncryptor(password, salt)
	plaintext := []byte("Hello, this is a secret note.")
	ciphertext, err := encryptor.Encrypt(plaintext)
	if err != nil {
		t.Fatalf("encryption failed: %v", err)
	}
	if bytes.Equal(plaintext, ciphertext) {
		t.Fatal("ciphertext matches plaintext")
	}
	decrypted, err := encryptor.Decrypt(ciphertext)
	if err != nil {
		t.Fatalf("decryption failed: %v", err)
	}
	if !bytes.Equal(plaintext, decrypted) {
		t.Fatalf("decrypted text does not match plaintext: expected %s, got %s", plaintext, decrypted)
	}
}

func TestDecryptionFailure(t *testing.T) {
	password := []byte("password")
	salt := []byte("salt")
	encryptor := NewAESGCMEncryptor(password, salt)
	ciphertext, err := encryptor.Encrypt([]byte("test"))
	if err != nil {
		t.Fatalf("encryption failed: %v", err)
	}
	ciphertext[0] ^= 0xFF
	_, err = encryptor.Decrypt(ciphertext)
	if err == nil {
		t.Fatal("expected decryption error for tampered ciphertext")
	}
}
