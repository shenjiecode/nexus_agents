import { useState } from 'react';
import { CyberModal } from './CyberModal';
import { CyberButton } from './CyberButton';
import { useApi } from '../hooks/useApi';
import type { MarketplaceRole } from '../types';

interface RoleSelectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (roleId: string | null) => void;
}

export function RoleSelectModal({ isOpen, onClose, onSelect }: RoleSelectModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);

  const { data: marketplaceRoles } = useApi<MarketplaceRole[]>('/api/marketplace-roles');

  const filteredRoles = marketplaceRoles?.filter(role => {
    const query = searchQuery.toLowerCase();
    return (
      role.name.toLowerCase().includes(query) ||
      role.description.toLowerCase().includes(query)
    );
  }) || [];

  const handleConfirm = () => {
    onSelect(selectedRoleId);
    handleClose();
  };

  const handleClose = () => {
    setSearchQuery('');
    setSelectedRoleId(null);
    onClose();
  };

  const handleSelectRole = (roleId: string) => {
    setSelectedRoleId(roleId === selectedRoleId ? null : roleId);
  };

  return (
    <CyberModal
      isOpen={isOpen}
      onClose={handleClose}
      title="选择角色"
      size="lg"
      footer={
        <>
          <CyberButton variant="ghost" onClick={handleClose}>
            取消
          </CyberButton>
          <CyberButton onClick={handleConfirm}>
            确认
          </CyberButton>
        </>
      }
    >
      <div className="space-y-4">
        {/* Search Input */}
        <div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜索角色..."
            className="w-full px-3 py-2 rounded-lg bg-cyber-dark border border-cyber-cyan/20 text-cyber-white focus:border-cyber-cyan focus:outline-none"
          />
        </div>

        {/* No Role Option */}
        <div
          onClick={() => setSelectedRoleId(null)}
          className={`
            p-4 rounded-lg border cursor-pointer transition-all duration-200
            ${selectedRoleId === null
              ? 'border-cyber-cyan bg-cyber-cyan/10'
              : 'border-cyber-cyan/20 hover:border-cyber-cyan/40'
            }
          `}
        >
          <div className="flex items-center justify-between">
            <div>
              <span className="font-medium text-cyber-white">不选择角色</span>
              <p className="text-sm text-cyber-muted mt-1">创建员工时不关联 Marketplace 角色</p>
            </div>
            {selectedRoleId === null && (
              <div className="w-5 h-5 rounded-full bg-cyber-cyan flex items-center justify-center">
                <svg className="w-3 h-3 text-cyber-dark" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            )}
          </div>
        </div>

        {/* Role List */}
        <div className="max-h-80 overflow-y-auto space-y-2">
          {filteredRoles.map((role) => (
            <div
              key={role.id}
              onClick={() => handleSelectRole(role.id)}
              className={`
                p-4 rounded-lg border cursor-pointer transition-all duration-200
                ${selectedRoleId === role.id
                  ? 'border-cyber-cyan bg-cyber-cyan/10'
                  : 'border-cyber-cyan/20 hover:border-cyber-cyan/40'
                }
              `}
            >
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-medium text-cyber-white">{role.name}</span>
                  <p className="text-sm text-cyber-muted mt-1">{role.description}</p>
                </div>
                {selectedRoleId === role.id && (
                  <div className="w-5 h-5 rounded-full bg-cyber-cyan flex items-center justify-center">
                    <svg className="w-3 h-3 text-cyber-dark" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                )}
              </div>
            </div>
          ))}

          {filteredRoles.length === 0 && searchQuery && (
            <div className="text-center py-8 text-cyber-muted">
              没有找到匹配的角色
            </div>
          )}
        </div>
      </div>
    </CyberModal>
  );
}