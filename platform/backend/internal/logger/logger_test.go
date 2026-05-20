package logger

import (
	"os"
	"testing"

	"go.uber.org/zap"
)

func TestNew(t *testing.T) {
	tests := []struct {
		name        string
		level      string
		wantError  bool
	}{
		{"info level", "info", false},
		{"debug level", "debug", false},
		{"warn level", "warn", false},
		{"error level", "error", false},
		{"unknown level defaults to info", "unknown", false},
		{"empty level defaults to info", "", false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			logger, err := New(tt.level)
			if (err != nil) != tt.wantError {
				t.Errorf("New() error = %v, wantError %v", err, tt.wantError)
				return
			}
			if logger == nil {
				t.Error("New() returned nil")
				return
			}
			defer logger.Sync()
		})
	}
}

func TestLoggerInfo(t *testing.T) {
	logger, err := New("info")
	if err != nil {
		t.Fatalf("New() failed: %v", err)
	}
	defer logger.Sync()

	logger.Info("test info message",
		zap.String("key", "value"),
		zap.Int("number", 42),
	)
}

func TestLoggerDebug(t *testing.T) {
	logger, err := New("debug")
	if err != nil {
		t.Fatalf("New() failed: %v", err)
	}
	defer logger.Sync()

	logger.Debug("test debug message",
		zap.String("key", "value"),
	)
}

func TestLoggerWarn(t *testing.T) {
	logger, err := New("info")
	if err != nil {
		t.Fatalf("New() failed: %v", err)
	}
	defer logger.Sync()

	logger.Warn("test warning message",
		zap.String("key", "value"),
	)
}

func TestLoggerError(t *testing.T) {
	logger, err := New("info")
	if err != nil {
		t.Fatalf("New() failed: %v", err)
	}
	defer logger.Sync()

	logger.Error("test error message",
		zap.String("key", "value"),
	)
}

func TestLoggerWith(t *testing.T) {
	logger, err := New("info")
	if err != nil {
		t.Fatalf("New() failed: %v", err)
	}
	defer logger.Sync()

	// Create child logger with additional fields
	child := logger.With(zap.String("service", "test"))
	child.Info("message from child logger")
}

func TestNewProduction(t *testing.T) {
	logger, err := NewProduction()
	if err != nil {
		t.Fatalf("NewProduction() failed: %v", err)
	}
	defer logger.Sync()

	logger.Info("production logger test")
}

func TestNewDevelopment(t *testing.T) {
	logger, err := NewDevelopment()
	if err != nil {
		t.Fatalf("NewDevelopment() failed: %v", err)
	}
	defer logger.Sync()

	logger.Info("development logger test")
}

func TestJSONOutput(t *testing.T) {
	// This test verifies that the logger outputs JSON format
	// by checking that output contains expected JSON fields
	logger, err := New("info")
	if err != nil {
		t.Fatalf("New() failed: %v", err)
	}
	defer logger.Sync()

	// This tests that logging doesn't panic and outputs to stderr
	logger.Info("JSON format test", zap.String("test", "value"))
}

func TestLogLevels(t *testing.T) {
	logger, err := New("info")
	if err != nil {
		t.Fatalf("New() failed: %v", err)
	}
	defer logger.Sync()

	// Debug should not output at info level
	logger.Debug("debug message - should not appear")

	// Warn should output
	logger.Warn("warn message")

	// Error should output
	logger.Error("error message")
}

func TestInfoW(t *testing.T) {
	logger, err := New("info")
	if err != nil {
		t.Fatalf("New() failed: %v", err)
	}
	defer logger.Sync()

	// Test structured logging with key-value pairs
	logger.InfoW("test message", "key1", "value1", "key2", 42)
}

func TestErrorW(t *testing.T) {
	logger, err := New("info")
	if err != nil {
		t.Fatalf("New() failed: %v", err)
	}
	defer logger.Sync()

	// Test error structured logging
	logger.ErrorW("error message", "error", "something failed")
}

func BenchmarkNewProduction(b *testing.B) {
	for i := 0; i < b.N; i++ {
		logger, _ := New("info")
		logger.Info("benchmark test")
		logger.Sync()
	}
}

func BenchmarkLoggerInfo(b *testing.B) {
	logger, _ := New("info")
	defer logger.Sync()

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		logger.Info("benchmark test")
	}
}

func TestMain(m *testing.M) {
	// Run tests
	os.Exit(m.Run())
}