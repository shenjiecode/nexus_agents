package service

import (
	"io/fs"
	"os"
	"path/filepath"
	"strings"

	"gopkg.in/yaml.v3"
)

var (
	// DataBasePath is the base path for role data storage
	DataBasePath = "data/roles"
)

// RoleFileEntry represents a file entry in a role directory
type RoleFileEntry struct {
	Name       string          `json:"name"`
	Path       string          `json:"path"`
	Type       string          `json:"type"` // "file" or "directory"
	Size       int64           `json:"size,omitempty"`
	ModifiedAt string          `json:"modifiedAt,omitempty"`
	Children   []RoleFileEntry `json:"children,omitempty"`
}

// RoleStorageError represents a role storage error
type RoleStorageError struct {
	Message string
	Code    string
}

func (e *RoleStorageError) Error() string {
	return e.Message
}

// Common error codes
const (
	ErrCodePathTraversal = "PATH_TRAVERSAL"
	ErrCodeAccessDenied = "ACCESS_DENIED"
	ErrCodeFileNotFound = "FILE_NOT_FOUND"
	ErrCodeIsDirectory  = "IS_DIRECTORY"
	ErrCodeInvalidType  = "INVALID_FILE_TYPE"
)

// Required filenames at root level
var requiredFilenames = []string{"config.json", ".security.yml"}

// Allowed file extensions for workspace files
var workspaceAllowedExtensions = []string{".md", ".yml", ".yaml", ".json"}

// GetRoleDir returns the absolute role directory path for the given user and role
func GetRoleDir(userID, roleID string) string {
	relPath := filepath.Join(DataBasePath, userID, roleID)
	absPath, _ := filepath.Abs(relPath)
	return absPath
}

// PicoSecurityConfig represents the .security.yml structure
type PicoSecurityConfig struct {
	ChannelList struct {
		Pico struct {
			Settings struct {
				Token string `yaml:"token"`
			} `yaml:"settings"`
		} `yaml:"pico"`
	} `yaml:"channel_list"`
}

// GetPicoToken reads the pico channel token from .security.yml
func GetPicoToken(userID, roleID string) (string, error) {
	roleDir := GetRoleDir(userID, roleID)
	securityPath := filepath.Join(roleDir, ".security.yml")

	content, err := os.ReadFile(securityPath)
	if err != nil {
		return "", &RoleStorageError{
			Message: "failed to read .security.yml: " + err.Error(),
			Code:    ErrCodeFileNotFound,
		}
	}

	var config PicoSecurityConfig
	if err := parseSecurityYAML(content, &config); err != nil {
		return "", err
	}

	return config.ChannelList.Pico.Settings.Token, nil
}


// parseSecurityYAML parses the .security.yml content using yaml.v3
func parseSecurityYAML(content []byte, config *PicoSecurityConfig) error {
	return yaml.Unmarshal(content, config)
}

// RoleDirExists checks if the role directory exists
func RoleDirExists(userID, roleID string) bool {
	rolePath := GetRoleDir(userID, roleID)
	_, err := os.Stat(rolePath)
	return err == nil
}

