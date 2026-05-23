# Backend Go Rewrite - Learnings

## Task 1: Project Scaffolding

### Key Decisions

1. **Framework**: Gin (v1.12.0) - chosen per project requirements for rewrite
2. **Config**: Viper (v1.21.0) - standard Go config library with env var support
3. **Logger**: Zap (v1.28.0) - JSON output matching Pino from Node.js backend
4. **Module Path**: `github.com/nexus-agents/backend-go`

### Gotchas Encountered

1. **Viper State Persistence**: Viper maintains internal state across calls. In tests, calling `viper.Reset()` clears state but shouldn't be called inside Load functions - tests should control the state. Using `viper.Set()` for test setup instead of `os.Setenv()`.

2. **Go Module Tidy**: Dependencies in go.mod don't create go.sum until `go mod tidy` runs with actual code imports.

3. **Zap JSON Format**: Zap's JSON encoder produces output matching Pino format: `{"level":"info","ts":"...","msg":"...","key":"value"}`

4. **Gin Engine**: Use `gin.New()` for clean engine without default middleware, then add `gin.Recovery()` explicitly.

### File Structure Created

```
platform/backend-go/
├── cmd/server/main.go
├── internal/
│   ├── config/config.go, config_test.go
│   ├── logger/logger.go, logger_test.go
│   └── handler/ (empty, for future routes)
├── go.mod
└── go.sum
```

### Build/Test Commands

```bash
go build ./cmd/server/   # Binary builds successfully
go test ./...            # All tests pass
```

### Environment Variables Supported

- `PORT` (default: 13207)
- `DATABASE_URL` (required)
- `DOCKER_HOST`
- `LOG_LEVEL` (default: info)
- `ADMIN_PASSWORD` (required)
- `ENVIRONMENT` (default: development)
