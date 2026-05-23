package handler

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"

	"github.com/nexus-agents/backend/internal/middleware"
	"github.com/nexus-agents/backend/internal/model"
	"github.com/nexus-agents/backend/internal/service"
)

// containerLogger is the logger for container handlers.
var containerLogger *zap.Logger

// SetContainerLogger sets the logger for container handlers.
func SetContainerLogger(l *zap.Logger) {
	containerLogger = l
}

// getContainerLogger returns the container logger or a nop logger as fallback.
func getContainerLogger() *zap.Logger {
	if containerLogger != nil {
		return containerLogger
	}
	return zap.NewNop()
}

// containerPool is the container pool used by container handlers.
// Must be set via SetContainerPool before handlers are called (defined in debug.go).

// CreateContainer handles POST /api/containers
func CreateContainer(c *gin.Context) {
	user := middleware.GetUser(c)
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"error":   "Unauthorized",
		})
		return
	}

	var req struct {
		Name        string  `json:"name" binding:"required"`
		Description string  `json:"description"`
		Variant     string  `json:"variant"`
		RoleID      *string `json:"roleId"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Name is required",
		})
		return
	}

	// Set default variant
	variant := req.Variant
	if variant == "" {
		variant = "base"
	}

	db := model.GetDB()

	// Check quota: max 10 containers per user
	var containerCount int64
	if err := db.Model(&model.Container{}).Where("user_id = ?", user.ID).Count(&containerCount).Error; err != nil {
		getContainerLogger().Error("failed to count containers",
			zap.String("userId", user.ID),
			zap.Error(err),
		)
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to check container quota",
		})
		return
	}

	const maxContainersPerUser = 10
	if containerCount >= maxContainersPerUser {
		c.JSON(http.StatusForbidden, gin.H{
			"success": false,
			"error":   "Maximum number of containers (10) reached",
		})
		return
	}

	// Validate roleId if provided
	var roleDir string
	if req.RoleID != nil && *req.RoleID != "" {
		role, errMsg, status := validateRoleOwnership(*req.RoleID, user.ID)
		if errMsg != "" {
			c.JSON(status, gin.H{
				"success": false,
				"error":   errMsg,
			})
			return
		}
		_ = role
		roleDir = service.GetRoleDir(user.ID, *req.RoleID)
	}

	// Allocate container via pool
	if pool == nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Container pool not initialized",
		})
		return
	}

	containerName := req.Name
	if containerName == "" {
		containerName = "container-" + time.Now().Format("20060102150405")
	}

	info, err := pool.AllocateUserContainer(c.Request.Context(), user.ID, containerName, roleDir, variant)
	if err != nil {
		getContainerLogger().Error("failed to allocate container",
			zap.String("userId", user.ID),
			zap.String("name", req.Name),
			zap.Error(err),
		)
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to create container",
		})
		return
	}

	// Create container record in database
	container := &model.Container{
		UserID:      user.ID,
		Name:        req.Name,
		Description: req.Description,
		Variant:     variant,
		RoleID:      req.RoleID,
		ContainerID: info.ContainerID,
		Port:        info.Port,
		SSHPort:     info.SSHPort,
		Status:      "running",
		Image:       info.Image,
	}

	if err := db.Create(container).Error; err != nil {
		getContainerLogger().Error("failed to create container record",
			zap.String("userId", user.ID),
			zap.Error(err),
		)
		// Cleanup container on DB error
		_ = pool.StopContainer(c.Request.Context(), info.ContainerID)
		_ = pool.RemoveContainer(c.Request.Context(), info.ContainerID)
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to create container record",
		})
		return
	}

	getContainerLogger().Info("container created",
		zap.String("containerId", container.ID),
		zap.String("userId", user.ID),
		zap.String("dockerContainerId", info.ContainerID),
	)

	c.JSON(http.StatusCreated, gin.H{
		"success": true,
		"data": gin.H{
			"id":          container.ID,
			"name":        container.Name,
			"description": container.Description,
			"variant":     container.Variant,
			"roleId":      container.RoleID,
			"containerId": container.ContainerID,
			"port":        container.Port,
			"sshPort":     container.SSHPort,
			"status":      container.Status,
			"image":       container.Image,
			"createdAt":   container.CreatedAt,
		},
	})
}

// ListContainers handles GET /api/containers
func ListContainers(c *gin.Context) {
	user := middleware.GetUser(c)
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"error":   "Unauthorized",
		})
		return
	}

	db := model.GetDB()

	var containers []model.Container
	if err := db.Where("user_id = ?", user.ID).Find(&containers).Error; err != nil {
		getContainerLogger().Error("failed to list containers",
			zap.String("userId", user.ID),
			zap.Error(err),
		)
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to list containers",
		})
		return
	}

	// Get real-time status from pool if available
	results := make([]gin.H, 0, len(containers))
	for _, container := range containers {
		containerStatus := container.Status
		if pool != nil && container.ContainerID != "" {
			info, err := pool.GetContainerStatus(c.Request.Context(), container.ContainerID)
			if err == nil && info != nil {
				if info.Status == service.StatusRunning {
					containerStatus = "running"
				} else {
					containerStatus = "stopped"
				}
			}
		}

		results = append(results, gin.H{
			"id":          container.ID,
			"name":        container.Name,
			"description": container.Description,
			"variant":     container.Variant,
			"roleId":      container.RoleID,
			"containerId": container.ContainerID,
			"port":        container.Port,
			"sshPort":     container.SSHPort,
			"status":      containerStatus,
			"image":       container.Image,
			"createdAt":   container.CreatedAt,
			"updatedAt":   container.UpdatedAt,
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    results,
	})
}

// StartContainer handles POST /api/containers/:id/start
func StartContainer(c *gin.Context) {
	user := middleware.GetUser(c)
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"error":   "Unauthorized",
		})
		return
	}

	containerID := c.Param("id")
	if containerID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Container ID is required",
		})
		return
	}

	db := model.GetDB()

	// Find container and validate ownership
	var container model.Container
	if err := db.First(&container, "id = ?", containerID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"success": false,
			"error":   "Container not found",
		})
		return
	}

	if container.UserID != user.ID {
		c.JSON(http.StatusForbidden, gin.H{
			"success": false,
			"error":   "Only the container owner can start it",
		})
		return
	}

	// Start container via pool
	if pool == nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Container pool not initialized",
		})
		return
	}

	if err := pool.StartContainer(c.Request.Context(), container.ContainerID); err != nil {
		getContainerLogger().Error("failed to start container",
			zap.String("containerId", containerID),
			zap.String("dockerContainerId", container.ContainerID),
			zap.Error(err),
		)
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to start container",
		})
		return
	}

	// Update status in database
	now := time.Now().UnixMilli()
	db.Model(&model.Container{}).Where("id = ?", containerID).Updates(map[string]interface{}{
		"status":     "running",
		"updated_at": time.UnixMilli(now),
	})

	getContainerLogger().Info("container started",
		zap.String("containerId", containerID),
		zap.String("userId", user.ID),
	)

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"id":     containerID,
			"status": "running",
		},
	})
}

// StopContainer handles POST /api/containers/:id/stop
func StopContainer(c *gin.Context) {
	user := middleware.GetUser(c)
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"error":   "Unauthorized",
		})
		return
	}

	containerID := c.Param("id")
	if containerID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Container ID is required",
		})
		return
	}

	db := model.GetDB()

	// Find container and validate ownership
	var container model.Container
	if err := db.First(&container, "id = ?", containerID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"success": false,
			"error":   "Container not found",
		})
		return
	}

	if container.UserID != user.ID {
		c.JSON(http.StatusForbidden, gin.H{
			"success": false,
			"error":   "Only the container owner can stop it",
		})
		return
	}

	// Stop container via pool
	if pool == nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Container pool not initialized",
		})
		return
	}

	if err := pool.StopContainer(c.Request.Context(), container.ContainerID); err != nil {
		getContainerLogger().Warn("error stopping container, continuing",
			zap.String("containerId", containerID),
			zap.String("dockerContainerId", container.ContainerID),
			zap.Error(err),
		)
	}

	// Update status in database
	now := time.Now().UnixMilli()
	db.Model(&model.Container{}).Where("id = ?", containerID).Updates(map[string]interface{}{
		"status":     "stopped",
		"updated_at": time.UnixMilli(now),
	})

	getContainerLogger().Info("container stopped",
		zap.String("containerId", containerID),
		zap.String("userId", user.ID),
	)

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"id":     containerID,
			"status": "stopped",
		},
	})
}

// DeleteContainer handles DELETE /api/containers/:id
func DeleteContainer(c *gin.Context) {
	user := middleware.GetUser(c)
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"error":   "Unauthorized",
		})
		return
	}

	containerID := c.Param("id")
	if containerID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Container ID is required",
		})
		return
	}

	db := model.GetDB()

	// Find container and validate ownership
	var container model.Container
	if err := db.First(&container, "id = ?", containerID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"success": false,
			"error":   "Container not found",
		})
		return
	}

	if container.UserID != user.ID {
		c.JSON(http.StatusForbidden, gin.H{
			"success": false,
			"error":   "Only the container owner can delete it",
		})
		return
	}

	// Stop and remove container via pool
	if pool != nil && container.ContainerID != "" {
		if err := pool.StopContainer(c.Request.Context(), container.ContainerID); err != nil {
			getContainerLogger().Warn("error stopping container during delete",
				zap.String("containerId", containerID),
				zap.String("dockerContainerId", container.ContainerID),
				zap.Error(err),
			)
		}
		if err := pool.RemoveContainer(c.Request.Context(), container.ContainerID); err != nil {
			getContainerLogger().Warn("error removing container during delete",
				zap.String("containerId", containerID),
				zap.String("dockerContainerId", container.ContainerID),
				zap.Error(err),
			)
		}
	}

	// Delete container record
	if err := db.Delete(&container).Error; err != nil {
		getContainerLogger().Error("failed to delete container record",
			zap.String("containerId", containerID),
			zap.Error(err),
		)
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to delete container record",
		})
		return
	}

	getContainerLogger().Info("container deleted",
		zap.String("containerId", containerID),
		zap.String("userId", user.ID),
	)

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"id":      containerID,
			"message": "Container deleted successfully",
		},
	})
}
