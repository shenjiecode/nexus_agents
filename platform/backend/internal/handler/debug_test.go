package handler

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/docker/docker/api/types"
	containertypes "github.com/docker/docker/api/types/container"
	"github.com/docker/docker/api/types/network"
	"go.uber.org/zap"

	ocispec "github.com/opencontainers/image-spec/specs-go/v1"

	"github.com/nexus-agents/backend/internal/middleware"
	"github.com/nexus-agents/backend/internal/model"
	"github.com/nexus-agents/backend/internal/service"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

// --- Mock Docker Client for handler tests ---

type mockDockerClient struct {
	containers map[string]*mockContainer
	mu         sync.Mutex
	nextID     int
	createErr  error
	startErr   error
	stopErr    error
	removeErr  error
	inspectErr error
}

type mockContainer struct {
	name    string
	image   string
	running bool
}

func newMockDockerClient() *mockDockerClient {
	return &mockDockerClient{
		containers: make(map[string]*mockContainer),
		nextID:     1,
	}
}

func (m *mockDockerClient) ContainerCreate(ctx context.Context, config *containertypes.Config, hostConfig *containertypes.HostConfig, networkingConfig *network.NetworkingConfig, platform *ocispec.Platform, name string) (containertypes.CreateResponse, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	if m.createErr != nil {
		return containertypes.CreateResponse{}, m.createErr
	}
	id := fmt.Sprintf("container-%d", m.nextID)
	m.nextID++
	m.containers[id] = &mockContainer{
		name:    name,
		image:   config.Image,
		running: false,
	}
	return containertypes.CreateResponse{ID: id}, nil
}

func (m *mockDockerClient) ContainerStart(ctx context.Context, containerID string, options containertypes.StartOptions) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	if m.startErr != nil {
		return m.startErr
	}
	if c, ok := m.containers[containerID]; ok {
		c.running = true
	}
	return nil
}

func (m *mockDockerClient) ContainerStop(ctx context.Context, containerID string, options containertypes.StopOptions) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	if m.stopErr != nil {
		return m.stopErr
	}
	if c, ok := m.containers[containerID]; ok {
		c.running = false
	}
	return nil
}

func (m *mockDockerClient) ContainerRemove(ctx context.Context, containerID string, options containertypes.RemoveOptions) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	if m.removeErr != nil {
		return m.removeErr
	}
	delete(m.containers, containerID)
	return nil
}

func (m *mockDockerClient) ContainerInspect(ctx context.Context, containerID string) (types.ContainerJSON, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	if m.inspectErr != nil {
		return types.ContainerJSON{}, m.inspectErr
	}
	c, ok := m.containers[containerID]
	if !ok {
		return types.ContainerJSON{}, fmt.Errorf("no such container: %s", containerID)
	}
	return types.ContainerJSON{
		ContainerJSONBase: &types.ContainerJSONBase{
			ID:   containerID,
			Name: c.name,
			State: &types.ContainerState{
				Running: c.running,
			},
		},
		Config: &containertypes.Config{
			Image: c.image,
		},
	}, nil
}

func (m *mockDockerClient) ContainerList(ctx context.Context, options containertypes.ListOptions) ([]types.Container, error) {
	return nil, nil
}

func (m *mockDockerClient) Close() error { return nil }

// --- Test Helpers ---

// setupDebugTest initializes test DB and container pool for debug tests.
func setupDebugTest(t *testing.T) (*gorm.DB, *service.ContainerPool) {
	t.Helper()

	gin.SetMode(gin.TestMode)

	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("failed to connect to test database: %v", err)
	}

	if err := db.AutoMigrate(&model.User{}, &model.Role{}); err != nil {
		t.Fatalf("failed to run auto migrate: %v", err)
	}

	model.SetTestDB(db)

	mockCli := newMockDockerClient()
	pool := service.NewContainerPool(mockCli, zap.NewNop())
	SetContainerPool(pool)
	SetDebugLogger(zap.NewNop())

	// Reset debug manager between tests
	debugMgr.mu.Lock()
	debugMgr.sessions = make(map[string]*debugSession)
	debugMgr.byUser = make(map[string]string)
	debugMgr.mu.Unlock()

	return db, pool
}

