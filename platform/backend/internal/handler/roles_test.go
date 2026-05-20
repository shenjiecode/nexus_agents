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

	"github.com/nexus-agents/backend/internal/middleware"
	"github.com/nexus-agents/backend/internal/model"
)

// setupRolesTestDB creates an in-memory SQLite database for testing.
func setupRolesTestDB(t *testing.T) *gorm.DB {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("failed to connect to test database: %v", err)
	}

	// AutoMigrate tables
	if err := db.AutoMigrate(&model.User{}, &model.Role{}); err != nil {
		t.Fatalf("failed to run auto migrate: %v", err)
	}

	return db
}

// setUser sets the user in the Gin context for testing.
func setUser(c *gin.Context, userID, role string) {
	user := middleware.UserContext{
		ID:   userID,
		Role: role,
	}
	c.Set("user", &user)
}

// Test_ListPublicRoles tests GET /api/roles - List all public roles
func Test_ListPublicRoles(t *testing.T) {
	// Setup
	gin.SetMode(gin.TestMode)
	db := setupRolesTestDB(t)
	model.SetTestDB(db)

	// Create test roles
	roles := []model.Role{
		{
			ID:       "role-1",
			UserID:   "user-1",
			Name:     "Public Role 1",
			IsPublic: "true",
		},
		{
			ID:       "role-2",
			UserID:   "user-2",
			Name:     "Private Role",
			IsPublic: "false",
		},
		{
			ID:       "role-3",
			UserID:   "user-3",
			Name:     "Public Role 2",
			IsPublic: "true",
		},
	}

	for _, role := range roles {
		if err := db.Create(&role).Error; err != nil {
			t.Fatalf("failed to create role: %v", err)
		}
	}

	// Create request
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request, _ = http.NewRequest("GET", "/api/roles", nil)

	// Call handler
	ListPublicRoles(c)

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
		t.Errorf("Expected 2 public roles, got %d", len(data))
	}
}

// Test_ListMyRoles tests GET /api/roles/mine - List current user's roles
func Test_ListMyRoles_Unauthenticated(t *testing.T) {
	// Setup
	gin.SetMode(gin.TestMode)
	db := setupRolesTestDB(t)
	model.SetTestDB(db)

	// Create request without user
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request, _ = http.NewRequest("GET", "/api/roles/mine", nil)

	// Call handler
	ListMyRoles(c)

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

func Test_ListMyRoles_Success(t *testing.T) {
	// Setup
	gin.SetMode(gin.TestMode)
	db := setupRolesTestDB(t)
	model.SetTestDB(db)

	// Create test roles
	roles := []model.Role{
		{
			ID:       "role-user1-1",
			UserID:   "user-1",
			Name:     "User 1 Role 1",
			IsPublic: "true",
		},
		{
			ID:       "role-user1-2",
			UserID:   "user-1",
			Name:     "User 1 Role 2",
			IsPublic: "false",
		},
		{
			ID:       "role-user-2",
			UserID:   "user-2",
			Name:     "User 2 Role",
			IsPublic: "true",
		},
	}

	for _, role := range roles {
		if err := db.Create(&role).Error; err != nil {
			t.Fatalf("failed to create role: %v", err)
		}
	}

	// Create request with user
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request, _ = http.NewRequest("GET", "/api/roles/mine", nil)
	setUser(c, "user-1", "user")

	// Call handler
	ListMyRoles(c)

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
		t.Errorf("Expected 2 roles for user-1, got %d", len(data))
	}
}

