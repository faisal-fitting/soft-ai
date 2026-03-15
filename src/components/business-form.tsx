"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { PlusIcon, Trash2Icon, Loader2, ArrowLeft, ArrowRight, ChevronDown, Upload, Layers2, Combine, Copy, CheckCircle2 } from "lucide-react";
import { z } from "zod";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Field, FieldGroup, FieldLabel, FieldDescription } from "@/components/ui/field";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Combobox, ComboboxContent, ComboboxEmpty, ComboboxInput, ComboboxItem, ComboboxList } from "@/components/ui/combobox";
import { financialInputSchema, itemInputSchema } from "@/mastra/shared/financials";
import { useReportStore } from "@/store/report-store";

// ── Types ─────────────────────────────────────────────────────────────
export type MenuItemInput = z.infer<typeof itemInputSchema>;
export type FinancialFormData = z.infer<typeof financialInputSchema>;

// ── Persistence ───────────────────────────────────────────────────────
const DRAFT_KEY = "cbo-form-draft";
const saveDraft = (data: FinancialFormData) => { try { localStorage.setItem(DRAFT_KEY, JSON.stringify(data)); } catch { } };
const loadDraft = (): FinancialFormData | null => { try { const raw = localStorage.getItem(DRAFT_KEY); return raw ? JSON.parse(raw) : null; } catch { return null; } };
const clearDraft = () => { try { localStorage.removeItem(DRAFT_KEY); } catch { } };

const DEFAULT_DATA: FinancialFormData = {
  businessName: "", businessType: "cafe", placeId: "", googlePlaceName: undefined,
  instagramUser: undefined, tiktokUser: undefined,
  sales: 0, returns: 0, advertising: 0, discounts: 0,
  productionStaffCosts: 0, adminSalaries: 0, adminExpenses: 0, rent: 0,
  utilities: 0, subscriptions: 0, govFees: 0, serviceLaborCosts: 0, otherCosts: 0,
  items: [],
};

const newItem = (): MenuItemInput => ({
  name: "", sellingPrice: 0, soldUnits: 0,
  rawMaterialCostPerUnit: undefined, packagingCostPerUnit: undefined,
  totalCostPerUnit: undefined, dailyProductionCapacity: undefined,
});

// ── Place Autocomplete ────────────────────────────────────────────────
type PlaceSuggestion = { placePrediction: { placeId: string; structuredFormat: { mainText: { text: string }; secondaryText?: { text: string } } } };

