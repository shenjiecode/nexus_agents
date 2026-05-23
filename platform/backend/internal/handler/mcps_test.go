package handler

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"

	"github.com/nexus-agents/backend/internal/model"
)

// setupMCPsTestDB creates an in-memory SQLite database for testing.
func setupMCPsTestDB(t *testing.T) *gorm.DB {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("failed to connect to test database: %v", err)
	}

	// AutoMigrate tables
	if err := db.AutoMigrate(&model.User{}, &model.MCP{}); err != nil {
		t.Fatalf("failed to run auto migrate: %v", err)
	}

	return db
}

// CreateMCPRequest represents the request body for creating an MCP.
type CreateMCPRequest struct {
	Name        string `json:"name"`
	Description string `json:"description"`
	Category    string `json:"category"`
	IsPublic    string `json:"isPublic"`
}

// UpdateMCPRequest represents the request body for updating an MCP.
type UpdateMCPRequest struct {
	Name        string `json:"name"`
	Description string `json:"description"`
	Category    string `json:"category"`
	IsPublic    string `json:"isPublic"`
}

// TestListMCPs tests GET /api/mcps - List all public MCPs
func TestListMCPs(t *testing.T) {
	// Setup
	gin.SetMode(gin.TestMode)
	db := setupMCPsTestDB(t)
	model.SetTestDB(db)

	// Create test MCPs
	mcps := []model.MCP{
		{
			ID:          "mcp-1",
			UserID:      "user-1",
			Name:        "Public MCP 1",
			Slug:        "public-mcp-1",
			Description: "A public MCP",
			Category:    "development",
			IsPublic:    "true",
		},
		{
			ID:          "mcp-2",
			UserID:      "user-2",
			Name:        "Private MCP",
			Slug:        "private-mcp",
			Description: "A private MCP",
			Category:    "development",
			IsPublic:    "false",
		},
		{
			ID:          "mcp-3",
			UserID:      "user-3",
			Name:        "Public MCP 2",
			Slug:        "public-mcp-2",
			Description: "Another public MCP",
			Category:    "testing",
			IsPublic:    "true",
		},
	}

	for _, mcp := range mcps {
		if err := db.Create(&mcp).Error; err != nil {
			t.Fatalf("failed to create MCP: %v", err)
		}
	}

	// Create request
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request, _ = http.NewRequest("GET", "/api/mcps", nil)

	// Call handler
	ListMCPs(c)

	// Assert
	if w.Code != http.StatusOK {
		t.Errorf("Expected status 200, got %d", w.Code)
		t.Logf("Response: %s", w.Body.String())
	}

	var response map[string]interface{}
	if err := json.Unmarshal(w.Body.Bytes(), &response); err != nil {
		t.Fatalf("failed to unmarshal response: %v", err)
	}

	if response["success"] != true {
		t.Errorf("Expected success to be true, got %v", response["success"])
	}

	data := response["data"].([]interface{})
	if len(data) != 2 {
		t.Errorf("Expected 2 public MCPs, got %d", len(data))
	}
}

// TestGetMyMCPs_Unauthenticated tests GET /api/mcps/mine without auth
func TestGetMyMCPs_Unauthenticated(t *testing.T) {
	// Setup
	gin.SetMode(gin.TestMode)
	db := setupMCPsTestDB(t)
	model.SetTestDB(db)

	// Create request without user
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request, _ = http.NewRequest("GET", "/api/mcps/mine", nil)

	// Call handler
	GetMyMCPs(c)

	// Assert
	if w.Code != http.StatusUnauthorized {
		t.Errorf("Expected status 401, got %d", w.Code)
		t.Logf("Response: %s", w.Body.String())
	}

	var response map[string]interface{}
	if err := json.Unmarshal(w.Body.Bytes(), &response); err != nil {
		t.Fatalf("failed to unmarshal response: %v", err)
	}

	if response["success"] != false {
		t.Errorf("Expected success to be false, got %v", response["success"])
	}
	if response["error"] != "Unauthorized" {
		t.Errorf("Expected error 'Unauthorized', got %v", response["error"])
	}
}

