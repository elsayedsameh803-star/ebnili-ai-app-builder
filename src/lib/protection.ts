/**
 * Client → server device registration.
 *
 * WHY THIS FILE EXISTS
 * --------------------
 * The device registry on the server (`/api/protection/status`) upserts a row with
 * the fingerprint, screen, timezone, platform, user agent and IP — but NOTHING in
 * the UI ever called it. The endpoint was fully implemented and the table existed,
 * so `ebnily_devices` stayed empty and the owner's dashboard showed a permanent
 * 0 devices, with block / quota / tier buttons that had no row to act on.
 *
 * This is the missing caller. It runs after a successful sign-in, which is what
 * ties a device to an `account_email` rather than leaving an anonymous row.
 *
 * NEVER BLOCKS THE APP: a failure here is reported, not thrown. Losing the abuse
 * protection signal must never cost the visitor their session.
 */

/** What the server stores about one device. */
export interface DeviceStatus {
  success: boolean;
  code?: string;
  configured?: boolean;
  deviceId: string | null;
  isBlocked: boolean;
  blockReason?: string;
  freeGenerationsUsed: number;
  freeGenerationsLimit: number;
  tier?: 'free' | 'pro' | 'business';
}

/**
 * Register this device and fetch its block/quota state.
 *
 * @returns the server's answer, or `null` when the call could not be completed.
 */
export async function registerDevice(): Promise<DeviceStatus | null> {
  // Imported lazily so this module can be used from a test without a DOM.
  const { getDeviceFingerprint } = await import('../utils/fingerprint');
  const fp = getDeviceFingerprint();

  const params = new URLSearchParams({
    deviceId: fp.deviceId,
    fingerprintHash: fp.fingerprintHash,
    screen: fp.screen,
    timezone: fp.timezone || '',
    platform: fp.platform,
  });

  try {
    const res = await fetch(`/api/protection/status?${params.toString()}`, {
      credentials: 'include',
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const data = (await res.json()) as Partial<DeviceStatus>;
    if (!data || typeof data !== 'object') return null;
    // A `success: false` answer still carries a usable `isBlocked`, so hand the
    // caller the normalised object rather than dropping the whole response.
    return {
      success: data.success === true,
      code: data.code,
      configured: data.configured === true,
      deviceId: typeof data.deviceId === 'string' ? data.deviceId : null,
      isBlocked: data.isBlocked === true,
      blockReason: typeof data.blockReason === 'string' ? data.blockReason : undefined,
      freeGenerationsUsed: typeof data.freeGenerationsUsed === 'number' ? data.freeGenerationsUsed : 0,
      freeGenerationsLimit:
        typeof data.freeGenerationsLimit === 'number' ? data.freeGenerationsLimit : 5,
      tier: data.tier,
    };
  } catch {
    return null;
  }
}