/**
 * AnimationSection — 动效与高级视觉实验
 *
 * 普通模式只暴露「减弱动效」这类可访问性能力；点击粒子和视频背景属于低频实验项，
 * 仅在 showAdvancedSettings 开启后显示，避免偏离 local-first / performance-first 定位。
 */

import { Button, Slider, Select, Upload } from "antd";
import { Image } from "lucide-react";
import { ICON_SIZE } from "@/shared/utils/icon-size";
import { useT } from "@/shared/i18n";
import { feedback } from "@/shared/ui/feedback";
import type { UserSettings } from "@/shared/types";
import { Field } from "@/features/settings/components/Field";

const MAX_VIDEO_BACKGROUND_FILE_BYTES = 50 * 1024 * 1024;

interface AnimationSectionProps {
  settings: UserSettings;
  updateSettings: (patch: Partial<UserSettings>) => void | Promise<void>;
}

export function AnimationSection({ settings, updateSettings }: AnimationSectionProps) {
  const { t } = useT();
  const advanced = settings.showAdvancedSettings === true;

  return (
    <>
      <section className="settings-section">
        <Field
          label={t("减弱动效")}
          hint={t("关闭过渡动画和 hover 效果，减少视觉干扰；对前庭功能障碍用户友好")}
        >
          <Select
            value={settings.reducedMotion ?? "auto"}
            onChange={(v) => {
              void updateSettings({ reducedMotion: v });
            }}
            className="settings-control-full"
            options={[
              { value: "auto", label: t("跟随系统") },
              { value: "on", label: t("始终减弱") },
              { value: "off", label: t("始终启用") },
            ]}
          />
        </Field>
      </section>

      {advanced && (
        <>
          <section className="settings-section">
            <Field
              label={t("点击动效")}
              hint={t(
                '高级视觉实验项，默认关闭。启用 "减弱动效" 或系统偏好 reduce motion 时自动禁用。',
              )}
            >
              <Select
                value={settings.clickEffect ?? "off"}
                onChange={(v) => {
                  void updateSettings({ clickEffect: v });
                }}
                className="settings-control-full"
                options={[
                  { value: "off", label: t("关闭") },
                  { value: "ripple", label: t("涟漪") },
                  { value: "sparkle", label: t("星光") },
                  { value: "confetti", label: t("彩纸") },
                  { value: "petal", label: t("樱花") },
                ]}
              />
            </Field>
          </section>

          <section className="settings-section">
            <Field
              label={t("本地视频背景")}
              hint={t(
                "高级视觉实验项。视频仅保存在本机浏览器内部，不使用第三方服务，但会占用额外内存与电量。",
              )}
            >
              <Select
                value={settings.videoBackground?.type === "file" ? "file" : "none"}
                onChange={(v) => {
                  void (async () => {
                    if (v === "none") {
                      const old = settings.videoBackground?.fileKey;
                      if (typeof old === "string" && old !== "") {
                        const { removeVideoFile } = await import("@/features/effects");
                        await removeVideoFile(old).catch(() => undefined);
                      }
                      void updateSettings({ videoBackground: { type: "none" } });
                      return;
                    }
                    void updateSettings({
                      videoBackground: { ...(settings.videoBackground ?? {}), type: "file" },
                    });
                  })();
                }}
                className="settings-control-full"
                options={[
                  { value: "none", label: t("不使用") },
                  { value: "file", label: t("本地文件") },
                ]}
              />
            </Field>
          </section>

          {settings.videoBackground?.type === "file" && (
            <section className="settings-section">
              <Field label={t("本地视频")} hint={t("保存在浏览器内部（OPFS），不会上传任何数据。")}>
                <Upload
                  accept="video/mp4,video/webm"
                  showUploadList={false}
                  beforeUpload={(file) => {
                    void (async () => {
                      if (file.size > MAX_VIDEO_BACKGROUND_FILE_BYTES) {
                        void feedback.warning(t("视频不能超过 50MB"));
                        return;
                      }
                      if (file.type !== "" && !["video/mp4", "video/webm"].includes(file.type)) {
                        void feedback.warning(t("请选择 MP4 或 WebM 视频"));
                        return;
                      }
                      const old = settings.videoBackground?.fileKey;
                      try {
                        const { saveBackgroundFile, removeBackgroundFile } =
                          await import("@/features/effects/background-storage");
                        if (typeof old === "string" && old !== "") {
                          await removeBackgroundFile(old).catch(() => undefined);
                        }
                        const key = await saveBackgroundFile(file);
                        void updateSettings({
                          videoBackground: {
                            ...(settings.videoBackground ?? {}),
                            type: "file",
                            fileKey: key,
                          },
                        });
                      } catch {
                        const { saveVideoFile, removeVideoFile } =
                          await import("@/features/effects");
                        if (typeof old === "string" && old !== "") {
                          await removeVideoFile(old).catch(() => undefined);
                        }
                        const key = await saveVideoFile(file);
                        void updateSettings({
                          videoBackground: {
                            ...(settings.videoBackground ?? {}),
                            type: "file",
                            fileKey: key,
                          },
                        });
                      }
                    })();
                    return false;
                  }}
                >
                  <Button icon={<Image size={ICON_SIZE.MEDIUM} />}>
                    {settings.videoBackground.fileKey !== undefined &&
                    settings.videoBackground.fileKey !== ""
                      ? t("更换视频文件")
                      : t("选择视频文件")}
                  </Button>
                </Upload>
              </Field>
            </section>
          )}

          {settings.videoBackground?.type === "file" && (
            <section className="settings-section">
              <Field label={t("播放速率")} hint={t("慢速播放（0.5×）更适合做背景氛围。")}>
                <Slider
                  min={0.25}
                  max={2}
                  step={0.25}
                  value={settings.videoBackground?.playbackRate ?? 1}
                  onChange={(v) =>
                    void updateSettings({
                      videoBackground: {
                        ...(settings.videoBackground ?? {}),
                        playbackRate: v,
                      },
                    })
                  }
                  marks={{ 0.5: "0.5×", 1: "1×", 1.5: "1.5×", 2: "2×" }}
                />
              </Field>
            </section>
          )}
        </>
      )}
    </>
  );
}