// TestGetMyMCPs_Success tests GET /api/mcps/mine with auth
func TestGetMyMCPs_Success(t *testing.T) {
	// Setup
	gin.SetMode(gin.TestMode)
	db := setupMCPsTestDB(t)
	model.SetTestDB(db)

	// Create test MCPs
	mcps := []model.MCP{
		{
			ID:          "mcp-user1-1",
			UserID:      "user-1",
			Name:        "User 1 MCP 1",
			Slug:        "user-1-mcp-1",
			Description: "User 1 first MCP",
			Category:    "development",
			IsPublic:    "true",
		},
		{
			ID:          "mcp-user1-2",
			UserID:      "user-1",
			Name:        "User 1 MCP 2",
			Slug:        "user-1-mcp-2",
			Description: "User 1 second MCP",
			Category:    "testing",
			IsPublic:    "false",
		},
		{
			ID:          "mcp-user-2",
			UserID:      "user-2",
			Name:        "User 2 MCP",
			Slug:        "user-2-mcp",
			Description: "User 2 MCP",
			Category:    "development",
			IsPublic:    "true",
		},
	}

	for _, mcp := range mcps {
		if err := db.Create(&mcp).Error; err != nil {
			t.Fatalf("failed to create MCP: %v", err)
		}
	}

	// Create request with user
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request, _ = http.NewRequest("GET", "/api/mcps/mine", nil)
	setUser(c, "user-1")

	// Call handler
	GetMyMCPs(c)

	// Assert
	if w.Code != http.StatusOK {
		t.Errorf("Expected status 200, got %d", w.Code)
		t.Logf("Response: %s", w.Body.String())
	}

	var response map[string]interface{}
	if err := json.Unmarshal(w.Body.Bytes(), &response); err != nil {
		t.Fatalf("failed to unmarshal response: %v", err)
	}

	if response["success"] != true {
		t.Errorf("Expected success to be true, got %v", response["success"])
	}

	data := response["data"].([]interface{})
	if len(data) != 2 {
		t.Errorf("Expected 2 MCPs for user-1, got %d", len(data))
	}
}

// TestCreateMCP_Unauthenticated tests POST /api/mcps without auth
func TestCreateMCP_Unauthenticated(t *testing.T) {
	// Setup
	gin.SetMode(gin.TestMode)
	db := setupMCPsTestDB(t)
	model.SetTestDB(db)

	// Create request without user
	body := CreateMCPRequest{
		Name:        "New MCP",
		Description: "Test Description",
		Category:    "development",
	}
	jsonBody, _ := json.Marshal(body)

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request, _ = http.NewRequest("POST", "/api/mcps", bytes.NewBuffer(jsonBody))
	c.Request.Header.Set("Content-Type", "application/json")

	// Call handler
	CreateMCP(c)

	// Assert
	if w.Code != http.StatusUnauthorized {
		t.Errorf("Expected status 401, got %d", w.Code)
		t.Logf("Response: %s", w.Body.String())
	}

	var response map[string]interface{}
	if err := json.Unmarshal(w.Body.Bytes(), &response); err != nil {
		t.Fatalf("failed to unmarshal response: %v", err)
	}

	if response["success"] != false {
		t.Errorf("Expected success to be false, got %v", response["success"])
	}
}

// TestCreateMCP_MissingName tests POST /api/mcps with missing name
func TestCreateMCP_MissingName(t *testing.T) {
	// Setup
	gin.SetMode(gin.TestMode)
	db := setupMCPsTestDB(t)
	model.SetTestDB(db)

	// Create request with user but no name
	body := map[string]string{}
	jsonBody, _ := json.Marshal(body)

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request, _ = http.NewRequest("POST", "/api/mcps", bytes.NewBuffer(jsonBody))
	c.Request.Header.Set("Content-Type", "application/json")
	setUser(c, "user-1")

	// Call handler
	CreateMCP(c)

	// Assert
	if w.Code != http.StatusBadRequest {
		t.Errorf("Expected status 400, got %d", w.Code)
		t.Logf("Response: %s", w.Body.String())
	}

	var response map[string]interface{}
	if err := json.Unmarshal(w.Body.Bytes(), &response); err != nil {
		t.Fatalf("failed to unmarshal response: %v", err)
	}

	if response["success"] != false {
		t.Errorf("Expected success to be false, got %v", response["success"])
	}
	if response["error"] != "name is required and must be a string" {
		t.Errorf("Expected error 'name is required and must be a string', got %v", response["error"])
	}
}

