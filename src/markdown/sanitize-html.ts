import { parseFragment, serialize, type DefaultTreeAdapterTypes } from 'parse5'

const FORBIDDEN_TAG_NAMES = new Set([
  'base',
  'button',
  'embed',
  'form',
  'frame',
  'iframe',
  'link',
  'meta',
  'object',
  'option',
  'script',
  'select',
  'textarea',
  'template',
])

const FORBIDDEN_ATTRIBUTE_NAMES = new Set(['autofocus', 'formaction', 'srcdoc'])
const URL_ATTRIBUTE_NAMES = new Set(['href', 'src', 'xlink:href'])
const ALLOWED_URL_PROTOCOLS = new Set(['http:', 'https:', 'mailto:', 'tel:'])
const SCHEME_PREFIX = /^[a-z][a-z0-9+.-]*:/i

type ParentNode = DefaultTreeAdapterTypes.ParentNode
type ElementNode =
  | DefaultTreeAdapterTypes.Element
  | DefaultTreeAdapterTypes.Template

export function sanitizeHTML(html: string): string {
  const fragment = parseFragment(html)
  sanitizeParent(fragment)
  return serialize(fragment)
}

function sanitizeParent(parent: ParentNode): void {
  for (const child of [...parent.childNodes]) {
    if (!isElementNode(child)) {
      continue
    }

    if (FORBIDDEN_TAG_NAMES.has(child.tagName)) {
      removeChild(parent, child)
      continue
    }

    if (child.tagName === 'input' && !shouldKeepInputElement(child)) {
      removeChild(parent, child)
      continue
    }

    sanitizeAttributes(child)
    sanitizeParent(child)
  }
}

function sanitizeAttributes(element: ElementNode): void {
  element.attrs = element.attrs.filter((attr) => {
    const name = attr.name.toLowerCase()

    if (name.startsWith('on') || FORBIDDEN_ATTRIBUTE_NAMES.has(name)) {
      return false
    }

    if (!URL_ATTRIBUTE_NAMES.has(name)) {
      return true
    }

    return isSafeUrl(attr.value, name, element.tagName)
  })
}

function isSafeUrl(
  value: string,
  attributeName: string,
  tagName: string,
): boolean {
  const trimmed = value.trim()

  if (!trimmed) {
    return false
  }

  if (
    trimmed.startsWith('#') ||
    trimmed.startsWith('/') ||
    trimmed.startsWith('./') ||
    trimmed.startsWith('../') ||
    trimmed.startsWith('?')
  ) {
    return true
  }

  const normalized = stripControlAndSpace(trimmed).toLowerCase()

  if (normalized.startsWith('data:')) {
    return (
      tagName === 'img' &&
      attributeName === 'src' &&
      normalized.startsWith('data:image/')
    )
  }

  if (!SCHEME_PREFIX.test(normalized)) {
    return true
  }

  try {
    const url = new URL(trimmed, 'http://pvmd.local')
    return ALLOWED_URL_PROTOCOLS.has(url.protocol)
  } catch {
    return false
  }
}

function isElementNode(
  node: DefaultTreeAdapterTypes.ChildNode,
): node is ElementNode {
  return 'tagName' in node
}

function shouldKeepInputElement(element: ElementNode): boolean {
  const type = getAttributeValue(element, 'type')?.toLowerCase()
  return type === 'checkbox' && hasAttribute(element, 'disabled')
}

function hasAttribute(element: ElementNode, attributeName: string): boolean {
  return element.attrs.some((attr) => attr.name.toLowerCase() === attributeName)
}

function getAttributeValue(
  element: ElementNode,
  attributeName: string,
): string | undefined {
  return element.attrs.find((attr) => attr.name.toLowerCase() === attributeName)
    ?.value
}

function removeChild(
  parent: ParentNode,
  child: DefaultTreeAdapterTypes.ChildNode,
): void {
  parent.childNodes = parent.childNodes.filter((node) => node !== child)

  if ('parentNode' in child) {
    child.parentNode = null
  }
}

function stripControlAndSpace(value: string): string {
  let result = ''

  for (const character of value) {
    const code = character.charCodeAt(0)
    if ((code >= 0x00 && code <= 0x20) || code === 0x7f) {
      continue
    }

    result += character
  }

  return result
}
