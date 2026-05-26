package model

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// Container represents a user container in the system.
type Container struct {
	ID          string    `gorm:"primaryKey" json:"id"`
	UserID      string    `gorm:"index" json:"userId"`
	User       User      `gorm:"foreignKey:UserID" json:"-"`
	Name       string    `json:"name"`
	Description string  `json:"description"`
	Variant    string    `json:"variant"` // kept for record, image is always sipeed/picoclaw:latest
	RoleID     *string   `json:"roleId"` // optional, references role
	ContainerID string   `json:"containerId"` // Docker container ID
	Port       int       `json:"port"`
	SSHPort    int       `json:"sshPort"`
	Status     string    `json:"status"` // running, stopped, creating, error
	Image      string    `json:"image"`
	CreatedAt  time.Time `json:"createdAt"`
	UpdatedAt  time.Time `json:"updatedAt"`
}

// TableName specifies the table name for Container model.
func (Container) TableName() string {
	return "user_containers"
}

// BeforeCreate hook for generating UUID before creating a new container.
func (c *Container) BeforeCreate(tx *gorm.DB) error {
	if c.ID == "" {
		c.ID = uuid.New().String()
	}
	return nil
}