// TestCreateMCP_Success tests POST /api/mcps with valid data
func TestCreateMCP_Success(t *testing.T) {
	// Setup
	gin.SetMode(gin.TestMode)
	db := setupMCPsTestDB(t)
	model.SetTestDB(db)

	// Create request with user
	body := CreateMCPRequest{
		Name:        "Test MCP",
		Description: "Test Description",
		Category:    "development",
		IsPublic:    "true",
	}
	jsonBody, _ := json.Marshal(body)

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request, _ = http.NewRequest("POST", "/api/mcps", bytes.NewBuffer(jsonBody))
	c.Request.Header.Set("Content-Type", "application/json")
	setUser(c, "user-1")

	// Call handler
	CreateMCP(c)

	// Assert
	if w.Code != http.StatusCreated {
		t.Errorf("Expected status 201, got %d", w.Code)
		t.Logf("Response: %s", w.Body.String())
	}

	var response map[string]interface{}
	if err := json.Unmarshal(w.Body.Bytes(), &response); err != nil {
		t.Fatalf("failed to unmarshal response: %v", err)
	}

	if response["success"] != true {
		t.Errorf("Expected success to be true, got %v", response["success"])
	}

	data := response["data"].(map[string]interface{})
	if data["name"] != "Test MCP" {
		t.Errorf("Expected name 'Test MCP', got %v", data["name"])
	}
	if data["description"] != "Test Description" {
		t.Errorf("Expected description 'Test Description', got %v", data["description"])
	}
	if data["category"] != "development" {
		t.Errorf("Expected category 'development', got %v", data["category"])
	}
	if data["isPublic"] != "true" {
		t.Errorf("Expected isPublic 'true', got %v", data["isPublic"])
	}
}

// TestGetMCP_NotFound tests GET /api/mcps/:id for non-existent MCP
func TestGetMCP_NotFound(t *testing.T) {
	// Setup
	gin.SetMode(gin.TestMode)
	db := setupMCPsTestDB(t)
	model.SetTestDB(db)

	// Create request for non-existent MCP
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request, _ = http.NewRequest("GET", "/api/mcps/nonexistent", nil)
	c.Params = gin.Params{{Key: "id", Value: "nonexistent"}}

	// Call handler
	GetMCP(c)

	// Assert
	if w.Code != http.StatusNotFound {
		t.Errorf("Expected status 404, got %d", w.Code)
		t.Logf("Response: %s", w.Body.String())
	}

	var response map[string]interface{}
	if err := json.Unmarshal(w.Body.Bytes(), &response); err != nil {
		t.Fatalf("failed to unmarshal response: %v", err)
	}

	if response["success"] != false {
		t.Errorf("Expected success to be false, got %v", response["success"])
	}
	if response["error"] != "MCP not found" {
		t.Errorf("Expected error 'MCP not found', got %v", response["error"])
	}
}

// TestGetMCP_Success tests GET /api/mcps/:id for existing MCP
func TestGetMCP_Success(t *testing.T) {
	// Setup
	gin.SetMode(gin.TestMode)
	db := setupMCPsTestDB(t)
	model.SetTestDB(db)

	// Create test MCP
	mcp := model.MCP{
		ID:          "mcp-1",
		UserID:      "user-1",
		Name:        "Test MCP",
		Slug:        "test-mcp",
		Description: "Test Description",
		Category:    "development",
		IsPublic:    "true",
	}
	if err := db.Create(&mcp).Error; err != nil {
		t.Fatalf("failed to create MCP: %v", err)
	}

	// Create request
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request, _ = http.NewRequest("GET", "/api/mcps/mcp-1", nil)
	c.Params = gin.Params{{Key: "id", Value: "mcp-1"}}

	// Call handler
	GetMCP(c)

	// Assert
	if w.Code != http.StatusOK {
		t.Errorf("Expected status 200, got %d", w.Code)
		t.Logf("Response: %s", w.Body.String())
	}

	var response map[string]interface{}
	if err := json.Unmarshal(w.Body.Bytes(), &response); err != nil {
		t.Fatalf("failed to unmarshal response: %v", err)
	}

	if response["success"] != true {
		t.Errorf("Expected success to be true, got %v", response["success"])
	}

	data := response["data"].(map[string]interface{})
	if data["id"] != "mcp-1" {
		t.Errorf("Expected id 'mcp-1', got %v", data["id"])
	}
	if data["name"] != "Test MCP" {
		t.Errorf("Expected name 'Test MCP', got %v", data["name"])
	}
}

