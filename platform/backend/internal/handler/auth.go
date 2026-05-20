package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/spf13/viper"
	"golang.org/x/crypto/bcrypt"

	"github.com/nexus-agents/backend/internal/model"
)

// LoginRequest represents the login request body.
type LoginRequest struct {
	Slug     string `json:"slug"`
	Password string `json:"password"`
}

// AdminLoginRequest represents the admin login request body.
type AdminLoginRequest struct {
	Password string `json:"password"`
}

// UserResponse represents the user data returned in responses.
type UserResponse struct {
	ID   string `json:"id"`
	Name string `json:"name"`
	Slug string `json:"slug"`
	Role string `json:"role"`
}

// Login handles POST /api/auth/login
func Login(c *gin.Context) {
	var req LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":  "slug is required",
		})
		return
	}

	if req.Slug == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":  "slug is required",
		})
		return
	}

	if req.Password == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":  "password is required",
		})
		return
	}

	// Find user by slug
	db := model.GetDB()
	var user model.User
	result := db.Where("slug = ?", req.Slug).First(&user)
	if result.Error != nil {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"error":  "Invalid credentials",
		})
		return
	}

	// Verify password with bcrypt
	if err := bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(req.Password)); err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"error":  "Invalid credentials",
		})
		return
	}

	// Return user info (without password)
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": UserResponse{
			ID:   user.ID,
			Name: user.Name,
			Slug: user.Slug,
			Role: "user",
		},
	})
}

// AdminLogin handles POST /api/auth/admin-login
func AdminLogin(c *gin.Context) {
	var req AdminLoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":  "password is required",
		})
		return
	}

	if req.Password == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":  "password is required",
		})
		return
	}

	// Get admin password from environment variable (via viper)
	adminPassword := viper.GetString("ADMIN_PASSWORD")
	if adminPassword == "" {
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"success": false,
			"error":  "Admin login not configured",
		})
		return
	}

	if req.Password != adminPassword {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"error":  "Invalid credentials",
		})
		return
	}

	// Return admin user info
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": UserResponse{
			ID:   "admin",
			Name: "Admin",
			Slug: "admin",
			Role: "admin",
		},
	})
}