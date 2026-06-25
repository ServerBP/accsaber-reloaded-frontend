export interface JsonSchema {
  type?: string | string[]
  enum?: unknown[]
  const?: unknown
  properties?: Record<string, JsonSchema>
  required?: string[]
  items?: JsonSchema
  oneOf?: JsonSchema[]
  anyOf?: JsonSchema[]
  additionalProperties?: boolean | JsonSchema
  minimum?: number
  maximum?: number
  minLength?: number
  maxLength?: number
  minItems?: number
  minProperties?: number
  description?: string
  title?: string
  [k: string]: unknown
}

const META_KEYS = new Set(['$schema', 'contractVersion'])

export function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

export function schemaType(schema: JsonSchema): string | undefined {
  const t = schema.type
  if (Array.isArray(t)) return t.find((x) => x !== 'null')
  return t
}

const COLOR_PROP_NAMES = new Set(['hex', 'color', 'colorhex', 'tint'])

export function isColorProp(name: string | undefined): boolean {
  if (!name) return false
  return COLOR_PROP_NAMES.has(name.toLowerCase())
}

export function isStringMap(schema: JsonSchema): boolean {
  if (schemaType(schema) !== 'object') return false
  const ap = schema.additionalProperties
  const apIsStringSchema = isObject(ap) && schemaType(ap as JsonSchema) === 'string'
  const hasFixedProps = !!schema.properties && Object.keys(schema.properties).length > 0
  return apIsStringSchema && !hasFixedProps
}

export interface UnionInfo {
  discriminator: string
  baseRequired: string[]
  variants: { const: string; schema: JsonSchema }[]
}

export function detectUnion(schema: JsonSchema): UnionInfo | null {
  const branches = schema.oneOf ?? schema.anyOf
  if (!Array.isArray(branches) || branches.length === 0) return null

  const counts: Record<string, number> = {}
  for (const branch of branches) {
    const props = branch.properties ?? {}
    for (const [key, sub] of Object.entries(props)) {
      if (isObject(sub) && 'const' in sub) counts[key] = (counts[key] ?? 0) + 1
    }
  }

  let discriminator: string | null = null
  let best = 0
  for (const [key, count] of Object.entries(counts)) {
    if (count > best) {
      best = count
      discriminator = key
    }
  }
  if (!discriminator) return null

  const variants = branches
    .map((branch) => {
      const disc = branch.properties?.[discriminator as string]
      if (!isObject(disc) || !('const' in disc)) return null
      return { const: String((disc as JsonSchema).const), schema: branch }
    })
    .filter((v): v is { const: string; schema: JsonSchema } => v !== null)

  if (variants.length === 0) return null
  return { discriminator, baseRequired: schema.required ?? [], variants }
}

export interface SchemaEntry {
  key: string
  schema: JsonSchema
  required: boolean
}

export function objectEntries(schema: JsonSchema): SchemaEntry[] {
  const props = schema.properties ?? {}
  const required = new Set(schema.required ?? [])
  return Object.entries(props)
    .filter(([key]) => !META_KEYS.has(key))
    .map(([key, sub]) => ({ key, schema: sub, required: required.has(key) }))
}

export function variantEntries(union: UnionInfo, activeConst: string): SchemaEntry[] {
  const variant = union.variants.find((v) => v.const === activeConst)
  if (!variant) return []
  const props = variant.schema.properties ?? {}
  const required = new Set([...union.baseRequired, ...(variant.schema.required ?? [])])
  return Object.entries(props)
    .filter(([key]) => key !== union.discriminator && !META_KEYS.has(key))
    .map(([key, sub]) => ({ key, schema: sub, required: required.has(key) }))
}

export function defaultForSchema(schema: JsonSchema): unknown {
  if (detectUnion(schema)) return {}
  const t = schemaType(schema)
  if (t === 'object') return {}
  if (t === 'array') return []
  if (t === 'boolean') return false
  return undefined
}

export function isUnitRange(schema: JsonSchema): boolean {
  return schema.minimum === 0 && schema.maximum === 1
}

export function humanizeKey(key: string): string {
  const spaced = key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .trim()
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}

export function cleanValue(value: unknown): unknown {
  if (value === undefined || value === null || value === '') return undefined
  if (Array.isArray(value)) {
    return value.map(cleanValue).filter((v) => v !== undefined)
  }
  if (isObject(value)) {
    const out: Record<string, unknown> = {}
    for (const [key, raw] of Object.entries(value)) {
      const cleaned = cleanValue(raw)
      if (cleaned !== undefined) out[key] = cleaned
    }
    return Object.keys(out).length > 0 ? out : undefined
  }
  return value
}

export function findMissingRequired(schema: JsonSchema, value: unknown, path = ''): string[] {
  const errors: string[] = []
  const union = detectUnion(schema)

  if (union) {
    if (!isObject(value) || value[union.discriminator] == null) {
      errors.push(`${path || 'value'}: choose a ${humanizeKey(union.discriminator)}`)
      return errors
    }
    for (const entry of variantEntries(union, String(value[union.discriminator]))) {
      collectEntry(entry, isObject(value) ? value[entry.key] : undefined, path, errors)
    }
    return errors
  }

  const t = schemaType(schema)
  if (t === 'object' && schema.properties) {
    for (const entry of objectEntries(schema)) {
      collectEntry(entry, isObject(value) ? value[entry.key] : undefined, path, errors)
    }
  } else if (t === 'array' && schema.items) {
    const arr = Array.isArray(value) ? value : []
    if (schema.minItems && arr.length < schema.minItems) {
      errors.push(`${path || 'list'}: add at least ${schema.minItems} item(s)`)
    }
    arr.forEach((item, i) => {
      errors.push(...findMissingRequired(schema.items as JsonSchema, item, `${path}[${i}]`))
    })
  }
  return errors
}

function collectEntry(
  entry: SchemaEntry,
  childValue: unknown,
  path: string,
  errors: string[],
): void {
  const childPath = path ? `${path}.${entry.key}` : entry.key
  const cleaned = cleanValue(childValue)
  if (entry.required && cleaned === undefined) {
    errors.push(`${humanizeKey(entry.key)} is required`)
    return
  }
  if (cleaned !== undefined) {
    errors.push(...findMissingRequired(entry.schema, childValue, childPath))
  }
}
