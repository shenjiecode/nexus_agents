package service

import (
	"context"
	"fmt"
	"strconv"
	"sync"
	"github.com/docker/docker/api/types"
	"github.com/docker/docker/api/types/filters"
	containertypes "github.com/docker/docker/api/types/container"
	"github.com/docker/docker/api/types/network"
	"github.com/docker/docker/client"
	"github.com/docker/go-connections/nat"
	"go.uber.org/zap"

	ocispec "github.com/opencontainers/image-spec/specs-go/v1"
)

// Constants matching the Node.js picoclaw-pool.ts configuration
const (
	DefaultStartPort = 4100
	MaxContainers    = 20
	ContainerPrefix  = "picoclaw"
	MaxPortRange     = 1000
	ContainerMountPath = "/root/.picoclaw/"
)

// ContainerStatus represents the lifecycle state of a container
type ContainerStatus string

const (
	StatusStarting ContainerStatus = "starting"
	StatusRunning  ContainerStatus = "running"
	StatusStopping ContainerStatus = "stopping"
	StatusStopped  ContainerStatus = "stopped"
	StatusError    ContainerStatus = "error"
)

// ContainerInfo holds metadata about a managed container
type ContainerInfo struct {
	ContainerID string
	Name        string
	Image       string
	RoleID      string
	Port        int
	SSHPort     int
	URL         string
	Status      ContainerStatus
}

// DockerClient defines the subset of the Docker API used by ContainerPool.
// This enables testing with a mock implementation.
type DockerClient interface {
	ContainerCreate(ctx context.Context, config *containertypes.Config, hostConfig *containertypes.HostConfig, networkingConfig *network.NetworkingConfig, platform *ocispec.Platform, name string) (containertypes.CreateResponse, error)
	ContainerStart(ctx context.Context, containerID string, options containertypes.StartOptions) error
	ContainerStop(ctx context.Context, containerID string, options containertypes.StopOptions) error
	ContainerRemove(ctx context.Context, containerID string, options containertypes.RemoveOptions) error
	ContainerInspect(ctx context.Context, containerID string) (types.ContainerJSON, error)
	ContainerList(ctx context.Context, options containertypes.ListOptions) ([]types.Container, error)
	Close() error
}

// ContainerPool manages Docker containers for role debugging sessions.
type ContainerPool struct {
	client     DockerClient
	logger     *zap.Logger
	mu         sync.RWMutex
	containers map[string]*ContainerInfo // keyed by container ID
}

// NewContainerPool creates a new ContainerPool with the given Docker client.
func NewContainerPool(cli DockerClient, logger *zap.Logger) *ContainerPool {
	return &ContainerPool{
		client:     cli,
		logger:     logger,
		containers: make(map[string]*ContainerInfo),
	}
}

// NewDockerClient creates a real Docker API client from environment.
func NewDockerClient() (DockerClient, error) {
	cli, err := client.NewClientWithOpts(client.FromEnv, client.WithAPIVersionNegotiation())
	if err != nil {
		return nil, fmt.Errorf("failed to create Docker client: %w", err)
	}
	return cli, nil
}

