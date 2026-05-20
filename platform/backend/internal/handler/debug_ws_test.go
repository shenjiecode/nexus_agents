package handler

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"

	"github.com/nexus-agents/backend/internal/model"
	"github.com/nexus-agents/backend/internal/service"
	"gorm.io/gorm"
)

// --- WebSocket Test Helpers ---

// setupWSTest initializes test DB, container pool, and debug manager for WS tests.
func setupWSTest(t *testing.T) (*gorm.DB, *service.ContainerPool) {
	t.Helper()
	return setupDebugTest(t)
}

// createWSTestRole creates a role with a container port set (simulating active debug).
func createWSTestRole(t *testing.T, db *gorm.DB, id, userID string, port int) *model.Role {
	t.Helper()
	role := model.Role{
		ID:            id,
		UserID:        userID,
		Name:          "Test Role",
		Variant:       "full",
		Status:        "debugging",
		ContainerPort: port,
		ContainerID:   "container-" + id,
		IsPublic:      "false",
	}
	if err := db.Create(&role).Error; err != nil {
		t.Fatalf("failed to create test role: %v", err)
	}
	return &role
}

// startWSEchoServer starts a WebSocket echo server for testing proxy behavior.
// Returns the server URL and a shutdown function.
func startWSEchoServer(t *testing.T) (string, func()) {
	t.Helper()

	upgrader := websocket.Upgrader{CheckOrigin: func(r *http.Request) bool { return true }}

	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		conn, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			return
		}
		defer conn.Close()
		for {
			mt, msg, err := conn.ReadMessage()
			if err != nil {
				return
			}
			// Echo back with "echo:" prefix
			if err := conn.WriteMessage(mt, append([]byte("echo:"), msg...)); err != nil {
				return
			}
		}
	})

	server := httptest.NewServer(handler)
	return "ws" + strings.TrimPrefix(server.URL, "http"), server.Close
}



// --- HTTP-level Tests (no actual WebSocket upgrade) ---

func TestDebugWebSocket_MissingRoleID(t *testing.T) {
	setupWSTest(t)

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request, _ = http.NewRequest("GET", "/api/roles//debug/ws", nil)
	c.Params = gin.Params{} // No "id" param

	DebugWebSocket(c)

	if w.Code != http.StatusBadRequest {
		t.Errorf("Expected status 400, got %d", w.Code)
	}
	resp := parseResponse(t, w)
	if resp["error"] != "Role ID is required" {
		t.Errorf("Expected 'Role ID is required', got %v", resp["error"])
	}
}

func TestDebugWebSocket_Unauthorized(t *testing.T) {
	setupWSTest(t)

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request, _ = http.NewRequest("GET", "/api/roles/role-1/debug/ws", nil)
	c.Params = gin.Params{{Key: "id", Value: "role-1"}}
	// No X-User-Id header

	DebugWebSocket(c)

	if w.Code != http.StatusUnauthorized {
		t.Errorf("Expected status 401, got %d", w.Code)
	}
	resp := parseResponse(t, w)
	if resp["error"] != "Unauthorized" {
		t.Errorf("Expected 'Unauthorized', got %v", resp["error"])
	}
}

func TestDebugWebSocket_RoleNotFound(t *testing.T) {
	db, _ := setupWSTest(t)
	_ = db // DB setup but no role created

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request, _ = http.NewRequest("GET", "/api/roles/nonexistent/debug/ws", nil)
	c.Request.Header.Set("X-User-Id", "user-1")
	c.Params = gin.Params{{Key: "id", Value: "nonexistent"}}

	DebugWebSocket(c)

	if w.Code != http.StatusNotFound {
		t.Errorf("Expected status 404, got %d", w.Code)
	}
	resp := parseResponse(t, w)
	if resp["error"] != "Role not found" {
		t.Errorf("Expected 'Role not found', got %v", resp["error"])
	}
}