function PlaceAutocomplete({ placeId, googlePlaceName, onSelect }: { placeId: string; googlePlaceName?: string; onSelect: (placeId: string, displayName: string) => void }) {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedItem, setSelectedItem] = useState<PlaceSuggestion | null>(() => {
    if (placeId && googlePlaceName) {
      console.log("[PlaceAutocomplete] Init with googlePlaceName:", googlePlaceName);
      return { placePrediction: { placeId, structuredFormat: { mainText: { text: googlePlaceName } } } };
    }
    return null;
  });
  const skipNextQuery = useRef(false);

  useEffect(() => {
    console.log("[PlaceAutocomplete] useEffect [placeId]: placeId=", placeId);
    if (!placeId) { setQuery(""); setSelectedItem(null); }
  }, [placeId]);

  useEffect(() => {
    if (!query.trim()) { setSuggestions([]); return; }
    if (selectedItem && query === selectedItem.placePrediction.structuredFormat.mainText.text) { return; }
    
    const t = setTimeout(async () => {
      console.log("[PlaceAutocomplete] Fetching suggestions for:", query);
      setLoading(true);
      try {
        const res = await fetch("/api/places/autocomplete", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ input: query }) });
        setSuggestions((await res.json()).suggestions ?? []);
      } catch { }
      finally { setLoading(false); }
    }, 350);
    return () => clearTimeout(t);
  }, [query, selectedItem]);

  const handleSelect = (s: PlaceSuggestion) => {
    console.log("[PlaceAutocomplete] handleSelect:", s.placePrediction.structuredFormat.mainText.text, s.placePrediction.placeId);
    skipNextQuery.current = true;
    setQuery(s.placePrediction.structuredFormat.mainText.text);
    setSelectedItem(s);
    onSelect(s.placePrediction.placeId, s.placePrediction.structuredFormat.mainText.text);
  };

  const handleClear = () => {
    console.log("[PlaceAutocomplete] handleClear called");
    setQuery("");
    setSelectedItem(null);
    setSuggestions([]);
    onSelect("", "");
  };

  const handleInputChange = (v: string) => {
    console.log("[PlaceAutocomplete] onInputValueChange:", v);
    if (skipNextQuery.current) { skipNextQuery.current = false; return; } 
    setQuery(v);
  };

  const handleValueChange = (s: PlaceSuggestion | null) => {
    console.log("[PlaceAutocomplete] onValueChange:", s ? s.placePrediction.placeId : "null");
    if (s) handleSelect(s); else handleClear();
  };

  const displayItems = selectedItem 
    ? [selectedItem, ...suggestions.filter(s => s.placePrediction.placeId !== selectedItem.placePrediction.placeId)]
    : suggestions;

  const itemToDisplay = selectedItem ?? (placeId ? suggestions.find(s => s.placePrediction.placeId === placeId) : null) ?? null;

  return (
    <div className="relative">
      <Combobox
        items={displayItems}
        onInputValueChange={handleInputChange}
        onValueChange={handleValueChange}
        itemToStringLabel={(s: PlaceSuggestion) => s.placePrediction.structuredFormat.mainText.text}
        isItemEqualToValue={(a, b) => a.placePrediction.placeId === b.placePrediction.placeId}
        filter={null}
        value={itemToDisplay}
      >
        <ComboboxInput 
          placeholder="ابحث باسم كافيهك أو مطعمك..." 
          showClear 
          className="text-foreground placeholder:text-muted-foreground"
        />
        <ComboboxContent dir="rtl" className="bg-card text-foreground border-border">
          <ComboboxEmpty>{loading ? <Loader2 className="size-4 animate-spin" /> : query ? "لا توجد نتائج" : "اكتب اسم كافيهك للبحث"}</ComboboxEmpty>
          <ComboboxList>{(s: PlaceSuggestion) => (
            <ComboboxItem key={s.placePrediction.placeId} value={s} className="focus:bg-primary/20">
              {s.placePrediction.structuredFormat.mainText.text}
              {s.placePrediction.structuredFormat.secondaryText && <span className="text-muted-foreground"> · {s.placePrediction.structuredFormat.secondaryText.text}</span>}
            </ComboboxItem>
          )}</ComboboxList>
        </ComboboxContent>
      </Combobox>
      {placeId && <p className="mt-1 truncate font-mono text-muted-foreground text-sm" dir="ltr">{placeId}</p>}
    </div>
  );
}

