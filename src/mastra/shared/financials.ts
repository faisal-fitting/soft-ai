import { z } from 'zod';

// ── Item Schemas ──────────────────────────────────────────────────────────────

export const itemInputSchema = z.object({
  name: z.string(),
  sellingPrice: z.number(),
  soldUnits: z.number(),
  rawMaterialCostPerUnit: z.number().optional().describe('تكلفة المواد الخام للوحدة'),
  packagingCostPerUnit: z.number().optional().describe('تكلفة التغليف للوحدة'),
  totalCostPerUnit: z.number().optional().describe('التكلفة الإجمالية للوحدة (إذا لم تكن مفصلة)'),
  dailyProductionCapacity: z.number().optional().describe('السعة الإنتاجية اليومية للمنتج'),
});

const itemOutputSchema = z.object({
  // Identity + revenue
  name: z.string(),
  sellingPrice: z.number(),
  soldUnits: z.number(),
  totalRevenue: z.number(),
  revenueShare: z.number(),

  // Per-product costs
  rawMaterialCostPerUnit: z.number(),
  packagingCostPerUnit: z.number(),
  totalCostPerUnit: z.number().optional(), // Original input (if using total mode)
  manufacturingCostPerUnit: z.number(),
  variableCostPerUnit: z.number(),
  fixedCostAllocationPerUnit: z.number(),
  fullCostPerUnit: z.number(),

  // Per-product analysis
  contributionMarginPerUnit: z.number(),
  profitPerUnit: z.number(),
  breakEvenUnits: z.number(),
  capacityUtilizationPercent: z.number(),
  isBelowCost: z.boolean(),
  lossPerUnit: z.number(),
  menuCategory: z.enum(['star', 'plowhorse', 'puzzle', 'dog']),
  marginRank: z.number(),
  revenueRank: z.number(),
});

// ── Financial Input Schema ────────────────────────────────────────────────────

export const financialInputSchema = z.object({
  // Business identity
  businessName: z.string().describe('Business name'),
  businessType: z.enum(['cafe', 'restaurant', 'cloud_kitchen', 'fine_dining']).describe('Type of F&B business'),
  placeId: z.string().describe('Google Places API place ID'),
  instagramUser: z.string().optional().describe('Instagram username (without @)'),
  tiktokUser: z.string().optional().describe('TikTok username (without @)'),

  // Revenue
  sales: z.number().describe('Total monthly sales — مجموع المبيعات الشهرية'),
  returns: z.number().describe('Total returns — مجموع الرواجع'),
  advertising: z.number().describe('Advertising spend — مجموع الإعلانات'),
  discounts: z.number().describe('Discounts and coupons — الخصومات والكوبونات'),

  // Variable Costs
  productionStaffCosts: z.number().describe('Production staff — المصنعين'),

  // Fixed Costs
  adminSalaries: z.number().describe('Admin salaries — رواتب الإدارة'),
  adminExpenses: z.number().describe('Admin expenses — المنصرفات الإدارية'),
  rent: z.number().describe('Monthly rent — الإيجار الشهري'),
  utilities: z.number().describe('Electricity & water — الكهرباء والماء'),
  subscriptions: z.number().describe('Internet & software — الإنترنت والبرامج'),
  govFees: z.number().describe('Government fees — الرسوم الحكومية'),
  serviceLaborCosts: z.number().describe('Cleaning & service staff — عمال النظافة والتقديم'),
  otherCosts: z.number().describe('Other costs — تكاليف أخرى'),

  // Items list
  items: z.array(itemInputSchema).describe('Menu items with per-unit cost data'),
});

// ── Financial Output Schema ───────────────────────────────────────────────────

