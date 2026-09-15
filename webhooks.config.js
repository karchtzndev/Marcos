/**
 * Configuração de webhooks para notificações automáticas
 * Projeto: omarkin-pwa-apps / Marcos
 */

export const webhooksConfig = {
  slack: {
    url: process.env.SLACK_WEBHOOK_URL || "",
    enabled: process.env.NODE_ENV === "production",
  },
  discord: {
    url: process.env.DISCORD_WEBHOOK_URL || "",
    enabled: process.env.NODE_ENV === "production",
  },
};
