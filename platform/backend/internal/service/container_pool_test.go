package service

import (
	"context"
	"fmt"
	"testing"

	"github.com/docker/docker/api/types"
	containertypes "github.com/docker/docker/api/types/container"
	"github.com/docker/docker/api/types/network"
	"github.com/docker/go-connections/nat"
	"go.uber.org/zap"

	ocispec "github.com/opencontainers/image-spec/specs-go/v1"
)

// mockDockerClient implements DockerClient for testing
type mockDockerClient struct {
	containers map[string]*mockContainer
	createErr  error
	startErr   error
	stopErr    error
	removeErr  error
	inspectErr error
	listErr    error
	nextID     int
}

type mockContainer struct {
	name    string
	image   string
	running bool
	config  *containertypes.Config
	host    *containertypes.HostConfig
	ports   []types.Port
}

func newMockClient() *mockDockerClient {
	return &mockDockerClient{
		containers: make(map[string]*mockContainer),
		nextID:     1,
	}
}

func (m *mockDockerClient) ContainerCreate(ctx context.Context, config *containertypes.Config, hostConfig *containertypes.HostConfig, networkingConfig *network.NetworkingConfig, platform *ocispec.Platform, name string) (containertypes.CreateResponse, error) {
	if m.createErr != nil {
		return containertypes.CreateResponse{}, m.createErr
	}
	id := fmt.Sprintf("container-%d", m.nextID)
	m.nextID++
	m.containers[id] = &mockContainer{
		name:    name,
		image:   config.Image,
		running: false,
		config:  config,
		host:    hostConfig,
	}
	return containertypes.CreateResponse{ID: id}, nil
}

func (m *mockDockerClient) ContainerStart(ctx context.Context, containerID string, options containertypes.StartOptions) error {
	if m.startErr != nil {
		return m.startErr
	}
	if c, ok := m.containers[containerID]; ok {
		c.running = true
	}
	return nil
}

func (m *mockDockerClient) ContainerStop(ctx context.Context, containerID string, options containertypes.StopOptions) error {
	if m.stopErr != nil {
		return m.stopErr
	}
	if c, ok := m.containers[containerID]; ok {
		c.running = false
	}
	return nil
}

func (m *mockDockerClient) ContainerRemove(ctx context.Context, containerID string, options containertypes.RemoveOptions) error {
	if m.removeErr != nil {
		return m.removeErr
	}
	delete(m.containers, containerID)
	return nil
}

func (m *mockDockerClient) ContainerInspect(ctx context.Context, containerID string) (types.ContainerJSON, error) {
	if m.inspectErr != nil {
		return types.ContainerJSON{}, m.inspectErr
	}
	c, ok := m.containers[containerID]
	if !ok {
		return types.ContainerJSON{}, fmt.Errorf("no such container: %s", containerID)
	}
	return types.ContainerJSON{
		ContainerJSONBase: &types.ContainerJSONBase{
			ID:   containerID,
			Name: c.name,
			State: &types.ContainerState{
				Running: c.running,
			},
		},
		Config: &containertypes.Config{
			Image: c.image,
		},
	}, nil
}

func (m *mockDockerClient) ContainerList(ctx context.Context, options containertypes.ListOptions) ([]types.Container, error) {
	if m.listErr != nil {
		return nil, m.listErr
	}
	var result []types.Container
	for id, c := range m.containers {
		result = append(result, types.Container{
			ID:    id,
			Names: []string{c.name},
			Ports: c.ports,
		})
	}
	return result, nil
}

func (m *mockDockerClient) Close() error { return nil }

// Helper to create a test pool
func newTestPool(mock *mockDockerClient) *ContainerPool {
	logger := zap.NewNop()
	return NewContainerPool(mock, logger)
}

// --- Unit Tests ---

func TestNewContainerPool(t *testing.T) {
	mock := newMockClient()
	pool := newTestPool(mock)

	if pool == nil {
		t.Fatal("NewContainerPool returned nil")
	}
	if len(pool.containers) != 0 {
		t.Errorf("expected empty containers map, got %d entries", len(pool.containers))
	}
}

