package handler

import (
	"archive/zip"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"time"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"github.com/nexus-agents/backend/internal/middleware"
	"github.com/nexus-agents/backend/internal/model"
	"github.com/nexus-agents/backend/internal/service"
)

// OSS service for skill package storage
// Must be set via SetOSSSkillService before handlers are called.
var ossSkillService *service.OSSService

// SetOSSSkillService sets the OSS service instance for skill handlers.
func SetOSSSkillService(s *service.OSSService) {
	ossSkillService = s
}

//SkillResponse represents the skill data returned in responses.
type SkillResponse struct {
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

//ListSkills handles GET /api/skills - List all public skills
func ListSkills(c *gin.Context) {
	db := model.GetDB()

	var skills []model.Skill
	result := db.Where("is_public = ?", "true").
		Order("created_at DESC").
		Find(&skills)

	if result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":  "Failed to list skills",
		})
		return
	}

	var response []SkillResponse
	for _, skill := range skills {
		response = append(response, SkillResponse{
			ID:          skill.ID,
			Name:        skill.Name,
			Slug:        skill.Slug,
			Description: skill.Description,
			Category:    skill.Category,
			IsPublic:    skill.IsPublic,
			CreatedAt:   skill.CreatedAt,
			UpdatedAt:   skill.UpdatedAt,
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    response,
	})
}

// GetMySkills handles GET /api/skills/mine - List current user's skills
func GetMySkills(c *gin.Context) {
	user := middleware.GetUser(c)
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"error":  "Unauthorized",
		})
		return
	}

	db := model.GetDB()

	var skills []model.Skill
	result := db.Where("user_id = ?", user.ID).
		Order("created_at DESC").
		Find(&skills)

	if result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":  "Failed to list user skills",
		})
		return
	}

	var response []SkillResponse
	for _, skill := range skills {
		response = append(response, SkillResponse{
			ID:          skill.ID,
			UserID:      skill.UserID,
			Name:        skill.Name,
			Slug:        skill.Slug,
			Description: skill.Description,
			Category:    skill.Category,
			IsPublic:    skill.IsPublic,
			CreatedAt:   skill.CreatedAt,
			UpdatedAt:   skill.UpdatedAt,
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    response,
	})
}

// CreateSkill handles POST /api/skills - Create a new skill
func CreateSkill(c *gin.Context) {
	user := middleware.GetUser(c)
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"error":  "Unauthorized",
		})
		return
	}

	// Parse JSON manually to avoid type conflicts
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

	// Generate skill ID
	skillID := "skill_" + uuid.New().String()

	// Use provided slug or generate from name
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

	skill := model.Skill{
		ID:          skillID,
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
	if result := db.Create(&skill); result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":  "Failed to create skill",
		})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"success": true,
		"data": SkillResponse{
			ID:          skill.ID,
			UserID:      skill.UserID,
			Name:        skill.Name,
			Slug:        skill.Slug,
			Description: skill.Description,
			Category:    skill.Category,
			IsPublic:    skill.IsPublic,
			CreatedAt:   skill.CreatedAt,
			UpdatedAt:   skill.UpdatedAt,
		},
	})
}

// GetSkill handles GET /api/skills/:id - Get skill details
func GetSkill(c *gin.Context) {
	skillID := c.Param("id")

	if skillID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":  "Skill ID is required",
		})
		return
	}

	db := model.GetDB()

	var skill model.Skill
	result := db.First(&skill, "id = ?", skillID)

	if result.Error != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"success": false,
			"error":  "Skill not found",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": SkillResponse{
			ID:          skill.ID,
			UserID:      skill.UserID,
			Name:        skill.Name,
			Slug:        skill.Slug,
			Description: skill.Description,
			Category:    skill.Category,
			IsPublic:    skill.IsPublic,
			CreatedAt:   skill.CreatedAt,
			UpdatedAt:   skill.UpdatedAt,
		},
	})
}

