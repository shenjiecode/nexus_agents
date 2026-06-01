package service

import (
	"archive/zip"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"io/fs"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"

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
	ErrCodeAccessDenied  = "ACCESS_DENIED"
	ErrCodeFileNotFound  = "FILE_NOT_FOUND"
	ErrCodeIsDirectory   = "IS_DIRECTORY"
	ErrCodeInvalidType   = "INVALID_FILE_TYPE"
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

// CreateContainerDir creates the container directory structure with default files.
// This is used when a container is created without a role binding,
// or as a fallback when role file copy fails.
func CreateContainerDir(userID, containerID string) error {
	containerPath := ContainerSecurityDir(userID, containerID)

	// Create container directory
	if err := os.MkdirAll(containerPath, 0755); err != nil {
		return err
	}

	// Create workspace subdirectory
	workspacePath := filepath.Join(containerPath, "workspace")
	memoryPath := filepath.Join(workspacePath, "memory")

	if err := os.MkdirAll(workspacePath, 0755); err != nil {
		return err
	}
	if err := os.MkdirAll(memoryPath, 0755); err != nil {
		return err
	}

	// Write default config.json if not exists (same as CreateRoleDir)
	configPath := filepath.Join(containerPath, "config.json")
	if !fileExists(configPath) {
		defaultConfig := `{ "version": 3, "session": { "dimensions": ["chat"] }, "isolation": {}, "agents": { "defaults": { "workspace": "/root/.picoclaw/workspace", "restrict_to_workspace": false, "allow_read_outside_workspace": true, "model_name": "tx/glm-5", "max_tokens": 32768, "max_tool_iterations": 50, "summarize_message_threshold": 20, "summarize_token_percent": 75, "steering_mode": "one-at-a-time", "tool_feedback": { "enabled": false, "max_args_length": 300, "separate_messages": false }, "split_on_marker": false } }, "model_list": [ { "model_name": "tx/glm-5", "provider": "openai", "model": "glm-5", "api_base": "https://api.lkeap.cloud.tencent.com/coding/v3" } ], "channel_list": { "pico": { "enabled": true, "type": "pico", "settings": { "ping_interval": 30, "read_timeout": 60, "write_timeout": 10, "max_connections": 100 } } }, "gateway": { "host": "0.0.0.0", "port": 18790, "hot_reload": false, "log_level": "warn" }, "tools": { "web": { "enabled": true, "duckduckgo": { "enabled": true, "max_results": 5 } }, "exec": { "enabled": true, "enable_deny_patterns": true, "custom_allow_patterns": [], "timeout_seconds": 60 } }, "heartbeat": { "enabled": true, "interval": 30 } }`
		if err := os.WriteFile(configPath, []byte(defaultConfig), 0644); err != nil {
			return err
		}
	}

	// Write default .security.yml if not exists
	securityPath := filepath.Join(containerPath, ".security.yml")
	if !fileExists(securityPath) {
		picoToken := generateRandomToken()
		defaultSecurity := fmt.Sprintf(`channel_list:
  pico:
    settings:
      token: %s
model_list:
  tx/glm-5:0:
    api_keys:
      - CHANGE_ME
`, picoToken)
		if err := os.WriteFile(securityPath, []byte(defaultSecurity), 0644); err != nil {
			return err
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
			return err
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
			return err
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
			return err
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
			return err
		}
	}

	return nil
}

// UpdateContainerPicoToken generates a new random pico token and updates
// the .security.yml in the container directory, preserving all other content.
func UpdateContainerPicoToken(userID, containerID string) error {
	containerPath := ContainerSecurityDir(userID, containerID)
	securityPath := filepath.Join(containerPath, ".security.yml")

	content, err := os.ReadFile(securityPath)
	if err != nil {
		return fmt.Errorf("failed to read .security.yml: %w", err)
	}

	// Generate new token
	newToken := generateRandomToken()

	// Parse existing security config to preserve all fields
	var rawConfig map[string]interface{}
	if err := yaml.Unmarshal(content, &rawConfig); err != nil {
		return fmt.Errorf("failed to parse .security.yml: %w", err)
	}

	// Update the pico token
	if channelList, ok := rawConfig["channel_list"].(map[string]interface{}); ok {
		if pico, ok := channelList["pico"].(map[string]interface{}); ok {
			if settings, ok := pico["settings"].(map[string]interface{}); ok {
				settings["token"] = newToken
			} else {
				pico["settings"] = map[string]interface{}{"token": newToken}
			}
		} else {
			channelList["pico"] = map[string]interface{}{"settings": map[string]interface{}{"token": newToken}}
		}
	} else {
		rawConfig["channel_list"] = map[string]interface{}{
			"pico": map[string]interface{}{"settings": map[string]interface{}{"token": newToken}},
		}
	}

	newContent, err := yaml.Marshal(rawConfig)
	if err != nil {
		return fmt.Errorf("failed to marshal .security.yml: %w", err)
	}

	if err := os.WriteFile(securityPath, newContent, 0644); err != nil {
		return fmt.Errorf("failed to write .security.yml: %w", err)
	}

	return nil
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
      "restrict_to_workspace": false,
      "allow_read_outside_workspace": true,
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
  "tools": { "web": { "enabled": true, "duckduckgo": { "enabled": true, "max_results": 5 } }, "exec": { "enabled": true, "enable_deny_patterns": true, "custom_allow_patterns": [], "timeout_seconds": 60 } },
  "heartbeat": { "enabled": true, "interval": 30 }
}`
		if err := os.WriteFile(configPath, []byte(defaultConfig), 0644); err != nil {
			return "", err
		}
	}

	// Write default .security.yml if not exists (picoclaw model API keys format)
	securityPath := filepath.Join(rolePath, ".security.yml")
	if !fileExists(securityPath) {
		// Generate random pico token
		picoToken := generateRandomToken()
		defaultSecurity := fmt.Sprintf(`channel_list:
  pico:
    settings:
      token: %s
model_list:
  tx/glm-5:0:
    api_keys:
      - CHANGE_ME
`, picoToken)
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
// GetEntityFiles lists all files in a given base directory (works for roles and containers)
func GetEntityFiles(basePath string) ([]RoleFileEntry, error) {
	// Check if directory exists
	info, err := os.Stat(basePath)
	if err != nil {
		if os.IsNotExist(err) {
			return []RoleFileEntry{}, nil
		}
		return nil, err
	}

	// If it's a file, return it as a single entry
	if !info.IsDir() {
		name := filepath.Base(basePath)
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

	return listDirEntries(basePath, "")
}

// GetRoleFiles lists all files in the role directory
func GetRoleFiles(userID, roleID string) ([]RoleFileEntry, error) {
	return GetEntityFiles(GetRoleDir(userID, roleID))
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

// GetEntityFile reads a single file from a given base directory (works for roles and containers)
func GetEntityFile(basePath, filename string) (string, error) {
	// Validate path to prevent directory traversal
	fullPath, err := validatePath(basePath, filename)
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

// GetRoleFile reads a single file from the role directory
func GetRoleFile(userID, roleID, filename string) (string, error) {
	return GetEntityFile(GetRoleDir(userID, roleID), filename)
}

// SaveEntityFile writes content to a file in a given base directory (works for roles and containers)
func SaveEntityFile(basePath, filename, content string) (string, int, error) {
	// Validate path to prevent directory traversal
	fullPath, err := validatePath(basePath, filename)
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

// SaveRoleFile writes content to a file in the role directory
func SaveRoleFile(userID, roleID, filename, content string) (string, int, error) {
	return SaveEntityFile(GetRoleDir(userID, roleID), filename, content)
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

// generateRandomToken generates a random 32-character token for pico channel
func generateRandomToken() string {
	bytes := make([]byte, 16)
	if _, err := rand.Read(bytes); err != nil {
		// Fallback to timestamp-based token if random fails
		return hex.EncodeToString([]byte(fmt.Sprintf("%d", time.Now().UnixNano())))
	}
	return hex.EncodeToString(bytes)
}

// DeleteRoleDir deletes the role directory and all its contents
func DeleteRoleDir(rolePath string) error {
	return os.RemoveAll(rolePath)
}

// PicoConfig represents the picoclaw config.json structure
// We only need the agents.defaults section for skill/MCP updates
type PicoConfig struct {
	Version     int                    `json:"version"`
	Agents      PicoAgentsConfig       `json:"agents"`
	ModelList   []PicoModelConfig      `json:"model_list"`
	ChannelList map[string]interface{} `json:"channel_list"`
}

type PicoAgentsConfig struct {
	Defaults PicoAgentDefaults `json:"defaults"`
}

type PicoAgentDefaults struct {
	Skills     []string `json:"skills,omitempty"`
	MCPServers []string `json:"mcp_servers,omitempty"`
	ModelName  string   `json:"model_name,omitempty"`
	MaxTokens  int      `json:"max_tokens,omitempty"`
}

type PicoModelConfig struct {
	ModelName string `json:"model_name"`
	Provider  string `json:"provider"`
	Model     string `json:"model"`
	APIBase   string `json:"api_base,omitempty"`
}

// InstallSkillToWorkspace extracts a skill package (zip data) to the workspace/skills/{slug} directory.
// The zip is extracted so that the skill files end up directly under workspace/skills/{slug}/.
// If the zip has a top-level directory, its contents are flattened into the target.
func InstallSkillToWorkspace(baseDir, slug string, zipData []byte) error {
	skillsDir := filepath.Join(baseDir, "workspace", "skills", slug)

	// Remove existing skill directory if it exists
	_ = os.RemoveAll(skillsDir)

	// Create the directory
	if err := os.MkdirAll(skillsDir, 0755); err != nil {
		return fmt.Errorf("failed to create skill directory: %w", err)
	}

	// Extract zip to a temp dir first, then move contents
	tmpDir, err := os.MkdirTemp("", "skill-extract-*")
	if err != nil {
		return fmt.Errorf("failed to create temp dir: %w", err)
	}
	defer os.RemoveAll(tmpDir)

	if err := extractZipToDir(zipData, tmpDir); err != nil {
		return fmt.Errorf("failed to extract skill zip: %w", err)
	}

	// Check if the zip has a single top-level directory (common pattern)
	// If so, use its contents instead
	srcDir := tmpDir
	entries, err := os.ReadDir(tmpDir)
	if err != nil {
		return fmt.Errorf("failed to read extracted dir: %w", err)
	}
	if len(entries) == 1 && entries[0].IsDir() {
		srcDir = filepath.Join(tmpDir, entries[0].Name())
	}

	// Copy all files from srcDir to skillsDir
	return copyDirRecursive(srcDir, skillsDir)
}

// RemoveSkillFromWorkspace removes a skill directory from workspace/skills/{slug}.
func RemoveSkillFromWorkspace(baseDir, slug string) error {
	skillsDir := filepath.Join(baseDir, "workspace", "skills", slug)
	if _, err := os.Stat(skillsDir); os.IsNotExist(err) {
		return nil // already gone, nothing to do
	}
	return os.RemoveAll(skillsDir)
}

// extractZipToDir extracts a zip archive into the given directory.
func extractZipToDir(zipData []byte, destDir string) error {
	// Create a temp file for the zip
	tmpFile, err := os.CreateTemp("", "skill-*.zip")
	if err != nil {
		return fmt.Errorf("failed to create temp file: %w", err)
	}
	defer os.Remove(tmpFile.Name())

	if _, err := tmpFile.Write(zipData); err != nil {
		tmpFile.Close()
		return fmt.Errorf("failed to write temp file: %w", err)
	}
	tmpFile.Close()

	reader, err := zip.OpenReader(tmpFile.Name())
	if err != nil {
		return fmt.Errorf("failed to open zip: %w", err)
	}
	defer reader.Close()

	for _, f := range reader.File {
		// Skip directories (we create them as needed)
		if f.FileInfo().IsDir() {
			if err := os.MkdirAll(filepath.Join(destDir, f.Name), 0755); err != nil {
				return fmt.Errorf("failed to create dir %s: %w", f.Name, err)
			}
			continue
		}

		// Ensure parent directory exists
		filePath := filepath.Join(destDir, f.Name)
		if err := os.MkdirAll(filepath.Dir(filePath), 0755); err != nil {
			return fmt.Errorf("failed to create parent dir for %s: %w", f.Name, err)
		}

		// Extract file
		rc, err := f.Open()
		if err != nil {
			return fmt.Errorf("failed to open zip entry %s: %w", f.Name, err)
		}

		outFile, err := os.OpenFile(filePath, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, f.Mode())
		if err != nil {
			rc.Close()
			return fmt.Errorf("failed to create file %s: %w", filePath, err)
		}

		_, err = io.Copy(outFile, rc)
		rc.Close()
		outFile.Close()
		if err != nil {
			return fmt.Errorf("failed to write file %s: %w", f.Name, err)
		}
	}

	return nil
}

// copyDirRecursive recursively copies all files and subdirectories from src to dst.
func copyDirRecursive(src, dst string) error {
	if err := os.MkdirAll(dst, 0755); err != nil {
		return err
	}

	entries, err := os.ReadDir(src)
	if err != nil {
		return err
	}

	for _, entry := range entries {
		srcPath := filepath.Join(src, entry.Name())
		dstPath := filepath.Join(dst, entry.Name())

		if entry.IsDir() {
			if err := copyDirRecursive(srcPath, dstPath); err != nil {
				return err
			}
		} else {
			if err := copyFileData(srcPath, dstPath); err != nil {
				return err
			}
		}
	}
	return nil
}

// copyFileData copies a single file from src to dst.
func copyFileData(src, dst string) error {
	srcFile, err := os.Open(src)
	if err != nil {
		return err
	}
	defer srcFile.Close()

	dstFile, err := os.Create(dst)
	if err != nil {
		return err
	}
	defer dstFile.Close()

	if _, err := io.Copy(dstFile, srcFile); err != nil {
		return err
	}
	return nil
}

// InjectMatrixChannel reads the config.json at containerDir, adds a matrix channel entry,
// and writes it back. If a matrix channel already exists it is replaced.
func InjectMatrixChannel(containerDir string, account *MatrixAccount) error {
	configPath := filepath.Join(containerDir, "config.json")
	data, err := os.ReadFile(configPath)
	if err != nil {
		return fmt.Errorf("read config.json: %w", err)
	}

	var cfg map[string]interface{}
	if err := json.Unmarshal(data, &cfg); err != nil {
		return fmt.Errorf("parse config.json: %w", err)
	}

	channelList, ok := cfg["channel_list"].(map[string]interface{})
	if !ok {
		channelList = make(map[string]interface{})
		cfg["channel_list"] = channelList
	}

	// Add or replace matrix channel
	channelList["matrix"] = map[string]interface{}{
		"enabled":  true,
		"type":     "matrix",
		"settings": map[string]interface{}{
			"homeserver":         account.Homeserver,
			"user_id":            account.UserID,
			"access_token":       account.AccessToken,
			"join_on_invite":     true,
			"message_format":     "markdown",
			"crypto_passphrase":  generateRandomToken(),
		},
	}

	updated, err := json.MarshalIndent(cfg, "", "  ")
	if err != nil {
		return fmt.Errorf("marshal config: %w", err)
	}

	// Write via temp file for atomicity
	tmpPath := configPath + ".tmp"
	if err := os.WriteFile(tmpPath, updated, 0644); err != nil {
		return err
	}
	return os.Rename(tmpPath, configPath)
}

// GenerateContainerMatrixUsername creates a deterministic-looking Matrix username
// from the container UUID. Format: agent-{first 12 chars of containerID}
func GenerateContainerMatrixUsername(containerID string) string {
	short := containerID
	if len(short) > 12 {
		short = short[:12]
	}
	return fmt.Sprintf("agent-%s", short)
}

// GenerateContainerMatrixPassword creates a random password for the Matrix account.
func GenerateContainerMatrixPassword() (string, error) {
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}

// FileIndexEntry represents a single file entry in the file-index.json
type FileIndexEntry struct {
	ID          string   `json:"id"`
	Name        string   `json:"name"`
	Type        string   `json:"type"`
	MimeType    string   `json:"mime_type"`
	Tags        []string `json:"tags"`
	OSSKey      string   `json:"oss_key"`
	LocalPath   string   `json:"local_path"`
	Size        int64    `json:"size"`
	Status      string   `json:"status"`
	Description string   `json:"description"`
	CreatedAt   string   `json:"created_at"`
	UpdatedAt   string   `json:"updated_at"`
}

// fileIndexRoot represents the top-level file-index.json structure
type fileIndexRoot struct {
	Version int              `json:"version"`
	Files   []FileIndexEntry `json:"files"`
}

// ReadFileIndex reads and parses the workspace file-index.json with filtering,
// sorting, and pagination.
func ReadFileIndex(containerDir, status, fileType, tag, search, sortBy, sortDir string, page, pageSize int) ([]FileIndexEntry, int, error) {
	indexPath := filepath.Join(containerDir, "workspace", "file-index.json")
	data, err := os.ReadFile(indexPath)
	if err != nil {
		if os.IsNotExist(err) {
			// No index file yet, return empty
			return []FileIndexEntry{}, 0, nil
		}
		return nil, 0, fmt.Errorf("read file-index.json: %w", err)
	}

	var root fileIndexRoot
	if err := json.Unmarshal(data, &root); err != nil {
		return nil, 0, fmt.Errorf("parse file-index.json: %w", err)
	}

	// Filter
	filtered := make([]FileIndexEntry, 0, len(root.Files))
	for _, f := range root.Files {
		if status != "" && f.Status != status {
			continue
		}
		if fileType != "" && f.Type != fileType {
			continue
		}
		if tag != "" && !containsTag(f.Tags, tag) {
			continue
		}
		if search != "" && !matchesSearch(f, search) {
			continue
		}
		filtered = append(filtered, f)
	}

	// Sort
	sortFileEntries(filtered, sortBy, sortDir)

	total := len(filtered)

	// Paginate
	start := (page - 1) * pageSize
	if start > total {
		start = total
	}
	end := start + pageSize
	if end > total {
		end = total
	}

	return filtered[start:end], total, nil
}

// containsTag checks if a tag list contains the given tag (supports prefix matching like "project:").
func containsTag(tags []string, target string) bool {
	for _, t := range tags {
		if t == target || strings.HasPrefix(t, target) {
			return true
		}
	}
	return false
}

// matchesSearch checks if a file entry matches the search keyword.
func matchesSearch(f FileIndexEntry, keyword string) bool {
	kw := strings.ToLower(keyword)
	if strings.Contains(strings.ToLower(f.Name), kw) {
		return true
	}
	if strings.Contains(strings.ToLower(f.Description), kw) {
		return true
	}
	for _, t := range f.Tags {
		if strings.Contains(strings.ToLower(t), kw) {
			return true
		}
	}
	return false
}

// sortFileEntries sorts file entries by the given field and direction.
func sortFileEntries(entries []FileIndexEntry, sortBy, sortDir string) {
	less := func(i, j int) bool {
		var less bool
		switch sortBy {
		case "name":
			less = entries[i].Name < entries[j].Name
		case "size":
			less = entries[i].Size < entries[j].Size
		case "type":
			less = entries[i].Type < entries[j].Type
		case "updated_at":
			less = entries[i].UpdatedAt < entries[j].UpdatedAt
		default: // "created_at"
			less = entries[i].CreatedAt < entries[j].CreatedAt
		}
		if sortDir == "asc" {
			return less
		}
		return !less
	}
	sort.Slice(entries, less)
}

// ListInstalledSkills scans the workspace/skills/ directory and returns a list
// of skill slugs (directory names that contain a SKILL.md file).
func ListInstalledSkills(containerDir string) ([]string, error) {
	skillsDir := filepath.Join(containerDir, "workspace", "skills")
	entries, err := os.ReadDir(skillsDir)
	if err != nil {
		if os.IsNotExist(err) {
			return []string{}, nil
		}
		return nil, fmt.Errorf("read skills dir: %w", err)
	}

	var skills []string
	for _, e := range entries {
		if !e.IsDir() {
			continue
		}
		// Check if SKILL.md exists in the directory
		skillMD := filepath.Join(skillsDir, e.Name(), "SKILL.md")
		if _, err := os.Stat(skillMD); err == nil {
			skills = append(skills, e.Name())
		}
	}
	if skills == nil {
		skills = []string{}
	}
	return skills, nil
}