// AllocateContainer creates and starts a new container for debugging a role.
// roleID identifies the role, roleDir is the host path to mount into the container.
// variant is kept for labeling but does not affect image selection.
func (p *ContainerPool) AllocateContainer(ctx context.Context, roleID, roleDir, variant string) (*ContainerInfo, error) {
	// Check container limit
	p.mu.RLock()
	running := p.countRunning()
	p.mu.RUnlock()

	if running >= MaxContainers {
		return nil, fmt.Errorf("maximum number of containers (%d) reached", MaxContainers)
	}

	// Find available port
	port, err := p.FindAvailablePort(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to find available port: %w", err)
	}

	sshPort := port + 1000
	imageName := "sipeed/picoclaw:latest"
	containerName := fmt.Sprintf("%s-%s-%d", ContainerPrefix, roleID, port)

	p.logger.Info("allocating container",
		zap.String("roleID", roleID),
		zap.String("variant", variant),
		zap.Int("port", port),
		zap.String("image", imageName),
	)

	info := &ContainerInfo{
		Name:    containerName,
		Image:   imageName,
		RoleID:  roleID,
		Port:    port,
		SSHPort: sshPort,
		URL:     fmt.Sprintf("http://localhost:%d", port),
		Status:  StatusStarting,
	}

	// Build port bindings
	portBindings := nat.PortMap{
		"18800/tcp": []nat.PortBinding{
			{HostIP: "0.0.0.0", HostPort: strconv.Itoa(sshPort)},
		},
		"18790/tcp": []nat.PortBinding{
			{HostIP: "0.0.0.0", HostPort: strconv.Itoa(port)},
		},
	}

	// Container config
	containerConfig := &containertypes.Config{
		Image:   imageName,
		Cmd:     []string{"--allow-empty", "--host", "0.0.0.0"},
		ExposedPorts: nat.PortSet{
			"18800/tcp":   struct{}{},
			"18790/tcp": struct{}{},
		},
		Env: []string{
			fmt.Sprintf("PIKOCLAW_MODE=%s", variant),
			fmt.Sprintf("WORKSPACE_ID=%s", roleID),
			fmt.Sprintf("USER_ID=%s", roleID),
		},
		Labels: map[string]string{
			"nexus.picoclaw":           "true",
			"nexus.picoclaw.workspace": roleID,
			"nexus.picoclaw.user":      roleID,
			"nexus.picoclaw.variant":   variant,
			"nexus.managed":            "true",
		},
	}

	// Host config
	hostConfig := &containertypes.HostConfig{
		PortBindings: portBindings,
		RestartPolicy: containertypes.RestartPolicy{
			Name: "unless-stopped",
		},
		AutoRemove: false,
	}
	if roleDir != "" {
		hostConfig.Binds = []string{fmt.Sprintf("%s:%s:rw", roleDir, ContainerMountPath)}
	}

	// Create container
	resp, err := p.client.ContainerCreate(ctx, containerConfig, hostConfig, nil, nil, containerName)
	if err != nil {
		info.Status = StatusError
		p.logger.Error("failed to create container",
			zap.String("roleID", roleID),
			zap.String("variant", variant),
			zap.Error(err),
		)
		return nil, fmt.Errorf("failed to create container: %w", err)
	}

	info.ContainerID = resp.ID

	// Start container
	if err := p.client.ContainerStart(ctx, resp.ID, containertypes.StartOptions{}); err != nil {
		info.Status = StatusError
		_ = p.client.ContainerRemove(ctx, resp.ID, containertypes.RemoveOptions{Force: true})
		p.logger.Error("failed to start container",
			zap.String("containerID", resp.ID),
			zap.Error(err),
		)
		return nil, fmt.Errorf("failed to start container: %w", err)
	}

	info.Status = StatusRunning

	// Register in pool
	p.mu.Lock()
	p.containers[resp.ID] = info
	p.mu.Unlock()

	p.logger.Info("container allocated",
		zap.String("containerID", resp.ID),
		zap.String("roleID", roleID),
		zap.Int("port", port),
	)

	return info, nil
}

// StopContainer stops a running container by its ID.
func (p *ContainerPool) StopContainer(ctx context.Context, containerID string) error {
	p.mu.Lock()
	info, exists := p.containers[containerID]
	if exists {
		info.Status = StatusStopping
	}
	p.mu.Unlock()

	// Stop with 10 second timeout (matching Node.js: container.stop({ t: 10 }))
	timeout := 10
	if err := p.client.ContainerStop(ctx, containerID, containertypes.StopOptions{Timeout: &timeout}); err != nil {
		// Container might already be stopped
		p.logger.Warn("error stopping container, continuing",
			zap.String("containerID", containerID),
			zap.Error(err),
		)
	}

	if exists {
		p.mu.Lock()
		info.Status = StatusStopped
		p.mu.Unlock()
	}

	p.logger.Info("container stopped", zap.String("containerID", containerID))
	return nil
}

// RemoveContainer removes a container by its ID. It will force-remove
// even if the container is still running.
func (p *ContainerPool) RemoveContainer(ctx context.Context, containerID string) error {
	err := p.client.ContainerRemove(ctx, containerID, containertypes.RemoveOptions{Force: true})
	if err != nil {
		p.logger.Error("failed to remove container",
			zap.String("containerID", containerID),
			zap.Error(err),
		)
		return fmt.Errorf("failed to remove container: %w", err)
	}

	// Unregister from pool
	p.mu.Lock()
	delete(p.containers, containerID)
	p.mu.Unlock()

	p.logger.Info("container removed", zap.String("containerID", containerID))
	return nil
}

// GetContainerStatus inspects a container and returns its current state.
func (p *ContainerPool) GetContainerStatus(ctx context.Context, containerID string) (*ContainerInfo, error) {
	inspect, err := p.client.ContainerInspect(ctx, containerID)
	if err != nil {
		// Check if container doesn't exist
		p.mu.Lock()
		if info, exists := p.containers[containerID]; exists {
			info.Status = StatusStopped
			p.mu.Unlock()
			return info, nil
		}
		p.mu.Unlock()
		return nil, fmt.Errorf("failed to inspect container: %w", err)
	}

	p.mu.Lock()
	info, exists := p.containers[containerID]
	p.mu.Unlock()

	if !exists {
		// Build info from inspect result
		info = &ContainerInfo{
			ContainerID: containerID,
			Name:        inspect.Name,
			Image:       inspect.Config.Image,
		}
	}

	if inspect.State.Running {
		info.Status = StatusRunning
	} else {
		info.Status = StatusStopped
	}

	return info, nil
}