func TestAllocateContainer(t *testing.T) {
	mock := newMockClient()
	pool := newTestPool(mock)
	ctx := context.Background()

	info, err := pool.AllocateContainer(ctx, "test-role", "/tmp/test-role", "full")
	if err != nil {
		t.Fatalf("AllocateContainer() error = %v", err)
	}

	// Verify returned info
	if info.ContainerID == "" {
		t.Error("expected non-empty container ID")
	}
	if info.Status != StatusRunning {
		t.Errorf("expected status running, got %s", info.Status)
	}
	if info.Port < DefaultStartPort {
		t.Errorf("expected port >= %d, got %d", DefaultStartPort, info.Port)
	}
	if info.SSHPort != info.Port+1000 {
		t.Errorf("expected SSH port = %d, got %d", info.Port+1000, info.SSHPort)
	}
	if info.Image != "sipeed/picoclaw:full" {
		t.Errorf("expected image 'sipeed/picoclaw:full', got %s", info.Image)
	}
	if info.URL != fmt.Sprintf("http://localhost:%d", info.Port) {
		t.Errorf("unexpected URL: %s", info.URL)
	}

	// Verify container is tracked
	tracked, exists := pool.GetContainer(info.ContainerID)
	if !exists {
		t.Error("container not tracked in pool")
	}
	if tracked.ContainerID != info.ContainerID {
		t.Errorf("tracked container ID mismatch: %s vs %s", tracked.ContainerID, info.ContainerID)
	}

	// Verify Docker calls
	if len(mock.containers) != 1 {
		t.Fatalf("expected 1 container in mock, got %d", len(mock.containers))
	}
	mc := mock.containers[info.ContainerID]
	if !mc.running {
		t.Error("expected container to be running")
	}

	// Verify container config
	if mc.config.Image != "sipeed/picoclaw:full" {
		t.Errorf("unexpected image: %s", mc.config.Image)
	}
	if mc.config.Labels["nexus.picoclaw"] != "true" {
		t.Error("expected nexus.picoclaw label")
	}
	if mc.config.Labels["nexus.managed"] != "true" {
		t.Error("expected nexus.managed label")
	}

	// Verify env vars
	expectedEnvs := map[string]bool{
		"PIKOCLAW_MODE=full":        false,
		fmt.Sprintf("WORKSPACE_ID=%s", "test-role"): false,
		fmt.Sprintf("USER_ID=%s", "test-role"):      false,
	}
	for _, env := range mc.config.Env {
		if _, ok := expectedEnvs[env]; ok {
			expectedEnvs[env] = true
		}
	}
	for env, found := range expectedEnvs {
		if !found {
			t.Errorf("expected env var %s not found", env)
		}
	}

	// Verify host config - mount
	expectedBind := fmt.Sprintf("/tmp/test-role:%s:rw", ContainerMountPath)
	foundBind := false
	for _, bind := range mc.host.Binds {
		if bind == expectedBind {
			foundBind = true
			break
		}
	}
	if !foundBind {
		t.Errorf("expected bind mount %s not found in %v", expectedBind, mc.host.Binds)
	}
}

func TestAllocateContainerVariants(t *testing.T) {
	variants := []string{"base", "full", "heavy"}

	for _, variant := range variants {
		t.Run(variant, func(t *testing.T) {
			mock := newMockClient()
			pool := newTestPool(mock)
			ctx := context.Background()

			info, err := pool.AllocateContainer(ctx, "role-"+variant, "/tmp/role", variant)
			if err != nil {
				t.Fatalf("AllocateContainer(%s) error = %v", variant, err)
			}

			expectedImage := fmt.Sprintf("sipeed/picoclaw:%s", variant)
			if info.Image != expectedImage {
				t.Errorf("expected image %s, got %s", expectedImage, info.Image)
			}
		})
	}
}

func TestAllocateContainerMaxLimit(t *testing.T) {
	mock := newMockClient()
	pool := newTestPool(mock)
	ctx := context.Background()

	// Allocate max containers
	for i := 0; i < MaxContainers; i++ {
		roleID := fmt.Sprintf("role-%d", i)
		_, err := pool.AllocateContainer(ctx, roleID, "/tmp/"+roleID, "base")
		if err != nil {
			t.Fatalf("AllocateContainer(%d) error = %v", i, err)
		}
	}

	// Next allocation should fail
	_, err := pool.AllocateContainer(ctx, "overflow-role", "/tmp/overflow", "base")
	if err == nil {
		t.Error("expected error when exceeding max containers")
	}
}