// createTestRole creates a role in the DB and returns it.
func createTestRole(t *testing.T, db *gorm.DB, id, userID, name, variant string) *model.Role {
	t.Helper()
	role := model.Role{
		ID:       id,
		UserID:   userID,
		Name:     name,
		Variant:  variant,
		Status:   "stopped",
		IsPublic: "false",
	}
	if err := db.Create(&role).Error; err != nil {
		t.Fatalf("failed to create test role: %v", err)
	}
	return &role
}

// newDebugContext creates a Gin context with a test request.
func newDebugContext(t *testing.T, method, path, roleID string, userID string) (*httptest.ResponseRecorder, *gin.Context) {
t.Helper()
w := httptest.NewRecorder()
c, _ := gin.CreateTestContext(w)
c.Request, _ = http.NewRequest(method, path, nil)
if roleID != "" {
c.Params = gin.Params{{Key: "id", Value: roleID}}
}
if userID != "" {
		c.Set("user", middleware.UserContext{
ID: userID,
})
}
return w, c
}

// parseResponse is a helper to unmarshal JSON response.
func parseResponse(t *testing.T, w *httptest.ResponseRecorder) map[string]interface{} {
	t.Helper()
	var response map[string]interface{}
	if err := json.Unmarshal(w.Body.Bytes(), &response); err != nil {
		t.Fatalf("failed to unmarshal response: %v", err)
	}
	return response
}

// --- StartDebug Tests ---

func TestStartDebug_Unauthenticated(t *testing.T) {
	setupDebugTest(t)

	w, c := newDebugContext(t, "POST", "/api/roles/role-1/debug/start", "role-1", "")

	StartDebug(c)

	if w.Code != http.StatusUnauthorized {
		t.Errorf("Expected status 401, got %d", w.Code)
	}
	resp := parseResponse(t, w)
	if resp["success"] != false {
		t.Errorf("Expected success false, got %v", resp["success"])
	}
}

func TestStartDebug_MissingRoleID(t *testing.T) {
	setupDebugTest(t)

	w, c := newDebugContext(t, "POST", "/api/roles//debug/start", "", "user-1")
	// No params set - roleID will be empty

	StartDebug(c)

	if w.Code != http.StatusBadRequest {
		t.Errorf("Expected status 400, got %d", w.Code)
	}
	resp := parseResponse(t, w)
	if resp["error"] != "Role ID is required" {
		t.Errorf("Expected 'Role ID is required', got %v", resp["error"])
	}
}

func TestStartDebug_RoleNotFound(t *testing.T) {
	db, _ := setupDebugTest(t)
	_ = db // DB is set up but no role created

	w, c := newDebugContext(t, "POST", "/api/roles/nonexistent/debug/start", "nonexistent", "user-1")

	StartDebug(c)

	if w.Code != http.StatusNotFound {
		t.Errorf("Expected status 404, got %d", w.Code)
	}
	resp := parseResponse(t, w)
	if resp["error"] != "Role not found" {
		t.Errorf("Expected 'Role not found', got %v", resp["error"])
	}
}

func TestStartDebug_Forbidden(t *testing.T) {
	db, _ := setupDebugTest(t)
	createTestRole(t, db, "role-1", "user-other", "Test Role", "full")

	w, c := newDebugContext(t, "POST", "/api/roles/role-1/debug/start", "role-1", "user-1")

	StartDebug(c)

	if w.Code != http.StatusForbidden {
		t.Errorf("Expected status 403, got %d", w.Code)
	}
	resp := parseResponse(t, w)
	if resp["error"] != "Only the role owner can debug" {
		t.Errorf("Expected 'Only the role owner can debug', got %v", resp["error"])
	}
}

func TestStartDebug_SingleUserSingleDebugLock(t *testing.T) {
	db, _ := setupDebugTest(t)
	createTestRole(t, db, "role-1", "user-1", "Role 1", "full")
	createTestRole(t, db, "role-2", "user-1", "Role 2", "full")

	// Simulate existing debug session for user-1
	debugMgr.set("ws-existing", "role-1", "user-1")

	w, c := newDebugContext(t, "POST", "/api/roles/role-2/debug/start", "role-2", "user-1")

	StartDebug(c)

	if w.Code != http.StatusConflict {
		t.Errorf("Expected status 409, got %d", w.Code)
	}
	resp := parseResponse(t, w)
	if resp["error"] != "You already have an active debug session" {
		t.Errorf("Expected conflict error, got %v", resp["error"])
	}

	// Cleanup
	debugMgr.clear("ws-existing")
}

