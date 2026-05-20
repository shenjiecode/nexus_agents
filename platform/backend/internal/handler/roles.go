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

// OSS service for role package storage
// Must be set via SetOSSService before handlers are called.
var ossService *service.OSSService

// SetOSSService sets the OSS service instance for role handlers.
func SetOSSService(s *service.OSSService) {
	ossService = s
}

// RoleResponse represents the role data returned in responses.
type RoleResponse struct {
	ID            string    `json:"id"`
	UserID        string    `json:"userId,omitempty"`
	Name          string    `json:"name"`
	Description   string    `json:"description,omitempty"`
	Variant       string    `json:"variant"`
	Status        string    `json:"status"`
	ContainerID  string    `json:"containerId,omitempty"`
	ContainerPort int      `json:"containerPort,omitempty"`
	IsPublic     string    `json:"isPublic"`
	CreatedAt    time.Time `json:"createdAt"`
	UpdatedAt    time.Time `json:"updatedAt"`
}

// CreateRoleRequest represents the request body for creating a role.
type CreateRoleRequest struct {
	Name        string `json:"name"`
	Description string `json:"description"`
	Variant     string `json:"variant"`
	IsPublic    *bool  `json:"isPublic"`
}

// UpdateRoleRequest represents the request body for updating a role.
type UpdateRoleRequest struct {
	Name        string `json:"name"`
	Description string `json:"description"`
	Variant     string `json:"variant"`
	IsPublic    *bool  `json:"isPublic"`
}

// ListPublicRoles handles GET /api/roles - List all public roles
func ListPublicRoles(c *gin.Context) {
	db := model.GetDB()

	var roles []model.Role
	result := db.Where("is_public = ?", "true").
		Order("created_at DESC").
		Find(&roles)

	if result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":  "Failed to list roles",
		})
		return
	}

	var response []RoleResponse
	for _, role := range roles {
		response = append(response, RoleResponse{
			ID:          role.ID,
			Name:        role.Name,
			Description: role.Description,
			Variant:     role.Variant,
			Status:      role.Status,
			IsPublic:    role.IsPublic,
			CreatedAt:   role.CreatedAt,
			UpdatedAt:   role.UpdatedAt,
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    response,
	})
}

// ListMyRoles handles GET /api/roles/mine - List current user's roles
func ListMyRoles(c *gin.Context) {
	user := middleware.GetUser(c)
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"error":  "Unauthorized",
		})
		return
	}

	db := model.GetDB()

	var roles []model.Role
	result := db.Where("user_id = ?", user.ID).
		Order("created_at DESC").
		Find(&roles)

	if result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":  "Failed to list user roles",
		})
		return
	}

	var response []RoleResponse
	for _, role := range roles {
		response = append(response, RoleResponse{
			ID:            role.ID,
			UserID:        role.UserID,
			Name:          role.Name,
			Description:   role.Description,
			Variant:       role.Variant,
			Status:        role.Status,
			ContainerID:   role.ContainerID,
			ContainerPort:  role.ContainerPort,
			IsPublic:      role.IsPublic,
			CreatedAt:     role.CreatedAt,
			UpdatedAt:     role.UpdatedAt,
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    response,
	})
}