func TestAllocateContainerCreateError(t *testing.T) {
	mock := newMockClient()
	mock.createErr = fmt.Errorf("docker error")
	pool := newTestPool(mock)
	ctx := context.Background()

	_, err := pool.AllocateContainer(ctx, "test-role", "/tmp/test", "full")
	if err == nil {
		t.Error("expected error from container create failure")
	}
}

func TestAllocateContainerStartError(t *testing.T) {
	mock := newMockClient()
	mock.startErr = fmt.Errorf("start failed")
	pool := newTestPool(mock)
	ctx := context.Background()

	_, err := pool.AllocateContainer(ctx, "test-role", "/tmp/test", "full")
	if err == nil {
		t.Error("expected error from container start failure")
	}

	// Container should have been cleaned up
	if len(mock.containers) != 0 {
		t.Errorf("expected 0 containers after start failure, got %d", len(mock.containers))
	}
}

func TestStopContainer(t *testing.T) {
	mock := newMockClient()
	pool := newTestPool(mock)
	ctx := context.Background()

	// First allocate
	info, _ := pool.AllocateContainer(ctx, "test-role", "/tmp/test", "full")

	// Stop
	err := pool.StopContainer(ctx, info.ContainerID)
	if err != nil {
		t.Fatalf("StopContainer() error = %v", err)
	}

	// Verify status
	tracked, exists := pool.GetContainer(info.ContainerID)
	if !exists {
		t.Fatal("container should still be tracked")
	}
	if tracked.Status != StatusStopped {
		t.Errorf("expected status stopped, got %s", tracked.Status)
	}

	// Verify mock container stopped
	mc := mock.containers[info.ContainerID]
	if mc.running {
		t.Error("mock container should be stopped")
	}
}

func TestStopContainerAlreadyStopped(t *testing.T) {
	mock := newMockClient()
	mock.stopErr = fmt.Errorf("container already stopped")
	pool := newTestPool(mock)
	ctx := context.Background()

	info, _ := pool.AllocateContainer(ctx, "test-role", "/tmp/test", "full")

	// Stop should not return error even if Docker reports already stopped
	err := pool.StopContainer(ctx, info.ContainerID)
	if err != nil {
		t.Fatalf("StopContainer() should not error for already-stopped, got %v", err)
	}
}

func TestRemoveContainer(t *testing.T) {
	mock := newMockClient()
	pool := newTestPool(mock)
	ctx := context.Background()

	info, _ := pool.AllocateContainer(ctx, "test-role", "/tmp/test", "full")

	err := pool.RemoveContainer(ctx, info.ContainerID)
	if err != nil {
		t.Fatalf("RemoveContainer() error = %v", err)
	}

	// Should no longer be tracked
	_, exists := pool.GetContainer(info.ContainerID)
	if exists {
		t.Error("container should not be tracked after removal")
	}
}

func TestRemoveContainerError(t *testing.T) {
	mock := newMockClient()
	mock.removeErr = fmt.Errorf("remove failed")
	pool := newTestPool(mock)
	ctx := context.Background()

	// Allocate (use a fresh mock for create/start, override remove only)
	info, _ := pool.AllocateContainer(ctx, "test-role", "/tmp/test", "full")

	// Set remove error after allocation
	mock.removeErr = fmt.Errorf("remove failed")

	err := pool.RemoveContainer(ctx, info.ContainerID)
	if err == nil {
		t.Error("expected error from container remove failure")
	}
}

func TestGetContainerStatus(t *testing.T) {
	mock := newMockClient()
	pool := newTestPool(mock)
	ctx := context.Background()

	info, _ := pool.AllocateContainer(ctx, "test-role", "/tmp/test", "full")

	status, err := pool.GetContainerStatus(ctx, info.ContainerID)
	if err != nil {
		t.Fatalf("GetContainerStatus() error = %v", err)
	}
	if status.Status != StatusRunning {
		t.Errorf("expected running, got %s", status.Status)
	}
}

