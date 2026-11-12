// Nitro-плагин: при cron-событии Cloudflare запускаем фото-бэкап.
// Nitro генерирует scheduled()-хендлер воркера, который пробрасывает событие
// в хук "cloudflare:scheduled" — здесь мы его слушаем.
//
// defineNitroPlugin недоступен в типах этого проекта, поэтому используем
// структурно совместимую сигнатуру: Nitro принимает любой default-export вида
// (nitroApp) => void как плагин.

type NitroAppLike = {
  hooks: {
    hook: (name: string, fn: (payload: unknown) => Promise<void> | void) => void;
  };
};

type ScheduledPayload = {
  controller: unknown;
  env: any;
  context: { waitUntil: (p: Promise<unknown>) => void };
};

export default function cronHook(nitroApp: NitroAppLike): void {
  nitroApp.hooks.hook("cloudflare:scheduled", async (raw: unknown) => {
    const payload = raw as Partial<ScheduledPayload>;
    try {
      const { runPhotoBackup } = await import("./photo-backup");
      const result = await runPhotoBackup(payload.env);
      console.log("[photo-backup] cron result:", JSON.stringify(result));
    } catch (e) {
      console.error("[photo-backup] cron failed", e);
    }
  });
}
