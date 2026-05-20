package logger

import (
	"fmt"
	"os"

	"go.uber.org/zap"
	"go.uber.org/zap/zapcore"
)

// Logger wraps zap.Logger for application logging.
// Outputs JSON format to match Pino in Node.js.
type Logger struct {
	*zap.Logger
}

// New creates a new production logger with JSON encoding.
func New(level string) (*Logger, error) {
	var zapLevel zapcore.Level
	switch level {
	case "debug":
		zapLevel = zapcore.DebugLevel
	case "info":
		zapLevel = zapcore.InfoLevel
	case "warn":
		zapLevel = zapcore.WarnLevel
	case "error":
		zapLevel = zapcore.ErrorLevel
	default:
		zapLevel = zapcore.InfoLevel
	}

	// Create encoder config for JSON output (matching Pino)
	encoderConfig := zapcore.EncoderConfig{
		TimeKey:        "ts",
		LevelKey:      "level",
		NameKey:       "logger",
		CallerKey:     "caller",
		MessageKey:    "msg",
		StacktraceKey: "stacktrace",
		LineEnding:    zapcore.DefaultLineEnding,
		EncodeLevel:   zapcore.LowercaseLevelEncoder,
		EncodeTime:    zapcore.ISO8601TimeEncoder,
		EncodeDuration: zapcore.StringDurationEncoder,
		EncodeCaller:  zapcore.ShortCallerEncoder,
	}

	// Create JSON encoder
	encoder := zapcore.NewJSONEncoder(encoderConfig)

	// Create core with console output
	core := zapcore.NewCore(
		encoder,
		zapcore.AddSync(os.Stderr),
		zapLevel,
	)

	// Create logger with caller skip
	logger := zap.New(core, zap.AddCaller(), zap.AddCallerSkip(1))

	return &Logger{Logger: logger}, nil
}

// NewProduction creates a production logger with default settings.
func NewProduction() (*Logger, error) {
	return New("info")
}

// NewDevelopment creates a development logger with debug level.
func NewDevelopment() (*Logger, error) {
	return New("debug")
}

// Sync flushes any buffered log entries.
func (l *Logger) Sync() error {
	return l.Logger.Sync()
}

// With creates a child logger with additional fields.
func (l *Logger) With(fields ...zap.Field) *Logger {
	return &Logger{l.Logger.With(fields...)}
}

// Info logs a message at info level.
func (l *Logger) Info(msg string, fields ...zap.Field) {
	l.Logger.Info(msg, fields...)
}

// Debug logs a message at debug level.
func (l *Logger) Debug(msg string, fields ...zap.Field) {
	l.Logger.Debug(msg, fields...)
}

// Warn logs a message at warn level.
func (l *Logger) Warn(msg string, fields ...zap.Field) {
	l.Logger.Warn(msg, fields...)
}

// Error logs a message at error level.
func (l *Logger) Error(msg string, fields ...zap.Field) {
	l.Logger.Error(msg, fields...)
}

// Fatal logs a message at fatal level and exits.
func (l *Logger) Fatal(msg string, fields ...zap.Field) {
	l.Logger.Fatal(msg, fields...)
}

// InfoW provides structured logging with key-value pairs.
// This matches the Pino API pattern: logger.info({ extra: "field" }, "message")
func (l *Logger) InfoW(msg string, keysAndValues ...interface{}) {
	fields := buildFields(keysAndValues)
	l.Logger.Info(msg, fields...)
}

// ErrorW provides structured error logging.
func (l *Logger) ErrorW(msg string, keysAndValues ...interface{}) {
	fields := buildFields(keysAndValues)
	l.Logger.Error(msg, fields...)
}

// buildFields converts key-value pairs to zap fields
func buildFields(keysAndValues []interface{}) []zap.Field {
	fields := make([]zap.Field, 0, len(keysAndValues)/2)
	for i := 0; i < len(keysAndValues)-1; i += 2 {
		key, ok := keysAndValues[i].(string)
		if !ok {
			continue
		}
		fields = append(fields, zap.Any(key, keysAndValues[i+1]))
	}
	return fields
}

// Global logger instance - initialized once
var global *Logger

// Init initializes the global logger with the given level.
// This should be called once at application startup.
func Init(level string) error {
	logger, err := New(level)
	if err != nil {
		return fmt.Errorf("failed to initialize logger: %w", err)
	}
	global = logger
	return nil
}

// Get returns the global logger instance.
// Panics if Init has not been called.
func Get() *Logger {
	if global == nil {
		panic("logger not initialized - call logger.Init first")
	}
	return global
}

// MustInit initializes the global logger and panics on error.
func MustInit(level string) {
	if err := Init(level); err != nil {
		panic(err)
	}
}

// Sync flushes the global logger's buffer.
func Sync() error {
	if global != nil {
		return global.Sync()
	}
	return nil
}