func TestStartDebug_Success(t *testing.T) {
	db, _ := setupDebugTest(t)
	createTestRole(t, db, "role-1", "user-1", "Test Role", "full")

	w, c := newDebugContext(t, "POST", "/api/roles/role-1/debug/start", "role-1", "user-1")

	StartDebug(c)

	if w.Code != http.StatusCreated {
		t.Errorf("Expected status 201, got %d", w.Code)
		t.Logf("Response: %s", w.Body.String())
	}

	resp := parseResponse(t, w)
	if resp["success"] != true {
		t.Errorf("Expected success true, got %v", resp["success"])
	}

	data := resp["data"].(map[string]interface{})
	if data["roleId"] != "role-1" {
		t.Errorf("Expected roleId 'role-1', got %v", data["roleId"])
	}
	if data["status"] != "debugging" {
		t.Errorf("Expected status 'debugging', got %v", data["status"])
	}
	if data["containerId"] == nil || data["containerId"] == "" {
		t.Error("Expected non-empty containerId")
	}
	if data["workspaceId"] == nil || data["workspaceId"] == "" {
		t.Error("Expected non-empty workspaceId")
	}

	// Verify role was updated in DB
	var updatedRole model.Role
	db.First(&updatedRole, "id = ?", "role-1")
	if updatedRole.Status != "debugging" {
		t.Errorf("Expected role status 'debugging', got %s", updatedRole.Status)
	}
	if updatedRole.ContainerID == "" {
		t.Error("Expected non-empty container_id on role")
	}
}

// --- StopDebug Tests ---

func TestStopDebug_Unauthenticated(t *testing.T) {
	setupDebugTest(t)

	w, c := newDebugContext(t, "POST", "/api/roles/role-1/debug/stop", "role-1", "")

	StopDebug(c)

	if w.Code != http.StatusUnauthorized {
		t.Errorf("Expected status 401, got %d", w.Code)
	}
}

func TestStopDebug_NoActiveSession(t *testing.T) {
	db, _ := setupDebugTest(t)
	createTestRole(t, db, "role-1", "user-1", "Test Role", "full")

	w, c := newDebugContext(t, "POST", "/api/roles/role-1/debug/stop", "role-1", "user-1")

	StopDebug(c)

	if w.Code != http.StatusNotFound {
		t.Errorf("Expected status 404, got %d", w.Code)
	}
	resp := parseResponse(t, w)
	if resp["error"] != "No active debug session for this role" {
		t.Errorf("Expected 'No active debug session for this role', got %v", resp["error"])
	}
}

func TestStopDebug_Success(t *testing.T) {
	db, _ := setupDebugTest(t)
	role := createTestRole(t, db, "role-1", "user-1", "Test Role", "full")

	// First start a debug session
	wStart, cStart := newDebugContext(t, "POST", "/api/roles/role-1/debug/start", "role-1", "user-1")
	StartDebug(cStart)
	if wStart.Code != http.StatusCreated {
		t.Fatalf("Failed to start debug: %d - %s", wStart.Code, wStart.Body.String())
	}

	// Get updated role with container info
	db.First(role, "id = ?", "role-1")

	// Now stop it
	wStop, cStop := newDebugContext(t, "POST", "/api/roles/role-1/debug/stop", "role-1", "user-1")
	StopDebug(cStop)

	if wStop.Code != http.StatusOK {
		t.Errorf("Expected status 200, got %d", wStop.Code)
		t.Logf("Response: %s", wStop.Body.String())
	}

	resp := parseResponse(t, wStop)
	if resp["success"] != true {
		t.Errorf("Expected success true, got %v", resp["success"])
	}

	data := resp["data"].(map[string]interface{})
	if data["status"] != "stopped" {
		t.Errorf("Expected status 'stopped', got %v", data["status"])
	}
	if data["message"] != "Debug session stopped successfully" {
		t.Errorf("Expected success message, got %v", data["message"])
	}

	// Verify role was updated in DB
	var updatedRole model.Role
	db.First(&updatedRole, "id = ?", "role-1")
	if updatedRole.Status != "stopped" {
		t.Errorf("Expected role status 'stopped', got %s", updatedRole.Status)
	}
}

