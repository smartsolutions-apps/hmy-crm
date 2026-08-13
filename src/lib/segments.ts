import type {
  AgeBracket, AgeBracketId, AudienceKey, Gender, GiftEvent,
  GiftRecommendation, LifeStage, Product, Season, Sillage, WearOccasion,
} from '@/types'
import type { TranslationKey } from '@/i18n'

// ---------------------------------------------------------------------------
// The age ladder. Children and adults are separate ladders so a "10–12" can
// never be offered alongside a "40–49" in the same picker.
//
// Adults start at 18 rather than 20 so there is no gap between the teen
// bracket (ends 17) and the first adult bracket — an 18 year old still has to
// land somewhere.
// ---------------------------------------------------------------------------

export const AGE_BRACKETS: AgeBracket[] = [
  { id: 'baby', lifeStage: 'kid', min: 0, max: 2 },
  { id: 'toddler', lifeStage: 'kid', min: 3, max: 5 },
  { id: 'child', lifeStage: 'kid', min: 6, max: 9 },
  { id: 'tween', lifeStage: 'kid', min: 10, max: 12 },
  { id: 'teen', lifeStage: 'kid', min: 13, max: 17 },
  { id: 'a18_29', lifeStage: 'adult', min: 18, max: 29 },
  { id: 'a30_39', lifeStage: 'adult', min: 30, max: 39 },
  { id: 'a40_49', lifeStage: 'adult', min: 40, max: 49 },
  { id: 'a50_59', lifeStage: 'adult', min: 50, max: 59 },
  { id: 'a60plus', lifeStage: 'adult', min: 60, max: null },
]

export const bracketsFor = (lifeStage: LifeStage) =>
  AGE_BRACKETS.filter((b) => b.lifeStage === lifeStage)

export const bracketById = (id: AgeBracketId) => AGE_BRACKETS.find((b) => b.id === id)

export const bracketRange = (b: AgeBracket) => (b.max === null ? `${b.min}+` : `${b.min}–${b.max}`)

export const bracketLabelKey = (id: AgeBracketId) => `seg.age.${id}` as TranslationKey

// ---------------------------------------------------------------------------
// The four audience squares
// ---------------------------------------------------------------------------

export const AUDIENCES: AudienceKey[] = [
  { lifeStage: 'adult', gender: 'female' },
  { lifeStage: 'adult', gender: 'male' },
  { lifeStage: 'kid', gender: 'female' },
  { lifeStage: 'kid', gender: 'male' },
]

export const audienceId = (a: AudienceKey) => `${a.lifeStage}-${a.gender}`

/** Children are shown as "Girls"/"Boys", adults as "Women"/"Men". */
export const audienceLabelKey = (a: AudienceKey) =>
  `seg.aud.${a.lifeStage}.${a.gender}` as TranslationKey

export const sameAudience = (a: AudienceKey, b: AudienceKey) =>
  a.lifeStage === b.lifeStage && a.gender === b.gender

export const audienceMatches = (r: { lifeStage: LifeStage; gender: Gender }, a: AudienceKey) =>
  r.lifeStage === a.lifeStage && r.gender === a.gender

// ---------------------------------------------------------------------------
// Coverage — which squares of the pyramid still have no perfume against them
// ---------------------------------------------------------------------------

export interface CoverageCell {
  event: GiftEvent
  audience: AudienceKey
  rules: GiftRecommendation[]
  productCount: number
  /** Brackets this event/audience covers, out of all brackets for that life stage. */
  bracketsCovered: number
  bracketsTotal: number
  /** The event says this audience matters, but nothing is mapped yet. */
  isGap: boolean
}

export function buildCoverage(
  events: GiftEvent[],
  recommendations: GiftRecommendation[]
): CoverageCell[] {
  const cells: CoverageCell[] = []
  for (const event of events) {
    for (const audience of AUDIENCES) {
      const rules = recommendations.filter(
        (r) => r.eventId === event.id && r.active && audienceMatches(r, audience)
      )
      const covered = new Set<AgeBracketId>()
      const products = new Set<string>()
      for (const r of rules) {
        r.ageBrackets.forEach((b) => covered.add(b))
        r.productIds.forEach((p) => products.add(p))
      }
      const suggested = event.suggestedAudiences.some((s) => sameAudience(s, audience))
      cells.push({
        event,
        audience,
        rules,
        productCount: products.size,
        bracketsCovered: covered.size,
        bracketsTotal: bracketsFor(audience.lifeStage).length,
        isGap: suggested && products.size === 0,
      })
    }
  }
  return cells
}

export function coverageStats(cells: CoverageCell[]) {
  const relevant = cells.filter((c) =>
    c.event.active && c.event.suggestedAudiences.some((s) => sameAudience(s, c.audience))
  )
  const filled = relevant.filter((c) => c.productCount > 0).length
  return {
    relevant: relevant.length,
    filled,
    gaps: relevant.length - filled,
    pct: relevant.length ? (filled / relevant.length) * 100 : 0,
  }
}

// ---------------------------------------------------------------------------
// What the website would actually show
// ---------------------------------------------------------------------------

export interface Suggestion {
  product: Product
  priority: number
  note?: string
}

/** Everything recommended for one occasion + audience, optionally narrowed to an age. */
export function suggestionsFor(
  eventId: string,
  audience: AudienceKey,
  recommendations: GiftRecommendation[],
  products: Product[],
  bracket?: AgeBracketId
): Suggestion[] {
  const rules = recommendations
    .filter((r) => r.eventId === eventId && r.active && audienceMatches(r, audience))
    .filter((r) => !bracket || r.ageBrackets.includes(bracket))
    .sort((a, b) => a.priority - b.priority)

  const seen = new Set<string>()
  const out: Suggestion[] = []
  for (const rule of rules) {
    for (const pid of rule.productIds) {
      if (seen.has(pid)) continue
      const product = products.find((p) => p.id === pid)
      if (!product) continue
      seen.add(pid)
      out.push({ product, priority: rule.priority, note: rule.note })
    }
  }
  return out
}

