package handler

import (
	"fmt"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"github.com/nexus-agents/backend/internal/middleware"
	"github.com/nexus-agents/backend/internal/model"
	"github.com/nexus-agents/backend/internal/service"
)

// OSS service for MCP package storage
// Must be set via SetOSSMCPService before handlers are called.
var ossMCPService *service.OSSService

// SetOSSMCPService sets the OSS service instance for MCP handlers.
func SetOSSMCPService(s *service.OSSService) {
	ossMCPService = s
}

// MCPResponse represents the MCP data returned in responses.
type MCPResponse struct {
	ID          string    `json:"id"`
	UserID      string    `json:"userId,omitempty"`
	Name        string    `json:"name"`
	Slug        string    `json:"slug"`
	Description string    `json:"description,omitempty"`
	Category    string    `json:"category,omitempty"`
	IsPublic    string    `json:"isPublic"`
	CreatedAt   time.Time `json:"createdAt"`
	UpdatedAt   time.Time `json:"updatedAt"`
}

// ListMCPs handles GET /api/mcps - List all public MCPs
func ListMCPs(c *gin.Context) {
	db := model.GetDB()

	var mcps []model.MCP
	result := db.Where("is_public = ?", "true").
		Order("created_at DESC").
		Find(&mcps)

	if result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":  "Failed to list MCPs",
		})
		return
	}

	var response []MCPResponse
	for _, mcp := range mcps {
		response = append(response, MCPResponse{
			ID:          mcp.ID,
			Name:        mcp.Name,
			Slug:        mcp.Slug,
			Description: mcp.Description,
			Category:    mcp.Category,
			IsPublic:    mcp.IsPublic,
			CreatedAt:   mcp.CreatedAt,
			UpdatedAt:   mcp.UpdatedAt,
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    response,
	})
}

// GetMyMCPs handles GET /api/mcps/mine - List current user's MCPs
func GetMyMCPs(c *gin.Context) {
	user := middleware.GetUser(c)
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"error":  "Unauthorized",
		})
		return
	}

	db := model.GetDB()

	var mcps []model.MCP
	result := db.Where("user_id = ?", user.ID).
		Order("created_at DESC").
		Find(&mcps)

	if result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":  "Failed to list user MCPs",
		})
		return
	}

	var response []MCPResponse
	for _, mcp := range mcps {
		response = append(response, MCPResponse{
			ID:          mcp.ID,
			UserID:      mcp.UserID,
			Name:        mcp.Name,
			Slug:        mcp.Slug,
			Description: mcp.Description,
			Category:    mcp.Category,
			IsPublic:    mcp.IsPublic,
			CreatedAt:   mcp.CreatedAt,
			UpdatedAt:   mcp.UpdatedAt,
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    response,
	})
}

// CreateMCP handles POST /api/mcps - Create a new MCP
func CreateMCP(c *gin.Context) {
	user := middleware.GetUser(c)
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"error":  "Unauthorized",
		})
		return
	}

	var req map[string]interface{}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":  "Request body must be an object",
		})
		return
	}

	name, ok := req["name"].(string)
	if !ok || name == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":  "name is required and must be a string",
		})
		return
	}

	// Generate MCP ID
	mcpID := "mcp_" + uuid.New().String()

	slug, hasSlug := req["slug"].(string)
	if !hasSlug || slug == "" {
		slug = name
	}

	description, _ := req["description"].(string)
	category, _ := req["category"].(string)

	isPublic := "true"
	if p, ok := req["isPublic"].(string); ok && p != "" {
		isPublic = p
	}

	now := time.Now()

	mcp := model.MCP{
		ID:          mcpID,
		UserID:      user.ID,
		Name:        name,
		Slug:        slug,
		Description: description,
		Category:    category,
		IsPublic:    isPublic,
		CreatedAt:   now,
		UpdatedAt:   now,
	}

	db := model.GetDB()
	if result := db.Create(&mcp); result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":  "Failed to create MCP",
		})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"success": true,
		"data": MCPResponse{
			ID:          mcp.ID,
			UserID:      mcp.UserID,
			Name:        mcp.Name,
			Slug:        mcp.Slug,
			Description: mcp.Description,
			Category:    mcp.Category,
			IsPublic:    mcp.IsPublic,
			CreatedAt:   mcp.CreatedAt,
			UpdatedAt:   mcp.UpdatedAt,
		},
	})
}

