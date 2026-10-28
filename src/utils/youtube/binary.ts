import { spawn, ChildProcessWithoutNullStreams } from 'child_process';

/**
 * Spawn yt-dlp with the shared args every call needs.
 * - YTDLP_BIN picks the binary (default: snap). Snap yt-dlp ships without the EJS
 *   challenge solver, so it fetches it from GitHub; the official yt-dlp_linux bundles it.
 * - YTDLP_PROXY routes every call through a proxy, e.g. Cloudflare WARP: socks5://127.0.0.1:40000.
 * Env is read per call so dotenv has loaded before first use.
 * @param {string[]} args - yt-dlp arguments
 * @return {ChildProcessWithoutNullStreams} yt-dlp process
 */
export function spawnYtdlp(args: string[]): ChildProcessWithoutNullStreams {
  const bin = process.env.YTDLP_BIN || '/snap/bin/yt-dlp';
  const shared: string[] = [];
  // ponytail: path heuristic, assumes anything under /snap/ lacks bundled EJS
  if (bin.startsWith('/snap/')) shared.push('--remote-components', 'ejs:github');
  if (process.env.YTDLP_PROXY) shared.push('--proxy', process.env.YTDLP_PROXY);
  return spawn(bin, [...shared, ...args]);
}
