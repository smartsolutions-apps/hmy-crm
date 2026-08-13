// ---------------------------------------------------------------------------
// Domain model for the perfume house CRM.
// Every money value is stored as a plain number in AED.
// Every quantity is stored in the unit declared on the material itself.
// ---------------------------------------------------------------------------

export type ID = string

export type MaterialCategory =
  | 'oil'
  | 'alcohol'
  | 'fixative'
  | 'bottle'
  | 'cap'
  | 'box'
  | 'label'
  | 'other'

export type Unit = 'ml' | 'g' | 'pcs'

export interface Material {
  id: ID
  code: string
  nameEn: string
  nameAr: string
  category: MaterialCategory
  unit: Unit
  costPerUnit: number
  stockQty: number
  reorderLevel: number
  supplierId: ID | null
  origin?: string
  notes?: string
}

export type Concentration = 'Parfum' | 'EDP' | 'EDT' | 'Oil' | 'Mist'
export type Family = 'oriental' | 'floral' | 'woody' | 'fresh' | 'musk'

/**
 * When a perfume is actually worn. This lives on the product, not on the gift
 * rule — a scent intrinsically is an office scent or an evening scent, so
 * tagging it once here means every gift recommendation inherits the full
 * day / night / work breakdown for free.
 */
export type WearOccasion =
  | 'work'      // office, meetings — moderate sillage
  | 'daytime'   // casual, errands, brunch
  | 'evening'   // dinner, going out
  | 'formal'    // weddings, Eid, celebrations — the statement bottle
  | 'outdoors'  // beach, sport, the heat
  | 'majlis'    // hosting and gatherings — oud-forward, expected in the Gulf
  | 'prayer'    // mosque and Friday prayer — alcohol-free only

export type Season = 'all' | 'summer' | 'winter'

/** How far it carries off the skin. */
export type Sillage = 'subtle' | 'moderate' | 'strong'

export interface Product {
  id: ID
  sku: string
  nameEn: string
  nameAr: string
  family: Family
  concentration: Concentration
  sizeMl: number
  formulaId: ID | null
  price: number // retail selling price, VAT exclusive
  wholesalePrice: number
  stockQty: number
  reorderLevel: number
  status: 'active' | 'draft' | 'discontinued'
  launchDate: string // ISO date
  /** Drives the day / night / work grouping in the gift finder. */
  wearOccasions: WearOccasion[]
  season: Season
  sillage: Sillage
  descriptionEn?: string
  descriptionAr?: string
  topNotes?: string[]
  heartNotes?: string[]
  baseNotes?: string[]
}

export interface FormulaLine {
  materialId: ID
  /** Quantity of this material required to make ONE finished unit. */
  qtyPerUnit: number
}

export interface Formula {
  id: ID
  code: string
  nameEn: string
  nameAr: string
  productId: ID | null
  version: string
  /** Expected wastage as a fraction, e.g. 0.03 = 3% is considered normal. */
  expectedLossRate: number
  lines: FormulaLine[]
  perfumerNotes?: string
}

export interface ConsumptionLine {
  materialId: ID
  /** What the formula said we should use for the units actually produced. */
  expectedQty: number
  /** What the floor actually issued to the batch. */
  actualQty: number
}

export type BatchStatus = 'planned' | 'in_progress' | 'macerating' | 'completed' | 'cancelled'

export interface ProductionBatch {
  id: ID
  batchNo: string
  productId: ID
  formulaId: ID
  startDate: string
  endDate: string | null
  status: BatchStatus
  plannedUnits: number
  actualUnits: number
  /** Units produced but rejected by QC — counted as loss, not as output. */
  rejectedUnits: number
  consumption: ConsumptionLine[]
  labourCost: number
  overheadCost: number
  operator?: string
  notes?: string
}

export type CustomerType = 'retail' | 'wholesale' | 'vip'

export interface Customer {
  id: ID
  code: string
  name: string
  nameAr?: string
  phone: string
  email?: string
  city: string
  country: string
  type: CustomerType
  source: string
  tags: string[]
  preferredFamily?: Family
  birthday?: string
  createdAt: string
  notes?: string
}

export interface Interaction {
  id: ID
  customerId: ID
  date: string
  type: 'call' | 'whatsapp' | 'email' | 'visit' | 'note'
  summary: string
  by?: string
}

export interface OrderItem {
  productId: ID
  qty: number
  unitPrice: number
  discount: number // absolute AED off this line
}

export type OrderStatus = 'draft' | 'confirmed' | 'packed' | 'shipped' | 'delivered' | 'cancelled' | 'returned'
export type PaymentStatus = 'unpaid' | 'partial' | 'paid' | 'refunded'