func TestDebugWebSocket_Forbidden(t *testing.T) {
	db, _ := setupWSTest(t)
	createWSTestRole(t, db, "role-1", "user-other", 4100)

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request, _ = http.NewRequest("GET", "/api/roles/role-1/debug/ws", nil)
	c.Request.Header.Set("X-User-Id", "user-1")
	c.Params = gin.Params{{Key: "id", Value: "role-1"}}

	DebugWebSocket(c)

	if w.Code != http.StatusForbidden {
		t.Errorf("Expected status 403, got %d", w.Code)
	}
	resp := parseResponse(t, w)
	if resp["error"] != "Only the role owner can debug" {
		t.Errorf("Expected 'Only the role owner can debug', got %v", resp["error"])
	}
}

func TestDebugWebSocket_NoActiveSession(t *testing.T) {
	db, _ := setupWSTest(t)
	// Create role but no active debug session
	createTestRole(t, db, "role-1", "user-1", "Test Role", "full")

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request, _ = http.NewRequest("GET", "/api/roles/role-1/debug/ws", nil)
	c.Request.Header.Set("X-User-Id", "user-1")
	c.Params = gin.Params{{Key: "id", Value: "role-1"}}

	DebugWebSocket(c)

	if w.Code != http.StatusNotFound {
		t.Errorf("Expected status 404, got %d", w.Code)
	}
	resp := parseResponse(t, w)
	if resp["error"] != "No active debug session" {
		t.Errorf("Expected 'No active debug session', got %v", resp["error"])
	}
}

func TestDebugWebSocket_ContainerNotRunning(t *testing.T) {
	db, _ := setupWSTest(t)
	// Create role with no container port
	role := createTestRole(t, db, "role-1", "user-1", "Test Role", "full")
	_ = role

	// Set up debug session but role has no port
	debugMgr.set("ws-test", "role-1", "user-1")

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request, _ = http.NewRequest("GET", "/api/roles/role-1/debug/ws", nil)
	c.Request.Header.Set("X-User-Id", "user-1")
	c.Params = gin.Params{{Key: "id", Value: "role-1"}}

	DebugWebSocket(c)

	if w.Code != http.StatusServiceUnavailable {
		t.Errorf("Expected status 503, got %d", w.Code)
	}
	resp := parseResponse(t, w)
	if resp["error"] != "Container not running" {
		t.Errorf("Expected 'Container not running', got %v", resp["error"])
	}

	// Cleanup
	debugMgr.clear("ws-test")
}

// --- WebSocket Integration Tests ---

