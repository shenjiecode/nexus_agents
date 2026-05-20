package handler

import (
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
	"go.uber.org/zap"

	"github.com/nexus-agents/backend/internal/service"
)

// wsUpgrader is the WebSocket upgrader for debug connections.
var wsUpgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	// Allow all origins for debug WebSocket (matching Node.js behavior)
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
}

// DebugWebSocket handles GET /api/roles/:id/debug/ws
// It upgrades the HTTP connection to WebSocket and proxies messages
// between the client and the container's pico channel.
func DebugWebSocket(c *gin.Context) {
	roleID := c.Param("id")
	if roleID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "Role ID is required",
		})
		return
	}

	// Get user from header or query param (WebSocket upgrade cannot always send custom headers)
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

	// Validate ownership
	role, errMsg, status := validateRoleOwnership(roleID, userID)
	if errMsg != "" {
		c.JSON(status, gin.H{
			"success": false,
			"error":   errMsg,
		})
		return
	}

	// Find active debug session for this role
	workspaceID := debugMgr.findByRole(roleID)
	if workspaceID == "" {
		c.JSON(http.StatusNotFound, gin.H{
			"success": false,
			"error":   "No active debug session",
		})
		return
	}

	// Check container port
	if role.ContainerPort == 0 {
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"success": false,
			"error":   "Container not running",
		})
		return
	}

	// Upgrade to WebSocket
	clientConn, err := wsUpgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		getDebugLogger().Error("failed to upgrade WebSocket",
			zap.String("roleId", roleID),
			zap.Error(err),
		)
		return
	}
	defer clientConn.Close()

	getDebugLogger().Info("debug WebSocket client connected",
		zap.String("roleId", roleID),
		zap.String("workspaceId", workspaceID),
		zap.String("userId", userID),
	)

	// Connect to container's pico channel
	containerURL := fmt.Sprintf("ws://localhost:%d/pico/ws", role.ContainerPort)

	// Read pico token from .security.yml for authentication
	picoToken, _ := service.GetPicoToken(userID, roleID)

	containerConn, err := dialContainer(containerURL, picoToken)
	if err != nil {
		getDebugLogger().Error("failed to connect to container WebSocket",
			zap.String("roleId", roleID),
			zap.String("containerUrl", containerURL),
			zap.Error(err),
		)
		writeWSClose(clientConn, websocket.CloseInternalServerErr, "Container connection error")
		return
	}
	defer containerConn.Close()

	getDebugLogger().Info("debug WebSocket proxy: connected to container",
		zap.String("roleId", roleID),
		zap.String("workspaceId", workspaceID),
		zap.String("containerUrl", containerURL),
	)

	// Bidirectional proxy
	done := make(chan struct{}, 2)

	// Client -> Container
	go proxyMessages("client->container", clientConn, containerConn, done)

	// Container -> Client
	go proxyMessages("container->client", containerConn, clientConn, done)

	// Wait for either direction to finish
	<-done

	getDebugLogger().Info("debug WebSocket proxy: session ended",
		zap.String("roleId", roleID),
		zap.String("workspaceId", workspaceID),
	)
}

// proxyMessages reads from src and writes to dst.
// On error or close, it signals the done channel and closes both connections.
func proxyMessages(direction string, src, dst *websocket.Conn, done chan<- struct{}) {
	for {
		messageType, msg, err := src.ReadMessage()
		if err != nil {
			// Normal close or error
			if !websocket.IsCloseError(err, websocket.CloseNormalClosure, websocket.CloseGoingAway) {
				getDebugLogger().Debug("WebSocket read error",
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
			getDebugLogger().Debug("WebSocket write error",
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

// dialContainer connects to the container's WebSocket with timeout.
func dialContainer(url, token string) (*websocket.Conn, error) {
	dialer := websocket.Dialer{
		HandshakeTimeout: 10 * time.Second,
	}
	// Prepare headers with Authorization if token is provided
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

// writeWSClose sends a close message to the WebSocket connection.
func writeWSClose(conn *websocket.Conn, closeCode int, reason string) {
	msg := websocket.FormatCloseMessage(closeCode, reason)
	if err := conn.WriteMessage(websocket.CloseMessage, msg); err != nil {
		getDebugLogger().Debug("failed to send WebSocket close", zap.Error(err))
	}
}

// DebugWebSocketURL is a non-WebSocket handler that returns the WebSocket URL
// for a role's debug session. Useful for clients to discover the endpoint.
// GET /api/roles/:id/debug/ws-url
func DebugWebSocketURL(c *gin.Context) {
	roleID := c.Param("id")
	portStr := c.Query("port")
	if portStr == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "port query parameter is required",
		})
		return
	}

	port, err := strconv.Atoi(portStr)
	if err != nil || port <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "invalid port number",
		})
		return
	}

	wsURL := fmt.Sprintf("ws://localhost:%d/pico/ws", port)
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"roleId": roleID,
			"url":    wsURL,
		},
	})
}
