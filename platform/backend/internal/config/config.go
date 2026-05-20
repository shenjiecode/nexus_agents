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
Port        int    `mapstructure:"PORT"`
DatabaseURL string `mapstructure:"DATABASE_URL"`
DockerHost  string `mapstructure:"DOCKER_HOST"`
LogLevel    string `mapstructure:"LOG_LEVEL"`
Environment string `mapstructure:"ENVIRONMENT"`
// SMTP Configuration
SMTPHost     string `mapstructure:"SMTP_HOST"`
SMTPPort     int    `mapstructure:"SMTP_PORT"`
SMTPUser     string `mapstructure:"SMTP_USER"`
SMTPPassword string `mapstructure:"SMTP_PASSWORD"`
SMTPFrom     string `mapstructure:"SMTP_FROM"`
	FrontendURL  string `mapstructure:"FRONTEND_URL"`
	// OSS Configuration
	OSSEndpoint        string `mapstructure:"OSS_ENDPOINT"`
	OSSBucket          string `mapstructure:"OSS_BUCKET"`
	OSSAccessKeyID     string `mapstructure:"OSS_ACCESS_KEY_ID"`
	OSSAccessKeySecret string `mapstructure:"OSS_ACCESS_KEY_SECRET"`
	OSSRegion          string `mapstructure:"OSS_REGION"`
}
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
	viper.BindEnv("ENVIRONMENT")
	viper.BindEnv("SMTP_HOST")
	viper.BindEnv("SMTP_PORT")
	viper.BindEnv("SMTP_USER")
	viper.BindEnv("SMTP_PASSWORD")
	viper.BindEnv("SMTP_FROM")
	viper.BindEnv("FRONTEND_URL")
	viper.BindEnv("OSS_ENDPOINT")
	viper.BindEnv("OSS_BUCKET")
	viper.BindEnv("OSS_ACCESS_KEY_ID")
	viper.BindEnv("OSS_ACCESS_KEY_SECRET")
	viper.BindEnv("OSS_REGION")
	viper.SetDefault("PORT", DefaultPort)
	viper.SetDefault("LOG_LEVEL", DefaultLogLevel)
	viper.SetDefault("ENVIRONMENT", DefaultEnvironment)
	viper.SetDefault("SMTP_PORT", 587)

	var cfg Config
	if err := viper.Unmarshal(&cfg); err != nil {
		return nil, fmt.Errorf("failed to unmarshal config: %w", err)
	}

	if cfg.DatabaseURL == "" {
		return nil, fmt.Errorf("DATABASE_URL is required")
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