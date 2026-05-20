package handler

import (
	"crypto/rand"
	"encoding/hex"
	"net/http"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"

	"github.com/nexus-agents/backend/internal/middleware"
	"github.com/nexus-agents/backend/internal/model"
	"github.com/nexus-agents/backend/internal/service"
)

// debugSession tracks an active debug session.
type debugSession struct {
	RoleID      string
	UserID      string
	WorkspaceID string
}

// debugManager manages in-memory debug session state with single-user-single-debug lock.
type debugManager struct {
	mu       sync.RWMutex
	sessions map[string]*debugSession // keyed by workspaceID
	byUser   map[string]string        // userID -> workspaceID
}

var debugMgr = &debugManager{
	sessions: make(map[string]*debugSession),
	byUser:   make(map[string]string),
}

// pool is the container pool used by debug handlers.
// Must be set via SetContainerPool before handlers are called.
var pool *service.ContainerPool

// logger for debug handlers.
var debugLogger *zap.Logger

// SetContainerPool sets the container pool instance for debug handlers.
func SetContainerPool(p *service.ContainerPool) {
	pool = p
}

// SetDebugLogger sets the logger for debug handlers.
func SetDebugLogger(l *zap.Logger) {
	debugLogger = l
}

// getDebugLogger returns the debug logger or a nop logger as fallback.
func getDebugLogger() *zap.Logger {
	if debugLogger != nil {
		return debugLogger
	}
	return zap.NewNop()
}

// getActiveDebug checks if a user has an active debug session.
// Returns the workspaceID if found, empty string otherwise.
func (dm *debugManager) getActiveDebug(userID string) string {
	dm.mu.RLock()
	defer dm.mu.RUnlock()
	return dm.byUser[userID]
}

// findByRole finds the debug session for a given role.
// Returns the workspaceID if found, empty string otherwise.
func (dm *debugManager) findByRole(roleID string) string {
	dm.mu.RLock()
	defer dm.mu.RUnlock()
	for wsID, s := range dm.sessions {
		if s.RoleID == roleID {
			return wsID
		}
	}
	return ""
}

// findByRoleDetailed finds the debug session for a given role.
// Returns workspaceID and whether it was found.
func (dm *debugManager) findByRoleDetailed(roleID string) (string, bool) {
	dm.mu.RLock()
	defer dm.mu.RUnlock()
	for wsID, s := range dm.sessions {
		if s.RoleID == roleID {
			return wsID, true
		}
	}
	return "", false
}

// set stores a new debug session.
func (dm *debugManager) set(workspaceID, roleID, userID string) {
	dm.mu.Lock()
	defer dm.mu.Unlock()
	dm.sessions[workspaceID] = &debugSession{
		RoleID:      roleID,
		UserID:      userID,
		WorkspaceID: workspaceID,
	}
	dm.byUser[userID] = workspaceID
}

// clear removes a debug session by workspaceID.
func (dm *debugManager) clear(workspaceID string) {
	dm.mu.Lock()
	defer dm.mu.Unlock()
	s, ok := dm.sessions[workspaceID]
	if ok {
		delete(dm.byUser, s.UserID)
		delete(dm.sessions, workspaceID)
		getDebugLogger().Info("debug session cleared",
			zap.String("workspaceId", workspaceID),
			zap.String("roleId", s.RoleID),
		)
	}
}

// validateRoleOwnership validates that a role exists and belongs to the user.
func validateRoleOwnership(roleID, userID string) (*model.Role, string, int) {
	db := model.GetDB()

	var role model.Role
	result := db.First(&role, "id = ?", roleID)
	if result.Error != nil {
		return nil, "Role not found", http.StatusNotFound
	}

	if role.UserID != userID {
		return nil, "Only the role owner can debug", http.StatusForbidden
	}

	return &role, "", 0
}

