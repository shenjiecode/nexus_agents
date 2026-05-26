package service

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"os"
	"path/filepath"
)

// ContainerSecurityDir returns the absolute directory path for a container's workspace
func ContainerSecurityDir(userID, containerID string) string {
	relPath := filepath.Join("data", "containers", userID, containerID)
	absPath, _ := filepath.Abs(relPath)
	return absPath
}

// GenerateContainerSecurity creates a .security.yml file for a container
// with a randomly generated pico token
func GenerateContainerSecurity(userID, containerID string) (string, error) {
	dir := ContainerSecurityDir(userID, containerID)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return "", fmt.Errorf("failed to create container directory: %w", err)
	}

	// Generate random token (32 hex characters = 16 bytes)
	tokenBytes := make([]byte, 16)
	if _, err := rand.Read(tokenBytes); err != nil {
		return "", fmt.Errorf("failed to generate token: %w", err)
	}
	token := hex.EncodeToString(tokenBytes)

	// Create .security.yml content
	securityContent := fmt.Sprintf(`channel_list:
  pico:
    settings:
      token: %s
      allow_from: []
`, token)

	securityPath := filepath.Join(dir, ".security.yml")
	if err := os.WriteFile(securityPath, []byte(securityContent), 0644); err != nil {
		return "", fmt.Errorf("failed to write .security.yml: %w", err)
	}

	return token, nil
}

// GetContainerPicoToken reads the pico token for a container
func GetContainerPicoToken(userID, containerID string) (string, error) {
	dir := ContainerSecurityDir(userID, containerID)
	securityPath := filepath.Join(dir, ".security.yml")

	content, err := os.ReadFile(securityPath)
	if err != nil {
		return "", fmt.Errorf("failed to read container .security.yml: %w", err)
	}

	var config PicoSecurityConfig
	if err := parseSecurityYAML(content, &config); err != nil {
		return "", err
	}

	return config.ChannelList.Pico.Settings.Token, nil
}
