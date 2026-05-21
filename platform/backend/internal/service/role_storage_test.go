package service

import (
	"errors"
	"os"
	"path/filepath"
	"testing"
)

const (
	testUserID = "test-user"
	testRoleID = "test-role"
)

func setupTestDir(t *testing.T) func() {
	// Set a temp base path for testing
	originalBasePath := DataBasePath
	DataBasePath = t.TempDir()

	// Return cleanup function
	return func() {
		DataBasePath = originalBasePath
	}
}

func TestGetRoleDir(t *testing.T) {
	cleanup := setupTestDir(t)
	defer cleanup()

	dir := GetRoleDir(testUserID, testRoleID)
	expected := filepath.Join(DataBasePath, testUserID, testRoleID)

	if dir != expected {
		t.Errorf("GetRoleDir() = %v, want %v", dir, expected)
	}
}

func TestRoleDirExists(t *testing.T) {
	cleanup := setupTestDir(t)
	defer cleanup()

	// Directory doesn't exist yet
	exists := RoleDirExists(testUserID, testRoleID)
	if exists {
		t.Error("RoleDirExists() = true, want false before creation")
	}

	// Create directory
	CreateRoleDir(testUserID, testRoleID)

	// Now it should exist
	exists = RoleDirExists(testUserID, testRoleID)
	if !exists {
		t.Error("RoleDirExists() = false, want true after creation")
	}
}

func TestCreateRoleDir(t *testing.T) {
	cleanup := setupTestDir(t)
	defer cleanup()

	path, err := CreateRoleDir(testUserID, testRoleID)
	if err != nil {
		t.Fatalf("CreateRoleDir() error = %v", err)
	}

	// Check role directory exists
	if !RoleDirExists(testUserID, testRoleID) {
		t.Error("Role directory should exist after creation")
	}

	// Check default files were created
	expectedFiles := []string{
		"config.json",
		".security.yml",
		"workspace/AGENT.md",
		"workspace/SOUL.md",
		"workspace/USER.md",
		"workspace/memory/MEMORY.md",
	}

	for _, file := range expectedFiles {
		filePath := filepath.Join(path, file)
		if _, err := os.Stat(filePath); os.IsNotExist(err) {
			t.Errorf("Expected file %s not found", file)
		}
	}


	// Check .security.yml exists (hidden file)
	securityPath := filepath.Join(path, ".security.yml")
	if _, err := os.Stat(securityPath); os.IsNotExist(err) {
		t.Error(".security.yml should exist")
	}
}

func TestCreateRoleDirIdempotent(t *testing.T) {
	cleanup := setupTestDir(t)
	defer cleanup()

	// Create twice - should not error
	_, err := CreateRoleDir(testUserID, testRoleID)
	if err != nil {
		t.Fatalf("First CreateRoleDir() error = %v", err)
	}

	_, err = CreateRoleDir(testUserID, testRoleID)
	if err != nil {
		t.Fatalf("Second CreateRoleDir() error = %v", err)
	}
}

func TestGetRoleFiles(t *testing.T) {
	cleanup := setupTestDir(t)
	defer cleanup()

	// Create role directory
	CreateRoleDir(testUserID, testRoleID)

	files, err := GetRoleFiles(testUserID, testRoleID)
	if err != nil {
		t.Fatalf("GetRoleFiles() error = %v", err)
	}

	// Should have at least the default files
	if len(files) == 0 {
		t.Error("GetRoleFiles() returned empty slice, expected files")
	}

	// Check file types
	for _, f := range files {
		if f.Type != "file" && f.Type != "directory" {
			t.Errorf("Invalid file type: %s", f.Type)
		}
	}

	// Verify .security.yml is included (it's a required file)
	hasSecurity := false
	for _, f := range files {
		if f.Name == ".security.yml" {
			hasSecurity = true
			break
		}
	}
	if !hasSecurity {
		t.Error(".security.yml should be included in file list")
	}
}