// UpdateSkill handles PUT /api/skills/:id - Update skill metadata
func UpdateSkill(c *gin.Context) {
	user := middleware.GetUser(c)
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"error":  "Unauthorized",
		})
		return
	}

	skillID := c.Param("id")

	if skillID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":  "Skill ID is required",
		})
		return
	}

	db := model.GetDB()

	var skill model.Skill
	result := db.First(&skill, "id = ?", skillID)

	if result.Error != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"success": false,
			"error":  "Skill not found",
		})
		return
	}

	// Check ownership
	if skill.UserID != user.ID {
		c.JSON(http.StatusForbidden, gin.H{
			"success": false,
			"error":  "Forbidden: you can only update your own skills",
		})
		return
	}

	// Parse manually to avoid type conflicts
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
		// Allow clearing description by sending empty string
		updates["description"] = ""
	}

	if cat, ok := req["category"].(string); ok {
		updates["category"] = cat
	}

	if p, ok := req["isPublic"].(string); ok {
		updates["is_public"] = p
	}

	result = db.Model(&skill).Updates(updates)

	if result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":  "Failed to update skill",
		})
		return
	}

	// Fetch updated skill
	var updatedSkill model.Skill
	if err := db.First(&updatedSkill, "id = ?", skillID).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":  "Failed to fetch updated skill",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": SkillResponse{
			ID:          updatedSkill.ID,
			UserID:      updatedSkill.UserID,
			Name:        updatedSkill.Name,
			Slug:        updatedSkill.Slug,
			Description: updatedSkill.Description,
			Category:    updatedSkill.Category,
			IsPublic:    updatedSkill.IsPublic,
			CreatedAt:   updatedSkill.CreatedAt,
			UpdatedAt:   updatedSkill.UpdatedAt,
		},
	})
}

// DeleteSkill handles DELETE /api/skills/:id - Delete skill
func DeleteSkill(c *gin.Context) {
	user := middleware.GetUser(c)
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"error":  "Unauthorized",
		})
		return
	}

	skillID := c.Param("id")

	if skillID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":  "Skill ID is required",
		})
		return
	}

	db := model.GetDB()

	var skill model.Skill
	result := db.First(&skill, "id = ?", skillID)

	if result.Error != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"success": false,
			"error":  "Skill not found",
		})
		return
	}

	// Check ownership
	if skill.UserID != user.ID {
		c.JSON(http.StatusForbidden, gin.H{
			"success": false,
			"error":  "Forbidden: you can only delete your own skills",
		})
		return
	}

	// Delete skill from database
	if result = db.Delete(&skill); result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":  "Failed to delete skill",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":   gin.H{"message": "Skill deleted successfully"},
	})
}

// UploadSkill handles POST /api/skills/:id/upload - Upload skill package directly to OSS via backend
func UploadSkill(c *gin.Context) {
	user := middleware.GetUser(c)
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"error":  "Unauthorized",
		})
		return
	}

	// Check OSS service is configured
	if ossSkillService == nil || !ossSkillService.IsConfigured() {
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"success": false,
			"error":  "OSS storage is not configured",
		})
		return
	}

	skillID := c.Param("id")
	if skillID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":  "Skill ID is required",
		})
		return
	}

	// Validate skill ownership
	db := model.GetDB()
	var skill model.Skill
	result := db.First(&skill, "id = ?", skillID)
	if result.Error != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"success": false,
			"error":  "Skill not found",
		})
		return
	}

	if skill.UserID != user.ID {
		c.JSON(http.StatusForbidden, gin.H{
			"success": false,
			"error":  "Forbidden: you can only upload your own skills",
		})
		return
	}

	// Receive multipart file
	file, header, err := c.Request.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":  "File is required",
		})
		return
	}
	defer file.Close()

	// Validate file size (max 50MB)
	const maxSize = 50 * 1024 * 1024
	if header.Size > maxSize {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":  "File size exceeds 50MB limit",
		})
		return
	}

	// Read file content
	data, err := io.ReadAll(file)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":  "Failed to read file",
		})
		return
	}

	// Generate OSS path for skill package
	ossPath := fmt.Sprintf("skills/%s/%s/package.zip", user.ID, skillID)

	// Upload directly to OSS
	_, err = ossSkillService.UploadFile(ossPath, data)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":  "Failed to upload file to storage",
		})
		return
	}

	// Update skill record with storage info
	db.Model(&skill).Updates(map[string]interface{}{
		"storage_key": ossPath,
		"size":        header.Size,
	})

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"ossPath":   ossPath,
			"size":      header.Size,
			"skillId":   skillID,
		},
	})
}

