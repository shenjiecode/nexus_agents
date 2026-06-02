package handler

import (
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/gorilla/websocket"
	"go.uber.org/zap"

	"github.com/nexus-agents/backend/internal/middleware"
	"github.com/nexus-agents/backend/internal/model"
	"github.com/nexus-agents/backend/internal/service"
)

// containerLogger is the logger for container handlers.
var containerLogger *zap.Logger

// matrixService is the Matrix provisioning service.
var matrixService *MatrixProvisioner

// containerOSSService is the OSS service for importing roles.
var containerOSSService *service.OSSService

// SetContainerOSSService sets the OSS service for container handlers.
func SetContainerOSSService(s *service.OSSService) {
	containerOSSService = s
}

// MatrixProvisioner wraps Matrix account provisioning for container handlers.
type MatrixProvisioner struct {
	creds service.MatrixCredentials
}

// NewMatrixProvisioner creates a new MatrixProvisioner.
func NewMatrixProvisioner(creds service.MatrixCredentials) *MatrixProvisioner {
	return &MatrixProvisioner{creds: creds}
}

// ProvisionAccount provisions a new Matrix account.
func (p *MatrixProvisioner) ProvisionAccount(username, password string) (*service.MatrixAccount, error) {
	return service.ProvisionMatrixAccount(p.creds, username, password)
}

