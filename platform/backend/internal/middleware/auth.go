package middleware

import (
	"github.com/gin-gonic/gin"

	"net/http"
)

// UserContext represents the user information extracted from headers.
type UserContext struct {
	Role  string `json:"role"`  // "admin", "org", "user"
	ID    string `json:"id"`    // admin ID, org ID, or user ID
	OrgID string `json:"orgId"` // only for org/user role
}

// Auth is an optional auth middleware that extracts user info from headers.
// Frontend should send X-User-Role and X-User-Id headers.
// For org/user role, also sends X-User-OrgId header.
//
// This middleware allows unauthenticated access - it's optional auth for read-only operations.
func Auth() gin.HandlerFunc {
	return func(c *gin.Context) {
		role := c.GetHeader("X-User-Role")
		userID := c.GetHeader("X-User-Id")
		orgID := c.GetHeader("X-User-OrgId")

		if role == "" || userID == "" {
			// No auth info - treat as unauthenticated
			// Allow read-only operations to proceed without auth
			c.Set("user", nil)
			c.Next()
			return
		}

		// Validate role
		if role != "admin" && role != "org" && role != "user" {
			c.Set("user", nil)
			c.Next()
			return
		}

		user := UserContext{
			Role: role,
			ID:   userID,
		}

		// Add orgId for org/user roles
		if (role == "org" || role == "user") && orgID != "" {
			user.OrgID = orgID
		}

		c.Set("user", user)
		c.Next()
	}
}

// GetUser retrieves the user context from the Gin context.
// Returns nil if user is not authenticated.
func GetUser(c *gin.Context) *UserContext {
	if user, exists := c.Get("user"); exists && user != nil {
		if u, ok := user.(*UserContext); ok {
			return u
		}
	}
	return nil
}

// IsAdmin checks if the current user is an admin.
func IsAdmin(c *gin.Context) bool {
	user := GetUser(c)
	if user == nil {
		return false
	}
	return user.Role == "admin"
}

// IsOwner checks if the user owns the resource (orgId matches).
func IsOwner(c *gin.Context, resourceOrgID string) bool {
	user := GetUser(c)
	if user == nil {
		return false
	}
	if user.Role == "admin" {
		return true
	}
	return user.OrgID == resourceOrgID
}

// RequireAuth is a middleware that enforces authentication.
// Returns 401 if user is not authenticated.
func RequireAuth() gin.HandlerFunc {
	return func(c *gin.Context) {
		user := GetUser(c)
		if user == nil {
			c.JSON(http.StatusUnauthorized, gin.H{
				"success": false,
				"error":  "Authentication required",
			})
			c.Abort()
			return
		}
		c.Next()
	}
}