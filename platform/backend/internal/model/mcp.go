package model

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// MCP represents an MCP server package in the system.
type MCP struct {
	ID          string    `gorm:"primaryKey" json:"id"`
	UserID      string    `gorm:"index" json:"userId"`
	User        User      `gorm:"foreignKey:UserID" json:"-"`
	Name        string    `json:"name"`
	Slug        string    `gorm:"uniqueIndex" json:"slug"`
	Description string  `json:"description"`
	Category    string   `json:"category"`
	StorageKey  string   `json:"storageKey"` // OSS path like "mcps/{userId}/{mcpId}/config.json"
	Size        int64    `json:"size"`       // file size in bytes
	IsPublic    string   `json:"isPublic"`   // text, not boolean (matches Node.js)
	CreatedAt   time.Time `json:"createdAt"`
	UpdatedAt  time.Time `json:"updatedAt"`
}

// TableName specifies the table name for MCP model.
func (MCP) TableName() string {
	return "mcps"
}

// BeforeCreate hook for generating UUID before creating a new MCP.
func (m *MCP) BeforeCreate(tx *gorm.DB) error {
	if m.ID == "" {
		m.ID = uuid.New().String()
	}
	return nil
}