package model

import (
	"testing"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

// setupSkillTestDB creates an in-memory SQLite database for testing.
func setupSkillTestDB(t *testing.T) *gorm.DB {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("failed to connect to test database: %v", err)
	}

	// AutoMigrate tables
	if err := db.AutoMigrate(&User{}, &Skill{}); err != nil {
		t.Fatalf("failed to run auto migrate: %v", err)
	}

	return db
}

func TestSkill_CRUD(t *testing.T) {
	db := setupSkillTestDB(t)

	// Create user first
	user := User{
		Name:     "Test User",
		Slug:     "test-user-skill",
		Password: "hashed_password",
	}
	if err := db.Create(&user).Error; err != nil {
		t.Fatalf("failed to create user: %v", err)
	}

	// Create skill
	skill := Skill{
		UserID:      user.ID,
		Name:        "Test Skill",
		Slug:        "test-skill",
		Description: "A test skill",
		Category:    "coding",
		StorageKey:  "skills/user123/skill456/package.zip",
		Size:        1024000,
		IsPublic:    "true",
	}
	if err := db.Create(&skill).Error; err != nil {
		t.Fatalf("failed to create skill: %v", err)
	}

	if skill.ID == "" {
		t.Error("expected skill ID to be generated")
	}

	// Read
	var found Skill
	if err := db.Preload("User").First(&found, "id = ?", skill.ID).Error; err != nil {
		t.Fatalf("failed to find skill: %v", err)
	}

	if found.Name != skill.Name {
		t.Errorf("expected name %s, got %s", skill.Name, found.Name)
	}
	if found.UserID != user.ID {
		t.Errorf("expected user_id %s, got %s", user.ID, found.UserID)
	}
	if found.Slug != skill.Slug {
		t.Errorf("expected slug %s, got %s", skill.Slug, found.Slug)
	}
	if found.Category != skill.Category {
		t.Errorf("expected category %s, got %s", skill.Category, found.Category)
	}
	if found.StorageKey != skill.StorageKey {
		t.Errorf("expected storageKey %s, got %s", skill.StorageKey, found.StorageKey)
	}
	if found.Size != skill.Size {
		t.Errorf("expected size %d, got %d", skill.Size, found.Size)
	}
	if found.IsPublic != "true" {
		t.Errorf("expected isPublic 'true', got %s", found.IsPublic)
	}

	// Update
	found.Name = "Updated Skill"
	found.IsPublic = "false"
	if err := db.Save(&found).Error; err != nil {
		t.Fatalf("failed to update skill: %v", err)
	}

	var updated Skill
	if err := db.First(&updated, "id = ?", skill.ID).Error; err != nil {
		t.Fatalf("failed to find updated skill: %v", err)
	}

	if updated.Name != "Updated Skill" {
		t.Errorf("expected name 'Updated Skill', got %s", updated.Name)
	}
	if updated.IsPublic != "false" {
		t.Errorf("expected isPublic 'false', got %s", updated.IsPublic)
	}

	// Delete
	if err := db.Delete(&found).Error; err != nil {
		t.Fatalf("failed to delete skill: %v", err)
	}

	var deleted Skill
	if err := db.First(&deleted, "id = ?", skill.ID).Error; err == nil {
		t.Error("expected skill to be deleted, but still exists")
	}
}

func TestSkill_SlugUnique(t *testing.T) {
	db := setupSkillTestDB(t)

	// Create user
	user := User{
		Name:     "Test User",
		Slug:     "test-user-unique",
		Password: "password",
	}
	if err := db.Create(&user).Error; err != nil {
		t.Fatalf("failed to create user: %v", err)
	}

	// Create first skill
	skill1 := Skill{
		UserID:   user.ID,
		Name:    "Skill One",
		Slug:    "unique-skill-slug",
		Category: "design",
	}
	if err := db.Create(&skill1).Error; err != nil {
		t.Fatalf("failed to create first skill: %v", err)
	}

	// Try to create second skill with same slug
	skill2 := Skill{
		UserID:   user.ID,
		Name:    "Skill Two",
		Slug:    "unique-skill-slug",
		Category: "music",
	}
	if err := db.Create(&skill2).Error; err == nil {
		t.Error("expected error when creating skill with duplicate slug, but got none")
	}
}

func TestSkill_IsPublicIsText(t *testing.T) {
	db := setupSkillTestDB(t)

	// Create user
	user := User{
		Name:     "Test User",
		Slug:     "test-user-public-text",
		Password: "password",
	}
	if err := db.Create(&user).Error; err != nil {
		t.Fatalf("failed to create user: %v", err)
	}

	// Create skill with "false" (text)
	skill := Skill{
		UserID:      user.ID,
		Name:        "Private Skill",
		Slug:        "private-skill",
		Description: "A private skill",
		Category:    "security",
		IsPublic:    "false",
	}
	if err := db.Create(&skill).Error; err != nil {
		t.Fatalf("failed to create skill: %v", err)
	}

	var found Skill
	if err := db.First(&found, "id = ?", skill.ID).Error; err != nil {
		t.Fatalf("failed to find skill: %v", err)
	}

	// Verify isPublic is stored as text
	if found.IsPublic != "false" {
		t.Errorf("expected isPublic 'false', got %s", found.IsPublic)
	}
}

func TestSkill_TableName(t *testing.T) {
	skill := Skill{}
	if skill.TableName() != "skills" {
		t.Errorf("expected table name 'skills', got %s", skill.TableName())
	}
}