// ---------------------------------------------------------------------------
// Gift finder — occasion + who + age, answered with a rich set of options
// grouped by when the perfume is actually worn.
// ---------------------------------------------------------------------------

export const WEAR_OCCASIONS: WearOccasion[] = [
  'work', 'daytime', 'evening', 'formal', 'outdoors', 'majlis', 'prayer',
]

export const wearLabelKey = (w: WearOccasion) => `wear.${w}` as TranslationKey
export const seasonLabelKey = (s: Season) => `season.${s}` as TranslationKey
export const sillageLabelKey = (s: Sillage) => `sillage.${s}` as TranslationKey

/**
 * Nothing heavy on a child. Children only ever see light, low-projection
 * juice — this is a hard filter, not a preference.
 */
export function isSuitableFor(product: Product, audience: AudienceKey, bracket?: AgeBracketId) {
  if (product.status === 'discontinued') return false
  if (audience.lifeStage === 'kid') {
    if (product.sillage !== 'subtle') return false
    if (!['Mist', 'EDT'].includes(product.concentration)) return false
    // Nothing at all for babies and toddlers.
    if (bracket && ['baby', 'toddler'].includes(bracket)) return false
  }
  return true
}

export type FinderSource = 'recommended' | 'suggested'

export interface FinderItem {
  product: Product
  source: FinderSource
  isHero: boolean
}

export interface FinderGroup {
  wear: WearOccasion
  items: FinderItem[]
}

export interface FinderResult {
  items: FinderItem[]
  groups: FinderGroup[]
  /** True when the mapped rules alone could not reach the minimum. */
  toppedUp: boolean
}

/**
 * Never returns a single lonely bottle. If the curated rules give fewer than
 * `minResults`, the catalogue tops the list up with anything else appropriate
 * for that audience — flagged as `suggested` so the buyer can tell the
 * difference between "we chose this for you" and "you might also like".
 */
export function findGifts(
  eventId: string,
  audience: AudienceKey,
  bracket: AgeBracketId | undefined,
  recommendations: GiftRecommendation[],
  products: Product[],
  /** Four rather than three so the answer spans day, work and evening. */
  minResults = 4
): FinderResult {
  const curated = suggestionsFor(eventId, audience, recommendations, products, bracket)
    .filter((s) => isSuitableFor(s.product, audience, bracket))

  const items: FinderItem[] = curated.map((s, i) => ({
    product: s.product,
    source: 'recommended',
    isHero: i === 0,
  }))

  let toppedUp = false
  if (items.length < minResults) {
    const have = new Set(items.map((i) => i.product.id))
    const pool = products
      .filter((p) => p.status === 'active' && !have.has(p.id))
      .filter((p) => isSuitableFor(p, audience, bracket))

    // Top up for BREADTH, not similarity. A shopper should come away feeling
    // the house has something for the office, the daytime and the evening —
    // so each pick is the one that adds the most contexts not yet covered.
    const covered = new Set<WearOccasion>(items.flatMap((i) => i.product.wearOccasions))

    while (items.length < minResults && pool.length) {
      pool.sort((a, b) => {
        const gain = (p: Product) => p.wearOccasions.filter((w) => !covered.has(w)).length
        return gain(b) - gain(a) || b.price - a.price
      })
      const next = pool.shift()!
      next.wearOccasions.forEach((w) => covered.add(w))
      items.push({ product: next, source: 'suggested', isHero: false })
      toppedUp = true
    }
  }

  const groups: FinderGroup[] = WEAR_OCCASIONS.map((wear) => ({
    wear,
    items: items.filter((i) => i.product.wearOccasions.includes(wear)),
  })).filter((g) => g.items.length > 0)

  return { items, groups, toppedUp }
}

/** The shape the website can consume directly. */
export function buildWebsiteFeed(
  events: GiftEvent[],
  recommendations: GiftRecommendation[],
  products: Product[]
) {
  return events
    .filter((e) => e.active)
    .map((event) => ({
      code: event.code,
      nameEn: event.nameEn,
      nameAr: event.nameAr,
      category: event.category,
      month: event.month,
      day: event.day,
      movableDate: event.movableDate,
      audiences: AUDIENCES.map((audience) => {
        const brackets = bracketsFor(audience.lifeStage)
          .map((b) => {
            const items = suggestionsFor(event.id, audience, recommendations, products, b.id)
            return items.length
              ? {
                  bracket: b.id,
                  ageFrom: b.min,
                  ageTo: b.max,
                  products: items.map((s, i) => ({
                    sku: s.product.sku,
                    nameEn: s.product.nameEn,
                    nameAr: s.product.nameAr,
                    sizeMl: s.product.sizeMl,
                    concentration: s.product.concentration,
                    family: s.product.family,
                    priceAed: s.product.price,
                    hero: i === 0,
                    // The website groups by these to build "for work / for the
                    // evening" tabs on the occasion page.
                    wearOccasions: s.product.wearOccasions,
                    season: s.product.season,
                    sillage: s.product.sillage,
                  })),
                }
              : null
          })
          .filter(Boolean)
        return brackets.length
          ? { lifeStage: audience.lifeStage, gender: audience.gender, ageBrackets: brackets }
          : null
      }).filter(Boolean),
    }))
    .filter((e) => e.audiences.length > 0)
}
