/**
 * 配置预设系统
 *
 * 允许用户保存、加载、切换和删除配置预设，
 * 类似 VS Code 的 Settings Profile 功能。
 *
 * 预设存储在 chrome.storage.local 的应用命名空间 key 下。
 */

import type { UserSettings } from '@/shared/types';
import { storageGet, storageSet } from '@/chrome';
import { STORAGE_KEYS } from '@/shared/config/storage-keys';

/** 预设数据结构 */
export interface SettingsProfile {
  /** 预设唯一 ID */
  id: string;
  /** 预设名称 */
  name: string;
  /** 创建时间戳 */
  createdAt: number;
  /** 部分用户设置（仅保存差异项） */
  settings: Partial<UserSettings>;
}

/** 预设存储键名 */
const PROFILES_KEY = STORAGE_KEYS.profiles;

/**
 * 获取所有预设
 *
 * @returns 预设数组（按存储顺序）
 */
export async function getProfiles(): Promise<SettingsProfile[]> {
  const profiles = await storageGet<SettingsProfile[]>(PROFILES_KEY);
  return Array.isArray(profiles) ? profiles : [];
}

/**
 * 保存所有预设到存储
 *
 * @param profiles - 预设数组
 */
async function saveProfiles(profiles: SettingsProfile[]): Promise<void> {
  await storageSet(PROFILES_KEY, profiles);
}

/**
 * 创建新预设
 *
 * @param name     预设名称
 * @param settings 要保存的设置项（Partial）
 * @returns 新创建的预设对象
 */
export async function createProfile(name: string, settings: Partial<UserSettings>): Promise<SettingsProfile> {
  const { nanoid } = await import('nanoid');
  const profile: SettingsProfile = {
    id: nanoid(8),
    name,
    createdAt: Date.now(),
    settings,
  };
  const profiles = await getProfiles();
  profiles.push(profile);
  await saveProfiles(profiles);
  return profile;
}

/**
 * 更新预设名称
 *
 * @param id - 预设 ID
 * @param newName - 新名称
 */
export async function renameProfile(id: string, newName: string): Promise<void> {
  const profiles = await getProfiles();
  const target = profiles.find((p) => p.id === id);
  if (target) {
    target.name = newName;
    await saveProfiles(profiles);
  }
}

/**
 * 删除预设
 *
 * @param id - 预设 ID
 */
export async function deleteProfile(id: string): Promise<void> {
  const profiles = await getProfiles();
  const filtered = profiles.filter((p) => p.id !== id);
  await saveProfiles(filtered);
}


