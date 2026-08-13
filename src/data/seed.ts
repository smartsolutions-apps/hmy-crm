import type {
  Campaign,
  Customer,
  Database,
  Expense,
  Formula,
  Interaction,
  Lead,
  Material,
  Order,
  Product,
  ProductionBatch,
  Purchase,
  Supplier,
} from '@/types'

// ---------------------------------------------------------------------------
// Deterministic PRNG so the demo dataset is identical on every machine.
// ---------------------------------------------------------------------------
function mulberry32(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const rnd = mulberry32(20260813)
const pickOne = <T>(xs: readonly T[]) => xs[Math.floor(rnd() * xs.length)]
const between = (a: number, b: number) => a + rnd() * (b - a)
const intBetween = (a: number, b: number) => Math.floor(between(a, b + 1))
const round = (n: number, d = 2) => +n.toFixed(d)
const chance = (p: number) => rnd() < p

/** The dataset is anchored so the demo always shows a full trailing year. */
const TODAY = new Date('2026-08-13T00:00:00Z')
const iso = (d: Date) => d.toISOString().slice(0, 10)
const daysAgo = (n: number) => iso(new Date(TODAY.getTime() - n * 86400000))
const dateIn = (monthsBack: number, day: number) => {
  const d = new Date(Date.UTC(TODAY.getUTCFullYear(), TODAY.getUTCMonth() - monthsBack, day))
  return iso(d)
}

// ===========================================================================
// SUPPLIERS
// ===========================================================================

export const suppliers: Supplier[] = [
  {
    id: 'sup-01', code: 'SUP-001', name: 'Al Haramain Aromatics',
    contactPerson: 'Khalid Al Balushi', phone: '+971 4 226 8841',
    email: 'sales@haramain-aromatics.ae', country: 'UAE',
    paymentTerms: 'Net 30', rating: 5,
    notes: 'Deira souk house. Best source for oud and oriental bases. Will hold stock for us.',
  },
  {
    id: 'sup-02', code: 'SUP-002', name: 'Grasse Naturals SARL',
    contactPerson: 'Camille Rousseau', phone: '+33 4 93 36 12 90',
    email: 'export@grassenaturals.fr', country: 'France',
    paymentTerms: '50% advance, 50% on shipment', rating: 5,
    notes: 'Florals and absolutes. Lead time 5–6 weeks by air. Certificates of analysis with every lot.',
  },
  {
    id: 'sup-03', code: 'SUP-003', name: 'Firmenich Gulf FZE',
    contactPerson: 'Rami Haddad', phone: '+971 4 883 2200',
    email: 'gulf.orders@firmenich-dist.ae', country: 'UAE',
    paymentTerms: 'Net 45', rating: 4,
    notes: 'Captives and synthetics — Iso E Super, Ambroxan, Cashmeran. Minimum order 1 kg.',
  },
  {
    id: 'sup-04', code: 'SUP-004', name: 'Kannauj Attar House',
    contactPerson: 'Imran Siddiqui', phone: '+91 98 3910 4477',
    email: 'imran@kannaujattar.in', country: 'India',
    paymentTerms: 'Advance payment', rating: 4,
    notes: 'Traditional deg-bhapka attars and sandalwood. Quality varies by lot — always sample first.',
  },
  {
    id: 'sup-05', code: 'SUP-005', name: 'Emirates Glass & Packaging',
    contactPerson: 'Sara Mansour', phone: '+971 6 534 7712',
    email: 'orders@emiratesglass.ae', country: 'UAE',
    paymentTerms: 'Net 30', rating: 4,
    notes: 'Sharjah warehouse. Heavy-base bottles and crimp pumps. Fast — 3 to 5 days.',
  },
  {
    id: 'sup-06', code: 'SUP-006', name: 'Lumière Packaging Co.',
    contactPerson: 'Wei Chen', phone: '+86 755 8834 9021',
    email: 'wei@lumiere-pack.cn', country: 'China',
    paymentTerms: '30% deposit, balance before shipping', rating: 3,
    notes: 'Magnetic caps and rigid boxes. Cheapest by far, but 6–8 weeks by sea and QC is uneven.',
  },
  {
    id: 'sup-07', code: 'SUP-007', name: 'Gulf Chemical Supplies',
    contactPerson: 'Ahmed Farouk', phone: '+971 4 347 9910',
    email: 'ahmed@gulfchem.ae', country: 'UAE',
    paymentTerms: 'Cash on delivery', rating: 5,
    notes: 'Perfumer’s alcohol, DPG, benzyl benzoate. Licensed ethanol handler — keep permit copy on file.',
  },
  {
    id: 'sup-08', code: 'SUP-008', name: 'Isfahan Rose Traders',
    contactPerson: 'Mehdi Rahimi', phone: '+98 31 3620 4455',
    email: 'mehdi@isfahanrose.ir', country: 'Iran',
    paymentTerms: 'Advance payment', rating: 3,
    notes: 'Rose otto only, harvest season May–June. Payment routing is slow — plan ahead.',
  },
]

// ===========================================================================
// RAW MATERIALS
// ===========================================================================

type MSeed = [
  id: string, code: string, en: string, ar: string,
  cat: Material['category'], unit: Material['unit'],
  cost: number, stock: number, reorder: number, sup: string, origin: string
]

const materialSeeds: MSeed[] = [
  // --- aroma oils --------------------------------------------------------
  ['mat-oud-camb', 'OIL-001', 'Cambodian Oud Oil', 'دهن عود كمبودي', 'oil', 'ml', 320, 38, 25, 'sup-01', 'Cambodia'],
  ['mat-oud-assam', 'OIL-002', 'Assam Oud Oil', 'دهن عود آسامي', 'oil', 'ml', 165, 96, 60, 'sup-04', 'India'],
  ['mat-rose-taif', 'OIL-003', 'Taif Rose Absolute', 'مطلق ورد الطائف', 'oil', 'ml', 88, 184, 80, 'sup-08', 'Saudi Arabia'],
  ['mat-rose-bulg', 'OIL-004', 'Bulgarian Rose Otto', 'زيت الورد البلغاري', 'oil', 'ml', 72, 142, 70, 'sup-02', 'Bulgaria'],
  ['mat-jasmine', 'OIL-005', 'Jasmine Sambac Absolute', 'مطلق الياسمين السامباك', 'oil', 'ml', 54, 168, 80, 'sup-02', 'India'],
  ['mat-saffron', 'OIL-006', 'Saffron Absolute', 'مطلق الزعفران', 'oil', 'ml', 42, 74, 60, 'sup-01', 'Iran'],
  ['mat-ambergris', 'OIL-007', 'Ambergris Tincture', 'صبغة العنبر', 'oil', 'ml', 60, 58, 40, 'sup-01', 'UAE'],
  ['mat-sandal', 'OIL-008', 'Mysore Sandalwood Oil', 'زيت الصندل الميسوري', 'oil', 'ml', 46, 126, 80, 'sup-04', 'India'],
  ['mat-patchouli', 'OIL-009', 'Patchouli Dark', 'الباتشولي الداكن', 'oil', 'ml', 3.2, 880, 300, 'sup-02', 'Indonesia'],
  ['mat-bergamot', 'OIL-010', 'Bergamot Calabria', 'برغموت كالابريا', 'oil', 'ml', 2.4, 1340, 400, 'sup-02', 'Italy'],
  ['mat-lemon', 'OIL-011', 'Sicilian Lemon', 'ليمون صقلي', 'oil', 'ml', 1.9, 1080, 400, 'sup-02', 'Italy'],
  ['mat-lavender', 'OIL-012', 'Lavender Provence', 'خزامى بروفانس', 'oil', 'ml', 2.8, 760, 300, 'sup-02', 'France'],
  ['mat-vanilla', 'OIL-013', 'Vanilla Absolute Madagascar', 'مطلق الفانيليا المدغشقرية', 'oil', 'ml', 28, 232, 100, 'sup-02', 'Madagascar'],
  ['mat-tonka', 'OIL-014', 'Tonka Bean Absolute', 'مطلق حبة التونكا', 'oil', 'ml', 18, 196, 90, 'sup-02', 'Brazil'],
  ['mat-musk', 'OIL-015', 'White Musk Accord', 'أكورد المسك الأبيض', 'oil', 'ml', 4.5, 1520, 500, 'sup-03', 'Switzerland'],
  ['mat-amber', 'OIL-016', 'Amber Accord', 'أكورد العنبر', 'oil', 'ml', 5.2, 1140, 400, 'sup-03', 'Switzerland'],
  ['mat-frank', 'OIL-017', 'Frankincense Oman', 'لبان عماني', 'oil', 'ml', 9.5, 348, 150, 'sup-01', 'Oman'],
  ['mat-cedar', 'OIL-018', 'Virginia Cedarwood', 'خشب الأرز الفرجيني', 'oil', 'ml', 1.6, 910, 350, 'sup-03', 'USA'],
  ['mat-vetiver', 'OIL-019', 'Haiti Vetiver', 'نجيل هايتي', 'oil', 'ml', 6.8, 384, 180, 'sup-02', 'Haiti'],
  ['mat-isoe', 'OIL-020', 'Iso E Super', 'أيزو إي سوبر', 'oil', 'ml', 0.42, 4180, 1200, 'sup-03', 'Switzerland'],
  ['mat-ambroxan', 'OIL-021', 'Ambroxan', 'أمبروكسان', 'oil', 'ml', 3.9, 642, 250, 'sup-03', 'Switzerland'],
  ['mat-cashmeran', 'OIL-022', 'Cashmeran', 'كاشميران', 'oil', 'ml', 2.6, 468, 200, 'sup-03', 'Switzerland'],
  ['mat-pinkpepper', 'OIL-023', 'Pink Pepper', 'الفلفل الوردي', 'oil', 'ml', 3.1, 322, 150, 'sup-02', 'Peru'],
  ['mat-cardamom', 'OIL-024', 'Cardamom Guatemala', 'هيل غواتيمالي', 'oil', 'ml', 7.4, 214, 100, 'sup-02', 'Guatemala'],
  ['mat-ylang', 'OIL-025', 'Ylang Ylang Extra', 'يلانغ يلانغ إكسترا', 'oil', 'ml', 4.1, 268, 120, 'sup-02', 'Comoros'],
  ['mat-geranium', 'OIL-026', 'Geranium Egypt', 'إبرة الراعي المصرية', 'oil', 'ml', 3.6, 342, 150, 'sup-02', 'Egypt'],
  ['mat-oakmoss', 'OIL-027', 'Oakmoss Absolute', 'مطلق طحلب البلوط', 'oil', 'ml', 12, 118, 80, 'sup-02', 'Yugoslavia'],

  // --- bases & fixatives -------------------------------------------------
  ['mat-alcohol', 'BAS-001', "Perfumer's Alcohol 96%", 'كحول عطري ٩٦٪', 'alcohol', 'ml', 0.085, 58400, 20000, 'sup-07', 'UAE'],
  ['mat-dpg', 'BAS-002', 'Dipropylene Glycol (DPG)', 'داي بروبيلين غلايكول', 'alcohol', 'ml', 0.06, 8600, 3000, 'sup-07', 'UAE'],
  ['mat-water', 'BAS-003', 'Distilled Water', 'ماء مقطر', 'alcohol', 'ml', 0.01, 19200, 5000, 'sup-07', 'UAE'],
  ['mat-bb', 'FIX-001', 'Benzyl Benzoate', 'بنزيل بنزوات', 'fixative', 'ml', 0.11, 4650, 1500, 'sup-07', 'UAE'],
  ['mat-ipm', 'FIX-002', 'Isopropyl Myristate', 'ميرستات الأيزوبروبيل', 'fixative', 'ml', 0.14, 2380, 1000, 'sup-07', 'UAE'],

  // --- packaging ---------------------------------------------------------
  ['mat-btl-50', 'PKG-001', '50 ml Heavy Glass Bottle', 'زجاجة زجاج ثقيل ٥٠ مل', 'bottle', 'pcs', 11.5, 1240, 400, 'sup-05', 'UAE'],
  ['mat-btl-100', 'PKG-002', '100 ml Heavy Glass Bottle', 'زجاجة زجاج ثقيل ١٠٠ مل', 'bottle', 'pcs', 16.8, 610, 250, 'sup-05', 'UAE'],
  ['mat-btl-30', 'PKG-003', '30 ml Roll-on Bottle', 'زجاجة رول أون ٣٠ مل', 'bottle', 'pcs', 6.4, 820, 300, 'sup-05', 'UAE'],
  ['mat-btl-12', 'PKG-004', '12 ml Attar Bottle', 'زجاجة عطر ١٢ مل', 'bottle', 'pcs', 8.9, 470, 200, 'sup-01', 'UAE'],
  ['mat-pump', 'PKG-005', 'Crimp Pump Sprayer', 'بخاخ كريمب', 'cap', 'pcs', 3.7, 1980, 700, 'sup-05', 'UAE'],
  ['mat-cap-gold', 'PKG-006', 'Magnetic Cap — Gold', 'غطاء مغناطيسي ذهبي', 'cap', 'pcs', 6.2, 1310, 450, 'sup-06', 'China'],
  ['mat-cap-silver', 'PKG-007', 'Magnetic Cap — Silver', 'غطاء مغناطيسي فضي', 'cap', 'pcs', 5.8, 640, 300, 'sup-06', 'China'],
  ['mat-cap-wood', 'PKG-008', 'Turned Wooden Cap', 'غطاء خشبي مخروط', 'cap', 'pcs', 7.5, 385, 250, 'sup-06', 'China'],
  ['mat-box-50', 'PKG-009', 'Rigid Gift Box — 50 ml', 'علبة هدايا صلبة ٥٠ مل', 'box', 'pcs', 7.9, 1150, 400, 'sup-06', 'China'],
  ['mat-box-100', 'PKG-010', 'Rigid Gift Box — 100 ml', 'علبة هدايا صلبة ١٠٠ مل', 'box', 'pcs', 9.6, 560, 250, 'sup-06', 'China'],
  ['mat-box-attar', 'PKG-011', 'Attar Presentation Box', 'علبة عطر فاخرة', 'box', 'pcs', 6.5, 410, 200, 'sup-06', 'China'],
  ['mat-label', 'PKG-012', 'Front Label — Gold Foil', 'ملصق أمامي بطبعة ذهبية', 'label', 'pcs', 0.85, 4300, 1500, 'sup-05', 'UAE'],
  ['mat-label-back', 'PKG-013', 'Back Label / Barcode', 'ملصق خلفي / باركود', 'label', 'pcs', 0.35, 4750, 1500, 'sup-05', 'UAE'],
  ['mat-pouch', 'PKG-014', 'Velvet Drawstring Pouch', 'كيس مخمل برباط', 'other', 'pcs', 4.2, 720, 300, 'sup-06', 'China'],
  ['mat-cello', 'PKG-015', 'Cellophane Overwrap', 'غلاف سيلوفان', 'other', 'pcs', 0.6, 3400, 1200, 'sup-05', 'UAE'],
]

export const materials: Material[] = materialSeeds.map(
  ([id, code, nameEn, nameAr, category, unit, costPerUnit, stockQty, reorderLevel, supplierId, origin]) => ({
    id, code, nameEn, nameAr, category, unit, costPerUnit, stockQty, reorderLevel, supplierId, origin,
  })
)

const matCost = (id: string) => materials.find((m) => m.id === id)?.costPerUnit ?? 0

// ===========================================================================
// FORMULAS  (quantities are PER FINISHED UNIT)
// ===========================================================================

type Line = [materialId: string, qtyPerUnit: number]
const L = (lines: Line[]) => lines.map(([materialId, qtyPerUnit]) => ({ materialId, qtyPerUnit }))

/** Packaging set for a standard 50 ml sprayed EDP. */
const pack50 = (cap = 'mat-cap-gold'): Line[] => [
  ['mat-btl-50', 1], ['mat-pump', 1], [cap, 1],
  ['mat-box-50', 1], ['mat-label', 1], ['mat-label-back', 1], ['mat-cello', 1],
]
const pack100 = (cap = 'mat-cap-gold'): Line[] => [
  ['mat-btl-100', 1], ['mat-pump', 1], [cap, 1],
  ['mat-box-100', 1], ['mat-label', 1], ['mat-label-back', 1], ['mat-cello', 1],
]

export const formulas: Formula[] = [
  {
    id: 'frm-01', code: 'F-LYL-050', nameEn: 'Layl Oud — 50 ml EDP', nameAr: 'ليل عود — ٥٠ مل',
    productId: 'prd-01', version: 'v3.2', expectedLossRate: 0.03,
    perfumerNotes: 'Oud stays under 2% or it eats the saffron. Macerate 21 days minimum — it is flat before day 14.',
    lines: L([
      ['mat-oud-assam', 0.15], ['mat-saffron', 0.1], ['mat-rose-bulg', 0.25],
      ['mat-amber', 2.4], ['mat-patchouli', 1.1], ['mat-vanilla', 0.3],
      ['mat-frank', 0.35], ['mat-cedar', 1.0], ['mat-isoe', 2.6], ['mat-ambroxan', 0.75],
      ['mat-alcohol', 39], ['mat-dpg', 1.2], ['mat-bb', 0.4],
      ...pack50(),
    ]),
  },
  {
    id: 'frm-02', code: 'F-LYL-100', nameEn: 'Layl Oud Intense — 100 ml Parfum', nameAr: 'ليل عود إنتنس — ١٠٠ مل',
    productId: 'prd-02', version: 'v2.0', expectedLossRate: 0.04,
    perfumerNotes: 'Parfum strength, 28% compound. Cambodian oud at the top of the budget — do not substitute.',
    lines: L([
      ['mat-oud-camb', 0.16], ['mat-oud-assam', 0.4], ['mat-saffron', 0.3],
      ['mat-rose-taif', 0.35], ['mat-amber', 5.5], ['mat-patchouli', 2.6],
      ['mat-vanilla', 0.9], ['mat-frank', 0.9], ['mat-sandal', 0.45],
      ['mat-cedar', 2.2], ['mat-isoe', 6.2], ['mat-ambroxan', 1.9], ['mat-tonka', 0.5],
      ['mat-alcohol', 70], ['mat-dpg', 2.5], ['mat-bb', 1.0],
      ...pack100(),
    ]),
  },
  {
    id: 'frm-03', code: 'F-WRD-050', nameEn: 'Ward Taif — 50 ml EDP', nameAr: 'ورد الطائف — ٥٠ مل',
    productId: 'prd-03', version: 'v2.4', expectedLossRate: 0.03,
    perfumerNotes: 'Taif rose carries the whole thing. Geranium props it up cheaply without reading synthetic.',
    lines: L([
      ['mat-rose-taif', 0.55], ['mat-rose-bulg', 0.3], ['mat-geranium', 1.2],
      ['mat-ylang', 0.8], ['mat-pinkpepper', 0.6], ['mat-musk', 2.2],
      ['mat-cashmeran', 0.9], ['mat-isoe', 2.0], ['mat-sandal', 0.2],
      ['mat-alcohol', 39.5], ['mat-dpg', 1.0], ['mat-bb', 0.35],
      ...pack50(),
    ]),
  },
  {
    id: 'frm-04', code: 'F-RML-100', nameEn: 'Rimal — 100 ml EDP', nameAr: 'رمال — ١٠٠ مل',
    productId: 'prd-04', version: 'v1.8', expectedLossRate: 0.035,
    perfumerNotes: 'Dry woody. Vetiver and cedar do the work; ambroxan gives the skin trail.',
    lines: L([
      ['mat-vetiver', 1.4], ['mat-cedar', 4.2], ['mat-sandal', 0.5],
      ['mat-patchouli', 1.8], ['mat-cardamom', 0.7], ['mat-pinkpepper', 0.9],
      ['mat-ambroxan', 2.4], ['mat-isoe', 7.5], ['mat-cashmeran', 1.6], ['mat-oakmoss', 0.25],
      ['mat-alcohol', 74], ['mat-dpg', 2.0], ['mat-bb', 0.8],
      ...pack100('mat-cap-wood'),
    ]),
  },
  {
    id: 'frm-05', code: 'F-YSM-050', nameEn: 'Yasmeen Nights — 50 ml EDP', nameAr: 'ليالي الياسمين — ٥٠ مل',
    productId: 'prd-05', version: 'v2.1', expectedLossRate: 0.03,
    perfumerNotes: 'Indolic on the first hour, then settles. Customers who sniff the bottle cold always misread it.',
    lines: L([
      ['mat-jasmine', 0.9], ['mat-ylang', 1.1], ['mat-rose-bulg', 0.2],
      ['mat-tonka', 0.4], ['mat-vanilla', 0.35], ['mat-musk', 2.4],
      ['mat-isoe', 1.8], ['mat-cashmeran', 0.7], ['mat-bergamot', 1.0],
      ['mat-alcohol', 39.5], ['mat-dpg', 1.0], ['mat-bb', 0.35],
      ...pack50('mat-cap-silver'),
    ]),
  },
  {
    id: 'frm-06', code: 'F-SHR-050', nameEn: 'Sahar Musk — 50 ml EDP', nameAr: 'مسك السحر — ٥٠ مل',
    productId: 'prd-06', version: 'v1.5', expectedLossRate: 0.025,
    perfumerNotes: 'Our cheapest juice and our best repeat rate. Clean laundry musk — do not overthink it.',
    lines: L([
      ['mat-musk', 5.2], ['mat-cashmeran', 1.4], ['mat-ambroxan', 0.9],
      ['mat-isoe', 1.6], ['mat-lavender', 0.4], ['mat-vanilla', 0.15],
      ['mat-alcohol', 40], ['mat-dpg', 1.0], ['mat-bb', 0.3],
      ...pack50('mat-cap-silver'),
    ]),
  },
  {
    id: 'frm-07', code: 'F-BHR-100', nameEn: 'Bahr — 100 ml EDT', nameAr: 'بحر — ١٠٠ مل',
    productId: 'prd-07', version: 'v1.3', expectedLossRate: 0.03,
    perfumerNotes: 'Citrus EDT at 12%. Bergamot flashes off fast — the ambroxan is what people actually remember.',
    lines: L([
      ['mat-bergamot', 3.2], ['mat-lemon', 2.4], ['mat-lavender', 1.1],
      ['mat-geranium', 0.6], ['mat-cedar', 1.8], ['mat-ambroxan', 1.5],
      ['mat-isoe', 2.4], ['mat-musk', 0.9],
      ['mat-alcohol', 82], ['mat-dpg', 1.5], ['mat-bb', 0.5],
      ...pack100('mat-cap-silver'),
    ]),
  },
  {
    id: 'frm-08', code: 'F-ZAF-050', nameEn: 'Zaafaran Royale — 50 ml Parfum', nameAr: 'زعفران رويال — ٥٠ مل',
    productId: 'prd-08', version: 'v1.9', expectedLossRate: 0.045,
    perfumerNotes: 'Our flagship. Saffron plus Taif rose plus real oud. Highest cost, highest margin, sells itself in Ramadan.',
    lines: L([
      ['mat-saffron', 0.5], ['mat-oud-camb', 0.09], ['mat-oud-assam', 0.22],
      ['mat-rose-taif', 0.6], ['mat-ambergris', 0.3], ['mat-amber', 2.8],
      ['mat-vanilla', 0.6], ['mat-frank', 0.5], ['mat-sandal', 0.35],
      ['mat-isoe', 3.0], ['mat-ambroxan', 1.1], ['mat-patchouli', 0.8],
      ['mat-alcohol', 36], ['mat-dpg', 1.4], ['mat-bb', 0.5],
      ...pack50(),
    ]),
  },
  {
    id: 'frm-09', code: 'F-KHB-012', nameEn: 'Khashab Attar — 12 ml Oil', nameAr: 'عطر خشب — ١٢ مل',
    productId: 'prd-09', version: 'v2.2', expectedLossRate: 0.02,
    perfumerNotes: 'Alcohol-free, DPG base. Sells hardest to the Emirati wholesale accounts around Eid.',
    lines: L([
      ['mat-oud-assam', 0.55], ['mat-sandal', 0.8], ['mat-amber', 1.6],
      ['mat-saffron', 0.15], ['mat-rose-taif', 0.18], ['mat-frank', 0.4],
      ['mat-dpg', 7.4], ['mat-ipm', 0.9],
      ['mat-btl-12', 1], ['mat-cap-wood', 1], ['mat-box-attar', 1],
      ['mat-label', 1], ['mat-label-back', 1], ['mat-pouch', 1],
    ]),
  },
  {
    id: 'frm-10', code: 'F-NDA-100', nameEn: 'Nada Blossom — 100 ml Mist', nameAr: 'ندى الزهور — ١٠٠ مل',
    productId: 'prd-10', version: 'v1.1', expectedLossRate: 0.02,
    perfumerNotes: 'Body mist, 4% compound, mostly water. Entry price point — gets people into the brand.',
    lines: L([
      ['mat-jasmine', 0.25], ['mat-rose-bulg', 0.12], ['mat-musk', 1.8],
      ['mat-ylang', 0.3], ['mat-bergamot', 0.6], ['mat-vanilla', 0.15],
      ['mat-alcohol', 28], ['mat-water', 66], ['mat-dpg', 1.5],
      ['mat-btl-100', 1], ['mat-pump', 1], ['mat-cap-silver', 1],
      ['mat-label', 1], ['mat-label-back', 1],
    ]),
  },
  {
    id: 'frm-11', code: 'F-AMB-100', nameEn: 'Ambar Aswad — 100 ml EDP', nameAr: 'عنبر أسود — ١٠٠ مل',
    productId: 'prd-11', version: 'v1.6', expectedLossRate: 0.035,
    perfumerNotes: 'Heavy amber-vanilla. Winter seller. Too sweet for the summer months — plan production around that.',
    lines: L([
      ['mat-amber', 6.8], ['mat-vanilla', 1.6], ['mat-tonka', 1.2],
      ['mat-patchouli', 2.2], ['mat-frank', 0.6], ['mat-cardamom', 0.5],
      ['mat-isoe', 5.0], ['mat-ambroxan', 1.8], ['mat-cashmeran', 1.4],
      ['mat-alcohol', 72], ['mat-dpg', 2.2], ['mat-bb', 0.9],
      ...pack100(),
    ]),
  },
  {
    id: 'frm-12', code: 'F-SDR-050', nameEn: 'Sidr — 50 ml EDT', nameAr: 'سدر — ٥٠ مل',
    productId: 'prd-12', version: 'v0.9', expectedLossRate: 0.05,
    perfumerNotes: 'Still in development. Green woody, meant to read local. Loss rate high while we dial it in.',
    lines: L([
      ['mat-cedar', 2.6], ['mat-vetiver', 0.8], ['mat-oakmoss', 0.3],
      ['mat-geranium', 0.7], ['mat-lemon', 1.2], ['mat-pinkpepper', 0.5],
      ['mat-isoe', 2.2], ['mat-musk', 1.0],
      ['mat-alcohol', 41], ['mat-dpg', 1.0], ['mat-bb', 0.3],
      ...pack50('mat-cap-wood'),
    ]),
  },
]

/** Material cost of one unit straight from the formula — used to sanity-set prices. */
const formulaUnitCost = (f: Formula) =>
  f.lines.reduce((s, l) => s + l.qtyPerUnit * matCost(l.materialId), 0) * (1 + f.expectedLossRate)

// ===========================================================================
// PRODUCTS
// ===========================================================================

export const products: Product[] = [
  {
    id: 'prd-01', sku: 'HMY-LYL-50', nameEn: 'Layl Oud', nameAr: 'ليل عود',
    family: 'oriental', concentration: 'EDP', sizeMl: 50, formulaId: 'frm-01',
    price: 420, wholesalePrice: 265, stockQty: 138, reorderLevel: 40,
    status: 'active', launchDate: '2025-09-04',
    descriptionEn: 'Assam oud folded into saffron and Bulgarian rose, dried down over amber and cedar. The house signature.',
    descriptionAr: 'عود آسامي مع الزعفران والورد البلغاري، يستقر على العنبر وخشب الأرز. توقيع الدار.',
    topNotes: ['Saffron', 'Pink pepper'], heartNotes: ['Bulgarian rose', 'Frankincense'], baseNotes: ['Assam oud', 'Amber', 'Cedar'],
  },
  {
    id: 'prd-02', sku: 'HMY-LYL-100', nameEn: 'Layl Oud Intense', nameAr: 'ليل عود إنتنس',
    family: 'oriental', concentration: 'Parfum', sizeMl: 100, formulaId: 'frm-02',
    price: 780, wholesalePrice: 505, stockQty: 46, reorderLevel: 20,
    status: 'active', launchDate: '2025-11-18',
    descriptionEn: 'The signature at parfum strength, with Cambodian oud carried through the base. Twelve hours on skin.',
    descriptionAr: 'التوقيع بتركيز البارفان، مع عود كمبودي في القاعدة. يدوم اثنتي عشرة ساعة.',
    topNotes: ['Saffron'], heartNotes: ['Taif rose'], baseNotes: ['Cambodian oud', 'Sandalwood', 'Amber'],
  },
  {
    id: 'prd-03', sku: 'HMY-WRD-50', nameEn: 'Ward Taif', nameAr: 'ورد الطائف',
    family: 'floral', concentration: 'EDP', sizeMl: 50, formulaId: 'frm-03',
    price: 385, wholesalePrice: 245, stockQty: 112, reorderLevel: 35,
    status: 'active', launchDate: '2025-10-02',
    descriptionEn: 'Taif rose at the centre, lifted with pink pepper and softened into clean musk.',
    descriptionAr: 'ورد الطائف في القلب، مع الفلفل الوردي ومسك ناعم.',
    topNotes: ['Pink pepper'], heartNotes: ['Taif rose', 'Geranium', 'Ylang ylang'], baseNotes: ['White musk', 'Sandalwood'],
  },
  {
    id: 'prd-04', sku: 'HMY-RML-100', nameEn: 'Rimal', nameAr: 'رمال',
    family: 'woody', concentration: 'EDP', sizeMl: 100, formulaId: 'frm-04',
    price: 490, wholesalePrice: 315, stockQty: 74, reorderLevel: 25,
    status: 'active', launchDate: '2026-01-15',
    descriptionEn: 'Dry cedar and vetiver over warm skin. Built for the heat rather than against it.',
    descriptionAr: 'أرز جاف ونجيل على بشرة دافئة. صُمم ليناسب الحرّ لا ليقاومه.',
    topNotes: ['Cardamom', 'Pink pepper'], heartNotes: ['Vetiver', 'Patchouli'], baseNotes: ['Cedar', 'Ambroxan', 'Oakmoss'],
  },
  {
    id: 'prd-05', sku: 'HMY-YSM-50', nameEn: 'Yasmeen Nights', nameAr: 'ليالي الياسمين',
    family: 'floral', concentration: 'EDP', sizeMl: 50, formulaId: 'frm-05',
    price: 340, wholesalePrice: 215, stockQty: 96, reorderLevel: 30,
    status: 'active', launchDate: '2025-09-25',
    descriptionEn: 'Jasmine sambac picked at night, warmed with tonka and vanilla.',
    descriptionAr: 'ياسمين سامباك يُقطف ليلًا، بدفء التونكا والفانيليا.',
    topNotes: ['Bergamot'], heartNotes: ['Jasmine sambac', 'Ylang ylang'], baseNotes: ['Tonka', 'Vanilla', 'Musk'],
  },
  {
    id: 'prd-06', sku: 'HMY-SHR-50', nameEn: 'Sahar Musk', nameAr: 'مسك السحر',
    family: 'musk', concentration: 'EDP', sizeMl: 50, formulaId: 'frm-06',
    price: 295, wholesalePrice: 185, stockQty: 187, reorderLevel: 50,
    status: 'active', launchDate: '2025-08-28',
    descriptionEn: 'Soft white musk, barely there. The one people buy again without thinking.',
    descriptionAr: 'مسك أبيض ناعم وخفيف. العطر الذي يُعاد شراؤه دون تفكير.',
    topNotes: ['Lavender'], heartNotes: ['White musk'], baseNotes: ['Cashmeran', 'Ambroxan'],
  },
  {
    id: 'prd-07', sku: 'HMY-BHR-100', nameEn: 'Bahr', nameAr: 'بحر',
    family: 'fresh', concentration: 'EDT', sizeMl: 100, formulaId: 'frm-07',
    price: 260, wholesalePrice: 165, stockQty: 121, reorderLevel: 40,
    status: 'active', launchDate: '2026-03-10',
    descriptionEn: 'Sicilian lemon and bergamot over salt-dry ambroxan. The summer bottle.',
    descriptionAr: 'ليمون صقلي وبرغموت على أمبروكسان مالح. عطر الصيف.',
    topNotes: ['Bergamot', 'Sicilian lemon'], heartNotes: ['Lavender', 'Geranium'], baseNotes: ['Ambroxan', 'Cedar'],
  },
  {
    id: 'prd-08', sku: 'HMY-ZAF-50', nameEn: 'Zaafaran Royale', nameAr: 'زعفران رويال',
    family: 'oriental', concentration: 'Parfum', sizeMl: 50, formulaId: 'frm-08',
    price: 620, wholesalePrice: 405, stockQty: 58, reorderLevel: 20,
    status: 'active', launchDate: '2025-12-01',
    descriptionEn: 'Saffron, Taif rose and ambergris around a core of real oud. Our most expensive juice.',
    descriptionAr: 'زعفران وورد طائفي وعنبر حول قلب من العود الحقيقي. أغلى تركيباتنا.',
    topNotes: ['Saffron'], heartNotes: ['Taif rose', 'Frankincense'], baseNotes: ['Cambodian oud', 'Ambergris', 'Amber'],
  },
  {
    id: 'prd-09', sku: 'HMY-KHB-12', nameEn: 'Khashab Attar', nameAr: 'عطر خشب',
    family: 'oriental', concentration: 'Oil', sizeMl: 12, formulaId: 'frm-09',
    price: 340, wholesalePrice: 220, stockQty: 84, reorderLevel: 25,
    status: 'active', launchDate: '2025-10-20',
    descriptionEn: 'Alcohol-free oil attar — oud, sandalwood and amber on a DPG base. Traditional application.',
    descriptionAr: 'عطر زيتي خالٍ من الكحول — عود وصندل وعنبر على أساس DPG.',
    topNotes: ['Saffron'], heartNotes: ['Taif rose'], baseNotes: ['Assam oud', 'Sandalwood', 'Amber'],
  },
  {
    id: 'prd-10', sku: 'HMY-NDA-100', nameEn: 'Nada Blossom', nameAr: 'ندى الزهور',
    family: 'floral', concentration: 'Mist', sizeMl: 100, formulaId: 'frm-10',
    price: 145, wholesalePrice: 88, stockQty: 243, reorderLevel: 60,
    status: 'active', launchDate: '2026-02-05',
    descriptionEn: 'Light body mist. Jasmine and musk, made to be reapplied through the day.',
    descriptionAr: 'ميست خفيف للجسم. ياسمين ومسك، يُعاد رشّه خلال اليوم.',
    topNotes: ['Bergamot'], heartNotes: ['Jasmine', 'Rose'], baseNotes: ['White musk'],
  },
  {
    id: 'prd-11', sku: 'HMY-AMB-100', nameEn: 'Ambar Aswad', nameAr: 'عنبر أسود',
    family: 'oriental', concentration: 'EDP', sizeMl: 100, formulaId: 'frm-11',
    price: 560, wholesalePrice: 360, stockQty: 39, reorderLevel: 25,
    status: 'active', launchDate: '2025-11-05',
    descriptionEn: 'Amber, vanilla and tonka pulled dark with patchouli. A winter perfume.',
    descriptionAr: 'عنبر وفانيليا وتونكا مع باتشولي داكن. عطر شتوي.',
    topNotes: ['Cardamom'], heartNotes: ['Amber', 'Patchouli'], baseNotes: ['Vanilla', 'Tonka', 'Ambroxan'],
  },
  {
    id: 'prd-12', sku: 'HMY-SDR-50', nameEn: 'Sidr', nameAr: 'سدر',
    family: 'woody', concentration: 'EDT', sizeMl: 50, formulaId: 'frm-12',
    price: 235, wholesalePrice: 150, stockQty: 12, reorderLevel: 30,
    status: 'draft', launchDate: '2026-10-01',
    descriptionEn: 'In development — green woody built around sidr and cedar. Not released.',
    descriptionAr: 'قيد التطوير — خشبي أخضر حول السدر والأرز. لم يُطرح بعد.',
    topNotes: ['Sicilian lemon'], heartNotes: ['Geranium', 'Vetiver'], baseNotes: ['Cedar', 'Oakmoss'],
  },
]

// ===========================================================================
// PRODUCTION BATCHES
// ===========================================================================

const batchPlan: Array<[productId: string, formulaId: string, monthsBack: number, day: number, units: number, trouble?: 'none' | 'minor' | 'bad']> = [
  ['prd-06', 'frm-06', 11, 6, 200], ['prd-01', 'frm-01', 11, 19, 150],
  ['prd-03', 'frm-03', 10, 8, 120], ['prd-05', 'frm-05', 10, 22, 120, 'minor'],
  ['prd-01', 'frm-01', 9, 5, 180], ['prd-09', 'frm-09', 9, 17, 100],
  ['prd-08', 'frm-08', 8, 3, 90, 'bad'], ['prd-11', 'frm-11', 8, 14, 80],
  ['prd-02', 'frm-02', 8, 26, 70], ['prd-06', 'frm-06', 7, 9, 250],
  ['prd-03', 'frm-03', 7, 21, 140], ['prd-08', 'frm-08', 6, 4, 110],
  ['prd-01', 'frm-01', 6, 16, 200], ['prd-04', 'frm-04', 6, 27, 100],
  ['prd-10', 'frm-10', 5, 7, 300], ['prd-05', 'frm-05', 5, 18, 130],
  ['prd-08', 'frm-08', 4, 2, 160], ['prd-01', 'frm-01', 4, 11, 220, 'minor'],
  ['prd-02', 'frm-02', 4, 24, 90], ['prd-06', 'frm-06', 3, 6, 260],
  ['prd-07', 'frm-07', 3, 15, 180], ['prd-11', 'frm-11', 3, 28, 85, 'bad'],
  ['prd-03', 'frm-03', 2, 9, 150], ['prd-07', 'frm-07', 2, 20, 200],
  ['prd-09', 'frm-09', 1, 5, 120], ['prd-01', 'frm-01', 1, 14, 190],
  ['prd-10', 'frm-10', 1, 25, 280], ['prd-06', 'frm-06', 0, 3, 240],
]

const operators = ['Ibrahim Nasser', 'Ibrahim Nasser', 'Farah Al Marzooqi', 'Rani Perera']

export const batches: ProductionBatch[] = batchPlan.map(([productId, formulaId, mb, day, plannedBase, trouble = 'none'], i) => {
  const formula = formulas.find((f) => f.id === formulaId)!
  // Batch sizes are scaled so the year's output covers what sold plus the
  // stock still sitting on the shelf — not wildly more.
  const planned = Math.round(plannedBase * 1.05)
  const start = dateIn(mb, day)

  // Yield: how many units actually came off the bench versus the plan.
  const yieldFactor =
    trouble === 'bad' ? between(0.82, 0.9) : trouble === 'minor' ? between(0.93, 0.97) : between(0.97, 1.0)
  const actualUnits = Math.round(planned * yieldFactor)
  const rejectedUnits =
    trouble === 'bad' ? intBetween(4, 11) : trouble === 'minor' ? intBetween(1, 4) : chance(0.35) ? intBetween(0, 2) : 0

  // Material variance: over-pour on the oils is where money actually leaks.
  const overFactor =
    trouble === 'bad' ? between(0.06, 0.14) : trouble === 'minor' ? between(0.02, 0.06) : between(-0.01, 0.025)

  const consumption = formula.lines.map((line) => {
    const mat = materials.find((m) => m.id === line.materialId)!
    const expectedQty = round(line.qtyPerUnit * actualUnits, 3)
    let actualQty: number
    if (mat.unit === 'pcs') {
      // Packaging is counted, not poured — breakage is whole units only.
      const breakage = trouble === 'bad' ? intBetween(2, 7) : chance(0.4) ? intBetween(0, 3) : 0
      actualQty = expectedQty + breakage
    } else {
      const jitter = overFactor + between(-0.015, 0.02)
      actualQty = round(expectedQty * (1 + jitter), 3)
    }
    return { materialId: line.materialId, expectedQty, actualQty }
  })

  const isDone = mb > 0 || day < 8
  const status: ProductionBatch['status'] =
    mb === 0 && day >= 3 ? (chance(0.5) ? 'macerating' : 'in_progress') : 'completed'

  return {
    id: `bch-${String(i + 1).padStart(2, '0')}`,
    batchNo: `B-${start.slice(2, 4)}${start.slice(5, 7)}-${String(i + 1).padStart(3, '0')}`,
    productId,
    formulaId,
    startDate: start,
    endDate: isDone && status === 'completed' ? dateIn(mb, Math.min(28, day + intBetween(14, 24))) : null,
    status: isDone ? status : 'in_progress',
    plannedUnits: planned,
    actualUnits,
    rejectedUnits,
    consumption,
    labourCost: round(actualUnits * between(1.8, 3.4), 2),
    overheadCost: round(between(280, 720), 2),
    operator: pickOne(operators),
    notes:
      trouble === 'bad'
        ? 'Bad run. Over-poured the compound and the crimping went wrong on part of the lot — several bottles leaked at the collar and were scrapped.'
        : trouble === 'minor'
          ? 'Slight over-pour on the oils. Nothing serious, but worth watching on the next run.'
          : undefined,
  }
})

// Batches still on the bench should not have a completion date.
for (const b of batches) {
  if (b.status !== 'completed') {
    b.endDate = null
    b.rejectedUnits = 0
  }
}

// ===========================================================================
// CUSTOMERS
// ===========================================================================

const custSeed: Array<[name: string, nameAr: string, city: string, type: Customer['type'], source: string]> = [
  ['Fatima Al Mansoori', 'فاطمة المنصوري', 'Abu Dhabi', 'vip', 'instagram'],
  ['Noura Al Suwaidi', 'نورة السويدي', 'Dubai', 'vip', 'referral'],
  ['Hessa Al Ketbi', 'حصة الكتبي', 'Al Ain', 'vip', 'event'],
  ['Mariam Al Shamsi', 'مريم الشامسي', 'Sharjah', 'retail', 'instagram'],
  ['Aisha Al Blooshi', 'عائشة البلوشي', 'Dubai', 'retail', 'tiktok'],
  ['Latifa Al Hosani', 'لطيفة الحوسني', 'Abu Dhabi', 'vip', 'referral'],
  ['Sara Khalifa', 'سارة خليفة', 'Dubai', 'retail', 'instagram'],
  ['Reem Abdulrahman', 'ريم عبدالرحمن', 'Dubai', 'retail', 'website'],
  ['Layla Haddad', 'ليلى حداد', 'Sharjah', 'retail', 'instagram'],
  ['Huda Kassem', 'هدى قاسم', 'Ajman', 'retail', 'whatsapp'],
  ['Yasmin Farouk', 'ياسمين فاروق', 'Dubai', 'retail', 'tiktok'],
  ['Dana Al Qassimi', 'دانة القاسمي', 'Ras Al Khaimah', 'vip', 'event'],
  ['Amal Zahra', 'أمل زهرة', 'Dubai', 'retail', 'instagram'],
  ['Rania Mostafa', 'رانيا مصطفى', 'Abu Dhabi', 'retail', 'website'],
  ['Salma Bin Touq', 'سلمى بن طوق', 'Dubai', 'vip', 'referral'],
  ['Khalid Al Rumaithi', 'خالد الرميثي', 'Abu Dhabi', 'retail', 'instagram'],
  ['Omar Sheikh', 'عمر شيخ', 'Dubai', 'retail', 'google'],
  ['Ahmed Al Nuaimi', 'أحمد النعيمي', 'Ajman', 'retail', 'whatsapp'],
  ['Saif Al Dhaheri', 'سيف الظاهري', 'Al Ain', 'vip', 'referral'],
  ['Rashid Al Mheiri', 'راشد المهيري', 'Dubai', 'retail', 'store'],
  ['Priya Nair', 'بريا ناير', 'Dubai', 'retail', 'instagram'],
  ['Anjali Menon', 'أنجالي مينون', 'Sharjah', 'retail', 'tiktok'],
  ['Zainab Iqbal', 'زينب إقبال', 'Dubai', 'retail', 'website'],
  ['Farhan Malik', 'فرحان مالك', 'Dubai', 'retail', 'google'],
  ['Ayesha Rahman', 'عائشة رحمن', 'Sharjah', 'retail', 'whatsapp'],
  ['Sophie Laurent', 'صوفي لوران', 'Dubai', 'retail', 'instagram'],
  ['Emma Whitfield', 'إيما ويتفيلد', 'Dubai', 'vip', 'event'],
  ['Julia Kowalski', 'يوليا كوفالسكي', 'Abu Dhabi', 'retail', 'website'],
  ['Marco Rossi', 'ماركو روسي', 'Dubai', 'retail', 'google'],
  ['Elena Petrova', 'إيلينا بتروفا', 'Dubai', 'vip', 'referral'],
  ['Maryam Al Zaabi', 'مريم الزعابي', 'Abu Dhabi', 'retail', 'instagram'],
  ['Shaikha Al Falasi', 'شيخة الفلاسي', 'Dubai', 'vip', 'referral'],
  ['Nada Suleiman', 'ندى سليمان', 'Sharjah', 'retail', 'tiktok'],
  ['Hind Al Ali', 'هند العلي', 'Fujairah', 'retail', 'whatsapp'],
  ['Wafa Al Kaabi', 'وفاء الكعبي', 'Abu Dhabi', 'retail', 'instagram'],
  ['Ghaya Al Muhairi', 'غاية المهيري', 'Dubai', 'vip', 'event'],
]

const wholesaleSeed: Array<[name: string, nameAr: string, city: string]> = [
  ['Perfumery Corner LLC', 'ركن العطور ذ.م.م', 'Dubai'],
  ['Al Wahda Gifts Trading', 'الوحدة للهدايا', 'Abu Dhabi'],
  ['Souq Al Ateeq Stores', 'متاجر سوق العتيق', 'Sharjah'],
  ['Bloom Beauty Retail', 'بلوم للتجميل', 'Dubai'],
  ['Marina Concept Store', 'مارينا كونسبت', 'Dubai'],
  ['Emirati Scents Distribution', 'توزيع العطور الإماراتية', 'Abu Dhabi'],
]

const tagPool = ['oud lover', 'rose', 'gifting', 'repeat buyer', 'high value', 'ramadan', 'summer scents', 'niche', 'price sensitive', 'influencer']
const families: Product['family'][] = ['oriental', 'floral', 'woody', 'fresh', 'musk']

// A larger tail of ordinary retail customers, generated so the book looks like
// a real one — a few big spenders and a long tail of one- and two-time buyers.
const firstNames = [
  'Alya', 'Moza', 'Shaikha', 'Amna', 'Maitha', 'Roudha', 'Sheikha', 'Fakhra', 'Ayesha', 'Salama',
  'Nouf', 'Jawaher', 'Asma', 'Iman', 'Mona', 'Rasha', 'Heba', 'Doaa', 'Manal', 'Samar',
  'Tala', 'Lana', 'Zeina', 'Farah', 'Rima', 'Maya', 'Karma', 'Jana', 'Talia', 'Sirine',
  'Divya', 'Meera', 'Kavya', 'Riya', 'Sneha', 'Pooja', 'Nisha', 'Aarti',
  'Hassan', 'Youssef', 'Mohammed', 'Abdulla', 'Sultan', 'Majid', 'Faisal', 'Zayed',
  'Daniel', 'Thomas', 'Lucas', 'Adam', 'Nathan', 'Oliver',
]
const lastNames = [
  'Al Marri', 'Al Mazrouei', 'Al Suwaidi', 'Al Hammadi', 'Al Shehhi', 'Al Naqbi', 'Al Ameri',
  'Al Kaabi', 'Al Dhaheri', 'Al Blooshi', 'Al Zaabi', 'Bin Hendi', 'Al Owais', 'Al Rashed',
  'Haddad', 'Khoury', 'Mansour', 'Saleh', 'Darwish', 'Fahmy', 'Aziz', 'Barakat', 'Zeidan',
  'Nair', 'Menon', 'Sharma', 'Iqbal', 'Rahman', 'Khan', 'Pillai',
  'Novak', 'Bennett', 'Fischer', 'Moreau', 'Rossi', 'Lindqvist',
]
const uaeCities = ['Dubai', 'Dubai', 'Dubai', 'Abu Dhabi', 'Abu Dhabi', 'Sharjah', 'Sharjah', 'Ajman', 'Al Ain', 'Ras Al Khaimah', 'Fujairah', 'Umm Al Quwain']
const sourcePool = ['instagram', 'instagram', 'tiktok', 'website', 'whatsapp', 'referral', 'store', 'google', 'event']

const generatedRetail = Array.from({ length: 352 }, () => {
  const name = `${pickOne(firstNames)} ${pickOne(lastNames)}`
  return [name, '', pickOne(uaeCities), (chance(0.08) ? 'vip' : 'retail') as Customer['type'], pickOne(sourcePool)] as
    [string, string, string, Customer['type'], string]
})

export const customers: Customer[] = [
  ...[...custSeed, ...generatedRetail].map(([name, nameAr, city, type, source], i) => ({
    id: `cus-${String(i + 1).padStart(3, '0')}`,
    code: `C-${String(i + 1).padStart(4, '0')}`,
    name, nameAr: nameAr || undefined, city, country: 'UAE', type, source,
    phone: `+971 5${intBetween(0, 8)} ${intBetween(200, 999)} ${intBetween(1000, 9999)}`,
    email: `${name.toLowerCase().replace(/[^a-z]+/g, '.')}@${pickOne(['gmail.com', 'outlook.com', 'icloud.com', 'yahoo.com'])}`,
    tags: Array.from(new Set([pickOne(tagPool), ...(chance(0.5) ? [pickOne(tagPool)] : [])])),
    preferredFamily: pickOne(families),
    birthday: chance(0.6) ? `19${intBetween(80, 99)}-${String(intBetween(1, 12)).padStart(2, '0')}-${String(intBetween(1, 28)).padStart(2, '0')}` : undefined,
    createdAt: daysAgo(intBetween(20, 350)),
    notes: chance(0.3) ? pickOne([
      'Prefers WhatsApp over calls. Replies late in the evening.',
      'Buys twice a year, always before Eid. Worth a reminder message.',
      'Sensitive to alcohol on skin — steer her to the attar line.',
      'Asked to be told first whenever a new oud launches.',
      'Bought as a gift the first time, came back for herself.',
      'Complained about a leaking sprayer once — replaced free, stayed loyal.',
    ]) : undefined,
  })),
  ...wholesaleSeed.map(([name, nameAr, city], i) => ({
    id: `cus-${String(custSeed.length + generatedRetail.length + i + 1).padStart(3, '0')}`,
    code: `C-${String(custSeed.length + generatedRetail.length + i + 1).padStart(4, '0')}`,
    name, nameAr, city, country: 'UAE',
    type: 'wholesale' as const,
    source: 'wholesale',
    phone: `+971 ${intBetween(2, 6)} ${intBetween(200, 899)} ${intBetween(1000, 9999)}`,
    email: `purchasing@${name.toLowerCase().replace(/[^a-z]+/g, '')}.ae`,
    tags: ['wholesale', 'net 30'],
    createdAt: daysAgo(intBetween(120, 360)),
    notes: pickOne([
      'Orders on a 30-day account. Reliable, but always pays on day 29.',
      'Takes the attar line only. Wants exclusivity in their emirate — not agreed.',
      'Seasonal buyer — big Ramadan order, quiet the rest of the year.',
      'Started small, growing steadily. Worth better terms next year.',
    ]),
  })),
]

// ===========================================================================
// ORDERS
// ===========================================================================

const activeProducts = products.filter((p) => p.status === 'active')
/** Weighted so Instagram carries the brand, as it does for most niche houses. */
const retailChannels: Order['channel'][] = [
  'instagram', 'instagram', 'instagram', 'instagram', 'instagram',
  'whatsapp', 'whatsapp', 'whatsapp',
  'website', 'website',
  'tiktok', 'tiktok',
  'store',
  'referral',
]

/** Rough demand curve: launch ramp, Ramadan/Eid spike around Feb–Mar, summer dip. */
const monthWeight = [
  /* 11 back = Sep 25 */ 0.5, 0.6, 0.75, 0.95, 0.85, 1.05, 1.6, 1.45, 1.0, 0.9, 0.8, 0.85,
]

export const orders: Order[] = []
let orderCounter = 0

for (let mb = 11; mb >= 0; mb--) {
  const weight = monthWeight[11 - mb]
  const retailCount = Math.round(between(70, 95) * weight)
  const wholesaleCount = mb % 2 === 0 ? intBetween(2, 4) : intBetween(1, 3)

  for (let k = 0; k < retailCount; k++) {
    const customer = pickOne(customers.filter((c) => c.type !== 'wholesale'))
    const day = intBetween(1, 28)
    const lineCount = chance(0.62) ? 1 : chance(0.75) ? 2 : 3
    const chosen = new Set<string>()
    const items = []
    for (let n = 0; n < lineCount; n++) {
      const p = pickOne(activeProducts)
      if (chosen.has(p.id)) continue
      chosen.add(p.id)
      const q = chance(0.82) ? 1 : intBetween(2, 3)
      items.push({
        productId: p.id,
        qty: q,
        unitPrice: p.price,
        discount: chance(0.18) ? round(p.price * q * pickOne([0.05, 0.1, 0.15]), 2) : 0,
      })
    }
    if (!items.length) continue

    const age = mb * 30 + (28 - day)
    const status: Order['status'] =
      age > 20 ? (chance(0.04) ? (chance(0.5) ? 'returned' : 'cancelled') : 'delivered')
        : age > 8 ? 'delivered'
        : age > 4 ? 'shipped'
        : age > 2 ? 'packed'
        : 'confirmed'

    const paid = status === 'cancelled' || status === 'returned'
      ? (chance(0.5) ? 'refunded' : 'unpaid')
      : chance(0.86) ? 'paid' : chance(0.5) ? 'partial' : 'unpaid'

    const subtotal = items.reduce((s, i) => s + i.qty * i.unitPrice - i.discount, 0)
    const shipping = subtotal >= 300 ? 0 : 25
    const total = subtotal * 1.05 + shipping

    orderCounter++
    orders.push({
      id: `ord-${String(orderCounter).padStart(4, '0')}`,
      orderNo: `HMY-${dateIn(mb, day).slice(2, 4)}${dateIn(mb, day).slice(5, 7)}-${String(orderCounter).padStart(4, '0')}`,
      customerId: customer.id,
      date: dateIn(mb, day),
      channel: pickOne(retailChannels),
      status,
      paymentStatus: paid as Order['paymentStatus'],
      paymentMethod: pickOne(['card', 'card', 'cash', 'transfer', 'cod', 'tabby'] as const),
      items,
      shipping,
      orderDiscount: 0,
      vatRate: 0.05,
      amountPaid: paid === 'paid' ? round(total, 2) : paid === 'partial' ? round(total * between(0.3, 0.6), 2) : 0,
      campaignId: null,
    })
  }

  for (let k = 0; k < wholesaleCount; k++) {
    const customer = pickOne(customers.filter((c) => c.type === 'wholesale'))
    const day = intBetween(1, 28)
    const items = Array.from({ length: intBetween(2, 4) }, () => pickOne(activeProducts))
      .filter((p, idx, arr) => arr.findIndex((x) => x.id === p.id) === idx)
      .map((p) => ({
        productId: p.id,
        qty: intBetween(10, 32),
        unitPrice: p.wholesalePrice,
        discount: 0,
      }))

    const age = mb * 30 + (28 - day)
    const subtotal = items.reduce((s, i) => s + i.qty * i.unitPrice, 0)
    const total = subtotal * 1.05
    const paid: Order['paymentStatus'] = age > 45 ? 'paid' : age > 25 ? (chance(0.6) ? 'paid' : 'partial') : 'unpaid'

    orderCounter++
    orders.push({
      id: `ord-${String(orderCounter).padStart(4, '0')}`,
      orderNo: `HMY-${dateIn(mb, day).slice(2, 4)}${dateIn(mb, day).slice(5, 7)}-${String(orderCounter).padStart(4, '0')}`,
      customerId: customer.id,
      date: dateIn(mb, day),
      channel: 'wholesale',
      status: age > 10 ? 'delivered' : 'shipped',
      paymentStatus: paid,
      paymentMethod: 'transfer',
      items,
      shipping: 0,
      orderDiscount: 0,
      vatRate: 0.05,
      amountPaid: paid === 'paid' ? round(total, 2) : paid === 'partial' ? round(total * 0.5, 2) : 0,
      notes: 'Account order — 30 day terms.',
    })
  }
}

orders.sort((a, b) => (a.date < b.date ? 1 : -1))

// ===========================================================================
// INTERACTIONS
// ===========================================================================

const interactionTemplates: Array<[Interaction['type'], string]> = [
  ['whatsapp', 'Asked whether Layl Oud lasts in the heat. Sent her the 2 ml sample instead of arguing.'],
  ['whatsapp', 'Wanted to know when Zaafaran Royale is back. Told her the batch finishes macerating in two weeks.'],
  ['call', 'Called about a delayed delivery. Courier had the wrong building number — resolved same day.'],
  ['call', 'Follow-up after first purchase. Happy with the scent, said the box felt cheap. Noted.'],
  ['email', 'Sent the wholesale price list and minimum order terms.'],
  ['email', 'Shared the Eid gift set proposal — three 50 ml bottles in one box.'],
  ['visit', 'Came to the studio, smelled the full range. Left with Ward Taif and a Sahar Musk for her sister.'],
  ['visit', 'Walk-in from the Instagram ad. Bought on the spot without sampling.'],
  ['note', 'Prefers lighter florals. Do not push the oud line at her.'],
  ['note', 'Mentioned her daughter is getting married in spring — potential bulk gifting order.'],
  ['whatsapp', 'Complained the sprayer was stiff. Sent a replacement bottle, no charge.'],
  ['note', 'Very price aware. Only ever buys during a promotion.'],
  ['call', 'Reorder call before Ramadan. Took four bottles for the family.'],
  ['whatsapp', 'Asked for an alcohol-free option — moved her to Khashab Attar. Worked.'],
]

export const interactions: Interaction[] = []
let interactionCounter = 0
for (const c of customers) {
  const n = c.type === 'vip' ? intBetween(3, 6) : c.type === 'wholesale' ? intBetween(2, 5) : intBetween(0, 3)
  for (let i = 0; i < n; i++) {
    const [type, summary] = pickOne(interactionTemplates)
    interactionCounter++
    interactions.push({
      id: `int-${String(interactionCounter).padStart(4, '0')}`,
      customerId: c.id,
      date: daysAgo(intBetween(1, 320)),
      type,
      summary,
      by: pickOne(['Amr', 'Layla (sales)', 'Farah (studio)']),
    })
  }
}
interactions.sort((a, b) => (a.date < b.date ? 1 : -1))

// ===========================================================================
// PURCHASE ORDERS
// ===========================================================================

const poPlan: Array<[supplierId: string, monthsBack: number, day: number, items: Array<[string, number, number]>]> = [
  ['sup-07', 11, 4, [['mat-alcohol', 25000, 0.082], ['mat-dpg', 4000, 0.058], ['mat-bb', 2000, 0.108]]],
  ['sup-05', 11, 12, [['mat-btl-50', 800, 11.2], ['mat-pump', 1200, 3.6], ['mat-label', 3000, 0.82]]],
  ['sup-01', 10, 7, [['mat-oud-assam', 60, 162], ['mat-saffron', 40, 41], ['mat-frank', 200, 9.2]]],
  ['sup-06', 10, 19, [['mat-cap-gold', 1000, 6.0], ['mat-box-50', 900, 7.7], ['mat-pouch', 500, 4.05]]],
  ['sup-02', 9, 9, [['mat-rose-bulg', 100, 70], ['mat-jasmine', 120, 52], ['mat-vanilla', 150, 27], ['mat-bergamot', 800, 2.3]]],
  ['sup-03', 8, 15, [['mat-isoe', 3000, 0.4], ['mat-ambroxan', 500, 3.75], ['mat-musk', 1200, 4.3], ['mat-amber', 900, 5.0]]],
  ['sup-05', 7, 6, [['mat-btl-100', 500, 16.4], ['mat-btl-30', 600, 6.25], ['mat-label-back', 3000, 0.33]]],
  ['sup-08', 7, 22, [['mat-rose-taif', 120, 85]]],
  ['sup-04', 6, 11, [['mat-oud-assam', 80, 158], ['mat-sandal', 100, 44.5], ['mat-btl-12', 400, 8.7]]],
  ['sup-07', 5, 3, [['mat-alcohol', 30000, 0.084], ['mat-water', 15000, 0.009], ['mat-ipm', 1500, 0.135]]],
  ['sup-06', 4, 17, [['mat-cap-silver', 600, 5.6], ['mat-cap-wood', 400, 7.3], ['mat-box-100', 500, 9.4], ['mat-box-attar', 350, 6.3]]],
  ['sup-02', 3, 8, [['mat-lemon', 900, 1.85], ['mat-lavender', 600, 2.72], ['mat-geranium', 300, 3.5], ['mat-vetiver', 250, 6.6]]],
  ['sup-05', 2, 14, [['mat-btl-50', 900, 11.5], ['mat-cello', 2500, 0.58], ['mat-label', 2500, 0.85]]],
  ['sup-01', 1, 9, [['mat-oud-camb', 25, 315], ['mat-ambergris', 40, 58], ['mat-saffron', 50, 42]]],
  ['sup-03', 0, 5, [['mat-isoe', 2000, 0.42], ['mat-cashmeran', 300, 2.55], ['mat-musk', 800, 4.5]]],
]

export const purchases: Purchase[] = poPlan.map(([supplierId, mb, day, items], i) => {
  const date = dateIn(mb, day)
  const goods = items.reduce((s, [, q, c]) => s + q * c, 0)
  const supplier = suppliers.find((s) => s.id === supplierId)!
  const imported = supplier.country !== 'UAE'
  const shipping = imported ? round(between(350, 1400), 2) : round(between(0, 150), 2)
  const customsDuty = imported ? round(goods * 0.05, 2) : 0
  const total = goods + shipping + customsDuty
  const status: Purchase['status'] = mb === 0 ? (chance(0.5) ? 'ordered' : 'partial') : 'received'
  const paymentStatus: Purchase['paymentStatus'] =
    mb === 0 ? (chance(0.5) ? 'partial' : 'unpaid')
    : mb === 1 ? 'partial'
    : mb === 2 ? (chance(0.5) ? 'partial' : 'paid')
    : 'paid'

  return {
    id: `pur-${String(i + 1).padStart(3, '0')}`,
    poNo: `PO-${date.slice(2, 4)}${date.slice(5, 7)}-${String(i + 1).padStart(3, '0')}`,
    supplierId,
    date,
    expectedDate: dateIn(mb, Math.min(28, day + (imported ? intBetween(20, 42) : intBetween(3, 8)))),
    status,
    paymentStatus,
    items: items.map(([materialId, qty, unitCost]) => ({ materialId, qty, unitCost })),
    shipping,
    customsDuty,
    amountPaid: paymentStatus === 'paid' ? round(total, 2) : paymentStatus === 'partial' ? round(total * 0.5, 2) : 0,
    notes: imported ? 'Imported — customs cleared at Jebel Ali.' : undefined,
  }
})

// ===========================================================================
// MARKETING
// ===========================================================================

const campaignPlan: Array<[name: string, nameAr: string, channel: Campaign['channel'], mb: number, days: number, budget: number, quality: number]> = [
  ['Launch — Layl Oud', 'إطلاق ليل عود', 'instagram', 11, 30, 6000, 1.0],
  ['Autumn Discovery Set', 'مجموعة اكتشاف الخريف', 'instagram', 9, 28, 4500, 0.85],
  ['Influencer Seeding — Gulf Beauty', 'حملة المؤثرين — جمال الخليج', 'influencer', 8, 35, 12000, 1.35],
  ['National Day Gifting', 'هدايا اليوم الوطني', 'snapchat', 8, 14, 3500, 0.7],
  ['Winter Amber Push', 'حملة العنبر الشتوية', 'instagram', 6, 30, 7500, 1.1],
  ['Ramadan — Zaafaran Royale', 'رمضان — زعفران رويال', 'instagram', 5, 32, 18000, 1.6],
  ['Eid Gift Sets', 'مجموعات هدايا العيد', 'tiktok', 4, 21, 14000, 1.45],
  ['Search — Niche Perfume UAE', 'بحث — عطور نيش الإمارات', 'google', 3, 60, 9000, 0.95],
  ['Summer Fresh — Bahr', 'صيف منعش — بحر', 'tiktok', 2, 30, 8500, 1.05],
  ['VIP Re-engagement', 'إعادة تفعيل العملاء المميزين', 'whatsapp', 1, 14, 1200, 2.2],
  ['Back to Scent — August', 'العودة للعطر — أغسطس', 'instagram', 0, 21, 6500, 0.9],
]

export const campaigns: Campaign[] = campaignPlan.map(([name, nameAr, channel, mb, days, budget, quality], i) => {
  const running = mb === 0
  const spend = round(budget * (running ? between(0.35, 0.65) : between(0.88, 1.02)), 2)
  const cpm = channel === 'google' ? between(28, 45) : channel === 'influencer' ? between(12, 20) : between(18, 32)
  const impressions = Math.round((spend / cpm) * 1000)
  const ctr = channel === 'google' ? between(0.035, 0.06) : between(0.008, 0.022)
  const clicks = Math.round(impressions * ctr)
  const leads = Math.round(clicks * between(0.06, 0.14))
  const ordersCount = Math.round(leads * between(0.18, 0.4) * quality)
  const aov = between(310, 520)

  return {
    id: `cmp-${String(i + 1).padStart(2, '0')}`,
    name, nameAr, channel,
    status: running ? 'running' : 'completed',
    startDate: dateIn(mb, 2),
    endDate: dateIn(mb, 2 + days > 28 ? 28 : 2 + days),
    budget,
    spend,
    impressions,
    clicks,
    leads,
    orders: ordersCount,
    revenue: round(ordersCount * aov, 2),
    notes: quality >= 1.3
      ? 'Best performing spend of the year. Repeat it.'
      : quality <= 0.75
        ? 'Underperformed. Creative was reused from a previous campaign — that was the mistake.'
        : undefined,
  }
})

const leadNames = [
  'Shamma Al Otaiba', 'Mouza Al Ameri', 'Ibtisam Saleh', 'Karim Nasrallah', 'Dina Wahba',
  'Fatma Al Balushi', 'Hamda Al Shehhi', 'Rawan Idris', 'Tariq Bin Sultan', 'Nour El Sayed',
  'Alia Al Hammadi', 'Sanjay Kapoor', 'Mira Haddadin', 'Badria Al Naqbi', 'Leen Ajami',
  'Ghada Barakat', 'Hessa Al Mazrouei', 'Ola Zeidan', 'Basma Al Jaberi', 'Rita Chalhoub',
  'Meera Al Tayer', 'Sultan Al Qubaisi', 'Nadia Bousetta', 'Joud Al Rashed', 'Areej Sami',
  'Salem Al Kindi', 'Hala Mansour', 'Fajr Al Dosari', 'Amna Al Nuaimi', 'Yara Sabbagh',
]

const leadStatuses: Lead['status'][] = ['new', 'contacted', 'qualified', 'won', 'lost']

export const leads: Lead[] = leadNames.map((name, i) => {
  const campaign = chance(0.75) ? pickOne(campaigns) : null
  const status = pickOne(leadStatuses)
  return {
    id: `led-${String(i + 1).padStart(3, '0')}`,
    name,
    phone: `+971 5${intBetween(0, 8)} ${intBetween(200, 999)} ${intBetween(1000, 9999)}`,
    email: chance(0.6) ? `${name.toLowerCase().replace(/[^a-z]+/g, '.')}@${pickOne(['gmail.com', 'outlook.com'])}` : undefined,
    source: (campaign?.channel ?? pickOne(['walk-in', 'referral'] as const)) as Lead['source'],
    campaignId: campaign?.id ?? null,
    status,
    estimatedValue: round(between(250, 1800), 0),
    createdAt: daysAgo(intBetween(2, 150)),
    owner: pickOne(['Amr', 'Layla (sales)']),
    notes: chance(0.4) ? pickOne([
      'Asked for a sample set before committing.',
      'Wants a bulk quote for corporate Eid gifts — 60 to 80 units.',
      'Followed from the influencer video. Very engaged in DMs.',
      'Price was the objection. Offered the mist as an entry point.',
      'Went quiet after the second message. Try again before Ramadan.',
    ]) : undefined,
  }
})

// ===========================================================================
// EXPENSES
// ===========================================================================

export const expenses: Expense[] = []
let expenseCounter = 0
const addExpense = (e: Omit<Expense, 'id'>) => {
  expenseCounter++
  expenses.push({ id: `exp-${String(expenseCounter).padStart(4, '0')}`, ...e })
}

for (let mb = 11; mb >= 0; mb--) {
  addExpense({ date: dateIn(mb, 1), category: 'rent', description: 'Studio & production unit — Al Quoz', amount: 8500, vendor: 'Dubai Investments Real Estate', paymentMethod: 'transfer', recurring: true })
  addExpense({ date: dateIn(mb, 28), category: 'salaries', description: 'Team salaries (3 staff)', amount: 18500, vendor: undefined, paymentMethod: 'transfer', recurring: true })
  addExpense({ date: dateIn(mb, 5), category: 'utilities', description: 'DEWA + Etisalat', amount: round(between(880, 1650), 2), vendor: 'DEWA / Etisalat', paymentMethod: 'card', recurring: true })
  addExpense({ date: dateIn(mb, 12), category: 'shipping', description: 'Courier account — retail deliveries', amount: round(between(950, 2600), 2), vendor: 'Aramex', paymentMethod: 'card', recurring: true })
  addExpense({ date: dateIn(mb, 20), category: 'software', description: 'Shopify, Meta tools, design subscriptions', amount: round(between(420, 680), 2), vendor: 'Various', paymentMethod: 'card', recurring: true })
  if (chance(0.5)) addExpense({ date: dateIn(mb, intBetween(6, 24)), category: 'packaging', description: pickOne(['Tissue paper and filler', 'Branded shipping cartons', 'Gift ribbon and seals', 'Sample vials for outreach']), amount: round(between(380, 1500), 2), vendor: 'Emirates Glass & Packaging', paymentMethod: 'card', recurring: false })
  if (chance(0.3)) addExpense({ date: dateIn(mb, intBetween(3, 25)), category: 'equipment', description: pickOne(['Crimping tool maintenance', 'Precision scale calibration', 'Filling nozzle replacement', 'Maceration tanks — 2 × 20 L']), amount: round(between(600, 4200), 2), vendor: 'Gulf Lab Equipment', paymentMethod: 'transfer', recurring: false })
}

for (const c of campaigns) {
  addExpense({
    date: c.startDate,
    category: 'marketing',
    description: `Campaign — ${c.name}`,
    amount: c.spend,
    vendor: c.channel === 'influencer' ? 'Influencer agency' : c.channel === 'google' ? 'Google Ads' : 'Meta / TikTok Ads',
    paymentMethod: 'card',
    recurring: false,
  })
}

addExpense({ date: dateIn(11, 3), category: 'licence', description: 'Trade licence + Dubai Municipality perfume permit', amount: 14800, vendor: 'DED', paymentMethod: 'transfer', recurring: false })
addExpense({ date: dateIn(11, 3), category: 'licence', description: 'Trademark registration — HMY Perfumes', amount: 6200, vendor: 'Ministry of Economy', paymentMethod: 'transfer', recurring: false })
addExpense({ date: dateIn(6, 14), category: 'other', description: 'Product photography — full range', amount: 5400, vendor: 'Studio 27', paymentMethod: 'transfer', recurring: false })
addExpense({ date: dateIn(4, 9), category: 'other', description: 'Beauty World Middle East — exhibitor booth', amount: 18500, vendor: 'Messe Frankfurt', paymentMethod: 'transfer', recurring: false })
addExpense({ date: dateIn(2, 17), category: 'equipment', description: 'Second filling station', amount: 9200, vendor: 'Gulf Lab Equipment', paymentMethod: 'transfer', recurring: false })

expenses.sort((a, b) => (a.date < b.date ? 1 : -1))

// ===========================================================================

export const seedDatabase: Database = {
  materials,
  products,
  formulas,
  batches,
  customers,
  interactions,
  orders,
  suppliers,
  purchases,
  campaigns,
  leads,
  expenses,
}

export const seedCounts = () =>
  Object.fromEntries(Object.entries(seedDatabase).map(([k, v]) => [k, (v as unknown[]).length]))

/** Exposed so the Products page can sanity-check pricing against formula cost. */
export const debugFormulaCosts = () =>
  formulas.map((f) => ({ code: f.code, cost: round(formulaUnitCost(f), 2) }))