// SetMatrixService sets the Matrix provisioning service.
func SetMatrixService(svc *MatrixProvisioner) {
	matrixService = svc
}

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

	// Validate roleId if provided and get role info for OSS download
	var roleToImport *model.Role
	if req.RoleID != nil && *req.RoleID != "" {
		db := model.GetDB()
		var role model.Role
		if err := db.First(&role, "id = ?", *req.RoleID).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{
				"success": false,
				"error":   "Role not found",
			})
			return
		}
		// Allow importing own roles or public roles from marketplace
		if role.UserID != user.ID && role.IsPublic != "true" {
			c.JSON(http.StatusForbidden, gin.H{
				"success": false,
				"error":   "Forbidden: you can only import your own roles or public roles",
			})
			return
		}
		roleToImport = &role
	}

	// Generate container ID upfront
	containerUUID := uuid.New().String()
	dockerContainerName := fmt.Sprintf("nexus-%s", containerUUID[:8])

	// Container has its own workspace directory
	containerWorkspaceDir := service.ContainerSecurityDir(user.ID, containerUUID)

	// Setup container directory with config files
	if roleToImport != nil {
		// Check if role is uploaded to OSS
		if roleToImport.UploadedAt != nil && containerOSSService != nil && containerOSSService.IsConfigured() {
			// Import from OSS (single source of truth for uploaded roles)
			ossPath := fmt.Sprintf("roles/%s/%s/package.zip", roleToImport.UserID, roleToImport.ID)
			zipData, err := containerOSSService.DownloadFile(ossPath)
			if err != nil {
				getContainerLogger().Error("failed to download role package from OSS",
					zap.String("roleId", roleToImport.ID),
					zap.String("ossPath", ossPath),
					zap.Error(err),
				)
				c.JSON(http.StatusInternalServerError, gin.H{
					"success": false,
					"error":   "Failed to import role: package not found on OSS",
				})
				return
			}
			// Extract zip to container workspace
			if err := service.ExtractZipToDir(zipData, containerWorkspaceDir); err != nil {
				getContainerLogger().Error("failed to extract role package",
					zap.String("containerUUID", containerUUID),
					zap.Error(err),
				)
				c.JSON(http.StatusInternalServerError, gin.H{
					"success": false,
					"error":   "Failed to extract role package",
				})
				return
			}
		} else {
			// Fallback: copy from local filesystem (for roles not yet uploaded to OSS)
			roleDir := service.GetRoleDir(roleToImport.UserID, roleToImport.ID)
			if _, err := os.Stat(roleDir); os.IsNotExist(err) {
				getContainerLogger().Error("role directory not found",
					zap.String("roleId", roleToImport.ID),
					zap.String("roleDir", roleDir),
				)
				c.JSON(http.StatusNotFound, gin.H{
					"success": false,
					"error":   "Role directory not found",
				})
				return
			}
			// Copy role directory to container workspace
			if err := copyDirectory(roleDir, containerWorkspaceDir); err != nil {
				getContainerLogger().Error("failed to copy role directory",
					zap.String("roleId", roleToImport.ID),
					zap.String("roleDir", roleDir),
					zap.String("containerDir", containerWorkspaceDir),
					zap.Error(err),
				)
				c.JSON(http.StatusInternalServerError, gin.H{
					"success": false,
					"error":   "Failed to copy role directory",
				})
				return
			}
		}
		// After import, container is independent - no need to record roleId
		req.RoleID = nil
	}

	// Ensure container has complete config (fills in missing files if copy was partial)
	if err := service.CreateContainerDir(user.ID, containerUUID); err != nil {
		getContainerLogger().Warn("failed to create default container config",
			zap.String("containerUUID", containerUUID),
			zap.Error(err),
		)
	}

	// Always update pico token so container gets a unique token (different from role)
	if err := service.UpdateContainerPicoToken(user.ID, containerUUID); err != nil {
		getContainerLogger().Warn("failed to update container pico token",
			zap.String("containerUUID", containerUUID),
			zap.Error(err),
		)
	}

	// Allocate container via pool
	if pool == nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Container pool not initialized",
		})
		return
	}

	// Use the dockerContainerName generated above
	info, err := pool.AllocateUserContainer(c.Request.Context(), user.ID, dockerContainerName, containerWorkspaceDir, variant)
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
		ID:          containerUUID, // Use the same UUID for directory
		UserID:      user.ID,
		Name:        req.Name,
		Description: req.Description,
		Variant:     variant,
		ContainerID: info.ContainerID,
		Port:        info.Port,
		SSHPort:     info.SSHPort,
		Status:      "running",
		Image:       info.Image,
	}

	// Provision Matrix account if configured
	if matrixService != nil {
		mxUsername := service.GenerateContainerMatrixUsername(containerUUID)
		mxPassword, _ := service.GenerateContainerMatrixPassword()
		getContainerLogger().Info("attempting to provision matrix account",
			zap.String("containerId", containerUUID),
			zap.String("mxUsername", mxUsername),
			zap.Bool("hasPassword", mxPassword != ""),
		)
		if mxPassword != "" {
			acct, err := matrixService.ProvisionAccount(mxUsername, mxPassword)
			if err != nil {
				getContainerLogger().Warn("failed to provision matrix account, skipping",
					zap.String("containerId", containerUUID),
					zap.Error(err),
				)
			} else {
				getContainerLogger().Info("matrix account provisioned",
					zap.String("containerId", containerUUID),
					zap.String("matrixUserId", acct.UserID),
				)
				container.MatrixHomeserver = acct.Homeserver
				container.MatrixUserID = acct.UserID
				container.MatrixPassword = acct.Password
				container.MatrixAccessToken = acct.AccessToken

				// Inject matrix channel into container's config.json
				containerDir := service.ContainerSecurityDir(user.ID, containerUUID)
				if err := service.InjectMatrixChannel(containerDir, acct); err != nil {
					getContainerLogger().Warn("failed to inject matrix channel into config",
						zap.String("containerId", containerUUID),
						zap.Error(err),
					)
				}
			}
		}
	} else {
		getContainerLogger().Warn("matrixService is nil, skipping matrix provisioning",
			zap.String("containerId", containerUUID),
		)
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

	// Fix permissions on container directory (container runs as root)
	containerDir := service.ContainerSecurityDir(user.ID, containerUUID)
	if err := fixContainerPermissions(containerDir); err != nil {
		getContainerLogger().Warn("failed to fix container permissions",
			zap.String("dir", containerDir),
			zap.Error(err),
		)
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
			"containerId": container.ContainerID,
			"port":        container.Port,
			"sshPort":     container.SSHPort,
			"status":      container.Status,
			"image":       container.Image,
			"createdAt":   container.CreatedAt,
			"matrixUserId": container.MatrixUserID,
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
			"error":   "Docker 容器已不存在，请删除并重新创建容器",
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

// ContainerDebugWebSocket handles GET /api/containers/:id/debug/ws
// It upgrades the HTTP connection to WebSocket and proxies messages
// between the client and the container's pico channel.
func ContainerDebugWebSocket(c *gin.Context) {
	containerID := c.Param("id")
	if containerID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Container ID is required",
		})
		return
	}

	// Get user from header or query param
	userID := c.GetHeader("X-User-Id")
	if userID == "" {
		userID = c.Query("userId")
	}
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"error":   "Unauthorized",
		})
		return
	}

	// Find container and validate ownership
	db := model.GetDB()
	var container model.Container
	if err := db.First(&container, "id = ?", containerID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"success": false,
			"error":   "Container not found",
		})
		return
	}

	if container.UserID != userID {
		c.JSON(http.StatusForbidden, gin.H{
			"success": false,
			"error":   "Only the container owner can debug it",
		})
		return
	}

	// Check container is running
	if container.Status != "running" || container.Port == 0 {
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"success": false,
			"error":   "Container is not running",
		})
		return
	}

	// Upgrade to WebSocket
	clientConn, err := wsUpgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		getContainerLogger().Error("failed to upgrade WebSocket",
			zap.String("containerId", containerID),
			zap.Error(err),
		)
		return
	}
	defer clientConn.Close()

	getContainerLogger().Info("container debug WebSocket client connected",
		zap.String("containerId", containerID),
		zap.String("userId", userID),
		zap.Int("port", container.Port),
	)

	// Connect to container's pico channel
	containerURL := fmt.Sprintf("ws://localhost:%d/pico/ws", container.Port)

	// Get pico token from the container's own directory (not the role directory)
	var picoToken string
	token, err := service.GetContainerPicoToken(userID, containerID)
	if err != nil {
		getContainerLogger().Warn("failed to get container pico token, trying without",
			zap.String("containerId", containerID),
			zap.Error(err),
		)
	} else {
		picoToken = token
	}

	containerConn, err := dialContainerWebSocket(containerURL, picoToken)
	if err != nil {
		getContainerLogger().Error("failed to connect to container WebSocket",
			zap.String("containerId", containerID),
			zap.String("containerUrl", containerURL),
			zap.Error(err),
		)
		writeWSCloseMsg(clientConn, websocket.CloseInternalServerErr, "Container connection error")
		return
	}
	defer containerConn.Close()

	getContainerLogger().Info("container debug WebSocket proxy: connected to container",
		zap.String("containerId", containerID),
		zap.String("containerUrl", containerURL),
	)

	// Bidirectional proxy
	done := make(chan struct{}, 2)

	// Client -> Container
	go proxyWebSocketMessages("client->container", clientConn, containerConn, done)

	// Container -> Client
	go proxyWebSocketMessages("container->client", containerConn, clientConn, done)

	// Keepalive: send pings to container every 25s to prevent 60s read_timeout disconnect
	go func() {
		ticker := time.NewTicker(25 * time.Second)
		defer ticker.Stop()
		for {
			select {
			case <-ticker.C:
				if err := containerConn.WriteControl(websocket.PingMessage, []byte{}, time.Now().Add(5*time.Second)); err != nil {
					return
				}
			case <-done:
				return
			}
		}
	}()

	// Wait for either direction to finish
	<-done

	getContainerLogger().Info("container debug WebSocket proxy: session ended",
		zap.String("containerId", containerID),
	)
}

