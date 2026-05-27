/**
 * workspace-template-repo — 工作区模板持久化仓库
 */

import { storageGet, storageSet } from "@/chrome";
import { STORAGE_KEYS } from "@/shared/config/storage-keys";
import type { WorkspaceTemplate, WorkspaceTemplateData } from "@/shared/types";

const EMPTY_DATA: WorkspaceTemplateData = { templates: [] };

export async function getWorkspaceTemplates(): Promise<WorkspaceTemplateData> {
  const data = await storageGet<WorkspaceTemplateData>(STORAGE_KEYS.workspaceTemplates);
  return data ?? EMPTY_DATA;
}

export async function saveWorkspaceTemplates(data: WorkspaceTemplateData): Promise<void> {
  await storageSet(STORAGE_KEYS.workspaceTemplates, data);
}

export async function addWorkspaceTemplate(template: WorkspaceTemplate): Promise<WorkspaceTemplateData> {
  const data = await getWorkspaceTemplates();
  data.templates.push(template);
  await saveWorkspaceTemplates(data);
  return data;
}

export async function updateWorkspaceTemplate(
  templateId: string,
  patch: Partial<Omit<WorkspaceTemplate, "id" | "createdAt">>,
): Promise<WorkspaceTemplateData> {
  const data = await getWorkspaceTemplates();
  const idx = data.templates.findIndex((t) => t.id === templateId);
  if (idx >= 0) {
    data.templates[idx] = { ...data.templates[idx]!, ...patch, updatedAt: Date.now() };
    await saveWorkspaceTemplates(data);
  }
  return data;
}

export async function deleteWorkspaceTemplate(templateId: string): Promise<WorkspaceTemplateData> {
  const data = await getWorkspaceTemplates();
  data.templates = data.templates.filter((t) => t.id !== templateId);
  await saveWorkspaceTemplates(data);
  return data;
}