func TestGetRoleFilesEmptyDir(t *testing.T) {
	cleanup := setupTestDir(t)
	defer cleanup()

	// Create directory without default files
	dir := GetRoleDir(testUserID, testRoleID)
	os.MkdirAll(dir, 0755)

	files, err := GetRoleFiles(testUserID, testRoleID)
	if err != nil {
		t.Fatalf("GetRoleFiles() error = %v", err)
	}

	// Should return empty slice, not error
	if len(files) != 0 {
		t.Errorf("GetRoleFiles() on empty dir = %v files, want 0", len(files))
	}
}

func TestGetRoleFilesNonExistent(t *testing.T) {
	cleanup := setupTestDir(t)
	defer cleanup()

	files, err := GetRoleFiles(testUserID, testRoleID)
	if err != nil {
		t.Fatalf("GetRoleFiles() error = %v", err)
	}

	// Should return empty slice for non-existent directory
	if len(files) != 0 {
		t.Errorf("GetRoleFiles() on non-existent = %v files, want 0", len(files))
	}
}

func TestGetRoleFile(t *testing.T) {
	cleanup := setupTestDir(t)
	defer cleanup()

	// Create role directory with default files
	CreateRoleDir(testUserID, testRoleID)


	// Read .security.yml
	securityContent, err := GetRoleFile(testUserID, testRoleID, ".security.yml")
	if err != nil {
		t.Fatalf("GetRoleFile() for .security.yml error = %v", err)
	}

	if !stringContains(securityContent, "channel_list") {
		t.Error("GetRoleFile() for .security.yml returned unexpected content")
	}

	// Read workspace file
	agentContent, err := GetRoleFile(testUserID, testRoleID, "workspace/AGENT.md")
	if err != nil {
		t.Fatalf("GetRoleFile() for workspace/AGENT.md error = %v", err)
	}

	if !stringContains(agentContent, "helpful AI assistant") {
		t.Error("GetRoleFile() for workspace/AGENT.md returned unexpected content")
	}
}

func TestGetRoleFileNotFound(t *testing.T) {
	cleanup := setupTestDir(t)
	defer cleanup()

	CreateRoleDir(testUserID, testRoleID)

	_, err := GetRoleFile(testUserID, testRoleID, "nonexistent.txt")
	if err == nil {
		t.Error("GetRoleFile() should error for non-existent file")
	}

	var storageErr *RoleStorageError
	if !errors.As(err, &storageErr) {
		t.Errorf("Expected RoleStorageError, got %v", err)
	}

	if storageErr.Code != ErrCodeFileNotFound {
		t.Errorf("Expected code %s, got %s", ErrCodeFileNotFound, storageErr.Code)
	}
}

func TestGetRoleFilePathTraversal(t *testing.T) {
	cleanup := setupTestDir(t)
	defer cleanup()

	CreateRoleDir(testUserID, testRoleID)

	_, err := GetRoleFile(testUserID, testRoleID, "../../../etc/passwd")
	if err == nil {
		t.Error("GetRoleFile() should reject path traversal")
	}

	var storageErr *RoleStorageError
	if !errors.As(err, &storageErr) {
		t.Errorf("Expected RoleStorageError, got %v", err)
	}

	if storageErr.Code != ErrCodePathTraversal {
		t.Errorf("Expected code %s, got %s", ErrCodePathTraversal, storageErr.Code)
	}
}

func TestGetRoleFileDirectory(t *testing.T) {
	cleanup := setupTestDir(t)
	defer cleanup()

	CreateRoleDir(testUserID, testRoleID)

	// Trying to read a directory should fail
	_, err := GetRoleFile(testUserID, testRoleID, "workspace")
	if err == nil {
		t.Error("GetRoleFile() should error when trying to read directory")
	}

	var storageErr *RoleStorageError
	if !errors.As(err, &storageErr) {
		t.Errorf("Expected RoleStorageError, got %v", err)
	}

	if storageErr.Code != ErrCodeIsDirectory {
		t.Errorf("Expected code %s, got %s", ErrCodeIsDirectory, storageErr.Code)
	}
}