export const financialOutputSchema = z.object({
  businessName: z.string(),
  businessType: z.string(),
  placeId: z.string(),
  instagramUser: z.string().optional(),
  tiktokUser: z.string().optional(),

  // Computed KPIs
  netRevenue: z.number(),
  variableCosts: z.number(),
  fixedCosts: z.number(),
  totalCosts: z.number(),
  grossProfit: z.number(),
  netProfit: z.number(),
  grossMargin: z.number(),
  netMargin: z.number(),
  contributionMarginRatio: z.number(),
  breakEvenRevenue: z.number(),
  breakEvenGap: z.number(),
  isAboveBreakEven: z.boolean(),

  // Derived aggregates
  rawMaterials: z.number(),
  packaging: z.number(),

  // Enriched items
  items: z.array(itemOutputSchema),
});

// ── Helper: median ────────────────────────────────────────────────────────────

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

// ── computeFinancials ─────────────────────────────────────────────────────────

export type FinancialInput = z.infer<typeof financialInputSchema>;
export type FinancialOutput = z.infer<typeof financialOutputSchema>;

export function computeFinancials(input: FinancialInput): FinancialOutput {
  const {
    businessName, businessType, placeId,
    instagramUser, tiktokUser,
    sales, returns, advertising, discounts,
    productionStaffCosts,
    adminSalaries, adminExpenses, rent, utilities,
    subscriptions, govFees, serviceLaborCosts, otherCosts,
    items,
  } = input;

  // Step 1: Derive aggregates from items
  // If totalCostPerUnit is provided, use it; otherwise use rawMaterialCostPerUnit + packagingCostPerUnit
  const rawMaterials = items.reduce((sum, i) => {
    const unitCost = i.totalCostPerUnit ?? i.rawMaterialCostPerUnit ?? 0;
    return sum + unitCost * i.soldUnits;
  }, 0);
  const packaging = items.reduce((sum, i) => {
    if (i.totalCostPerUnit !== undefined) return sum; // already included in total
    return sum + (i.packagingCostPerUnit ?? 0) * i.soldUnits;
  }, 0);

  // Step 2: Compute costs
  const variableCosts = rawMaterials + packaging + productionStaffCosts;
  const fixedCosts =
    adminSalaries + adminExpenses + rent + utilities +
    subscriptions + govFees + serviceLaborCosts + otherCosts;
  const totalCosts = variableCosts + fixedCosts;

  // Step 3: Business-level KPIs
  const netRevenue = sales - returns - discounts - advertising;
  const grossProfit = netRevenue - variableCosts;
  const netProfit = netRevenue - totalCosts;
  const grossMargin = netRevenue !== 0 ? (grossProfit / netRevenue) * 100 : 0;
  const netMargin = netRevenue !== 0 ? (netProfit / netRevenue) * 100 : 0;
  const variableCostRatio = netRevenue !== 0 ? variableCosts / netRevenue : 0;
  const contributionMarginRatio = 1 - variableCostRatio;
  const breakEvenRevenue =
    contributionMarginRatio !== 0 ? fixedCosts / contributionMarginRatio : 0;
  const breakEvenGap = netRevenue - breakEvenRevenue;
  const isAboveBreakEven = breakEvenGap >= 0;

  // Step 4: Per-product calculations
  const totalMonthlyCapacity = items.reduce(
    (sum, i) => sum + (i.dailyProductionCapacity ?? 0) * 30, 0,
  );
  const manufacturingCostPerUnit =
    totalMonthlyCapacity > 0 ? productionStaffCosts / totalMonthlyCapacity : 0;

  const numProducts = items.length;
  const fixedCostPerProduct = numProducts > 0 ? fixedCosts / numProducts : 0;

  // Compute total item revenue for revenueShare
  const totalItemRevenue = items.reduce(
    (sum, i) => sum + i.sellingPrice * i.soldUnits, 0,
  );

  const enrichedItems = items.map((item) => {
    const totalRevenue = item.sellingPrice * item.soldUnits;
    const revenueShare =
      totalItemRevenue !== 0 ? (totalRevenue / totalItemRevenue) * 100 : 0;

    // Use totalCostPerUnit if provided, otherwise sum rawMaterial + packaging
    const itemRawMaterial = item.rawMaterialCostPerUnit ?? 0;
    const itemPackaging = item.totalCostPerUnit !== undefined ? 0 : (item.packagingCostPerUnit ?? 0);
    const variableCostPerUnit = itemRawMaterial + itemPackaging + manufacturingCostPerUnit;
    const fixedCostAllocationPerUnit =
      item.soldUnits > 0 ? fixedCostPerProduct / item.soldUnits : 0;
    const fullCostPerUnit = variableCostPerUnit + fixedCostAllocationPerUnit;
    const contributionMarginPerUnit = item.sellingPrice - variableCostPerUnit;
    const profitPerUnit = item.sellingPrice - fullCostPerUnit;
    const breakEvenUnits =
      contributionMarginPerUnit > 0
        ? fixedCostPerProduct / contributionMarginPerUnit
        : Number.MAX_SAFE_INTEGER;
    const capacityUtilizationPercent =
      (item.dailyProductionCapacity ?? 0) > 0
        ? (item.soldUnits / ((item.dailyProductionCapacity ?? 0) * 30)) * 100
        : 0;
    const isBelowCost = item.sellingPrice < variableCostPerUnit;
    const lossPerUnit = Math.max(0, variableCostPerUnit - item.sellingPrice);

    return {
      name: item.name,
      sellingPrice: item.sellingPrice,
      soldUnits: item.soldUnits,
      totalRevenue,
      revenueShare,
      rawMaterialCostPerUnit: itemRawMaterial,
      packagingCostPerUnit: itemPackaging,
      totalCostPerUnit: item.totalCostPerUnit,
      manufacturingCostPerUnit,
      variableCostPerUnit,
      fixedCostAllocationPerUnit,
      fullCostPerUnit,
      contributionMarginPerUnit,
      profitPerUnit,
      breakEvenUnits,
      capacityUtilizationPercent,
      isBelowCost,
      lossPerUnit,
      // Placeholders — filled below after all items computed
      menuCategory: 'dog' as 'star' | 'plowhorse' | 'puzzle' | 'dog',
      marginRank: 0,
      revenueRank: 0,
    };
  });

  // Step 5: Menu engineering classification
  const allMargins = enrichedItems.map((i) => i.contributionMarginPerUnit);
  const allVolumes = enrichedItems.map((i) => i.soldUnits);
  const medianMargin = median(allMargins);
  const medianVolume = median(allVolumes);

  for (const item of enrichedItems) {
    const highMargin = item.contributionMarginPerUnit >= medianMargin;
    const highVolume = item.soldUnits >= medianVolume;
    if (highMargin && highVolume) item.menuCategory = 'star';
    else if (highMargin && !highVolume) item.menuCategory = 'puzzle';
    else if (!highMargin && highVolume) item.menuCategory = 'plowhorse';
    else item.menuCategory = 'dog';
  }

  // Step 6: Rankings
  const byMargin = [...enrichedItems].sort(
    (a, b) => b.contributionMarginPerUnit - a.contributionMarginPerUnit,
  );
  const byRevenue = [...enrichedItems].sort(
    (a, b) => b.totalRevenue - a.totalRevenue,
  );
  for (let i = 0; i < byMargin.length; i++) byMargin[i].marginRank = i + 1;
  for (let i = 0; i < byRevenue.length; i++) byRevenue[i].revenueRank = i + 1;

  console.log(
    `[computeFinancials] ${businessName} | netRevenue=${netRevenue} | breakEvenGap=${breakEvenGap.toFixed(0)}`,
  );

  return {
    businessName,
    businessType,
    placeId,
    instagramUser,
    tiktokUser,
    netRevenue,
    variableCosts,
    fixedCosts,
    totalCosts,
    grossProfit,
    netProfit,
    grossMargin,
    netMargin,
    contributionMarginRatio,
    breakEvenRevenue,
    breakEvenGap,
    isAboveBreakEven,
    rawMaterials,
    packaging,
    items: enrichedItems,
  };
}