// TestUpdateMCP_NotFound tests PUT /api/mcps/:id for non-existent MCP
func TestUpdateMCP_NotFound(t *testing.T) {
	// Setup
	gin.SetMode(gin.TestMode)
	db := setupMCPsTestDB(t)
	model.SetTestDB(db)

	// Create request with user but non-existent MCP
	body := UpdateMCPRequest{
		Name: "Updated Name",
	}
	jsonBody, _ := json.Marshal(body)

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request, _ = http.NewRequest("PUT", "/api/mcps/nonexistent", bytes.NewBuffer(jsonBody))
	c.Request.Header.Set("Content-Type", "application/json")
	c.Params = gin.Params{{Key: "id", Value: "nonexistent"}}
	setUser(c, "user-1")

	// Call handler
	UpdateMCP(c)

	// Assert
	if w.Code != http.StatusNotFound {
		t.Errorf("Expected status 404, got %d", w.Code)
		t.Logf("Response: %s", w.Body.String())
	}

	var response map[string]interface{}
	if err := json.Unmarshal(w.Body.Bytes(), &response); err != nil {
		t.Fatalf("failed to unmarshal response: %v", err)
	}

	if response["success"] != false {
		t.Errorf("Expected success to be false, got %v", response["success"])
	}
}

// TestUpdateMCP_Forbidden tests PUT /api/mcps/:id for another user's MCP
func TestUpdateMCP_Forbidden(t *testing.T) {
	// Setup
	gin.SetMode(gin.TestMode)
	db := setupMCPsTestDB(t)
	model.SetTestDB(db)

	// Create test MCP belonging to different user
	mcp := model.MCP{
		ID:       "mcp-1",
		UserID:   "user-other",
		Name:     "Original Name",
		Slug:     "original-name",
		Category: "development",
	}
	if err := db.Create(&mcp).Error; err != nil {
		t.Fatalf("failed to create MCP: %v", err)
	}

	// Create request with different user
	body := UpdateMCPRequest{
		Name: "Updated Name",
	}
	jsonBody, _ := json.Marshal(body)

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request, _ = http.NewRequest("PUT", "/api/mcps/mcp-1", bytes.NewBuffer(jsonBody))
	c.Request.Header.Set("Content-Type", "application/json")
	c.Params = gin.Params{{Key: "id", Value: "mcp-1"}}
	setUser(c, "user-1") // Different user

	// Call handler
	UpdateMCP(c)

	// Assert
	if w.Code != http.StatusForbidden {
		t.Errorf("Expected status 403, got %d", w.Code)
		t.Logf("Response: %s", w.Body.String())
	}

	var response map[string]interface{}
	if err := json.Unmarshal(w.Body.Bytes(), &response); err != nil {
		t.Fatalf("failed to unmarshal response: %v", err)
	}

	if response["success"] != false {
		t.Errorf("Expected success to be false, got %v", response["success"])
	}
	if response["error"] != "Forbidden: you can only update your own MCPs" {
		t.Errorf("Expected error 'Forbidden: you can only update your own MCPs', got %v", response["error"])
	}
}

// TestUpdateMCP_Success tests PUT /api/mcps/:id with valid data
func TestUpdateMCP_Success(t *testing.T) {
	// Setup
	gin.SetMode(gin.TestMode)
	db := setupMCPsTestDB(t)
	model.SetTestDB(db)

	// Create test MCP
	mcp := model.MCP{
		ID:       "mcp-1",
		UserID:   "user-1",
		Name:     "Original Name",
		Slug:     "original-name",
		Category: "development",
	}
	if err := db.Create(&mcp).Error; err != nil {
		t.Fatalf("failed to create MCP: %v", err)
	}

	// Create request to update
	body := UpdateMCPRequest{
		Name:        "Updated Name",
		Description: "Updated Description",
		Category:    "testing",
	}
	jsonBody, _ := json.Marshal(body)

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request, _ = http.NewRequest("PUT", "/api/mcps/mcp-1", bytes.NewBuffer(jsonBody))
	c.Request.Header.Set("Content-Type", "application/json")
	c.Params = gin.Params{{Key: "id", Value: "mcp-1"}}
	setUser(c, "user-1")

	// Call handler
	UpdateMCP(c)

	// Assert
	if w.Code != http.StatusOK {
		t.Errorf("Expected status 200, got %d", w.Code)
		t.Logf("Response: %s", w.Body.String())
	}

	var response map[string]interface{}
	if err := json.Unmarshal(w.Body.Bytes(), &response); err != nil {
		t.Fatalf("failed to unmarshal response: %v", err)
	}

	if response["success"] != true {
		t.Errorf("Expected success to be true, got %v", response["success"])
	}

	data := response["data"].(map[string]interface{})
	if data["name"] != "Updated Name" {
		t.Errorf("Expected name 'Updated Name', got %v", data["name"])
	}
	if data["description"] != "Updated Description" {
		t.Errorf("Expected description 'Updated Description', got %v", data["description"])
	}
	if data["category"] != "testing" {
		t.Errorf("Expected category 'testing', got %v", data["category"])
	}
}