func TestGetContainerStatusStopped(t *testing.T) {
	mock := newMockClient()
	pool := newTestPool(mock)
	ctx := context.Background()

	info, _ := pool.AllocateContainer(ctx, "test-role", "/tmp/test", "full")

	// Stop the container
	_ = pool.StopContainer(ctx, info.ContainerID)

	status, err := pool.GetContainerStatus(ctx, info.ContainerID)
	if err != nil {
		t.Fatalf("GetContainerStatus() error = %v", err)
	}
	if status.Status != StatusStopped {
		t.Errorf("expected stopped, got %s", status.Status)
	}
}

func TestGetContainerStatusNotExist(t *testing.T) {
	mock := newMockClient()
	pool := newTestPool(mock)
	ctx := context.Background()

	_, err := pool.GetContainerStatus(ctx, "nonexistent")
	if err == nil {
		t.Error("expected error for nonexistent container")
	}
}

func TestGetContainerStatusInspectErrorTracked(t *testing.T) {
	mock := newMockClient()
	pool := newTestPool(mock)
	ctx := context.Background()

	info, _ := pool.AllocateContainer(ctx, "test-role", "/tmp/test", "full")

	// Set inspect error (simulates container removed externally)
	mock.inspectErr = fmt.Errorf("no such container")

	status, err := pool.GetContainerStatus(ctx, info.ContainerID)
	if err != nil {
		t.Fatalf("GetContainerStatus() should not error for tracked container, got %v", err)
	}
	if status.Status != StatusStopped {
		t.Errorf("expected stopped for missing tracked container, got %s", status.Status)
	}
}

func TestFindAvailablePort(t *testing.T) {
	mock := newMockClient()
	pool := newTestPool(mock)
	ctx := context.Background()

	port, err := pool.FindAvailablePort(ctx)
	if err != nil {
		t.Fatalf("FindAvailablePort() error = %v", err)
	}
	if port != DefaultStartPort {
		t.Errorf("expected %d, got %d", DefaultStartPort, port)
	}
}

func TestFindAvailablePortWithUsedPorts(t *testing.T) {
	mock := newMockClient()
	// Pre-populate a container using port 4100
	mock.containers["existing"] = &mockContainer{
		name: "existing-container",
		ports: []types.Port{
			{PublicPort: uint16(DefaultStartPort)},
		},
	}
	pool := newTestPool(mock)
	ctx := context.Background()

	port, err := pool.FindAvailablePort(ctx)
	if err != nil {
		t.Fatalf("FindAvailablePort() error = %v", err)
	}
	if port != DefaultStartPort+1 {
		t.Errorf("expected %d, got %d", DefaultStartPort+1, port)
	}
}

func TestFindAvailablePortDockerUnreachable(t *testing.T) {
	mock := newMockClient()
	mock.listErr = fmt.Errorf("docker not running")
	pool := newTestPool(mock)
	ctx := context.Background()

	port, err := pool.FindAvailablePort(ctx)
	if err != nil {
		t.Fatalf("FindAvailablePort() should not error when Docker unreachable, got %v", err)
	}
	if port != DefaultStartPort {
		t.Errorf("expected default port when Docker unreachable, got %d", port)
	}
}

func TestListContainers(t *testing.T) {
	mock := newMockClient()
	pool := newTestPool(mock)
	ctx := context.Background()

	// Empty pool
	list := pool.ListContainers()
	if len(list) != 0 {
		t.Errorf("expected 0 containers, got %d", len(list))
	}

	// Allocate some
	pool.AllocateContainer(ctx, "role-1", "/tmp/role1", "base")
	pool.AllocateContainer(ctx, "role-2", "/tmp/role2", "full")

	list = pool.ListContainers()
	if len(list) != 2 {
		t.Errorf("expected 2 containers, got %d", len(list))
	}
}

func TestRunningCount(t *testing.T) {
	mock := newMockClient()
	pool := newTestPool(mock)
	ctx := context.Background()

	if pool.RunningCount() != 0 {
		t.Errorf("expected 0 running, got %d", pool.RunningCount())
	}

	pool.AllocateContainer(ctx, "role-1", "/tmp/role1", "base")
	if pool.RunningCount() != 1 {
		t.Errorf("expected 1 running, got %d", pool.RunningCount())
	}

	pool.AllocateContainer(ctx, "role-2", "/tmp/role2", "full")
	if pool.RunningCount() != 2 {
		t.Errorf("expected 2 running, got %d", pool.RunningCount())
	}
}

