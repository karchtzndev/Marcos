/**
 * Script de monitoramento de uptime para a Vercel
 * Verifica a disponibilidade da aplicação a cada 5 minutos
 */

const axios = require('axios');

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://marcos.vercel.app';
const CHECK_INTERVAL = 5 * 60 * 1000; // 5 minutos

async function checkUptime() {
  try {
    const response = await axios.get(APP_URL);
    console.log(`✅ ${new Date().toISOString()} - Uptime check passed. Status: ${response.status}`);
  } catch (error) {
    console.error(`❌ ${new Date().toISOString()} - Uptime check failed. Error: ${error.message}`);
  }
}

// Executa o check imediatamente e depois a cada intervalo
checkUptime();
setInterval(checkUptime, CHECK_INTERVAL);
