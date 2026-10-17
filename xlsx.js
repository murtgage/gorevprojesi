/* ============================================================
   xlsx.js — bağımlılıksız minimal .xlsx üretici
   XLSX = ZIP (store) + birkaç XML parçası.
   Kütüphane yok, tarayıcıda çalışır, Excel/LibreOffice uyumlu.
   ============================================================ */

(function (global) {
  'use strict';

  /* ---------- ZIP ---------- */

  const CRC_TABLE = (() => {
    const table = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[i] = c >>> 0;
    }
    return table;
  })();

  function crc32(bytes) {
    let crc = 0xffffffff;
    for (let i = 0; i < bytes.length; i++) crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
    return (crc ^ 0xffffffff) >>> 0;
  }

  function concat(parts) {
    let total = 0;
    for (const p of parts) total += p.length;
    const out = new Uint8Array(total);
    let offset = 0;
    for (const p of parts) {
      out.set(p, offset);
      offset += p.length;
    }
    return out;
  }

  function zipStore(files) {
    const enc = new TextEncoder();
    const now = new Date();
    const time = ((now.getHours() & 31) << 11) | ((now.getMinutes() & 63) << 5) | ((now.getSeconds() / 2) & 31);
    const date = (((now.getFullYear() - 1980) & 127) << 9) | (((now.getMonth() + 1) & 15) << 5) | (now.getDate() & 31);

    const localParts = [];
    const centralParts = [];
    let offset = 0;

    for (const file of files) {
      const nameBytes = enc.encode(file.name);
      const data = file.data;
      const crc = crc32(data);

      const local = new Uint8Array(30 + nameBytes.length);
      const lv = new DataView(local.buffer);
      lv.setUint32(0, 0x04034b50, true); // local file header
      lv.setUint16(4, 20, true); // version needed
      lv.setUint16(6, 0x0800, true); // UTF-8 dosya adı
      lv.setUint16(8, 0, true); // method: store
      lv.setUint16(10, time & 0xffff, true);
      lv.setUint16(12, date & 0xffff, true);
      lv.setUint32(14, crc, true);
      lv.setUint32(18, data.length, true);
      lv.setUint32(22, data.length, true);
      lv.setUint16(26, nameBytes.length, true);
      lv.setUint16(28, 0, true);
      local.set(nameBytes, 30);

      localParts.push(local, data);

      const central = new Uint8Array(46 + nameBytes.length);
      const cv = new DataView(central.buffer);
      cv.setUint32(0, 0x02014b50, true); // central directory header
      cv.setUint16(4, 20, true); // version made by
      cv.setUint16(6, 20, true); // version needed
      cv.setUint16(8, 0x0800, true);
      cv.setUint16(10, 0, true);
      cv.setUint16(12, time & 0xffff, true);
      cv.setUint16(14, date & 0xffff, true);
      cv.setUint32(16, crc, true);
      cv.setUint32(20, data.length, true);
      cv.setUint32(24, data.length, true);
      cv.setUint16(28, nameBytes.length, true);
      cv.setUint16(30, 0, true);
      cv.setUint16(32, 0, true);
      cv.setUint16(34, 0, true);
      cv.setUint16(36, 0, true);
      cv.setUint32(38, 0, true);
      cv.setUint32(42, offset, true);
      central.set(nameBytes, 46);
      centralParts.push(central);

      offset += local.length + data.length;
    }

    const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
    const end = new Uint8Array(22);
    const ev = new DataView(end.buffer);
    ev.setUint32(0, 0x06054b50, true); // end of central directory
    ev.setUint16(8, files.length, true);
    ev.setUint16(10, files.length, true);
    ev.setUint32(12, centralSize, true);
    ev.setUint32(16, offset, true);

    return concat([...localParts, ...centralParts, end]);
  }

  /* ---------- XML yardımcıları ---------- */

  const enc = new TextEncoder();

  const xmlEsc = (value) =>
    String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;')
      // XML 1.0'da geçersiz kontrol karakterlerini at
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');

  function colName(index) {
    let name = '';
    let n = index + 1;
    while (n > 0) {
      const rem = (n - 1) % 26;
      name = String.fromCharCode(65 + rem) + name;
      n = Math.floor((n - 1) / 26);
    }
    return name;
  }

  /* Excel tarihleri 1900 sistemine göre seri sayıdır (30.12.1899 = 0). */
  function toSerial(value) {
    const match = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?$/.exec(String(value).trim());
    if (!match) return null;
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const hour = Number(match[4] || 0);
    const minute = Number(match[5] || 0);
    const days = (Date.UTC(year, month - 1, day) - Date.UTC(1899, 11, 30)) / 86400000;
    return days + (hour * 60 + minute) / 1440;
  }

  function cellXml(ref, value, type, style) {
    if (value === null || value === undefined || value === '') return '';

    const s = style ? ` s="${style}"` : '';

    if (type === 'date' || type === 'datetime') {
      const serial = toSerial(value);
      if (serial !== null) return `<c r="${ref}"${s}><v>${Number(serial.toFixed(10))}</v></c>`;
      // tarih değilse metin olarak yaz
      return `<c r="${ref}" t="inlineStr"><is><t>${xmlEsc(value)}</t></is></c>`;
    }

    if (type === 'number' && !Number.isNaN(Number(value))) {
      return `<c r="${ref}"${s}><v>${Number(value)}</v></c>`;
    }

    return `<c r="${ref}"${s} t="inlineStr"><is><t xml:space="preserve">${xmlEsc(value)}</t></is></c>`;
  }

  /* ---------- Parçalar ---------- */

  const STYLES_XML =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    '<numFmts count="2">' +
    '<numFmt numFmtId="164" formatCode="dd.mm.yyyy"/>' +
    '<numFmt numFmtId="165" formatCode="dd.mm.yyyy hh:mm"/>' +
    '</numFmts>' +
    '<fonts count="2">' +
    '<font><sz val="11"/><name val="Calibri"/><family val="2"/></font>' +
    '<font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/><family val="2"/></font>' +
    '</fonts>' +
    '<fills count="3">' +
    '<fill><patternFill patternType="none"/></fill>' +
    '<fill><patternFill patternType="gray125"/></fill>' +
    '<fill><patternFill patternType="solid"><fgColor rgb="FF6366F1"/><bgColor indexed="64"/></patternFill></fill>' +
    '</fills>' +
    '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
    '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
    '<cellXfs count="4">' +
    '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
    '<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment vertical="center"/></xf>' +
    '<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>' +
    '<xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>' +
    '</cellXfs>' +
    '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
    '</styleSheet>';

  const CONTENT_TYPES =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="xml" ContentType="application/xml"/>' +
    '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
    '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
    '</Types>';

  const ROOT_RELS =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
    '</Relationships>';

  function sheetXml(sheet) {
    const columns = sheet.columns || [];
    const rows = sheet.rows || [];
    const lastCol = colName(Math.max(columns.length - 1, 0));
    const lastRow = rows.length + 1;

    const cols = columns
      .map(
        (column, index) =>
          `<col min="${index + 1}" max="${index + 1}" width="${column.width || 16}" customWidth="1"/>`,
      )
      .join('');

    const headerCells = columns
      .map((column, index) => cellXml(colName(index) + '1', column.header, 'string', 1))
      .join('');

    const bodyRows = rows
      .map((row, rowIndex) => {
        const rowNumber = rowIndex + 2;
        const cells = row
          .map((value, colIndex) => {
            const column = columns[colIndex] || {};
            const type = column.type || 'string';
            const style = type === 'date' ? 2 : type === 'datetime' ? 3 : 0;
            return cellXml(colName(colIndex) + rowNumber, value, type, style);
          })
          .join('');
        return `<row r="${rowNumber}">${cells}</row>`;
      })
      .join('');

    return (
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
      `<dimension ref="A1:${lastCol}${lastRow}"/>` +
      '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>' +
      '<sheetFormatPr defaultRowHeight="15"/>' +
      `<cols>${cols}</cols>` +
      `<sheetData><row r="1" ht="22" customHeight="1">${headerCells}</row>${bodyRows}</sheetData>` +
      `<autoFilter ref="A1:${lastCol}${lastRow}"/>` +
      '</worksheet>'
    );
  }

  function workbookXml(sheets) {
    const entries = sheets
      .map((sheet, index) => {
        const name = xmlEsc(String(sheet.name || 'Sayfa' + (index + 1)).slice(0, 31));
        return `<sheet name="${name}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`;
      })
      .join('');

    return (
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ' +
      'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
      '<bookViews><workbookView activeTab="0"/></bookViews>' +
      `<sheets>${entries}</sheets>` +
      '</workbook>'
    );
  }

  function workbookRels(sheets) {
    const sheetRels = sheets
      .map(
        (_, index) =>
          `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`,
      )
      .join('');
    const styleId = sheets.length + 1;
    return (
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      sheetRels +
      `<Relationship Id="rId${styleId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>` +
      '</Relationships>'
    );
  }

  /* ---------- Dışa açılan API ---------- */

  /**
   * @param {Array<{name: string, columns: Array<{header: string, width?: number, type?: 'string'|'number'|'date'|'datetime'}>, rows: Array<Array<string|number>>}>} sheets
   * @returns {Blob} .xlsx dosyası
   */
  function create(sheets) {
    const list = Array.isArray(sheets) ? sheets : [sheets];

    const contentTypes =
      CONTENT_TYPES.replace(
        '</Types>',
        list
          .map(
            (_, index) =>
              `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`,
          )
          .join('') + '</Types>',
      );

    const files = [
      { name: '[Content_Types].xml', data: enc.encode(contentTypes) },
      { name: '_rels/.rels', data: enc.encode(ROOT_RELS) },
      { name: 'xl/workbook.xml', data: enc.encode(workbookXml(list)) },
      { name: 'xl/_rels/workbook.xml.rels', data: enc.encode(workbookRels(list)) },
      { name: 'xl/styles.xml', data: enc.encode(STYLES_XML) },
      ...list.map((sheet, index) => ({
        name: `xl/worksheets/sheet${index + 1}.xml`,
        data: enc.encode(sheetXml(sheet)),
      })),
    ];

    const bytes = zipStore(files);
    return new Blob([bytes], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
  }

  global.XLSX = { create };
})(window);
