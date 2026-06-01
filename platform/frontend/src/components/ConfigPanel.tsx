import { useState, useEffect, useCallback } from 'react';
import { CyberButton } from './CyberButton';
import { apiRequest } from '../hooks/useApi';
import type {
  PicoclawConfig,
  PicoclawSecurity,
  PicoclawModelConfig,
  PicoclawChannelConfig,
  PicoclawAgentDefaults,
  RoleFile,
  Skill,
  Mcp,
} from '../types';

// Model presets for quick-add
const MODEL_PRESETS = [
  {
    model_name: 'kimi-k2.5',
    provider: 'openai',
    model: 'kimi-k2.5',
    api_base: 'https://api.lkeap.cloud.tencent.com/coding/v3',
  },
  {
    model_name: 'glm-5',
    provider: 'openai',
    model: 'glm-5',
    api_base: 'https://api.lkeap.cloud.tencent.com/coding/v3',
  },
  {
    model_name: 'gpt-4o',
    provider: 'openai',
    model: 'gpt-4o',
    api_base: 'https://api.openai.com/v1',
  },
  {
    model_name: 'claude-sonnet-4',
    provider: 'anthropic-messages',
    model: 'claude-sonnet-4-20250514',
    api_base: 'https://api.anthropic.com/v1',
  },
];

// Channel presets for quick-add
const CHANNEL_PRESETS: Array<{
  name: string;
  type: string;
  enabled: boolean;
  settings: Record<string, unknown>;
}> = [
  {
    name: 'pico',
    type: 'pico',
    enabled: true,
    settings: { ping_interval: 30, read_timeout: 60, max_connections: 100 },
  },
  { name: 'telegram', type: 'telegram', enabled: false, settings: { token: '' } },
  { name: 'discord', type: 'discord', enabled: false, settings: { token: '' } },
  {
    name: 'feishu',
    type: 'feishu',
    enabled: false,
    settings: { app_id: '', app_secret: '', encrypt_key: '', verification_token: '' },
  },
  { name: 'slack', type: 'slack', enabled: false, settings: { bot_token: '', app_token: '' } },
];

// Icons
function CogIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
      />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

function RobotIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
      />
    </svg>
  );
}

function BroadcastIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0"
      />
    </svg>
  );
}

function TrashIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
      />
    </svg>
  );
}

function PencilIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
      />
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

function PlusIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
    </svg>
  );
}

function WrenchIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
      />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

function ServerIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
    </svg>
  );
}

interface ConfigPanelProps {
  entityId: string;
  isContainerMode: boolean;
  isOwner: boolean;
}

