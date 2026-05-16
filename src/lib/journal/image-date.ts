/**
 * Read the date a photo was taken from its EXIF metadata. Returns a local
 * YYYY-MM-DD string (EXIF dates are wall-clock with no timezone) or null when
 * the file carries no usable date — e.g. a screenshot or a PNG.
 *
 * Handles both JPEG (EXIF in an APP1 segment) and HEIC/HEIF (EXIF in an item
 * inside the ISO-container `meta` box), so iPhone photos work in either format.
 */
export async function readImageDateTaken(file: File): Promise<string | null> {
  try {
    const head = await file.slice(0, 4).arrayBuffer();
    const sig = new DataView(head);
    if (sig.byteLength < 4) return null;

    if (sig.getUint16(0) === 0xffd8) return readJpegDate(file);

    // ISO base media files (HEIC/HEIF) lead with a `ftyp` box: a 4-byte size
    // followed by the type tag, so the tag sits at byte 4.
    const tag = await file.slice(4, 8).arrayBuffer();
    if (boxType(new DataView(tag), 0) === "ftyp") return readHeicDate(file);

    return null;
  } catch {
    return null;
  }
}

async function readJpegDate(file: File): Promise<string | null> {
  // EXIF lives in the first APP1 segment; 256KB is far more than enough.
  const buf = await file.slice(0, 256 * 1024).arrayBuffer();
  const view = new DataView(buf);
  const len = view.byteLength;

  let offset = 2;
  while (offset + 4 <= len) {
    if (view.getUint8(offset) !== 0xff) break;
    const marker = view.getUint8(offset + 1);
    // Standalone markers carry no length field.
    if (marker === 0xd8 || marker === 0xd9 || (marker >= 0xd0 && marker <= 0xd7)) {
      offset += 2;
      continue;
    }
    if (marker === 0xda) break; // start of scan — image data follows
    const segLen = view.getUint16(offset + 2);
    if (marker === 0xe1) {
      const p = offset + 4;
      if (
        p + 6 <= len &&
        view.getUint32(p) === 0x45786966 && // "Exif"
        view.getUint16(p + 4) === 0x0000
      ) {
        return parseExifDate(view, p + 6);
      }
    }
    offset += 2 + segLen;
  }
  return null;
}

async function readHeicDate(file: File): Promise<string | null> {
  // The `meta` box (with iinf/iloc) sits near the start; 128KB covers it.
  const headBuf = await file.slice(0, 128 * 1024).arrayBuffer();
  const head = new DataView(headBuf);

  const meta = findBox(head, 0, head.byteLength, "meta");
  if (!meta) return null;
  // `meta` is a FullBox: 4 bytes of version+flags precede its child boxes.
  const metaStart = meta.contentStart + 4;

  const iinf = findBox(head, metaStart, meta.end, "iinf");
  const iloc = findBox(head, metaStart, meta.end, "iloc");
  if (!iinf || !iloc) return null;

  const exifItemId = findExifItemId(head, iinf);
  if (exifItemId == null) return null;

  const loc = findItemLocation(head, iloc, exifItemId);
  if (!loc || loc.length < 4) return null;

  // Read just the Exif item's bytes — it can sit anywhere in the file.
  const payloadBuf = await file
    .slice(loc.offset, loc.offset + loc.length)
    .arrayBuffer();
  const payload = new DataView(payloadBuf);
  if (payload.byteLength < 8) return null;

  // The item starts with a 4-byte offset from the end of that field to the
  // TIFF header (it skips the "Exif\0\0" prefix).
  const tiff = 4 + payload.getUint32(0);
  if (tiff + 8 > payload.byteLength) return null;
  return parseExifDate(payload, tiff);
}

// ---- ISO base media file (HEIC) box helpers --------------------------------

type Box = { contentStart: number; end: number };

function boxType(view: DataView, o: number): string {
  return String.fromCharCode(
    view.getUint8(o),
    view.getUint8(o + 1),
    view.getUint8(o + 2),
    view.getUint8(o + 3)
  );
}

function findBox(
  view: DataView,
  start: number,
  end: number,
  type: string
): Box | null {
  let o = start;
  while (o + 8 <= end) {
    let size = view.getUint32(o);
    let header = 8;
    if (size === 1) {
      // 64-bit size — the high word is always 0 for files we'd see here.
      size = view.getUint32(o + 8) * 2 ** 32 + view.getUint32(o + 12);
      header = 16;
    } else if (size === 0) {
      size = end - o; // box runs to the end of its parent
    }
    if (size < header || o + size > end + 8) break;
    if (boxType(view, o + 4) === type) {
      return { contentStart: o + header, end: o + size };
    }
    o += size;
  }
  return null;
}

