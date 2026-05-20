package handler

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
)

// TestGetSkills tests GET /api/skills endpoint
func TestGetSkills(t *testing.T) {
	gin.SetMode(gin.TestMode)

	// Setup router
	r := gin.New()
	r.GET("/api/skills", GetSkills)

	// Make request
	req := httptest.NewRequest("GET", "/api/skills", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	// Verify response
	assert.Equal(t, http.StatusOK, w.Code)

	var response map[string]interface{}
	err := json.Unmarshal(w.Body.Bytes(), &response)
	assert.NoError(t, err)

	// Check success field
	assert.Equal(t, true, response["success"])

	// Check data is array
	data, ok := response["data"].([]interface{})
	assert.True(t, ok, "data should be an array")
	assert.Greater(t, len(data), 0, "should have at least one skill")

	// Verify structure of first skill
	if len(data) > 0 {
		skill, ok := data[0].(map[string]interface{})
		assert.True(t, ok, "skill should be an object")
		assert.Contains(t, skill, "id")
		assert.Contains(t, skill, "name")
		assert.Contains(t, skill, "slug")
		assert.Contains(t, skill, "description")
	}
}

// TestGetMCPs tests GET /api/mcps endpoint
func TestGetMCPs(t *testing.T) {
	gin.SetMode(gin.TestMode)

	// Setup router
	r := gin.New()
	r.GET("/api/mcps", GetMCPs)

	// Make request
	req := httptest.NewRequest("GET", "/api/mcps", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	// Verify response
	assert.Equal(t, http.StatusOK, w.Code)

	var response map[string]interface{}
	err := json.Unmarshal(w.Body.Bytes(), &response)
	assert.NoError(t, err)

	// Check success field
	assert.Equal(t, true, response["success"])

	// Check data is array
	data, ok := response["data"].([]interface{})
	assert.True(t, ok, "data should be an array")
	assert.Greater(t, len(data), 0, "should have at least one MCP")

	// Verify structure of first MCP
	if len(data) > 0 {
		mcp, ok := data[0].(map[string]interface{})
		assert.True(t, ok, "mcp should be an object")
		assert.Contains(t, mcp, "id")
		assert.Contains(t, mcp, "name")
		assert.Contains(t, mcp, "slug")
		assert.Contains(t, mcp, "description")
	}
}

// TestSkillsResponseFormat tests the exact response format matches Node.js
func TestSkillsResponseFormat(t *testing.T) {
	gin.SetMode(gin.TestMode)

	r := gin.New()
	r.GET("/api/skills", GetSkills)

	req := httptest.NewRequest("GET", "/api/skills", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	var response map[string]interface{}
	json.Unmarshal(w.Body.Bytes(), &response)

	// Must have "success" field
	_, hasSuccess := response["success"]
	assert.True(t, hasSuccess, "response must have 'success' field")

	// Must have "data" field
	_, hasData := response["data"]
	assert.True(t, hasData, "response must have 'data' field")
}

// TestMCPsResponseFormat tests the exact response format matches Node.js
func TestMCPsResponseFormat(t *testing.T) {
	gin.SetMode(gin.TestMode)

	r := gin.New()
	r.GET("/api/mcps", GetMCPs)

	req := httptest.NewRequest("GET", "/api/mcps", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	var response map[string]interface{}
	json.Unmarshal(w.Body.Bytes(), &response)

	// Must have "success" field
	_, hasSuccess := response["success"]
	assert.True(t, hasSuccess, "response must have 'success' field")

	// Must have "data" field
	_, hasData := response["data"]
	assert.True(t, hasData, "response must have 'data' field")
}

// TestMockDataCount tests that we have the expected number of mock items
func TestMockDataCount(t *testing.T) {
	assert.Greater(t, len(mockSkills), 0, "should have skills mock data")
	assert.Greater(t, len(mockMCPs), 0, "should have MCPs mock data")
}