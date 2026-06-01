package service

import (
	"crypto/hmac"
	"crypto/sha1"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"go.uber.org/zap"
)

// MatrixAccount holds the provisioned Matrix account info.
type MatrixAccount struct {
	Homeserver  string
	UserID      string
	Password    string
	AccessToken string
}

// MatrixCredentials contains the Matrix server configuration needed to provision accounts.
type MatrixCredentials struct {
	Homeserver         string // e.g. http://8.217.143.228:8008
	ServerName         string // e.g. 8.217.143.228
	RegistrationSecret string // shared secret for Synapse admin registration
}

var matrixLogger *zap.Logger

// SetMatrixLogger sets the logger for Matrix service.
func SetMatrixLogger(l *zap.Logger) {
	matrixLogger = l
}

func getMatrixLogger() *zap.Logger {
	if matrixLogger != nil {
		return matrixLogger
	}
	return zap.NewNop()
}

// ProvisionMatrixAccount registers a new Matrix user via Synapse shared-secret registration,
// then logs in to obtain an access token. Returns the full account info.
func ProvisionMatrixAccount(creds MatrixCredentials, username, password string) (*MatrixAccount, error) {
	if creds.Homeserver == "" || creds.RegistrationSecret == "" || creds.ServerName == "" {
		return nil, fmt.Errorf("matrix credentials not configured")
	}

	// Step 1: Register user via Synapse admin API
	if err := registerMatrixUser(creds, username, password); err != nil {
		return nil, fmt.Errorf("register matrix user: %w", err)
	}

	getMatrixLogger().Info("matrix user registered",
		zap.String("username", username),
		zap.String("homeserver", creds.Homeserver),
	)

	// Step 2: Login to get access token
	accessToken, err := loginMatrixUser(creds, username, password)
	if err != nil {
		return nil, fmt.Errorf("login matrix user: %w", err)
	}

	userID := fmt.Sprintf("@%s:%s", username, creds.ServerName)

	getMatrixLogger().Info("matrix user logged in",
		zap.String("userId", userID),
	)

	return &MatrixAccount{
		Homeserver:  creds.Homeserver,
		UserID:      userID,
		Password:    password,
		AccessToken: accessToken,
	}, nil
}

// registerMatrixUser registers a user via Synapse shared-secret registration API.
func registerMatrixUser(creds MatrixCredentials, username, password string) error {
	// Get nonce
	nonce, err := getRegistrationNonce(creds.Homeserver)
	if err != nil {
		return fmt.Errorf("get nonce: %w", err)
	}

	// Compute HMAC-SHA1
	mac := hmac.New(sha1.New, []byte(creds.RegistrationSecret))
	mac.Write([]byte(nonce))
	mac.Write([]byte("\x00"))
	mac.Write([]byte(username))
	mac.Write([]byte("\x00"))
	mac.Write([]byte(password))
	mac.Write([]byte("\x00"))
	mac.Write([]byte("notadmin"))
	macHex := hex.EncodeToString(mac.Sum(nil))

	// Register
	body := map[string]interface{}{
		"username": username,
		"password": password,
		"nonce":    nonce,
		"admin":    false,
		"mac":      macHex,
	}
	bodyJSON, _ := json.Marshal(body)

	req, err := http.NewRequest("POST", creds.Homeserver+"/_synapse/admin/v1/register", strings.NewReader(string(bodyJSON)))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("register request: %w", err)
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("register failed (status %d): %s", resp.StatusCode, string(respBody))
	}

	return nil
}

// getRegistrationNonce fetches a nonce from the Synapse admin registration API.
func getRegistrationNonce(homeserver string) (string, error) {
	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Get(homeserver + "/_synapse/admin/v1/register")
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	var result struct {
		Nonce string `json:"nonce"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "", err
	}
	if result.Nonce == "" {
		return "", fmt.Errorf("empty nonce from server")
	}
	return result.Nonce, nil
}

// loginMatrixUser logs in via m.login.password and returns the access token.
func loginMatrixUser(creds MatrixCredentials, username, password string) (string, error) {
	body := map[string]interface{}{
		"type":     "m.login.password",
		"user":     username,
		"password": password,
	}
	bodyJSON, _ := json.Marshal(body)

	req, err := http.NewRequest("POST", creds.Homeserver+"/_matrix/client/r0/login", strings.NewReader(string(bodyJSON)))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return "", fmt.Errorf("login request: %w", err)
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("login failed (status %d): %s", resp.StatusCode, string(respBody))
	}

	var result struct {
		AccessToken string `json:"access_token"`
		UserID      string `json:"user_id"`
		DeviceID    string `json:"device_id"`
	}
	if err := json.Unmarshal(respBody, &result); err != nil {
		return "", err
	}
	if result.AccessToken == "" {
		return "", fmt.Errorf("empty access token in login response")
	}
	return result.AccessToken, nil
}
