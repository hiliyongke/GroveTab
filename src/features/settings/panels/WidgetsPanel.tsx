import { nanoid } from 'nanoid';
import { Button, Input, Popconfirm, Select, Switch } from 'antd';
import { BookmarkPlus, FolderPlus, Grip, LayoutGrid, Plus, TimerReset, Trash2 } from 'lucide-react';
import { ICON_SIZE } from '@/shared/utils/icon-size';
import { useSettingsStore } from '@/store';
import { useT } from '@/shared/i18n';
import { Field } from '../components/Field';
import { feedback } from '@/shared/ui/feedback';
import {
  getBookmarkTree,
  hasBookmarksPermission,
  requestBookmarksPermission,
} from '@/chrome/bookmarks';
import type { DashboardWidgetType, SpeedDialGroup, SpeedDialLink } from '@/shared/types';
import { isSafeExternalUrl, normalizeExternalUrl } from '@/shared/utils/url-safety';
import { WIDGET_DEFINITIONS } from '@/features/dashboard-widgets/types';
import './styles/widgets.css';

function isValidDateText(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (match === null) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(year, month - 1, day);
  return (
    parsed.getFullYear() === year && parsed.getMonth() === month - 1 && parsed.getDate() === day
  );
}

function isValidHourMinute(value: string): boolean {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (match === null) return false;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  return (
    Number.isInteger(hour) &&
    Number.isInteger(minute) &&
    hour >= 0 &&
    hour <= 23 &&
    minute >= 0 &&
    minute <= 59
  );
}

