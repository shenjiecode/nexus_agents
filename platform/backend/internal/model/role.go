package model

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// Role represents a role in the system.
type Role struct {
	ID            string    `gorm:"primaryKey" json:"id"`
	UserID        string    `gorm:"index" json:"userId"`
	User          User      `gorm:"foreignKey:UserID" json:"-"`
	Name          string    `json:"name"`
	Description   string    `json:"description"`
	Variant       string    `json:"variant"`
	Status        string    `json:"status"`
	ContainerID  string    `json:"containerId"`
	ContainerPort int     `json:"containerPort"`
	IsPublic     string    `json:"isPublic"` // text, not boolean (matches Node.js)
	ModifiedAt   *time.Time `json:"modifiedAt"`  // 本地修改时间
	UploadedAt   *time.Time `json:"uploadedAt"`  // OSS 上传时间
	CreatedAt    time.Time `json:"createdAt"`
	UpdatedAt    time.Time `json:"updatedAt"`
}

// TableName specifies the table name for Role model.
func (Role) TableName() string {
	return "roles"
}

// BeforeCreate hook for generating UUID before creating a new role.
func (r *Role) BeforeCreate(tx *gorm.DB) error {
	if r.ID == "" {
		r.ID = uuid.New().String()
	}
	return nil
}