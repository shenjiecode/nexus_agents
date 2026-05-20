package handler

import (
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"github.com/nexus-agents/backend/internal/middleware"
	"github.com/nexus-agents/backend/internal/model"
	"github.com/nexus-agents/backend/internal/service"
)

// ExportRole handles GET /api/roles/:id/export - Export role as zip
func ExportRole(c *gin.Context) {
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

	// Only public roles can be exported
	if role.IsPublic != "true" {
		c.JSON(http.StatusForbidden, gin.H{
			"success": false,
			"error":  "Only public roles can be exported",
		})
		return
	}

	// Export the role
	exportResult, err := service.ExportRole(role.UserID, roleID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":  "Failed to export role",
		})
		return
	}

	// Set headers for file download
	filename := fmt.Sprintf("%s.zip", roleID)
	c.DataFromReader(http.StatusOK, int64(exportResult.Size), "application/zip", bytesFromSlice(exportResult.Data), map[string]string{
		"Content-Disposition": fmt.Sprintf("attachment; filename=\"%s\"", filename),
	})
}

// ImportRole handles POST /api/roles/import - Import role from zip
func ImportRole(c *gin.Context) {
	user := middleware.GetUser(c)
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"error":  "Unauthorized",
		})
		return
	}

	// Parse multipart form
	file, header, err := c.Request.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":  "file is required and must be a file",
		})
		return
	}
	defer file.Close()

	// Limit file size (max 50MB)
	if header.Size > 50*1024*1024 {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":  "File too large (max 50MB)",
		})
		return
	}

	// Read file content
	zipData, err := io.ReadAll(file)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":  "Failed to read file",
		})
		return
	}

	// Generate new role ID
	roleID := "role_" + uuid.New().String()

	// Import the role from zip
	importResult, err := service.ImportRole(user.ID, roleID, zipData)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":  "Invalid zip file",
		})
		return
	}

	// Create role record in database
	now := time.Now()
	role := model.Role{
		ID:          roleID,
		UserID:      user.ID,
		Name:        importResult.RoleName,
		Description: "Imported role",
		Variant:     "full",
		Status:      "stopped",
		IsPublic:    "false",
		CreatedAt:   now,
		UpdatedAt:   now,
	}

	db := model.GetDB()
	if result := db.Create(&role); result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":  "Failed to create role in database",
		})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"success": true,
		"data": gin.H{
			"id":      roleID,
			"name":    importResult.RoleName,
			"message": "Role imported successfully",
		},
	})
}

// bytesFromSlice converts a byte slice to io.ReadSeeker
// Used for c.DataFromReader
type bytesFromSlice []byte

func (b bytesFromSlice) Read(p []byte) (int, error) {
	if len(b) == 0 {
		return 0, io.EOF
	}
	n := copy(p, b)
	return n, nil
}