// GetMCP handles GET /api/mcps/:id - Get MCP details
func GetMCP(c *gin.Context) {
	mcpID := c.Param("id")

	if mcpID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":  "MCP ID is required",
		})
		return
	}

	db := model.GetDB()

	var mcp model.MCP
	result := db.First(&mcp, "id = ?", mcpID)

	if result.Error != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"success": false,
			"error":  "MCP not found",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": MCPResponse{
			ID:          mcp.ID,
			UserID:      mcp.UserID,
			Name:        mcp.Name,
			Slug:        mcp.Slug,
			Description: mcp.Description,
			Category:    mcp.Category,
			IsPublic:    mcp.IsPublic,
			CreatedAt:   mcp.CreatedAt,
			UpdatedAt:   mcp.UpdatedAt,
		},
	})
}

// UpdateMCP handles PUT /api/mcps/:id - Update MCP metadata
func UpdateMCP(c *gin.Context) {
	user := middleware.GetUser(c)
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"error":  "Unauthorized",
		})
		return
	}

	mcpID := c.Param("id")

	if mcpID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":  "MCP ID is required",
		})
		return
	}

	db := model.GetDB()

	var mcp model.MCP
	result := db.First(&mcp, "id = ?", mcpID)

	if result.Error != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"success": false,
			"error":  "MCP not found",
		})
		return
	}

	// Check ownership
	if mcp.UserID != user.ID {
		c.JSON(http.StatusForbidden, gin.H{
			"success": false,
			"error":  "Forbidden: you can only update your own MCPs",
		})
		return
	}

	var req map[string]interface{}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":  "Invalid request body",
		})
		return
	}

	// Apply updates
	updates := make(map[string]interface{})
	updates["updated_at"] = time.Now()

	if name, ok := req["name"].(string); ok && name != "" {
		updates["name"] = name
	}

	if desc, ok := req["description"].(string); ok {
		updates["description"] = desc
	} else if !ok && req["description"] == nil && c.Request.ContentLength > 0 {
		updates["description"] = ""
	}

	if cat, ok := req["category"].(string); ok {
		updates["category"] = cat
	}

	if p, ok := req["isPublic"].(string); ok {
		updates["is_public"] = p
	}

	result = db.Model(&mcp).Updates(updates)

	if result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":  "Failed to update MCP",
		})
		return
	}

	// Fetch updated MCP
	var updatedMCP model.MCP
	if err := db.First(&updatedMCP, "id = ?", mcpID).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":  "Failed to fetch updated MCP",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": MCPResponse{
			ID:          updatedMCP.ID,
			UserID:      updatedMCP.UserID,
			Name:        updatedMCP.Name,
			Slug:        updatedMCP.Slug,
			Description: updatedMCP.Description,
			Category:    updatedMCP.Category,
			IsPublic:    updatedMCP.IsPublic,
			CreatedAt:   updatedMCP.CreatedAt,
			UpdatedAt:   updatedMCP.UpdatedAt,
		},
	})
}

// DeleteMCP handles DELETE /api/mcps/:id - Delete MCP
func DeleteMCP(c *gin.Context) {
	user := middleware.GetUser(c)
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"error":  "Unauthorized",
		})
		return
	}

	mcpID := c.Param("id")

	if mcpID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":  "MCP ID is required",
		})
		return
	}

	db := model.GetDB()

	var mcp model.MCP
	result := db.First(&mcp, "id = ?", mcpID)

	if result.Error != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"success": false,
			"error":  "MCP not found",
		})
		return
	}

	// Check ownership
	if mcp.UserID != user.ID {
		c.JSON(http.StatusForbidden, gin.H{
			"success": false,
			"error":  "Forbidden: you can only delete your own MCPs",
		})
		return
	}

	if result = db.Delete(&mcp); result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":  "Failed to delete MCP",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":   gin.H{"message": "MCP deleted successfully"},
	})
}

