package router

import (
	"fmt"
	"strings"
	"time"
	"github.com/gin-gonic/gin"
	"go.uber.org/zap"

	"github.com/nexus-agents/backend/internal/config"
	"github.com/nexus-agents/backend/internal/handler"
	"github.com/nexus-agents/backend/internal/middleware"
	"github.com/nexus-agents/backend/internal/model"
	"github.com/nexus-agents/backend/internal/service"
)

// CORSConfig holds CORS configuration.
type CORSConfig struct {
	AllowOrigins     []string
	AllowMethods     []string
	AllowHeaders     []string
	ExposeHeaders    []string
	AllowCredentials bool
	MaxAge          int
}

// DefaultCORSConfig returns the default CORS configuration.
func DefaultCORSConfig() CORSConfig {
	return CORSConfig{
		AllowOrigins: []string{
			"http://localhost:13208",
			"http://localhost:3000",
			"http://localhost:8080",
			"http://127.0.0.1:13208",
			"http://127.0.0.1:3000",
			"http://127.0.0.1:8080",
		},
		AllowMethods: []string{
			"GET",
			"POST",
			"PUT",
			"PATCH",
			"DELETE",
			"OPTIONS",
		},
		AllowHeaders: []string{
			"Origin",
			"Content-Type",
			"Accept",
			"Authorization",
			"X-User-Id",
		},
		ExposeHeaders: []string{
			"Content-Length",
			"Content-Type",
		},
		AllowCredentials: true,
		MaxAge:          86400,
	}
}

// New creates a new Gin engine with all routes and middleware configured.
func New(log *zap.Logger, pool *service.ContainerPool, cfg *config.Config) *gin.Engine {
	// Set container pool and logger for debug handlers
	handler.SetContainerPool(pool)
	handler.SetDebugLogger(log)
	// Initialize OSS service (optional - may be nil if not configured)
	ossSvc, err := service.NewOSSService(cfg)
	if err != nil {
		log.Warn("Failed to initialize OSS service", zap.Error(err))
	}
	if ossSvc != nil {
		handler.SetOSSService(ossSvc)
		log.Info("OSS service initialized")
	}

	// Build CORS allowed origins from config
	corsConfig := DefaultCORSConfig()
	if cfg.FrontendURL != "" {
		corsConfig.AllowOrigins = append(corsConfig.AllowOrigins, cfg.FrontendURL)
	}
	if cfg.CORSOrigins != "" {
		for _, origin := range strings.Split(cfg.CORSOrigins, ",") {
			o := strings.TrimSpace(origin)
			if o != "" {
				corsConfig.AllowOrigins = append(corsConfig.AllowOrigins, o)
			}
		}
	}

	// Create engine
	engine := gin.New()

	// Middleware stack: logger → recovery → CORS → auth

	// Logger middleware (requests)
	engine.Use(gin.LoggerWithConfig(gin.LoggerConfig{
		Formatter: func(param gin.LogFormatterParams) string {
			return param.TimeStamp.Format(time.RFC3339) + " " +
				param.Method + " " +
				param.Path + " " +
				param.StatusCodeColor() + " " +
				param.MethodColor() + " " +
				param.Latency.String() + "\n"
		},
		Output: gin.DefaultWriter,
		SkipPaths: []string{
			"/health",
		},
	}))

	// Recovery middleware
	engine.Use(gin.Recovery())

	// CORS middleware
	engine.Use(corsMiddleware(corsConfig))

	// Auth middleware (extracts user from headers)
	engine.Use(middleware.Auth())

	// Health check (public, no auth required)
	engine.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{
			"status": "ok",
		})
	})

	// API Routes
	api := engine.Group("/api")
	{
		// Auth routes (no auth required - they handle their own auth)
		auth := api.Group("/auth")
		{
			auth.POST("/login", handler.Login)
			auth.POST("/register", handler.Register)
			auth.POST("/forgot-password", handler.ForgotPassword)
			auth.POST("/reset-password", handler.ResetPassword)
		}

		// Roles routes
		roles := api.Group("/roles")
		{
			// Public routes (no auth required)
			roles.GET("", handler.ListPublicRoles)         // GET /api/roles - list public roles
			roles.POST("/import", handler.ImportRole)       // POST /api/roles/import (multipart)

			// Protected routes (require auth - handled by middleware.Auth)
			roles.GET("/mine", handler.ListMyRoles)        // GET /api/roles/mine
			roles.POST("", handler.CreateRole)              // POST /api/roles
			roles.GET("/:id", handler.GetRole)             // GET /api/roles/:id
			roles.PUT("/:id", handler.UpdateRole)          // PUT /api/roles/:id
			roles.DELETE("/:id", handler.DeleteRole)       // DELETE /api/roles/:id

			// Export role (public - no auth required)
			roles.GET("/:id/export", handler.ExportRole)    // GET /api/roles/:id/export

			// OSS storage routes (protected - require auth)
			roles.POST("/:id/upload", handler.UploadRole)     // POST /api/roles/:id/upload
			roles.GET("/:id/download", handler.DownloadRole) // GET /api/roles/:id/download

			// Role file operations (protected - require auth)
			roles.GET("/:id/files", handler.ListRoleFiles)           // GET /api/roles/:id/files
			roles.GET("/:id/files/*path", handler.GetRoleFileContent) // GET /api/roles/:id/files/:path
			roles.PUT("/:id/files/*path", handler.SaveRoleFileContent) // PUT /api/roles/:id/files/:path

			// Debug routes (protected - require auth)
			debug := roles.Group("/:id/debug")
			{
				debug.POST("/start", handler.StartDebug)    // POST /api/roles/:id/debug/start
				debug.POST("/stop", handler.StopDebug)     // POST /api/roles/:id/debug/stop
				debug.GET("/status", handler.DebugStatus)  // GET /api/roles/:id/debug/status
				debug.GET("/ws", handler.DebugWebSocket)   // GET /api/roles/:id/debug/ws (WebSocket)
			}
		}

		// Marketplace routes (public - no auth required)
		api.GET("/skills", handler.GetSkills)               // GET /api/skills
		api.GET("/mcps", handler.GetMCPs)                  // GET /api/mcps

		// Marketplace roles routes (public - no auth required)
		api.GET("/marketplace/roles", handler.ListMarketplaceRoles)                      // GET /api/marketplace/roles
		api.GET("/marketplace/roles/:id/download", handler.GetMarketplaceRoleDownload) // GET /api/marketplace/roles/:id/download
		// Container routes (protected - require auth)
		containers := api.Group("/containers")
		{
			containers.GET("", handler.ListContainers)            // GET /api/containers
			containers.POST("", handler.CreateContainer)         // POST /api/containers
			containers.POST("/:id/start", handler.StartContainer)  // POST /api/containers/:id/start
			containers.POST("/:id/stop", handler.StopContainer)    // POST /api/containers/:id/stop
			containers.DELETE("/:id", handler.DeleteContainer)    // DELETE /api/containers/:id
	}
	}

	// 404 handler
	engine.NoRoute(func(c *gin.Context) {
		c.JSON(404, gin.H{
			"success": false,
			"error":  "Not Found",
		})
	})

	// Initialize database
	if err := initDB(cfg); err != nil {
		log.Fatal("Failed to initialize database", zap.Error(err))
	}

	log.Info("Router initialized",
		zap.Int("routes", 16),
	)

	return engine
}