// ── Main Form ─────────────────────────────────────────────────────────
export function BusinessForm({ onSubmit, isSubmitting }: { onSubmit: (data: FinancialFormData) => void; isSubmitting?: boolean; }) {
  const store = useReportStore();
  const step = store.formStep;
  const setStep = store.setFormStep;
  
  const [data, setData] = useState<FinancialFormData>(() => loadDraft() ?? DEFAULT_DATA);
  const [collapsed, setCollapsed] = useState<boolean[]>([]);
  const [costModes, setCostModes] = useState<Array<"detailed" | "total">>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setCollapsed(data.items.map(() => true));
    setCostModes(data.items.map(item => item.totalCostPerUnit !== undefined ? "total" : "detailed"));
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => saveDraft(data), 500);
    return () => clearTimeout(timer);
  }, [data]);

  // Debug: log canSubmit validation
  useEffect(() => {
    const itemsValid = data.items.every((it) => it.name.trim().length > 0);
    console.log("[Form] Validation:", {
      businessName: data.businessName,
      businessNameTrim: data.businessName.trim(),
      placeId: data.placeId,
      placeIdTrim: data.placeId.trim(),
      sales: data.sales,
      itemsCount: data.items.length,
      itemsValid,
      canSubmit: data.businessName.trim() && data.placeId.trim() && data.items.length > 0 && itemsValid
    });
  }, [data]);

  const updateField = (key: keyof FinancialFormData, value: any) => setData(d => ({ ...d, [key]: value }));
  const updateItem = (index: number, key: keyof MenuItemInput, value: any) => setData(d => ({ ...d, items: d.items.map((item, i) => i === index ? { ...item, [key]: value } : item) }));

  const addItem = () => { setData(d => ({ ...d, items: [...d.items, newItem()] })); setCollapsed(c => [...c, false]); setCostModes(m => [...m, "total"]); };
  const removeItem = (i: number) => { setData(d => ({ ...d, items: d.items.filter((_, idx) => idx !== i) })); setCollapsed(c => c.filter((_, idx) => idx !== i)); setCostModes(m => m.filter((_, idx) => idx !== i)); };
  const duplicateItem = (i: number) => { setData(d => { const items = [...d.items]; items.splice(i + 1, 0, { ...items[i] }); return { ...d, items }; }); setCollapsed(c => { const n = [...c]; n.splice(i + 1, 0, c[i]); return n; }); setCostModes(m => { const n = [...m]; n.splice(i + 1, 0, m[i]); return n; }); };

  const handleExcelImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const buffer = await file.arrayBuffer();
    const { read, utils } = await import("xlsx");
    const wb = read(buffer, { type: "array" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = utils.sheet_to_json<Record<string, unknown>>(ws);
    const COLUMNS: Record<string, keyof MenuItemInput> = { "اسم المنتج": "name", "سعر البيع": "sellingPrice", "وحدات مباعة شهرياً": "soldUnits", "تكلفة مواد خام": "rawMaterialCostPerUnit", "تكلفة تغليف": "packagingCostPerUnit", "طاقة إنتاجية يومية": "dailyProductionCapacity" };
    const imported: MenuItemInput[] = rows.map((row) => {
      const item = newItem();
      for (const [col, field] of Object.entries(COLUMNS)) {
        if (row[col] !== undefined) (item as any)[field] = field === "name" ? String(row[col]) : Number(row[col]) || 0;
      }
      if (row["إجمالي التكلفة"] !== undefined) { item.totalCostPerUnit = (Number(row["إجمالي التكلفة"]) || 0) / (Number(row["وحدات مباعة شهرياً"]) || 1); }
      return item;
    }).filter((it) => it.name.trim());
    if (!imported.length) return;
    setData(d => ({ ...d, items: [...d.items, ...imported] }));
    setCollapsed(c => [...c, ...Array(imported.length).fill(true)]);
    setCostModes(m => [...m, ...Array(imported.length).fill("total")]);
    e.target.value = "";
  };

  const deductionsCount = [data.returns, data.advertising, data.discounts].filter(Boolean).length;
  const extraCostsCount = [data.adminExpenses, data.subscriptions, data.govFees, data.serviceLaborCosts, data.otherCosts].filter(Boolean).length;
  const totalItemsRevenue = data.items.reduce((s, it) => s + (it.sellingPrice * it.soldUnits), 0);
  const itemsValid = data.items.every((it) => it.name.trim().length > 0);
  const canSubmit = data.businessName.trim() && data.placeId.trim() && data.items.length > 0 && itemsValid;

  const steps = [
    { id: 0, label: "المعلومات الأساسية" },
    { id: 1, label: "البيانات المالية" },
    { id: 2, label: "المنتجات" },
  ];

  return (
    <div className="w-full flex flex-col h-full" dir="rtl">
      {/* Progress Header */}
      <div className="px-6 py-4 shrink-0">
        <h2 className="text-xl font-bold text-foreground mb-4 text-right">بيانات المشروع</h2>
        <div className="flex items-center gap-2 flex-wrap">
          {steps.map((s, i) => (
            <div key={s.id} className="flex items-center">
              <div className={cn("flex items-center gap-2 px-3 py-1 rounded-full transition-all", step === s.id ? "bg-primary text-primary-foreground" : step > s.id ? "bg-emerald-500/20 text-emerald-400" : "text-muted-foreground")}>
                {step > s.id ? <CheckCircle2 className="size-4" /> : <span className="text-sm font-medium">{i + 1}</span>}
                <span className="text-sm font-medium">{s.label}</span>
              </div>
              {i < 2 && <div className={cn("w-8 h-0.5 mx-2", step > s.id ? "bg-emerald-500" : "bg-border")} />}
            </div>
          ))}
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto px-6">
        <AnimatePresence mode="wait">
          {/* STEP 0: Business Info */}
          {step === 0 && (
            <motion.div key="step0" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="flex flex-col gap-6">
              <div className="grid grid-cols-2 gap-4">
                <Field>
                  <FieldLabel>اسم المشروع</FieldLabel>
                  <Input 
                    value={data.businessName} 
                    onChange={(e) => updateField("businessName", e.target.value)} 
                    placeholder="أدخل اسم كافيهك أو مطعمك" 
                    className="text-foreground placeholder:text-muted-foreground" 
                  />
                </Field>
                <Field>
                  <FieldLabel>نوع المشروع</FieldLabel>
                  <Select value={data.businessType} onValueChange={(v) => updateField("businessType", v)}>
                    <SelectTrigger className="text-foreground"><SelectValue /></SelectTrigger>
                    <SelectContent className="bg-card text-foreground border-border" position="popper"><SelectItem value="cafe">كافيه / مقهى</SelectItem><SelectItem value="restaurant">مطعم</SelectItem><SelectItem value="cloud_kitchen">مطبخ سحابي</SelectItem><SelectItem value="fine_dining">مطعم راقي</SelectItem></SelectContent>
                  </Select>
                </Field>
              </div>
              <Field>
                <FieldLabel>البحث عن المشروع على Google</FieldLabel>
                <PlaceAutocomplete placeId={data.placeId} googlePlaceName={data.googlePlaceName} onSelect={(id, name) => { console.log("[Form] onSelect:", id, name); updateField("placeId", id); updateField("googlePlaceName", name || undefined); if (!data.businessName.trim() && name) updateField("businessName", name); }} />
              </Field>
              <Separator className="bg-border/50" />
              <div className="grid grid-cols-2 gap-4">
                <Field>
                  <FieldLabel>Instagram <span className="text-destructive">*</span></FieldLabel>
                  <Input value={data.instagramUser ?? ""} onChange={(e) => updateField("instagramUser", e.target.value || undefined)} placeholder="@username" dir="ltr" className="text-foreground placeholder:text-muted-foreground" />
                </Field>
                <Field>
                  <FieldLabel>TikTok <span className="text-destructive">*</span></FieldLabel>
                  <Input value={data.tiktokUser ?? ""} onChange={(e) => updateField("tiktokUser", e.target.value || undefined)} placeholder="@username" dir="ltr" className="text-foreground placeholder:text-muted-foreground" />
                </Field>
              </div>
            </motion.div>
          )}

          {/* STEP 1: Financials */}
          {step === 1 && (
            <motion.div key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="flex flex-col gap-6">
              <div className="grid grid-cols-3 gap-4">
                <Field>
                  <FieldLabel className="text-primary">المبيعات الشهرية (الأهم)</FieldLabel>
                  <Input 
                    type="number" 
                    className="no-spinner font-mono text-foreground placeholder:text-muted-foreground" 
                    value={data.sales || ""} 
                    onChange={(e) => updateField("sales", parseFloat(e.target.value) || 0)} 
                    placeholder="0"
                  />
                </Field>
                <Field>
                  <FieldLabel>الإيجار</FieldLabel>
                  <Input type="number" className="no-spinner font-mono text-foreground placeholder:text-muted-foreground" value={data.rent || ""} onChange={(e) => updateField("rent", parseFloat(e.target.value) || 0)} />
                </Field>
                <Field>
                  <FieldLabel>رواتب الإدارة</FieldLabel>
                  <Input type="number" className="no-spinner font-mono text-foreground placeholder:text-muted-foreground" value={data.adminSalaries || ""} onChange={(e) => updateField("adminSalaries", parseFloat(e.target.value) || 0)} />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Field>
                  <FieldLabel>الكهرباء والماء</FieldLabel>
                  <Input type="number" className="no-spinner font-mono text-foreground placeholder:text-muted-foreground" value={data.utilities || ""} onChange={(e) => updateField("utilities", parseFloat(e.target.value) || 0)} />
                </Field>
                <Field>
                  <FieldLabel>تكاليف الإنتاج</FieldLabel>
                  <Input type="number" className="no-spinner font-mono text-foreground placeholder:text-muted-foreground" value={data.productionStaffCosts || ""} onChange={(e) => updateField("productionStaffCosts", parseFloat(e.target.value) || 0)} />
                </Field>
              </div>
              <Separator className="bg-border/50" />
              <Collapsible defaultOpen={true}>
                <CollapsibleTrigger className="flex w-full items-center justify-between py-2 font-medium"><span>خصومات الإيرادات</span><ChevronDown className="size-4" /></CollapsibleTrigger>
                <CollapsibleContent className="grid grid-cols-2 gap-4 mt-4">
                  <Field>
                    <FieldLabel>الرواجع</FieldLabel>
                    <Input type="number" className="no-spinner font-mono text-foreground placeholder:text-muted-foreground" value={data.returns || ""} onChange={(e) => updateField("returns", parseFloat(e.target.value) || 0)} />
                  </Field>
                  <Field>
                    <FieldLabel>الإعلانات</FieldLabel>
                    <Input type="number" className="no-spinner font-mono text-foreground placeholder:text-muted-foreground" value={data.advertising || ""} onChange={(e) => updateField("advertising", parseFloat(e.target.value) || 0)} />
                  </Field>
                  <Field>
                    <FieldLabel>الخصومات</FieldLabel>
                    <Input type="number" className="no-spinner font-mono text-foreground placeholder:text-muted-foreground" value={data.discounts || ""} onChange={(e) => updateField("discounts", parseFloat(e.target.value) || 0)} />
                  </Field>
                </CollapsibleContent>
              </Collapsible>
              <Collapsible defaultOpen={true}>
                <CollapsibleTrigger className="flex w-full items-center justify-between py-2 font-medium"><span>تكاليف إضافية</span><ChevronDown className="size-4" /></CollapsibleTrigger>
                <CollapsibleContent className="grid grid-cols-2 gap-4 mt-4">
                  <Field>
                    <FieldLabel>مصروفات إدارية</FieldLabel>
                    <Input type="number" className="no-spinner font-mono text-foreground placeholder:text-muted-foreground" value={data.adminExpenses || ""} onChange={(e) => updateField("adminExpenses", parseFloat(e.target.value) || 0)} />
                  </Field>
                  <Field>
                    <FieldLabel>اشتراكات</FieldLabel>
                    <Input type="number" className="no-spinner font-mono text-foreground placeholder:text-muted-foreground" value={data.subscriptions || ""} onChange={(e) => updateField("subscriptions", parseFloat(e.target.value) || 0)} />
                  </Field>
                  <Field>
                    <FieldLabel>رسوم حكومية</FieldLabel>
                    <Input type="number" className="no-spinner font-mono text-foreground placeholder:text-muted-foreground" value={data.govFees || ""} onChange={(e) => updateField("govFees", parseFloat(e.target.value) || 0)} />
                  </Field>
                  <Field>
                    <FieldLabel>عمال خدمة</FieldLabel>
                    <Input type="number" className="no-spinner font-mono text-foreground placeholder:text-muted-foreground" value={data.serviceLaborCosts || ""} onChange={(e) => updateField("serviceLaborCosts", parseFloat(e.target.value) || 0)} />
                  </Field>
                  <Field>
                    <FieldLabel>تكاليف أخرى</FieldLabel>
                    <Input type="number" className="no-spinner font-mono text-foreground placeholder:text-muted-foreground" value={data.otherCosts || ""} onChange={(e) => updateField("otherCosts", parseFloat(e.target.value) || 0)} />
                  </Field>
                </CollapsibleContent>
              </Collapsible>
            </motion.div>
          )}

          {/* STEP 2: Products */}
          {step === 2 && (
            <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="flex flex-col gap-6">
              {data.items.length > 0 && (
                <div className="flex items-center justify-between py-3 border-b border-border/50">
                  <span className="text-foreground/80">{data.items.length} منتجات</span>
                  <span className="text-foreground font-mono">{totalItemsRevenue.toLocaleString("ar-SA")} ر.س</span>
                </div>
              )}
              {data.items.map((item, i) => (
                <div key={i} className="pb-6 mb-6 border-b border-border/50 last:border-0">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3 flex-1">
                      <Input value={item.name} onChange={(e) => updateItem(i, "name", e.target.value)} placeholder="اسم المنتج" className="max-w-[200px] text-foreground placeholder:text-muted-foreground" />
                      <Button variant="ghost" size="icon" className="size-8 text-muted-foreground hover:text-foreground hover:bg-muted" onClick={() => duplicateItem(i)}><Copy className="size-4" /></Button>
                    </div>
                    <Button variant="ghost" size="icon" className="size-8 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => removeItem(i)}><Trash2Icon className="size-4" /></Button>
                  </div>
                  
                  {/* Cost Mode Toggle */}
                  <div className="flex items-center gap-2 mb-4">
                    <Button
                      variant={costModes[i] === "detailed" ? "default" : "outline"}
                      size="sm"
                      className="h-8"
                      onClick={() => {
                        const newModes = [...costModes];
                        newModes[i] = "detailed";
                        setCostModes(newModes);
                      }}
                    >
                      مفصل
                    </Button>
                    <Button
                      variant={costModes[i] === "total" ? "default" : "outline"}
                      size="sm"
                      className="h-8"
                      onClick={() => {
                        const newModes = [...costModes];
                        newModes[i] = "total";
                        setCostModes(newModes);
                      }}
                    >
                      إجمالي
                    </Button>
                  </div>

                  {/* Cost Fields - Total Mode */}
                  <div className="grid grid-cols-3 gap-4">
                    <Field>
                      <FieldLabel>سعر البيع</FieldLabel>
                      <Input type="number" className="no-spinner font-mono text-foreground placeholder:text-muted-foreground" placeholder="0" value={item.sellingPrice || ""} onChange={(e) => updateItem(i, "sellingPrice", parseFloat(e.target.value) || 0)} />
                    </Field>
                    <Field>
                      <FieldLabel>الوحدات المباعة</FieldLabel>
                      <Input type="number" className="no-spinner font-mono text-foreground placeholder:text-muted-foreground" placeholder="0" value={item.soldUnits || ""} onChange={(e) => updateItem(i, "soldUnits", parseFloat(e.target.value) || 0)} />
                    </Field>
                    {costModes[i] === "detailed" ? (
                      <>
                        <Field>
                          <FieldLabel>المواد الخام</FieldLabel>
                          <Input type="number" className="no-spinner font-mono text-foreground placeholder:text-muted-foreground" placeholder="0" value={item.rawMaterialCostPerUnit || ""} onChange={(e) => updateItem(i, "rawMaterialCostPerUnit", parseFloat(e.target.value) || 0)} />
                        </Field>
                        <Field>
                          <FieldLabel>التغليف</FieldLabel>
                          <Input type="number" className="no-spinner font-mono text-foreground placeholder:text-muted-foreground" placeholder="0" value={item.packagingCostPerUnit || ""} onChange={(e) => updateItem(i, "packagingCostPerUnit", parseFloat(e.target.value) || 0)} />
                        </Field>
                        <Field>
                          <FieldLabel>الطاقة الإنتاجية</FieldLabel>
                          <Input type="number" className="no-spinner font-mono text-foreground placeholder:text-muted-foreground" placeholder="0" value={item.dailyProductionCapacity || ""} onChange={(e) => updateItem(i, "dailyProductionCapacity", parseFloat(e.target.value) || 0)} />
                        </Field>
                      </>
                    ) : (
                      <Field>
                        <FieldLabel>إجمالي التكلفة</FieldLabel>
                        <Input type="number" className="no-spinner font-mono text-foreground placeholder:text-muted-foreground" placeholder="0" value={item.totalCostPerUnit || ""} onChange={(e) => updateItem(i, "totalCostPerUnit", parseFloat(e.target.value) || 0)} />
                      </Field>
                    )}
                  </div>
                </div>
              ))}
              <div className="flex gap-2 pt-4">
                <Button variant="outline" className="flex-1 border-dashed border-border" onClick={addItem}><PlusIcon className="size-4 ml-2" />إضافة منتج</Button>
                <Button variant="outline" className="border-border" onClick={() => fileInputRef.current?.click()}><Upload className="size-4 ml-2" />استيراد</Button>
                <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleExcelImport} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Sticky Footer */}
      <div className="px-6 py-4 flex justify-between items-center shrink-0">
        <Button variant="default" disabled={step === 0} onClick={() => setStep(step - 1)}><ArrowRight className="ml-2" />السابق</Button>
        {step < 2 ? (
          <Button onClick={() => setStep(step + 1)}>التالي<ArrowLeft className="mr-2" /></Button>
        ) : (
          <Button onClick={() => { clearDraft(); onSubmit(data); }} disabled={!canSubmit || isSubmitting}>
            {isSubmitting ? <Loader2 className="animate-spin ml-2" /> : null}
            بدء التحليل الذكي
          </Button>
        )}
      </div>
    </div>
  );
}
