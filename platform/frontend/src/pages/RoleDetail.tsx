import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { CyberCard } from '../components/CyberCard';
import { CyberButton } from '../components/CyberButton';
import { useApi, apiRequest } from '../hooks/useApi';
import type { Role } from '../types';

// File tree item type
interface FileTreeItem {
  name: string;
  path: string;
  type: 'file' | 'folder';
  children?: FileTreeItem[];
}

// Icons
function FolderIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
      />
    </svg>
  );
}

function FileIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
      />
    </svg>
  );
}

function SaveIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"
      />
    </svg>
  );
}

function ChevronRightIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
  );
}

function ChevronDownIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  );
}

function CheckIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  );
}

function ExclamationIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );
}

function ArrowLeftIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
    </svg>
  );
}

function BugIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 2a2 2 0 100 4 2 2 0 000-4z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 12v.01" />
    </svg>
  );
}

function EyeIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
    </svg>
  );
}

function EyeOffIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
    </svg>
  );
}

// Get file icon
function getFileIcon(_filename: string, className?: string) {
  return <FileIcon className={className} />;
}

// Recursive file tree component
interface FileTreeNodeProps {
  item: FileTreeItem;
  selectedPath: string | null;
  expandedFolders: Set<string>;
  onToggleFolder: (path: string) => void;
  onSelectFile: (path: string) => void;
  level?: number;
}