// StartDebug handles POST /api/roles/:id/debug/start
func StartDebug(c *gin.Context) {
	user := middleware.GetUser(c)
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"error":   "Unauthorized",
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

	// Validate ownership
	role, errMsg, status := validateRoleOwnership(roleID, user.ID)
	if errMsg != "" {
		c.JSON(status, gin.H{
			"success": false,
			"error":   errMsg,
		})
		return
	}

	// Check for existing debug session (single-user-single-debug lock)
	existingWorkspace := debugMgr.getActiveDebug(user.ID)
	if existingWorkspace != "" {
		c.JSON(http.StatusConflict, gin.H{
			"success": false,
			"error":   "You already have an active debug session",
		})
		return
	}

	// Generate workspace ID (matching Node.js format: role_debug_<hex>)
	workspaceBytes := make([]byte, 8)
	if _, err := rand.Read(workspaceBytes); err != nil {
		getDebugLogger().Error("failed to generate workspace ID", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to start debug session",
		})
		return
	}
	workspaceID := "role_debug_" + hex.EncodeToString(workspaceBytes)

	getDebugLogger().Info("starting debug session",
		zap.String("roleId", roleID),
		zap.String("userId", user.ID),
		zap.String("workspaceId", workspaceID),
	)

	// Determine variant
	variant := role.Variant
	if variant == "" {
		variant = "full"
	}

	// Get role directory path for mounting
	roleDir := service.GetRoleDir(user.ID, roleID)

	// Allocate container via pool
	if pool == nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Container pool not initialized",
		})
		return
	}

	info, err := pool.AllocateContainer(c.Request.Context(), roleID, roleDir, variant)
	if err != nil {
		getDebugLogger().Error("failed to allocate container",
			zap.String("roleId", roleID),
			zap.Error(err),
		)
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "Failed to start debug session",
		})
		return
	}

	// Store debug session
	debugMgr.set(workspaceID, roleID, user.ID)

	// Update role with container info
	db := model.GetDB()
	now := time.Now().UnixMilli()
	db.Model(&model.Role{}).Where("id = ?", roleID).Updates(map[string]interface{}{
		"container_id":   info.ContainerID,
		"container_port": info.Port,
		"status":         "debugging",
		"updated_at":     time.UnixMilli(now),
	})

	c.JSON(http.StatusCreated, gin.H{
		"success": true,
		"data": gin.H{
			"workspaceId": workspaceID,
			"roleId":      roleID,
			"containerId": info.ContainerID,
			"port":        info.Port,
			"url":         info.URL,
			"status":      "debugging",
		},
	})
}

// StopDebug handles POST /api/roles/:id/debug/stop
func StopDebug(c *gin.Context) {
	user := middleware.GetUser(c)
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"error":   "Unauthorized",
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

	// Validate ownership
	role, errMsg, status := validateRoleOwnership(roleID, user.ID)
	if errMsg != "" {
		c.JSON(status, gin.H{
			"success": false,
			"error":   errMsg,
		})
		return
	}

	// Find the debug session for this role
	workspaceID, found := debugMgr.findByRoleDetailed(roleID)
	if !found {
		c.JSON(http.StatusNotFound, gin.H{
			"success": false,
			"error":   "No active debug session for this role",
		})
		return
	}

	getDebugLogger().Info("stopping debug session",
		zap.String("roleId", roleID),
		zap.String("userId", user.ID),
		zap.String("workspaceId", workspaceID),
	)

	// Stop and remove container
	if role.ContainerID != "" && pool != nil {
		if err := pool.StopContainer(c.Request.Context(), role.ContainerID); err != nil {
			getDebugLogger().Warn("error stopping container",
				zap.String("containerId", role.ContainerID),
				zap.Error(err),
			)
		}
		if err := pool.RemoveContainer(c.Request.Context(), role.ContainerID); err != nil {
			getDebugLogger().Warn("error removing container",
				zap.String("containerId", role.ContainerID),
				zap.Error(err),
			)
		}
	}

	// Clear debug session
	debugMgr.clear(workspaceID)

	// Update role status
	db := model.GetDB()
	now := time.Now().UnixMilli()
	db.Model(&model.Role{}).Where("id = ?", roleID).Updates(map[string]interface{}{
		"status":         "stopped",
		"container_id":   nil,
		"container_port": nil,
		"updated_at":     time.UnixMilli(now),
	})

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"roleId":  roleID,
			"status":  "stopped",
			"message": "Debug session stopped successfully",
		},
	})
}

// DebugStatus handles GET /api/roles/:id/debug/status
func DebugStatus(c *gin.Context) {
	user := middleware.GetUser(c)
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"error":   "Unauthorized",
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

	// Validate ownership
	role, errMsg, status := validateRoleOwnership(roleID, user.ID)
	if errMsg != "" {
		c.JSON(status, gin.H{
			"success": false,
			"error":   errMsg,
		})
		return
	}

	// Find debug session info
	workspaceID, debugActive := debugMgr.findByRoleDetailed(roleID)

	// Get current container status if running
	containerStatus := "stopped"
	if role.ContainerID != "" && pool != nil {
		info, err := pool.GetContainerStatus(c.Request.Context(), role.ContainerID)
		if err == nil && info != nil {
			if info.Status == service.StatusRunning {
				containerStatus = "running"
			}
		}
	}

	roleStatus := role.Status
	if roleStatus == "" {
		roleStatus = "stopped"
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"roleId":         roleID,
			"debugActive":    debugActive,
			"workspaceId":    workspaceID,
			"containerId":    role.ContainerID,
			"containerPort":  role.ContainerPort,
			"status":         roleStatus,
			"containerStatus": containerStatus,
		},
	})
}
