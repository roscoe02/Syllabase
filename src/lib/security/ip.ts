/** True for any address our server must not fetch: loopback, private, link-local, metadata, multicast. */
export function isPrivateIp(ip: string): boolean {
  if (ip.includes(":")) {
    const v6 = ip.toLowerCase();
    // IPv4-mapped, in either form: URL parsing turns [::ffff:127.0.0.1] into ::ffff:7f00:1.
    const mapped = v6.match(/^::ffff:(?:(\d+\.\d+\.\d+\.\d+)|([0-9a-f]{1,4}):([0-9a-f]{1,4}))$/);
    if (mapped) {
      if (mapped[1]) return isPrivateIp(mapped[1]);
      const [hi, lo] = [parseInt(mapped[2], 16), parseInt(mapped[3], 16)];
      return isPrivateIp(`${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`);
    }
    // Only global unicast (2000::/3) is public. This also rejects ::1, ::, fc00::/7, fe80::/10,
    // multicast, NAT64 and the deprecated IPv4-compatible forms.
    return !/^[23][0-9a-f]{3}:/.test(v6);
  }
  const [a, b] = ip.split(".").map(Number);
  return (
    a === 0 || a === 10 || a === 127 ||
    (a === 100 && b >= 64 && b <= 127) || // carrier-grade NAT
    (a === 169 && b === 254) || // link-local, cloud metadata
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    a >= 224 // multicast and reserved
  );
}