export function WidgetsPanel() {
  const { t } = useT();
  const settings = useSettingsStore((s) => s.settings);
  const updateSettings = useSettingsStore((s) => s.updateSettings);

  const dashboard = settings.dashboardWidgets;
  const speedDial = settings.speedDial;
  const countdowns = settings.countdowns;
  const workCountdown = settings.workCountdown;
  const pomodoro = settings.pomodoro;

  const speedDialGroups: SpeedDialGroup[] = speedDial?.groups ?? [];

  const saveSpeedDial = (groups: SpeedDialGroup[]) =>
    updateSettings({ speedDial: { ...(speedDial ?? {}), groups } });

  const addGroup = () => {
    const id = `group-${nanoid(8)}`;
    void saveSpeedDial([...speedDialGroups, { id, name: t('widgets.newGroup'), links: [] }]);
  };

  const renameGroup = (id: string, name: string) => {
    void saveSpeedDial(speedDialGroups.map((group) => (group.id === id ? { ...group, name } : group)));
  };

  const removeGroup = (id: string) => {
    void saveSpeedDial(speedDialGroups.filter((group) => group.id !== id));
  };

  const addLink = (groupId: string) => {
    void saveSpeedDial(
      speedDialGroups.map((group) =>
        group.id === groupId
          ? {
              ...group,
              links: [
                ...group.links,
                { id: `link-${nanoid(8)}`, title: t('widgets.newSite'), url: 'https://' },
              ],
            }
          : group,
      ),
    );
  };

  const updateLink = (groupId: string, linkId: string, patch: Partial<SpeedDialLink>) => {
    void saveSpeedDial(
      speedDialGroups.map((group) =>
        group.id === groupId
          ? {
              ...group,
              links: group.links.map((link) =>
                link.id === linkId ? { ...link, ...patch } : link,
              ),
            }
          : group,
      ),
    );
  };

  const removeLink = (groupId: string, linkId: string) => {
    void saveSpeedDial(
      speedDialGroups.map((group) =>
        group.id === groupId
          ? { ...group, links: group.links.filter((link) => link.id !== linkId) }
          : group,
      ),
    );
  };

  const toggleWidgetAvailable = (type: DashboardWidgetType, enabled: boolean) => {
    void updateSettings({
      dashboardWidgets: {
        ...(dashboard ?? {}),
        availableWidgets: {
          ...(dashboard?.availableWidgets ?? {}),
          [type]: enabled,
        },
      },
    });
  };

  const importFromBookmarks = async () => {
    try {
      const hasPerm = await hasBookmarksPermission();
      if (!hasPerm) {
        const granted = await requestBookmarksPermission();
        if (!granted) {
          feedback.warning(t('widgets.needBookmarkPerm'));
          return;
        }
      }
      const tree = await getBookmarkTree();
      const root = tree[0]?.children ?? [];
      const bar =
        root.find(
          (node) =>
            node.title === '书签栏'
            || node.title === 'Bookmarks bar'
            || node.title === 'Bookmarks Bar',
        ) ?? root[0];
      const folders = (bar?.children ?? []).filter((node) => node.children && node.children.length > 0);
      const existingGroupNames = new Set(speedDialGroups.map((group) => group.name));
      const newGroups: SpeedDialGroup[] = folders
        .filter((folder) => !existingGroupNames.has(folder.title ?? t('widgets.unnamed')))
        .map((folder) => ({
          id: `group-${nanoid(8)}-${folder.id}`,
          name: folder.title ?? t('widgets.unnamed'),
          links: (folder.children ?? [])
            .filter((node) => typeof node.url === 'string' && isSafeExternalUrl(node.url))
            .slice(0, 30)
            .map((bookmark, index) => ({
              id: `link-${nanoid(8)}-${bookmark.id}-${index}`,
              title: bookmark.title || bookmark.url || t('widgets.unnamed'),
              url: bookmark.url ?? '',
            })),
        }))
        .filter((group) => group.links.length > 0);

      const rootLinks: SpeedDialLink[] = (bar?.children ?? [])
        .filter((node) => typeof node.url === 'string' && isSafeExternalUrl(node.url))
        .slice(0, 30)
        .map((bookmark, index) => ({
          id: `link-${nanoid(8)}-root-${bookmark.id}-${index}`,
          title: bookmark.title || bookmark.url || t('widgets.unnamed'),
          url: bookmark.url ?? '',
        }));
      if (rootLinks.length > 0 && !existingGroupNames.has(t('widgets.bookmarkBar'))) {
        newGroups.unshift({
          id: `group-${nanoid(8)}-bar`,
          name: t('widgets.bookmarkBar'),
          links: rootLinks,
        });
      }

      if (newGroups.length === 0) {
        feedback.warning(t('widgets.noBookmarksToImport'));
        return;
      }
      await saveSpeedDial([...speedDialGroups, ...newGroups]);
      feedback.success(t('widgets.bookmarkImported', { n: newGroups.length }));
    } catch (err) {
      feedback.error(
        t('widgets.bookmarkImportFailed', {
          msg: err instanceof Error ? err.message : String(err),
        }),
      );
    }
  };

  return (
    <div className="widgets-panel">
      <Field label={t('widgets.dashboard')} hint={t('widgets.dashboardHint')}>
        <div className="widgets-panel__row-actions">
          <Button
            type={dashboard?.enabled !== false ? 'primary' : 'default'}
            icon={<LayoutGrid size={ICON_SIZE.MEDIUM} />}
            onClick={() =>
              void updateSettings({
                dashboardWidgets: {
                  ...(dashboard ?? {}),
                  enabled: !(dashboard?.enabled !== false),
                },
              })
            }
          >
            {dashboard?.enabled !== false ? t('widgets.enabled') : t('widgets.hidden')}
          </Button>
          <Button
            icon={<Grip size={ICON_SIZE.MEDIUM} />}
            onClick={() =>
              void updateSettings({
                dashboardWidgets: {
                  ...(dashboard ?? {}),
                  editMode: !(dashboard?.editMode === true),
                  enabled: true,
                },
              })
            }
          >
            {dashboard?.editMode === true ? t('widgets.exitEdit') : t('widgets.enterEdit')}
          </Button>
        </div>
      </Field>

      <Field label={t('widgets.gridDensity')} hint={t('widgets.gridDensityHint')}>
        <div className="widgets-panel__grid-two">
          <Select
            value={dashboard?.columns ?? 12}
            options={[8, 10, 12].map((value) => ({
              value,
              label: t('widgets.columns', { n: value }),
            }))}
            onChange={(value) =>
              void updateSettings({ dashboardWidgets: { ...(dashboard ?? {}), columns: value } })
            }
          />
          <Select
            value={dashboard?.rowHeight ?? 88}
            options={[76, 88, 96, 108].map((value) => ({
              value,
              label: t('widgets.rowHeight', { n: value }),
            }))}
            onChange={(value) =>
              void updateSettings({ dashboardWidgets: { ...(dashboard ?? {}), rowHeight: value } })
            }
          />
        </div>
      </Field>

      <Field label="组件库" hint="关闭后会从工作台隐藏，但保留原布局；重新开启后可继续使用。">
        <div className="widgets-panel__widget-library">
          {WIDGET_DEFINITIONS.map((item) => (
            <div key={item.type} className="widgets-panel__widget-card">
              <span className="widgets-panel__widget-title">{item.title}</span>
              <Switch
                size="small"
                checked={dashboard?.availableWidgets?.[item.type] !== false}
                onChange={(checked) => toggleWidgetAvailable(item.type, checked)}
              />
            </div>
          ))}
        </div>
      </Field>

      <Field label={t('widgets.speedDial')} hint={t('widgets.speedDialHint')}>
        <div className="widgets-panel__toggle-group">
          <div className="widgets-panel__toggle-item">
            <span className="widgets-panel__toggle-label">{t('widgets.enable')}</span>
            <Switch
              checked={speedDial?.enabled !== false}
              onChange={(value) =>
                void updateSettings({ speedDial: { ...(speedDial ?? {}), enabled: value } })
              }
            />
          </div>
          <div className="widgets-panel__toggle-item">
            <span className="widgets-panel__toggle-label">{t('widgets.showLabels')}</span>
            <Switch
              checked={speedDial?.showLabels !== false}
              onChange={(value) =>
                void updateSettings({ speedDial: { ...(speedDial ?? {}), showLabels: value } })
              }
            />
          </div>
          <div className="widgets-panel__toggle-item">
            <span className="widgets-panel__toggle-label">{t('widgets.openInNewTab')}</span>
            <Switch
              checked={speedDial?.openInNewTab !== false}
              onChange={(value) =>
                void updateSettings({ speedDial: { ...(speedDial ?? {}), openInNewTab: value } })
              }
            />
          </div>
        </div>
      </Field>

      <Field label={t('widgets.speedDialGroups')} hint={t('widgets.speedDialGroupsHint')}>
        <div className="widgets-panel__actions">
          <Button icon={<FolderPlus size={ICON_SIZE.MEDIUM} />} onClick={addGroup}>
            {t('widgets.addGroup')}
          </Button>
          <Button
            icon={<BookmarkPlus size={ICON_SIZE.MEDIUM} />}
            onClick={() => void importFromBookmarks()}
          >
            {t('widgets.importBookmarks')}
          </Button>
        </div>

        <div className="widgets-panel__group-list">
          {speedDialGroups.map((group) => (
            <div key={group.id} className="widgets-panel__group-card">
              <div className="widgets-panel__group-header">
                <Input
                  value={group.name}
                  onChange={(e) => renameGroup(group.id, e.target.value)}
                  className="widgets-panel__group-name"
                />
                <span className="widgets-panel__group-count">
                  {t('widgets.linkCount', { n: group.links.length })}
                </span>
                <div className="widgets-panel__group-actions">
                  <Button
                    size="small"
                    icon={<Plus size={ICON_SIZE.SMALL} />}
                    onClick={() => addLink(group.id)}
                  >
                    {t('widgets.addLink')}
                  </Button>
                  <Popconfirm title={t('widgets.removeGroup')} onConfirm={() => removeGroup(group.id)}>
                    <Button size="small" danger icon={<Trash2 size={ICON_SIZE.SMALL} />} />
                  </Popconfirm>
                </div>
              </div>

              <div className="widgets-panel__link-list">
                {group.links.map((link) => (
                  <div key={link.id} className="widgets-panel__link-row">
                    <Input
                      size="small"
                      value={link.title}
                      placeholder={t('widgets.namePlaceholder')}
                      onChange={(e) => updateLink(group.id, link.id, { title: e.target.value })}
                    />
                    <Input
                      size="small"
                      value={link.url}
                      placeholder="https://..."
                      status={link.url.trim() !== '' && !isSafeExternalUrl(link.url) ? 'error' : undefined}
                      onChange={(e) => updateLink(group.id, link.id, { url: e.target.value })}
                      onBlur={() => {
                        const normalized = normalizeExternalUrl(link.url, {
                          assumeHttpsWhenMissingProtocol: true,
                        });
                        if (normalized === null) {
                          if (link.url.trim() !== '') feedback.error('链接格式无效');
                          return;
                        }
                        updateLink(group.id, link.id, { url: normalized });
                      }}
                    />
                    <Input
                      size="small"
                      value={link.emoji ?? ''}
                      placeholder={t('widgets.iconPlaceholder')}
                      onChange={(e) => updateLink(group.id, link.id, { emoji: e.target.value })}
                    />
                    <Button
                      size="small"
                      danger
                      icon={<Trash2 size={ICON_SIZE.SMALL} />}
                      onClick={() => removeLink(group.id, link.id)}
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Field>

      <Field label={t('widgets.defaultGroup')} hint={t('widgets.defaultGroupHint')}>
        <Select
          value={speedDial?.activeGroupId ?? speedDial?.groups?.[0]?.id}
          options={(speedDial?.groups ?? []).map((group) => ({
            value: group.id,
            label: group.name,
          }))}
          onChange={(value) =>
            void updateSettings({ speedDial: { ...(speedDial ?? {}), activeGroupId: value } })
          }
        />
      </Field>

      <Field label={t('widgets.countdown')} hint={t('widgets.countdownHint')}>
        <div className="widgets-panel__countdown-list">
          {(countdowns?.items ?? []).map((item) => (
            <div key={item.id} className="widgets-panel__countdown-item">
              <Input
                value={item.title}
                onChange={(e) => {
                  const nextItems = (countdowns?.items ?? []).map((entry) =>
                    entry.id === item.id ? { ...entry, title: e.target.value } : entry,
                  );
                  void updateSettings({ countdowns: { ...(countdowns ?? {}), items: nextItems } });
                }}
              />
              <Input
                value={item.targetDate}
                placeholder="YYYY-MM-DD"
                status={
                  item.targetDate.trim() !== '' && !isValidDateText(item.targetDate)
                    ? 'error'
                    : undefined
                }
                onChange={(e) => {
                  const nextItems = (countdowns?.items ?? []).map((entry) =>
                    entry.id === item.id ? { ...entry, targetDate: e.target.value } : entry,
                  );
                  void updateSettings({ countdowns: { ...(countdowns ?? {}), items: nextItems } });
                }}
              />
            </div>
          ))}
          <Button
            icon={<Plus size={ICON_SIZE.MEDIUM} />}
            onClick={() => {
              const next = [
                ...(countdowns?.items ?? []),
                {
                  id: `countdown-${nanoid(8)}`,
                  title: t('widgets.newCountdownTitle'),
                  targetDate: '2026-12-31',
                  emoji: '🎉',
                },
              ];
              void updateSettings({ countdowns: { ...(countdowns ?? {}), items: next } });
            }}
          >
            {t('widgets.newCountdown')}
          </Button>
        </div>
      </Field>

      <Field label={t('widgets.workCountdown')} hint={t('widgets.workCountdownHint')}>
        <div className="widgets-panel__work-countdown widgets-panel__grid-two">
          <Input
            value={workCountdown?.workdayEnd ?? '18:30'}
            placeholder="18:30"
            status={!isValidHourMinute(workCountdown?.workdayEnd ?? '18:30') ? 'error' : undefined}
            onChange={(e) =>
              void updateSettings({
                workCountdown: { ...(workCountdown ?? {}), workdayEnd: e.target.value },
              })
            }
          />
          <Input
            value={workCountdown?.offLabel ?? t('widgets.offLabel')}
            placeholder={t('widgets.offLabel')}
            onChange={(e) =>
              void updateSettings({
                workCountdown: { ...(workCountdown ?? {}), offLabel: e.target.value },
              })
            }
          />
        </div>
      </Field>

      <Field label={t('widgets.pomodoro')} hint={t('widgets.pomodoroHint')}>
        <div className="widgets-panel__pomodoro-grid widgets-panel__grid-three">
          <Select
            value={pomodoro?.focusMinutes ?? 25}
            options={[20, 25, 30, 45, 60].map((value) => ({
              value,
              label: t('widgets.focusMinutes', { n: value }),
            }))}
            onChange={(value) =>
              void updateSettings({ pomodoro: { ...(pomodoro ?? {}), focusMinutes: value } })
            }
          />
          <Select
            value={pomodoro?.shortBreakMinutes ?? 5}
            options={[5, 10, 15].map((value) => ({
              value,
              label: t('widgets.shortBreak', { n: value }),
            }))}
            onChange={(value) =>
              void updateSettings({ pomodoro: { ...(pomodoro ?? {}), shortBreakMinutes: value } })
            }
          />
          <Select
            value={pomodoro?.longBreakMinutes ?? 15}
            options={[15, 20, 30].map((value) => ({
              value,
              label: t('widgets.longBreak', { n: value }),
            }))}
            onChange={(value) =>
              void updateSettings({ pomodoro: { ...(pomodoro ?? {}), longBreakMinutes: value } })
            }
          />
        </div>
        <Button
          icon={<TimerReset size={ICON_SIZE.MEDIUM} />}
          className="widgets-panel__reset-button"
          onClick={() => {
            void updateSettings({
              pomodoro: {
                ...(pomodoro ?? {}),
                focusMinutes: 25,
                shortBreakMinutes: 5,
                longBreakMinutes: 15,
              },
            });
            feedback.success(t('widgets.pomodoroReset'));
          }}
        >
          {t('widgets.resetPomodoro')}
        </Button>
      </Field>
    </div>
  );
}