func TestStopDebug_Forbidden(t *testing.T) {
	db, _ := setupDebugTest(t)
	createTestRole(t, db, "role-1", "user-other", "Test Role", "full")
	debugMgr.set("ws-1", "role-1", "user-other")

	w, c := newDebugContext(t, "POST", "/api/roles/role-1/debug/stop", "role-1", "user-1")

	StopDebug(c)

	if w.Code != http.StatusForbidden {
		t.Errorf("Expected status 403, got %d", w.Code)
	}

	// Cleanup
	debugMgr.clear("ws-1")
}

// --- DebugStatus Tests ---

func TestDebugStatus_Unauthenticated(t *testing.T) {
	setupDebugTest(t)

	w, c := newDebugContext(t, "GET", "/api/roles/role-1/debug/status", "role-1", "")

	DebugStatus(c)

	if w.Code != http.StatusUnauthorized {
		t.Errorf("Expected status 401, got %d", w.Code)
	}
}

func TestDebugStatus_RoleNotFound(t *testing.T) {
	db, _ := setupDebugTest(t)
	_ = db

	w, c := newDebugContext(t, "GET", "/api/roles/nonexistent/debug/status", "nonexistent", "user-1")

	DebugStatus(c)

	if w.Code != http.StatusNotFound {
		t.Errorf("Expected status 404, got %d", w.Code)
	}
}

func TestDebugStatus_NotDebugging(t *testing.T) {
	db, _ := setupDebugTest(t)
	createTestRole(t, db, "role-1", "user-1", "Test Role", "full")

	w, c := newDebugContext(t, "GET", "/api/roles/role-1/debug/status", "role-1", "user-1")

	DebugStatus(c)

	if w.Code != http.StatusOK {
		t.Errorf("Expected status 200, got %d", w.Code)
	}

	resp := parseResponse(t, w)
	data := resp["data"].(map[string]interface{})
	if data["debugActive"] != false {
		t.Errorf("Expected debugActive false, got %v", data["debugActive"])
	}
	if data["status"] != "stopped" {
		t.Errorf("Expected status 'stopped', got %v", data["status"])
	}
	if data["containerStatus"] != "stopped" {
		t.Errorf("Expected containerStatus 'stopped', got %v", data["containerStatus"])
	}
}

func TestDebugStatus_WhileDebugging(t *testing.T) {
	db, _ := setupDebugTest(t)
	createTestRole(t, db, "role-1", "user-1", "Test Role", "full")

	// Start debug session first
	wStart, cStart := newDebugContext(t, "POST", "/api/roles/role-1/debug/start", "role-1", "user-1")
	StartDebug(cStart)
	if wStart.Code != http.StatusCreated {
		t.Fatalf("Failed to start debug: %d - %s", wStart.Code, wStart.Body.String())
	}

	// Now check status
	wStatus, cStatus := newDebugContext(t, "GET", "/api/roles/role-1/debug/status", "role-1", "user-1")
	DebugStatus(cStatus)

	if wStatus.Code != http.StatusOK {
		t.Errorf("Expected status 200, got %d", wStatus.Code)
	}

	resp := parseResponse(t, wStatus)
	data := resp["data"].(map[string]interface{})
	if data["debugActive"] != true {
		t.Errorf("Expected debugActive true, got %v", data["debugActive"])
	}
	if data["status"] != "debugging" {
		t.Errorf("Expected status 'debugging', got %v", data["status"])
	}
	if data["containerStatus"] != "running" {
		t.Errorf("Expected containerStatus 'running', got %v", data["containerStatus"])
	}
	if data["workspaceId"] == nil || data["workspaceId"] == "" {
		t.Error("Expected non-empty workspaceId")
	}
}

func TestDebugStatus_Forbidden(t *testing.T) {
	db, _ := setupDebugTest(t)
	createTestRole(t, db, "role-1", "user-other", "Test Role", "full")

	w, c := newDebugContext(t, "GET", "/api/roles/role-1/debug/status", "role-1", "user-1")

	DebugStatus(c)

	if w.Code != http.StatusForbidden {
		t.Errorf("Expected status 403, got %d", w.Code)
	}
}

// --- DebugManager Unit Tests ---

