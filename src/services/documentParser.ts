import * as mammoth from 'mammoth'
import * as XLSX from 'xlsx'

export type SupportedFileType = 'pdf' | 'docx' | 'xlsx' | 'xls' | 'txt' | 'csv'

export function getSupportedFileType(file: File): SupportedFileType | null {
  const name = file.name.toLowerCase()
  if (name.endsWith('.pdf'))                         return 'pdf'
  if (name.endsWith('.docx'))                        return 'docx'
  if (name.endsWith('.xlsx') || name.endsWith('.xls')) return 'xlsx'
  if (name.endsWith('.txt'))                         return 'txt'
  if (name.endsWith('.csv'))                         return 'csv'
  return null
}

export async function parsePdf(file: File): Promise<string> {
  const pdfjsLib = await import('pdfjs-dist')

  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url,
  ).toString()

  const arrayBuffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise

  const pageTexts: string[] = []

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
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

export async function parseTxt(file: File): Promise<string> {
  return await file.text()
}

export async function parseDocument(file: File): Promise<{
  text: string
  fileType: SupportedFileType
} | null> {
  const fileType = getSupportedFileType(file)
  if (!fileType) return null

  let text = ''
  switch (fileType) {
    case 'pdf':
      text = await parsePdf(file)
      break
    case 'docx':
      text = await parseDocx(file)
      break
    case 'xlsx':
    case 'xls':
      text = await parseXlsx(file)
      break
    case 'txt':
    case 'csv':
      text = await parseTxt(file)
      break
  }

  return { text: text.trim(), fileType }
}
