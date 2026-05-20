package handler

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/spf13/viper"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"

	"github.com/nexus-agents/backend-go/internal/model"
)

// setupTestDB creates an in-memory SQLite database for testing.
func setupTestDB(t *testing.T) *gorm.DB {
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

// hashPassword creates a bcrypt hash of the password.
func hashPassword(t *testing.T, password string) string {
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		t.Fatalf("failed to hash password: %v", err)
	}
	return string(hash)
}

func TestLogin_Success(t *testing.T) {
	// Setup
	gin.SetMode(gin.TestMode)
	db := setupTestDB(t)

	// Set global db
	model.SetTestDB(db)

	// Create test user
	hashedPassword := hashPassword(t, "testpass")
	user := model.User{
		Name:     "Test User",
		Slug:     "testuser",
		Password: hashedPassword,
	}
	if err := db.Create(&user).Error; err != nil {
		t.Fatalf("failed to create user: %v", err)
	}

	// Reset viper for test
	viper.Reset()

	// Create request
	body := LoginRequest{
		Slug:     "testuser",
		Password: "testpass",
	}
	jsonBody, _ := json.Marshal(body)

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request, _ = http.NewRequest("POST", "/api/auth/login", bytes.NewBuffer(jsonBody))
	c.Request.Header.Set("Content-Type", "application/json")

	// Call handler
	Login(c)

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
	if data["id"] != user.ID {
		t.Errorf("Expected id %s, got %v", user.ID, data["id"])
	}
	if data["name"] != "Test User" {
		t.Errorf("Expected name 'Test User', got %v", data["name"])
	}
	if data["slug"] != "testuser" {
		t.Errorf("Expected slug 'testuser', got %v", data["slug"])
	}
	if data["role"] != "user" {
		t.Errorf("Expected role 'user', got %v", data["role"])
	}
}

func TestLogin_WrongPassword(t *testing.T) {
	// Setup
	gin.SetMode(gin.TestMode)
	db := setupTestDB(t)
	model.SetTestDB(db)

	// Create test user
	hashedPassword := hashPassword(t, "testpass")
	user := model.User{
		Name:     "Test User",
		Slug:     "testuser2",
		Password: hashedPassword,
	}
	if err := db.Create(&user).Error; err != nil {
		t.Fatalf("failed to create user: %v", err)
	}

	// Reset viper for test
	viper.Reset()

	// Create request with wrong password
	body := LoginRequest{
		Slug:     "testuser2",
		Password: "wrongpassword",
	}
	jsonBody, _ := json.Marshal(body)

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request, _ = http.NewRequest("POST", "/api/auth/login", bytes.NewBuffer(jsonBody))
	c.Request.Header.Set("Content-Type", "application/json")

	// Call handler
	Login(c)

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
	if response["error"] != "Invalid credentials" {
		t.Errorf("Expected error 'Invalid credentials', got %v", response["error"])
	}
}

func TestLogin_UserNotFound(t *testing.T) {
	// Setup
	gin.SetMode(gin.TestMode)
	db := setupTestDB(t)
	model.SetTestDB(db)

	// Reset viper for test
	viper.Reset()

	// Create request for non-existent user
	body := LoginRequest{
		Slug:     "nonexistent",
		Password: "testpass",
	}
	jsonBody, _ := json.Marshal(body)

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request, _ = http.NewRequest("POST", "/api/auth/login", bytes.NewBuffer(jsonBody))
	c.Request.Header.Set("Content-Type", "application/json")

	// Call handler
	Login(c)

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
	if response["error"] != "Invalid credentials" {
		t.Errorf("Expected error 'Invalid credentials', got %v", response["error"])
	}
}

func TestLogin_MissingSlug(t *testing.T) {
	// Setup
	gin.SetMode(gin.TestMode)
	db := setupTestDB(t)
	model.SetTestDB(db)

	// Reset viper for test
	viper.Reset()

	// Create request with missing slug
	body := map[string]string{
		"password": "testpass",
	}
	jsonBody, _ := json.Marshal(body)

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request, _ = http.NewRequest("POST", "/api/auth/login", bytes.NewBuffer(jsonBody))
	c.Request.Header.Set("Content-Type", "application/json")

	// Call handler
	Login(c)

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
	if response["error"] != "slug is required" {
		t.Errorf("Expected error 'slug is required', got %v", response["error"])
	}
}