// UploadMCP handles POST /api/mcps/:id/upload - Generate presigned URL for uploading MCP config to OSS
// Frontend can use the returned URL to upload the config file directly to OSS
func UploadMCP(c *gin.Context) {
	user := middleware.GetUser(c)
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"error":  "Unauthorized",
		})
		return
	}

	// Check OSS service is configured
	if ossMCPService == nil || !ossMCPService.IsConfigured() {
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"success": false,
			"error":  "OSS storage is not configured",
		})
		return
	}

	mcpID := c.Param("id")
	if mcpID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":  "MCP ID is required",
		})
		return
	}

	// Validate MCP ownership
	db := model.GetDB()
	var mcp model.MCP
	result := db.First(&mcp, "id = ?", mcpID)
	if result.Error != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"success": false,
			"error":  "MCP not found",
		})
		return
	}

	if mcp.UserID != user.ID {
		c.JSON(http.StatusForbidden, gin.H{
			"success": false,
			"error":  "Forbidden: you can only upload your own MCPs",
		})
		return
	}

	// Generate OSS path for MCP config
	// Format: mcps/{userID}/{mcpID}/config.json
	ossPath := fmt.Sprintf("mcps/%s/%s/config.json", user.ID, mcpID)

	// Generate presigned upload URL (expires in 1 hour)
	presignedURL, err := ossMCPService.GeneratePresignedUploadURL(ossPath, time.Hour)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":  "Failed to generate upload URL",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"uploadUrl": presignedURL,
			"ossPath":   ossPath,
			"expiresIn": 3600,
			"mcpId":    mcpID,
		},
	})
}

// DownloadMCP handles GET /api/mcps/:id/download - Generate presigned URL for downloading MCP config from OSS
// Frontend can use the returned URL to download the config file directly from OSS
func DownloadMCP(c *gin.Context) {
	user := middleware.GetUser(c)
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"error":  "Unauthorized",
		})
		return
	}

	// Check OSS service is configured
	if ossMCPService == nil || !ossMCPService.IsConfigured() {
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"success": false,
			"error":  "OSS storage is not configured",
		})
		return
	}

	mcpID := c.Param("id")
	if mcpID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":  "MCP ID is required",
		})
		return
	}

	// Validate MCP ownership (or check if MCP is public)
	db := model.GetDB()
	var mcp model.MCP
	result := db.First(&mcp, "id = ?", mcpID)
	if result.Error != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"success": false,
			"error":  "MCP not found",
		})
		return
	}

	// Allow download if user owns the MCP or if MCP is public
	if mcp.UserID != user.ID && mcp.IsPublic != "true" {
		c.JSON(http.StatusForbidden, gin.H{
			"success": false,
			"error":  "Forbidden: you can only download your own MCPs or public MCPs",
		})
		return
	}

	// Generate OSS path for MCP config
	// Format: mcps/{userID}/{mcpID}/config.json
	ossPath := fmt.Sprintf("mcps/%s/%s/config.json", mcp.UserID, mcpID)

	// Check if config exists in OSS
	exists, err := ossMCPService.ObjectExists(ossPath)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":  "Failed to check config existence",
		})
		return
	}

	if !exists {
		c.JSON(http.StatusNotFound, gin.H{
			"success": false,
			"error":  "MCP config not found in storage",
		})
		return
	}

	// Generate presigned download URL (expires in 1 hour)
	presignedURL, err := ossMCPService.GeneratePresignedDownloadURL(ossPath, time.Hour)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":  "Failed to generate download URL",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"downloadUrl": presignedURL,
			"ossPath":     ossPath,
			"expiresIn":   3600,
			"mcpId":      mcpID,
			"mcpName":    mcp.Name,
		},
	})
}