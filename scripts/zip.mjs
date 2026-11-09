// Zip archives without a dependency: zip() writes the starter game for
// /sdk/v1/starter.zip, and unzip() reads games that developers upload.
import { crc32, inflateRawSync } from "node:zlib";

/**
 * A zip archive of `files` (name → contents), stored without compression.
 * The starter is a few kilobytes, so this keeps the build free of a zip
 * dependency.
 */
export function zip(files) {
  const local = [],
    central = [];
  let offset = 0;
  // 1980-01-01 00:00, so the zip is the same on every build.
  const time = 0,
    date = (0 << 9) | (1 << 5) | 1;
  for (const [name, contents] of Object.entries(files)) {
    const data = Buffer.from(contents);
    const fileName = Buffer.from(name, "utf8");
    const crc = crc32(data);
    const header = Buffer.alloc(30);
    header.writeUInt32LE(0x04034b50, 0);
    header.writeUInt16LE(20, 4); // version needed
    header.writeUInt16LE(0x0800, 6); // UTF-8 names
    header.writeUInt16LE(0, 8); // stored
    header.writeUInt16LE(time, 10);
    header.writeUInt16LE(date, 12);
    header.writeUInt32LE(crc, 14);
    header.writeUInt32LE(data.length, 18);
    header.writeUInt32LE(data.length, 22);
    header.writeUInt16LE(fileName.length, 26);
    header.writeUInt16LE(0, 28);
    local.push(header, fileName, data);

    const entry = Buffer.alloc(46);
    entry.writeUInt32LE(0x02014b50, 0);
    entry.writeUInt16LE(20, 4); // made by
    entry.writeUInt16LE(20, 6); // version needed
    entry.writeUInt16LE(0x0800, 8);
    entry.writeUInt16LE(0, 10);
    entry.writeUInt16LE(time, 12);
    entry.writeUInt16LE(date, 14);
    entry.writeUInt32LE(crc, 16);
    entry.writeUInt32LE(data.length, 20);
    entry.writeUInt32LE(data.length, 24);
    entry.writeUInt16LE(fileName.length, 28);
    entry.writeUInt32LE((0o100644 << 16) >>> 0, 38); // a regular, readable file
    entry.writeUInt32LE(offset, 42);
    central.push(entry, fileName);
    offset += header.length + fileName.length + data.length;
  }
  const directory = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  const count = Object.keys(files).length;
  end.writeUInt16LE(count, 8);
  end.writeUInt16LE(count, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...local, directory, end]);
}

export class ZipError extends Error {
  constructor(code, detail = "") {
    super(detail || code);
    this.code = code;
    this.detail = detail;
  }
}

/** Upload limits: a zipped game, its unpacked files and their count. */
export const ZIP_LIMITS = {
  maxZip: 20 * 1024 * 1024,
  maxTotal: 50 * 1024 * 1024,
  maxFile: 20 * 1024 * 1024,
  maxFiles: 1000,
};

/** Files a zip tool adds that are not part of the game. */
const junk = (name) =>
  name.startsWith("__MACOSX/") ||
  name.split("/").some((part) => part.startsWith(".")) ||
  /(^|\/)Thumbs\.db$/i.test(name);

/**
 * Reads a zip file into { "path/in/zip": Buffer }. Only stored and deflated
 * files, no encryption and no zip64. Every size is checked before and after
 * inflating, so a small zip cannot expand past the limits. Folders and the
 * extra files that zip tools add (__MACOSX/, .DS_Store) are left out.
 * Throws ZipError.
 */
export function unzip(buffer, limits = ZIP_LIMITS) {
  if (buffer.length > limits.maxZip) throw new ZipError("too-large");
  // The end of central directory record is in the last 64 KB + 22 bytes.
  let end = -1;
  for (let i = buffer.length - 22; i >= Math.max(0, buffer.length - 65558); i--)
    if (buffer.readUInt32LE(i) === 0x06054b50) {
      end = i;
      break;
    }
  if (end < 0) throw new ZipError("invalid-zip");
  const count = buffer.readUInt16LE(end + 10);
  const size = buffer.readUInt32LE(end + 12);
  let at = buffer.readUInt32LE(end + 16);
  if (count === 0xffff || at === 0xffffffff || at + size > end)
    throw new ZipError("invalid-zip");
  if (count > limits.maxFiles * 2) throw new ZipError("too-many-files");

  const files = {};
  let total = 0,
    kept = 0;
  for (let i = 0; i < count; i++) {
    if (at + 46 > end || buffer.readUInt32LE(at) !== 0x02014b50)
      throw new ZipError("invalid-zip");
    const flags = buffer.readUInt16LE(at + 8);
    const method = buffer.readUInt16LE(at + 10);
    const crc = buffer.readUInt32LE(at + 16);
    const packed = buffer.readUInt32LE(at + 20);
    const unpacked = buffer.readUInt32LE(at + 24);
    const nameLength = buffer.readUInt16LE(at + 28);
    const extraLength = buffer.readUInt16LE(at + 30);
    const commentLength = buffer.readUInt16LE(at + 32);
    const offset = buffer.readUInt32LE(at + 42);
    const name = buffer
      .toString("utf8", at + 46, at + 46 + nameLength)
      .replace(/\\/g, "/");
    at += 46 + nameLength + extraLength + commentLength;
    if (name.startsWith("/") || name.split("/").some((p) => p === ".."))
      throw new ZipError("bad-file", name);
    if (name.endsWith("/") || junk(name)) continue;
    if (flags & 1) throw new ZipError("encrypted");
    if (method !== 0 && method !== 8) throw new ZipError("unsupported-zip");
    if (Object.hasOwn(files, name)) throw new ZipError("bad-file", name);
    if (++kept > limits.maxFiles) throw new ZipError("too-many-files");
    if (unpacked > limits.maxFile) throw new ZipError("too-large", name);
    total += unpacked;
    if (total > limits.maxTotal) throw new ZipError("too-large");

    if (
      offset + 30 > buffer.length ||
      buffer.readUInt32LE(offset) !== 0x04034b50
    )
      throw new ZipError("invalid-zip");
    const start =
      offset +
      30 +
      buffer.readUInt16LE(offset + 26) +
      buffer.readUInt16LE(offset + 28);
    if (start + packed > buffer.length) throw new ZipError("invalid-zip");
    const raw = buffer.subarray(start, start + packed);
    let data;
    try {
      data =
        method === 0
          ? raw
          : inflateRawSync(raw, { maxOutputLength: Math.max(unpacked, 1) });
    } catch {
      throw new ZipError("invalid-zip", name);
    }
    if (data.length !== unpacked || crc32(data) !== crc)
      throw new ZipError("invalid-zip", name);
    files[name] = Buffer.from(data);
  }
  return files;
}