function FileTreeNode({
  item,
  selectedPath,
  expandedFolders,
  onToggleFolder,
  onSelectFile,
  level = 0,
}: FileTreeNodeProps) {
  const isExpanded = expandedFolders.has(item.path);
  const isSelected = selectedPath === item.path;

  if (item.type === 'folder') {
    return (
      <div>
        <button
          onClick={() => onToggleFolder(item.path)}
          className={`
            w-full flex items-center gap-2 px-3 py-2 text-left
            transition-colors duration-200
            hover:bg-cyber-cyan/5
          `}
          style={{ paddingLeft: `${12 + level * 16}px` }}
        >
          <span className="text-cyber-muted">
            {isExpanded ? (
              <ChevronDownIcon className="w-4 h-4" />
            ) : (
              <ChevronRightIcon className="w-4 h-4" />
            )}
          </span>
          <FolderIcon className="w-4 h-4 text-cyber-warning" />
          <span className="text-cyber-white text-sm">{item.name}</span>
        </button>
        {isExpanded && item.children && (
          <div>
            {item.children.map((child) => (
              <FileTreeNode
                key={child.path}
                item={child}
                selectedPath={selectedPath}
                expandedFolders={expandedFolders}
                onToggleFolder={onToggleFolder}
                onSelectFile={onSelectFile}
                level={level + 1}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <button
      onClick={() => onSelectFile(item.path)}
      className={`
        w-full flex items-center gap-2 px-3 py-2 text-left
        transition-colors duration-200
        ${isSelected ? 'bg-cyber-cyan/10 text-cyber-cyan' : 'text-cyber-white hover:bg-cyber-cyan/5'}
      `}
      style={{ paddingLeft: `${12 + level * 16}px` }}
    >
      <span className="w-4" />
      {getFileIcon(item.name, isSelected ? 'w-4 h-4 text-cyber-cyan' : 'w-4 h-4 text-cyber-muted')}
      <span className="text-sm">{item.name}</span>
    </button>
  );
}

export function RoleDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  // Role data
  const { data: role, loading: roleLoading, error: roleError, refetch: refetchRole } = useApi<Role>(`/api/roles/${id}`);
  
  // File editor state
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [fileTree, setFileTree] = useState<FileTreeItem[]>([]);
  const [content, setContent] = useState<string>('');
  const [originalContent, setOriginalContent] = useState<string>('');
  const [fileLoading, setFileLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isTogglingPublic, setIsTogglingPublic] = useState(false);

  // Check if current user is owner
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  
  useEffect(() => {
    try {
      const stored = localStorage.getItem('nexus_user');
      if (stored) {
        const user = JSON.parse(stored);
        setCurrentUserId(user.id);
      }
    } catch {
      setCurrentUserId(null);
    }
  }, []);

  const isOwner = role && currentUserId && role.userId === currentUserId;

  // Load file list
  const loadFileList = useCallback(async () => {
    if (!id) return;
    
    try {
      const response = await apiRequest<FileTreeItem[]>(`/api/roles/${id}/files`);
      if (response.success && response.data) {
        setFileTree(response.data);
        // Auto-expand root folders
        const rootFolders = new Set<string>();
        response.data.forEach(item => {
          if (item.type === 'folder') {
            rootFolders.add(item.path);
          }
        });
        setExpandedFolders(prev => new Set([...prev, ...rootFolders]));
      }
    } catch (err) {
      console.error('Failed to load file list:', err);
    }
  }, [id]);

  useEffect(() => {
    loadFileList();
  }, [loadFileList]);

  // Load file content when selected
  const loadFileContent = useCallback(async (path: string) => {
    if (!id) return;
    
    setFileLoading(true);
    setFileError(null);
    setSaveSuccess(false);

    try {
      const response = await apiRequest<{ path: string; content: string }>(
        `/api/roles/${id}/files/${encodeURIComponent(path)}`
      );

      if (!response.success || !response.data) {
        throw new Error(response.message || 'Failed to load file');
      }

      const fileData = response.data;
      setContent(fileData.content);
      setOriginalContent(fileData.content);
    } catch (err) {
      setFileError(err instanceof Error ? err.message : 'Unknown error');
      setContent('');
      setOriginalContent('');
    } finally {
      setFileLoading(false);
    }
  }, [id]);

  // Handle file selection
  const handleSelectFile = (path: string) => {
    setSelectedPath(path);
    loadFileContent(path);
  };

  // Handle folder toggle
  const handleToggleFolder = (path: string) => {
    setExpandedFolders((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(path)) {
        newSet.delete(path);
      } else {
        newSet.add(path);
      }
      return newSet;
    });
  };

  // Handle content change
  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newContent = e.target.value;
    setContent(newContent);
    setSaveSuccess(false);
  };

  // Handle save
  const handleSave = async () => {
    if (!id || !selectedPath) return;
    if (!isOwner) return;

    setSaving(true);
    setFileError(null);
    setSaveSuccess(false);

    try {
      const response = await apiRequest(`/api/roles/${id}/files/${encodeURIComponent(selectedPath)}`, {
        method: 'PUT',
        body: JSON.stringify({ content }),
      });

      if (!response.success) {
        throw new Error(response.message || 'Failed to save file');
      }

      setOriginalContent(content);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (err) {
      setFileError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setSaving(false);
    }
  };

  // Handle toggle public
  const handleTogglePublic = async () => {
    if (!id || !role || !isOwner) return;

    setIsTogglingPublic(true);
    try {
      const response = await apiRequest<Role>(`/api/roles/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ isPublic: role.isPublic === 'true' ? 'false' : 'true' }),
      });

      if (response.success) {
        refetchRole();
      } else {
        throw new Error(response.message || 'Failed to update visibility');
      }
    } catch (err) {
      console.error('Failed to toggle public:', err);
    } finally {
      setIsTogglingPublic(false);
    }
  };

  // Navigate to debug page
  const handleNavigateToDebug = () => {
    if (id) {
      navigate(`/roles/${id}/debug`);
    }
  };

  // Check if content has unsaved changes
  const hasUnsavedChanges = content !== originalContent;

  // Loading state
  if (roleLoading) {
    return (
      <div className="page-transition space-y-6">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-lg bg-cyber-dark-lighter skeleton w-12 h-12" />
          <div className="flex-1">
            <div className="skeleton h-8 w-48 mb-2" />
            <div className="skeleton h-4 w-32" />
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 h-[600px]">
          <div className="skeleton h-full rounded-lg" />
          <div className="lg:col-span-3 skeleton h-full rounded-lg" />
        </div>
      </div>
    );
  }

  // Error state
  if (roleError || !role) {
    return (
      <div className="page-transition space-y-6">
        <CyberCard>
          <div className="p-8 text-center text-cyber-error">
            <p className="text-lg mb-2">加载角色失败</p>
            <p className="text-sm text-cyber-muted">{roleError || '角色不存在'}</p>
            <CyberButton
              variant="ghost"
              onClick={() => navigate('/roles')}
              className="mt-4"
              icon={<ArrowLeftIcon className="w-4 h-4" />}
            >
              返回角色列表
            </CyberButton>
          </div>
        </CyberCard>
      </div>
    );
  }

  return (
    <div className="page-transition space-y-6">
      {/* Top Bar */}
      <CyberCard cornerAccent>
        <div className="p-6">
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
            {/* Left: Role Info */}
            <div className="flex items-start gap-4">
              <button
                onClick={() => navigate('/roles')}
                className="p-2 rounded-lg bg-cyber-dark-lighter text-cyber-muted hover:text-cyber-cyan hover:bg-cyber-cyan/10 transition-colors"
              >
                <ArrowLeftIcon className="w-5 h-5" />
              </button>
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <h1 className="text-2xl font-display font-bold text-cyber-white">
                    {role.name}
                  </h1>
                  {role.isPublic === 'true' ? (
                    <span className="px-2 py-0.5 rounded text-xs bg-cyber-success/10 text-cyber-success border border-cyber-success/30">
                      公开
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded text-xs bg-cyber-muted/10 text-cyber-muted border border-cyber-muted/30">
                      私有
                    </span>
                  )}
                </div>
                {role.description && (
                  <p className="text-cyber-muted text-sm mb-2">{role.description}</p>
                )}
                <div className="flex items-center gap-4 text-xs text-cyber-muted">
                  <span className="font-mono">ID: {role.id}</span>
                  <span>变体: <span className="text-cyber-cyan">{role.variant}</span></span>
                  <span>状态: <span className="text-cyber-cyan">{role.status}</span></span>
                </div>
              </div>
            </div>

            {/* Right: Actions */}
            <div className="flex items-center gap-2">
              {isOwner && (
                <CyberButton
                  variant="ghost"
                  size="sm"
                  onClick={handleTogglePublic}
                  disabled={isTogglingPublic}
                  icon={role.isPublic === 'true' ? <EyeOffIcon className="w-4 h-4" /> : <EyeIcon className="w-4 h-4" />}
                >
                  {role.isPublic === 'true' ? '设为私有' : '设为公开'}
                </CyberButton>
              )}
              <CyberButton
                variant="secondary"
                size="sm"
                onClick={handleNavigateToDebug}
                icon={<BugIcon className="w-4 h-4" />}
              >
                调试
              </CyberButton>
            </div>
          </div>
        </div>
      </CyberCard>

      {/* File Editor */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 h-[600px]">
        {/* File Tree */}
        <CyberCard className="lg:col-span-1 h-full" cornerAccent>
          <div className="h-full flex flex-col">
            <div className="px-4 py-3 border-b border-cyber-cyan/20">
              <h3 className="font-display font-semibold text-cyber-white flex items-center gap-2">
                <FolderIcon className="w-5 h-5 text-cyber-cyan" />
                文件树
              </h3>
            </div>
            <div className="flex-1 overflow-y-auto py-2">
              {fileTree.length === 0 ? (
                <div className="px-4 py-8 text-center text-cyber-muted text-sm">
                  暂无文件
                </div>
              ) : (
                fileTree.map((item) => (
                  <FileTreeNode
                    key={item.path}
                    item={item}
                    selectedPath={selectedPath}
                    expandedFolders={expandedFolders}
                    onToggleFolder={handleToggleFolder}
                    onSelectFile={handleSelectFile}
                  />
                ))
              )}
            </div>
          </div>
        </CyberCard>

        {/* Editor */}
        <CyberCard className="lg:col-span-3 h-full" cornerAccent>
          <div className="h-full flex flex-col">
            {/* Path Bar */}
            <div className="px-4 py-3 border-b border-cyber-cyan/20 flex items-center justify-between">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <span className="text-cyber-muted text-sm">Path:</span>
                <div className="flex items-center gap-2 bg-cyber-dark-lighter rounded px-3 py-1.5 flex-1 min-w-0">
                  {selectedPath ? (
                    <>
                      {getFileIcon(selectedPath.split('/').pop() || '', 'w-4 h-4 text-cyber-cyan flex-shrink-0')}
                      <span className="font-mono text-sm text-cyber-cyan truncate">{selectedPath}</span>
                    </>
                  ) : (
                    <span className="text-cyber-muted text-sm italic">选择一个文件...</span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3 ml-4">
                {hasUnsavedChanges && (
                  <span className="text-xs text-cyber-warning flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-cyber-warning animate-pulse" />
                    未保存
                  </span>
                )}
                {saveSuccess && (
                  <span className="text-xs text-cyber-success flex items-center gap-1">
                    <CheckIcon className="w-3 h-3" />
                    已保存
                  </span>
                )}
              </div>
            </div>

            {/* Editor Area */}
            <div className="flex-1 relative">
              {selectedPath ? (
                <>
                  <textarea
                    value={content}
                    onChange={handleContentChange}
                    disabled={fileLoading || saving || !isOwner}
                    className={`
                      w-full h-full p-4 bg-cyber-dark-lighter/50
                      font-mono text-sm text-cyber-white
                      resize-none outline-none
                      disabled:opacity-50
                      scrollbar-thin scrollbar-thumb-cyber-cyan/30 scrollbar-track-cyber-dark
                    `}
                    placeholder={isOwner ? "文件内容..." : "只有所有者可以编辑"}
                    spellCheck={false}
                  />
                  {fileLoading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-cyber-dark/50">
                      <div className="text-cyber-cyan flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-cyber-cyan animate-pulse" />
                        加载中...
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="w-full h-full flex items-center justify-center text-cyber-muted">
                  <div className="text-center">
                    <FileIcon className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p>从左侧选择一个文件进行编辑</p>
                  </div>
                </div>
              )}
            </div>

            {/* Status Bar */}
            <div className="px-4 py-2 border-t border-cyber-cyan/20 bg-cyber-dark-lighter/30">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  {selectedPath && (
                    <>
                      <span className="text-xs text-cyber-muted">
                        {content.length} 字符
                      </span>
                      <span className="text-xs text-cyber-muted">
                        {content.split('\n').length} 行
                      </span>
                    </>
                  )}
                  {fileError && (
                    <span className="text-xs text-cyber-error flex items-center gap-1">
                      <ExclamationIcon className="w-3 h-3" />
                      {fileError}
                    </span>
                  )}
                  {!isOwner && role && (
                    <span className="text-xs text-cyber-warning flex items-center gap-1">
                      <ExclamationIcon className="w-3 h-3" />
                      只读模式（非所有者）
                    </span>
                  )}
                </div>
                <CyberButton
                  variant="primary"
                  size="sm"
                  onClick={handleSave}
                  disabled={!selectedPath || saving || !hasUnsavedChanges || !isOwner}
                  icon={<SaveIcon className="w-4 h-4" />}
                >
                  {saving ? '保存中...' : '保存'}
                </CyberButton>
              </div>
            </div>
          </div>
        </CyberCard>
      </div>
    </div>
  );
}

export default RoleDetail;