export function ConfigPanel({ entityId, isContainerMode, isOwner }: ConfigPanelProps) {
  // Tab state
  const [activeTab, setActiveTab] = useState<'agent' | 'channel' | 'skills' | 'mcp'>('agent');

  // Config state
  const [config, setConfig] = useState<PicoclawConfig | null>(null);
  const [security, setSecurity] = useState<PicoclawSecurity | null>(null);

  // Loading and error states
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Installed skills state (for container mode, read from filesystem)
  const [installedSkills, setInstalledSkills] = useState<string[]>([]);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');

  // Model editing state
  const [editingModel, setEditingModel] = useState<PicoclawModelConfig | null>(null);
  const [editingModelIndex, setEditingModelIndex] = useState<number | null>(null);
  const [showModelForm, setShowModelForm] = useState(false);
  const [modelFormData, setModelFormData] = useState<{
    model_name: string;
    provider: string;
    model: string;
    api_base: string;
    api_key: string;
  }>({ model_name: '', provider: '', model: '', api_base: '', api_key: '' });

  // Channel editing state
  const [editingChannelKey, setEditingChannelKey] = useState<string | null>(null);
  const [showChannelForm, setShowChannelForm] = useState(false);
  const [channelFormData, setChannelFormData] = useState<{
    name: string;
    type: string;
    enabled: boolean;
    token: string;
    settings: Record<string, unknown>;
  }>({ name: '', type: '', enabled: true, token: '', settings: {} });

  // Skills state
  const [availableSkills, setAvailableSkills] = useState<Skill[]>([]);
  const [skillsLoading, setSkillsLoading] = useState(false);

  // MCPs state
  const [availableMcps, setAvailableMcps] = useState<Mcp[]>([]);
  const [mcpsLoading, setMcpsLoading] = useState(false);

  // Load config files
  const loadConfigs = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Determine base endpoint based on mode
      const baseEndpoint = isContainerMode
        ? `/api/containers/${entityId}/files`
        : `/api/roles/${entityId}/files`;

      // Load config.json
      const configResponse = await apiRequest<RoleFile>(
        `${baseEndpoint}/${encodeURIComponent('config.json')}`
      );

      if (configResponse.success && configResponse.data) {
        try {
          const parsedConfig = JSON.parse(configResponse.data.content) as PicoclawConfig;
          setConfig(parsedConfig);
        } catch (e) {
          console.error('Failed to parse config.json:', e);
          setError('配置文件格式错误');
        }
      }

      // Load .security.yml
      const securityResponse = await apiRequest<RoleFile>(
        `${baseEndpoint}/${encodeURIComponent('.security.yml')}`
      );

      if (securityResponse.success && securityResponse.data) {
        const parsedSecurity = parseSecurityYaml(securityResponse.data.content);
        setSecurity(parsedSecurity);
      } else {
        // If security file doesn't exist, create empty structure
        setSecurity({});
      }
    } catch (err) {
      console.error('Failed to load configs:', err);
      setError(err instanceof Error ? err.message : '加载配置失败');
    } finally {
      setLoading(false);
    }
  }, [entityId]);

  useEffect(() => {
    loadConfigs();
  }, [loadConfigs]);

  // Load available skills
  const loadSkills = useCallback(async () => {
    setSkillsLoading(true);
    try {
      const response = await apiRequest<Skill[]>('/api/skills');
      if (response.success && response.data) {
        setAvailableSkills(response.data);
      }
    } catch (err) {
      console.error('Failed to load skills:', err);
    } finally {
      setSkillsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSkills();
  }, [loadSkills]);

  // Load available MCPs
  const loadMcps = useCallback(async () => {
    setMcpsLoading(true);
    try {
      const response = await apiRequest<Mcp[]>('/api/mcps');
      if (response.success && response.data) {
        setAvailableMcps(response.data);
      }
    } catch (err) {
      console.error('Failed to load MCPs:', err);
    } finally {
      setMcpsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMcps();
  }, [loadMcps]);

  // Simple YAML parser for security file
  function parseSecurityYaml(content: string): PicoclawSecurity {
    const result: PicoclawSecurity = { channel_list: {}, model_list: {} };
    const lines = content.split('\n');
    let currentSection: 'channel_list' | 'model_list' | null = null;
    let currentKey: string | null = null;

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;

      // Detect section
      if (trimmed === 'channel_list:') {
        currentSection = 'channel_list';
        continue;
      }
      if (trimmed === 'model_list:') {
        currentSection = 'model_list';
        continue;
      }

      // Parse channel_list entries
      if (currentSection === 'channel_list') {
        const match = trimmed.match(/^(\w+):/);
        if (match) {
          currentKey = match[1];
          if (!result.channel_list) result.channel_list = {};
          result.channel_list[currentKey] = { settings: {} };
          continue;
        }

        // Parse settings under channel
        if (currentKey && trimmed.startsWith('settings:')) {
          continue;
        }

        if (currentKey && result.channel_list && result.channel_list[currentKey]) {
          const settingMatch = trimmed.match(/^(\w+):\s*(.+)$/);
          if (settingMatch) {
            const [, key, value] = settingMatch;
            if (!result.channel_list[currentKey].settings) {
              result.channel_list[currentKey].settings = {};
            }
            result.channel_list[currentKey].settings![key] = value;
          }
        }
      }

      // Parse model_list entries
      if (currentSection === 'model_list') {
        const match = trimmed.match(/^([^:]+):0:/);
        if (match) {
          currentKey = match[1] + ':0';
          if (!result.model_list) result.model_list = {};
          result.model_list[currentKey] = { api_keys: [] };
          continue;
        }

        // Parse api_keys
        if (currentKey && trimmed.startsWith('api_keys:')) {
          continue;
        }

        if (currentKey && result.model_list?.[currentKey]?.api_keys && trimmed.startsWith('- ')) {
          const key = trimmed.substring(2).trim();
          if (key) {
            result.model_list[currentKey].api_keys!.push(key);
          }
        }
      }
    }

    return result;
  }

  // Serialize security to YAML
  function serializeSecurityYaml(sec: PicoclawSecurity): string {
    const lines: string[] = [];

    if (sec.channel_list && Object.keys(sec.channel_list).length > 0) {
      lines.push('channel_list:');
      for (const [name, data] of Object.entries(sec.channel_list)) {
        lines.push(`  ${name}:`);
        if (data.settings && Object.keys(data.settings).length > 0) {
          lines.push('    settings:');
          for (const [key, value] of Object.entries(data.settings)) {
            lines.push(`      ${key}: ${value}`);
          }
        }
      }
    } else {
      // Always include channel_list section to avoid losing config
      lines.push('channel_list:');
      lines.push('  pico:');
      lines.push('    settings:');
      lines.push('      token: ""');
    }

    if (sec.model_list && Object.keys(sec.model_list).length > 0) {
      lines.push('model_list:');
      for (const [name, data] of Object.entries(sec.model_list)) {
        lines.push(`  ${name}:`);
        if (data.api_keys && data.api_keys.length > 0) {
          lines.push('    api_keys:');
          for (const key of data.api_keys) {
            lines.push(`      - ${key}`);
          }
        }
      }
    }

    return lines.join('\n');
  }

  // Handle saving configs
  const handleSave = async () => {
    if (!config || !isOwner) return;

    setSaveStatus('saving');

    // Determine base endpoint based on mode
    const baseEndpoint = isContainerMode
      ? `/api/containers/${entityId}/files`
      : `/api/roles/${entityId}/files`;

    try {
      // Save config.json
      const configResponse = await apiRequest(
        `${baseEndpoint}/${encodeURIComponent('config.json')}`,
        {
          method: 'PUT',
          body: JSON.stringify({ content: JSON.stringify(config, null, 2) }),
        }
      );

      if (!configResponse.success) {
        throw new Error(configResponse.message || '保存 config.json 失败');
      }

      // Save .security.yml
      const securityYaml = serializeSecurityYaml(security || {});
      const securityResponse = await apiRequest(
        `${baseEndpoint}/${encodeURIComponent('.security.yml')}`,
        {
          method: 'PUT',
          body: JSON.stringify({ content: securityYaml }),
        }
      );

      if (!securityResponse.success) {
        throw new Error(securityResponse.message || '保存 .security.yml 失败');
      }

      setSaveStatus('success');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (err) {
      console.error('Failed to save configs:', err);
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 3000);
    }
  };

  // Update agent defaults
  const updateAgentDefaults = (defaults: Partial<PicoclawAgentDefaults>) => {
    if (!config) return;
    setConfig({
      ...config,
      agents: {
        ...config.agents,
        defaults: { ...config.agents.defaults, ...defaults },
      },
    });
  };

  // Add model
  const handleAddModel = (presetIndex: number) => {
    const preset = MODEL_PRESETS[presetIndex];
    if (!preset || !config) return;

    setModelFormData({
      model_name: preset.model_name,
      provider: preset.provider,
      model: preset.model,
      api_base: preset.api_base,
      api_key: '',
    });
    setEditingModel(null);
    setEditingModelIndex(null);
    setShowModelForm(true);
  };

  // Edit model
  const handleEditModel = (index: number) => {
    if (!config) return;
    const model = config.model_list[index];
    if (!model) return;

    // Get API key from security
    const modelKey = `${model.model_name}:0`;
    const apiKeys = security?.model_list?.[modelKey]?.api_keys || [];

    setModelFormData({
      model_name: model.model_name,
      provider: model.provider,
      model: model.model,
      api_base: model.api_base || '',
      api_key: apiKeys[0] || '',
    });
    setEditingModel(model);
    setEditingModelIndex(index);
    setShowModelForm(true);
  };

  // Delete model
  const handleDeleteModel = (index: number) => {
    if (!config) return;
    const model = config.model_list[index];
    if (!model) return;

    const newModels = [...config.model_list];
    newModels.splice(index, 1);

    setConfig({ ...config, model_list: newModels });

    // Also remove from security
    if (security) {
      const modelKey = `${model.model_name}:0`;
      const newSecurity = { ...security };
      if (newSecurity.model_list) {
        delete newSecurity.model_list[modelKey];
      }
      setSecurity(newSecurity);
    }
  };

  // Save model form
  const handleSaveModel = () => {
    if (!config || !security) return;

    const newModel: PicoclawModelConfig = {
      model_name: modelFormData.model_name,
      provider: modelFormData.provider,
      model: modelFormData.model,
      api_base: modelFormData.api_base || undefined,
    };

    let newModels: PicoclawModelConfig[];
    if (editingModelIndex !== null) {
      newModels = [...config.model_list];
      newModels[editingModelIndex] = newModel;
    } else {
      newModels = [...config.model_list, newModel];
    }

    setConfig({ ...config, model_list: newModels });

    // Update security with API key
    const modelKey = `${newModel.model_name}:0`;
    const newSecurity = { ...security };
    if (!newSecurity.model_list) newSecurity.model_list = {};
    newSecurity.model_list[modelKey] = {
      api_keys: modelFormData.api_key ? [modelFormData.api_key] : [],
    };
    setSecurity(newSecurity);

    setShowModelForm(false);
    setEditingModel(null);
    setEditingModelIndex(null);
  };

  // Add channel
  const handleAddChannel = (presetIndex: number) => {
    const preset = CHANNEL_PRESETS[presetIndex];
    if (!preset || !config) return;

    setChannelFormData({
      name: preset.name,
      type: preset.type,
      enabled: preset.enabled,
      token: '',
      settings: preset.settings,
    });
    setEditingChannelKey(null);
    setShowChannelForm(true);
  };

  // Edit channel
  const handleEditChannel = (key: string) => {
    if (!config || !config.channel_list[key]) return;
    const channel = config.channel_list[key];

    // Get token from security
    const token = security?.channel_list?.[key]?.settings?.token || '';

    setChannelFormData({
      name: key,
      type: channel.type,
      enabled: channel.enabled,
      token,
      settings: (channel.settings as Record<string, unknown>) || {},
    });
    setEditingChannelKey(key);
    setShowChannelForm(true);
  };

  // Delete channel
  const handleDeleteChannel = (key: string) => {
    if (!config) return;

    const newChannels = { ...config.channel_list };
    delete newChannels[key];

    setConfig({ ...config, channel_list: newChannels });

    // Also remove from security
    if (security) {
      const newSecurity = { ...security };
      if (newSecurity.channel_list) {
        delete newSecurity.channel_list[key];
      }
      setSecurity(newSecurity);
    }
  };

  // Toggle channel enabled
  const handleToggleChannel = (key: string) => {
    if (!config || !config.channel_list[key]) return;

    setConfig({
      ...config,
      channel_list: {
        ...config.channel_list,
        [key]: {
          ...config.channel_list[key],
          enabled: !config.channel_list[key].enabled,
        },
      },
    });
  };

  // Save channel form
  const handleSaveChannel = () => {
    if (!config || !security) return;

    const newChannel: PicoclawChannelConfig = {
      enabled: channelFormData.enabled,
      type: channelFormData.type,
      settings: { ...channelFormData.settings },
    };

    // If there's a token, add it to settings for pico/telegram/discord
    if (channelFormData.token) {
      (newChannel.settings as Record<string, unknown>).token = channelFormData.token;
    }

    const newChannels = { ...config.channel_list };

    // If editing and name changed, delete old entry
    if (editingChannelKey && editingChannelKey !== channelFormData.name) {
      delete newChannels[editingChannelKey];
    }

    newChannels[channelFormData.name] = newChannel;
    setConfig({ ...config, channel_list: newChannels });

    // Update security with token if provided
    if (channelFormData.token) {
      const newSecurity = { ...security };
      if (!newSecurity.channel_list) newSecurity.channel_list = {};
      newSecurity.channel_list[channelFormData.name] = {
        settings: { token: channelFormData.token },
      };
      setSecurity(newSecurity);
    }

    setShowChannelForm(false);
    setEditingChannelKey(null);
  };

  // Handle add skill to entity (role or container)
  const handleAddSkill = async (skillId: string) => {
    if (!config || !isOwner) return;
    try {
      const baseEndpoint = isContainerMode
        ? `/api/containers/${entityId}/skills/${skillId}`
        : `/api/roles/${entityId}/skills/${skillId}`;
      await apiRequest(baseEndpoint, { method: 'POST' });
      // Reload config to get updated state
      loadConfigs();
      // Refresh installed skills for container mode
      if (isContainerMode) {
        try {
          const result = await apiRequest<string[]>(`/api/containers/${entityId}/installed-skills`);
          if (result.data) setInstalledSkills(result.data);
        } catch {}
      }
    } catch (err) {
      console.error('Failed to add skill:', err);
    }
  };

  // Handle remove skill from entity (role or container)
  const handleRemoveSkill = async (skillId: string) => {
    if (!config || !isOwner) return;
    try {
      const baseEndpoint = isContainerMode
        ? `/api/containers/${entityId}/skills/${skillId}`
        : `/api/roles/${entityId}/skills/${skillId}`;
      await apiRequest(baseEndpoint, { method: 'DELETE' });
      // Reload config to get updated state
      loadConfigs();
      // Refresh installed skills for container mode
      if (isContainerMode) {
        try {
          const result = await apiRequest<string[]>(`/api/containers/${entityId}/installed-skills`);
          if (result.data) setInstalledSkills(result.data);
        } catch {}
      }
    } catch (err) {
      console.error('Failed to remove skill:', err);
    }
  };

  // Handle add MCP to entity (role or container)
  const handleAddMcp = async (mcpId: string) => {
    if (!config || !isOwner) return;
    try {
      const baseEndpoint = isContainerMode
        ? `/api/containers/${entityId}/mcps/${mcpId}`
        : `/api/roles/${entityId}/mcps/${mcpId}`;
      await apiRequest(baseEndpoint, { method: 'POST' });
      // Reload config to get updated state
      loadConfigs();
    } catch (err) {
      console.error('Failed to add MCP:', err);
    }
  };

  // Handle remove MCP from entity (role or container)
  const handleRemoveMcp = async (mcpId: string) => {
    if (!config || !isOwner) return;
    try {
      const baseEndpoint = isContainerMode
        ? `/api/containers/${entityId}/mcps/${mcpId}`
        : `/api/roles/${entityId}/mcps/${mcpId}`;
      await apiRequest(baseEndpoint, { method: 'DELETE' });
      // Reload config to get updated state
      loadConfigs();
    } catch (err) {
      console.error('Failed to remove MCP:', err);
    }
  };

  // Fetch installed skills for container mode (from filesystem, not config.json)
  useEffect(() => {
    if (!isContainerMode || !entityId) return;
    const fetchInstalledSkills = async () => {
      try {
        const result = await apiRequest<string[]>(`/api/containers/${entityId}/installed-skills`);
        if (result.data) {
          setInstalledSkills(result.data);
        }
      } catch (err) {
        console.error('Failed to fetch installed skills:', err);
      }
    };
    fetchInstalledSkills();
  }, [isContainerMode, entityId]);

  // Get attached skills and MCPs
  const attachedSkills = isContainerMode
    ? installedSkills
    : (config?.agents?.defaults?.skills || []);
  const attachedMcps = config?.agents?.defaults?.mcp_servers || [];

  if (loading) {
    return (
      <div className="h-[600px] flex items-center justify-center">
        <div className="text-cyber-cyan flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-cyber-cyan animate-pulse" />
          加载配置中...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-[600px] flex items-center justify-center">
        <div className="text-cyber-error flex items-center gap-2">
          <ExclamationIcon className="w-5 h-5" />
          {error}
        </div>
      </div>
    );
  }

  if (!config) {
    return (
      <div className="h-[600px] flex items-center justify-center text-cyber-muted">
        <CogIcon className="w-12 h-12 mx-auto mb-3 opacity-30" />
        <p>无法加载配置</p>
      </div>
    );
  }

  return (
    <div className="h-[600px] flex flex-col">
      {/* Header with tabs */}
      <div className="px-4 py-2 border-b border-cyber-cyan/20 flex items-center justify-between bg-cyber-dark-lighter/30">
        <div className="flex gap-2">
          <CyberButton
            variant={activeTab === 'agent' ? 'primary' : 'ghost'}
            size="sm"
            onClick={() => setActiveTab('agent')}
            icon={<RobotIcon className="w-4 h-4" />}
          >
            Agent 配置
          </CyberButton>
          <CyberButton
            variant={activeTab === 'channel' ? 'primary' : 'ghost'}
            size="sm"
            onClick={() => setActiveTab('channel')}
            icon={<BroadcastIcon className="w-4 h-4" />}
          >
            Channel 配置
          </CyberButton>
          <CyberButton
            variant={activeTab === 'skills' ? 'primary' : 'ghost'}
            size="sm"
            onClick={() => setActiveTab('skills')}
            icon={<WrenchIcon className="w-4 h-4" />}
          >
            Skills 配置
          </CyberButton>
          <CyberButton
            variant={activeTab === 'mcp' ? 'primary' : 'ghost'}
            size="sm"
            onClick={() => setActiveTab('mcp')}
            icon={<ServerIcon className="w-4 h-4" />}
          >
            MCP 配置
          </CyberButton>
        </div>

        <div className="flex items-center gap-2">
          {saveStatus === 'success' && (
            <span className="text-xs text-cyber-success flex items-center gap-1">
              <CheckIcon className="w-3 h-3" />
              已保存
            </span>
          )}
          {saveStatus === 'error' && (
            <span className="text-xs text-cyber-error flex items-center gap-1">
              <ExclamationIcon className="w-3 h-3" />
              保存失败
            </span>
          )}
          <CyberButton
            variant="primary"
            size="sm"
            onClick={handleSave}
            disabled={!isOwner || saveStatus === 'saving'}
            icon={<SaveIcon className="w-4 h-4" />}
          >
            {saveStatus === 'saving' ? '保存中...' : '保存配置'}
          </CyberButton>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {activeTab === 'agent' && (
          <>
            {/* Agent Defaults Section */}
            <div className="space-y-3">
              <h3 className="font-display font-semibold text-cyber-cyan flex items-center gap-2">
                <CogIcon className="w-4 h-4" />
                默认模型配置
              </h3>
              <div className="grid grid-cols-2 gap-4 p-4 bg-cyber-dark-lighter/30 rounded-lg border border-cyber-cyan/10">
                <div>
                  <label className="block text-xs text-cyber-muted mb-1">模型名称</label>
                  <select
                    value={config.agents.defaults.model_name}
                    onChange={(e) => updateAgentDefaults({ model_name: e.target.value })}
                    disabled={!isOwner}
                    className="w-full px-3 py-2 rounded-lg bg-cyber-dark border border-cyber-cyan/20 text-cyber-white text-sm focus:border-cyber-cyan focus:outline-none disabled:opacity-50"
                  >
                    <option value="">选择模型...</option>
                    {config.model_list.map((m) => (
                      <option key={m.model_name} value={m.model_name}>
                        {m.model_name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-cyber-muted mb-1">最大 Token</label>
                  <input
                    type="number"
                    value={config.agents.defaults.max_tokens}
                    onChange={(e) =>
                      updateAgentDefaults({ max_tokens: parseInt(e.target.value) || 0 })
                    }
                    disabled={!isOwner}
                    className="w-full px-3 py-2 rounded-lg bg-cyber-dark border border-cyber-cyan/20 text-cyber-white text-sm focus:border-cyber-cyan focus:outline-none disabled:opacity-50"
                  />
                </div>
                <div>
                  <label className="block text-xs text-cyber-muted mb-1">Temperature (0-2)</label>
                  <input
                    type="number"
                    min="0"
                    max="2"
                    step="0.1"
                    value={config.agents.defaults.temperature ?? 0.7}
                    onChange={(e) =>
                      updateAgentDefaults({ temperature: parseFloat(e.target.value) || 0 })
                    }
                    disabled={!isOwner}
                    className="w-full px-3 py-2 rounded-lg bg-cyber-dark border border-cyber-cyan/20 text-cyber-white text-sm focus:border-cyber-cyan focus:outline-none disabled:opacity-50"
                  />
                </div>
                <div>
                  <label className="block text-xs text-cyber-muted mb-1">最大工具迭代次数</label>
                  <input
                    type="number"
                    value={config.agents.defaults.max_tool_iterations ?? 50}
                    onChange={(e) =>
                      updateAgentDefaults({
                        max_tool_iterations: parseInt(e.target.value) || 0,
                      })
                    }
                    disabled={!isOwner}
                    className="w-full px-3 py-2 rounded-lg bg-cyber-dark border border-cyber-cyan/20 text-cyber-white text-sm focus:border-cyber-cyan focus:outline-none disabled:opacity-50"
                  />
                </div>
              </div>
            </div>

            {/* Model List Section */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-display font-semibold text-cyber-cyan flex items-center gap-2">
                  <RobotIcon className="w-4 h-4" />
                  模型列表
                </h3>
                <div className="flex gap-2">
                  <select
                    onChange={(e) => {
                      const idx = parseInt(e.target.value);
                      if (!isNaN(idx)) {
                        handleAddModel(idx);
                        e.target.value = '';
                      }
                    }}
                    disabled={!isOwner}
                    className="px-3 py-1.5 rounded-lg bg-cyber-dark border border-cyber-cyan/20 text-cyber-white text-sm focus:border-cyber-cyan focus:outline-none disabled:opacity-50"
                  >
                    <option value="">+ 添加模型...</option>
                    {MODEL_PRESETS.map((p, i) => (
                      <option key={i} value={i}>
                        {p.model_name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                {config.model_list.map((model, index) => (
                  <div
                    key={model.model_name}
                    className="p-3 bg-cyber-dark-lighter/30 rounded-lg border border-cyber-cyan/10 hover:border-cyber-cyan/30 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <RobotIcon className="w-4 h-4 text-cyber-cyan" />
                        <div>
                          <p className="font-medium text-cyber-white text-sm">{model.model_name}</p>
                          <p className="text-xs text-cyber-muted">
                            {model.provider}/{model.model}
                            {model.api_base && ` · ${model.api_base}`}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <CyberButton
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditModel(index)}
                          disabled={!isOwner}
                          icon={<PencilIcon className="w-3.5 h-3.5" />}
                        >
                          编辑
                        </CyberButton>
                        <CyberButton
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteModel(index)}
                          disabled={!isOwner}
                          icon={<TrashIcon className="w-3.5 h-3.5" />}
                          className="text-cyber-error hover:text-cyber-error"
                        >
                          删除
                        </CyberButton>
                      </div>
                    </div>
                  </div>
                ))}
                {config.model_list.length === 0 && (
                  <div className="text-center py-8 text-cyber-muted text-sm">
                    暂无模型配置，请从上方添加
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {activeTab === 'channel' && (
          <>
            {/* Channel List Section */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-display font-semibold text-cyber-cyan flex items-center gap-2">
                  <BroadcastIcon className="w-4 h-4" />
                  通道列表
                </h3>
                <div className="flex gap-2">
                  <select
                    onChange={(e) => {
                      const idx = parseInt(e.target.value);
                      if (!isNaN(idx)) {
                        handleAddChannel(idx);
                        e.target.value = '';
                      }
                    }}
                    disabled={!isOwner}
                    className="px-3 py-1.5 rounded-lg bg-cyber-dark border border-cyber-cyan/20 text-cyber-white text-sm focus:border-cyber-cyan focus:outline-none disabled:opacity-50"
                  >
                    <option value="">+ 添加通道...</option>
                    {CHANNEL_PRESETS.map((p, i) => (
                      <option key={i} value={i}>
                        {p.name} ({p.type})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                {Object.entries(config.channel_list).map(([key, channel]) => (
                  <div
                    key={key}
                    className="p-3 bg-cyber-dark-lighter/30 rounded-lg border border-cyber-cyan/10 hover:border-cyber-cyan/30 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <BroadcastIcon className="w-4 h-4 text-cyber-cyan" />
                        <div>
                          <p className="font-medium text-cyber-white text-sm">{key}</p>
                          <p className="text-xs text-cyber-muted">
                            Type: {channel.type} ·
                            <span
                              className={`ml-1 ${channel.enabled ? 'text-cyber-success' : 'text-cyber-muted'}`}
                            >
                              {channel.enabled ? '已启用' : '已禁用'}
                            </span>
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <span className="text-xs text-cyber-muted">启用</span>
                          <input
                            type="checkbox"
                            checked={channel.enabled}
                            onChange={() => handleToggleChannel(key)}
                            disabled={!isOwner}
                            className="w-4 h-4 rounded border-cyber-cyan/30 bg-cyber-dark checked:bg-cyber-cyan disabled:opacity-50 cursor-pointer"
                          />
                        </label>
                        <CyberButton
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditChannel(key)}
                          disabled={!isOwner}
                          icon={<PencilIcon className="w-3.5 h-3.5" />}
                        >
                          编辑
                        </CyberButton>
                        <CyberButton
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteChannel(key)}
                          disabled={!isOwner}
                          icon={<TrashIcon className="w-3.5 h-3.5" />}
                          className="text-cyber-error hover:text-cyber-error"
                        >
                          删除
                        </CyberButton>
                      </div>
                    </div>
                  </div>
                ))}
                {Object.keys(config.channel_list).length === 0 && (
                  <div className="text-center py-8 text-cyber-muted text-sm">
                    暂无通道配置，请从上方添加
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {activeTab === 'skills' && (
          <>
            {/* Attached Skills Section */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-display font-semibold text-cyber-cyan flex items-center gap-2">
                  <WrenchIcon className="w-4 h-4" />
                  已附加 Skills
                </h3>
                <span className="text-xs text-cyber-muted">{attachedSkills.length} 个技能</span>
              </div>

              <div className="space-y-2">
                {attachedSkills.length > 0 ? (
                  attachedSkills.map((skillSlugOrId) => {
                    const skill = availableSkills.find((s) => s.id === skillSlugOrId || s.slug === skillSlugOrId);
                    return (
                      <div
                        key={skillSlugOrId}
                        className="p-3 bg-cyber-dark-lighter/30 rounded-lg border border-cyber-cyan/10 hover:border-cyber-cyan/30 transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <WrenchIcon className="w-4 h-4 text-cyber-cyan" />
                            <div>
                              <p className="font-medium text-cyber-white text-sm">
                                {skill?.name || skillSlugOrId}
                              </p>
                              {skill?.description && (
                                <p className="text-xs text-cyber-muted line-clamp-1">
                                  {skill.description}
                                </p>
                              )}
                            </div>
                          </div>
                          <CyberButton
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveSkill(skill?.id || skillSlugOrId)}
                            disabled={!isOwner}
                            icon={<TrashIcon className="w-3.5 h-3.5" />}
                            className="text-cyber-error hover:text-cyber-error"
                          >
                            移除
                          </CyberButton>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-center py-8 text-cyber-muted text-sm">
                    暂无附加技能
                  </div>
                )}
              </div>
            </div>

            {/* Available Skills Section */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-display font-semibold text-cyber-cyan flex items-center gap-2">
                  <WrenchIcon className="w-4 h-4" />
                  可用 Skills
                </h3>
              </div>

              {skillsLoading ? (
                <div className="text-center py-8 text-cyber-muted">加载中...</div>
              ) : availableSkills.length === 0 ? (
                <div className="text-center py-8 text-cyber-muted text-sm">暂无可用技能</div>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {availableSkills
                    .filter((skill) => !attachedSkills.includes(skill.id) && !attachedSkills.includes(skill.slug))
                    .map((skill) => (
                      <div
                        key={skill.id}
                        className="p-3 bg-cyber-dark-lighter/30 rounded-lg border border-cyber-cyan/10 hover:border-cyber-cyan/30 transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <WrenchIcon className="w-4 h-4 text-cyber-cyan" />
                            <div>
                              <p className="font-medium text-cyber-white text-sm">{skill.name}</p>
                              <p className="text-xs text-cyber-muted line-clamp-1">{skill.description}</p>
                            </div>
                          </div>
                          <CyberButton
                            variant="ghost"
                            size="sm"
                            onClick={() => handleAddSkill(skill.id)}
                            disabled={!isOwner}
                            icon={<PlusIcon className="w-3.5 h-3.5" />}
                          >
                            添加
                          </CyberButton>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </>
        )}

        {activeTab === 'mcp' && (
          <>
            {/* Attached MCPs Section */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-display font-semibold text-cyber-cyan flex items-center gap-2">
                  <ServerIcon className="w-4 h-4" />
                  已附加 MCPs
                </h3>
                <span className="text-xs text-cyber-muted">{attachedMcps.length} 个 MCP</span>
              </div>

              <div className="space-y-2">
                {attachedMcps.length > 0 ? (
                  attachedMcps.map((mcpId) => {
                    const mcp = availableMcps.find((m) => m.id === mcpId);
                    return (
                      <div
                        key={mcpId}
                        className="p-3 bg-cyber-dark-lighter/30 rounded-lg border border-cyber-cyan/10 hover:border-cyber-cyan/30 transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <ServerIcon className="w-4 h-4 text-cyber-cyan" />
                            <div>
                              <p className="font-medium text-cyber-white text-sm">
                                {mcp?.name || mcpId}
                              </p>
                              {mcp?.description && (
                                <p className="text-xs text-cyber-muted line-clamp-1">
                                  {mcp.description}
                                </p>
                              )}
                            </div>
                          </div>
                          <CyberButton
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveMcp(mcpId)}
                            disabled={!isOwner}
                            icon={<TrashIcon className="w-3.5 h-3.5" />}
                            className="text-cyber-error hover:text-cyber-error"
                          >
                            移除
                          </CyberButton>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-center py-8 text-cyber-muted text-sm">
                    暂无附加 MCPs
                  </div>
                )}
              </div>
            </div>

            {/* Available MCPs Section */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-display font-semibold text-cyber-cyan flex items-center gap-2">
                  <ServerIcon className="w-4 h-4" />
                  可用 MCPs
                </h3>
              </div>

              {mcpsLoading ? (
                <div className="text-center py-8 text-cyber-muted">加载中...</div>
              ) : availableMcps.length === 0 ? (
                <div className="text-center py-8 text-cyber-muted text-sm">暂无可用 MCPs</div>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {availableMcps
                    .filter((mcp) => !attachedMcps.includes(mcp.id))
                    .map((mcp) => (
                      <div
                        key={mcp.id}
                        className="p-3 bg-cyber-dark-lighter/30 rounded-lg border border-cyber-cyan/10 hover:border-cyber-cyan/30 transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <ServerIcon className="w-4 h-4 text-cyber-cyan" />
                            <div>
                              <p className="font-medium text-cyber-white text-sm">{mcp.name}</p>
                              <p className="text-xs text-cyber-muted line-clamp-1">{mcp.description}</p>
                            </div>
                          </div>
                          <CyberButton
                            variant="ghost"
                            size="sm"
                            onClick={() => handleAddMcp(mcp.id)}
                            disabled={!isOwner}
                            icon={<PlusIcon className="w-3.5 h-3.5" />}
                          >
                            添加
                          </CyberButton>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </>
        )}

        {!isOwner && (
          <div className="p-3 rounded-lg bg-cyber-warning/10 border border-cyber-warning/30 text-cyber-warning text-sm flex items-center gap-2">
            <ExclamationIcon className="w-4 h-4" />
            只读模式（非所有者）
          </div>
        )}
      </div>

      {/* Model Form Modal */}
      {showModelForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-cyber-dark-card border border-cyber-cyan/20 rounded-lg p-6 w-full max-w-md">
            <h3 className="font-display font-semibold text-cyber-cyan mb-4">
              {editingModel ? '编辑模型' : '添加模型'}
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs text-cyber-muted mb-1">模型名称</label>
                <input
                  type="text"
                  value={modelFormData.model_name}
                  onChange={(e) =>
                    setModelFormData({ ...modelFormData, model_name: e.target.value })
                  }
                  disabled={editingModel !== null}
                  className="w-full px-3 py-2 rounded-lg bg-cyber-dark border border-cyber-cyan/20 text-cyber-white text-sm focus:border-cyber-cyan focus:outline-none disabled:opacity-50"
                />
              </div>
              <div>
                <label className="block text-xs text-cyber-muted mb-1">Provider</label>
                <input
                  type="text"
                  value={modelFormData.provider}
                  onChange={(e) =>
                    setModelFormData({ ...modelFormData, provider: e.target.value })
                  }
                  className="w-full px-3 py-2 rounded-lg bg-cyber-dark border border-cyber-cyan/20 text-cyber-white text-sm focus:border-cyber-cyan focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs text-cyber-muted mb-1">Model</label>
                <input
                  type="text"
                  value={modelFormData.model}
                  onChange={(e) => setModelFormData({ ...modelFormData, model: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-cyber-dark border border-cyber-cyan/20 text-cyber-white text-sm focus:border-cyber-cyan focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs text-cyber-muted mb-1">API Base</label>
                <input
                  type="text"
                  value={modelFormData.api_base}
                  onChange={(e) =>
                    setModelFormData({ ...modelFormData, api_base: e.target.value })
                  }
                  className="w-full px-3 py-2 rounded-lg bg-cyber-dark border border-cyber-cyan/20 text-cyber-white text-sm focus:border-cyber-cyan focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs text-cyber-muted mb-1">API Key</label>
                <input
                  type="password"
                  value={modelFormData.api_key}
                  onChange={(e) =>
                    setModelFormData({ ...modelFormData, api_key: e.target.value })
                  }
                  className="w-full px-3 py-2 rounded-lg bg-cyber-dark border border-cyber-cyan/20 text-cyber-white text-sm focus:border-cyber-cyan focus:outline-none"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <CyberButton variant="ghost" size="sm" onClick={() => setShowModelForm(false)}>
                取消
              </CyberButton>
              <CyberButton variant="primary" size="sm" onClick={handleSaveModel} icon={<CheckIcon className="w-4 h-4" />}>
                保存
              </CyberButton>
            </div>
          </div>
        </div>
      )}

      {/* Channel Form Modal */}
      {showChannelForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-cyber-dark-card border border-cyber-cyan/20 rounded-lg p-6 w-full max-w-md">
            <h3 className="font-display font-semibold text-cyber-cyan mb-4">
              {editingChannelKey ? '编辑通道' : '添加通道'}
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs text-cyber-muted mb-1">通道名称</label>
                <input
                  type="text"
                  value={channelFormData.name}
                  onChange={(e) =>
                    setChannelFormData({ ...channelFormData, name: e.target.value })
                  }
                  disabled={editingChannelKey !== null}
                  className="w-full px-3 py-2 rounded-lg bg-cyber-dark border border-cyber-cyan/20 text-cyber-white text-sm focus:border-cyber-cyan focus:outline-none disabled:opacity-50"
                />
              </div>
              <div>
                <label className="block text-xs text-cyber-muted mb-1">类型</label>
                <input
                  type="text"
                  value={channelFormData.type}
                  onChange={(e) =>
                    setChannelFormData({ ...channelFormData, type: e.target.value })
                  }
                  className="w-full px-3 py-2 rounded-lg bg-cyber-dark border border-cyber-cyan/20 text-cyber-white text-sm focus:border-cyber-cyan focus:outline-none"
                />
              </div>
              <div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={channelFormData.enabled}
                    onChange={(e) =>
                      setChannelFormData({ ...channelFormData, enabled: e.target.checked })
                    }
                    className="w-4 h-4 rounded border-cyber-cyan/30 bg-cyber-dark checked:bg-cyber-cyan cursor-pointer"
                  />
                  <span className="text-sm text-cyber-white">启用</span>
                </label>
              </div>
              {(channelFormData.type === 'pico' ||
                channelFormData.type === 'telegram' ||
                channelFormData.type === 'discord') && (
                <div>
                  <label className="block text-xs text-cyber-muted mb-1">Token</label>
                  <input
                    type="password"
                    value={channelFormData.token}
                    onChange={(e) =>
                      setChannelFormData({ ...channelFormData, token: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg bg-cyber-dark border border-cyber-cyan/20 text-cyber-white text-sm focus:border-cyber-cyan focus:outline-none"
                  />
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <CyberButton variant="ghost" size="sm" onClick={() => setShowChannelForm(false)}>
                取消
              </CyberButton>
              <CyberButton variant="primary" size="sm" onClick={handleSaveChannel} icon={<CheckIcon className="w-4 h-4" />}>
                保存
              </CyberButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
