import { useState, useCallback } from 'react';
import { CyberCard } from '../CyberCard';
import { CyberButton } from '../CyberButton';

// File tree item type
interface FileTreeItem {
  name: string;
  path: string;
  type: 'file' | 'folder';
  children?: FileTreeItem[];
}

// File content type
interface FileContent {
  path: string;
  content: string;
}

interface FileEditorProps {
  workspaceId: string;
}

// Default file structure for .picoclaw directory
const DEFAULT_FILE_STRUCTURE: FileTreeItem[] = [
  {
    name: '.picoclaw',
    path: '.picoclaw',
    type: 'folder',
    children: [
      { name: 'config.json', path: '.picoclaw/config.json', type: 'file' },
      { name: '.security.yml', path: '.picoclaw/.security.yml', type: 'file' },
      {
        name: 'workspace',
        path: '.picoclaw/workspace',
        type: 'folder',
        children: [
          { name: 'README.md', path: '.picoclaw/workspace/README.md', type: 'file' },
          { name: 'notes.md', path: '.picoclaw/workspace/notes.md', type: 'file' },
        ],
      },
    ],
  },
];

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

function JsonIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
      />
    </svg>
  );
}

function MarkdownIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M6 12h12M6 12l4-4m-4 4l4 4"
      />
    </svg>
  );
}

function YamlIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M4 6h16M4 12h16M4 18h7"
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

// Get file icon based on extension
function getFileIcon(filename: string, className?: string) {
  if (filename.endsWith('.json')) return <JsonIcon className={className} />;
  if (filename.endsWith('.md')) return <MarkdownIcon className={className} />;
  if (filename.endsWith('.yml') || filename.endsWith('.yaml')) return <YamlIcon className={className} />;
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
            ${level > 0 ? 'pl-' + (3 + level * 4) : ''}
          `}
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
        ${level > 0 ? 'pl-' + (3 + level * 4) : ''}
      `}
      style={{ paddingLeft: `${12 + level * 16}px` }}
    >
      <span className="w-4" />
      {getFileIcon(item.name, isSelected ? 'w-4 h-4 text-cyber-cyan' : 'w-4 h-4 text-cyber-muted')}
      <span className="text-sm">{item.name}</span>
    </button>
  );
}

// API Base URL
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:13207';

/** Get stored user info from localStorage */
function getStoredUser(): { role: string; id: string; orgId?: string } | null {
  try {
    const stored = localStorage.getItem('nexus_org');
    if (!stored) return null;
    return JSON.parse(stored);
  } catch {
    return null;
  }
}

/** Common headers including auth */
function getAuthHeaders(existing?: HeadersInit): HeadersInit {
  const user = getStoredUser();
  const headers: Record<string, string> = { ...(existing as Record<string, string>) };
  if (user) {
    headers['X-User-Role'] = user.role;
    headers['X-User-Id'] = user.id;
    if (user.orgId) headers['X-User-OrgId'] = user.orgId;
  }
  return headers;
}

export function FileEditor({ workspaceId }: FileEditorProps) {
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(['.picoclaw', '.picoclaw/workspace']));
  const [content, setContent] = useState<string>('');
  const [originalContent, setOriginalContent] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Load file content when selected
  const loadFileContent = useCallback(async (path: string) => {
    setLoading(true);
    setError(null);
    setJsonError(null);
    setSaveSuccess(false);

    try {
      const response = await fetch(`${API_BASE_URL}/api/picoclaw/${workspaceId}/files?path=${encodeURIComponent(path)}`, {
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error(`Failed to load file (${response.status})`);
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.message || 'Failed to load file');
      }

      const fileData: FileContent = result.data;
      setContent(fileData.content);
      setOriginalContent(fileData.content);

      // Validate JSON if it's a config.json file
      if (path.endsWith('config.json')) {
        validateJson(fileData.content);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setContent('');
      setOriginalContent('');
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  // Validate JSON content
  const validateJson = (text: string): boolean => {
    if (!selectedPath?.endsWith('config.json')) {
      setJsonError(null);
      return true;
    }

    if (!text.trim()) {
      setJsonError(null);
      return true;
    }

    try {
      JSON.parse(text);
      setJsonError(null);
      return true;
    } catch (e) {
      setJsonError(e instanceof Error ? e.message : 'Invalid JSON');
      return false;
    }
  };

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

    if (selectedPath?.endsWith('config.json')) {
      validateJson(newContent);
    }
  };

  // Handle save
  const handleSave = async () => {
    if (!selectedPath) return;

    // Validate JSON before saving if it's config.json
    if (selectedPath.endsWith('config.json')) {
      if (!validateJson(content)) {
        return;
      }
    }

    setSaving(true);
    setError(null);
    setSaveSuccess(false);

    try {
      const response = await fetch(`${API_BASE_URL}/api/picoclaw/${workspaceId}/files`, {
        method: 'PUT',
        headers: getAuthHeaders({
          'Content-Type': 'application/json',
        }),
        body: JSON.stringify({
          path: selectedPath,
          content,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to save file (${response.status})`);
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.message || 'Failed to save file');
      }

      setOriginalContent(content);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setSaving(false);
    }
  };

  // Check if content has unsaved changes
  const hasUnsavedChanges = content !== originalContent;

  // Get filename from path
  const filename = selectedPath ? selectedPath.split('/').pop() : '';

  return (
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
            {DEFAULT_FILE_STRUCTURE.map((item) => (
              <FileTreeNode
                key={item.path}
                item={item}
                selectedPath={selectedPath}
                expandedFolders={expandedFolders}
                onToggleFolder={handleToggleFolder}
                onSelectFile={handleSelectFile}
              />
            ))}
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
                    {getFileIcon(filename || '', 'w-4 h-4 text-cyber-cyan flex-shrink-0')}
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
                  disabled={loading || saving}
                  className={`
                    w-full h-full p-4 bg-cyber-dark-lighter/50
                    font-mono text-sm text-cyber-white
                    resize-none outline-none
                    disabled:opacity-50
                    scrollbar-thin scrollbar-thumb-cyber-cyan/30 scrollbar-track-cyber-dark
                  `}
                  placeholder="文件内容..."
                  spellCheck={false}
                />
                {loading && (
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
                {jsonError && (
                  <span className="text-xs text-cyber-error flex items-center gap-1">
                    <ExclamationIcon className="w-3 h-3" />
                    JSON 错误: {jsonError}
                  </span>
                )}
                {error && (
                  <span className="text-xs text-cyber-error flex items-center gap-1">
                    <ExclamationIcon className="w-3 h-3" />
                    {error}
                  </span>
                )}
              </div>
              <CyberButton
                variant="primary"
                size="sm"
                onClick={handleSave}
                disabled={!selectedPath || saving || !hasUnsavedChanges || !!jsonError}
                icon={<SaveIcon className="w-4 h-4" />}
              >
                {saving ? '保存中...' : '保存'}
              </CyberButton>
            </div>
          </div>
        </div>
      </CyberCard>
    </div>
  );
}

export default FileEditor;
