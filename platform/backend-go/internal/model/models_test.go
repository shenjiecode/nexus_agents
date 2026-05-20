package model

import (
	"testing"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

// setupTestDB creates an in-memory SQLite database for testing.
func setupTestDB(t *testing.T) *gorm.DB {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("failed to connect to test database: %v", err)
	}

	// AutoMigrate tables
	if err := db.AutoMigrate(&User{}, &Role{}); err != nil {
		t.Fatalf("failed to run auto migrate: %v", err)
	}

	return db
}

func TestUser_CRUD(t *testing.T) {
	db := setupTestDB(t)

	// Create
	user := User{
		Name:     "Test User",
		Slug:     "test-user",
		Password: "hashed_password",
	}
	if err := db.Create(&user).Error; err != nil {
		t.Fatalf("failed to create user: %v", err)
	}

	if user.ID == "" {
		t.Error("expected user ID to be generated")
	}

	// Read
	var found User
	if err := db.First(&found, "id = ?", user.ID).Error; err != nil {
		t.Fatalf("failed to find user: %v", err)
	}

	if found.Name != user.Name {
		t.Errorf("expected name %s, got %s", user.Name, found.Name)
	}
	if found.Slug != user.Slug {
		t.Errorf("expected slug %s, got %s", user.Slug, found.Slug)
	}
	// Password should not be serialized (but is stored in DB)
	if found.Password != user.Password {
		t.Errorf("expected password %s, got %s", user.Password, found.Password)
	}

	// Update
	found.Name = "Updated User"
	if err := db.Save(&found).Error; err != nil {
		t.Fatalf("failed to update user: %v", err)
	}

	var updated User
	if err := db.First(&updated, "id = ?", user.ID).Error; err != nil {
		t.Fatalf("failed to find updated user: %v", err)
	}

	if updated.Name != "Updated User" {
		t.Errorf("expected name 'Updated User', got %s", updated.Name)
	}

	// Delete
	if err := db.Delete(&found).Error; err != nil {
		t.Fatalf("failed to delete user: %v", err)
	}

	var deleted User
	if err := db.First(&deleted, "id = ?", user.ID).Error; err == nil {
		t.Error("expected user to be deleted, but still exists")
	}
}

func TestRole_CRUD(t *testing.T) {
	db := setupTestDB(t)

	// Create user first
	user := User{
		Name:     "Test User",
		Slug:     "test-user-role",
		Password: "hashed_password",
	}
	if err := db.Create(&user).Error; err != nil {
		t.Fatalf("failed to create user: %v", err)
	}

	// Create role
	role := Role{
		UserID:        user.ID,
		Name:          "Test Role",
		Description:   "A test role",
		Variant:       "full",
		Status:        "stopped",
		ContainerID:   "container-123",
		ContainerPort: 4096,
		IsPublic:      "true",
	}
	if err := db.Create(&role).Error; err != nil {
		t.Fatalf("failed to create role: %v", err)
	}

	if role.ID == "" {
		t.Error("expected role ID to be generated")
	}

	// Read
	var found Role
	if err := db.Preload("User").First(&found, "id = ?", role.ID).Error; err != nil {
		t.Fatalf("failed to find role: %v", err)
	}

	if found.Name != role.Name {
		t.Errorf("expected name %s, got %s", role.Name, found.Name)
	}
	if found.UserID != user.ID {
		t.Errorf("expected user_id %s, got %s", user.ID, found.UserID)
	}
	if found.IsPublic != "true" {
		t.Errorf("expected isPublic 'true', got %s", found.IsPublic)
	}

	// Update
	found.Status = "running"
	found.ContainerPort = 5000
	if err := db.Save(&found).Error; err != nil {
		t.Fatalf("failed to update role: %v", err)
	}

	var updated Role
	if err := db.First(&updated, "id = ?", role.ID).Error; err != nil {
		t.Fatalf("failed to find updated role: %v", err)
	}

	if updated.Status != "running" {
		t.Errorf("expected status 'running', got %s", updated.Status)
	}
	if updated.ContainerPort != 5000 {
		t.Errorf("expected containerPort 5000, got %d", updated.ContainerPort)
	}

	// Delete
	if err := db.Delete(&found).Error; err != nil {
		t.Fatalf("failed to delete role: %v", err)
	}

	var deleted Role
	if err := db.First(&deleted, "id = ?", role.ID).Error; err == nil {
		t.Error("expected role to be deleted, but still exists")
	}
}

func TestUser_SlugUnique(t *testing.T) {
	db := setupTestDB(t)

	// Create first user
	user1 := User{
		Name:     "User One",
		Slug:     "unique-slug",
		Password: "password1",
	}
	if err := db.Create(&user1).Error; err != nil {
		t.Fatalf("failed to create first user: %v", err)
	}

	// Try to create second user with same slug
	user2 := User{
		Name:     "User Two",
		Slug:     "unique-slug",
		Password: "password2",
	}
	if err := db.Create(&user2).Error; err == nil {
		t.Error("expected error when creating user with duplicate slug, but got none")
	}
}

func TestRole_IsPublicIsText(t *testing.T) {
	db := setupTestDB(t)

	// Create user
	user := User{
		Name:     "Test User",
		Slug:     "test-user-public",
		Password: "password",
	}
	if err := db.Create(&user).Error; err != nil {
		t.Fatalf("failed to create user: %v", err)
	}

	// Create role with "false" (text)
	role := Role{
		UserID:      user.ID,
		Name:        "Private Role",
		Description: "A private role",
		IsPublic:    "false",
	}
	if err := db.Create(&role).Error; err != nil {
		t.Fatalf("failed to create role: %v", err)
	}

	var found Role
	if err := db.First(&found, "id = ?", role.ID).Error; err != nil {
		t.Fatalf("failed to find role: %v", err)
	}

	// Verify isPublic is stored as text
	if found.IsPublic != "false" {
		t.Errorf("expected isPublic 'false', got %s", found.IsPublic)
	}
}
