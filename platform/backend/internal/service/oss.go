package service

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"io"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	awsConfig "github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/aws/aws-sdk-go-v2/service/s3/types"
	"github.com/nexus-agents/backend/internal/config"
	"github.com/nexus-agents/backend/internal/logger"
	"go.uber.org/zap"
)

// OSSService handles file storage operations using S3-compatible storage (JD Cloud OSS).
type OSSService struct {
	client        *s3.Client
	presignClient *s3.PresignClient
	appConfig     *config.Config
	logger        *logger.Logger
	endpoint      string
}

// NewOSSService creates a new OSSService instance.
// Returns nil if OSS is not configured (optional dependency).
func NewOSSService(cfg *config.Config) (*OSSService, error) {
	if cfg.OSSEndpoint == "" || cfg.OSSBucket == "" {
		// OSS not configured, return nil without error
		logger.Get().Info("OSS not configured, service disabled")
		return nil, nil
	}

	// Create AWS SDK config with custom endpoint resolver for JD Cloud
	awsCfg, err := awsConfig.LoadDefaultConfig(context.Background(),
		awsConfig.WithRegion(cfg.OSSRegion),
		awsConfig.WithCredentialsProvider(credentials.NewStaticCredentialsProvider(
			cfg.OSSAccessKeyID,
			cfg.OSSAccessKeySecret,
			"",
		)),
	)
	if err != nil {
		logger.Get().Error("Failed to create AWS config", zap.Error(err))
		return nil, fmt.Errorf("failed to create AWS config: %w", err)
	}

	// Create S3 client with custom endpoint
	client := s3.NewFromConfig(awsCfg, func(o *s3.Options) {
		o.BaseEndpoint = aws.String(cfg.OSSEndpoint)
		o.UsePathStyle = false
	})

	// Create presign client for generating presigned URLs
	presignClient := s3.NewPresignClient(client)

	logger.Get().Info("OSS service initialized",
		zap.String("endpoint", cfg.OSSEndpoint),
		zap.String("bucket", cfg.OSSBucket),
		zap.String("region", cfg.OSSRegion),
	)

	return &OSSService{
		client:        client,
		presignClient: presignClient,
		appConfig:     cfg,
		logger:        logger.Get(),
		endpoint:      cfg.OSSEndpoint,
	}, nil
}

// UploadFile uploads data to OSS and returns the public URL.
// bucketPath is the path within the bucket (e.g., "roles/user123/role456/config.json").
func (s *OSSService) UploadFile(bucketPath string, data []byte) (string, error) {
	if s == nil || s.client == nil {
		return "", fmt.Errorf("OSS service not configured")
	}

	ctx := context.Background()

	// Upload the file
	_, err := s.client.PutObject(ctx, &s3.PutObjectInput{
		Bucket: aws.String(s.appConfig.OSSBucket),
		Key:    aws.String(bucketPath),
		Body:   bytes.NewReader(data),
	})
	if err != nil {
		s.logger.Error("Failed to upload file to OSS",
			zap.String("path", bucketPath),
			zap.Int("size", len(data)),
			zap.Error(err),
		)
		return "", fmt.Errorf("failed to upload file to OSS: %w", err)
	}

	// Construct the URL
	url := s.buildURL(bucketPath)

	s.logger.Debug("File uploaded to OSS",
		zap.String("path", bucketPath),
		zap.String("url", url),
	)

	return url, nil
}

// GeneratePresignedUploadURL generates a presigned URL for uploading a file.
// The client can use this URL to upload directly to OSS without backend involvement.
func (s *OSSService) GeneratePresignedUploadURL(bucketPath string, expiresIn time.Duration) (string, error) {
	if s == nil || s.client == nil {
		return "", fmt.Errorf("OSS service not configured")
	}

	ctx := context.Background()

	// Generate presigned URL for PUT operation
	req, err := s.presignClient.PresignPutObject(ctx, &s3.PutObjectInput{
		Bucket: aws.String(s.appConfig.OSSBucket),
		Key:    aws.String(bucketPath),
	}, s3.WithPresignExpires(expiresIn))
	if err != nil {
		s.logger.Error("Failed to generate presigned upload URL",
			zap.String("path", bucketPath),
			zap.Duration("expiresIn", expiresIn),
			zap.Error(err),
		)
		return "", fmt.Errorf("failed to generate presigned upload URL: %w", err)
	}

	s.logger.Debug("Generated presigned upload URL",
		zap.String("path", bucketPath),
		zap.Duration("expiresIn", expiresIn),
	)

	return req.URL, nil
}

// GeneratePresignedDownloadURL generates a presigned URL for downloading a file.
// The client can use this URL to download directly from OSS without backend involvement.
func (s *OSSService) GeneratePresignedDownloadURL(bucketPath string, expiresIn time.Duration) (string, error) {
	if s == nil || s.client == nil {
		return "", fmt.Errorf("OSS service not configured")
	}

	ctx := context.Background()

	// Generate presigned URL for GET operation
	req, err := s.presignClient.PresignGetObject(ctx, &s3.GetObjectInput{
		Bucket: aws.String(s.appConfig.OSSBucket),
		Key:    aws.String(bucketPath),
	}, s3.WithPresignExpires(expiresIn))
	if err != nil {
		s.logger.Error("Failed to generate presigned download URL",
			zap.String("path", bucketPath),
			zap.Duration("expiresIn", expiresIn),
			zap.Error(err),
		)
		return "", fmt.Errorf("failed to generate presigned download URL: %w", err)
	}

	s.logger.Debug("Generated presigned download URL",
		zap.String("path", bucketPath),
		zap.Duration("expiresIn", expiresIn),
	)

	return req.URL, nil
}