func TestDebugManager_SetAndGet(t *testing.T) {
	dm := &debugManager{
		sessions: make(map[string]*debugSession),
		byUser:   make(map[string]string),
	}

	dm.set("ws-1", "role-1", "user-1")

	// Check by user
	wsID := dm.getActiveDebug("user-1")
	if wsID != "ws-1" {
		t.Errorf("Expected ws-1, got %s", wsID)
	}

	// Check by role
	wsID = dm.findByRole("role-1")
	if wsID != "ws-1" {
		t.Errorf("Expected ws-1, got %s", wsID)
	}

	// Non-existent user
	wsID = dm.getActiveDebug("user-2")
	if wsID != "" {
		t.Errorf("Expected empty, got %s", wsID)
	}
}

func TestDebugManager_Clear(t *testing.T) {
	dm := &debugManager{
		sessions: make(map[string]*debugSession),
		byUser:   make(map[string]string),
	}

	dm.set("ws-1", "role-1", "user-1")
	dm.clear("ws-1")

	// Should be gone
	wsID := dm.getActiveDebug("user-1")
	if wsID != "" {
		t.Errorf("Expected empty after clear, got %s", wsID)
	}
	wsID = dm.findByRole("role-1")
	if wsID != "" {
		t.Errorf("Expected empty after clear, got %s", wsID)
	}
}

func TestDebugManager_SingleUserLock(t *testing.T) {
	dm := &debugManager{
		sessions: make(map[string]*debugSession),
		byUser:   make(map[string]string),
	}

	// Set first session
	dm.set("ws-1", "role-1", "user-1")

	// User already has active debug
	wsID := dm.getActiveDebug("user-1")
	if wsID != "ws-1" {
		t.Errorf("Expected ws-1, got %s", wsID)
	}

	// Clear first, then set second
	dm.clear("ws-1")
	dm.set("ws-2", "role-2", "user-1")

	wsID = dm.getActiveDebug("user-1")
	if wsID != "ws-2" {
		t.Errorf("Expected ws-2 after reassign, got %s", wsID)
	}
}

// --- Full Flow Test ---

func TestDebugFullFlow(t *testing.T) {
	db, _ := setupDebugTest(t)
	createTestRole(t, db, "role-1", "user-1", "Test Role", "full")

	// 1. Status should be stopped initially
	w1, c1 := newDebugContext(t, "GET", "/api/roles/role-1/debug/status", "role-1", "user-1")
	DebugStatus(c1)
	if w1.Code != http.StatusOK {
		t.Fatalf("Expected 200, got %d", w1.Code)
	}
	resp1 := parseResponse(t, w1)
	data1 := resp1["data"].(map[string]interface{})
	if data1["status"] != "stopped" {
		t.Errorf("Expected initial status 'stopped', got %v", data1["status"])
	}

	// 2. Start debug
	w2, c2 := newDebugContext(t, "POST", "/api/roles/role-1/debug/start", "role-1", "user-1")
	StartDebug(c2)
	if w2.Code != http.StatusCreated {
		t.Fatalf("Expected 201, got %d - %s", w2.Code, w2.Body.String())
	}

	// 3. Status should be debugging
	w3, c3 := newDebugContext(t, "GET", "/api/roles/role-1/debug/status", "role-1", "user-1")
	DebugStatus(c3)
	resp3 := parseResponse(t, w3)
	data3 := resp3["data"].(map[string]interface{})
	if data3["status"] != "debugging" {
		t.Errorf("Expected status 'debugging', got %v", data3["status"])
	}
	if data3["debugActive"] != true {
		t.Errorf("Expected debugActive true, got %v", data3["debugActive"])
	}

	// 4. Stop debug
	w4, c4 := newDebugContext(t, "POST", "/api/roles/role-1/debug/stop", "role-1", "user-1")
	StopDebug(c4)
	if w4.Code != http.StatusOK {
		t.Fatalf("Expected 200, got %d - %s", w4.Code, w4.Body.String())
	}

	// 5. Status should be stopped again
	w5, c5 := newDebugContext(t, "GET", "/api/roles/role-1/debug/status", "role-1", "user-1")
	DebugStatus(c5)
	resp5 := parseResponse(t, w5)
	data5 := resp5["data"].(map[string]interface{})
	if data5["status"] != "stopped" {
		t.Errorf("Expected status 'stopped' after stop, got %v", data5["status"])
	}
	if data5["debugActive"] != false {
		t.Errorf("Expected debugActive false after stop, got %v", data5["debugActive"])
	}
}