// GetContainerDebugStatus handles GET /api/containers/:id/debug/status
func GetContainerDebugStatus(c *gin.Context) {
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

	// Find container and validate ownership
	db := model.GetDB()
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
			"error":   "Only the container owner can view debug status",
		})
		return
	}

	// Get real-time container status from Docker
	containerStatus := container.Status
	if pool != nil && container.ContainerID != "" {
		info, err := pool.GetContainerStatus(c.Request.Context(), container.ContainerID)
		if err == nil && info != nil {
			containerStatus = string(info.Status)
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"id":              container.ID,
			"name":            container.Name,
			"containerId":     container.ContainerID,
			"containerPort":   container.Port,
			"containerStatus": containerStatus,
			"debugActive":     containerStatus == "running",
		},
	})
}

// dialContainerWebSocket connects to the container's WebSocket with timeout.
func dialContainerWebSocket(url, token string) (*websocket.Conn, error) {
	dialer := websocket.Dialer{
		HandshakeTimeout: 10 * time.Second,
	}
	headers := http.Header{}
	if token != "" {
		headers.Set("Authorization", "Bearer "+token)
	}
	conn, _, err := dialer.Dial(url, headers)
	if err != nil {
		return nil, fmt.Errorf("dial container WebSocket: %w", err)
	}
	return conn, nil
}