// CreateRoleDir creates the role directory structure with default files
func CreateRoleDir(userID, roleID string) (string, error) {
	rolePath := GetRoleDir(userID, roleID)

	// Create role directory
	if err := os.MkdirAll(rolePath, 0755); err != nil {
		return "", err
	}

	// Create workspace subdirectory
	workspacePath := filepath.Join(rolePath, "workspace")
	memoryPath := filepath.Join(workspacePath, "memory")

	if err := os.MkdirAll(workspacePath, 0755); err != nil {
		return "", err
	}
	if err := os.MkdirAll(memoryPath, 0755); err != nil {
		return "", err
	}

	// Write default config.json if not exists (picoclaw v3 format)
	configPath := filepath.Join(rolePath, "config.json")
	if !fileExists(configPath) {
		defaultConfig := `{
  "version": 3,
  "session": { "dimensions": ["chat"] },
  "isolation": {},
  "agents": {
    "defaults": {
      "workspace": "/root/.picoclaw/workspace",
      "restrict_to_workspace": true,
      "allow_read_outside_workspace": false,
      "model_name": "tx/glm-5",
      "max_tokens": 32768,
      "max_tool_iterations": 50,
      "summarize_message_threshold": 20,
      "summarize_token_percent": 75,
      "steering_mode": "one-at-a-time",
      "tool_feedback": { "enabled": false, "max_args_length": 300, "separate_messages": false },
      "split_on_marker": false
    }
  },
  "model_list": [
    {
      "model_name": "tx/glm-5",
      "provider": "openai",
      "model": "glm-5",
      "api_base": "https://api.lkeap.cloud.tencent.com/coding/v3"
    }
  ],
  "channel_list": {
    "pico": {
      "enabled": true,
      "type": "pico",
      "settings": { "ping_interval": 30, "read_timeout": 60, "write_timeout": 10, "max_connections": 100 }
    }
  },
  "gateway": { "host": "0.0.0.0", "port": 18790, "hot_reload": false, "log_level": "warn" },
  "tools": { "web": { "enabled": true, "duckduckgo": { "enabled": true, "max_results": 5 } } },
  "heartbeat": { "enabled": true, "interval": 30 }
}`
		if err := os.WriteFile(configPath, []byte(defaultConfig), 0644); err != nil {
			return "", err
		}
	}

	// Write default .security.yml if not exists (picoclaw model API keys format)
	securityPath := filepath.Join(rolePath, ".security.yml")
	if !fileExists(securityPath) {
		defaultSecurity := `model_list:
  tx/glm-5:0:
    api_keys:
      - CHANGE_ME
`
		if err := os.WriteFile(securityPath, []byte(defaultSecurity), 0644); err != nil {
			return "", err
		}
	}

	// Write default AGENT.md if not exists
	agentPath := filepath.Join(workspacePath, "AGENT.md")
	if !fileExists(agentPath) {
		defaultAgent := `You are a helpful AI assistant.

Your role is to assist users with their tasks efficiently and professionally. You should:
- Understand the user's intent and provide relevant solutions
- Ask clarifying questions when needed
- Proactively offer helpful suggestions
- Maintain professionalism and courtesy in all interactions
`
		if err := os.WriteFile(agentPath, []byte(defaultAgent), 0644); err != nil {
			return "", err
		}
	}

	// Write default SOUL.md if not exists
	soulPath := filepath.Join(workspacePath, "SOUL.md")
	if !fileExists(soulPath) {
		defaultSoul := `## Core Personality

You are an empathetic and patient assistant who genuinely cares about helping users succeed. You believe in:
- Continuous learning and improvement
- Transparent communication
- Respect for user autonomy
- Collaboration over competition

## Values

- **Helpfulness**: Prioritize user success above all
- **Honesty**: Be truthful, even when difficult
- **Privacy**: Respect user confidentiality
- **Excellence**: Strive for quality in every response
`
		if err := os.WriteFile(soulPath, []byte(defaultSoul), 0644); err != nil {
			return "", err
		}
	}

	// Write default USER.md if not exists
	userPath := filepath.Join(workspacePath, "USER.md")
	if !fileExists(userPath) {
		defaultUser := `## Interaction Style

- Address the user respectfully
- Use clear, concise language
- Adapt to user preferences
- Remember previous conversations for continuity

## Communication Preferences

- Preferred tone: Professional yet friendly
- Response length: Adequate to the question
- Detail level: Depends on complexity
`
		if err := os.WriteFile(userPath, []byte(defaultUser), 0644); err != nil {
			return "", err
		}
	}

	// Write default MEMORY.md if not exists
	memoryFilePath := filepath.Join(memoryPath, "MEMORY.md")
	if !fileExists(memoryFilePath) {
		defaultMemory := `# Memory

This is your long-term memory. Important information about the user will be stored here.

---

## Session History

(No sessions yet)
`
		if err := os.WriteFile(memoryFilePath, []byte(defaultMemory), 0644); err != nil {
			return "", err
		}
	}

	return rolePath, nil
}

