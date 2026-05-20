package handler

import (
	"crypto/rand"
	"encoding/hex"
	"net/http"
	"regexp"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"golang.org/x/crypto/bcrypt"

	"github.com/nexus-agents/backend/internal/config"
	"github.com/nexus-agents/backend/internal/model"
	"github.com/nexus-agents/backend/internal/service"
)

// LoginRequest represents the login request body.
type LoginRequest struct {
	Login    string `json:"login"` // can be username or email
	Password string `json:"password"`
}

// RegisterRequest represents the registration request body.
type RegisterRequest struct {
	Username string `json:"username"`
	Email    string `json:"email"`
	Password string `json:"password"`
	Nickname string `json:"nickname"`
}

// ForgotPasswordRequest represents the forgot password request body.
type ForgotPasswordRequest struct {
	Email string `json:"email"`
}

// ResetPasswordRequest represents the reset password request body.
type ResetPasswordRequest struct {
	Token       string `json:"token"`
	NewPassword string `json:"new_password"`
}

// UserResponse represents the user data returned in responses.
type UserResponse struct {
	ID       string `json:"id"`
	Username string `json:"username"`
	Email    string `json:"email"`
	Name     string `json:"name"`
	Nickname string `json:"nickname"`
}

// isEmail checks if the given string is an email address.
func isEmail(s string) bool {
	emailRegex := regexp.MustCompile(`^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$`)
	return emailRegex.MatchString(s)
}

// generateResetToken generates a random 32-character token.
func generateResetToken() (string, error) {
	bytes := make([]byte, 16)
	if _, err := rand.Read(bytes); err != nil {
		return "", err
	}
	return hex.EncodeToString(bytes), nil
}

// hashPassword hashes a password using bcrypt.
func hashPassword(password string) (string, error) {
	bytes, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	return string(bytes), err
}

// validatePasswordStrength validates password strength.
func validatePasswordStrength(password string) (bool, string) {
	if len(password) < 8 {
		return false, "Password must be at least 8 characters long"
	}

	hasUpper := regexp.MustCompile(`[A-Z]`).MatchString(password)
	hasLower := regexp.MustCompile(`[a-z]`).MatchString(password)
	hasNumber := regexp.MustCompile(`[0-9]`).MatchString(password)

	if !hasUpper || !hasLower || !hasNumber {
		return false, "Password must contain at least one uppercase letter, one lowercase letter, and one number"
	}

	return true, ""
}

// Login handles POST /api/auth/login
func Login(c *gin.Context) {
	var req LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "login and password are required",
		})
		return
	}

	if req.Login == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "login is required",
		})
		return
	}

	if req.Password == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "password is required",
		})
		return
	}

	db := model.GetDB()
	var user model.User

	// Check if login is email or username
	if isEmail(req.Login) {
		result := db.Where("email = ?", req.Login).First(&user)
		if result.Error != nil {
			c.JSON(http.StatusUnauthorized, gin.H{
				"success": false,
				"error":   "Invalid credentials",
			})
			return
		}
	} else {
		result := db.Where("username = ?", req.Login).First(&user)
		if result.Error != nil {
			c.JSON(http.StatusUnauthorized, gin.H{
				"success": false,
				"error":   "Invalid credentials",
			})
			return
		}
	}

	// Verify password with bcrypt
	if err := bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(req.Password)); err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"error":   "Invalid credentials",
		})
		return
	}

	// Return user info (without password)
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": UserResponse{
			ID:       user.ID,
			Username: user.Username,
			Email:    user.Email,
			Name:     user.Name,
			Nickname: user.Nickname,
		},
	})
}