// proxyWebSocketMessages reads from src and writes to dst.
func proxyWebSocketMessages(direction string, src, dst *websocket.Conn, done chan<- struct{}) {
	for {
		messageType, msg, err := src.ReadMessage()
		if err != nil {
			if !websocket.IsCloseError(err, websocket.CloseNormalClosure, websocket.CloseGoingAway) {
				getContainerLogger().Debug("WebSocket read error",
					zap.String("direction", direction),
					zap.Error(err),
				)
			}
			select {
			case done <- struct{}{}:
			default:
			}
			return
		}

		if err := dst.WriteMessage(messageType, msg); err != nil {
			getContainerLogger().Debug("WebSocket write error",
				zap.String("direction", direction),
				zap.Error(err),
			)
			select {
			case done <- struct{}{}:
			default:
			}
			return
		}
	}
}

// writeWSCloseMsg sends a close message to the WebSocket connection.
func writeWSCloseMsg(conn *websocket.Conn, closeCode int, reason string) {
	msg := websocket.FormatCloseMessage(closeCode, reason)
	if err := conn.WriteMessage(websocket.CloseMessage, msg); err != nil {
		getContainerLogger().Debug("failed to send WebSocket close", zap.Error(err))
	}
}

// GetContainer handles GET /api/containers/:id
func GetContainer(c *gin.Context) {
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
			"error":   "Only the container owner can view it",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"id":              container.ID,
			"userId":          container.UserID,
			"name":            container.Name,
			"description":     container.Description,
			"variant":         container.Variant,
			"containerId":     container.ContainerID,
			"port":            container.Port,
			"sshPort":         container.SSHPort,
			"status":          container.Status,
			"image":           container.Image,
			"matrixUserId":    container.MatrixUserID,
			"matrixHomeserver": container.MatrixHomeserver,
			"createdAt":       container.CreatedAt,
			"updatedAt":       container.UpdatedAt,
		},
	})
}

// --- Container File APIs ---

// GetContainerFiles handles GET /api/containers/:id/files
func GetContainerFiles(c *gin.Context) {
	listEntityFiles(resolveContainer)(c)
}

// GetContainerFileContent handles GET /api/containers/:id/files/*path
func GetContainerFileContent(c *gin.Context) {
	getEntityFileContent(resolveContainer)(c)
}

// SaveContainerFileContent handles PUT /api/containers/:id/files/*path
func SaveContainerFileContent(c *gin.Context) {
	saveEntityFileContent(resolveContainer)(c)
}

// ContainerFileIndexQuery holds query parameters for file index search
type ContainerFileIndexQuery struct {
	Status   string `form:"status"`
	Type     string `form:"type"`
	Tag      string `form:"tag"`
	Search   string `form:"search"`
	Page     int    `form:"page"`
	PageSize int    `form:"pageSize"`
	SortBy   string `form:"sortBy"`
	SortDir  string `form:"sortDir"`
}

// runtimeDirs are directories created by the container at runtime (owned by root).
// They should NOT be copied when cloning a role config to a container.
var runtimeDirs = map[string]bool{
	"sessions": true,
	"state":    true,
	"cron":     true,
	"logs":     true,
}

// copyDirectory recursively copies a directory from src to dst.
// It is best-effort: individual file/dir copy failures are logged but do not abort the overall copy.
// Runtime directories (sessions, state, cron, logs) are skipped as the container creates them itself.
func copyDirectory(src, dst string) error {
	// Create destination directory with proper permissions
	if err := os.MkdirAll(dst, 0755); err != nil {
		return err
	}
	// Ensure directory is readable
	if err := os.Chmod(dst, 0755); err != nil {
		return err
	}

	// Read source directory
	entries, err := os.ReadDir(src)
	if err != nil {
		return err
	}

	for _, entry := range entries {
		// Skip runtime directories (owned by root, created by container at runtime)
		if entry.IsDir() && runtimeDirs[entry.Name()] {
			continue
		}

		srcPath := filepath.Join(src, entry.Name())
		dstPath := filepath.Join(dst, entry.Name())

		if entry.IsDir() {
			// Recursively copy subdirectory (best-effort)
			if err := copyDirectory(srcPath, dstPath); err != nil {
				continue
			}
		} else {
			// Copy file (skip on failure)
			if err := copyFile(srcPath, dstPath); err != nil {
				continue
			}
		}
	}
	return nil
}

