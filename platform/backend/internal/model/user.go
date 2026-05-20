package model

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// User represents a user in the system.
type User struct {
	ID        string    `gorm:"primaryKey" json:"id"`
	Username  string    `gorm:"uniqueIndex" json:"username"`  // unique username for login
	Email     string    `gorm:"uniqueIndex" json:"email"`     // unique email for login
	Name      string    `json:"name"`
	Slug      string    `gorm:"uniqueIndex" json:"slug"`
	Nickname  string    `json:"nickname"`
	Password  string    `json:"-"` // bcrypt hash, never serialized
	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
}

// TableName specifies the table name for User model.
func (User) TableName() string {
	return "users"
}

// BeforeCreate hook for generating UUID before creating a new user.
func (u *User) BeforeCreate(tx *gorm.DB) error {
	if u.ID == "" {
		u.ID = uuid.New().String()
	}
	return nil
}