// Test_CreateRole tests POST /api/roles - Create a new role
func Test_CreateRole_Unauthenticated(t *testing.T) {
	// Setup
	gin.SetMode(gin.TestMode)
	db := setupRolesTestDB(t)
	model.SetTestDB(db)

	// Create request without user
	body := CreateRoleRequest{
		Name: "New Role",
	}
	jsonBody, _ := json.Marshal(body)

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request, _ = http.NewRequest("POST", "/api/roles", bytes.NewBuffer(jsonBody))
	c.Request.Header.Set("Content-Type", "application/json")

	// Call handler
	CreateRole(c)

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

func Test_CreateRole_MissingName(t *testing.T) {
	// Setup
	gin.SetMode(gin.TestMode)
	db := setupRolesTestDB(t)
	model.SetTestDB(db)

	// Create request with user but no name
	body := map[string]string{}
	jsonBody, _ := json.Marshal(body)

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request, _ = http.NewRequest("POST", "/api/roles", bytes.NewBuffer(jsonBody))
	c.Request.Header.Set("Content-Type", "application/json")
	setUser(c, "user-1", "user")

	// Call handler
	CreateRole(c)

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

func Test_CreateRole_Success(t *testing.T) {
	// Setup
	gin.SetMode(gin.TestMode)
	db := setupRolesTestDB(t)
	model.SetTestDB(db)

	// Create request with user
	body := CreateRoleRequest{
		Name:        "Test Role",
		Description: "Test Description",
		Variant:     "full",
	}
	jsonBody, _ := json.Marshal(body)

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request, _ = http.NewRequest("POST", "/api/roles", bytes.NewBuffer(jsonBody))
	c.Request.Header.Set("Content-Type", "application/json")
	setUser(c, "user-1", "user")

	// Call handler
	CreateRole(c)

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
	if data["name"] != "Test Role" {
		t.Errorf("Expected name 'Test Role', got %v", data["name"])
	}
	if data["description"] != "Test Description" {
		t.Errorf("Expected description 'Test Description', got %v", data["description"])
	}
	if data["variant"] != "full" {
		t.Errorf("Expected variant 'full', got %v", data["variant"])
	}
	if data["isPublic"] != "true" {
		// Default isPublic is true when not specified
		t.Errorf("Expected isPublic 'true', got %v", data["isPublic"])
	}
}

// Test_GetRole tests GET /api/roles/:id - Get role details
func Test_GetRole_NotFound(t *testing.T) {
	// Setup
	gin.SetMode(gin.TestMode)
	db := setupRolesTestDB(t)
	model.SetTestDB(db)

	// Create request for non-existent role
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request, _ = http.NewRequest("GET", "/api/roles/nonexistent", nil)
	c.Params = gin.Params{{Key: "id", Value: "nonexistent"}}

	// Call handler
	GetRole(c)

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
	if response["error"] != "Role not found" {
		t.Errorf("Expected error 'Role not found', got %v", response["error"])
	}
}

func Test_GetRole_Success(t *testing.T) {
	// Setup
	gin.SetMode(gin.TestMode)
	db := setupRolesTestDB(t)
	model.SetTestDB(db)

	// Create test role
	role := model.Role{
		ID:          "role-1",
		UserID:      "user-1",
		Name:       "Test Role",
		Description: "Test Description",
		Variant:     "full",
		Status:      "stopped",
		IsPublic:    "true",
	}
	if err := db.Create(&role).Error; err != nil {
		t.Fatalf("failed to create role: %v", err)
	}

	// Create request
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request, _ = http.NewRequest("GET", "/api/roles/role-1", nil)
	c.Params = gin.Params{{Key: "id", Value: "role-1"}}

	// Call handler
	GetRole(c)

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
	if data["id"] != "role-1" {
		t.Errorf("Expected id 'role-1', got %v", data["id"])
	}
	if data["name"] != "Test Role" {
		t.Errorf("Expected name 'Test Role', got %v", data["name"])
	}
}

// Test_UpdateRole tests PUT /api/roles/:id - Update role metadata
func Test_UpdateRole_NotFound(t *testing.T) {
	// Setup
	gin.SetMode(gin.TestMode)
	db := setupRolesTestDB(t)
	model.SetTestDB(db)

	// Create request with user but non-existent role
	body := UpdateRoleRequest{
		Name: "Updated Name",
	}
	jsonBody, _ := json.Marshal(body)

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request, _ = http.NewRequest("PUT", "/api/roles/nonexistent", bytes.NewBuffer(jsonBody))
	c.Request.Header.Set("Content-Type", "application/json")
	c.Params = gin.Params{{Key: "id", Value: "nonexistent"}}
	setUser(c, "user-1", "user")

	// Call handler
	UpdateRole(c)

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

func Test_UpdateRole_Forbidden(t *testing.T) {
	// Setup
	gin.SetMode(gin.TestMode)
	db := setupRolesTestDB(t)
	model.SetTestDB(db)

	// Create test role belonging to different user
	role := model.Role{
		ID:     "role-1",
		UserID: "user-other",
		Name:   "Original Name",
	}
	if err := db.Create(&role).Error; err != nil {
		t.Fatalf("failed to create role: %v", err)
	}

	// Create request with different user
	body := UpdateRoleRequest{
		Name: "Updated Name",
	}
	jsonBody, _ := json.Marshal(body)

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request, _ = http.NewRequest("PUT", "/api/roles/role-1", bytes.NewBuffer(jsonBody))
	c.Request.Header.Set("Content-Type", "application/json")
	c.Params = gin.Params{{Key: "id", Value: "role-1"}}
	setUser(c, "user-1", "user") // Different user

	// Call handler
	UpdateRole(c)

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
	if response["error"] != "Forbidden: you can only update your own roles" {
		t.Errorf("Expected error 'Forbidden: you can only update your own roles', got %v", response["error"])
	}
}

func Test_UpdateRole_Success(t *testing.T) {
	// Setup
	gin.SetMode(gin.TestMode)
	db := setupRolesTestDB(t)
	model.SetTestDB(db)

	// Create test role
	role := model.Role{
		ID:     "role-1",
		UserID: "user-1",
		Name:   "Original Name",
	}
	if err := db.Create(&role).Error; err != nil {
		t.Fatalf("failed to create role: %v", err)
	}

	// Create request to update
	body := UpdateRoleRequest{
		Name:        "Updated Name",
		Description: "Updated Description",
		Variant:     "lite",
	}
	jsonBody, _ := json.Marshal(body)

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request, _ = http.NewRequest("PUT", "/api/roles/role-1", bytes.NewBuffer(jsonBody))
	c.Request.Header.Set("Content-Type", "application/json")
	c.Params = gin.Params{{Key: "id", Value: "role-1"}}
	setUser(c, "user-1", "user")

	// Call handler
	UpdateRole(c)

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
	if data["variant"] != "lite" {
		t.Errorf("Expected variant 'lite', got %v", data["variant"])
	}
}

// Test_DeleteRole tests DELETE /api/roles/:id - Delete role
func Test_DeleteRole_NotFound(t *testing.T) {
	// Setup
	gin.SetMode(gin.TestMode)
	db := setupRolesTestDB(t)
	model.SetTestDB(db)

	// Create request with user but non-existent role
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request, _ = http.NewRequest("DELETE", "/api/roles/nonexistent", nil)
	c.Params = gin.Params{{Key: "id", Value: "nonexistent"}}
	setUser(c, "user-1", "user")

	// Call handler
	DeleteRole(c)

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

func Test_DeleteRole_Forbidden(t *testing.T) {
	// Setup
	gin.SetMode(gin.TestMode)
	db := setupRolesTestDB(t)
	model.SetTestDB(db)

	// Create test role belonging to different user
	role := model.Role{
		ID:     "role-1",
		UserID: "user-other",
		Name:   "Test Role",
	}
	if err := db.Create(&role).Error; err != nil {
		t.Fatalf("failed to create role: %v", err)
	}

	// Create request with different user
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request, _ = http.NewRequest("DELETE", "/api/roles/role-1", nil)
	c.Params = gin.Params{{Key: "id", Value: "role-1"}}
	setUser(c, "user-1", "user") // Different user

	// Call handler
	DeleteRole(c)

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
	if response["error"] != "Forbidden: you can only delete your own roles" {
		t.Errorf("Expected error 'Forbidden: you can only delete your own roles', got %v", response["error"])
	}
}

func Test_DeleteRole_Success(t *testing.T) {
	// Setup
	gin.SetMode(gin.TestMode)
	db := setupRolesTestDB(t)
	model.SetTestDB(db)

	// Create test role
	role := model.Role{
		ID:     "role-1",
		UserID: "user-1",
		Name:   "Test Role",
	}
	if err := db.Create(&role).Error; err != nil {
		t.Fatalf("failed to create role: %v", err)
	}

	// Create request to delete
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request, _ = http.NewRequest("DELETE", "/api/roles/role-1", nil)
	c.Params = gin.Params{{Key: "id", Value: "role-1"}}
	setUser(c, "user-1", "user")

	// Call handler
	DeleteRole(c)

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

	// Verify role is deleted
	var deletedRole model.Role
	if err := db.First(&deletedRole, "id = ?", "role-1").Error; err == nil {
		t.Errorf("Expected role to be deleted, but it still exists")
	}
}