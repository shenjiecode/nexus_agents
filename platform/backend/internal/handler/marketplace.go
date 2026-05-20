package handler

import (
	"net/http"
	"path/filepath"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

// Skill represents a skill in the marketplace.
type Skill struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Slug        string `json:"slug"`
	Description string `json:"description"`
	Category    string `json:"category,omitempty"`
}

// MCP represents an MCP server in the marketplace.
type MCP struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Slug        string `json:"slug"`
	Description string `json:"description"`
	Category    string `json:"category,omitempty"`
}

// Mock data for skills marketplace (placeholder/display-only)
var mockSkills = []Skill{
	{
		ID:          "skill_001",
		Name:        "Code Reviewer",
		Slug:        "code-reviewer",
		Description: "Analyzes code quality and provides constructive feedback",
		Category:    "development",
	},
	{
		ID:          "skill_002",
		Name:        "Test Generator",
		Slug:        "test-generator",
		Description: "Generates comprehensive unit tests for your code",
		Category:    "testing",
	},
	{
		ID:          "skill_003",
		Name:        "Documentation Writer",
		Slug:        "doc-writer",
		Description: "Creates clear and comprehensive documentation",
		Category:    "documentation",
	},
	{
		ID:          "skill_004",
		Name:        "Security Auditor",
		Slug:        "security-auditor",
		Description: "Scans code for security vulnerabilities",
		Category:    "security",
	},
	{
		ID:          "skill_005",
		Name:        "Refactoring Expert",
		Slug:        "refactoring-expert",
		Description: "Improves code structure and readability",
		Category:    "development",
	},
}

// Mock data for MCP marketplace (placeholder/display-only)
var mockMCPs = []MCP{
	{
		ID:          "mcp_001",
		Name:        "GitHub Integration",
		Slug:        "github-integration",
		Description: "Connect to GitHub for repository management",
		Category:    "integration",
	},
	{
		ID:          "mcp_002",
		Name:        "Database Connector",
		Slug:        "database-connector",
		Description: "Query and manage databases directly",
		Category:    "data",
	},
	{
		ID:          "mcp_003",
		Name:        "File System Agent",
		Slug:        "file-system-agent",
		Description: "Read, write, and manage files on your system",
		Category:    "filesystem",
	},
	{
		ID:          "mcp_004",
		Name:        "API Gateway",
		Slug:        "api-gateway",
		Description: "Manage and monitor REST APIs",
		Category:    "integration",
	},
	{
		ID:          "mcp_005",
		Name:        "CI/CD Pipeline",
		Slug:        "cicd-pipeline",
		Description: "Automate your continuous integration and deployment",
		Category:    "devops",
	},
}

// GetSkills handles GET /api/skills
// Returns a list of available skills (mock/placeholder data)
func GetSkills(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    mockSkills,
	})
}

// GetMCPs handles GET /api/mcps
// Returns a list of available MCPs (mock/placeholder data)
func GetMCPs(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    mockMCPs,
	})
}

// MarketplaceRole represents a role package in the marketplace.
type MarketplaceRole struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Description string `json:"description,omitempty"`
	StorageKey  string `json:"storageKey"`
	Size        int64  `json:"size,omitempty"`
	CreatedAt   string `json:"createdAt,omitempty"`
}

// ListMarketplaceRoles handles GET /api/marketplace/roles
// Returns a list of available role packages from OSS storage.
func ListMarketplaceRoles(c *gin.Context) {
	if ossService == nil || !ossService.IsConfigured() {
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"success": false,
			"error":   "Marketplace service not configured",
		})
		return
	}

	// List objects with marketplace prefix
	objects, err := ossService.ListObjects("marketplace/")
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to list marketplace roles",
		})
		return
	}

	// Filter .zip files and build response
	var roles []MarketplaceRole
	for _, key := range objects {
		// Only include .zip files
		if !strings.HasSuffix(key, ".zip") {
			continue
		}

		// Extract role ID from filename (e.g., "marketplace/researcher.zip" -> "researcher")
		filename := filepath.Base(key)
		roleID := strings.TrimSuffix(filename, ".zip")

		roles = append(roles, MarketplaceRole{
			ID:         roleID,
			Name:       roleID, // Use ID as name for now
			StorageKey: key,
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    roles,
	})
}

// GetMarketplaceRoleDownload handles GET /api/marketplace/roles/:id/download
// Generates a presigned download URL for a role package.
func GetMarketplaceRoleDownload(c *gin.Context) {
	if ossService == nil || !ossService.IsConfigured() {
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"success": false,
			"error":   "Marketplace service not configured",
		})
		return
	}

	roleID := c.Param("id")
	if roleID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Role ID is required",
		})
		return
	}

	// Construct storage key
	storageKey := "marketplace/" + roleID + ".zip"

	// Check if object exists
	exists, err := ossService.ObjectExists(storageKey)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to check role existence",
		})
		return
	}

	if !exists {
		c.JSON(http.StatusNotFound, gin.H{
			"success": false,
			"error":   "Role not found in marketplace",
		})
		return
	}

	// Generate presigned download URL (expires in 1 hour)
	downloadURL, err := ossService.GeneratePresignedDownloadURL(storageKey, time.Hour)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to generate download URL",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"url":        downloadURL,
			"storageKey": storageKey,
			"expiresIn":  3600, // 1 hour in seconds
		},
	})
}