// corsMiddleware creates a CORS middleware with the given configuration.
func corsMiddleware(config CORSConfig) gin.HandlerFunc {
	return func(c *gin.Context) {
		origin := c.GetHeader("Origin")
		if origin == "" {
			origin = c.Request.Header.Get("Origin")
		}

		// Check if origin is allowed
		allowed := false
		for _, o := range config.AllowOrigins {
			if o == origin || origin == "" {
				allowed = true
				break
			}
		}

		// Allow all origins in development
		if !allowed && (origin == "http://localhost" || origin == "http://127.0.0.1" || len(origin) == 0) {
			allowed = true
		}

		if allowed {
			c.Header("Access-Control-Allow-Origin", origin)
		}

		// Set headers for preflight
		if c.Request.Method == "OPTIONS" {
			c.Header("Access-Control-Allow-Methods", joinStrings(config.AllowMethods))
			c.Header("Access-Control-Allow-Headers", joinStrings(config.AllowHeaders))
			c.Header("Access-Control-Max-Age", fmt.Sprintf("%d", config.MaxAge))

			if config.AllowCredentials {
				c.Header("Access-Control-Allow-Credentials", "true")
			}

			c.Status(204)
			c.Abort()
			return
		}

		// Set response headers
		if config.AllowCredentials {
			c.Header("Access-Control-Allow-Credentials", "true")
		}
		if len(config.ExposeHeaders) > 0 {
			c.Header("Access-Control-Expose-Headers", joinStrings(config.ExposeHeaders))
		}

		c.Next()
	}
}

// initDB initializes the database connection.
func initDB(cfg *config.Config) error {
	_, err := model.InitDB(cfg)
	return err
}

// joinStrings joins a slice of strings with comma.
func joinStrings(ss []string) string {
	result := ""
	for i, s := range ss {
		if i > 0 {
			result += ", "
		}
		result += s
	}
	return result
}