func TestDebugWebSocket_SuccessProxy(t *testing.T) {
	db, _ := setupWSTest(t)

	// Start echo backend (simulates container pico WS)
	echoURL, echoShutdown := startWSEchoServer(t)
	defer echoShutdown()

	// Parse port from echo URL for role setup
	// echoURL is like ws://127.0.0.1:PORT/pico/ws (but httptest doesn't add path)
	// We just need the port
	portStr := echoURL[strings.LastIndex(echoURL, ":")+1:]
	var port int
	for _, c := range portStr {
		if c >= '0' && c <= '9' {
			port = port*10 + int(c-'0')
		} else {
			break
		}
	}

	// Create role with container port pointing to our echo server
	createWSTestRole(t, db, "role-1", "user-1", port)

	// Set up active debug session
	debugMgr.set("ws-test", "role-1", "user-1")
	defer debugMgr.clear("ws-test")

	// But wait - the echo server is at the root, not at /pico/ws.
	// The handler connects to ws://localhost:{port}/pico/ws which won't match our echo server.
	// We need to override dialContainer for testing. Instead, let's use a different approach:
	// Start a full echo server that handles /pico/ws path.

	// Actually, let's just create a custom test that patches dialContainer behavior.
	// Since we can't easily patch it, let's test with a proper httptest server that
	// serves on the /pico/ws path.

	// Create a proper container mock server
	containerUpgrader := websocket.Upgrader{CheckOrigin: func(r *http.Request) bool { return true }}
	containerMux := http.NewServeMux()
	containerMux.HandleFunc("/pico/ws", func(w http.ResponseWriter, r *http.Request) {
		conn, err := containerUpgrader.Upgrade(w, r, nil)
		if err != nil {
			return
		}
		defer conn.Close()
		for {
			mt, msg, err := conn.ReadMessage()
			if err != nil {
				return
			}
			if err := conn.WriteMessage(mt, append([]byte("echo:"), msg...)); err != nil {
				return
			}
		}
	})
	containerServer := httptest.NewServer(containerMux)
	defer containerServer.Close()

	// Get port from container server
	containerPortStr := containerServer.URL[strings.LastIndex(containerServer.URL, ":")+1:]
	var containerPort int
	for _, c := range containerPortStr {
		if c >= '0' && c <= '9' {
			containerPort = containerPort*10 + int(c-'0')
		} else {
			break
		}
	}

	// Update role with correct container port
	db.Model(&model.Role{}).Where("id = ?", "role-1").Update("container_port", containerPort)

	// Set up Gin test server
	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.Use(gin.Recovery())
	router.GET("/api/roles/:id/debug/ws", DebugWebSocket)

	proxyServer := httptest.NewServer(router)
	defer proxyServer.Close()

	// Connect as client
	proxyWSURL := "ws" + strings.TrimPrefix(proxyServer.URL, "http") + "/api/roles/role-1/debug/ws"
	header := http.Header{}
	header.Set("X-User-Id", "user-1")

	clientConn, _, err := websocket.DefaultDialer.Dial(proxyWSURL, header)
	if err != nil {
		t.Fatalf("failed to connect to proxy: %v", err)
	}
	defer clientConn.Close()

	// Send message through proxy
	testMsg := "hello from client"
	if err := clientConn.WriteMessage(websocket.TextMessage, []byte(testMsg)); err != nil {
		t.Fatalf("failed to send message: %v", err)
	}

	// Read echo response
	clientConn.SetReadDeadline(time.Now().Add(5 * time.Second))
	mt, msg, err := clientConn.ReadMessage()
	if err != nil {
		t.Fatalf("failed to read echo: %v", err)
	}

	if mt != websocket.TextMessage {
		t.Errorf("Expected TextMessage, got %d", mt)
	}

	expected := "echo:" + testMsg
	if string(msg) != expected {
		t.Errorf("Expected '%s', got '%s'", expected, string(msg))
	}
}

func TestDebugWebSocket_MultipleMessages(t *testing.T) {
	db, _ := setupWSTest(t)

	// Create container mock server
	containerUpgrader := websocket.Upgrader{CheckOrigin: func(r *http.Request) bool { return true }}
	containerMux := http.NewServeMux()
	containerMux.HandleFunc("/pico/ws", func(w http.ResponseWriter, r *http.Request) {
		conn, err := containerUpgrader.Upgrade(w, r, nil)
		if err != nil {
			return
		}
		defer conn.Close()
		for {
			mt, msg, err := conn.ReadMessage()
			if err != nil {
				return
			}
			if err := conn.WriteMessage(mt, append([]byte("pong:"), msg...)); err != nil {
				return
			}
		}
	})
	containerServer := httptest.NewServer(containerMux)
	defer containerServer.Close()

	containerPortStr := containerServer.URL[strings.LastIndex(containerServer.URL, ":")+1:]
	var containerPort int
	for _, c := range containerPortStr {
		if c >= '0' && c <= '9' {
			containerPort = containerPort*10 + int(c-'0')
		} else {
			break
		}
	}

	createWSTestRole(t, db, "role-1", "user-1", containerPort)
	debugMgr.set("ws-multi", "role-1", "user-1")
	defer debugMgr.clear("ws-multi")

	// Set up proxy server
	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.Use(gin.Recovery())
	router.GET("/api/roles/:id/debug/ws", DebugWebSocket)

	proxyServer := httptest.NewServer(router)
	defer proxyServer.Close()

	proxyWSURL := "ws" + strings.TrimPrefix(proxyServer.URL, "http") + "/api/roles/role-1/debug/ws"
	header := http.Header{}
	header.Set("X-User-Id", "user-1")

	clientConn, _, err := websocket.DefaultDialer.Dial(proxyWSURL, header)
	if err != nil {
		t.Fatalf("failed to connect: %v", err)
	}
	defer clientConn.Close()

	// Send multiple messages
	for i := 0; i < 5; i++ {
		msg := "msg-" + string(rune('0'+i))
		if err := clientConn.WriteMessage(websocket.TextMessage, []byte(msg)); err != nil {
			t.Fatalf("failed to send message %d: %v", i, err)
		}
	}

	// Read all responses
	clientConn.SetReadDeadline(time.Now().Add(5 * time.Second))
	for i := 0; i < 5; i++ {
		_, msg, err := clientConn.ReadMessage()
		if err != nil {
			t.Fatalf("failed to read message %d: %v", i, err)
		}
		expected := "pong:msg-" + string(rune('0'+i))
		if string(msg) != expected {
			t.Errorf("Message %d: expected '%s', got '%s'", i, expected, string(msg))
		}
	}
}

