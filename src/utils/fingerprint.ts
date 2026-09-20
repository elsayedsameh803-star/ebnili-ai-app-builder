/**
 * Ebnili Device Fingerprinting & Anti-Abuse Protection System
 * Generates a resilient device identifier combining hardware properties,
 * canvas rendering signature, and persistent storage to prevent multi-account abuse.
 */

function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36);
}

function getCanvasSignature(): string {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 200;
    canvas.height = 50;
    const ctx = canvas.getContext('2d');
    if (!ctx) return 'no-canvas';

    ctx.textBaseline = 'top';
    ctx.font = "14px 'Arial', sans-serif";
    ctx.fillStyle = '#f43f5e';
    ctx.fillRect(10, 5, 80, 25);
    ctx.fillStyle = '#0f172a';
    ctx.fillText('Ebnili-Auth-2026', 15, 10);
    ctx.strokeStyle = '#f59e0b';
    ctx.strokeRect(5, 5, 120, 35);

    return simpleHash(canvas.toDataURL());
  } catch {
    return 'canvas-fallback';
  }
}

export interface ClientDeviceFingerprint {
  deviceId: string;
  fingerprintHash: string;
  screen: string;
  timezone: string;
  language: string;
  platform: string;
}

export function getDeviceFingerprint(): ClientDeviceFingerprint {
  let storedDeviceId = '';
  try {
    storedDeviceId = localStorage.getItem('ebnili_device_uuid') || '';
    if (!storedDeviceId) {
      storedDeviceId = 'dev_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 9);
      localStorage.setItem('ebnili_device_uuid', storedDeviceId);
      // Also set cookie
      document.cookie = `ebnili_dev_id=${storedDeviceId}; path=/; max-age=31536000; SameSite=Lax`;
    }
  } catch {
    storedDeviceId = 'dev_mem_' + Math.random().toString(36).substring(2, 9);
  }

  const screenStr = `${window.screen.width}x${window.screen.height}x${window.screen.colorDepth || 24}`;
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  const lang = navigator.language || 'ar';
  const platform = navigator.platform || 'unknown';
  const canvasSig = getCanvasSignature();

  const combinedRaw = [screenStr, tz, lang, platform, canvasSig].join('||');
  const fingerprintHash = 'fp_' + simpleHash(combinedRaw);

  return {
    deviceId: storedDeviceId,
    fingerprintHash,
    screen: screenStr,
    timezone: tz,
    language: lang,
    platform,
  };
}
