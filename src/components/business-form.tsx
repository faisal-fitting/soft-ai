"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { motion } from "motion/react";
import {
  PlusIcon,
  Trash2Icon,
  Loader2,
  ArrowLeft,
  ChevronDown,
  Upload,
  Layers2,
  Combine,
  Copy,
} from "lucide-react";
import { z } from "zod";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";
import { financialInputSchema, itemInputSchema } from "@/mastra/shared/financials";

// ── Types — derived from Zod schemas (single source of truth) ────────────────

export type MenuItemInput = z.infer<typeof itemInputSchema>;
export type FinancialFormData = z.infer<typeof financialInputSchema>;

// ── Draft persistence ─────────────────────────────────────────────────────────

const DRAFT_KEY = "cbo-form-draft";

function saveDraft(data: FinancialFormData) {
  try { localStorage.setItem(DRAFT_KEY, JSON.stringify(data)); } catch { /* silent */ }
}

function loadDraft(): FinancialFormData | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // Validate shape loosely — if it has businessName it's a valid draft
    if (typeof parsed?.businessName === "string") return parsed as FinancialFormData;
    return null;
  } catch { return null; }
}

function clearDraft() {
  try { localStorage.removeItem(DRAFT_KEY); } catch { /* silent */ }
}

// ── Prompt Builder ───────────────────────────────────────────────────────────

export function buildReportPrompt(data: FinancialFormData): string {
  return `[GENERATE_REPORT_REQUEST]
أنشئ تقرير تحليل الأعمال الشامل باستخدام أداة businessAnalysisWorkflow مع هذه البيانات بالضبط:

\`\`\`json
${JSON.stringify(data, null, 2)}
\`\`\`

استخدم أداة businessAnalysisWorkflow الآن وأنشئ التقرير الشامل.`;
}

// ── Field helpers ─────────────────────────────────────────────────────────────

function Field({
  label,
  sublabel,
  error,
  children,
}: {
  label: string;
  sublabel?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium leading-none">{label}</label>
      {sublabel && (
        <p className="text-muted-foreground">{sublabel}</p>
      )}
      {children}
      {error && <p className="text-destructive">{error}</p>}
    </div>
  );
}

function NumericInput({
  value,
  onChange,
  placeholder = "0",
  error,
}: {
  value?: number;
  onChange: (v: number) => void;
  placeholder?: string;
  error?: boolean;
}) {
  return (
    <Input
      type="number"
      min={0}
      step="any"
      value={value === undefined || value === 0 ? "" : value}
      placeholder={placeholder}
      onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
      className={cn("tabular-nums", error && "border-destructive focus-visible:ring-destructive")}
    />
  );
}

// ── Places Autocomplete ───────────────────────────────────────────────────────

type PlaceSuggestion = {
  placePrediction: {
    placeId: string;
    structuredFormat: {
      mainText: { text: string };
      secondaryText?: { text: string };
    };
  };
};

