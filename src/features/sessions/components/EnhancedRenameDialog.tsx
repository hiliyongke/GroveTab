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
      generated.push(`${t('会话')} ${tabCount} ${t('标签页')}`);
      generated.push(`${tabCount} ${t('标签页')} ${t('来自')} ${new Date().toLocaleDateString()}`);
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
      generated.push(`${domains.join(', ')} ${t('标签页')}`);
      if (domains.length === 1) {
        generated.push(`${domains[0]} ${t('会话')}`);
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
      title={t('重命名会话')}
      onCancel={onClose}
      footer={[
        <Button key="cancel" onClick={onClose}>
          {t('取消')}
        </Button>,
        <Button
          key="rename"
          type="primary"
          icon={<CheckCircle size={ICON_SIZE.MEDIUM} />}
          loading={isRenaming}
          disabled={!isNameValid}
          onClick={handleRename}
        >
          {t('确认重命名')}
        </Button>,
      ]}
      width={520}
      centered
    >
      <Space direction="vertical" size="middle" className="app-archive-dialog__stack">
        {/* 当前名称 */}
        <div className="app-archive-dialog__section">
          <div className="app-archive-dialog__label">{t('当前名称')}</div>
          <div className="app-archive-dialog__current-name">{currentName}</div>
        </div>

        {/* 新名称输入 */}
        <div className="app-archive-dialog__section">
          <div className="app-archive-dialog__strategy-label">{t('新名称')}</div>
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder={t('输入新名称')}
            maxLength={100}
            showCount
            autoFocus
            onPressEnter={handleRename}
          />
        </div>

        {/* 命名建议 */}
        {suggestions.length > 0 && (
          <div className="app-archive-dialog__section">
            <div className="app-archive-dialog__label">{t('推荐名称')}</div>
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
              {t('标签')}
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
            message={t('名称格式不正确')}
            type="warning"
            showIcon
            icon={<AlertCircle size={ICON_SIZE.SMALL} />}
            className="app-archive-dialog__validation"
          />
        )}

        {/* 预览 */}
        <Divider className="app-archive-dialog__divider" />
        <div className="app-archive-dialog__section">
          <div className="app-archive-dialog__label">{t('预览')}</div>
          <div className={`app-archive-dialog__preview-value${isNameValid ? '' : ' is-invalid'}`}>
            {newName.trim() || t('名称不能为空')}
          </div>
        </div>
      </Space>
    </Modal>
  );
}