func TestSaveRoleFile(t *testing.T) {
	cleanup := setupTestDir(t)
	defer cleanup()

	CreateRoleDir(testUserID, testRoleID)

	// Save a new file
	testContent := "Hello, World!"
	path, size, err := SaveRoleFile(testUserID, testRoleID, "test.txt", testContent)
	if err != nil {
		t.Fatalf("SaveRoleFile() error = %v", err)
	}

	if path != "test.txt" {
		t.Errorf("SaveRoleFile() returned path = %v, want test.txt", path)
	}

	if size != len(testContent) {
		t.Errorf("SaveRoleFile() returned size = %v, want %v", size, len(testContent))
	}

	// Verify file was written
	content, err := GetRoleFile(testUserID, testRoleID, "test.txt")
	if err != nil {
		t.Fatalf("Failed to read saved file: %v", err)
	}

	if content != testContent {
		t.Errorf("Saved content = %v, want %v", content, testContent)
	}
}

func TestSaveRoleFileWorkspace(t *testing.T) {
	cleanup := setupTestDir(t)
	defer cleanup()

	CreateRoleDir(testUserID, testRoleID)

	// Save workspace file with allowed extension
	content := "# Test\n\nThis is a test."
	path, _, err := SaveRoleFile(testUserID, testRoleID, "workspace/test.md", content)
	if err != nil {
		t.Fatalf("SaveRoleFile() error = %v", err)
	}

	if path != "workspace/test.md" {
		t.Errorf("SaveRoleFile() returned path = %v", path)
	}

	// Verify
	savedContent, err := GetRoleFile(testUserID, testRoleID, "workspace/test.md")
	if err != nil {
		t.Fatalf("Failed to read workspace file: %v", err)
	}

	if savedContent != content {
		t.Error("Workspace file content mismatch")
	}
}

func TestSaveRoleFileInvalidType(t *testing.T) {
	cleanup := setupTestDir(t)
	defer cleanup()

	CreateRoleDir(testUserID, testRoleID)

	// Try to save file with invalid extension in workspace
	_, _, err := SaveRoleFile(testUserID, testRoleID, "workspace/test.exe", "malicious")
	if err == nil {
		t.Error("SaveRoleFile() should reject invalid file type")
	}

	var storageErr *RoleStorageError
	if !errors.As(err, &storageErr) {
		t.Errorf("Expected RoleStorageError, got %v", err)
	}

	if storageErr.Code != ErrCodeInvalidType {
		t.Errorf("Expected code %s, got %s", ErrCodeInvalidType, storageErr.Code)
	}
}

func TestSaveRoleFileCreatesParentDirs(t *testing.T) {
	cleanup := setupTestDir(t)
	defer cleanup()

	CreateRoleDir(testUserID, testRoleID)

	// Save file in non-existent subdirectory
	_, _, err := SaveRoleFile(testUserID, testRoleID, "workspace/subdir/test.md", "content")
	if err != nil {
		t.Fatalf("SaveRoleFile() error = %v", err)
	}

	// Verify parent directory was created
	dirExists := func() bool {
		_, err := os.Stat(filepath.Join(GetRoleDir(testUserID, testRoleID), "workspace/subdir"))
		return err == nil
	}()

	if !dirExists {
		t.Error("SaveRoleFile() should create parent directories")
	}
}

func TestSaveRoleFilePathTraversal(t *testing.T) {
	cleanup := setupTestDir(t)
	defer cleanup()

	CreateRoleDir(testUserID, testRoleID)

	_, _, err := SaveRoleFile(testUserID, testRoleID, "../../../etc/passwd", "malicious")
	if err == nil {
		t.Error("SaveRoleFile() should reject path traversal")
	}

	var storageErr *RoleStorageError
	if !errors.As(err, &storageErr) {
		t.Errorf("Expected RoleStorageError, got %v", err)
	}

	if storageErr.Code != ErrCodePathTraversal {
		t.Errorf("Expected code %s, got %s", ErrCodePathTraversal, storageErr.Code)
	}
}