// copyFile copies a single file from src to dst
func copyFile(src, dst string) error {
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

	_, err = io.Copy(dstFile, srcFile)
	if err != nil {
		return err
	}

	// Set readable permissions (644 for files)
	return os.Chmod(dst, 0644)
}

// fixContainerPermissions changes ownership and permissions of container directory
// so the host user can read/write files created by the container (which runs as root)
func fixContainerPermissions(dir string) error {
	// Run sudo chmod to fix permissions created by container (running as root)
	// Password can be provided via SUDO_PASSWORD environment variable
	cmd := exec.Command("sudo", "-S", "chmod", "-R", "a+rwX", dir)

	// Get password from environment if set
	sudoPassword := os.Getenv("SUDO_PASSWORD")
	if sudoPassword != "" {
		cmd.Stdin = strings.NewReader(sudoPassword + "\n")
	}

	if err := cmd.Run(); err != nil {
		return fmt.Errorf("chmod failed: %w", err)
	}
	return nil
}

// --- Container Skill/MCP APIs ---

// AddSkillToContainer handles POST /api/containers/:id/skills/:skillId
func AddSkillToContainer(c *gin.Context) {
	addSkillToEntity(resolveContainer)(c)
}

// RemoveSkillFromContainer handles DELETE /api/containers/:id/skills/:skillId
func RemoveSkillFromContainer(c *gin.Context) {
	removeSkillFromEntity(resolveContainer)(c)
}

// AddMCPToContainer handles POST /api/containers/:id/mcps/:mcpId
func AddMCPToContainer(c *gin.Context) {
	addMCPToEntity(resolveContainer)(c)
}

// RemoveMCPFromContainer handles DELETE /api/containers/:id/mcps/:mcpId
func RemoveMCPFromContainer(c *gin.Context) {
	removeMCPFromEntity(resolveContainer)(c)
}

// GetContainerFileIndex handles GET /api/containers/:id/file-index
// Returns the parsed file-index.json with search and pagination support.
func GetContainerFileIndex(c *gin.Context) {
	user := middleware.GetUser(c)
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"success": false, "error": "Unauthorized"})
		return
	}

	containerID := c.Param("id")

	// Validate ownership
	db := model.GetDB()
	var container model.Container
	if err := db.First(&container, "id = ?", containerID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"success": false, "error": "Container not found"})
		return
	}
	if container.UserID != user.ID {
		c.JSON(http.StatusForbidden, gin.H{"success": false, "error": "Forbidden"})
		return
	}

	// Parse query parameters
	var query ContainerFileIndexQuery
	if err := c.ShouldBindQuery(&query); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": "Invalid query parameters"})
		return
	}

	// Defaults
	if query.Page < 1 {
		query.Page = 1
	}
	if query.PageSize < 1 || query.PageSize > 100 {
		query.PageSize = 20
	}
	if query.SortBy == "" {
		query.SortBy = "created_at"
	}
	if query.SortDir == "" {
		query.SortDir = "desc"
	}

	// Read file-index.json
	containerDir := service.ContainerSecurityDir(user.ID, containerID)
	files, totalCount, err := service.ReadFileIndex(containerDir, query.Status, query.Type, query.Tag, query.Search, query.SortBy, query.SortDir, query.Page, query.PageSize)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"files":      files,
			"total":      totalCount,
			"page":       query.Page,
			"pageSize":   query.PageSize,
			"totalPages": (totalCount + query.PageSize - 1) / query.PageSize,
		},
	})
}

// GetContainerInstalledSkills handles GET /api/containers/:id/installed-skills
// Returns list of skill slugs installed in the container's workspace/skills/ directory.
func GetContainerInstalledSkills(c *gin.Context) {
	listInstalledSkills(resolveContainer)(c)
}

