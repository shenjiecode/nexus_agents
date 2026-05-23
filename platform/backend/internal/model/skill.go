package model

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// Skill represents a skill package in the system.
type Skill struct {
	ID          string    `gorm:"primaryKey" json:"id"`
	UserID      string    `gorm:"index" json:"userId"`
	User        User      `gorm:"foreignKey:UserID" json:"-"`
	Name        string    `json:"name"`
	Slug        string    `gorm:"uniqueIndex" json:"slug"`
	Description string  `json:"description"`
	Category    string   `json:"category"`
	StorageKey  string   `json:"storageKey"` // OSS path like "skills/{userId}/{skillId}/package.zip"
	Size        int64    `json:"size"`        // file size in bytes
	IsPublic    string   `json:"isPublic"`    // text, not boolean (matches Node.js)
	CreatedAt   time.Time `json:"createdAt"`
	UpdatedAt  time.Time `json:"updatedAt"`
}

// TableName specifies the table name for Skill model.
func (Skill) TableName() string {
	return "skills"
}

// BeforeCreate hook for generating UUID before creating a new skill.
func (s *Skill) BeforeCreate(tx *gorm.DB) error {
	if s.ID == "" {
		s.ID = uuid.New().String()
	}
	return nil
}