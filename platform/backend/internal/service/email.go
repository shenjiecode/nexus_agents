package service

import (
	"bytes"
	"crypto/tls"
	"fmt"
	"net/smtp"
	"text/template"

	"github.com/nexus-agents/backend/internal/config"
	"github.com/nexus-agents/backend/internal/logger"
	"go.uber.org/zap"
)

// passwordResetTemplate is a simple HTML email template for password reset.
// Uses inline styles for email client compatibility.
const passwordResetTemplate = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Reset Your Password</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background: #0A0A0F; padding: 30px; border-radius: 8px 8px 0 0; text-align: center;">
        <h1 style="color: #00D9FF; margin: 0; font-size: 24px;">Nexus Agents</h1>
    </div>
    
    <div style="background: #ffffff; padding: 30px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 8px 8px;">
        <h2 style="color: #1E1E2E; margin-top: 0;">Password Reset Request</h2>
        
        <p>Hello,</p>
        
        <p>We received a request to reset your password for your Nexus Agents account. Click the button below to reset your password:</p>
        
        <div style="text-align: center; margin: 30px 0;">
            <a href="{{.ResetURL}}" style="display: inline-block; background: linear-gradient(135deg, #00D9FF 0%, #8B5CF6 100%); color: white; text-decoration: none; padding: 14px 32px; border-radius: 6px; font-weight: 600; font-size: 16px;">Reset Password</a>
        </div>
        
        <p style="color: #666; font-size: 14px;">Or copy and paste this link into your browser:</p>
        <p style="background: #f5f5f5; padding: 12px; border-radius: 4px; word-break: break-all; font-size: 13px; color: #555;">{{.ResetURL}}</p>
        
        <div style="background: #FFF3CD; border-left: 4px solid #FFC107; padding: 15px; margin: 25px 0; border-radius: 4px;">
            <p style="margin: 0; color: #856404; font-size: 14px;">
                <strong>Important:</strong> This link will expire in {{.ExpiryHours}} hours for security reasons.
            </p>
        </div>
        
        <p style="color: #666; font-size: 14px;">If you did not request a password reset, please ignore this email. Your password will remain unchanged.</p>
        
        <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 30px 0;">
        
        <p style="color: #999; font-size: 12px; margin: 0;">
            This email was sent by Nexus Agents. If you have any questions, please contact support.
        </p>
    </div>
</body>
</html>`

// EmailService handles sending emails via SMTP.
type EmailService struct {
	config *config.Config
	logger *logger.Logger
	tmpl   *template.Template
}

// NewEmailService creates a new EmailService instance.
func NewEmailService(cfg *config.Config) *EmailService {
	tmpl := template.Must(template.New("passwordReset").Parse(passwordResetTemplate))
	return &EmailService{
		config: cfg,
		logger: logger.Get(),
		tmpl:   tmpl,
	}
}

// SendPasswordResetEmail sends a password reset email to the specified address.
// In development or test environments, the email is logged instead of sent.
func (s *EmailService) SendPasswordResetEmail(to, resetToken string) error {
	// Build reset URL
	resetURL := fmt.Sprintf("%s/reset-password?token=%s", s.config.FrontendURL, resetToken)

	// Prepare template data
	data := struct {
		ResetURL    string
		ExpiryHours int
	}{
		ResetURL:    resetURL,
		ExpiryHours: 24, // Token expires in 24 hours
	}

	// Execute template
	var body bytes.Buffer
	if err := s.tmpl.Execute(&body, data); err != nil {
		return fmt.Errorf("failed to execute email template: %w", err)
	}

	// In development or test mode, just log the email
	if s.config.Environment == "development" || s.config.Environment == "test" {
		s.logger.Info("[EMAIL] Password reset email would be sent",
			zap.String("to", to),
			zap.String("from", s.config.SMTPFrom),
			zap.String("resetURL", resetURL),
		)
		return nil
	}

	// Check if SMTP is configured
	if s.config.SMTPHost == "" || s.config.SMTPUser == "" {
		s.logger.Warn("SMTP not configured, email not sent",
			zap.String("to", to),
		)
		return fmt.Errorf("SMTP configuration incomplete")
	}

	// Build email headers and body
	subject := "Reset Your Nexus Agents Password"
	headers := fmt.Sprintf("From: %s\r\nTo: %s\r\nSubject: %s\r\nMIME-Version: 1.0\r\nContent-Type: text/html; charset=UTF-8\r\n\r\n",
		s.config.SMTPFrom, to, subject)

	message := headers + body.String()

	// Send email via SMTP with SSL support (port 465)
	if err := s.sendMailSSL(to, []byte(message)); err != nil {
		s.logger.Error("Failed to send password reset email",
			zap.String("to", to),
			zap.Error(err),
		)
		return fmt.Errorf("failed to send email: %w", err)
	}

	s.logger.Info("Password reset email sent successfully",
		zap.String("to", to),
	)

	return nil
}

// sendMailSSL sends an email using SMTP with SSL connection (port 465).
// Go's standard smtp.SendMail doesn't support SSL directly, so we use tls.Dial.
func (s *EmailService) sendMailSSL(to string, message []byte) error {
	host := s.config.SMTPHost
	addr := fmt.Sprintf("%s:%d", host, s.config.SMTPPort)

	// Dial with TLS (for port 465 - SMTPS)
	tlsConfig := &tls.Config{
		ServerName: host,
	}

	conn, err := tls.Dial("tcp", addr, tlsConfig)
	if err != nil {
		return fmt.Errorf("TLS dial failed: %w", err)
	}
	defer conn.Close()

	// Create SMTP client
	client, err := smtp.NewClient(conn, host)
	if err != nil {
		return fmt.Errorf("SMTP client creation failed: %w", err)
	}
	defer client.Close()

	// Authenticate
	auth := smtp.PlainAuth("", s.config.SMTPUser, s.config.SMTPPassword, host)
	if err := client.Auth(auth); err != nil {
		return fmt.Errorf("SMTP auth failed: %w", err)
	}

	// Set sender
	if err := client.Mail(s.config.SMTPFrom); err != nil {
		return fmt.Errorf("SMTP MAIL failed: %w", err)
	}

	// Set recipient
	if err := client.Rcpt(to); err != nil {
		return fmt.Errorf("SMTP RCPT failed: %w", err)
	}

	// Send data
	writer, err := client.Data()
	if err != nil {
		return fmt.Errorf("SMTP DATA failed: %w", err)
	}

	_, err = writer.Write(message)
	if err != nil {
		return fmt.Errorf("SMTP write failed: %w", err)
	}

	if err := writer.Close(); err != nil {
		return fmt.Errorf("SMTP writer close failed: %w", err)
	}

	return client.Quit()
}

// IsConfigured returns true if SMTP is properly configured.
func (s *EmailService) IsConfigured() bool {
	return s.config.SMTPHost != "" &&
		s.config.SMTPUser != "" &&
		s.config.SMTPPassword != "" &&
		s.config.SMTPFrom != ""
}