// ListObjects lists all objects in the bucket with the given prefix.
// Returns a list of object keys (paths).
func (s *OSSService) ListObjects(prefix string) ([]string, error) {
	if s == nil || s.client == nil {
		return nil, fmt.Errorf("OSS service not configured")
	}

	ctx := context.Background()
	var allObjects []string
	var continuationToken *string

	for {
		input := &s3.ListObjectsV2Input{
			Bucket: aws.String(s.appConfig.OSSBucket),
			Prefix: aws.String(prefix),
		}
		if continuationToken != nil {
			input.ContinuationToken = continuationToken
		}

		output, err := s.client.ListObjectsV2(ctx, input)
		if err != nil {
			s.logger.Error("Failed to list objects from OSS",
				zap.String("prefix", prefix),
				zap.Error(err),
			)
			return nil, fmt.Errorf("failed to list objects from OSS: %w", err)
		}

		// Add object keys to result
		for _, object := range output.Contents {
			allObjects = append(allObjects, *object.Key)
		}

		// Check if there are more objects
		if !aws.ToBool(output.IsTruncated) {
			break
		}
		continuationToken = output.NextContinuationToken
	}

	s.logger.Debug("Listed objects from OSS",
		zap.String("prefix", prefix),
		zap.Int("count", len(allObjects)),
	)

	return allObjects, nil
}

// DeleteObject deletes a single object from the bucket.
func (s *OSSService) DeleteObject(bucketPath string) error {
	if s == nil || s.client == nil {
		return fmt.Errorf("OSS service not configured")
	}

	ctx := context.Background()

	_, err := s.client.DeleteObject(ctx, &s3.DeleteObjectInput{
		Bucket: aws.String(s.appConfig.OSSBucket),
		Key:    aws.String(bucketPath),
	})
	if err != nil {
		s.logger.Error("Failed to delete object from OSS",
			zap.String("path", bucketPath),
			zap.Error(err),
		)
		return fmt.Errorf("failed to delete object from OSS: %w", err)
	}

	s.logger.Debug("Object deleted from OSS",
		zap.String("path", bucketPath),
	)

	return nil
}

// ObjectExists checks if an object exists in the bucket.
func (s *OSSService) ObjectExists(bucketPath string) (bool, error) {
	if s == nil || s.client == nil {
		return false, fmt.Errorf("OSS service not configured")
	}

	ctx := context.Background()

	// Try to get object metadata
	_, err := s.client.HeadObject(ctx, &s3.HeadObjectInput{
		Bucket: aws.String(s.appConfig.OSSBucket),
		Key:    aws.String(bucketPath),
	})
	if err != nil {
		// Check if it's a "not found" error
		var notFoundErr *types.NotFound
		if errors.As(err, &notFoundErr) {
			return false, nil
		}
		// For HeadObject, check if error message indicates not found
		if err.Error() == "NotFound" {
			return false, nil
		}
		return false, fmt.Errorf("failed to check object existence: %w", err)
	}

	return true, nil
}

// DownloadFile downloads a file from OSS and returns its content.
func (s *OSSService) DownloadFile(bucketPath string) ([]byte, error) {
	if s == nil || s.client == nil {
		return nil, fmt.Errorf("OSS service not configured")
	}

	ctx := context.Background()

	output, err := s.client.GetObject(ctx, &s3.GetObjectInput{
		Bucket: aws.String(s.appConfig.OSSBucket),
		Key:    aws.String(bucketPath),
	})
	if err != nil {
		s.logger.Error("Failed to download file from OSS",
			zap.String("path", bucketPath),
			zap.Error(err),
		)
		return nil, fmt.Errorf("failed to download file from OSS: %w", err)
	}
	defer output.Body.Close()

	// Read all content
	buf, err := io.ReadAll(output.Body)
	if err != nil {
		s.logger.Error("Failed to read file content from OSS",
			zap.String("path", bucketPath),
			zap.Error(err),
		)
		return nil, fmt.Errorf("failed to read file content from OSS: %w", err)
	}

	s.logger.Debug("File downloaded from OSS",
		zap.String("path", bucketPath),
		zap.Int("size", len(buf)),
	)

	return buf, nil
}

// IsConfigured returns true if OSS is properly configured.
func (s *OSSService) IsConfigured() bool {
	return s != nil && s.client != nil
}

// buildURL constructs a public URL for the given bucket path.
func (s *OSSService) buildURL(bucketPath string) string {
	// Format: https://bucket-name.endpoint/path
	return fmt.Sprintf("https://%s.%s/%s", s.appConfig.OSSBucket, s.endpoint, bucketPath)
}