func TestDebugWebSocket_ClientDisconnect(t *testing.T) {
	db, _ := setupWSTest(t)

	containerUpgrader := websocket.Upgrader{CheckOrigin: func(r *http.Request) bool { return true }}
	containerMux := http.NewServeMux()
	containerMux.HandleFunc("/pico/ws", func(w http.ResponseWriter, r *http.Request) {
		conn, err := containerUpgrader.Upgrade(w, r, nil)
		if err != nil {
			return
		}
		defer conn.Close()
		for {
			_, _, err := conn.ReadMessage()
			if err != nil {
				return
			}
		}
	})
	containerServer := httptest.NewServer(containerMux)
	defer containerServer.Close()

	containerPortStr := containerServer.URL[strings.LastIndex(containerServer.URL, ":")+1:]
	var containerPort int
	for _, c := range containerPortStr {
		if c >= '0' && c <= '9' {
			containerPort = containerPort*10 + int(c-'0')
		} else {
			break
		}
	}

	createWSTestRole(t, db, "role-1", "user-1", containerPort)
	debugMgr.set("ws-disco", "role-1", "user-1")
	defer debugMgr.clear("ws-disco")

	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.Use(gin.Recovery())
	router.GET("/api/roles/:id/debug/ws", DebugWebSocket)

	proxyServer := httptest.NewServer(router)
	defer proxyServer.Close()

	proxyWSURL := "ws" + strings.TrimPrefix(proxyServer.URL, "http") + "/api/roles/role-1/debug/ws"
	header := http.Header{}
	header.Set("X-User-Id", "user-1")

	clientConn, _, err := websocket.DefaultDialer.Dial(proxyWSURL, header)
	if err != nil {
		t.Fatalf("failed to connect: %v", err)
	}

	// Close client connection - should not panic
	clientConn.Close()

	// Give time for goroutines to clean up
	time.Sleep(100 * time.Millisecond)
}

func TestDebugWebSocket_ContainerUnavailable(t *testing.T) {
	db, _ := setupWSTest(t)

	// Use a port that nothing is listening on
	createWSTestRole(t, db, "role-1", "user-1", 59999)
	debugMgr.set("ws-noport", "role-1", "user-1")
	defer debugMgr.clear("ws-noport")

	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.Use(gin.Recovery())
	router.GET("/api/roles/:id/debug/ws", DebugWebSocket)

	proxyServer := httptest.NewServer(router)
	defer proxyServer.Close()

	proxyWSURL := "ws" + strings.TrimPrefix(proxyServer.URL, "http") + "/api/roles/role-1/debug/ws"
	header := http.Header{}
	header.Set("X-User-Id", "user-1")

	clientConn, _, err := websocket.DefaultDialer.Dial(proxyWSURL, header)
	if err != nil {
		// If dial fails, the connection was rejected before upgrade (unlikely for WS)
		t.Logf("Dial failed (expected for container unavailable): %v", err)
		return
	}
	defer clientConn.Close()

	// Should receive a close frame with error
	clientConn.SetReadDeadline(time.Now().Add(5 * time.Second))
	_, _, err = clientConn.ReadMessage()
	if err == nil {
		t.Error("Expected error from reading (container unavailable)")
	}
}

// --- Unit Tests for helper functions ---