// GetRoleFiles lists all files in a role directory
func GetRoleFiles(userID, roleID string) ([]RoleFileEntry, error) {
	rolePath := GetRoleDir(userID, roleID)

	// Check if directory exists
	info, err := os.Stat(rolePath)
	if err != nil {
		if os.IsNotExist(err) {
			return []RoleFileEntry{}, nil
		}
		return nil, err
	}

	// If it's a file, return it as a single entry
	if !info.IsDir() {
		name := filepath.Base(rolePath)
		return []RoleFileEntry{
			{
				Name:       name,
				Path:       "",
				Type:       "file",
				Size:       info.Size(),
				ModifiedAt: info.ModTime().Format("2006-01-02T15:04:05Z07:00"),
			},
		}, nil
	}

	return listDirEntries(rolePath, "")
}

// listDirEntries recursively lists files and directories under basePath,
// prefixing paths with the given relPrefix for nested entries.
func listDirEntries(basePath, relPrefix string) ([]RoleFileEntry, error) {
	entries, err := os.ReadDir(basePath)
	if err != nil {
		return nil, err
	}

	var files []RoleFileEntry

	for _, entry := range entries {
		entryPath := filepath.Join(basePath, entry.Name())
		entryInfo, err := os.Stat(entryPath)
		if err != nil {
			continue
		}

		// Skip hidden files (except .security.yml)
		if strings.HasPrefix(entry.Name(), ".") && entry.Name() != ".security.yml" {
			continue
		}

		fileType := entry.Type()
		isDir := fileType&os.ModeDir != 0
		isRegular := fileType&os.ModeType == 0

		// Only include allowed files
		if isRegular && !isDir {
			ext := getExtension(entry.Name())
			isRequiredFilename := isStringInSlice(entry.Name(), requiredFilenames)
			isAllowedExt := isStringInSlice(ext, workspaceAllowedExtensions)

			if !isRequiredFilename && !isAllowedExt {
				continue
			}
		}

		entryType := "file"
		if isDir {
			entryType = "directory"
		}

		size := int64(0)
		if isRegular && !isDir {
			size = entryInfo.Size()
		}

		relPath := entry.Name()
		if relPrefix != "" {
			relPath = relPrefix + "/" + entry.Name()
		}


		fileEntry := RoleFileEntry{
			Name:       entry.Name(),
			Path:       relPath,
			Type:       entryType,
			Size:       size,
			ModifiedAt: entryInfo.ModTime().Format("2006-01-02T15:04:05Z07:00"),
		}

		// Recurse into subdirectories
		if isDir {
			children, err := listDirEntries(entryPath, relPath)
			if err == nil && len(children) > 0 {
				fileEntry.Children = children
			}
		}

		files = append(files, fileEntry)
	}

	sortRoleFiles(files)

	return files, nil
}

// GetRoleFile reads a single file from the role directory
func GetRoleFile(userID, roleID, filename string) (string, error) {
	rolePath := GetRoleDir(userID, roleID)

	// Validate path to prevent directory traversal
	fullPath, err := validatePath(rolePath, filename)
	if err != nil {
		return "", err
	}

	// Check if file exists
	info, err := os.Stat(fullPath)
	if err != nil {
		if os.IsNotExist(err) {
			return "", &RoleStorageError{Message: "File not found", Code: ErrCodeFileNotFound}
		}
		return "", err
	}

	// Check if it's a directory
	if info.IsDir() {
		return "", &RoleStorageError{Message: "Path is a directory", Code: ErrCodeIsDirectory}
	}

	// Validate file type
	if err := validateFileType(fullPath, strings.Contains(filename, "workspace")); err != nil {
		return "", err
	}

	// Read file content
	content, err := os.ReadFile(fullPath)
	if err != nil {
		return "", err
	}

	return string(content), nil
}

