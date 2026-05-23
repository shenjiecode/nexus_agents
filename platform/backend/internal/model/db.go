package model

import (
	"fmt"
	"time"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"

	"github.com/nexus-agents/backend/internal/config"
)

// db is the global database connection.
var db *gorm.DB

// GetDB returns the global database connection.
func GetDB() *gorm.DB {
	return db
}

// InitDB initializes the database connection and runs AutoMigrate.
func InitDB(cfg *config.Config) (*gorm.DB, error) {
	if cfg == nil || cfg.DatabaseURL == "" {
		return nil, fmt.Errorf("DATABASE_URL is required")
	}

	var err error
	db, err = gorm.Open(postgres.Open(cfg.DatabaseURL), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Info),
	})
	if err != nil {
		return nil, fmt.Errorf("failed to connect to database: %w", err)
	}

	// Run AutoMigrate
	if err := db.AutoMigrate(&User{}, &Role{}, &PasswordResetToken{}, &Container{}, &Skill{}, &MCP{}); err != nil {
		return nil, fmt.Errorf("failed to run auto migrate: %w", err)
	}

	// Get underlying SQL db for connection pool settings
	sqlDB, err := db.DB()
	if err != nil {
		return nil, fmt.Errorf("failed to get underlying sql.DB: %w", err)
	}

	// Set connection pool settings
	sqlDB.SetMaxIdleConns(10)
	sqlDB.SetMaxOpenConns(100)
	sqlDB.SetConnMaxLifetime(time.Hour)

	return db, nil
}

// CloseDB closes the database connection.
func CloseDB() error {
	if db != nil {
		sqlDB, err := db.DB()
		if err != nil {
			return err
		}
		return sqlDB.Close()
	}
	return nil
}

// SetTestDB sets the global database connection (for testing).
func SetTestDB(testDB *gorm.DB) {
	db = testDB
}