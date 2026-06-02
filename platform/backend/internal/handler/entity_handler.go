package handler

import (
	"fmt"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"

	"github.com/nexus-agents/backend/internal/middleware"
	"github.com/nexus-agents/backend/internal/model"
	"github.com/nexus-agents/backend/internal/service"
)

// EntityInfo contains the information needed to process entity requests.
type EntityInfo struct {
	UserID       string
	EntityID     string
	WorkspaceDir string
	EntityType   string // "role" or "container"
}

// entityResolver resolves entity info and validates ownership.
// It returns the entity info if valid, or an error message if access denied.
type entityResolver func(c *gin.Context, entityID string) (*EntityInfo, string, int)

// resolveRole resolves a role and validates ownership.
func resolveRole(c *gin.Context, roleID string) (*EntityInfo, string, int) {
	user := middleware.GetUser(c)
	if user == nil {
		return nil, "Unauthorized", http.StatusUnauthorized
	}

	db := model.GetDB()
	var role model.Role
	if err := db.First(&role, "id = ?", roleID).Error; err != nil {
		return nil, "Role not found", http.StatusNotFound
	}

	if role.UserID != user.ID {
		return nil, "Forbidden: you can only access your own roles", http.StatusForbidden
	}

	return &EntityInfo{
		UserID:       user.ID,
		EntityID:     roleID,
		WorkspaceDir: service.GetRoleDir(user.ID, roleID),
		EntityType:   "role",
	}, "", 0
}

// resolveContainer resolves a container and validates ownership.
func resolveContainer(c *gin.Context, containerID string) (*EntityInfo, string, int) {
	user := middleware.GetUser(c)
	if user == nil {
		return nil, "Unauthorized", http.StatusUnauthorized
	}

	db := model.GetDB()
	var container model.Container
	if err := db.First(&container, "id = ?", containerID).Error; err != nil {
		return nil, "Container not found", http.StatusNotFound
	}

	if container.UserID != user.ID {
		return nil, "Forbidden: you can only access your own containers", http.StatusForbidden
	}

	return &EntityInfo{
		UserID:       user.ID,
		EntityID:     containerID,
		WorkspaceDir: service.ContainerSecurityDir(user.ID, containerID),
		EntityType:   "container",
	}, "", 0
}

// --- File Operations ---

// listEntityFiles lists files in an entity's workspace.
func listEntityFiles(resolver entityResolver) gin.HandlerFunc {
	return func(c *gin.Context) {
		entityID := c.Param("id")
		info, errMsg, status := resolver(c, entityID)
		if errMsg != "" {
			c.JSON(status, gin.H{"success": false, "error": errMsg})
			return
		}

		files, err := service.GetEntityFiles(info.WorkspaceDir)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{"success": true, "data": files})
	}
}

// getEntityFileContent gets the content of a file in an entity's workspace.
func getEntityFileContent(resolver entityResolver) gin.HandlerFunc {
	return func(c *gin.Context) {
		entityID := c.Param("id")
		filePath := c.Param("path")
		if len(filePath) > 0 && filePath[0] == '/' {
			filePath = filePath[1:]
		}

		info, errMsg, status := resolver(c, entityID)
		if errMsg != "" {
			c.JSON(status, gin.H{"success": false, "error": errMsg})
			return
		}

		content, err := service.GetEntityFile(info.WorkspaceDir, filePath)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{"success": true, "data": gin.H{"path": filePath, "content": content}})
	}
}

// saveEntityFileContent saves content to a file in an entity's workspace.
func saveEntityFileContent(resolver entityResolver) gin.HandlerFunc {
	return func(c *gin.Context) {
		entityID := c.Param("id")
		filePath := c.Param("path")
		if len(filePath) > 0 && filePath[0] == '/' {
			filePath = filePath[1:]
		}

		var body struct {
			Content string `json:"content"`
		}
		if err := c.ShouldBindJSON(&body); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": "Invalid request body"})
			return
		}

		info, errMsg, status := resolver(c, entityID)
		if errMsg != "" {
			c.JSON(status, gin.H{"success": false, "error": errMsg})
			return
		}

		_, size, err := service.SaveEntityFile(info.WorkspaceDir, filePath, body.Content)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": err.Error()})
			return
		}

		// Update ModifiedAt for Role entities
		if info.EntityType == "role" {
			db := model.GetDB()
			now := time.Now()
			db.Model(&model.Role{}).Where("id = ?", entityID).Update("modified_at", now)
		}

		c.JSON(http.StatusOK, gin.H{"success": true, "data": gin.H{"path": filePath, "size": size}})
	}
}

