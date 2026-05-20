package main

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"go.uber.org/zap"

	"github.com/nexus-agents/backend-go/internal/config"
	"github.com/nexus-agents/backend-go/internal/logger"
	"github.com/nexus-agents/backend-go/internal/router"
	"github.com/nexus-agents/backend-go/internal/service"
)

// Build info - set via ldflags at build time
var (
	version = "dev"
	commit = "unknown"
	date   = "unknown"
)

func main() {
	// Load configuration
	cfg, err := config.Load()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Failed to load config: %v\n", err)
		os.Exit(1)
	}

	// Initialize logger with config level
	if err := logger.Init(cfg.LogLevel); err != nil {
		fmt.Fprintf(os.Stderr, "Failed to initialize logger: %v\n", err)
		os.Exit(1)
	}
	log := logger.Get()
	defer log.Sync()

	// Log startup info
	log.Info("Starting server",
		zap.String("version", version),
		zap.String("commit", commit),
		zap.String("date", date),
		zap.Int("port", cfg.Port),
		zap.String("environment", cfg.Environment),
	)

	// Initialize Docker client
	dockerClient, err := service.NewDockerClient()
	if err != nil {
		log.Fatal("Failed to create Docker client", zap.Error(err))
	}
	log.Info("Docker client initialized")

	// Initialize container pool - use underlying zap.Logger
	pool := service.NewContainerPool(dockerClient, log.Logger)
	log.Info("Container pool initialized")

	// Create router with all routes and middleware - use underlying zap.Logger
	engine := router.New(log.Logger, pool, cfg)

	// Create HTTP server
	srv := &http.Server{
		Addr:    fmt.Sprintf(":%d", cfg.Port),
		Handler: engine,
	}

	// Start server in goroutine
	go func() {
		log.Info("Server listening", zap.String("address", srv.Addr))
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatal("Server failed", zap.Error(err))
		}
	}()

	log.Info("Server started successfully",
		zap.Int("port", cfg.Port),
		zap.String("health", "http://localhost:"+fmt.Sprint(cfg.Port)+"/health"),
	)

	// Wait for interrupt signal
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Info("Shutting down server...")

	// Graceful shutdown with 10 second timeout
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := srv.Shutdown(ctx); err != nil {
		log.Error("Server forced to shutdown", zap.Error(err))
	}

	// Cleanup container pool
	if pool != nil {
		pool.CleanupAll(context.Background())
		log.Info("Container pool cleaned up")
	}

	// Close Docker client
	if dockerClient != nil {
		dockerClient.Close()
		log.Info("Docker client closed")
	}

	log.Info("Server exited")
}