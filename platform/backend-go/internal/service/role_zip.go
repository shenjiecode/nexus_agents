package service

import (
	"archive/zip"
	"bytes"
	"encoding/json"
	"io"
	"os"
	"path/filepath"
	"slices"
	"strings"
)

// RoleConfig represents the role configuration structure
type RoleConfig struct {
	Name     string `json:"name"`
	Variant  string `json:"variant"`
	Model    string `json:"model"`
	Provider string `json:"provider"`
}

// ExportResult represents the result of a role export
type ExportResult struct {
	Size int
	Data []byte
}

// ImportResult represents the result of a role import
type ImportResult struct {
	Path     string
	Files    int
	RoleName string
}

// ExportRole exports a role directory as a zip archive
// Returns the zip data as bytes
func ExportRole(userID, roleID string) (*ExportResult, error) {
	rolePath := GetRoleDir(userID, roleID)

	// Check if directory exists
	if _, err := os.Stat(rolePath); os.IsNotExist(err) {
		return nil, &RoleStorageError{
			Message: "Role directory not found",
			Code:    ErrCodeFileNotFound,
		}
	}

	// Create buffer to hold zip data
	buf := new(bytes.Buffer)

	// Create zip writer
	zipWriter := zip.NewWriter(buf)
	defer zipWriter.Close()

	// Walk through the directory and add files to zip
	err := filepath.Walk(rolePath, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}

		// Skip hidden files except .security.yml
		if info.IsDir() {
			return nil
		}

		relPath, err := filepath.Rel(rolePath, path)
		if err != nil {
			return err
		}

		// Skip hidden files except .security.yml
		if filepath.Base(relPath)[0] == '.' && relPath != ".security.yml" {
			return nil
		}

		// Skip not allowed file types
		if !isAllowedFile(relPath) {
			return nil
		}

		// Create file header
		header, err := zip.FileInfoHeader(info)
		if err != nil {
			return err
		}
		header.Name = relPath
		header.Method = zip.Deflate

		// Write header
		writer, err := zipWriter.CreateHeader(header)
		if err != nil {
			return err
		}

		// Write file content
		data, err := os.ReadFile(path)
		if err != nil {
			return err
		}
		_, err = writer.Write(data)
		return err
	})

	if err != nil {
		return nil, err
	}

	// Close the zip writer to finalize the archive
	if err := zipWriter.Close(); err != nil {
		return nil, err
	}

	return &ExportResult{
		Size: buf.Len(),
		Data: buf.Bytes(),
	}, nil
}

// ImportRole imports a role from a zip archive
// Creates the role directory structure and extracts files
func ImportRole(userID, roleID string, zipData []byte) (*ImportResult, error) {
	rolePath := GetRoleDir(userID, roleID)

	// Create a temporary directory for extraction
	tempDir, err := os.MkdirTemp("", "role-import-*")
	if err != nil {
		return nil, err
	}
	defer os.RemoveAll(tempDir)

	// Write zip to temp file
	tempZipPath := filepath.Join(tempDir, "import.zip")
	if err := os.WriteFile(tempZipPath, zipData, 0644); err != nil {
		return nil, err
	}

	// Open the zip file
	reader, err := zip.OpenReader(tempZipPath)
	if err != nil {
		return nil, &RoleStorageError{
			Message: "Invalid zip file",
			Code:    "INVALID_ZIP",
		}
	}
	defer reader.Close()

	// Extract files
	var filesCount int
	for _, file := range reader.File {
		// Skip directories
		if file.FileInfo().IsDir() {
			continue
		}

		// Get the file name (remove any leading path components)
		fileName := filepath.Base(file.Name)

		// Skip hidden files except .security.yml
		if fileName[0] == '.' && fileName != ".security.yml" {
			continue
		}

		// Open the file in the zip
		rc, err := file.Open()
		if err != nil {
			return nil, err
		}

		// Create the target file path
		targetPath := filepath.Join(rolePath, fileName)

		// Ensure parent directory exists
		parentDir := filepath.Dir(targetPath)
		if err := os.MkdirAll(parentDir, 0755); err != nil {
			rc.Close()
			return nil, err
		}

		// Create the target file
		targetFile, err := os.OpenFile(targetPath, os.O_WRONLY|os.O_CREATE|os.O_TRUNC, 0644)
		if err != nil {
			rc.Close()
			return nil, err
		}

		// Copy content
		_, err = io.Copy(targetFile, rc)
		targetFile.Close()
		rc.Close()

		if err != nil {
			return nil, err
		}

		filesCount++
	}

	// Try to read config.json to get role name
	roleName := "Imported Role"
	configPath := filepath.Join(rolePath, "config.json")
	if data, err := os.ReadFile(configPath); err == nil {
		var config RoleConfig
		if err := json.Unmarshal(data, &config); err == nil && config.Name != "" {
			roleName = config.Name
		}
	}

	return &ImportResult{
		Path:     rolePath,
		Files:    filesCount,
		RoleName: roleName,
	}, nil
}

// isAllowedFile checks if a file should be included in the zip
func isAllowedFile(relPath string) bool {
	// Always allow required files
	if filepath.Base(relPath) == "config.json" || relPath == ".security.yml" {
		return true
	}

	// Check workspace files
	if filepath.Dir(relPath) == "workspace" || strings.HasPrefix(relPath, "workspace"+string(filepath.Separator)) {
		ext := filepath.Ext(relPath)
		allowedExts := []string{".md", ".yml", ".yaml", ".json"}
		return slices.Contains(allowedExts, ext)
	}

	return false
}