function PlaceAutocomplete({
  placeId,
  onSelect,
}: {
  placeId: string;
  onSelect: (placeId: string, displayName: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [resetKey, setResetKey] = useState(0);
  const skipNextQuery = useRef(false);

  useEffect(() => {
    if (!query.trim()) { setSuggestions([]); return; }
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/places/autocomplete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ input: query }),
        });
        setSuggestions((await res.json()).suggestions ?? []);
      } catch { /* silent */ }
      finally { setLoading(false); }
    }, 350);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    if (!placeId) {
      setResetKey((k) => k + 1);
      setQuery("");
      setSuggestions([]);
    }
  }, [placeId]);

  const handleInputValueChange = (v: string) => {
    if (skipNextQuery.current) { skipNextQuery.current = false; return; }
    setQuery(v);
  };

  const handleValueChange = (s: PlaceSuggestion | null) => {
    if (s) {
      skipNextQuery.current = true;
      setSuggestions([]);
      onSelect(s.placePrediction.placeId, s.placePrediction.structuredFormat.mainText.text);
    } else {
      setQuery("");
      setSuggestions([]);
      onSelect("", "");
    }
  };

  return (
    <div>
      <Combobox
        key={resetKey}
        items={suggestions}
        onInputValueChange={handleInputValueChange}
        onValueChange={handleValueChange}
        itemToStringLabel={(s: PlaceSuggestion) => s.placePrediction.structuredFormat.mainText.text}
        isItemEqualToValue={(a: PlaceSuggestion, b: PlaceSuggestion) =>
          a.placePrediction.placeId === b.placePrediction.placeId
        }
        filter={null}
      >
        <ComboboxInput placeholder="ابحث باسم كافيهك أو مطعمك..." showClear />
        <ComboboxContent dir="rtl">
          <ComboboxEmpty>
            {loading ? <Loader2 className="size-4 animate-spin" /> : query ? "لا توجد نتائج" : "اكتب اسم كافيهك للبحث"}
          </ComboboxEmpty>
          <ComboboxList>
            {(s: PlaceSuggestion) => (
              <ComboboxItem key={s.placePrediction.placeId} value={s}>
                {s.placePrediction.structuredFormat.mainText.text}
                {s.placePrediction.structuredFormat.secondaryText && (
                  <span className="text-muted-foreground">
                    {" · "}{s.placePrediction.structuredFormat.secondaryText.text}
                  </span>
                )}
              </ComboboxItem>
            )}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
      {placeId && (
        <p className="mt-1 truncate font-mono text-muted-foreground" dir="ltr">{placeId}</p>
      )}
    </div>
  );
}

// ── Default state ─────────────────────────────────────────────────────────────

const DEFAULT_DATA: FinancialFormData = {
  businessName: "",
  businessType: "cafe",
  placeId: "",
  instagramUser: undefined,
  tiktokUser: undefined,
  sales: 0,
  returns: 0,
  advertising: 0,
  discounts: 0,
  productionStaffCosts: 0,
  adminSalaries: 0,
  adminExpenses: 0,
  rent: 0,
  utilities: 0,
  subscriptions: 0,
  govFees: 0,
  serviceLaborCosts: 0,
  otherCosts: 0,
  items: [],
};

const newItem = (): MenuItemInput => ({
  name: "",
  sellingPrice: 0,
  soldUnits: 0,
  rawMaterialCostPerUnit: undefined,
  packagingCostPerUnit: undefined,
  totalCostPerUnit: undefined,
  dailyProductionCapacity: undefined,
});

// ── Main Component ────────────────────────────────────────────────────────────

interface Props {
  onSubmit: (data: FinancialFormData) => void;
  isSubmitting?: boolean;
}

