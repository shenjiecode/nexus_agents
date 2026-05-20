package config

import (
	"fmt"
	"time"

	"github.com/joho/godotenv"
	"github.com/spf13/viper"
)

// Config holds all configuration for the application.
// All fields are loaded from environment variables with defaults.
type Config struct {
	Port           int    `mapstructure:"PORT"`
	DatabaseURL    string `mapstructure:"DATABASE_URL"`
	DockerHost     string `mapstructure:"DOCKER_HOST"`
	LogLevel      string `mapstructure:"LOG_LEVEL"`
	AdminPassword string `mapstructure:"ADMIN_PASSWORD"`
	Environment   string `mapstructure:"ENVIRONMENT"`
}

// Default values
const (
	DefaultPort        = 13207
	DefaultLogLevel    = "info"
	DefaultEnvironment = "development"
)

// Load reads configuration from environment variables.
func Load() (*Config, error) {
	// Load .env file into process environment (silent fail if missing)
	_ = godotenv.Load()

	viper.AutomaticEnv()
	viper.BindEnv("PORT")
	viper.BindEnv("DATABASE_URL")
	viper.BindEnv("DOCKER_HOST")
	viper.BindEnv("LOG_LEVEL")
	viper.BindEnv("ADMIN_PASSWORD")
	viper.BindEnv("ENVIRONMENT")
	viper.SetDefault("PORT", DefaultPort)
	viper.SetDefault("LOG_LEVEL", DefaultLogLevel)
	viper.SetDefault("ENVIRONMENT", DefaultEnvironment)

	var cfg Config
	if err := viper.Unmarshal(&cfg); err != nil {
		return nil, fmt.Errorf("failed to unmarshal config: %w", err)
	}

	if cfg.DatabaseURL == "" {
		return nil, fmt.Errorf("DATABASE_URL is required")
	}
	if cfg.AdminPassword == "" {
		return nil, fmt.Errorf("ADMIN_PASSWORD is required")
	}
	return &cfg, nil
}

// LoadWithDefaults loads config for testing
func LoadWithDefaults() (*Config, error) {
	viper.SetEnvPrefix("")
	viper.AutomaticEnv()
	viper.SetDefault("PORT", DefaultPort)
	viper.SetDefault("LOG_LEVEL", DefaultLogLevel)
	viper.SetDefault("ENVIRONMENT", "test")

	var cfg Config
	if err := viper.Unmarshal(&cfg); err != nil {
		return nil, fmt.Errorf("failed to unmarshal config: %w", err)
	}
	return &cfg, nil
}

// GetEnv returns an environment variable or default
func GetEnv(key, defaultValue string) string {
	if value := viper.GetString(key); value != "" {
		return value
	}
	return defaultValue
}

// Duration represents a time duration
type Duration struct {
	time.Duration
}

// UnmarshalText implements encoding.TextUnmarshaler
func (d *Duration) UnmarshalText(text []byte) error {
	var err error
	d.Duration, err = time.ParseDuration(string(text))
	return err
}