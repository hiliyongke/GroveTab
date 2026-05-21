/**
 * EnhancedRenameDialog — 增强的命名对话框
 * 
 * 设计目标：
 * - 提供智能命名建议
 * - 支持标签分类
 * - 显示命名预览
 * - 提供更好的视觉反馈
 */

import { useState, useEffect } from 'react';
import { Modal, Button, Input, Space, Tag, Alert, Divider } from 'antd';
import { CheckCircle, AlertCircle, Tag as TagIcon } from 'lucide-react';
import { useT } from '@/shared/i18n';
import { ICON_SIZE } from '@/shared/utils/icon-size';

interface EnhancedRenameDialogProps {
  open: boolean;
  sessionId: string;
  currentName: string;
  tabCount: number;
  tabUrls: string[];
  onClose: () => void;
  onRenameConfirm: (id: string, newName: string) => Promise<void>;
}

export function EnhancedRenameDialog({
  open,
  sessionId,
  currentName,
  tabCount,
  tabUrls,
  onClose,
  onRenameConfirm,
}: EnhancedRenameDialogProps) {
  const { t } = useT();
  const [newName, setNewName] = useState(currentName);
  const [isRenaming, setIsRenaming] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [tags, setTags] = useState<string[]>([]);

  useEffect(() => {
    if (open) {
      setNewName(currentName);
      setIsRenaming(false);
      generateSuggestions();
      extractTags();
    }
  }, [open, currentName, tabUrls]);

  const generateSuggestions = () => {
    const generated: string[] = [];
    
    // 基于标签页数量生成建议
    if (tabCount > 0) {
      generated.push(`${t('archive.session')} ${tabCount} ${t('archive.tabs')}`);
      generated.push(`${tabCount} ${t('archive.tabs')} ${t('archive.from')} ${new Date().toLocaleDateString()}`);
    }
    
    // 基于域名生成建议
    const domains = tabUrls
      .map(url => {
        try {
          return new URL(url).hostname.replace('www.', '');
        } catch {
          return null;
        }
      })
      .filter(Boolean)
      .slice(0, 3);
    
    if (domains.length > 0) {
      generated.push(`${domains.join(', ')} ${t('archive.tabs')}`);
      if (domains.length === 1) {
        generated.push(`${domains[0]} ${t('archive.session')}`);
      }
    }
    
    setSuggestions(generated);
  };

  const extractTags = () => {
    // 基于域名提取标签
    const domains = tabUrls
      .map(url => {
        try {
          return new URL(url).hostname.replace('www.', '');
        } catch {
          return null;
        }
      })
      .filter((domain): domain is string => domain !== null)
      .slice(0, 5);
    
    // 基于内容关键词提取标签
    const keywords = ['research', 'work', 'personal', 'shopping', 'news', 'entertainment'];
    const matchedKeywords = keywords.filter(keyword => 
      tabUrls.some(url => url.toLowerCase().includes(keyword))
    );
    
    setTags([...new Set([...domains, ...matchedKeywords])].slice(0, 8));
  };

  const handleRename = async () => {
    if (!newName.trim()) {
      return;
    }
    
    setIsRenaming(true);
    try {
      await onRenameConfirm(sessionId, newName.trim());
      onClose();
    } catch (error) {
      console.error('Rename failed:', error);
    } finally {
      setIsRenaming(false);
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    setNewName(suggestion);
  };

  const handleTagClick = (tag: string) => {
    const updatedName = newName.trim();
    if (updatedName.includes(tag)) {
      // 如果已包含标签，则移除
      setNewName(updatedName.replace(new RegExp(`\\s*#${tag}\\s*`, 'g'), '').trim());
    } else {
      // 否则添加标签
      setNewName(`${updatedName} #${tag}`.trim());
    }
  };

  const isNameValid = newName.trim().length > 0 && newName.trim().length <= 100;

  return (
    <Modal
      open={open}
      rootClassName="app-archive-dialog app-archive-rename-dialog"
      title={t('archive.renameTitle')}
      onCancel={onClose}
      footer={[
        <Button key="cancel" onClick={onClose}>
          {t('archive.cancel')}
        </Button>,
        <Button
          key="rename"
          type="primary"
          icon={<CheckCircle size={ICON_SIZE.MEDIUM} />}
          loading={isRenaming}
          disabled={!isNameValid}
          onClick={handleRename}
        >
          {t('archive.renameConfirm')}
        </Button>,
      ]}
      width={520}
      centered
    >
      <Space direction="vertical" size="middle" className="app-archive-dialog__stack">
        {/* 当前名称 */}
        <div className="app-archive-dialog__section">
          <div className="app-archive-dialog__label">{t('archive.currentName')}</div>
          <div className="app-archive-dialog__current-name">{currentName}</div>
        </div>

        {/* 新名称输入 */}
        <div className="app-archive-dialog__section">
          <div className="app-archive-dialog__strategy-label">{t('archive.newName')}</div>
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder={t('archive.renamePlaceholder')}
            maxLength={100}
            showCount
            autoFocus
            onPressEnter={handleRename}
          />
        </div>

        {/* 命名建议 */}
        {suggestions.length > 0 && (
          <div className="app-archive-dialog__section">
            <div className="app-archive-dialog__label">{t('archive.nameSuggestions')}</div>
            <Space wrap>
              {suggestions.map((suggestion, index) => (
                <Tag
                  key={index}
                  color="blue"
                  className="app-archive-dialog__tag"
                  onClick={() => handleSuggestionClick(suggestion)}
                >
                  {suggestion}
                </Tag>
              ))}
            </Space>
          </div>
        )}

        {/* 标签分类 */}
        {tags.length > 0 && (
          <div className="app-archive-dialog__section">
            <div className="app-archive-dialog__label app-archive-dialog__tag-label">
              <TagIcon size={12} />
              {t('archive.tags')}
            </div>
            <Space wrap>
              {tags.map((tag, index) => (
                <Tag
                  key={index}
                  color={newName.includes(tag) ? 'green' : 'default'}
                  className="app-archive-dialog__tag"
                  onClick={() => handleTagClick(tag)}
                >
                  #{tag}
                </Tag>
              ))}
            </Space>
          </div>
        )}

        {/* 验证提示 */}
        {!isNameValid && (
          <Alert
            message={t('archive.nameValidation')}
            type="warning"
            showIcon
            icon={<AlertCircle size={ICON_SIZE.SMALL} />}
            className="app-archive-dialog__validation"
          />
        )}

        {/* 预览 */}
        <Divider className="app-archive-dialog__divider" />
        <div className="app-archive-dialog__section">
          <div className="app-archive-dialog__label">{t('archive.preview')}</div>
          <div className={`app-archive-dialog__preview-value${isNameValid ? '' : ' is-invalid'}`}>
            {newName.trim() || t('archive.noName')}
          </div>
        </div>
      </Space>
    </Modal>
  );
}
