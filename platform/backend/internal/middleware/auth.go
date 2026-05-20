package middleware

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

// UserContext represents the user information extracted from headers.
type UserContext struct {
	ID string `json:"id"` // user ID
}

// Auth is an optional auth middleware that extracts user info from headers.
// Frontend should send X-User-Id header.
//
// This middleware allows unauthenticated access - it's optional auth for read-only operations.
func Auth() gin.HandlerFunc {
	return func(c *gin.Context) {
		userID := c.GetHeader("X-User-Id")

		if userID == "" {
			// No auth info - treat as unauthenticated
			// Allow read-only operations to proceed without auth
			c.Set("user", nil)
			c.Next()
			return
		}

		user := UserContext{
			ID: userID,
		}

		c.Set("user", user)
		c.Next()
	}
}

// GetUser retrieves the user context from the Gin context.
// Returns nil if user is not authenticated.
func GetUser(c *gin.Context) *UserContext {
	if user, exists := c.Get("user"); exists && user != nil {
		if u, ok := user.(UserContext); ok {
			return &u
		}
	}
	return nil
}

// RequireAuth is a middleware that enforces authentication.
// Returns 401 if user is not authenticated.
func RequireAuth() gin.HandlerFunc {
	return func(c *gin.Context) {
		user := GetUser(c)
		if user == nil {
			c.JSON(http.StatusUnauthorized, gin.H{
				"success": false,
				"error":   "Authentication required",
			})
			c.Abort()
			return
		}
		c.Next()
	}
}
