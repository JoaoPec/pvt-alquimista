function emv(id: string, value: string) {
  return id + String(value.length).padStart(2, "0") + value;
}

function crc16Ccitt(payload: string) {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1;
    crc &= 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

function normalizeField(value: string, max: number) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().slice(0, max);
}

export function buildPixPayload(input: { key: string; name: string; city: string; amount?: number; txid?: string }) {
  const key = input.key.trim();
  if (!key) throw new Error("PIX_KEY_MISSING");
  const name = normalizeField(input.name || "PVT ALQUIMISTA", 25) || "PVT ALQUIMISTA";
  const city = normalizeField(input.city || "AREMBEPE", 15) || "AREMBEPE";
  const txid = (input.txid ?? "***").replace(/[^A-Za-z0-9]/g, "").slice(0, 25) || "***";
  const gui = emv("00", "br.gov.bcb.pix") + emv("01", key);
  let payload = emv("00", "01") + emv("26", gui) + emv("52", "0000") + emv("53", "986");
  if (input.amount && input.amount > 0) payload += emv("54", input.amount.toFixed(2));
  payload += emv("58", "BR") + emv("59", name) + emv("60", city) + emv("62", emv("05", txid)) + "6304";
  return payload + crc16Ccitt(payload);
}
