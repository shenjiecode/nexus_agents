package router

import (
	"fmt"
	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
	"strings"
	"time"

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
	MaxAge           int
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
		MaxAge:           86400,
	}
}

// New creates a new Gin engine with all routes and middleware configured.
func New(log *zap.Logger, pool *service.ContainerPool, cfg *config.Config) *gin.Engine {
	// Set container pool and logger for debug handlers
	handler.SetContainerPool(pool)
	handler.SetDebugLogger(log)
	handler.SetContainerLogger(log)
	handler.SetRoleLogger(log)
	handler.SetSkillLogger(log)
	handler.SetMCPLogger(log)
	// Initialize OSS service for both Skills and MCPs
	ossSvc, err := service.NewOSSService(cfg)
	if err != nil {
		log.Warn("Failed to initialize OSS service", zap.Error(err))
	}
	if ossSvc != nil {
		handler.SetOSSMCPService(ossSvc)
		handler.SetOSSSkillService(ossSvc)
		handler.SetOSSService(ossSvc)
		handler.SetContainerOSSService(ossSvc)
		log.Info("OSS service initialized for Skills, MCPs, Roles and Containers")
	}

	// Initialize Matrix service if configured
	if cfg.MatrixHomeserver != "" && cfg.MatrixRegistrationSecret != "" {
		matrixSvc := handler.NewMatrixProvisioner(service.MatrixCredentials{
			Homeserver:         cfg.MatrixHomeserver,
			ServerName:         cfg.MatrixServerName,
			RegistrationSecret: cfg.MatrixRegistrationSecret,
		})
		handler.SetMatrixService(matrixSvc)
		service.SetMatrixLogger(log)
		log.Info("Matrix service initialized", zap.String("homeserver", cfg.MatrixHomeserver))
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
			roles.GET("", handler.ListPublicRoles)    // GET /api/roles - list public roles
			roles.POST("/import", handler.ImportRole) // POST /api/roles/import (multipart)

			// Protected routes (require auth - handled by middleware.Auth)
			roles.GET("/mine", handler.ListMyRoles)  // GET /api/roles/mine
			roles.POST("", handler.CreateRole)       // POST /api/roles
			roles.GET("/:id", handler.GetRole)       // GET /api/roles/:id
			roles.PUT("/:id", handler.UpdateRole)    // PUT /api/roles/:id
			roles.DELETE("/:id", handler.DeleteRole) // DELETE /api/roles/:id

			// Export role (public - no auth required)
			roles.GET("/:id/export", handler.ExportRole) // GET /api/roles/:id/export

			// OSS storage routes (protected - require auth)
			roles.POST("/:id/upload", handler.UploadRole)    // POST /api/roles/:id/upload
			roles.GET("/:id/download", handler.DownloadRole) // GET /api/roles/:id/download

			// Role file operations (protected - require auth)
			roles.GET("/:id/files", handler.ListRoleFiles)             // GET /api/roles/:id/files
			roles.GET("/:id/files/*path", handler.GetRoleFileContent)  // GET /api/roles/:id/files/:path
			roles.PUT("/:id/files/*path", handler.SaveRoleFileContent) // PUT /api/roles/:id/files/:path

			// Debug routes (protected - require auth)
			debug := roles.Group("/:id/debug")
			{
				debug.POST("/start", handler.StartDebug)  // POST /api/roles/:id/debug/start
				debug.POST("/stop", handler.StopDebug)    // POST /api/roles/:id/debug/stop
				debug.GET("/status", handler.DebugStatus) // GET /api/roles/:id/debug/status
				debug.GET("/ws", handler.DebugWebSocket)  // GET /api/roles/:id/debug/ws (WebSocket)
			}

			// Role skill/MCP routes (protected - require auth)
			roles.GET("/:id/installed-skills", handler.GetRoleInstalledSkills) // GET /api/roles/:id/installed-skills
			roles.POST("/:id/skills/:skillId", handler.AddSkillToRole)        // POST /api/roles/:id/skills/:skillId
			roles.DELETE("/:id/skills/:skillId", handler.RemoveSkillFromRole) // DELETE /api/roles/:id/skills/:skillId
			roles.POST("/:id/mcps/:mcpId", handler.AddMCPToRole)              // POST /api/roles/:id/mcps/:mcpId
			roles.DELETE("/:id/mcps/:mcpId", handler.RemoveMCPFromRole)       // DELETE /api/roles/:id/mcps/:mcpId
		}

		// Marketplace routes (public - no auth required)
		api.GET("/skills", handler.ListSkills) // GET /api/skills
		api.GET("/mcps", handler.ListMCPs)

		// Skills routes (protected - require auth)
		skills := api.Group("/skills")
		{
			skills.GET("/mine", handler.GetMySkills)
			skills.POST("", handler.CreateSkill)
			skills.GET("/:id", handler.GetSkill)
			skills.PUT("/:id", handler.UpdateSkill)
			skills.DELETE("/:id", handler.DeleteSkill)
			skills.POST("/:id/upload", handler.UploadSkill)
			skills.GET("/:id/download", handler.DownloadSkill)
			skills.GET("/:id/files", handler.GetSkillFiles)

		}

		// MCPs routes (protected - require auth)
		mcps := api.Group("/mcps")
		{
			mcps.GET("/mine", handler.GetMyMCPs)
			mcps.POST("", handler.CreateMCP)
			mcps.GET("/:id", handler.GetMCP)
			mcps.PUT("/:id", handler.UpdateMCP)
			mcps.DELETE("/:id", handler.DeleteMCP)
			mcps.POST("/:id/upload", handler.UploadMCP)
			mcps.GET("/:id/download", handler.DownloadMCP)
			mcps.PUT("/:id/config", handler.SaveMCPConfig)
		}

		// Marketplace roles routes (public - no auth required)
		api.GET("/marketplace/roles", handler.ListMarketplaceRoles)                    // GET /api/marketplace/roles
		api.GET("/marketplace/roles/:id/download", handler.GetMarketplaceRoleDownload) // GET /api/marketplace/roles/:id/download
		// Container routes (protected - require auth)
		containers := api.Group("/containers")
		{
			containers.GET("", handler.ListContainers)                           // GET /api/containers
			containers.POST("", handler.CreateContainer)                         // POST /api/containers
			containers.GET("/:id", handler.GetContainer)                         // GET /api/containers/:id
			containers.GET("/:id/files", handler.GetContainerFiles)              // GET /api/containers/:id/files
			containers.GET("/:id/file-index", handler.GetContainerFileIndex)      // GET /api/containers/:id/file-index
			containers.GET("/:id/installed-skills", handler.GetContainerInstalledSkills) // GET /api/containers/:id/installed-skills
			containers.GET("/:id/files/*path", handler.GetContainerFileContent)  // GET /api/containers/:id/files/:path
			containers.PUT("/:id/files/*path", handler.SaveContainerFileContent) // PUT /api/containers/:id/files/:path
			containers.POST("/:id/start", handler.StartContainer)                // POST /api/containers/:id/start
			containers.POST("/:id/stop", handler.StopContainer)                  // POST /api/containers/:id/stop
			containers.DELETE("/:id", handler.DeleteContainer)                   // DELETE /api/containers/:id
			// Container skill/MCP routes
			containers.POST("/:id/skills/:skillId", handler.AddSkillToContainer)        // POST /api/containers/:id/skills/:skillId
			containers.DELETE("/:id/skills/:skillId", handler.RemoveSkillFromContainer) // DELETE /api/containers/:id/skills/:skillId
			containers.POST("/:id/mcps/:mcpId", handler.AddMCPToContainer)              // POST /api/containers/:id/mcps/:mcpId
			containers.DELETE("/:id/mcps/:mcpId", handler.RemoveMCPFromContainer)       // DELETE /api/containers/:id/mcps/:mcpId
			debug := containers.Group("/:id/debug")
			debug.GET("/status", handler.GetContainerDebugStatus) // GET /api/containers/:id/debug/status
			debug.GET("/ws", handler.ContainerDebugWebSocket)     // GET /api/containers/:id/debug/ws (WebSocket)
		}
	}

	// 404 handler
	engine.NoRoute(func(c *gin.Context) {
		c.JSON(404, gin.H{
			"success": false,
			"error":   "Not Found",
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