// SaveRoleFile writes content to a file in the role directory
func SaveRoleFile(userID, roleID, filename, content string) (string, int, error) {
	rolePath := GetRoleDir(userID, roleID)

	// Validate path to prevent directory traversal
	fullPath, err := validatePath(rolePath, filename)
	if err != nil {
		return "", 0, err
	}

	// Validate file type
	if err := validateFileType(fullPath, strings.Contains(filename, "workspace")); err != nil {
		return "", 0, err
	}

	// Create parent directories if needed
	parentPath := filepath.Dir(fullPath)
	if parentPath != "" && parentPath != "." {
		if err := os.MkdirAll(parentPath, 0755); err != nil {
			return "", 0, err
		}
	}

	// Write file
	if err := os.WriteFile(fullPath, []byte(content), 0644); err != nil {
		return "", 0, err
	}

	size := len([]byte(content))

	return filename, size, nil
}

// DeleteRoleFile deletes a single file from the role directory
func DeleteRoleFile(userID, roleID, filename string) error {
	rolePath := GetRoleDir(userID, roleID)

	// Validate path to prevent directory traversal
	fullPath, err := validatePath(rolePath, filename)
	if err != nil {
		return err
	}

	// Check if file exists
	info, err := os.Stat(fullPath)
	if err != nil {
		if os.IsNotExist(err) {
			return &RoleStorageError{Message: "File not found", Code: ErrCodeFileNotFound}
		}
		return err
	}

	// Check if it's a directory
	if info.IsDir() {
		return &RoleStorageError{Message: "Path is a directory", Code: ErrCodeIsDirectory}
	}

	// Delete the file
	if err := os.Remove(fullPath); err != nil {
		return err
	}

	return nil
}

// validatePath validates and sanitizes the requested file path
// Rejects paths containing ".." to prevent directory traversal
func validatePath(rolePath, requestedPath string) (string, error) {
	// Normalize the requested path
	normalizedPath := filepath.Clean(requestedPath)

	// Check for directory traversal attempts
	if strings.Contains(normalizedPath, "..") {
		return "", &RoleStorageError{Message: "Path traversal not allowed", Code: ErrCodePathTraversal}
	}

	// Build the full path within the role directory
	fullPath := filepath.Join(rolePath, normalizedPath)

	// Resolve paths to check if they're within the role directory
	resolvedPath := filepath.Clean(fullPath)
	resolvedRoleDir := filepath.Clean(rolePath)

	// Ensure the resolved path is within the role directory
	if !strings.HasPrefix(resolvedPath, resolvedRoleDir) {
		return "", &RoleStorageError{Message: "Access denied: path outside role directory", Code: ErrCodeAccessDenied}
	}

	return resolvedPath, nil
}

// validateFileType validates the file extension
func validateFileType(filePath string, isWorkspaceFile bool) error {
	filename := filepath.Base(filePath)

	// Allow required filenames at root level
	if isStringInSlice(filename, requiredFilenames) {
		return nil
	}

	// Check extension for workspace files
	if isWorkspaceFile {
		ext := getExtension(filename)
		if !isStringInSlice(ext, workspaceAllowedExtensions) {
			return &RoleStorageError{Message: "File type not allowed", Code: ErrCodeInvalidType}
		}
	}

	return nil
}

// Helper functions

func fileExists(path string) bool {
	_, err := os.Stat(path)
	return err == nil
}

func getExtension(filename string) string {
	idx := strings.LastIndex(filename, ".")
	if idx == -1 {
		return ""
	}
	return strings.ToLower(filename[idx:])
}

func isStringInSlice(s string, slice []string) bool {
	for _, item := range slice {
		if s == item {
			return true
		}
	}
	return false
}

func sortRoleFiles(files []RoleFileEntry) {
	// Sort: directories first, then files, alphabetically
	for i := 0; i < len(files)-1; i++ {
		for j := i + 1; j < len(files); j++ {
			a, b := files[i], files[j]
			// Directories first
			if a.Type != b.Type {
				if a.Type == "directory" {
					continue
				}
				files[i], files[j] = b, a
				continue
			}
			// Then alphabetically
			if a.Name > b.Name {
				files[i], files[j] = b, a
			}
		}
	}
}

// GetFileInfo returns fs.FileInfo for a role file
func GetFileInfo(path string) (fs.FileInfo, error) {
	return os.Stat(path)
}

// DeleteRoleDir deletes the role directory and all its contents
func DeleteRoleDir(rolePath string) error {
	return os.RemoveAll(rolePath)
}