// Register handles POST /api/auth/register
func Register(c *gin.Context) {
	var req RegisterRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "invalid request body",
		})
		return
	}

	// Validate required fields
	if req.Username == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "username is required",
		})
		return
	}

	if req.Email == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "email is required",
		})
		return
	}

	if req.Password == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "password is required",
		})
		return
	}

	// Validate username format (English letters, numbers, underscore, hyphen)
	if !regexp.MustCompile(`^[a-zA-Z0-9_-]+$`).MatchString(req.Username) {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "username can only contain letters, numbers, underscore, and hyphen",
		})
		return
	}

	// Validate email format
	if !isEmail(req.Email) {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "invalid email format",
		})
		return
	}

	// Validate password strength
	if ok, msg := validatePasswordStrength(req.Password); !ok {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   msg,
		})
		return
	}

	db := model.GetDB()

	// Check if username is already taken
	var existingUser model.User
	if result := db.Where("username = ?", req.Username).First(&existingUser); result.Error == nil {
		c.JSON(http.StatusConflict, gin.H{
			"success": false,
			"error":   "username already taken",
		})
		return
	}

	// Check if email is already registered
	if result := db.Where("email = ?", req.Email).First(&existingUser); result.Error == nil {
		c.JSON(http.StatusConflict, gin.H{
			"success": false,
			"error":   "email already registered",
		})
		return
	}

	// Hash password
	hashedPassword, err := hashPassword(req.Password)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "failed to process password",
		})
		return
	}

	// Create user
	user := model.User{
		Username: req.Username,
		Email:    strings.ToLower(req.Email),
		Password: hashedPassword,
		Name:     req.Nickname,
		Nickname: req.Nickname,
	}

	if result := db.Create(&user); result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "failed to create user",
		})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"success": true,
		"message": "User registered successfully",
	})
}

// ForgotPassword handles POST /api/auth/forgot-password
func ForgotPassword(c *gin.Context) {
	var req ForgotPasswordRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "email is required",
		})
		return
	}

	if req.Email == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "email is required",
		})
		return
	}

	db := model.GetDB()

	// Find user by email
	var user model.User
	result := db.Where("email = ?", strings.ToLower(req.Email)).First(&user)

	// Always return success even if email not found (security measure)
	if result.Error != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": true,
			"message": "If the email exists, a password reset link has been sent",
		})
		return
	}

	// Generate reset token
	token, err := generateResetToken()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "failed to generate reset token",
		})
		return
	}

	// Delete any existing tokens for this user
	db.Where("user_id = ?", user.ID).Delete(&model.PasswordResetToken{})

	// Create new token
	resetToken := model.PasswordResetToken{
		UserID:    user.ID,
		Token:     token,
		ExpiresAt: time.Now().Add(1 * time.Hour),
	}

	if result := db.Create(&resetToken); result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "failed to save reset token",
		})
		return
	}

	// Send password reset email
	cfg, err := config.Load()
	if err != nil {
		// Log error but still return success (don't reveal internal errors)
		c.JSON(http.StatusOK, gin.H{
			"success": true,
			"message": "If the email exists, a password reset link has been sent",
		})
		return
	}

	emailService := service.NewEmailService(cfg)
	if sendErr := emailService.SendPasswordResetEmail(user.Email, token); sendErr != nil {
		// Log error but still return success (don't reveal internal errors)
		c.JSON(http.StatusOK, gin.H{
			"success": true,
			"message": "If the email exists, a password reset link has been sent",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "If the email exists, a password reset link has been sent",
	})
}

// ResetPassword handles POST /api/auth/reset-password
func ResetPassword(c *gin.Context) {
	var req ResetPasswordRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "token and new_password are required",
		})
		return
	}

	if req.Token == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "token is required",
		})
		return
	}

	if req.NewPassword == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "new_password is required",
		})
		return
	}

	// Validate password strength
	if ok, msg := validatePasswordStrength(req.NewPassword); !ok {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   msg,
		})
		return
	}

	db := model.GetDB()

	// Find token
	var resetToken model.PasswordResetToken
	result := db.Where("token = ?", req.Token).First(&resetToken)
	if result.Error != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "invalid or expired token",
		})
		return
	}

	// Check if token is expired
	if resetToken.IsExpired() {
		// Delete expired token
		db.Delete(&resetToken)
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "token has expired",
		})
		return
	}

	// Hash new password
	hashedPassword, err := hashPassword(req.NewPassword)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "failed to process password",
		})
		return
	}

	// Update user password
	if result := db.Model(&model.User{}).Where("id = ?", resetToken.UserID).Update("password", hashedPassword); result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "failed to update password",
		})
		return
	}

	// Delete used token
	db.Delete(&resetToken)

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Password has been reset successfully",
	})
}
