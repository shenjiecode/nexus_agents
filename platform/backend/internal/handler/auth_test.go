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

	"github.com/nexus-agents/backend/internal/model"
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
		Username: "testuser",
		Email:    "test@example.com",
		Name:     "Test User",
		Password: hashedPassword,
	}
	if err := db.Create(&user).Error; err != nil {
		t.Fatalf("failed to create user: %v", err)
	}

	// Reset viper for test
	viper.Reset()

	// Create request - login with username
	body := LoginRequest{
		Login:    "testuser",
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
	if data["username"] != "testuser" {
		t.Errorf("Expected username 'testuser', got %v", data["username"])
	}
	if data["email"] != "test@example.com" {
		t.Errorf("Expected email 'test@example.com', got %v", data["email"])
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
		Username: "testuser2",
		Email:    "test2@example.com",
		Name:     "Test User",
		Password: hashedPassword,
	}
	if err := db.Create(&user).Error; err != nil {
		t.Fatalf("failed to create user: %v", err)
	}

	// Reset viper for test
	viper.Reset()

	// Create request with wrong password
	body := LoginRequest{
		Login:    "testuser2",
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
		Login:    "nonexistent",
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

func TestLogin_MissingLogin(t *testing.T) {
	// Setup
	gin.SetMode(gin.TestMode)
	db := setupTestDB(t)
	model.SetTestDB(db)

	// Reset viper for test
	viper.Reset()

	// Create request with missing login
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
	if response["error"] != "login is required" {
		t.Errorf("Expected error 'login is required', got %v", response["error"])
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
		"login": "testuser",
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
