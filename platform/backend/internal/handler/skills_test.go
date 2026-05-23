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

// setupSkillsTestDB creates an in-memory SQLite database for testing.
func setupSkillsTestDB(t *testing.T) *gorm.DB {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("failed to connect to test database: %v", err)
	}

	// AutoMigrate tables
	if err := db.AutoMigrate(&model.User{}, &model.Skill{}); err != nil {
		t.Fatalf("failed to run auto migrate: %v", err)
	}

	return db
}

// CreateSkillRequest represents the request body for creating a skill.
type CreateSkillRequest struct {
	Name        string `json:"name"`
	Description string `json:"description"`
	Category    string `json:"category"`
	IsPublic    string `json:"isPublic"`
}

// UpdateSkillRequest represents the request body for updating a skill.
type UpdateSkillRequest struct {
	Name        string `json:"name"`
	Description string `json:"description"`
	Category    string `json:"category"`
	IsPublic    string `json:"isPublic"`
}

// TestListSkills tests GET /api/skills - List all public skills
func TestListSkills(t *testing.T) {
	// Setup
	gin.SetMode(gin.TestMode)
	db := setupSkillsTestDB(t)
	model.SetTestDB(db)

	// Create test skills
	skills := []model.Skill{
		{
			ID:          "skill-1",
			UserID:      "user-1",
			Name:        "Public Skill 1",
			Slug:        "public-skill-1",
			Description: "A public skill",
			Category:    "development",
			IsPublic:    "true",
		},
		{
			ID:          "skill-2",
			UserID:      "user-2",
			Name:        "Private Skill",
			Slug:        "private-skill",
			Description: "A private skill",
			Category:    "development",
			IsPublic:    "false",
		},
		{
			ID:          "skill-3",
			UserID:      "user-3",
			Name:        "Public Skill 2",
			Slug:        "public-skill-2",
			Description: "Another public skill",
			Category:    "testing",
			IsPublic:    "true",
		},
	}

	for _, skill := range skills {
		if err := db.Create(&skill).Error; err != nil {
			t.Fatalf("failed to create skill: %v", err)
		}
	}

	// Create request
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request, _ = http.NewRequest("GET", "/api/skills", nil)

	// Call handler
	ListSkills(c)

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
		t.Errorf("Expected 2 public skills, got %d", len(data))
	}
}

// TestGetMySkills_Unauthenticated tests GET /api/skills/mine without auth
func TestGetMySkills_Unauthenticated(t *testing.T) {
	// Setup
	gin.SetMode(gin.TestMode)
	db := setupSkillsTestDB(t)
	model.SetTestDB(db)

	// Create request without user
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request, _ = http.NewRequest("GET", "/api/skills/mine", nil)

	// Call handler
	GetMySkills(c)

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

// TestGetMySkills_Success tests GET /api/skills/mine with auth
func TestGetMySkills_Success(t *testing.T) {
	// Setup
	gin.SetMode(gin.TestMode)
	db := setupSkillsTestDB(t)
	model.SetTestDB(db)

	// Create test skills
	skills := []model.Skill{
		{
			ID:          "skill-user1-1",
			UserID:      "user-1",
			Name:        "User 1 Skill 1",
			Slug:        "user-1-skill-1",
			Description: "User 1 first skill",
			Category:    "development",
			IsPublic:    "true",
		},
		{
			ID:          "skill-user1-2",
			UserID:      "user-1",
			Name:        "User 1 Skill 2",
			Slug:        "user-1-skill-2",
			Description: "User 1 second skill",
			Category:    "testing",
			IsPublic:    "false",
		},
		{
			ID:          "skill-user-2",
			UserID:      "user-2",
			Name:        "User 2 Skill",
			Slug:        "user-2-skill",
			Description: "User 2 skill",
			Category:    "development",
			IsPublic:    "true",
		},
	}

	for _, skill := range skills {
		if err := db.Create(&skill).Error; err != nil {
			t.Fatalf("failed to create skill: %v", err)
		}
	}

	// Create request with user
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request, _ = http.NewRequest("GET", "/api/skills/mine", nil)
	setUser(c, "user-1")

	// Call handler
	GetMySkills(c)

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
		t.Errorf("Expected 2 skills for user-1, got %d", len(data))
	}
}