// FindAvailablePort finds the first available port starting from DefaultStartPort.
// It checks existing Docker container port bindings to avoid conflicts.
func (p *ContainerPool) FindAvailablePort(ctx context.Context) (int, error) {
	// Get all containers to check their port bindings
	containers, err := p.client.ContainerList(ctx, containertypes.ListOptions{All: true})
	if err != nil {
		p.logger.Warn("Docker not reachable, assuming port available", zap.Error(err))
		return DefaultStartPort, nil
	}

	// Build set of used ports
	usedPorts := make(map[int]struct{})
	for _, c := range containers {
		for _, p := range c.Ports {
			if p.PublicPort != 0 {
				usedPorts[int(p.PublicPort)] = struct{}{}
			}
		}
	}

	// Find first available port in range
	for port := DefaultStartPort; port < DefaultStartPort+MaxPortRange; port++ {
		if _, used := usedPorts[port]; !used {
			return port, nil
		}
	}

	return 0, fmt.Errorf("no available ports in range %d-%d", DefaultStartPort, DefaultStartPort+MaxPortRange)
}

// GetContainer returns a container info from the in-memory pool.
func (p *ContainerPool) GetContainer(containerID string) (*ContainerInfo, bool) {
	p.mu.RLock()
	defer p.mu.RUnlock()
	info, ok := p.containers[containerID]
	return info, ok
}

// ListContainers returns all tracked containers.
func (p *ContainerPool) ListContainers() []*ContainerInfo {
	p.mu.RLock()
	defer p.mu.RUnlock()
	result := make([]*ContainerInfo, 0, len(p.containers))
	for _, info := range p.containers {
		result = append(result, info)
	}
	return result
}

// RunningCount returns the number of currently running/starting containers.
func (p *ContainerPool) RunningCount() int {
	p.mu.RLock()
	defer p.mu.RUnlock()
	return p.countRunning()
}

// countRunning returns count without acquiring lock (caller must hold lock).
func (p *ContainerPool) countRunning() int {
	count := 0
	for _, info := range p.containers {
		if info.Status == StatusRunning || info.Status == StatusStarting {
			count++
		}
	}
	return count
}

// CleanupAll stops and removes all tracked containers.
func (p *ContainerPool) CleanupAll(ctx context.Context) {
	p.mu.RLock()
	ids := make([]string, 0, len(p.containers))
	for id := range p.containers {
		ids = append(ids, id)
	}
	p.mu.RUnlock()

	for _, id := range ids {
		_ = p.StopContainer(ctx, id)
		_ = p.RemoveContainer(ctx, id)
	}
}

// StartContainer starts an existing stopped container by its ID.
func (p *ContainerPool) StartContainer(ctx context.Context, containerID string) error {
	p.mu.Lock()
	info, exists := p.containers[containerID]
	if exists {
		info.Status = StatusStarting
	}
	p.mu.Unlock()

	if err := p.client.ContainerStart(ctx, containerID, containertypes.StartOptions{}); err != nil {
		if exists {
			p.mu.Lock()
			info.Status = StatusError
			p.mu.Unlock()
		}
		p.logger.Error("failed to start container",
			zap.String("containerID", containerID),
			zap.Error(err),
		)
		return fmt.Errorf("failed to start container: %w", err)
	}

	if exists {
		p.mu.Lock()
		info.Status = StatusRunning
		p.mu.Unlock()
	} else {
		// Register new container in pool
		inspect, err := p.client.ContainerInspect(ctx, containerID)
		if err == nil {
			newInfo := &ContainerInfo{
				ContainerID: containerID,
				Name:        inspect.Name,
				Image:       inspect.Config.Image,
				Status:      StatusRunning,
			}
			p.mu.Lock()
			p.containers[containerID] = newInfo
			p.mu.Unlock()
		}
	}

	p.logger.Info("container started", zap.String("containerID", containerID))
	return nil
}

