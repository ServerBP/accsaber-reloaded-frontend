import DOMPurify from 'dompurify'

const ALLOWED_TAGS = [
  'b',
  'i',
  'u',
  'em',
  'strong',
  's',
  'sub',
  'sup',
  'code',
  'small',
  'p',
  'div',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'ul',
  'ol',
  'li',
  'blockquote',
  'pre',
  'hr',
  'span',
  'a',
  'br',
]

const ALLOWED_ATTR = ['style', 'class', 'href', 'target', 'rel']

export function sanitizeRichHtml(html: string | null | undefined): string {
  return DOMPurify.sanitize(html ?? '', {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ADD_ATTR: ['target', 'rel'],
  })
}