func TestDeleteRoleFile(t *testing.T) {
	cleanup := setupTestDir(t)
	defer cleanup()

	CreateRoleDir(testUserID, testRoleID)

	// First create a file to delete
	SaveRoleFile(testUserID, testRoleID, "to-delete.txt", "content")

	// Verify it exists
	_, err := GetRoleFile(testUserID, testRoleID, "to-delete.txt")
	if err != nil {
		t.Fatalf("File should exist before deletion: %v", err)
	}

	// Delete it
	err = DeleteRoleFile(testUserID, testRoleID, "to-delete.txt")
	if err != nil {
		t.Fatalf("DeleteRoleFile() error = %v", err)
	}

	// Verify it's gone
	_, err = GetRoleFile(testUserID, testRoleID, "to-delete.txt")
	if err == nil {
		t.Error("File should not exist after deletion")
	}
}

func TestDeleteRoleFileNotFound(t *testing.T) {
	cleanup := setupTestDir(t)
	defer cleanup()

	CreateRoleDir(testUserID, testRoleID)

	err := DeleteRoleFile(testUserID, testRoleID, "nonexistent.txt")
	if err == nil {
		t.Error("DeleteRoleFile() should error for non-existent file")
	}

	var storageErr *RoleStorageError
	if !errors.As(err, &storageErr) {
		t.Errorf("Expected RoleStorageError, got %v", err)
	}

	if storageErr.Code != ErrCodeFileNotFound {
		t.Errorf("Expected code %s, got %s", ErrCodeFileNotFound, storageErr.Code)
	}
}

func TestDeleteRoleFileDirectory(t *testing.T) {
	cleanup := setupTestDir(t)
	defer cleanup()

	CreateRoleDir(testUserID, testRoleID)

	// Try to delete a directory
	err := DeleteRoleFile(testUserID, testRoleID, "workspace")
	if err == nil {
		t.Error("DeleteRoleFile() should error when trying to delete directory")
	}

	var storageErr *RoleStorageError
	if !errors.As(err, &storageErr) {
		t.Errorf("Expected RoleStorageError, got %v", err)
	}

	if storageErr.Code != ErrCodeIsDirectory {
		t.Errorf("Expected code %s, got %s", ErrCodeIsDirectory, storageErr.Code)
	}
}

func TestDeleteRoleFilePathTraversal(t *testing.T) {
	cleanup := setupTestDir(t)
	defer cleanup()

	CreateRoleDir(testUserID, testRoleID)

	err := DeleteRoleFile(testUserID, testRoleID, "../../../etc/passwd")
	if err == nil {
		t.Error("DeleteRoleFile() should reject path traversal")
	}

	var storageErr *RoleStorageError
	if !errors.As(err, &storageErr) {
		t.Errorf("Expected RoleStorageError, got %v", err)
	}

	if storageErr.Code != ErrCodePathTraversal {
		t.Errorf("Expected code %s, got %s", ErrCodePathTraversal, storageErr.Code)
	}
}

func TestRoleStorageError(t *testing.T) {
	err := &RoleStorageError{Message: "test error", Code: "TEST_CODE"}
	if err.Error() != "test error" {
		t.Error("RoleStorageError.Error() should return message")
	}
}

func TestIsStringInSlice(t *testing.T) {
	slice := []string{"a", "b", "c"}

	if !isStringInSlice("a", slice) {
		t.Error("isStringInSlice() should return true for existing string")
	}

	if isStringInSlice("d", slice) {
		t.Error("isStringInSlice() should return false for non-existing string")
	}
}

func stringContains(s, substr string) bool {
	return len(s) > 0 && len(substr) > 0 && len(s) >= len(substr) && indexOf(s, substr) >= 0
}

func indexOf(s, substr string) int {
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return i
		}
	}
	return -1
}