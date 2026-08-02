import type { ZipEntry } from "./types";

const CRC_TABLE = buildCrcTable();

function buildCrcTable(): Uint32Array {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
}

export function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc = (CRC_TABLE[(crc ^ byte) & 0xff] ?? 0) ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

class ByteWriter {
  private chunks: Uint8Array[] = [];
  private scratch = new DataView(new ArrayBuffer(8));
  length = 0;

  u16(value: number): void {
    this.scratch.setUint16(0, value, true);
    this.push(new Uint8Array(this.scratch.buffer.slice(0, 2)));
  }

  u32(value: number): void {
    this.scratch.setUint32(0, value >>> 0, true);
    this.push(new Uint8Array(this.scratch.buffer.slice(0, 4)));
  }

  push(bytes: Uint8Array): void {
    this.chunks.push(bytes);
    this.length += bytes.length;
  }

  concat(): Uint8Array {
    const out = new Uint8Array(this.length);
    let offset = 0;
    for (const chunk of this.chunks) {
      out.set(chunk, offset);
      offset += chunk.length;
    }
    return out;
  }
}

export function buildZip(entries: ZipEntry[]): Uint8Array {
  const writer = new ByteWriter();
  const encoder = new TextEncoder();
  const central: { nameBytes: Uint8Array; crc: number; size: number; offset: number }[] = [];

  for (const entry of entries) {
    const nameBytes = encoder.encode(entry.name);
    const crc = crc32(entry.data);
    const offset = writer.length;
    writer.u32(0x04034b50);
    writer.u16(20);
    writer.u16(0x0800);
    writer.u16(0);
    writer.u16(0);
    writer.u16(0);
    writer.u32(crc);
    writer.u32(entry.data.length);
    writer.u32(entry.data.length);
    writer.u16(nameBytes.length);
    writer.u16(0);
    writer.push(nameBytes);
    writer.push(entry.data);
    central.push({ nameBytes, crc, size: entry.data.length, offset });
  }

  const centralStart = writer.length;
  for (const record of central) {
    writer.u32(0x02014b50);
    writer.u16(20);
    writer.u16(20);
    writer.u16(0x0800);
    writer.u16(0);
    writer.u16(0);
    writer.u16(0);
    writer.u32(record.crc);
    writer.u32(record.size);
    writer.u32(record.size);
    writer.u16(record.nameBytes.length);
    writer.u16(0);
    writer.u16(0);
    writer.u16(0);
    writer.u16(0);
    writer.u32(0);
    writer.u32(record.offset);
    writer.push(record.nameBytes);
  }
  const centralSize = writer.length - centralStart;

  writer.u32(0x06054b50);
  writer.u16(0);
  writer.u16(0);
  writer.u16(central.length);
  writer.u16(central.length);
  writer.u32(centralSize);
  writer.u32(centralStart);
  writer.u16(0);

  return writer.concat();
}
