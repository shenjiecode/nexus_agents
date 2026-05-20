package handler

import (
	"net/http"

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
		"data":   mockSkills,
	})
}

// GetMCPs handles GET /api/mcps
// Returns a list of available MCPs (mock/placeholder data)
func GetMCPs(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":   mockMCPs,
	})
}