function findExifItemId(view: DataView, iinf: Box): number | null {
  // `iinf` is a FullBox; its `infe` children follow the version/flags and an
  // entry count. We just scan every child box for an `infe` of type "Exif".
  const version = view.getUint8(iinf.contentStart);
  let o = iinf.contentStart + 4 + (version === 0 ? 2 : 4);

  while (o + 8 <= iinf.end) {
    const size = view.getUint32(o);
    if (size < 8) break;
    if (boxType(view, o + 4) === "infe") {
      const id = readInfeExifId(view, o + 8);
      if (id != null) return id;
    }
    o += size;
  }
  return null;
}

function readInfeExifId(view: DataView, contentStart: number): number | null {
  // `infe` is a FullBox. Only versions 2/3 carry the 4-char item_type.
  const version = view.getUint8(contentStart);
  let o = contentStart + 4;
  let itemId: number;
  if (version === 2) {
    itemId = view.getUint16(o);
    o += 2;
  } else if (version === 3) {
    itemId = view.getUint32(o);
    o += 4;
  } else {
    return null;
  }
  o += 2; // item_protection_index
  return boxType(view, o) === "Exif" ? itemId : null;
}

function findItemLocation(
  view: DataView,
  iloc: Box,
  wantId: number
): { offset: number; length: number } | null {
  let o = iloc.contentStart;
  const version = view.getUint8(o);
  o += 4; // version + flags

  const sizes = view.getUint8(o);
  const idx = view.getUint8(o + 1);
  o += 2;
  const offsetSize = sizes >> 4;
  const lengthSize = sizes & 0x0f;
  const baseOffsetSize = idx >> 4;
  const indexSize = version >= 1 ? idx & 0x0f : 0;

  let itemCount: number;
  if (version < 2) {
    itemCount = view.getUint16(o);
    o += 2;
  } else {
    itemCount = view.getUint32(o);
    o += 4;
  }

  const readUint = (n: number): number => {
    let v = 0;
    for (let i = 0; i < n; i++) v = v * 256 + view.getUint8(o + i);
    o += n;
    return v;
  };

  for (let i = 0; i < itemCount; i++) {
    let itemId: number;
    if (version < 2) {
      itemId = view.getUint16(o);
      o += 2;
    } else {
      itemId = view.getUint32(o);
      o += 4;
    }
    if (version === 1 || version === 2) o += 2; // construction_method
    o += 2; // data_reference_index
    const baseOffset = readUint(baseOffsetSize);
    const extentCount = view.getUint16(o);
    o += 2;

    let location: { offset: number; length: number } | null = null;
    for (let e = 0; e < extentCount; e++) {
      if (indexSize > 0) o += indexSize; // extent_index
      const extentOffset = readUint(offsetSize);
      const extentLength = readUint(lengthSize);
      if (e === 0) {
        location = { offset: baseOffset + extentOffset, length: extentLength };
      }
    }
    if (itemId === wantId) return location;
  }
  return null;
}

// ---- TIFF / EXIF directory parsing -----------------------------------------

function parseExifDate(view: DataView, tiff: number): string | null {
  const le = view.getUint16(tiff) === 0x4949; // "II" little-endian
  const u16 = (o: number) => view.getUint16(o, le);
  const u32 = (o: number) => view.getUint32(o, le);

  if (u16(tiff + 2) !== 0x002a) return null;
  const ifd0 = tiff + u32(tiff + 4);

  const findTag = (ifd: number, tag: number): number | null => {
    const count = u16(ifd);
    for (let i = 0; i < count; i++) {
      const entry = ifd + 2 + i * 12;
      if (u16(entry) === tag) return entry;
    }
    return null;
  };

  const readAscii = (entry: number): string | null => {
    const count = u32(entry + 4);
    const at = count <= 4 ? entry + 8 : tiff + u32(entry + 8);
    let s = "";
    for (let i = 0; i < count; i++) {
      const c = view.getUint8(at + i);
      if (c === 0) break;
      s += String.fromCharCode(c);
    }
    return s || null;
  };

  let dateStr: string | null = null;
  const exifPtr = findTag(ifd0, 0x8769); // Exif SubIFD pointer
  if (exifPtr) {
    const subIfd = tiff + u32(exifPtr + 8);
    const dto = findTag(subIfd, 0x9003); // DateTimeOriginal
    if (dto) dateStr = readAscii(dto);
  }
  if (!dateStr) {
    const dt = findTag(ifd0, 0x0132); // DateTime
    if (dt) dateStr = readAscii(dt);
  }
  if (!dateStr) return null;

  // EXIF dates look like "YYYY:MM:DD HH:MM:SS".
  const m = dateStr.match(/^(\d{4}):(\d{2}):(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}