func TestProxyMessages(t *testing.T) {
	// Create a pair of in-memory WebSocket connections via httptest
	upgrader := websocket.Upgrader{CheckOrigin: func(r *http.Request) bool { return true }}

	var serverConn *websocket.Conn
	var serverConnMu sync.Mutex

	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		conn, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			return
		}
		serverConnMu.Lock()
		serverConn = conn
		serverConnMu.Unlock()
	})

	srv := httptest.NewServer(handler)
	defer srv.Close()

	wsURL := "ws" + strings.TrimPrefix(srv.URL, "http")
	clientConn, _, err := websocket.DefaultDialer.Dial(wsURL, nil)
	if err != nil {
		t.Fatalf("failed to dial: %v", err)
	}
	defer clientConn.Close()

	// Wait for server connection to be set
	time.Sleep(50 * time.Millisecond)
	serverConnMu.Lock()
	sConn := serverConn
	serverConnMu.Unlock()
	if sConn == nil {
		t.Fatal("server connection not established")
	}
	defer sConn.Close()

	done := make(chan struct{}, 2)

	// Start proxy: src=clientConn, dst=sConn
	go proxyMessages("test", clientConn, sConn, done)

	// Read from dst (sConn) what was sent through src (clientConn)
	sConn.SetReadDeadline(time.Now().Add(2 * time.Second))

	// Send message through src
	if err := clientConn.WriteMessage(websocket.TextMessage, []byte("hello")); err != nil {
		t.Fatalf("failed to send: %v", err)
	}

	mt, msg, err := sConn.ReadMessage()
	if err != nil {
		t.Fatalf("failed to read: %v", err)
	}
	if mt != websocket.TextMessage {
		t.Errorf("Expected TextMessage, got %d", mt)
	}
	if string(msg) != "hello" {
		t.Errorf("Expected 'hello', got '%s'", string(msg))
	}

	// Close src to trigger proxy exit
	clientConn.Close()

	// Wait for proxy to finish
	select {
	case <-done:
		// Good, proxy exited
	case <-time.After(2 * time.Second):
		t.Error("proxyMessages did not exit after src close")
	}
}

// --- DebugWebSocketURL Tests ---

func TestDebugWebSocketURL_Success(t *testing.T) {
	setupWSTest(t)

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request, _ = http.NewRequest("GET", "/api/roles/role-1/debug/ws-url?port=4100", nil)
	c.Params = gin.Params{{Key: "id", Value: "role-1"}}

	DebugWebSocketURL(c)

	if w.Code != http.StatusOK {
		t.Errorf("Expected status 200, got %d", w.Code)
	}
	resp := parseResponse(t, w)
	data := resp["data"].(map[string]interface{})
	if data["url"] != "ws://localhost:4100/pico/ws" {
		t.Errorf("Expected correct WS URL, got %v", data["url"])
	}
}

func TestDebugWebSocketURL_MissingPort(t *testing.T) {
	setupWSTest(t)

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request, _ = http.NewRequest("GET", "/api/roles/role-1/debug/ws-url", nil)
	c.Params = gin.Params{{Key: "id", Value: "role-1"}}

	DebugWebSocketURL(c)

	if w.Code != http.StatusBadRequest {
		t.Errorf("Expected status 400, got %d", w.Code)
	}
	resp := parseResponse(t, w)
	if resp["error"] != "port query parameter is required" {
		t.Errorf("Expected 'port query parameter is required', got %v", resp["error"])
	}
}

func TestDebugWebSocketURL_InvalidPort(t *testing.T) {
	setupWSTest(t)

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request, _ = http.NewRequest("GET", "/api/roles/role-1/debug/ws-url?port=abc", nil)
	c.Params = gin.Params{{Key: "id", Value: "role-1"}}

	DebugWebSocketURL(c)

	if w.Code != http.StatusBadRequest {
		t.Errorf("Expected status 400, got %d", w.Code)
	}
	resp := parseResponse(t, w)
	if resp["error"] != "invalid port number" {
		t.Errorf("Expected 'invalid port number', got %v", resp["error"])
	}
}
