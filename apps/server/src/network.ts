import { networkInterfaces } from 'node:os';
export function lanAddresses(): string[] {
  return [...new Set(Object.values(networkInterfaces()).flatMap(entries =>
    (entries ?? []).filter(entry => entry.family === 'IPv4' && !entry.internal && !entry.address.startsWith('169.254.')).map(entry => entry.address)))].sort((a, b) => {
      const privateIP = (ip: string) => /^(192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/.test(ip);
      return Number(privateIP(b)) - Number(privateIP(a));
    });
}
export function isLoopback(address: string | undefined): boolean {
  return !!address && ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(address);
}
