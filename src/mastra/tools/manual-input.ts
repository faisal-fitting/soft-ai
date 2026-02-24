import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

const itemInputSchema = z.object({
  name: z.string(),
  sellingPrice: z.number(),
  soldUnits: z.number(),
});

const inputSchema = z.object({
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
  laborCosts: z.number().describe('Cleaning & service staff — عمال النظافة والتقديم'),
  productionStaffCosts: z.number().describe('Production staff — المصنعين'),
  packaging: z.number().describe('Packaging — التغليف'),
  rawMaterials: z.number().describe('Raw materials — المواد الخام'),

  // Fixed Costs
  adminSalaries: z.number().describe('Admin salaries — رواتب الإدارة'),
  adminExpenses: z.number().describe('Admin expenses — المنصرفات الإدارية'),
  rent: z.number().describe('Monthly rent — الإيجار الشهري'),
  utilities: z.number().describe('Electricity & water — الكهرباء والماء'),
  subscriptions: z.number().describe('Internet & software — الإنترنت والبرامج'),
  govFees: z.number().describe('Government fees — الرسوم الحكومية'),
  otherCosts: z.number().describe('Other costs — تكاليف أخرى'),

  // Items list (revenue distribution only — no cost per unit)
  items: z.array(itemInputSchema).describe('Menu items for revenue distribution analysis'),
});

const outputSchema = z.object({
  businessName: z.string(),
  businessType: z.string(),
  placeId: z.string(),
  instagramUser: z.string().optional(),
  tiktokUser: z.string().optional(),

  // Computed KPIs (agent must NOT recalculate these)
  netRevenue: z.number(),
  variableCosts: z.number(),
  fixedCosts: z.number(),
  totalCosts: z.number(),
  grossProfit: z.number(),
  netProfit: z.number(),
  grossMargin: z.number(),        // %
  netMargin: z.number(),          // %
  contributionMarginRatio: z.number(),
  breakEvenRevenue: z.number(),
  breakEvenGap: z.number(),       // negative = below break-even
  isAboveBreakEven: z.boolean(),

  // Revenue distribution
  items: z.array(z.object({
    name: z.string(),
    totalRevenue: z.number(),
    revenueShare: z.number(),     // % of total item revenue
  })),
});

export const manualInputTool = createTool({
  id: 'manual-input',
  description:
    'Accept user-provided financial and business data for a Saudi F&B business. ' +
    'Computes all deterministic KPIs (break-even, margins, contribution margin) and ' +
    'returns structured output for the CBO agent. The agent must treat all computed ' +
    'values as absolute facts and never recalculate them.',
  inputSchema,
  outputSchema,
  execute: async (input) => {
    const {
      businessName,
      businessType,
      placeId,
      instagramUser,
      tiktokUser,
      sales,
      returns,
      advertising,
      discounts,
      laborCosts,
      productionStaffCosts,
      packaging,
      rawMaterials,
      adminSalaries,
      adminExpenses,
      rent,
      utilities,
      subscriptions,
      govFees,
      otherCosts,
      items,
    } = input;

    // ── Revenue ──────────────────────────────────────────────────────────────
    const netRevenue = sales - returns - discounts - advertising;

    // ── Variable Costs ────────────────────────────────────────────────────────
    const variableCosts = rawMaterials + packaging + laborCosts + productionStaffCosts;

    // ── Fixed Costs ───────────────────────────────────────────────────────────
    const fixedCosts =
      adminSalaries + adminExpenses + rent + utilities + subscriptions + govFees + otherCosts;

    // ── Totals ────────────────────────────────────────────────────────────────
    const totalCosts = variableCosts + fixedCosts;
    const grossProfit = netRevenue - variableCosts;
    const netProfit = netRevenue - totalCosts;

    // ── Margins ───────────────────────────────────────────────────────────────
    const grossMargin = netRevenue !== 0 ? (grossProfit / netRevenue) * 100 : 0;
    const netMargin = netRevenue !== 0 ? (netProfit / netRevenue) * 100 : 0;

    // ── Break-even ────────────────────────────────────────────────────────────
    const variableCostRatio = netRevenue !== 0 ? variableCosts / netRevenue : 0;
    const contributionMarginRatio = 1 - variableCostRatio;
    const breakEvenRevenue =
      contributionMarginRatio !== 0 ? fixedCosts / contributionMarginRatio : 0;
    const breakEvenGap = netRevenue - breakEvenRevenue;

    // ── Items revenue distribution ─────────────────────────────────────────
    const itemsWithRevenue = items.map((item) => ({
      ...item,
      totalRevenue: item.sellingPrice * item.soldUnits,
    }));
    const totalItemRevenue = itemsWithRevenue.reduce((sum, item) => sum + item.totalRevenue, 0);
    const processedItems = itemsWithRevenue.map((item) => ({
      name: item.name,
      totalRevenue: item.totalRevenue,
      revenueShare:
        totalItemRevenue !== 0 ? (item.totalRevenue / totalItemRevenue) * 100 : 0,
    }));

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
      isAboveBreakEven: breakEvenGap >= 0,
      items: processedItems,
    };
  },
});