// DownloadSkill handles GET /api/skills/:id/download - Generate presigned URL for downloading skill package from OSS
// Frontend can use the returned URL to download the zip file directly from OSS
func DownloadSkill(c *gin.Context) {
	user := middleware.GetUser(c)
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"error":  "Unauthorized",
		})
		return
	}

	// Check OSS service is configured
	if ossSkillService == nil || !ossSkillService.IsConfigured() {
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"success": false,
			"error":  "OSS storage is not configured",
		})
		return
	}

	skillID := c.Param("id")
	if skillID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":  "Skill ID is required",
		})
		return
	}

	// Validate skill ownership (or check if skill is public)
	db := model.GetDB()
	var skill model.Skill
	result := db.First(&skill, "id = ?", skillID)
	if result.Error != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"success": false,
			"error":  "Skill not found",
		})
		return
	}

	// Allow download if user owns the skill or if skill is public
	if skill.UserID != user.ID && skill.IsPublic != "true" {
		c.JSON(http.StatusForbidden, gin.H{
			"success": false,
			"error":  "Forbidden: you can only download your own skills or public skills",
		})
		return
	}

	// Generate OSS path for skill package
	// Format: skills/{userID}/{skillID}/package.zip
	ossPath := fmt.Sprintf("skills/%s/%s/package.zip", skill.UserID, skillID)

	// Check if package exists in OSS
	exists, err := ossSkillService.ObjectExists(ossPath)
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
			"error":  "Skill package not found in storage",
		})
		return
	}

	// Generate presigned download URL (expires in 1 hour)
	presignedURL, err := ossSkillService.GeneratePresignedDownloadURL(ossPath, time.Hour)
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
			"skillId":     skillID,
			"skillName":   skill.Name,
		},
	})
}

// SkillFile represents a file in a skill package
type SkillFile struct {
	Path    string `json:"path"`
	Name    string `json:"name"`
	Size    int64  `json:"size"`
	IsDir   bool   `json:"isDir"`
	Content string `json:"content,omitempty"`
}

// GetSkillFiles handles GET /api/skills/:id/files - List files in skill package and get SKILL.md content
func GetSkillFiles(c *gin.Context) {
	skillID := c.Param("id")
	if skillID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":  "Skill ID is required",
		})
		return
	}

	// Check OSS service is configured
	if ossSkillService == nil || !ossSkillService.IsConfigured() {
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"success": false,
			"error":  "OSS storage is not configured",
		})
		return
	}

	db := model.GetDB()

	var skill model.Skill
	result := db.First(&skill, "id = ?", skillID)
	if result.Error != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"success": false,
			"error":  "Skill not found",
		})
		return
	}

	// Generate OSS path for skill package
	// Format: skills/{userID}/{skillID}/package.zip
	ossPath := fmt.Sprintf("skills/%s/%s/package.zip", skill.UserID, skillID)

	// Check if package exists in OSS
	exists, err := ossSkillService.ObjectExists(ossPath)
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
			"error":  "Skill package not found in storage",
		})
		return
	}

	// Download the ZIP file from OSS
	zipData, err := ossSkillService.DownloadFile(ossPath)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":  "Failed to download skill package",
		})
		return
	}

	// Extract file list and SKILL.md content from ZIP
	files, skillMdContent, err := extractSkillFiles(zipData)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":  "Failed to extract skill files",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"skill":           skill,
			"files":           files,
			"skillMdContent":  skillMdContent,
		},
	})
}

// extractSkillFiles extracts file list and SKILL.md content from a ZIP archive
func extractSkillFiles(zipData []byte) ([]SkillFile, string, error) {
	// Create a temporary file for the ZIP
	tempFile, err := os.CreateTemp("", "skill-*.zip")
	if err != nil {
		return nil, "", fmt.Errorf("failed to create temp file: %w", err)
	}
	defer os.Remove(tempFile.Name())

	// Write ZIP data to temp file
	if _, err := tempFile.Write(zipData); err != nil {
		tempFile.Close()
		return nil, "", fmt.Errorf("failed to write temp file: %w", err)
	}
	tempFile.Close()

	// Open the ZIP file
	reader, err := zip.OpenReader(tempFile.Name())
	if err != nil {
		return nil, "", fmt.Errorf("failed to open zip: %w", err)
	}
	defer reader.Close()

	var files []SkillFile
	var skillMdContent string

	for _, file := range reader.File {
		info := file.FileInfo()

		// Skip directories for file list
		if !info.IsDir() {
			files = append(files, SkillFile{
				Path:  file.Name,
				Name:  filepath.Base(file.Name),
				Size:  info.Size(),
				IsDir: false,
			})
		}

		// Extract SKILL.md content if found
		if filepath.Base(file.Name) == "SKILL.md" && !info.IsDir() {
			rc, err := file.Open()
			if err == nil {
				content, err := io.ReadAll(rc)
				rc.Close()
				if err == nil {
					skillMdContent = string(content)
				}
			}
		}
	}

	return files, skillMdContent, nil
}
