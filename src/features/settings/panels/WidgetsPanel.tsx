import { Button, Input, Select, Switch, theme, Popconfirm } from 'antd';
import { Plus, LayoutGrid, Grip, TimerReset, Trash2, FolderPlus, BookmarkPlus } from 'lucide-react';
import { useSettingsStore } from '@/store';
import { Field } from '../components/Field';
import { feedback } from '@/shared/ui/feedback';
import { getBookmarkTree, hasBookmarksPermission, requestBookmarksPermission } from '@/chrome/bookmarks';
import type { SpeedDialGroup, SpeedDialLink } from '@/shared/types';

export function WidgetsPanel() {
  const { token } = theme.useToken();
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
    const id = `group-${Date.now()}`;
    void saveSpeedDial([...speedDialGroups, { id, name: '新分组', links: [] }]);
  };

  const renameGroup = (id: string, name: string) => {
    void saveSpeedDial(speedDialGroups.map((g) => (g.id === id ? { ...g, name } : g)));
  };

  const removeGroup = (id: string) => {
    void saveSpeedDial(speedDialGroups.filter((g) => g.id !== id));
  };

  const addLink = (groupId: string) => {
    void saveSpeedDial(
      speedDialGroups.map((g) =>
        g.id === groupId
          ? { ...g, links: [...g.links, { id: `link-${Date.now()}`, title: '新站点', url: 'https://' }] }
          : g,
      ),
    );
  };

  const updateLink = (groupId: string, linkId: string, patch: Partial<SpeedDialLink>) => {
    void saveSpeedDial(
      speedDialGroups.map((g) =>
        g.id === groupId
          ? { ...g, links: g.links.map((l) => (l.id === linkId ? { ...l, ...patch } : l)) }
          : g,
      ),
    );
  };

  const removeLink = (groupId: string, linkId: string) => {
    void saveSpeedDial(
      speedDialGroups.map((g) =>
        g.id === groupId ? { ...g, links: g.links.filter((l) => l.id !== linkId) } : g,
      ),
    );
  };

  const importFromBookmarks = async () => {
    try {
      const hasPerm = await hasBookmarksPermission();
      if (!hasPerm) {
        const granted = await requestBookmarksPermission();
        if (!granted) {
          feedback.warning('需要书签权限才能导入');
          return;
        }
      }
      const tree = await getBookmarkTree();
      // 扁平化：把浏览器书签工具栏下的子文件夹各作为一个分组
      const root = tree[0]?.children ?? [];
      const bar = root.find((n) => n.title === '书签栏' || n.title === 'Bookmarks bar' || n.title === 'Bookmarks Bar') ?? root[0];
      const folders = (bar?.children ?? []).filter((n) => n.children && n.children.length > 0);
      const existingGroupNames = new Set(speedDialGroups.map((g) => g.name));
      const newGroups: SpeedDialGroup[] = folders
        .filter((f) => !existingGroupNames.has(f.title ?? '未命名'))
        .map((folder) => ({
          id: `group-${Date.now()}-${folder.id}`,
          name: folder.title ?? '未命名',
          links: (folder.children ?? [])
            .filter((n) => !!n.url)
            .slice(0, 30)
            .map((bm, idx) => ({
              id: `link-${Date.now()}-${bm.id}-${idx}`,
              title: bm.title || bm.url || '未命名',
              url: bm.url ?? '',
            })),
        }))
        .filter((g) => g.links.length > 0);

      // 根级非文件夹书签合并进"书签栏"组
      const rootLinks: SpeedDialLink[] = (bar?.children ?? [])
        .filter((n) => !!n.url)
        .slice(0, 30)
        .map((bm, idx) => ({
          id: `link-${Date.now()}-root-${bm.id}-${idx}`,
          title: bm.title || bm.url || '未命名',
          url: bm.url ?? '',
        }));
      if (rootLinks.length > 0 && !existingGroupNames.has('书签栏')) {
        newGroups.unshift({ id: `group-${Date.now()}-bar`, name: '书签栏', links: rootLinks });
      }

      if (newGroups.length === 0) {
        feedback.warning('未找到可导入的书签或已全部导入过');
        return;
      }
      await saveSpeedDial([...speedDialGroups, ...newGroups]);
      feedback.success(`已从浏览器导入 ${newGroups.length} 个分组`);
    } catch (err) {
      feedback.error(`导入失败：${err instanceof Error ? err.message : String(err)}`);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <Field label="顶部工作台" hint="控制顶部 widget 画布的显隐、编辑模式与网格参数。">
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Button
            type={dashboard?.enabled !== false ? 'primary' : 'default'}
            icon={<LayoutGrid size={14} />}
            onClick={() => void updateSettings({ dashboardWidgets: { ...(dashboard ?? {}), enabled: !(dashboard?.enabled !== false) } })}
          >
            {dashboard?.enabled !== false ? '已启用' : '已隐藏'}
          </Button>
          <Button
            icon={<Grip size={14} />}
            onClick={() => void updateSettings({ dashboardWidgets: { ...(dashboard ?? {}), editMode: !(dashboard?.editMode === true), enabled: true } })}
          >
            {dashboard?.editMode === true ? '退出编辑' : '进入编辑'}
          </Button>
        </div>
      </Field>

      <Field label="网格密度" hint="开发阶段默认 12 列，行高越大，单个组件在视觉上越舒展。">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <Select
            value={dashboard?.columns ?? 12}
            options={[8, 10, 12].map((value) => ({ value, label: `${value} 列` }))}
            onChange={(value) => void updateSettings({ dashboardWidgets: { ...(dashboard ?? {}), columns: value } })}
          />
          <Select
            value={dashboard?.rowHeight ?? 88}
            options={[76, 88, 96, 108].map((value) => ({ value, label: `${value}px 行高` }))}
            onChange={(value) => void updateSettings({ dashboardWidgets: { ...(dashboard ?? {}), rowHeight: value } })}
          />
        </div>
      </Field>

      <Field label="快捷网站" hint="控制网站快捷模块的默认行为。">
        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 12, color: token.colorTextSecondary }}>启用</span>
            <Switch checked={speedDial?.enabled !== false} onChange={(value) => void updateSettings({ speedDial: { ...(speedDial ?? {}), enabled: value } })} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 12, color: token.colorTextSecondary }}>显示名称</span>
            <Switch checked={speedDial?.showLabels !== false} onChange={(value) => void updateSettings({ speedDial: { ...(speedDial ?? {}), showLabels: value } })} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 12, color: token.colorTextSecondary }}>新标签打开</span>
            <Switch checked={speedDial?.openInNewTab !== false} onChange={(value) => void updateSettings({ speedDial: { ...(speedDial ?? {}), openInNewTab: value } })} />
          </div>
        </div>
      </Field>

      <Field label="快捷网站分组管理" hint="对每个分组下的链接进行增删改；也可以从浏览器书签一键导入。">
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <Button icon={<FolderPlus size={14} />} onClick={addGroup}>新增分组</Button>
          <Button icon={<BookmarkPlus size={14} />} onClick={() => void importFromBookmarks()}>从浏览器书签导入</Button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {speedDialGroups.map((group) => (
            <div
              key={group.id}
              style={{
                padding: 12,
                borderRadius: token.borderRadiusLG,
                background: token.colorFillQuaternary,
                border: `1px solid ${token.colorBorderSecondary}`,
              }}
            >
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                <Input
                  value={group.name}
                  onChange={(e) => renameGroup(group.id, e.target.value)}
                  style={{ maxWidth: 220 }}
                />
                <span style={{ fontSize: 12, color: token.colorTextTertiary }}>{group.links.length} 个链接</span>
                <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                  <Button size="small" icon={<Plus size={12} />} onClick={() => addLink(group.id)}>链接</Button>
                  <Popconfirm title="删除该分组？" onConfirm={() => removeGroup(group.id)}>
                    <Button size="small" danger icon={<Trash2 size={12} />} />
                  </Popconfirm>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {group.links.map((link) => (
                  <div key={link.id} style={{ display: 'grid', gridTemplateColumns: '1fr 1.6fr 60px auto', gap: 6 }}>
                    <Input
                      size="small"
                      value={link.title}
                      placeholder="名称"
                      onChange={(e) => updateLink(group.id, link.id, { title: e.target.value })}
                    />
                    <Input
                      size="small"
                      value={link.url}
                      placeholder="https://..."
                      onChange={(e) => updateLink(group.id, link.id, { url: e.target.value })}
                    />
                    <Input
                      size="small"
                      value={link.emoji ?? ''}
                      placeholder="图标"
                      onChange={(e) => updateLink(group.id, link.id, { emoji: e.target.value })}
                    />
                    <Button size="small" danger icon={<Trash2 size={12} />} onClick={() => removeLink(group.id, link.id)} />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Field>

      <Field label="默认快捷组" hint="切换工作台中默认展示的快捷网站分组。">
        <Select
          value={speedDial?.activeGroupId ?? speedDial?.groups?.[0]?.id}
          options={(speedDial?.groups ?? []).map((group) => ({ value: group.id, label: group.name }))}
          onChange={(value) => void updateSettings({ speedDial: { ...(speedDial ?? {}), activeGroupId: value } })}
        />
      </Field>

      <Field label="纪念日 / 倒计时" hint="支持项目上线、生日、旅行、DDL 等场景。">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {(countdowns?.items ?? []).map((item) => (
            <div
              key={item.id}
              style={{
                display: 'grid',
                gridTemplateColumns: '1.2fr 1fr',
                gap: 8,
                padding: 10,
                borderRadius: token.borderRadiusLG,
                background: token.colorFillQuaternary,
                border: `1px solid ${token.colorBorderSecondary}`,
              }}
            >
              <Input
                value={item.title}
                onChange={(e) => {
                  const nextItems = (countdowns?.items ?? []).map((entry) => (entry.id === item.id ? { ...entry, title: e.target.value } : entry));
                  void updateSettings({ countdowns: { ...(countdowns ?? {}), items: nextItems } });
                }}
              />
              <Input
                value={item.targetDate}
                placeholder="YYYY-MM-DD"
                onChange={(e) => {
                  const nextItems = (countdowns?.items ?? []).map((entry) => (entry.id === item.id ? { ...entry, targetDate: e.target.value } : entry));
                  void updateSettings({ countdowns: { ...(countdowns ?? {}), items: nextItems } });
                }}
              />
            </div>
          ))}
          <Button
            icon={<Plus size={14} />}
            onClick={() => {
              const next = [...(countdowns?.items ?? []), { id: `countdown-${Date.now()}`, title: '新的纪念日', targetDate: '2026-12-31', emoji: '🎉' }];
              void updateSettings({ countdowns: { ...(countdowns ?? {}), items: next } });
            }}
          >
            新增倒计时
          </Button>
        </div>
      </Field>

      <Field label="距离下班" hint="打工人必备：每天自动显示离下班还有多久。">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <Input
            value={workCountdown?.workdayEnd ?? '18:30'}
            placeholder="18:30"
            onChange={(e) => void updateSettings({ workCountdown: { ...(workCountdown ?? {}), workdayEnd: e.target.value } })}
          />
          <Input
            value={workCountdown?.offLabel ?? '今天收工啦'}
            placeholder="今天收工啦"
            onChange={(e) => void updateSettings({ workCountdown: { ...(workCountdown ?? {}), offLabel: e.target.value } })}
          />
        </div>
      </Field>

      <Field label="番茄钟" hint="专注、短休、长休时长都可以按自己的节奏设置。">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
          <Select
            value={pomodoro?.focusMinutes ?? 25}
            options={[20, 25, 30, 45, 60].map((value) => ({ value, label: `专注 ${value}` }))}
            onChange={(value) => void updateSettings({ pomodoro: { ...(pomodoro ?? {}), focusMinutes: value } })}
          />
          <Select
            value={pomodoro?.shortBreakMinutes ?? 5}
            options={[5, 10, 15].map((value) => ({ value, label: `短休 ${value}` }))}
            onChange={(value) => void updateSettings({ pomodoro: { ...(pomodoro ?? {}), shortBreakMinutes: value } })}
          />
          <Select
            value={pomodoro?.longBreakMinutes ?? 15}
            options={[15, 20, 30].map((value) => ({ value, label: `长休 ${value}` }))}
            onChange={(value) => void updateSettings({ pomodoro: { ...(pomodoro ?? {}), longBreakMinutes: value } })}
          />
        </div>
        <Button
          icon={<TimerReset size={14} />}
          style={{ marginTop: 8 }}
          onClick={() => {
            void updateSettings({ pomodoro: { ...(pomodoro ?? {}), focusMinutes: 25, shortBreakMinutes: 5, longBreakMinutes: 15 } });
            feedback.success('番茄钟已恢复默认值');
          }}
        >
          恢复默认番茄钟
        </Button>
      </Field>
    </div>
  );
}
