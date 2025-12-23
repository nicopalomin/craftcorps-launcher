import MD5 from 'crypto-js/md5';

export function getOfflineUUID(username) {
    const input = "OfflinePlayer:" + username;
    const hash = MD5(input);
    let hex = hash.toString();

    // The UUID format is 32 hex digits (16 bytes)
    // 8-4-4-4-12
    // xxxxxxxx-xxxx-Mxxx-Nxxx-xxxxxxxxxxxx
    // M = Version (3 for MD5)
    // N = Variant (8, 9, a, or b)

    // In a hex string (0-indexed chars):
    // TimeLow: 0-7 (8 chars)
    // TimeMid: 8-11 (4 chars)
    // TimeHighAndVersion: 12-15 (4 chars) -> Index 12 is M
    // ClockSeqHiAndReserved: 16-19 (4 chars) -> Index 16 is N
    // Node: 20-31 (12 chars)

    const chars = hex.split('');

    // Set Version to 3 (UUID v3)
    // The 13th character (index 12) must be '3'
    chars[12] = '3';

    // Set Variant to RFC 4122 (10xx binary)
    // The 17th character (index 16) must be 8, 9, a, or b.
    // We take the existing hex digit, parse it to int, mask it: (val & 0x3) | 0x8
    // Wait, standard way for variant 1 (RFC4122) is to set top 2 bits to 10.
    // So (byte & 0x3f) | 0x80.
    // Hex digit is half a byte (nibble).
    // The char at index 16 corresponds to the high nibble of byte 8.
    // So we need to treat that hex digit 'x' as 0bXXXX
    // We want 0b10XX.
    // So (x & 0x3) | 0x8.  (0x3 is 0011, 0x8 is 1000).
    // Example: if x is 'f' (1111), (1111 & 0011) | 1000 = 0011 | 1000 = 1011 = 'b'.
    // Example: if x is '0' (0000), (0000 & 0011) | 1000 = 0000 | 1000 = 1000 = '8'.
    const currentVariantChar = parseInt(chars[16], 16);
    const newVariantChar = (currentVariantChar & 0x3) | 0x8;
    chars[16] = newVariantChar.toString(16);

    // Reassemble with dashes
    const p1 = chars.slice(0, 8).join('');
    const p2 = chars.slice(8, 12).join('');
    const p3 = chars.slice(12, 16).join('');
    const p4 = chars.slice(16, 20).join('');
    const p5 = chars.slice(20, 32).join('');

    return `${p1}-${p2}-${p3}-${p4}-${p5}`;
}
