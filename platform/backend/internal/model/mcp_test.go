package model

import (
	"testing"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

// setupMCPTestDB creates an in-memory SQLite database for testing.
func setupMCPTestDB(t *testing.T) *gorm.DB {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("failed to connect to test database: %v", err)
	}

	// AutoMigrate tables
	if err := db.AutoMigrate(&User{}, &MCP{}); err != nil {
		t.Fatalf("failed to run auto migrate: %v", err)
	}

	return db
}

func TestMCP_CRUD(t *testing.T) {
	db := setupMCPTestDB(t)

	// Create user first
	user := User{
		Name:     "Test User",
		Slug:     "test-user-mcp",
		Password: "hashed_password",
	}
	if err := db.Create(&user).Error; err != nil {
		t.Fatalf("failed to create user: %v", err)
	}

	// Create MCP
	mcp := MCP{
		UserID:      user.ID,
		Name:        "Test MCP",
		Slug:        "test-mcp",
		Description: "A test MCP server",
		Category:    "tools",
		StorageKey:  "mcps/user123/mcp456/config.json",
		Size:        2048000,
		IsPublic:    "true",
	}
	if err := db.Create(&mcp).Error; err != nil {
		t.Fatalf("failed to create MCP: %v", err)
	}

	if mcp.ID == "" {
		t.Error("expected MCP ID to be generated")
	}

	// Read
	var found MCP
	if err := db.Preload("User").First(&found, "id = ?", mcp.ID).Error; err != nil {
		t.Fatalf("failed to find MCP: %v", err)
	}

	if found.Name != mcp.Name {
		t.Errorf("expected name %s, got %s", mcp.Name, found.Name)
	}
	if found.UserID != user.ID {
		t.Errorf("expected user_id %s, got %s", user.ID, found.UserID)
	}
	if found.Slug != mcp.Slug {
		t.Errorf("expected slug %s, got %s", mcp.Slug, found.Slug)
	}
	if found.Category != mcp.Category {
		t.Errorf("expected category %s, got %s", mcp.Category, found.Category)
	}
	if found.StorageKey != mcp.StorageKey {
		t.Errorf("expected storageKey %s, got %s", mcp.StorageKey, found.StorageKey)
	}
	if found.Size != mcp.Size {
		t.Errorf("expected size %d, got %d", mcp.Size, found.Size)
	}
	if found.IsPublic != "true" {
		t.Errorf("expected isPublic 'true', got %s", found.IsPublic)
	}

	// Update
	found.Name = "Updated MCP"
	found.IsPublic = "false"
	if err := db.Save(&found).Error; err != nil {
		t.Fatalf("failed to update MCP: %v", err)
	}

	var updated MCP
	if err := db.First(&updated, "id = ?", mcp.ID).Error; err != nil {
		t.Fatalf("failed to find updated MCP: %v", err)
	}

	if updated.Name != "Updated MCP" {
		t.Errorf("expected name 'Updated MCP', got %s", updated.Name)
	}
	if updated.IsPublic != "false" {
		t.Errorf("expected isPublic 'false', got %s", updated.IsPublic)
	}

	// Delete
	if err := db.Delete(&found).Error; err != nil {
		t.Fatalf("failed to delete MCP: %v", err)
	}

	var deleted MCP
	if err := db.First(&deleted, "id = ?", mcp.ID).Error; err == nil {
		t.Error("expected MCP to be deleted, but still exists")
	}
}

func TestMCP_SlugUnique(t *testing.T) {
	db := setupMCPTestDB(t)

	// Create user
	user := User{
		Name:     "Test User",
		Slug:     "test-user-unique-mcp",
		Password: "password",
	}
	if err := db.Create(&user).Error; err != nil {
		t.Fatalf("failed to create user: %v", err)
	}

	// Create first MCP
	mcp1 := MCP{
		UserID:    user.ID,
		Name:     "MCP One",
		Slug:     "unique-mcp-slug",
		Category: "database",
	}
	if err := db.Create(&mcp1).Error; err != nil {
		t.Fatalf("failed to create first MCP: %v", err)
	}

	// Try to create second MCP with same slug
	mcp2 := MCP{
		UserID:    user.ID,
		Name:     "MCP Two",
		Slug:     "unique-mcp-slug",
		Category: "api",
	}
	if err := db.Create(&mcp2).Error; err == nil {
		t.Error("expected error when creating MCP with duplicate slug, but got none")
	}
}

func TestMCP_IsPublicIsText(t *testing.T) {
	db := setupMCPTestDB(t)

	// Create user
	user := User{
		Name:     "Test User",
		Slug:     "test-user-public-text-mcp",
		Password: "password",
	}
	if err := db.Create(&user).Error; err != nil {
		t.Fatalf("failed to create user: %v", err)
	}

	// Create MCP with "false" (text)
	mcp := MCP{
		UserID:      user.ID,
		Name:        "Private MCP",
		Slug:        "private-mcp",
		Description: "A private MCP server",
		Category:   "security",
		IsPublic:    "false",
	}
	if err := db.Create(&mcp).Error; err != nil {
		t.Fatalf("failed to create MCP: %v", err)
	}

	var found MCP
	if err := db.First(&found, "id = ?", mcp.ID).Error; err != nil {
		t.Fatalf("failed to find MCP: %v", err)
	}

	// Verify isPublic is stored as text
	if found.IsPublic != "false" {
		t.Errorf("expected isPublic 'false', got %s", found.IsPublic)
	}
}

func TestMCP_TableName(t *testing.T) {
	mcp := MCP{}
	if mcp.TableName() != "mcps" {
		t.Errorf("expected table name 'mcps', got %s", mcp.TableName())
	}
}