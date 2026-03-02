"use client";

import { useEffect, useRef, useState } from "react";
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
} from "lucide-react";
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

// ── Types ────────────────────────────────────────────────────────────────────

export interface MenuItemInput {
  name: string;
  sellingPrice: number;
  soldUnits: number;
  rawMaterialCostPerUnit: number;
  packagingCostPerUnit: number;
  dailyProductionCapacity?: number;
}

export interface FinancialFormData {
  businessName: string;
  businessType: "cafe" | "restaurant" | "cloud_kitchen" | "fine_dining";
  placeId: string;
  instagramUser: string;
  tiktokUser: string;
  sales: number;
  returns: number;
  advertising: number;
  discounts: number;
  productionStaffCosts: number;
  adminSalaries: number;
  adminExpenses: number;
  rent: number;
  utilities: number;
  subscriptions: number;
  govFees: number;
  serviceLaborCosts: number;
  otherCosts: number;
  items: MenuItemInput[];
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
  children,
}: {
  label: string;
  sublabel?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium leading-none">{label}</label>
      {sublabel && (
        <p className="text-[11px] text-muted-foreground">{sublabel}</p>
      )}
      {children}
    </div>
  );
}

function NumericInput({
  value,
  onChange,
  placeholder = "0",
}: {
  value: number;
  onChange: (v: number) => void;
  placeholder?: string;
}) {
  return (
    <Input
      type="number"
      min={0}
      step="any"
      value={value === 0 ? "" : value}
      placeholder={placeholder}
      onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
      className="tabular-nums"
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
  // Prevents the post-selection onInputValueChange from triggering a new fetch
  const skipNextQuery = useRef(false);

  // Debounce fetch driven by `query`
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
      } catch {
        // silent fail
      } finally {
        setLoading(false);
      }
    }, 350);
    return () => clearTimeout(t);
  }, [query]);

  // External clear → remount the combobox to reset its internal state
  useEffect(() => {
    if (!placeId) {
      setResetKey((k) => k + 1);
      setQuery("");
      setSuggestions([]);
    }
  }, [placeId]);

  const handleInputValueChange = (v: string) => {
    if (skipNextQuery.current) {
      skipNextQuery.current = false;
      return;
    }
    setQuery(v);
  };

  const handleValueChange = (s: PlaceSuggestion | null) => {
    if (s) {
      skipNextQuery.current = true;
      setSuggestions([]);
      const name = s.placePrediction.structuredFormat.mainText.text;
      onSelect(s.placePrediction.placeId, name);
    } else {
      // Cleared via the built-in clear button
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
        itemToStringLabel={(s: PlaceSuggestion) =>
          s.placePrediction.structuredFormat.mainText.text
        }
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
        <p className="mt-1 truncate font-mono text-[10px] text-muted-foreground" dir="ltr">
          {placeId}
        </p>
      )}
    </div>
  );
}

// ── Default empty item ────────────────────────────────────────────────────────

const newItem = (): MenuItemInput => ({
  name: "",
  sellingPrice: 0,
  soldUnits: 0,
  rawMaterialCostPerUnit: 0,
  packagingCostPerUnit: 0,
  dailyProductionCapacity: undefined,
});

// ── Main Component ────────────────────────────────────────────────────────────

interface Props {
  onSubmit: (data: FinancialFormData) => void;
  isSubmitting?: boolean;
}