export interface Order {
  id: ID
  orderNo: string
  customerId: ID
  date: string
  channel: 'instagram' | 'whatsapp' | 'website' | 'store' | 'wholesale' | 'tiktok' | 'referral'
  status: OrderStatus
  paymentStatus: PaymentStatus
  paymentMethod?: 'cash' | 'card' | 'transfer' | 'cod' | 'tabby'
  items: OrderItem[]
  shipping: number
  orderDiscount: number
  vatRate: number // 0.05 in the UAE
  amountPaid: number
  campaignId?: ID | null
  notes?: string
}

export interface Supplier {
  id: ID
  code: string
  name: string
  contactPerson?: string
  phone: string
  email?: string
  country: string
  paymentTerms: string
  rating: number // 1..5
  notes?: string
}

export interface PurchaseItem {
  materialId: ID
  qty: number
  unitCost: number
}

export interface Purchase {
  id: ID
  poNo: string
  supplierId: ID
  date: string
  expectedDate?: string
  status: 'ordered' | 'received' | 'partial' | 'cancelled'
  paymentStatus: PaymentStatus
  items: PurchaseItem[]
  shipping: number
  customsDuty: number
  amountPaid: number
  notes?: string
}

export type Channel =
  | 'instagram'
  | 'tiktok'
  | 'google'
  | 'snapchat'
  | 'influencer'
  | 'email'
  | 'whatsapp'
  | 'event'

export interface Campaign {
  id: ID
  name: string
  nameAr?: string
  channel: Channel
  status: 'planned' | 'running' | 'paused' | 'completed'
  startDate: string
  endDate: string
  budget: number
  spend: number
  impressions: number
  clicks: number
  leads: number
  orders: number
  revenue: number
  notes?: string
}

export interface Lead {
  id: ID
  name: string
  phone: string
  email?: string
  source: Channel | 'walk-in' | 'referral'
  campaignId: ID | null
  status: 'new' | 'contacted' | 'qualified' | 'won' | 'lost'
  estimatedValue: number
  createdAt: string
  owner?: string
  notes?: string
}

export type ExpenseCategory =
  | 'rent'
  | 'salaries'
  | 'marketing'
  | 'utilities'
  | 'packaging'
  | 'shipping'
  | 'licence'
  | 'equipment'
  | 'software'
  | 'other'

export interface Expense {
  id: ID
  date: string
  category: ExpenseCategory
  description: string
  amount: number
  vendor?: string
  paymentMethod: 'cash' | 'card' | 'transfer'
  recurring: boolean
}

// ---------------------------------------------------------------------------
// Gift occasions — the merchandising pyramid:
//   occasion  →  who the gift is for  →  their age  →  which perfumes
// This is what feeds the "recommended for Mother's Day" pages on the website.
// ---------------------------------------------------------------------------

export type EventCategory = 'personal' | 'religious' | 'national' | 'seasonal' | 'corporate'

/** Adults and children are kept apart so the age ladders never mix. */
export type LifeStage = 'adult' | 'kid'
export type Gender = 'male' | 'female'

export type AgeBracketId =
  // children
  | 'baby' | 'toddler' | 'child' | 'tween' | 'teen'
  // adults
  | 'a18_29' | 'a30_39' | 'a40_49' | 'a50_59' | 'a60plus'

export interface AgeBracket {
  id: AgeBracketId
  lifeStage: LifeStage
  min: number
  /** null means open-ended — 60 and above. */
  max: number | null
}

/** A segment is one square of the pyramid: adult female, kid boy, and so on. */
export interface AudienceKey {
  lifeStage: LifeStage
  gender: Gender
}

export interface GiftEvent {
  id: ID
  code: string
  nameEn: string
  nameAr: string
  category: EventCategory
  /** Month 1–12 for fixed-date occasions; null for personal ones like birthdays. */
  month: number | null
  day: number | null
  /** True when the date moves each year (Eid, Ramadan) — plan, don't hard-code. */
  movableDate: boolean
  /** Who normally receives a gift on this occasion — used to pre-fill the editor. */
  suggestedAudiences: AudienceKey[]
  active: boolean
  notes?: string
}

export interface GiftRecommendation {
  id: ID
  eventId: ID
  lifeStage: LifeStage
  gender: Gender
  /** One rule can cover several brackets at once, so the grid stays fillable. */
  ageBrackets: AgeBracketId[]
  /** Ordered — first is the hero product on the website. */
  productIds: ID[]
  /** Lower sorts first when several rules match the same shopper. */
  priority: number
  active: boolean
  note?: string
}

export interface Settings {
  companyName: string
  companyNameAr: string
  currency: string
  vatRate: number
  trn?: string
  address?: string
  phone?: string
  email?: string
  lowStockAlerts: boolean
}

export interface Database {
  materials: Material[]
  products: Product[]
  formulas: Formula[]
  batches: ProductionBatch[]
  customers: Customer[]
  interactions: Interaction[]
  orders: Order[]
  suppliers: Supplier[]
  purchases: Purchase[]
  campaigns: Campaign[]
  leads: Lead[]
  expenses: Expense[]
  giftEvents: GiftEvent[]
  giftRecommendations: GiftRecommendation[]
}

export type CollectionName = keyof Database