// CreateRole handles POST /api/roles - Create a new role
func CreateRole(c *gin.Context) {
	user := middleware.GetUser(c)
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"error":  "Unauthorized",
		})
		return
	}

	var req CreateRoleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":  "Request body must be an object",
		})
		return
	}

	if req.Name == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":  "name is required and must be a string",
		})
		return
	}

	// Generate role ID (similar to Node.js format)
	roleID := "role_" + uuid.New().String()

	variant := req.Variant
	if variant == "" {
		variant = "full"
	}

	isPublic := "false"
	if req.IsPublic == nil || *req.IsPublic {
		isPublic = "true"
	}

	now := time.Now()

	role := model.Role{
		ID:          roleID,
		UserID:      user.ID,
		Name:        req.Name,
		Description: req.Description,
		Variant:     variant,
		Status:      "stopped",
		IsPublic:    isPublic,
		CreatedAt:   now,
		UpdatedAt:   now,
	}

	db := model.GetDB()
	if result := db.Create(&role); result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":  "Failed to create role",
		})
		return
	}

	// Create role directory
	if _, err := service.CreateRoleDir(user.ID, roleID); err != nil {
		// Log error but don't fail the request since DB was created
		// In production, you might want to delete the DB record
	}

	c.JSON(http.StatusCreated, gin.H{
		"success": true,
		"data": RoleResponse{
			ID:          role.ID,
			Name:        role.Name,
			Description: role.Description,
			Variant:     role.Variant,
			IsPublic:    role.IsPublic,
			CreatedAt:   role.CreatedAt,
		},
	})
}

// GetRole handles GET /api/roles/:id - Get role details
func GetRole(c *gin.Context) {
	roleID := c.Param("id")

	if roleID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":  "Role ID is required",
		})
		return
	}

	db := model.GetDB()

	var role model.Role
	result := db.First(&role, "id = ?", roleID)

	if result.Error != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"success": false,
			"error":  "Role not found",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": RoleResponse{
			ID:            role.ID,
			UserID:        role.UserID,
			Name:          role.Name,
			Description:   role.Description,
			Variant:       role.Variant,
			Status:        role.Status,
			ContainerID:   role.ContainerID,
			ContainerPort: role.ContainerPort,
			IsPublic:      role.IsPublic,
			CreatedAt:     role.CreatedAt,
			UpdatedAt:     role.UpdatedAt,
		},
	})
}

// UpdateRole handles PUT /api/roles/:id - Update role metadata
func UpdateRole(c *gin.Context) {
	user := middleware.GetUser(c)
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"error":  "Unauthorized",
		})
		return
	}

	roleID := c.Param("id")

	if roleID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":  "Role ID is required",
		})
		return
	}

	db := model.GetDB()

	var role model.Role
	result := db.First(&role, "id = ?", roleID)

	if result.Error != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"success": false,
			"error":  "Role not found",
		})
		return
	}

	// Check ownership
	if role.UserID != user.ID {
		c.JSON(http.StatusForbidden, gin.H{
			"success": false,
			"error":  "Forbidden: you can only update your own roles",
		})
		return
	}

	var req UpdateRoleRequest
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

	if req.Name != "" {
		updates["name"] = req.Name
	}

	if req.Description != "" {
		updates["description"] = req.Description
	} else if req.Description == "" && c.Request.ContentLength > 0 {
		// Allow clearing description by sending empty string
		updates["description"] = ""
	}

	if req.Variant != "" {
		updates["variant"] = req.Variant
	}

	if req.IsPublic != nil {
		if *req.IsPublic {
			updates["is_public"] = "true"
		} else {
			updates["is_public"] = "false"
		}
	}

	result = db.Model(&role).Updates(updates)

	if result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":  "Failed to update role",
		})
		return
	}

	// Fetch updated role
	var updatedRole model.Role
	if err := db.First(&updatedRole, "id = ?", roleID).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":  "Failed to fetch updated role",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": RoleResponse{
			ID:            updatedRole.ID,
			UserID:        updatedRole.UserID,
			Name:          updatedRole.Name,
			Description:   updatedRole.Description,
			Variant:       updatedRole.Variant,
			Status:        updatedRole.Status,
			ContainerID:   updatedRole.ContainerID,
			ContainerPort: updatedRole.ContainerPort,
			IsPublic:      updatedRole.IsPublic,
			CreatedAt:     updatedRole.CreatedAt,
			UpdatedAt:     updatedRole.UpdatedAt,
		},
	})
}