// --- Skill Operations ---

// addSkillToEntity adds a skill to an entity's workspace.
func addSkillToEntity(resolver entityResolver) gin.HandlerFunc {
	return func(c *gin.Context) {
		entityID := c.Param("id")
		skillID := c.Param("skillId")

		info, errMsg, status := resolver(c, entityID)
		if errMsg != "" {
			c.JSON(status, gin.H{"success": false, "error": errMsg})
			return
		}

		// Look up skill info
		db := model.GetDB()
		var skill model.Skill
		if err := db.First(&skill, "id = ?", skillID).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"success": false, "error": "Skill not found"})
			return
		}

		// Sync skill files to workspace (picoclaw auto-discovers from workspace/skills/)
		if ossSkillService != nil && ossSkillService.IsConfigured() {
			ossPath := fmt.Sprintf("skills/%s/%s/package.zip", skill.UserID, skillID)
			if zipData, err := ossSkillService.DownloadFile(ossPath); err == nil {
				if err := service.InstallSkillToWorkspace(info.WorkspaceDir, skill.Slug, zipData); err != nil {
					c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": err.Error()})
					return
				}
			}
		}

		c.JSON(http.StatusOK, gin.H{"success": true, "data": gin.H{"message": "Skill added"}})
	}
}

// removeSkillFromEntity removes a skill from an entity's workspace.
func removeSkillFromEntity(resolver entityResolver) gin.HandlerFunc {
	return func(c *gin.Context) {
		entityID := c.Param("id")
		skillID := c.Param("skillId")

		info, errMsg, status := resolver(c, entityID)
		if errMsg != "" {
			c.JSON(status, gin.H{"success": false, "error": errMsg})
			return
		}

		// Look up skill slug
		db := model.GetDB()
		var skill model.Skill
		if err := db.First(&skill, "id = ?", skillID).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"success": false, "error": "Skill not found"})
			return
		}

		if err := service.RemoveSkillFromWorkspace(info.WorkspaceDir, skill.Slug); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{"success": true, "data": gin.H{"message": "Skill removed"}})
	}
}

// --- MCP Operations ---

// addMCPToEntity adds an MCP to an entity's config.json.
func addMCPToEntity(resolver entityResolver) gin.HandlerFunc {
	return func(c *gin.Context) {
		entityID := c.Param("id")
		mcpID := c.Param("mcpId")

		info, errMsg, status := resolver(c, entityID)
		if errMsg != "" {
			c.JSON(status, gin.H{"success": false, "error": errMsg})
			return
		}

		// Update config.json to add MCP ID to agents.defaults.mcp_servers
		err := service.UpdateConfigMCPs(info.WorkspaceDir, func(mcps []string) []string {
			for _, m := range mcps {
				if m == mcpID {
					return mcps
				}
			}
			return append(mcps, mcpID)
		})
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{"success": true, "data": gin.H{"message": "MCP added"}})
	}
}

// removeMCPFromEntity removes an MCP from an entity's config.json.
func removeMCPFromEntity(resolver entityResolver) gin.HandlerFunc {
	return func(c *gin.Context) {
		entityID := c.Param("id")
		mcpID := c.Param("mcpId")

		info, errMsg, status := resolver(c, entityID)
		if errMsg != "" {
			c.JSON(status, gin.H{"success": false, "error": errMsg})
			return
		}

		// Update config.json to remove MCP ID from agents.defaults.mcp_servers
		err := service.UpdateConfigMCPs(info.WorkspaceDir, func(mcps []string) []string {
			result := make([]string, 0, len(mcps))
			for _, m := range mcps {
				if m != mcpID {
					result = append(result, m)
				}
			}
			return result
		})
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{"success": true, "data": gin.H{"message": "MCP removed"}})
	}
}

// --- Installed Skills ---

// listInstalledSkills lists skills installed in an entity's workspace.
func listInstalledSkills(resolver entityResolver) gin.HandlerFunc {
	return func(c *gin.Context) {
		entityID := c.Param("id")

		info, errMsg, status := resolver(c, entityID)
		if errMsg != "" {
			c.JSON(status, gin.H{"success": false, "error": errMsg})
			return
		}

		skills, err := service.ListInstalledSkills(info.WorkspaceDir)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{"success": true, "data": skills})
	}
}