export function BusinessForm({ onSubmit, isSubmitting }: Props) {
  const [tab, setTab] = useState("info");

  // ── State — restore from draft on mount ──────────────────────────────────
  const [data, setData] = useState<FinancialFormData>(() => loadDraft() ?? DEFAULT_DATA);
  const [collapsed, setCollapsed] = useState<boolean[]>([]);
  const [costModes, setCostModes] = useState<Array<"detailed" | "total">>([]);

  // Sync collapsed/costModes length with items on mount (when restoring a draft)
  useEffect(() => {
    setCollapsed((c) => {
      if (c.length === data.items.length) return c;
      return data.items.map((_, i) => c[i] ?? true); // restored items collapsed
    });
    setCostModes((m) => {
      if (m.length === data.items.length) return m;
      return data.items.map((item, i) => {
        if (m[i]) return m[i];
        return item.totalCostPerUnit !== undefined ? "total" : "detailed";
      });
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // run once on mount only

  // ── Draft auto-save (debounced 500ms) ────────────────────────────────────
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => saveDraft(data), 500);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [data]);

  // ── Helpers ───────────────────────────────────────────────────────────────
  const set = useCallback(<K extends keyof FinancialFormData>(key: K, value: FinancialFormData[K]) => {
    setData((d) => ({ ...d, [key]: value }));
  }, []);

  const setItem = useCallback((index: number, key: keyof MenuItemInput, value: string | number | undefined) => {
    setData((d) => {
      const items = [...d.items];
      items[index] = { ...items[index], [key]: value };
      return { ...d, items };
    });
  }, []);

  const addItem = useCallback(() => {
    setData((d) => ({ ...d, items: [...d.items, newItem()] }));
    setCollapsed((c) => [...c, false]);
    setCostModes((m) => [...m, "detailed"]);
  }, []);

  const duplicateItem = useCallback((i: number) => {
    setData((d) => {
      const items = [...d.items];
      items.splice(i + 1, 0, { ...items[i] });
      return { ...d, items };
    });
    setCollapsed((c) => { const n = [...c]; n.splice(i + 1, 0, false); return n; });
    setCostModes((m) => { const n = [...m]; n.splice(i + 1, 0, m[i]); return n; });
  }, []);

  const removeItem = useCallback((i: number) => {
    setData((d) => ({ ...d, items: d.items.filter((_, idx) => idx !== i) }));
    setCollapsed((c) => c.filter((_, idx) => idx !== i));
    setCostModes((m) => m.filter((_, idx) => idx !== i));
  }, []);

  // ── Excel import ──────────────────────────────────────────────────────────
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExcelImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const buffer = await file.arrayBuffer();
    const { read, utils } = await import("xlsx");
    const wb = read(buffer, { type: "array" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = utils.sheet_to_json<Record<string, unknown>>(ws);

    const COLUMNS: Record<string, keyof MenuItemInput> = {
      "اسم المنتج":           "name",
      "سعر البيع":            "sellingPrice",
      "وحدات مباعة شهرياً":  "soldUnits",
      "تكلفة مواد خام":       "rawMaterialCostPerUnit",
      "تكلفة تغليف":          "packagingCostPerUnit",
      "طاقة إنتاجية يومية":  "dailyProductionCapacity",
    };

    const imported: MenuItemInput[] = rows.map((row) => {
      const item = newItem();
      for (const [col, field] of Object.entries(COLUMNS)) {
        if (row[col] !== undefined) {
          (item as unknown as Record<string, unknown>)[field] =
            field === "name" ? String(row[col]) : Number(row[col]) || 0;
        }
      }
      if (row["إجمالي التكلفة"] !== undefined) {
        const totalCost = Number(row["إجمالي التكلفة"]) || 0;
        const units = Number(row["وحدات مباعة شهرياً"]) || 1;
        item.totalCostPerUnit = totalCost / units;
      }
      return item;
    }).filter((it) => it.name.trim());

    const importedModes = rows
      .filter((row) => String(row["اسم المنتج"] ?? "").trim().length > 0)
      .map((row) => (row["إجمالي التكلفة"] !== undefined ? "total" : "detailed") as "total" | "detailed");

    if (!imported.length) return;
    setData((d) => ({ ...d, items: [...d.items, ...imported] }));
    setCollapsed((c) => [...c, ...Array(imported.length).fill(true)]);
    setCostModes((m) => [...m, ...importedModes]);
    e.target.value = "";
  };

  // ── Validation ────────────────────────────────────────────────────────────

  // Item-level warnings (non-blocking)
  const costWarnings = data.items.flatMap((item, i) => {
    if (!item.name.trim()) return [];
    const cost = item.totalCostPerUnit ?? item.rawMaterialCostPerUnit ?? 0;
    const warnings: string[] = [];
    if (item.sellingPrice > 0 && cost > item.sellingPrice * 0.8)
      warnings.push(`المنتج "${item.name}": التكلفة مرتفعة جداً (${cost.toFixed(2)} ر.س مقابل سعر ${item.sellingPrice.toFixed(2)} ر.س)`);
    if (item.sellingPrice === 0 && cost > 0)
      warnings.push(`المنتج "${item.name}": السعر يجب أن يكون أكبر من صفر`);
    return warnings;
  });

  // Section-level soft warnings (non-blocking)
  const allCostsZero =
    data.rent === 0 && data.adminSalaries === 0 && data.utilities === 0 &&
    data.productionStaffCosts === 0 && data.adminExpenses === 0 &&
    data.subscriptions === 0 && data.govFees === 0 &&
    data.serviceLaborCosts === 0 && data.otherCosts === 0;

  const noSocialAccounts = !data.instagramUser?.trim() && !data.tiktokUser?.trim();

  // Hard gate — blocks submit
  const canSubmit = Boolean(
    data.businessName.trim() &&
    data.placeId.trim() &&
    data.sales > 0 &&
    data.items.length > 0 &&
    data.items.every((it) => it.name.trim() && it.sellingPrice > 0 && it.soldUnits > 0)
  );

  const handleSubmit = () => {
    if (!canSubmit || isSubmitting) return;
    clearDraft();
    onSubmit(data);
  };

  // ── Count non-zero fields in a group (for badge on collapsed trigger) ────
  const deductionsCount = [data.returns, data.advertising, data.discounts].filter(Boolean).length;
  const extraCostsCount = [
    data.adminExpenses, data.subscriptions, data.govFees,
    data.serviceLaborCosts, data.otherCosts,
  ].filter(Boolean).length;

  // ── Items summary ─────────────────────────────────────────────────────────
  const totalItemsRevenue = data.items.reduce((s, it) => s + (it.sellingPrice * it.soldUnits), 0);

  return (
    <motion.div
      className="w-full max-w-2xl"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
    >
      <div className="mb-6">
        <h2 className="text-xl font-semibold tracking-tight" dir="rtl">بيانات المشروع</h2>
        <p className="mt-1 text-muted-foreground" dir="rtl">
          أدخل بيانات مشروعك لإنشاء تقرير تحليل الأعمال الشامل
        </p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mb-6 w-full">
          <TabsTrigger value="info" className="flex-1 text-xs">المعلومات الأساسية</TabsTrigger>
          <TabsTrigger value="finance" className="flex-1 text-xs">البيانات المالية</TabsTrigger>
          <TabsTrigger value="items" className="flex-1 text-xs">
            المنتجات ({data.items.length})
          </TabsTrigger>
        </TabsList>

        {/* ── Tab 1: Business Info ───────────────────────────────────── */}
        <TabsContent value="info" className="space-y-4">
          <Field label="اسم المشروع" sublabel="الاسم التجاري كما يظهر للعملاء">
            <Input
              value={data.businessName}
              onChange={(e) => set("businessName", e.target.value)}
              placeholder="مثال: قهوة النخيل"
            />
          </Field>

          <Field label="نوع المشروع">
            <Select
              value={data.businessType}
              onValueChange={(v) => set("businessType", v as FinancialFormData["businessType"])}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="cafe">كافيه / مقهى</SelectItem>
                <SelectItem value="restaurant">مطعم</SelectItem>
                <SelectItem value="cloud_kitchen">مطبخ سحابي</SelectItem>
                <SelectItem value="fine_dining">مطعم راقي</SelectItem>
              </SelectContent>
            </Select>
          </Field>

          <Field
            label="البحث عن المشروع على Google"
            sublabel="اكتب اسم كافيهك واختره من القائمة لربطه بتقييمات Google Maps"
          >
            <PlaceAutocomplete
              placeId={data.placeId}
              onSelect={(id, name) => {
                set("placeId", id);
                if (!data.businessName.trim() && name) set("businessName", name);
              }}
            />
          </Field>

          <Separator />

          <p className="text-muted-foreground font-medium">حسابات التواصل الاجتماعي (اختياري)</p>
          {noSocialAccounts && (
            <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-amber-800 dark:border-amber-800 dark:bg-amber-950/20 dark:text-amber-200">
              أضف حسابات التواصل الاجتماعي لتحليل رقمي أشمل
            </p>
          )}

          <div className="grid grid-cols-2 gap-4">
            <Field label="Instagram">
              <Input
                value={data.instagramUser ?? ""}
                onChange={(e) => set("instagramUser", e.target.value || undefined)}
                dir="ltr"
                placeholder="username"
              />
            </Field>
            <Field label="TikTok">
              <Input
                value={data.tiktokUser ?? ""}
                onChange={(e) => set("tiktokUser", e.target.value || undefined)}
                dir="ltr"
                placeholder="username"
              />
            </Field>
          </div>

          <div className="flex justify-end pt-2">
            <Button size="sm" variant="outline" onClick={() => setTab("finance")}>
              التالي
              <ArrowLeft className="size-3.5" />
            </Button>
          </div>
        </TabsContent>

        {/* ── Tab 2: Financials ──────────────────────────────────────── */}
        <TabsContent value="finance" className="space-y-5">

          {/* Essential revenue + costs — always visible */}
          <p className="font-medium text-muted-foreground">الإيرادات والتكاليف الأساسية</p>
          <div className="grid grid-cols-2 gap-4">
            <Field
              label="إجمالي المبيعات الشهرية"
              error={data.sales === 0 ? "مطلوب لإنشاء التقرير" : undefined}
            >
              <NumericInput
                value={data.sales}
                onChange={(v) => set("sales", v)}
                error={data.sales === 0}
              />
            </Field>
            <Field label="الإيجار">
              <NumericInput value={data.rent} onChange={(v) => set("rent", v)} />
            </Field>
            <Field label="رواتب الإدارة">
              <NumericInput value={data.adminSalaries} onChange={(v) => set("adminSalaries", v)} />
            </Field>
            <Field label="الكهرباء والماء">
              <NumericInput value={data.utilities} onChange={(v) => set("utilities", v)} />
            </Field>
            <Field label="تكاليف موظفي الإنتاج">
              <NumericInput value={data.productionStaffCosts} onChange={(v) => set("productionStaffCosts", v)} />
            </Field>
          </div>

          <Separator />

          {/* Revenue deductions — collapsible */}
          <Collapsible defaultOpen={deductionsCount > 0}>
            <CollapsibleTrigger asChild>
              <button className="flex w-full items-center justify-between gap-2 text-right">
                <span className="font-medium text-muted-foreground">خصومات الإيرادات</span>
                <div className="flex items-center gap-2">
                  {deductionsCount > 0 && (
                    <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                      {deductionsCount} مدخلة
                    </span>
                  )}
                  <ChevronDown className="size-4 text-muted-foreground transition-transform [[data-state=open]_&]:rotate-180" />
                </div>
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="mt-3 grid grid-cols-2 gap-4">
                <Field label="الرواجع والمرتجعات">
                  <NumericInput value={data.returns} onChange={(v) => set("returns", v)} />
                </Field>
                <Field label="الإعلانات والتسويق">
                  <NumericInput value={data.advertising} onChange={(v) => set("advertising", v)} />
                </Field>
                <Field label="الخصومات والكوبونات">
                  <NumericInput value={data.discounts} onChange={(v) => set("discounts", v)} />
                </Field>
              </div>
            </CollapsibleContent>
          </Collapsible>

          <Separator />

          {/* Additional fixed costs — collapsible */}
          <Collapsible defaultOpen={extraCostsCount > 0}>
            <CollapsibleTrigger asChild>
              <button className="flex w-full items-center justify-between gap-2 text-right">
                <span className="font-medium text-muted-foreground">تكاليف إضافية</span>
                <div className="flex items-center gap-2">
                  {extraCostsCount > 0 && (
                    <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                      {extraCostsCount} مدخلة
                    </span>
                  )}
                  <ChevronDown className="size-4 text-muted-foreground transition-transform [[data-state=open]_&]:rotate-180" />
                </div>
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="mt-3 grid grid-cols-2 gap-4">
                <Field label="المنصرفات الإدارية">
                  <NumericInput value={data.adminExpenses} onChange={(v) => set("adminExpenses", v)} />
                </Field>
                <Field label="الإنترنت والاشتراكات">
                  <NumericInput value={data.subscriptions} onChange={(v) => set("subscriptions", v)} />
                </Field>
                <Field label="الرسوم الحكومية">
                  <NumericInput value={data.govFees} onChange={(v) => set("govFees", v)} />
                </Field>
                <Field label="عمال النظافة والتقديم">
                  <NumericInput value={data.serviceLaborCosts} onChange={(v) => set("serviceLaborCosts", v)} />
                </Field>
                <Field label="تكاليف أخرى">
                  <NumericInput value={data.otherCosts} onChange={(v) => set("otherCosts", v)} />
                </Field>
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* All costs zero warning */}
          {allCostsZero && data.sales > 0 && (
            <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-amber-800 dark:border-amber-800 dark:bg-amber-950/20 dark:text-amber-200">
              ادخل التكاليف للحصول على تحليل مالي دقيق
            </p>
          )}

          <div className="flex justify-end pt-2">
            <Button size="sm" variant="outline" onClick={() => setTab("items")}>
              التالي: المنتجات
              <ArrowLeft className="ml-1.5 size-3.5" />
            </Button>
          </div>
        </TabsContent>

        {/* ── Tab 3: Menu Items ──────────────────────────────────────── */}
        <TabsContent value="items" className="space-y-4">

          {/* Summary row */}
          {data.items.length > 0 && (
            <div className="flex items-center justify-between rounded-lg border bg-muted/30 px-4 py-2" dir="rtl">
              <span className="text-muted-foreground">{data.items.length} منتجات</span>
              <span className="font-semibold tabular-nums">
                {totalItemsRevenue.toLocaleString("ar-SA")} ر.س / شهر
              </span>
            </div>
          )}

          {/* Add + Import toolbar — at the top */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1 gap-1.5 border-dashed text-xs"
              onClick={addItem}
            >
              <PlusIcon className="size-3.5" />
              إضافة منتج
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="size-3.5" />
              استيراد من Excel
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={handleExcelImport}
            />
          </div>

          {/* Items list */}
          {data.items.map((item, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="rounded-lg border bg-card p-4"
            >
              <Collapsible
                open={!collapsed[i]}
                onOpenChange={(open) =>
                  setCollapsed((c) => { const n = [...c]; n[i] = !open; return n; })
                }
              >
                {/* Card header — always visible */}
                <div className="flex items-center justify-between">
                  <CollapsibleTrigger asChild>
                    <button className="flex flex-1 items-center gap-2 text-right">
                      <ChevronDown
                        className={cn(
                          "size-3.5 transition-transform text-muted-foreground",
                          collapsed[i] && "-rotate-90"
                        )}
                      />
                      <span className="text-sm font-medium">
                        {item.name.trim() || `منتج ${i + 1}`}
                      </span>
                      {item.sellingPrice > 0 && item.soldUnits > 0 && (
                        <span className="text-muted-foreground tabular-nums">
                          · {(item.sellingPrice * item.soldUnits).toLocaleString("ar-SA")} ر.س
                        </span>
                      )}
                    </button>
                  </CollapsibleTrigger>

                  <div className="flex items-center gap-1">
                    {/* Cost mode toggle */}
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="size-6"
                      onClick={(e) => {
                        e.stopPropagation();
                        setCostModes((m) => {
                          const n = [...m];
                          n[i] = m[i] === "detailed" ? "total" : "detailed";
                          return n;
                        });
                      }}
                      title={costModes[i] === "detailed" ? "التبديل لإجمالي التكلفة" : "التبديل لتفاصيل التكلفة"}
                    >
                      {costModes[i] === "detailed" ? <Layers2 className="size-3" /> : <Combine className="size-3" />}
                    </Button>

                    {/* Duplicate button */}
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="size-6"
                      onClick={(e) => { e.stopPropagation(); duplicateItem(i); }}
                      title="تكرار المنتج"
                    >
                      <Copy className="size-3" />
                    </Button>

                    {/* Delete button */}
                    {data.items.length > 1 && (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="size-7 text-destructive hover:text-destructive"
                        onClick={() => removeItem(i)}
                      >
                        <Trash2Icon className="size-3.5" />
                      </Button>
                    )}
                  </div>
                </div>

                {/* Collapsible fields */}
                <CollapsibleContent>
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <div className="col-span-2">
                      <Field label="اسم المنتج">
                        <Input
                          value={item.name}
                          onChange={(e) => setItem(i, "name", e.target.value)}
                          placeholder="مثال: كابتشينو"
                        />
                      </Field>
                    </div>
                    <Field
                      label="سعر البيع (SAR)"
                      error={item.name.trim() && item.sellingPrice === 0 ? "مطلوب" : undefined}
                    >
                      <NumericInput
                        value={item.sellingPrice}
                        onChange={(v) => setItem(i, "sellingPrice", v)}
                        error={Boolean(item.name.trim() && item.sellingPrice === 0)}
                      />
                    </Field>
                    <Field
                      label="الوحدات المباعة شهرياً"
                      error={item.name.trim() && item.soldUnits === 0 ? "مطلوب" : undefined}
                    >
                      <NumericInput
                        value={item.soldUnits}
                        onChange={(v) => setItem(i, "soldUnits", v)}
                        error={Boolean(item.name.trim() && item.soldUnits === 0)}
                      />
                    </Field>

                    {costModes[i] === "total" ? (
                      <Field label="إجمالي تكلفة الوحدة شهرياً (SAR)">
                        <NumericInput
                          value={item.totalCostPerUnit}
                          onChange={(v) => setItem(i, "totalCostPerUnit", v)}
                        />
                      </Field>
                    ) : (
                      <>
                        <Field label="تكلفة المواد الخام/وحدة">
                          <NumericInput
                            value={item.rawMaterialCostPerUnit}
                            onChange={(v) => setItem(i, "rawMaterialCostPerUnit", v)}
                          />
                        </Field>
                        <Field label="تكلفة التغليف/وحدة">
                          <NumericInput
                            value={item.packagingCostPerUnit}
                            onChange={(v) => setItem(i, "packagingCostPerUnit", v)}
                          />
                        </Field>
                      </>
                    )}

                    <div className={cn("col-span-2", costModes[i] === "total" && "col-span-1")}>
                      <Field label="الطاقة الإنتاجية اليومية (وحدة/يوم)">
                        <NumericInput
                          value={item.dailyProductionCapacity ?? 0}
                          onChange={(v) => setItem(i, "dailyProductionCapacity", v || undefined)}
                        />
                      </Field>
                    </div>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </motion.div>
          ))}

          {/* Submit */}
          <div className="pt-2 space-y-3">
            {costWarnings.length > 0 && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-800 dark:border-amber-800 dark:bg-amber-950/20 dark:text-amber-200">
                <p className="font-semibold">تحذيرات:</p>
                <ul className="mt-1 list-inside list-disc">
                  {costWarnings.map((w, i) => <li key={i}>{w}</li>)}
                </ul>
              </div>
            )}
            <Button
              className="w-full"
              onClick={handleSubmit}
              disabled={!canSubmit || isSubmitting}
            >
              {isSubmitting ? (
                <><Loader2 className="size-4 animate-spin" />جارٍ إنشاء التقرير...</>
              ) : "إنشاء التقرير الشامل"}
            </Button>
          </div>
        </TabsContent>
      </Tabs>
    </motion.div>
  );
}