// DeleteRole handles DELETE /api/roles/:id - Delete role
func DeleteRole(c *gin.Context) {
	user := middleware.GetUser(c)
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"error":  "Unauthorized",
		})
		return
	}

	roleID := c.Param("id")

	if roleID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":  "Role ID is required",
		})
		return
	}

	db := model.GetDB()

	var role model.Role
	result := db.First(&role, "id = ?", roleID)

	if result.Error != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"success": false,
			"error":  "Role not found",
		})
		return
	}

	// Check ownership
	if role.UserID != user.ID {
		c.JSON(http.StatusForbidden, gin.H{
			"success": false,
			"error":  "Forbidden: you can only delete your own roles",
		})
		return
	}

	// Delete role from database
	if result = db.Delete(&role); result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":  "Failed to delete role",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":   gin.H{"message": "Role deleted successfully"},
	})
}

// deleteRoleDirRecursive deletes a directory and all its contents
func deleteRoleDirRecursive(path string) error {
	return service.DeleteRoleDir(path)
}

// UploadRole handles POST /api/roles/:id/upload - Generate presigned URL for uploading role package to OSS
// Frontend can use the returned URL to upload the zip file directly to OSS
func UploadRole(c *gin.Context) {
	user := middleware.GetUser(c)
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"error":  "Unauthorized",
		})
		return
	}

	// Check OSS service is configured
	if ossService == nil || !ossService.IsConfigured() {
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"success": false,
			"error":  "OSS storage is not configured",
		})
		return
	}

	roleID := c.Param("id")
	if roleID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":  "Role ID is required",
		})
		return
	}

	// Validate role ownership
	db := model.GetDB()
	var role model.Role
	result := db.First(&role, "id = ?", roleID)
	if result.Error != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"success": false,
			"error":  "Role not found",
		})
		return
	}

	if role.UserID != user.ID {
		c.JSON(http.StatusForbidden, gin.H{
			"success": false,
			"error":  "Forbidden: you can only upload your own roles",
		})
		return
	}

	// Generate OSS path for role package
	// Format: roles/{userID}/{roleID}/package.zip
	ossPath := fmt.Sprintf("roles/%s/%s/package.zip", user.ID, roleID)

	// Generate presigned upload URL (expires in 1 hour)
	presignedURL, err := ossService.GeneratePresignedUploadURL(ossPath, time.Hour)
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
			"roleId":    roleID,
		},
	})
}

// DownloadRole handles GET /api/roles/:id/download - Generate presigned URL for downloading role package from OSS
// Frontend can use the returned URL to download the zip file directly from OSS
func DownloadRole(c *gin.Context) {
	user := middleware.GetUser(c)
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"error":  "Unauthorized",
		})
		return
	}

	// Check OSS service is configured
	if ossService == nil || !ossService.IsConfigured() {
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"success": false,
			"error":  "OSS storage is not configured",
		})
		return
	}

	roleID := c.Param("id")
	if roleID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":  "Role ID is required",
		})
		return
	}

	// Validate role ownership (or check if role is public)
	db := model.GetDB()
	var role model.Role
	result := db.First(&role, "id = ?", roleID)
	if result.Error != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"success": false,
			"error":  "Role not found",
		})
		return
	}

	// Allow download if user owns the role or if role is public
	if role.UserID != user.ID && role.IsPublic != "true" {
		c.JSON(http.StatusForbidden, gin.H{
			"success": false,
			"error":  "Forbidden: you can only download your own roles or public roles",
		})
		return
	}

	// Generate OSS path for role package
	// Format: roles/{userID}/{roleID}/package.zip
	ossPath := fmt.Sprintf("roles/%s/%s/package.zip", role.UserID, roleID)

	// Check if package exists in OSS
	exists, err := ossService.ObjectExists(ossPath)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":  "Failed to check package existence",
		})
		return
	}

	if !exists {
		c.JSON(http.StatusNotFound, gin.H{
			"success": false,
			"error":  "Role package not found in storage",
		})
		return
	}

	// Generate presigned download URL (expires in 1 hour)
	presignedURL, err := ossService.GeneratePresignedDownloadURL(ossPath, time.Hour)
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
			"roleId":      roleID,
			"roleName":    role.Name,
		},
	})
}
