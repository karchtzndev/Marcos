/**
 * Configuração padrão do Sentry para monitoramento de erros em tempo real
 * Projeto: omarkin-pwa-apps / Marcos
 */

export const sentryConfig = {
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN || "",
  tracesSampleRate: 1.0,
  environment: process.env.NODE_ENV || "development",
  enabled: process.env.NODE_ENV === "production",
};
