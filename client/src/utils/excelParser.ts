/**
 * Parser Excel (.xlsx) native tanpa library eksternal.
 * Menggunakan Web API: FileReader + DecompressionStream (ZIP) + DOMParser (XML)
 * Mendukung format .xlsx (Office Open XML)
 */

export interface SiswaRow {
  noAbsen: number;
  stambuk: string;
  nama: string;
  kelas: string;
  daerah: string;
  rayon: string;
  token: string;
}

/** Generate token 6 karakter alfanumerik */
export const generateToken = (): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
};

/** Baca file sebagai ArrayBuffer */
const readFileAsArrayBuffer = (file: File): Promise<ArrayBuffer> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => resolve(e.target!.result as ArrayBuffer);
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });

/** Ekstrak file dari ZIP (format XLSX adalah ZIP) menggunakan DecompressionStream bila tersedia,
 *  atau fallback ke parsing binary manual untuk simple XML extraction */
async function extractZipEntry(buffer: ArrayBuffer, targetPath: string): Promise<string | null> {
  const bytes = new Uint8Array(buffer);
  const decoder = new TextDecoder('utf-8');

  // Scan ZIP local file headers (signature: PK\x03\x04)
  let i = 0;
  while (i < bytes.length - 4) {
    if (bytes[i] === 0x50 && bytes[i+1] === 0x4B && bytes[i+2] === 0x03 && bytes[i+3] === 0x04) {
      const compression = bytes[i+8] | (bytes[i+9] << 8);
      const compressedSize = bytes[i+18] | (bytes[i+19] << 8) | (bytes[i+20] << 16) | (bytes[i+21] << 24);
      const fileNameLen = bytes[i+26] | (bytes[i+27] << 8);
      const extraLen = bytes[i+28] | (bytes[i+29] << 8);
      const fileName = decoder.decode(bytes.slice(i+30, i+30+fileNameLen));
      const dataOffset = i + 30 + fileNameLen + extraLen;

      if (fileName === targetPath) {
        const compressedData = bytes.slice(dataOffset, dataOffset + compressedSize);
        if (compression === 0) {
          // Stored (no compression)
          return decoder.decode(compressedData);
        } else if (compression === 8) {
          // Deflate - use DecompressionStream
          try {
            const ds = new DecompressionStream('deflate-raw');
            const writer = ds.writable.getWriter();
            writer.write(compressedData);
            writer.close();
            const chunks: Uint8Array[] = [];
            const reader = ds.readable.getReader();
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              chunks.push(value);
            }
            const total = chunks.reduce((a, c) => a + c.length, 0);
            const result = new Uint8Array(total);
            let offset = 0;
            for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.length; }
            return decoder.decode(result);
          } catch {
            return null;
          }
        }
      }
      i = dataOffset + compressedSize;
    } else {
      i++;
    }
  }
  return null;
}

/** Konversi column reference Excel (A, B, AA...) ke index 0-based */
function colToIndex(col: string): number {
  let n = 0;
  for (const c of col) n = n * 26 + c.charCodeAt(0) - 64;
  return n - 1;
}

/** Parse XLSX file dan kembalikan rows sebagai array of string arrays */
export async function parseXlsx(file: File): Promise<string[][]> {
  const buffer = await readFileAsArrayBuffer(file);

  // Ambil shared strings
  const sharedStringsXml = await extractZipEntry(buffer, 'xl/sharedStrings.xml');
  const sharedStrings: string[] = [];
  if (sharedStringsXml) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(sharedStringsXml, 'application/xml');
    const siNodes = doc.getElementsByTagName('si');
    for (const si of Array.from(siNodes)) {
      const tNodes = si.getElementsByTagName('t');
      sharedStrings.push(Array.from(tNodes).map(t => t.textContent || '').join(''));
    }
  }

  // Ambil sheet pertama
  const sheetXml = await extractZipEntry(buffer, 'xl/worksheets/sheet1.xml');
  if (!sheetXml) throw new Error('Tidak dapat membaca sheet. Pastikan file format .xlsx (bukan .xls lama)');

  const parser = new DOMParser();
  const doc = parser.parseFromString(sheetXml, 'application/xml');
  const rows = doc.getElementsByTagName('row');

  const result: string[][] = [];
  for (const row of Array.from(rows)) {
    const cells = row.getElementsByTagName('c');
    const rowData: { col: number; val: string }[] = [];
    let maxCol = 0;

    for (const cell of Array.from(cells)) {
      const ref = cell.getAttribute('r') || '';
      const type = cell.getAttribute('t') || '';
      const colRef = ref.replace(/[0-9]/g, '');
      const colIdx = colToIndex(colRef);
      maxCol = Math.max(maxCol, colIdx);

      const vNode = cell.getElementsByTagName('v')[0];
      let value = vNode?.textContent || '';

      if (type === 's') {
        // Shared string
        value = sharedStrings[parseInt(value)] || '';
      } else if (type === 'str') {
        // Formula result
        const fNode = cell.getElementsByTagName('f')[0];
        value = fNode?.textContent || value;
      }

      rowData.push({ col: colIdx, val: value });
    }

    const arr = new Array(maxCol + 1).fill('');
    for (const { col, val } of rowData) arr[col] = val;
    if (arr.some(v => v !== '')) result.push(arr);
  }

  return result;
}

/** Parse baris Excel ke SiswaRow. Baris pertama diabaikan jika header */
export function rowsToSiswa(rows: string[][]): SiswaRow[] {
  if (rows.length === 0) throw new Error('File kosong');

  // Deteksi apakah baris pertama adalah header
  const firstRow = rows[0];
  const isHeader = isNaN(Number(firstRow[0])) && typeof firstRow[0] === 'string' && firstRow[0].length > 0;
  const dataRows = isHeader ? rows.slice(1) : rows;

  const siswa: SiswaRow[] = dataRows
    .filter(row => row[2]?.trim()) // minimal ada nama
    .map(row => ({
      noAbsen: parseInt(row[0]) || 0,
      stambuk: row[1]?.trim() || '',
      nama: row[2]?.trim() || '',
      kelas: row[3]?.trim() || '',
      daerah: row[4]?.trim() || '',
      rayon: row[5]?.trim() || '',
      token: generateToken(),
    }))
    .filter(s => s.noAbsen > 0 && s.nama);

  if (siswa.length === 0) {
    throw new Error('Tidak ada data valid. Pastikan format kolom: No Absen | Stambuk | Nama | Kelas | Daerah | Rayon');
  }

  return siswa;
}