// TestDeleteMCP_NotFound tests DELETE /api/mcps/:id for non-existent MCP
func TestDeleteMCP_NotFound(t *testing.T) {
	// Setup
	gin.SetMode(gin.TestMode)
	db := setupMCPsTestDB(t)
	model.SetTestDB(db)

	// Create request with user but non-existent MCP
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request, _ = http.NewRequest("DELETE", "/api/mcps/nonexistent", nil)
	c.Params = gin.Params{{Key: "id", Value: "nonexistent"}}
	setUser(c, "user-1")

	// Call handler
	DeleteMCP(c)

	// Assert
	if w.Code != http.StatusNotFound {
		t.Errorf("Expected status 404, got %d", w.Code)
		t.Logf("Response: %s", w.Body.String())
	}

	var response map[string]interface{}
	if err := json.Unmarshal(w.Body.Bytes(), &response); err != nil {
		t.Fatalf("failed to unmarshal response: %v", err)
	}

	if response["success"] != false {
		t.Errorf("Expected success to be false, got %v", response["success"])
	}
}

// TestDeleteMCP_Forbidden tests DELETE /api/mcps/:id for another user's MCP
func TestDeleteMCP_Forbidden(t *testing.T) {
	// Setup
	gin.SetMode(gin.TestMode)
	db := setupMCPsTestDB(t)
	model.SetTestDB(db)

	// Create test MCP belonging to different user
	mcp := model.MCP{
		ID:       "mcp-1",
		UserID:   "user-other",
		Name:     "Test MCP",
		Slug:     "test-mcp",
		Category: "development",
	}
	if err := db.Create(&mcp).Error; err != nil {
		t.Fatalf("failed to create MCP: %v", err)
	}

	// Create request with different user
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request, _ = http.NewRequest("DELETE", "/api/mcps/mcp-1", nil)
	c.Params = gin.Params{{Key: "id", Value: "mcp-1"}}
	setUser(c, "user-1") // Different user

	// Call handler
	DeleteMCP(c)

	// Assert
	if w.Code != http.StatusForbidden {
		t.Errorf("Expected status 403, got %d", w.Code)
		t.Logf("Response: %s", w.Body.String())
	}

	var response map[string]interface{}
	if err := json.Unmarshal(w.Body.Bytes(), &response); err != nil {
		t.Fatalf("failed to unmarshal response: %v", err)
	}

	if response["success"] != false {
		t.Errorf("Expected success to be false, got %v", response["success"])
	}
	if response["error"] != "Forbidden: you can only delete your own MCPs" {
		t.Errorf("Expected error 'Forbidden: you can only delete your own MCPs', got %v", response["error"])
	}
}

// TestDeleteMCP_Success tests DELETE /api/mcps/:id with valid data
func TestDeleteMCP_Success(t *testing.T) {
	// Setup
	gin.SetMode(gin.TestMode)
	db := setupMCPsTestDB(t)
	model.SetTestDB(db)

	// Create test MCP
	mcp := model.MCP{
		ID:       "mcp-1",
		UserID:   "user-1",
		Name:     "Test MCP",
		Slug:     "test-mcp",
		Category: "development",
	}
	if err := db.Create(&mcp).Error; err != nil {
		t.Fatalf("failed to create MCP: %v", err)
	}

	// Create request to delete
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request, _ = http.NewRequest("DELETE", "/api/mcps/mcp-1", nil)
	c.Params = gin.Params{{Key: "id", Value: "mcp-1"}}
	setUser(c, "user-1")

	// Call handler
	DeleteMCP(c)

	// Assert
	if w.Code != http.StatusOK {
		t.Errorf("Expected status 200, got %d", w.Code)
		t.Logf("Response: %s", w.Body.String())
	}

	var response map[string]interface{}
	if err := json.Unmarshal(w.Body.Bytes(), &response); err != nil {
		t.Fatalf("failed to unmarshal response: %v", err)
	}

	if response["success"] != true {
		t.Errorf("Expected success to be true, got %v", response["success"])
	}

	// Verify MCP is deleted
	var deletedMCP model.MCP
	if err := db.First(&deletedMCP, "id = ?", "mcp-1").Error; err == nil {
		t.Errorf("Expected MCP to be deleted, but it still exists")
	}
}