func TestLogin_MissingPassword(t *testing.T) {
	// Setup
	gin.SetMode(gin.TestMode)
	db := setupTestDB(t)
	model.SetTestDB(db)

	// Reset viper for test
	viper.Reset()

	// Create request with missing password
	body := map[string]string{
		"slug": "testuser",
	}
	jsonBody, _ := json.Marshal(body)

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request, _ = http.NewRequest("POST", "/api/auth/login", bytes.NewBuffer(jsonBody))
	c.Request.Header.Set("Content-Type", "application/json")

	// Call handler
	Login(c)

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
	if response["error"] != "password is required" {
		t.Errorf("Expected error 'password is required', got %v", response["error"])
	}
}

func TestAdminLogin_Success(t *testing.T) {
	// Setup
	gin.SetMode(gin.TestMode)
	db := setupTestDB(t)
	model.SetTestDB(db)

	// Reset viper and set admin password
	viper.Reset()
	viper.Set("ADMIN_PASSWORD", "adminsecret")

	// Create request
	body := AdminLoginRequest{
		Password: "adminsecret",
	}
	jsonBody, _ := json.Marshal(body)

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request, _ = http.NewRequest("POST", "/api/auth/admin-login", bytes.NewBuffer(jsonBody))
	c.Request.Header.Set("Content-Type", "application/json")

	// Call handler
	AdminLogin(c)

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
	if data["id"] != "admin" {
		t.Errorf("Expected id 'admin', got %v", data["id"])
	}
	if data["name"] != "Admin" {
		t.Errorf("Expected name 'Admin', got %v", data["name"])
	}
	if data["slug"] != "admin" {
		t.Errorf("Expected slug 'admin', got %v", data["slug"])
	}
	if data["role"] != "admin" {
		t.Errorf("Expected role 'admin', got %v", data["role"])
	}
}

func TestAdminLogin_WrongPassword(t *testing.T) {
	// Setup
	gin.SetMode(gin.TestMode)
	db := setupTestDB(t)
	model.SetTestDB(db)

	// Reset viper and set admin password
	viper.Reset()
	viper.Set("ADMIN_PASSWORD", "adminsecret")

	// Create request with wrong password
	body := AdminLoginRequest{
		Password: "wrongpassword",
	}
	jsonBody, _ := json.Marshal(body)

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request, _ = http.NewRequest("POST", "/api/auth/admin-login", bytes.NewBuffer(jsonBody))
	c.Request.Header.Set("Content-Type", "application/json")

	// Call handler
	AdminLogin(c)

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
	if response["error"] != "Invalid credentials" {
		t.Errorf("Expected error 'Invalid credentials', got %v", response["error"])
	}
}

func TestAdminLogin_NotConfigured(t *testing.T) {
	// Setup
	gin.SetMode(gin.TestMode)
	db := setupTestDB(t)
	model.SetTestDB(db)

	// Reset viper - don't set admin password
	viper.Reset()

	// Create request
	body := AdminLoginRequest{
		Password: "anypassword",
	}
	jsonBody, _ := json.Marshal(body)

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request, _ = http.NewRequest("POST", "/api/auth/admin-login", bytes.NewBuffer(jsonBody))
	c.Request.Header.Set("Content-Type", "application/json")

	// Call handler
	AdminLogin(c)

	// Assert
	if w.Code != http.StatusServiceUnavailable {
		t.Errorf("Expected status 503, got %d", w.Code)
		t.Logf("Response: %s", w.Body.String())
	}

	var response map[string]interface{}
	if err := json.Unmarshal(w.Body.Bytes(), &response); err != nil {
		t.Fatalf("failed to unmarshal response: %v", err)
	}

	if response["success"] != false {
		t.Errorf("Expected success to be false, got %v", response["success"])
	}
	if response["error"] != "Admin login not configured" {
		t.Errorf("Expected error 'Admin login not configured', got %v", response["error"])
	}
}

func TestAdminLogin_MissingPassword(t *testing.T) {
	// Setup
	gin.SetMode(gin.TestMode)
	db := setupTestDB(t)
	model.SetTestDB(db)

	// Reset viper
	viper.Reset()

	// Create request with missing password
	body := map[string]string{}
	jsonBody, _ := json.Marshal(body)

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request, _ = http.NewRequest("POST", "/api/auth/admin-login", bytes.NewBuffer(jsonBody))
	c.Request.Header.Set("Content-Type", "application/json")

	// Call handler
	AdminLogin(c)

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
	if response["error"] != "password is required" {
		t.Errorf("Expected error 'password is required', got %v", response["error"])
	}
}