// TestCreateSkill_Unauthenticated tests POST /api/skills without auth
func TestCreateSkill_Unauthenticated(t *testing.T) {
	// Setup
	gin.SetMode(gin.TestMode)
	db := setupSkillsTestDB(t)
	model.SetTestDB(db)

	// Create request without user
	body := CreateSkillRequest{
		Name:        "New Skill",
		Description: "Test Description",
		Category:    "development",
	}
	jsonBody, _ := json.Marshal(body)

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request, _ = http.NewRequest("POST", "/api/skills", bytes.NewBuffer(jsonBody))
	c.Request.Header.Set("Content-Type", "application/json")

	// Call handler
	CreateSkill(c)

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

// TestCreateSkill_MissingName tests POST /api/skills with missing name
func TestCreateSkill_MissingName(t *testing.T) {
	// Setup
	gin.SetMode(gin.TestMode)
	db := setupSkillsTestDB(t)
	model.SetTestDB(db)

	// Create request with user but no name
	body := map[string]string{}
	jsonBody, _ := json.Marshal(body)

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request, _ = http.NewRequest("POST", "/api/skills", bytes.NewBuffer(jsonBody))
	c.Request.Header.Set("Content-Type", "application/json")
	setUser(c, "user-1")

	// Call handler
	CreateSkill(c)

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

// TestCreateSkill_Success tests POST /api/skills with valid data
func TestCreateSkill_Success(t *testing.T) {
	// Setup
	gin.SetMode(gin.TestMode)
	db := setupSkillsTestDB(t)
	model.SetTestDB(db)

	// Create request with user
	body := CreateSkillRequest{
		Name:        "Test Skill",
		Description: "Test Description",
		Category:    "development",
		IsPublic:    "true",
	}
	jsonBody, _ := json.Marshal(body)

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request, _ = http.NewRequest("POST", "/api/skills", bytes.NewBuffer(jsonBody))
	c.Request.Header.Set("Content-Type", "application/json")
	setUser(c, "user-1")

	// Call handler
	CreateSkill(c)

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
	if data["name"] != "Test Skill" {
		t.Errorf("Expected name 'Test Skill', got %v", data["name"])
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

// TestGetSkill_NotFound tests GET /api/skills/:id for non-existent skill
func TestGetSkill_NotFound(t *testing.T) {
	// Setup
	gin.SetMode(gin.TestMode)
	db := setupSkillsTestDB(t)
	model.SetTestDB(db)

	// Create request for non-existent skill
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request, _ = http.NewRequest("GET", "/api/skills/nonexistent", nil)
	c.Params = gin.Params{{Key: "id", Value: "nonexistent"}}

	// Call handler
	GetSkill(c)

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
	if response["error"] != "Skill not found" {
		t.Errorf("Expected error 'Skill not found', got %v", response["error"])
	}
}

// TestGetSkill_Success tests GET /api/skills/:id for existing skill
func TestGetSkill_Success(t *testing.T) {
	// Setup
	gin.SetMode(gin.TestMode)
	db := setupSkillsTestDB(t)
	model.SetTestDB(db)

	// Create test skill
	skill := model.Skill{
		ID:          "skill-1",
		UserID:      "user-1",
		Name:        "Test Skill",
		Slug:        "test-skill",
		Description: "Test Description",
		Category:    "development",
		IsPublic:    "true",
	}
	if err := db.Create(&skill).Error; err != nil {
		t.Fatalf("failed to create skill: %v", err)
	}

	// Create request
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request, _ = http.NewRequest("GET", "/api/skills/skill-1", nil)
	c.Params = gin.Params{{Key: "id", Value: "skill-1"}}

	// Call handler
	GetSkill(c)

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
	if data["id"] != "skill-1" {
		t.Errorf("Expected id 'skill-1', got %v", data["id"])
	}
	if data["name"] != "Test Skill" {
		t.Errorf("Expected name 'Test Skill', got %v", data["name"])
	}
}

// TestUpdateSkill_NotFound tests PUT /api/skills/:id for non-existent skill
func TestUpdateSkill_NotFound(t *testing.T) {
	// Setup
	gin.SetMode(gin.TestMode)
	db := setupSkillsTestDB(t)
	model.SetTestDB(db)

	// Create request with user but non-existent skill
	body := UpdateSkillRequest{
		Name: "Updated Name",
	}
	jsonBody, _ := json.Marshal(body)

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request, _ = http.NewRequest("PUT", "/api/skills/nonexistent", bytes.NewBuffer(jsonBody))
	c.Request.Header.Set("Content-Type", "application/json")
	c.Params = gin.Params{{Key: "id", Value: "nonexistent"}}
	setUser(c, "user-1")

	// Call handler
	UpdateSkill(c)

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

// TestUpdateSkill_Forbidden tests PUT /api/skills/:id for another user's skill
func TestUpdateSkill_Forbidden(t *testing.T) {
	// Setup
	gin.SetMode(gin.TestMode)
	db := setupSkillsTestDB(t)
	model.SetTestDB(db)

	// Create test skill belonging to different user
	skill := model.Skill{
		ID:       "skill-1",
		UserID:   "user-other",
		Name:     "Original Name",
		Slug:     "original-name",
		Category: "development",
	}
	if err := db.Create(&skill).Error; err != nil {
		t.Fatalf("failed to create skill: %v", err)
	}

	// Create request with different user
	body := UpdateSkillRequest{
		Name: "Updated Name",
	}
	jsonBody, _ := json.Marshal(body)

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request, _ = http.NewRequest("PUT", "/api/skills/skill-1", bytes.NewBuffer(jsonBody))
	c.Request.Header.Set("Content-Type", "application/json")
	c.Params = gin.Params{{Key: "id", Value: "skill-1"}}
	setUser(c, "user-1") // Different user

	// Call handler
	UpdateSkill(c)

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
	if response["error"] != "Forbidden: you can only update your own skills" {
		t.Errorf("Expected error 'Forbidden: you can only update your own skills', got %v", response["error"])
	}
}

// TestUpdateSkill_Success tests PUT /api/skills/:id with valid data
func TestUpdateSkill_Success(t *testing.T) {
	// Setup
	gin.SetMode(gin.TestMode)
	db := setupSkillsTestDB(t)
	model.SetTestDB(db)

	// Create test skill
	skill := model.Skill{
		ID:       "skill-1",
		UserID:   "user-1",
		Name:     "Original Name",
		Slug:     "original-name",
		Category: "development",
	}
	if err := db.Create(&skill).Error; err != nil {
		t.Fatalf("failed to create skill: %v", err)
	}

	// Create request to update
	body := UpdateSkillRequest{
		Name:        "Updated Name",
		Description: "Updated Description",
		Category:    "testing",
	}
	jsonBody, _ := json.Marshal(body)

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request, _ = http.NewRequest("PUT", "/api/skills/skill-1", bytes.NewBuffer(jsonBody))
	c.Request.Header.Set("Content-Type", "application/json")
	c.Params = gin.Params{{Key: "id", Value: "skill-1"}}
	setUser(c, "user-1")

	// Call handler
	UpdateSkill(c)

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

// TestDeleteSkill_NotFound tests DELETE /api/skills/:id for non-existent skill
func TestDeleteSkill_NotFound(t *testing.T) {
	// Setup
	gin.SetMode(gin.TestMode)
	db := setupSkillsTestDB(t)
	model.SetTestDB(db)

	// Create request with user but non-existent skill
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request, _ = http.NewRequest("DELETE", "/api/skills/nonexistent", nil)
	c.Params = gin.Params{{Key: "id", Value: "nonexistent"}}
	setUser(c, "user-1")

	// Call handler
	DeleteSkill(c)

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

// TestDeleteSkill_Forbidden tests DELETE /api/skills/:id for another user's skill
func TestDeleteSkill_Forbidden(t *testing.T) {
	// Setup
	gin.SetMode(gin.TestMode)
	db := setupSkillsTestDB(t)
	model.SetTestDB(db)

	// Create test skill belonging to different user
	skill := model.Skill{
		ID:       "skill-1",
		UserID:   "user-other",
		Name:     "Test Skill",
		Slug:     "test-skill",
		Category: "development",
	}
	if err := db.Create(&skill).Error; err != nil {
		t.Fatalf("failed to create skill: %v", err)
	}

	// Create request with different user
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request, _ = http.NewRequest("DELETE", "/api/skills/skill-1", nil)
	c.Params = gin.Params{{Key: "id", Value: "skill-1"}}
	setUser(c, "user-1") // Different user

	// Call handler
	DeleteSkill(c)

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
	if response["error"] != "Forbidden: you can only delete your own skills" {
		t.Errorf("Expected error 'Forbidden: you can only delete your own skills', got %v", response["error"])
	}
}

// TestDeleteSkill_Success tests DELETE /api/skills/:id with valid data
func TestDeleteSkill_Success(t *testing.T) {
	// Setup
	gin.SetMode(gin.TestMode)
	db := setupSkillsTestDB(t)
	model.SetTestDB(db)

	// Create test skill
	skill := model.Skill{
		ID:       "skill-1",
		UserID:   "user-1",
		Name:     "Test Skill",
		Slug:     "test-skill",
		Category: "development",
	}
	if err := db.Create(&skill).Error; err != nil {
		t.Fatalf("failed to create skill: %v", err)
	}

	// Create request to delete
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request, _ = http.NewRequest("DELETE", "/api/skills/skill-1", nil)
	c.Params = gin.Params{{Key: "id", Value: "skill-1"}}
	setUser(c, "user-1")

	// Call handler
	DeleteSkill(c)

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

	// Verify skill is deleted
	var deletedSkill model.Skill
	if err := db.First(&deletedSkill, "id = ?", "skill-1").Error; err == nil {
		t.Errorf("Expected skill to be deleted, but it still exists")
	}
}