func TestCleanupAll(t *testing.T) {
	mock := newMockClient()
	pool := newTestPool(mock)
	ctx := context.Background()

	pool.AllocateContainer(ctx, "role-1", "/tmp/role1", "base")
	pool.AllocateContainer(ctx, "role-2", "/tmp/role2", "full")

	pool.CleanupAll(ctx)

	if pool.RunningCount() != 0 {
		t.Errorf("expected 0 running after cleanup, got %d", pool.RunningCount())
	}
	if len(pool.ListContainers()) != 0 {
		t.Errorf("expected 0 containers after cleanup, got %d", len(pool.ListContainers()))
	}
}

func TestContainerPortBindings(t *testing.T) {
	mock := newMockClient()
	pool := newTestPool(mock)
	ctx := context.Background()

	info, err := pool.AllocateContainer(ctx, "test-role", "/tmp/test", "full")
	if err != nil {
		t.Fatalf("AllocateContainer() error = %v", err)
	}

	mc := mock.containers[info.ContainerID]

	// Verify exposed ports in container config
	if _, ok := mc.config.ExposedPorts["22/tcp"]; !ok {
		t.Error("expected 22/tcp in exposed ports")
	}
	if _, ok := mc.config.ExposedPorts["8080/tcp"]; !ok {
		t.Error("expected 8080/tcp in exposed ports")
	}

	// Verify port bindings in host config
	if mc.host.PortBindings == nil {
		t.Fatal("expected port bindings")
	}

	sshBindings, ok := mc.host.PortBindings[nat.Port("22/tcp")]
	if !ok || len(sshBindings) == 0 {
		t.Fatal("expected SSH port binding")
	}
	if sshBindings[0].HostPort != fmt.Sprintf("%d", info.Port+1000) {
		t.Errorf("expected SSH port %d, got %s", info.Port+1000, sshBindings[0].HostPort)
	}

	httpBindings, ok := mc.host.PortBindings[nat.Port("8080/tcp")]
	if !ok || len(httpBindings) == 0 {
		t.Fatal("expected HTTP port binding")
	}
	if httpBindings[0].HostPort != fmt.Sprintf("%d", info.Port) {
		t.Errorf("expected HTTP port %d, got %s", info.Port, httpBindings[0].HostPort)
	}
}

func TestContainerRestartPolicy(t *testing.T) {
	mock := newMockClient()
	pool := newTestPool(mock)
	ctx := context.Background()

	info, _ := pool.AllocateContainer(ctx, "test-role", "/tmp/test", "full")
	mc := mock.containers[info.ContainerID]

	if mc.host.RestartPolicy.Name != "unless-stopped" {
		t.Errorf("expected restart policy 'unless-stopped', got %s", mc.host.RestartPolicy.Name)
	}
}

// --- Integration Tests (require Docker) ---

// These tests are only run when DOCKER_HOST is available.
// Run with: go test -tags=integration -run TestIntegration

func TestIntegrationAllocateAndStop(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test in short mode")
	}

	cli, err := NewDockerClient()
	if err != nil {
		t.Skipf("Docker not available: %v", err)
	}
	defer cli.Close()

	logger := zap.NewNop()
	pool := NewContainerPool(cli, logger)
	ctx := context.Background()

	// Allocate
	info, err := pool.AllocateContainer(ctx, "integration-test", "/tmp/integration-test", "base")
	if err != nil {
		t.Skipf("Docker daemon not available for integration test: %v", err)
	}
	t.Logf("Allocated container: %s on port %d", info.ContainerID, info.Port)

	// Verify status
	status, err := pool.GetContainerStatus(ctx, info.ContainerID)
	if err != nil {
		t.Fatalf("GetContainerStatus() error = %v", err)
	}
	if status.Status != StatusRunning {
		t.Errorf("expected running, got %s", status.Status)
	}

	// Cleanup
	err = pool.StopContainer(ctx, info.ContainerID)
	if err != nil {
		t.Fatalf("StopContainer() error = %v", err)
	}

	err = pool.RemoveContainer(ctx, info.ContainerID)
	if err != nil {
		t.Fatalf("RemoveContainer() error = %v", err)
	}
}
