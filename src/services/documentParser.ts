import * as mammoth from 'mammoth'
import * as XLSX from 'xlsx'

export type SupportedFileType = 'pdf' | 'docx' | 'xlsx' | 'xls' | 'txt' | 'csv'

export interface ParseOptions {
  signal?:     AbortSignal
  onProgress?: (p: { current: number; total: number; message: string }) => void
}

function checkAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    const e = new Error('Upload cancelled')
    e.name = 'UploadCancelledError'
    throw e
  }
}

export function getSupportedFileType(file: File): SupportedFileType | null {
  const name = file.name.toLowerCase()
  if (name.endsWith('.pdf'))                         return 'pdf'
  if (name.endsWith('.docx'))                        return 'docx'
  if (name.endsWith('.xlsx') || name.endsWith('.xls')) return 'xlsx'
  if (name.endsWith('.txt'))                         return 'txt'
  if (name.endsWith('.csv'))                         return 'csv'
  return null
}

export async function parsePdf(file: File, options: ParseOptions = {}): Promise<string> {
  const { signal, onProgress } = options

  const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs')

  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/legacy/build/pdf.worker.min.mjs',
    import.meta.url,
  ).toString()

  const arrayBuffer = await file.arrayBuffer()
  checkAborted(signal)

  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
  const pageTexts: string[] = []

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    checkAborted(signal)
    onProgress?.({ current: pageNum, total: pdf.numPages, message: `페이지 ${pageNum}/${pdf.numPages} 분석 중...` })

    const page = await pdf.getPage(pageNum)
    const content = await page.getTextContent()

    const pageText = content.items
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((item: any) => ('str' in item ? item.str : ''))
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim()

    if (pageText) pageTexts.push(pageText)
  }

  if (pageTexts.length === 0) {
    throw new Error('SCAN_PDF')
  }

  return pageTexts.join('\n\n').trim()
}

export async function parseDocx(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer()
  const result = await mammoth.extractRawText({ arrayBuffer })
  if (result.messages.length > 0) {
    console.warn('[documentParser] mammoth warnings:', result.messages)
  }
  return result.value.trim()
}

export async function parseXlsx(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer()
  const workbook = XLSX.read(arrayBuffer, { type: 'array' })

  const sections: string[] = []
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName]
    const csv = XLSX.utils.sheet_to_csv(sheet, { blankrows: false })
    if (csv.trim()) {
      sections.push(`[시트: ${sheetName}]\n${csv}`)
    }
  }

  return sections.join('\n\n').trim()
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function parseExcelWithContext(file: File): Promise<string[]> {
  const chunks: string[] = []

  const arrayBuffer = await file.arrayBuffer()
  const workbook = XLSX.read(arrayBuffer, { type: 'array' })

  for (const sheetName of workbook.SheetNames) {
    const worksheet = workbook.Sheets[sheetName]
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rows: any[][] = XLSX.utils.sheet_to_json(worksheet, {
      header: 1,
      defval: '',
    })

    if (rows.length < 3) continue

    // Row 1 = header, Row 2 = sub-header (skip), Row 3+ = data
    const headers = rows[0].map(String)
    const dataRows = rows.slice(2).filter(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (row: any[]) => row.some((cell: unknown) => String(cell).trim() !== '')
    )

    const ROWS_PER_CHUNK = 20
    for (let i = 0; i < dataRows.length; i += ROWS_PER_CHUNK) {
      const chunkRows = dataRows
        .slice(i, i + ROWS_PER_CHUNK)
        .filter(row => row.some((cell: unknown) => String(cell).trim() !== ''))

      if (chunkRows.length === 0) continue

      let chunkText = `[${sheetName}]\n`
      chunkText += `컬럼: ${headers.filter(h => h).join(' | ')}\n\n`

      for (const row of chunkRows) {
        const rowParts: string[] = []

        headers.forEach((header, idx) => {
          if (!header) return
          const value = String(row[idx] ?? '').trim()

          // Owner 컬럼은 빈값이어도 항상 포함 (SOC/COC 맥락 중요)
          if (header === 'Owner') {
            rowParts.push(`Owner: ${value || '-'}`)
            return
          }

          if (value !== '') {
            rowParts.push(`${header}: ${value}`)
          }
        })

        if (rowParts.length > 1) {
          chunkText += rowParts.join(' / ') + '\n'
        }
      }

      chunks.push(chunkText)
    }
  }

  return chunks
}

export async function parseTxt(file: File): Promise<string> {
  return await file.text()
}

export async function parseDocument(
  file: File,
  options: ParseOptions = {},
): Promise<{
  text:     string
  fileType: SupportedFileType
  chunks?:  string[]
} | null> {
  const fileType = getSupportedFileType(file)
  if (!fileType) return null

  checkAborted(options.signal)

  // Excel: contextual chunking (시트명 + 헤더 + Owner 보존)
  if (fileType === 'xlsx' || fileType === 'xls') {
    const chunks = await parseExcelWithContext(file)
    checkAborted(options.signal)
    return { text: '', fileType, chunks }
  }

  let text = ''
  switch (fileType) {
    case 'pdf':
      text = await parsePdf(file, options)
      break
    case 'docx':
      checkAborted(options.signal)
      text = await parseDocx(file)
      break
    case 'txt':
    case 'csv':
      checkAborted(options.signal)
      text = await parseTxt(file)
      break
  }

  checkAborted(options.signal)
  return { text: text.trim(), fileType }
}