// ListManagedContainers lists all containers with the nexus.managed=true label.
func (p *ContainerPool) ListManagedContainers(ctx context.Context) ([]*ContainerInfo, error) {
	f := filters.NewArgs()
	f.Add("label", "nexus.managed=true")

	containers, err := p.client.ContainerList(ctx, containertypes.ListOptions{
		All:     true,
		Filters: f,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to list containers: %w", err)
	}

	result := make([]*ContainerInfo, 0, len(containers))
	for _, c := range containers {
		info := &ContainerInfo{
			ContainerID: c.ID,
			Name:        c.Names[0],
			Image:       c.Image,
			Status:      StatusStopped,
		}
		if c.State == "running" {
			info.Status = StatusRunning
		}
		// Extract port info if available
		for _, port := range c.Ports {
			if port.PublicPort != 0 {
				if port.PrivatePort == 18790 {
					info.Port = int(port.PublicPort)
					info.URL = fmt.Sprintf("http://localhost:%d", port.PublicPort)
				}
				if port.PrivatePort == 18800 {
					info.SSHPort = int(port.PublicPort)
				}
			}
		}
		result = append(result, info)
	}

	return result, nil
}

// AllocateUserContainer creates and starts a container with user-specific labels.
// containerName is the name for the container.
// roleDir is the host path to mount into the container.
// variant is kept for labeling but does not affect image selection.
func (p *ContainerPool) AllocateUserContainer(ctx context.Context, userID, containerName, roleDir, variant string) (*ContainerInfo, error) {
	// Check container limit
	p.mu.RLock()
	running := p.countRunning()
	p.mu.RUnlock()

	if running >= MaxContainers {
		return nil, fmt.Errorf("maximum number of containers (%d) reached", MaxContainers)
	}

	// Find available port
	port, err := p.FindAvailablePort(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to find available port: %w", err)
	}

	sshPort := port + 1000
	imageName := "sipeed/picoclaw:latest"

	p.logger.Info("allocating user container",
		zap.String("userID", userID),
		zap.String("containerName", containerName),
		zap.String("variant", variant),
		zap.Int("port", port),
		zap.String("image", imageName),
	)

	info := &ContainerInfo{
		Name:    containerName,
		Image:   imageName,
		RoleID:  userID,
		Port:    port,
		SSHPort: sshPort,
		URL:     fmt.Sprintf("http://localhost:%d", port),
		Status:  StatusStarting,
	}

	// Build port bindings
	portBindings := nat.PortMap{
		"18800/tcp": []nat.PortBinding{
			{HostIP: "0.0.0.0", HostPort: strconv.Itoa(sshPort)},
		},
		"18790/tcp": []nat.PortBinding{
			{HostIP: "0.0.0.0", HostPort: strconv.Itoa(port)},
		},
	}

	// Container config with user-specific labels
	containerConfig := &containertypes.Config{
		Image:   imageName,
		Cmd:     []string{"--allow-empty", "--host", "0.0.0.0"},
		ExposedPorts: nat.PortSet{
			"18800/tcp":   struct{}{},
			"18790/tcp": struct{}{},
		},
		Env: []string{
			fmt.Sprintf("PIKOCLAW_MODE=%s", variant),
			fmt.Sprintf("WORKSPACE_ID=%s", userID),
			fmt.Sprintf("USER_ID=%s", userID),
		},
		Labels: map[string]string{
			"nexus.picoclaw":        "true",
			"nexus.managed":         "true",
			"nexus.container-type":  "user",
			"nexus.picoclaw.user":   userID,
			"nexus.picoclaw.variant": variant,
		},
	}

	// Host config
	hostConfig := &containertypes.HostConfig{
		PortBindings: portBindings,
		RestartPolicy: containertypes.RestartPolicy{
			Name: "unless-stopped",
		},
		AutoRemove: false,
	}
	if roleDir != "" {
		hostConfig.Binds = []string{fmt.Sprintf("%s:%s:rw", roleDir, ContainerMountPath)}
	}

	// Create container
	resp, err := p.client.ContainerCreate(ctx, containerConfig, hostConfig, nil, nil, containerName)
	if err != nil {
		info.Status = StatusError
		p.logger.Error("failed to create user container",
			zap.String("userID", userID),
			zap.String("containerName", containerName),
			zap.Error(err),
		)
		return nil, fmt.Errorf("failed to create container: %w", err)
	}

	info.ContainerID = resp.ID

	// Start container
	if err := p.client.ContainerStart(ctx, resp.ID, containertypes.StartOptions{}); err != nil {
		info.Status = StatusError
		// Attempt cleanup
		_ = p.client.ContainerRemove(ctx, resp.ID, containertypes.RemoveOptions{Force: true})
		p.logger.Error("failed to start user container",
			zap.String("containerID", resp.ID),
			zap.Error(err),
		)
		return nil, fmt.Errorf("failed to start container: %w", err)
	}

	info.Status = StatusRunning

	// Register in pool
	p.mu.Lock()
	p.containers[resp.ID] = info
	p.mu.Unlock()

	p.logger.Info("user container allocated",
		zap.String("containerID", resp.ID),
		zap.String("userID", userID),
		zap.Int("port", port),
	)

	return info, nil
}
