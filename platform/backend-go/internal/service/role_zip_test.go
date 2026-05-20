package service

import (
	"archive/zip"
	"bytes"
	"io"
	"os"
	"path/filepath"
	"testing"
)

const testDataPath = "data/test_roles"

func TestExportRole(t *testing.T) {
	// Setup test data path
	originalPath := DataBasePath
	DataBasePath = testDataPath
	defer func() { DataBasePath = originalPath }()

	// Create test directory
	testUserID := "test_user_export"
	testRoleID := "test_role_export"
	rolePath := GetRoleDir(testUserID, testRoleID)

	// Clean up after test
	defer os.RemoveAll("data")

	// Create role directory with test files
	if err := os.MkdirAll(rolePath, 0755); err != nil {
		t.Fatalf("Failed to create test dir: %v", err)
	}

	// Write test config.json
	configPath := filepath.Join(rolePath, "config.json")
	if err := os.WriteFile(configPath, []byte(`{"name":"Test Role","variant":"full"}`), 0644); err != nil {
		t.Fatalf("Failed to write config: %v", err)
	}

	// Write test .security.yml
	securityPath := filepath.Join(rolePath, ".security.yml")
	if err := os.WriteFile(securityPath, []byte("permissions:\n  allow_file_read: true\n"), 0644); err != nil {
		t.Fatalf("Failed to write security: %v", err)
	}

	// Write workspace file
	workspacePath := filepath.Join(rolePath, "workspace")
	if err := os.MkdirAll(workspacePath, 0755); err != nil {
		t.Fatalf("Failed to create workspace: %v", err)
	}
	agentPath := filepath.Join(workspacePath, "AGENT.md")
	if err := os.WriteFile(agentPath, []byte("# Test Agent\n"), 0644); err != nil {
		t.Fatalf("Failed to write agent: %v", err)
	}

	// Export the role
	result, err := ExportRole(testUserID, testRoleID)
	if err != nil {
		t.Fatalf("ExportRole failed: %v", err)
	}

	// Verify result
	if result == nil {
		t.Fatal("ExportResult is nil")
	}
	if result.Size == 0 {
		t.Error("Expected non-zero size")
	}
	if len(result.Data) == 0 {
		t.Error("Expected non-empty data")
	}

	// Verify zip contents using bytes.Reader
	reader, err := zip.NewReader(bytesFromSlice(result.Data), int64(len(result.Data)))
	if err != nil {
		t.Fatalf("Failed to open zip: %v", err)
	}

	// Check for expected files
	files := make(map[string]bool)
	for _, f := range reader.File {
		files[f.Name] = true
	}

	// Should have at least config.json
	if !files["config.json"] {
		t.Error("Expected config.json in zip")
	}
}

func TestExportRoleNotFound(t *testing.T) {
	// Setup test data path
	originalPath := DataBasePath
	DataBasePath = testDataPath
	defer func() { DataBasePath = originalPath }()

	// Clean up
	defer os.RemoveAll("data")

	// Try to export non-existent role
	result, err := ExportRole("nonexistent_user", "nonexistent_role")
	if err == nil {
		t.Error("Expected error for non-existent role")
	}
	if result != nil {
		t.Error("Expected nil result")
	}
}

func TestImportRole(t *testing.T) {
	// Setup test data path
	originalPath := DataBasePath
	DataBasePath = testDataPath
	defer func() { DataBasePath = originalPath }()

	// Clean up
	defer os.RemoveAll("data")

	testUserID := "test_user_import"
	testRoleID := "test_role_import"

	// Create a valid zip file in memory
	buf := new(bytes.Buffer)
	zipWriter := zip.NewWriter(buf)

	// Add config.json
	configContent := []byte(`{"name":"Imported Test Role","variant":"full"}`)
	configWriter, _ := zipWriter.Create("config.json")
	configWriter.Write(configContent)

	// Add workspace/AGENT.md
	agentContent := []byte("# Test Agent\n")
	agentWriter, _ := zipWriter.Create("workspace/AGENT.md")
	agentWriter.Write(agentContent)

	zipWriter.Close()

	zipData := buf.Bytes()

	// Import the role
	result, err := ImportRole(testUserID, testRoleID, zipData)
	if err != nil {
		t.Fatalf("ImportRole failed: %v", err)
	}

	// Verify result
	if result == nil {
		t.Fatal("ImportResult is nil")
	}
	if result.Files == 0 {
		t.Error("Expected files imported")
	}
	if result.RoleName != "Imported Test Role" {
		t.Errorf("Expected role name 'Imported Test Role', got '%s'", result.RoleName)
	}

	// Verify files were extracted
	rolePath := GetRoleDir(testUserID, testRoleID)
	if _, err := os.Stat(rolePath); os.IsNotExist(err) {
		t.Error("Expected role directory to exist")
	}

	// Check config.json was created
	if _, err := os.Stat(filepath.Join(rolePath, "config.json")); os.IsNotExist(err) {
		t.Error("Expected config.json in imported role")
	}
}

func TestImportRoleInvalidZip(t *testing.T) {
	// Setup test data path
	originalPath := DataBasePath
	DataBasePath = testDataPath
	defer func() { DataBasePath = originalPath }()

	// Clean up
	defer os.RemoveAll("data")

	// Try to import invalid zip data
	result, err := ImportRole("test_user", "test_role", []byte("not a zip file"))
	if err == nil {
		t.Error("Expected error for invalid zip")
	}
	if result != nil {
		t.Error("Expected nil result")
	}
}

func TestImportRoleDefaultName(t *testing.T) {
	// Setup test data path
	originalPath := DataBasePath
	DataBasePath = testDataPath
	defer func() { DataBasePath = originalPath }()

	// Clean up
	defer os.RemoveAll("data")

	testUserID := "test_user_default"
	testRoleID := "test_role_default"

	// Create a zip without config.json
	buf := new(bytes.Buffer)
	zipWriter := zip.NewWriter(buf)

	// Add a regular file (not config.json)
	content := []byte("# Just a file\n")
	writer, _ := zipWriter.Create("workspace/MEMORY.md")
	writer.Write(content)

	zipWriter.Close()

	zipData := buf.Bytes()

	// Import the role
	result, err := ImportRole(testUserID, testRoleID, zipData)
	if err != nil {
		t.Fatalf("ImportRole failed: %v", err)
	}

	// Should have default name
	if result.RoleName != "Imported Role" {
		t.Errorf("Expected default role name 'Imported Role', got '%s'", result.RoleName)
	}
}

// bytesFromSlice implements io.ReaderAt for testing
type bytesFromSlice []byte

func (b bytesFromSlice) ReadAt(p []byte, off int64) (int, error) {
	if off >= int64(len(b)) {
		return 0, io.EOF
	}
	if off < 0 {
		return 0, os.ErrInvalid
	}
	n := copy(p, b[off:])
	if n < len(p) {
		return n, io.EOF
	}
	return n, nil
}