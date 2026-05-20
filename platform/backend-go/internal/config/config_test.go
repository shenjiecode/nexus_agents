package config

import (
	"testing"

	"github.com/spf13/viper"
)

func TestLoadWithDefaults(t *testing.T) {
	// Reset viper for test
	viper.Reset()

	// Don't set any values - should use defaults
	cfg, err := LoadWithDefaults()
	if err != nil {
		t.Fatalf("LoadWithDefaults failed: %v", err)
	}

	// Check defaults
	if cfg.Port != DefaultPort {
		t.Errorf("Expected port %d, got %d", DefaultPort, cfg.Port)
	}
	if cfg.LogLevel != DefaultLogLevel {
		t.Errorf("Expected log level %s, got %s", DefaultLogLevel, cfg.LogLevel)
	}
}

func TestLoadWithEnvVars(t *testing.T) {
	// Reset viper for test
	viper.Reset()

	// Set required values using viper.Set
	viper.Set("DATABASE_URL", "postgres://user:pass@localhost:5432/testdb")
	viper.Set("ADMIN_PASSWORD", "secret123")
	viper.Set("PORT", 8080)
	viper.Set("LOG_LEVEL", "debug")
	viper.Set("DOCKER_HOST", "unix:///var/run/docker.sock")

	cfg, err := Load()
	if err != nil {
		t.Fatalf("Load failed: %v", err)
	}

	// Verify values
	if cfg.DatabaseURL != "postgres://user:pass@localhost:5432/testdb" {
		t.Errorf("Expected database URL, got %s", cfg.DatabaseURL)
	}
	if cfg.AdminPassword != "secret123" {
		t.Errorf("Expected admin password, got %s", cfg.AdminPassword)
	}
	if cfg.Port != 8080 {
		t.Errorf("Expected port 8080, got %d", cfg.Port)
	}
	if cfg.LogLevel != "debug" {
		t.Errorf("Expected log level debug, got %s", cfg.LogLevel)
	}
	if cfg.DockerHost != "unix:///var/run/docker.sock" {
		t.Errorf("Expected docker host, got %s", cfg.DockerHost)
	}
}

func TestLoadMissingDatabaseURL(t *testing.T) {
	// Reset viper for test
	viper.Reset()

	// Only set admin password, not database URL
	viper.Set("ADMIN_PASSWORD", "secret123")

	_, err := Load()
	if err == nil {
		t.Error("Expected error for missing DATABASE_URL")
	}
}

func TestLoadMissingAdminPassword(t *testing.T) {
	// Reset viper for test
	viper.Reset()

	// Only set database URL, not admin password
	viper.Set("DATABASE_URL", "postgres://user:pass@localhost:5432/testdb")

	_, err := Load()
	if err == nil {
		t.Error("Expected error for missing ADMIN_PASSWORD")
	}
}

func TestDefaultPortValue(t *testing.T) {
	// Reset viper for test
	viper.Reset()

	viper.SetDefault("PORT", DefaultPort)

	var cfg struct {
		Port int `mapstructure:"PORT"`
	}
	viper.Unmarshal(&cfg)

	if cfg.Port != DefaultPort {
		t.Errorf("Expected default port %d, got %d", DefaultPort, cfg.Port)
	}
}