export function BusinessForm({ onSubmit, isSubmitting }: Props) {
  const [tab, setTab] = useState("info");
  const [data, setData] = useState<FinancialFormData>({
    businessName: "",
    businessType: "cafe",
    placeId: "",
    instagramUser: "",
    tiktokUser: "",
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
    items: [newItem(), newItem()],
  });

  // Track collapsed state per item (false = expanded)
  const [collapsed, setCollapsed] = useState<boolean[]>(() =>
    Array(2).fill(false)
  );

  // Track cost mode per item ("detailed" | "total")
  const [costModes, setCostModes] = useState<Array<"detailed" | "total">>(() =>
    Array(2).fill("detailed")
  );

  // File input ref for Excel import
  const fileInputRef = useRef<HTMLInputElement>(null);

  const set = <K extends keyof FinancialFormData>(
    key: K,
    value: FinancialFormData[K]
  ) => setData((d) => ({ ...d, [key]: value }));

  const setItem = (index: number, key: keyof MenuItemInput, value: string | number | undefined) =>
    setData((d) => {
      const items = [...d.items];
      items[index] = { ...items[index], [key]: value };
      return { ...d, items };
    });

  const addItem = () => {
    setData((d) => ({ ...d, items: [...d.items, newItem()] }));
    setCollapsed((c) => [...c, false]);
    setCostModes((m) => [...m, "detailed"]);
  };

  const removeItem = (i: number) => {
    setData((d) => ({ ...d, items: d.items.filter((_, idx) => idx !== i) }));
    setCollapsed((c) => c.filter((_, idx) => idx !== i));
    setCostModes((m) => m.filter((_, idx) => idx !== i));
  };

  const handleExcelImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const buffer = await file.arrayBuffer();
    const { read, utils } = await import("xlsx");
    const wb = read(buffer, { type: "array" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = utils.sheet_to_json<Record<string, unknown>>(ws);

    const COLUMNS: Record<string, keyof MenuItemInput> = {
      "اسم المنتج":             "name",
      "سعر البيع":              "sellingPrice",
      "وحدات مباعة شهرياً":    "soldUnits",
      "تكلفة مواد خام":         "rawMaterialCostPerUnit",
      "تكلفة تغليف":            "packagingCostPerUnit",
      "طاقة إنتاجية يومية":    "dailyProductionCapacity",
    };

    const imported: MenuItemInput[] = rows.map((row) => {
      const item = newItem();
      for (const [col, field] of Object.entries(COLUMNS)) {
        if (row[col] !== undefined) {
          (item as unknown as Record<string, unknown>)[field] =
            field === "name" ? String(row[col]) : Number(row[col]) || 0;
        }
      }
      // "إجمالي التكلفة" overrides raw material cost and signals total mode
      if (row["إجمالي التكلفة"] !== undefined) {
        item.rawMaterialCostPerUnit = Number(row["إجمالي التكلفة"]) || 0;
        item.packagingCostPerUnit = 0;
      }
      return item;
    }).filter((it) => it.name.trim());

    // Items imported with a total cost column use "total" mode
    const importedModes = rows
      .filter((row) => {
        const name = String(row["اسم المنتج"] ?? "").trim();
        return name.length > 0;
      })
      .map((row) => (row["إجمالي التكلفة"] !== undefined ? "total" : "detailed") as "total" | "detailed");

    if (!imported.length) return;

    setData((d) => ({ ...d, items: [...d.items, ...imported] }));
    setCollapsed((c) => [...c, ...Array(imported.length).fill(false)]);
    setCostModes((m) => [...m, ...importedModes]);
    e.target.value = "";
  };

  const canSubmit =
    data.businessName.trim() &&
    data.placeId.trim() &&
    data.items.length > 0 &&
    data.items.every((it) => it.name.trim());

  const handleSubmit = () => {
    if (!canSubmit || isSubmitting) return;
    onSubmit(data);
  };

  return (
    <motion.div
      className="w-full max-w-2xl"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
    >
      {/* Title */}
      <div className="mb-6">
        <h2 className="text-xl font-semibold tracking-tight" dir="rtl">بيانات المشروع</h2>
        <p className="mt-1 text-sm text-muted-foreground" dir="rtl">
          أدخل بيانات مشروعك لإنشاء تقرير تحليل الأعمال الشامل
        </p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mb-6 w-full">
          <TabsTrigger value="info" className="flex-1 text-xs">
            المعلومات الأساسية
          </TabsTrigger>
          <TabsTrigger value="finance" className="flex-1 text-xs">
            البيانات المالية
          </TabsTrigger>
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
              onValueChange={(v) =>
                set("businessType", v as FinancialFormData["businessType"])
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
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

          <p className="text-xs font-medium text-muted-foreground">
            حسابات التواصل الاجتماعي (اختياري)
          </p>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Instagram">
              <div className="flex items-center gap-1">
                <Input
                  value={data.instagramUser}
                  onChange={(e) => set("instagramUser", e.target.value)}
                  dir="ltr"
                />
              </div>
            </Field>
            <Field label="TikTok">
              <div className="flex items-center gap-1">
                <Input
                  value={data.tiktokUser}
                  onChange={(e) => set("tiktokUser", e.target.value)}
                  dir="ltr"
                />
              </div>
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
          <p className="text-xs font-medium text-muted-foreground">
            الإيرادات الشهرية (بالريال السعودي)
          </p>
          <div className="grid grid-cols-2 gap-4">
            <Field label="إجمالي المبيعات">
              <NumericInput value={data.sales} onChange={(v) => set("sales", v)} />
            </Field>
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

          <Separator />

          <p className="text-xs font-medium text-muted-foreground">
            التكاليف المتغيرة
          </p>
          <div className="grid grid-cols-2 gap-4">
            <Field label="تكاليف موظفي الإنتاج">
              <NumericInput
                value={data.productionStaffCosts}
                onChange={(v) => set("productionStaffCosts", v)}
              />
            </Field>
          </div>

          <Separator />

          <p className="text-xs font-medium text-muted-foreground">
            التكاليف الثابتة الشهرية
          </p>
          <div className="grid grid-cols-2 gap-4">
            <Field label="رواتب الإدارة">
              <NumericInput value={data.adminSalaries} onChange={(v) => set("adminSalaries", v)} />
            </Field>
            <Field label="المنصرفات الإدارية">
              <NumericInput value={data.adminExpenses} onChange={(v) => set("adminExpenses", v)} />
            </Field>
            <Field label="الإيجار">
              <NumericInput value={data.rent} onChange={(v) => set("rent", v)} />
            </Field>
            <Field label="الكهرباء والماء">
              <NumericInput value={data.utilities} onChange={(v) => set("utilities", v)} />
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

          <div className="flex justify-end pt-2">
            <Button size="sm" variant="outline" onClick={() => setTab("items")}>
              التالي: المنتجات
              <ArrowLeft className="ml-1.5 size-3.5" />
            </Button>
          </div>
        </TabsContent>

        {/* ── Tab 3: Menu Items ──────────────────────────────────────── */}
        <TabsContent value="items" className="space-y-4">
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
                      title={
                        costModes[i] === "detailed"
                          ? "التبديل لإجمالي التكلفة"
                          : "التبديل لتفاصيل التكلفة"
                      }
                    >
                      {costModes[i] === "detailed" ? (
                        <Layers2 className="size-3" />
                      ) : (
                        <Combine className="size-3" />
                      )}
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
                    <Field label="سعر البيع (SAR)">
                      <NumericInput
                        value={item.sellingPrice}
                        onChange={(v) => setItem(i, "sellingPrice", v)}
                      />
                    </Field>
                    <Field label="الوحدات المباعة شهرياً">
                      <NumericInput
                        value={item.soldUnits}
                        onChange={(v) => setItem(i, "soldUnits", v)}
                      />
                    </Field>

                    {costModes[i] === "total" ? (
                      <Field label="إجمالي تكلفة الوحدة (SAR)">
                        <NumericInput
                          value={item.rawMaterialCostPerUnit}
                          onChange={(v) => setItem(i, "rawMaterialCostPerUnit", v)}
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

          {/* Toolbar: Add + Import */}
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

          {/* Submit */}
          <div className="pt-2">
            <Button
              className="w-full"
              onClick={handleSubmit}
              disabled={!canSubmit || isSubmitting}
            >
              {isSubmitting ? "جارٍ إنشاء التقرير..." : "إنشاء التقرير الشامل"}
            </Button>
          </div>
        </TabsContent>
      </Tabs>
    </motion.div>
  );
}
