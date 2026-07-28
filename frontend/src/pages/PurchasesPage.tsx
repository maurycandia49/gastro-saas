import { useEffect, useMemo, useState } from 'react';
import { Camera, Eye, FileImage, Pencil, Plus, Trash2, XCircle } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { CancelPurchaseDialog } from '../components/purchases/CancelPurchaseDialog';
import { ConfirmPurchaseDialog } from '../components/purchases/ConfirmPurchaseDialog';
import { DeletePurchaseDialog } from '../components/purchases/DeletePurchaseDialog';
import { InvoiceScanner } from '../components/purchases/InvoiceScanner';
import { OCRProcessingModal } from '../components/purchases/OCRProcessingModal';
import { OCRReviewTable } from '../components/purchases/OCRReviewTable';
import { PurchaseImpactModal } from '../components/purchases/PurchaseImpactModal';
import { PurchasesSkeleton } from '../components/purchases/PurchasesSkeleton';
import { DeactivateSupplierDialog } from '../components/suppliers/DeactivateSupplierDialog';
import { SupplierFormModal } from '../components/suppliers/SupplierFormModal';
import { getApiErrorMessage } from '../services/apiErrors';
import { getBusinesses, type Business } from '../services/business';
import { getInventory, type Ingredient } from '../services/inventory';
import { cancelPurchase, confirmPurchase, createPurchase, deletePurchase, getPurchaseSummary, getPurchases, scanPurchaseInvoice, updatePurchase, type OCRDetectedItem, type OCRResult, type Purchase, type PurchaseImpact, type PurchaseItem, type PurchasePayload, type PurchaseSummary } from '../services/purchases';
import { createSupplier, deleteSupplier, getSuppliers, updateSupplier, type Supplier, type SupplierPayload } from '../services/suppliers';

const emptyItem: PurchaseItem = { ingredient: 0, package_quantity: '1', package_type: 'bag', content_per_package: '', content_unit: 'kg', total_price: '', quantity: '', unit: 'kg', unit_price: '' };
type OCRScanStage = 'idle' | 'image_selected' | 'uploading' | 'processing' | 'success' | 'error' | 'timeout';
const PACKAGE_OPTIONS = [
  { value: 'bag', label: 'Bolsa' },
  { value: 'box', label: 'Caja' },
  { value: 'pack', label: 'Pack' },
  { value: 'bottle', label: 'Botella / bidón' },
  { value: 'can', label: 'Lata' },
  { value: 'sack', label: 'Saco' },
  { value: 'unit', label: 'Unidad suelta' },
  { value: 'other', label: 'Otra' },
] as const;
const UNIT_OPTIONS = ['kg', 'g', 'l', 'ml', 'unidad', 'docena', 'caja', 'bolsa', 'pack'];

function formatCurrency(value: number) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(value);
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function calculateItemsTotal(items: PurchaseItem[]) {
  return items.reduce((total, item) => total + Number(item.total_price || item.subtotal || (Number(item.quantity || 0) * Number(item.unit_price || 0)) || 0), 0);
}

function convertContentToStockUnit(quantity: number, fromUnit: string, toUnit?: string) {
  if (!toUnit || fromUnit === toUnit) return quantity;
  if (fromUnit === 'kg' && toUnit === 'g') return quantity * 1000;
  if (fromUnit === 'g' && toUnit === 'kg') return quantity / 1000;
  if (fromUnit === 'l' && toUnit === 'ml') return quantity * 1000;
  if (fromUnit === 'ml' && toUnit === 'l') return quantity / 1000;
  return fromUnit === toUnit ? quantity : null;
}

function getItemCalculation(item: PurchaseItem, ingredient?: Ingredient) {
  const packages = Number(item.package_quantity || 0);
  const content = Number(item.content_per_package || 0);
  const totalPrice = Number(item.total_price || 0);
  const contentUnit = item.content_unit || item.unit || ingredient?.unit || '';
  const totalContent = packages * content;
  const stockContent = convertContentToStockUnit(totalContent, contentUnit, ingredient?.unit);
  const unitCost = stockContent && stockContent > 0 ? totalPrice / stockContent : 0;
  return { totalContent, stockContent, unitCost, contentUnit };
}

export function PurchasesPage() {
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [businessId, setBusinessId] = useState<number | null>(null);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [summary, setSummary] = useState<PurchaseSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [showSupplier, setShowSupplier] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [editingPurchase, setEditingPurchase] = useState<Purchase | null>(null);
  const [selectedPurchase, setSelectedPurchase] = useState<Purchase | null>(null);
  const [invoicePreview, setInvoicePreview] = useState<string | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<'form' | Purchase | null>(null);
  const [cancelTarget, setCancelTarget] = useState<Purchase | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Purchase | null>(null);
  const [deactivateSupplierTarget, setDeactivateSupplierTarget] = useState<Supplier | null>(null);
  const [dialogError, setDialogError] = useState('');
  const [toast, setToast] = useState('');
  const [impact, setImpact] = useState<PurchaseImpact | null>(null);
  const [ocrResult, setOcrResult] = useState<OCRResult | null>(null);
  const [ocrItems, setOcrItems] = useState<OCRDetectedItem[]>([]);
  const [ocrStage, setOcrStage] = useState<OCRScanStage>('idle');
  const [ocrMessage, setOcrMessage] = useState('');
  const [ocrError, setOcrError] = useState('');
  const [ocrFile, setOcrFile] = useState<File | null>(null);
  const [ocrPreviewUrl, setOcrPreviewUrl] = useState('');
  const [ignoredUnknownLines, setIgnoredUnknownLines] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [form, setForm] = useState<PurchasePayload>({ negocio: 0, supplier: null, document_type: 'invoice', document_number: '', purchase_date: today(), notes: '', taxes: '0.00', discounts: '0.00', items: [{ ...emptyItem }], document_image: null });
  const validFormItems = form.items.filter((item) => item.ingredient && ((item.package_quantity && item.content_per_package && item.total_price) || (item.quantity && item.unit_price)));
  const formSubtotal = calculateItemsTotal(validFormItems);
  const formTotal = formSubtotal + Number(form.taxes || 0) - Number(form.discounts || 0);
  const confirmationSummary = confirmTarget === 'form'
    ? {
      supplierName: suppliers.find((supplier) => supplier.id === form.supplier)?.name ?? 'Sin proveedor',
      date: form.purchase_date,
      items: validFormItems.map((item) => ({ ...item, ingredient_name: ingredients.find((ingredient) => ingredient.id === Number(item.ingredient))?.name ?? item.ingredient_name })),
      subtotal: formSubtotal,
      taxes: form.taxes,
      discounts: form.discounts,
      total: formTotal,
    }
    : confirmTarget
      ? {
        supplierName: confirmTarget.supplier_name ?? 'Sin proveedor',
        date: confirmTarget.purchase_date,
        items: confirmTarget.items,
        subtotal: confirmTarget.subtotal,
        taxes: confirmTarget.taxes,
        discounts: confirmTarget.discounts,
        total: confirmTarget.total,
      }
      : null;

  const filteredPurchases = useMemo(() => purchases.filter((purchase) => {
    if (statusFilter && purchase.status !== statusFilter) return false;
    if (search && !`${purchase.supplier_name ?? ''} ${purchase.document_number}`.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }), [purchases, search, statusFilter]);

  const load = async (selected?: number) => {
    try {
      setLoading(true);
      setError('');
      const loadedBusinesses = businesses.length ? businesses : await getBusinesses();
      if (!businesses.length) setBusinesses(loadedBusinesses);
      const id = selected ?? businessId ?? loadedBusinesses.find((business) => business.active)?.id ?? loadedBusinesses[0]?.id ?? null;
      setBusinessId(id);
      if (!id) return;
      const [supplierResponse, ingredientResponse, purchaseResponse, summaryResponse] = await Promise.all([
        getSuppliers({ business_id: id, active: true }),
        getInventory({ business: id, active: true }),
        getPurchases({ business_id: id }),
        getPurchaseSummary(id),
      ]);
      setSuppliers(supplierResponse);
      setIngredients(ingredientResponse);
      setPurchases(purchaseResponse);
      setSummary(summaryResponse);
      setForm((current) => ({ ...current, negocio: id }));
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, 'No pudimos cargar compras.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(''), 2600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (!invoicePreview) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setInvoicePreview(null);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [invoicePreview]);

  useEffect(() => () => {
    if (ocrPreviewUrl) URL.revokeObjectURL(ocrPreviewUrl);
  }, [ocrPreviewUrl]);

  const updateItem = (index: number, patch: Partial<PurchaseItem>) => {
    setForm((current) => ({ ...current, items: current.items.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item) }));
  };

  const addItem = () => setForm((current) => ({ ...current, items: [...current.items, { ...emptyItem }] }));
  const removeItem = (index: number) => setForm((current) => ({ ...current, items: current.items.filter((_, itemIndex) => itemIndex !== index) }));
  const unresolvedOcrItems = ocrItems.filter((item) => !item.ingredient).length;

  const openNewPurchase = () => {
    if (!businessId) return;
    setEditingPurchase(null);
    setForm({ negocio: businessId, supplier: null, document_type: 'invoice', document_number: '', purchase_date: today(), notes: '', taxes: '0.00', discounts: '0.00', items: [{ ...emptyItem }], document_image: null });
    resetOcrScan();
    setShowForm(true);
  };

  const openEditPurchase = (purchase: Purchase) => {
    if (purchase.status !== 'draft') return;
    setEditingPurchase(purchase);
    setForm({
      negocio: purchase.negocio,
      supplier: purchase.supplier,
      document_type: purchase.document_type,
      document_number: purchase.document_number,
      purchase_date: purchase.purchase_date,
      notes: purchase.notes,
      taxes: purchase.taxes,
      discounts: purchase.discounts,
      items: purchase.items.length ? purchase.items : [{ ...emptyItem }],
      document_image: null,
    });
    resetOcrScan();
    setShowForm(true);
  };

  const applyOcrToDraft = (result: OCRResult, items: OCRDetectedItem[]) => {
    setForm((current) => ({
      ...current,
      supplier: result.supplier.id ?? current.supplier,
      document_type: result.document_type,
      document_number: result.document_number || current.document_number,
      purchase_date: result.date ?? current.purchase_date,
      items: items.map((item) => ({
        ingredient: item.ingredient ?? 0,
        description_snapshot: item.detected_text,
        package_quantity: '1',
        package_type: 'unit',
        content_per_package: item.quantity,
        content_unit: item.ingredient_unit || item.unit,
        total_price: item.subtotal || String(Number(item.quantity || 0) * Number(item.unit_price || 0)),
        quantity: item.quantity,
        unit: item.ingredient_unit || item.unit,
        unit_price: item.unit_price,
      })),
    }));
  };

  const scanInvoice = async (file: File) => {
    if (!businessId) {
      setOcrStage('error');
      setOcrError('Selecciona un negocio antes de escanear una factura.');
      return;
    }
    const previewUrl = URL.createObjectURL(file);
    setOcrPreviewUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      return previewUrl;
    });
    setOcrFile(file);
    setForm((current) => ({ ...current, document_image: file }));
    setOcrResult(null);
    setOcrItems([]);
    setIgnoredUnknownLines([]);
    setOcrError('');
    setError('');
    setOcrStage('image_selected');
    setOcrMessage('Imagen cargada. Preparando envio...');
    const timers = [
      window.setTimeout(() => {
        setOcrStage('processing');
        setOcrMessage('Preparando lector OCR por primera vez. Puede tardar unos segundos...');
      }, 900),
      window.setTimeout(() => {
        setOcrStage('processing');
        setOcrMessage('Leyendo factura con PaddleOCR...');
      }, 3500),
      window.setTimeout(() => {
        setOcrStage('processing');
        setOcrMessage('Organizando productos, cantidades y precios...');
      }, 9000),
    ];
    try {
      setOcrStage('uploading');
      setOcrMessage('Subiendo imagen al backend...');
      const result = await scanPurchaseInvoice(businessId, file);
      setOcrStage('processing');
      setOcrMessage('Relacionando productos con tus insumos...');
      setOcrResult(result);
      setOcrItems(result.items);
      applyOcrToDraft(result, result.items);
      setOcrStage('success');
      setOcrMessage(`Encontramos ${result.summary.items_found} productos. Solo necesitamos revisar ${result.summary.items_requiring_review}.`);
    } catch (requestError) {
      const isTimeout = typeof requestError === 'object' && requestError !== null && 'code' in requestError && (requestError as { code?: string }).code === 'ECONNABORTED';
      const message = isTimeout
        ? 'El OCR sigue tardando demasiado. Proba nuevamente o completa la compra manualmente.'
        : getApiErrorMessage(requestError, 'No pudimos leer esta factura. Podes completar la compra manualmente.');
      setOcrStage(isTimeout ? 'timeout' : 'error');
      setOcrMessage(message);
      setOcrError(message);
    } finally {
      timers.forEach((timer) => window.clearTimeout(timer));
    }
  };

  const resetOcrScan = () => {
    if (ocrPreviewUrl) URL.revokeObjectURL(ocrPreviewUrl);
    setOcrPreviewUrl('');
    setOcrFile(null);
    setOcrResult(null);
    setOcrItems([]);
    setIgnoredUnknownLines([]);
    setOcrStage('idle');
    setOcrMessage('');
    setOcrError('');
  };

  const completeManuallyAfterOcr = () => {
    setOcrResult(null);
    setOcrItems([]);
    setIgnoredUnknownLines([]);
    setOcrStage('idle');
    setOcrMessage('');
    setOcrError('');
  };

  const updateOcrItem = (index: number, patch: Partial<OCRDetectedItem>) => {
    setOcrItems((current) => {
      const next = current.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item);
      if (ocrResult) applyOcrToDraft(ocrResult, next);
      return next;
    });
  };

  const confirmOcrItem = (index: number) => {
    setOcrItems((current) => {
      const item = current[index];
      if (!item?.ingredient) {
        setError('ElegÃ­ un insumo antes de confirmar esta lÃ­nea.');
        return current;
      }
      setError('');
      const next = current.map((row, itemIndex) => itemIndex === index ? { ...row, requires_review: false, confidence: Math.max(row.confidence, 90) } : row);
      if (ocrResult) applyOcrToDraft(ocrResult, next);
      return next;
    });
  };

  const ignoreOcrItem = (index: number) => {
    setOcrItems((current) => {
      const next = current.filter((_, itemIndex) => itemIndex !== index);
      if (ocrResult) applyOcrToDraft(ocrResult, next.length ? next : []);
      return next;
    });
  };

  const markUnknownAsProduct = (rawLine: string) => {
    const item: OCRDetectedItem = { detected_text: rawLine, ingredient: null, ingredient_name: '', ingredient_unit: '', confidence: 30, match_strategy: 'manual_from_unknown', requires_review: true, quantity: '', unit: 'unidad', unit_price: '', subtotal: '' };
    const next = [...ocrItems, item];
    setOcrItems(next);
    setIgnoredUnknownLines((current) => [...current, rawLine]);
    if (ocrResult) applyOcrToDraft(ocrResult, next);
  };

  const ignoreUnknownLine = (rawLine: string) => {
    setIgnoredUnknownLines((current) => current.includes(rawLine) ? current : [...current, rawLine]);
  };

  const assignUnknownAsSupplier = (rawLine: string) => {
    setOcrResult((current) => current ? { ...current, supplier: { ...current.supplier, name: rawLine } } : current);
    setIgnoredUnknownLines((current) => current.includes(rawLine) ? current : [...current, rawLine]);
  };

  const assignUnknownAsAddress = (rawLine: string) => {
    setOcrResult((current) => current ? { ...current, supplier: { ...current.supplier, address: rawLine } } : current);
    setIgnoredUnknownLines((current) => current.includes(rawLine) ? current : [...current, rawLine]);
  };

  const saveDraft = async () => {
    if (!businessId) return;
    if (unresolvedOcrItems) {
      setError('Revisa las lineas sin insumo antes de guardar el borrador.');
      return;
    }
    try {
      setSaving(true);
      setError('');
      const payload = { ...form, negocio: businessId, items: validFormItems };
      if (editingPurchase) await updatePurchase(editingPurchase.id, payload); else await createPurchase(payload);
      setShowForm(false);
      setEditingPurchase(null);
      setForm({ negocio: businessId, supplier: null, document_type: 'invoice', document_number: '', purchase_date: today(), notes: '', taxes: '0.00', discounts: '0.00', items: [{ ...emptyItem }], document_image: null });
      setToast(editingPurchase ? 'Borrador actualizado.' : 'Compra guardada como borrador.');
      await load(businessId);
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, 'No pudimos guardar la compra.'));
    } finally {
      setSaving(false);
    }
  };

  const confirmDraft = async () => {
    if (unresolvedOcrItems) {
      setError('No puedes confirmar mientras existan lineas escaneadas sin insumo resuelto.');
      return;
    }
    setDialogError('');
    setConfirmTarget('form');
  };

  const executeConfirm = async () => {
    try {
      setSaving(true);
      setDialogError('');
      const target = confirmTarget;
      const draft = target === 'form'
        ? editingPurchase
          ? await updatePurchase(editingPurchase.id, { ...form, negocio: businessId ?? 0, items: validFormItems })
          : await createPurchase({ ...form, negocio: businessId ?? 0, items: validFormItems })
        : target;
      if (!draft) return;
      const response = await confirmPurchase(draft.id);
      setImpact(response.impact);
      setShowForm(false);
      setEditingPurchase(null);
      setConfirmTarget(null);
      setToast('Compra confirmada.');
      await load(businessId ?? undefined);
    } catch (requestError) {
      setDialogError(getApiErrorMessage(requestError, 'No pudimos confirmar la compra.'));
    } finally {
      setSaving(false);
    }
  };

  const confirmExisting = async (purchase: Purchase) => {
    setDialogError('');
    setConfirmTarget(purchase);
  };

  const executeCancel = async () => {
    if (!cancelTarget) return;
    try {
      setSaving(true);
      setDialogError('');
      await cancelPurchase(cancelTarget.id);
      setCancelTarget(null);
      setToast('Borrador cancelado.');
      await load(businessId ?? undefined);
    } catch (requestError) {
      setDialogError(getApiErrorMessage(requestError, 'No pudimos cancelar el borrador.'));
    } finally {
      setSaving(false);
    }
  };

  const executeDelete = async () => {
    if (!deleteTarget) return;
    try {
      setSaving(true);
      setDialogError('');
      await deletePurchase(deleteTarget.id);
      setDeleteTarget(null);
      setToast('Borrador eliminado.');
      await load(businessId ?? undefined);
    } catch (requestError) {
      setDialogError(getApiErrorMessage(requestError, 'No pudimos eliminar el borrador.'));
    } finally {
      setSaving(false);
    }
  };

  const executeDeactivateSupplier = async () => {
    if (!deactivateSupplierTarget) return;
    try {
      setSaving(true);
      setDialogError('');
      await deleteSupplier(deactivateSupplierTarget.id);
      setDeactivateSupplierTarget(null);
      setToast('Proveedor desactivado.');
      await load(businessId ?? undefined);
    } catch (requestError) {
      setDialogError(getApiErrorMessage(requestError, 'No pudimos desactivar el proveedor.'));
    } finally {
      setSaving(false);
    }
  };

  const saveSupplier = async (payload: SupplierPayload) => {
    try {
      setSaving(true);
      if (editingSupplier) await updateSupplier(editingSupplier.id, payload); else await createSupplier(payload);
      setShowSupplier(false);
      setToast(editingSupplier ? 'Proveedor actualizado.' : 'Proveedor creado.');
      setEditingSupplier(null);
      await load(businessId ?? undefined);
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, 'No pudimos guardar el proveedor.'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <PurchasesSkeleton />;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div><p className="text-sm font-medium uppercase tracking-[0.2em] text-slate-500">Compras</p><h1 className="mt-2 text-3xl font-semibold text-slate-900">Compras y proveedores</h1><p className="mt-2 text-sm text-slate-500">Registra entrada de mercaderia, facturas y cambios de costo.</p></div>
        <div className="flex flex-wrap gap-2"><button onClick={() => setShowSupplier(true)} className="rounded-2xl border px-4 py-3 text-sm font-semibold">Nuevo proveedor</button><button onClick={openNewPurchase} className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white"><Plus size={17} />Nueva compra</button></div>
      </div>
      {toast ? <div className="fixed right-4 top-4 z-[90] rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white shadow-xl">{toast}</div> : null}
      {error ? <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
      <div className="grid gap-4 md:grid-cols-4">
        <Card><p className="text-sm text-slate-500">Gasto del mes</p><p className="mt-2 text-2xl font-semibold">{formatCurrency(Number(summary?.total_spent ?? 0))}</p></Card>
        <Card><p className="text-sm text-slate-500">Compras</p><p className="mt-2 text-2xl font-semibold">{summary?.purchases_count ?? 0}</p></Card>
        <Card><p className="text-sm text-slate-500">Compra promedio</p><p className="mt-2 text-2xl font-semibold">{formatCurrency(Number(summary?.average_purchase ?? 0))}</p></Card>
        <Card><p className="text-sm text-slate-500">Proveedor principal</p><p className="mt-2 text-lg font-semibold">{summary?.top_supplier?.name ?? '—'}</p></Card>
      </div>
      <Card>
        <div className="mb-4 grid gap-3 md:grid-cols-3">
          {businesses.length > 1 ? <select value={businessId ?? ''} onChange={(e) => void load(Number(e.target.value))} className="rounded-2xl border px-4 py-3 text-sm">{businesses.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select> : null}
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="rounded-2xl border px-4 py-3 text-sm"><option value="">Todos los estados</option><option value="draft">Borrador</option><option value="confirmed">Confirmada</option><option value="cancelled">Cancelada</option></select>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar proveedor o documento" className="rounded-2xl border px-4 py-3 text-sm" />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase text-slate-400"><tr><th className="px-3 py-2">Fecha</th><th>Proveedor</th><th>Documento</th><th>Total</th><th>Estado</th><th>Factura</th><th>Acciones</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {filteredPurchases.map((purchase) => (
                <tr key={purchase.id}>
                  <td className="px-3 py-3">{purchase.purchase_date}</td>
                  <td>{purchase.supplier_name ?? 'Sin proveedor'}</td>
                  <td>{purchase.document_number || '—'}</td>
                  <td>{formatCurrency(Number(purchase.total))}</td>
                  <td><span className={`rounded-full px-2 py-1 text-xs font-semibold ${purchase.status === 'confirmed' ? 'bg-emerald-100 text-emerald-700' : purchase.status === 'cancelled' ? 'bg-slate-100 text-slate-500' : 'bg-amber-100 text-amber-700'}`}>{purchase.status === 'confirmed' ? 'Confirmada' : purchase.status === 'cancelled' ? 'Cancelada' : 'Borrador'}</span></td>
                  <td>{purchase.document_image ? <button type="button" onClick={() => setInvoicePreview(purchase.document_image)} className="inline-flex items-center gap-1 rounded-xl border px-3 py-2 text-xs font-semibold text-slate-700"><FileImage size={14} />Ver factura</button> : <span className="text-slate-400">Sin comprobante</span>}</td>
                  <td><div className="flex flex-wrap gap-2"><button type="button" onClick={() => setSelectedPurchase(purchase)} className="rounded-xl border px-3 py-2 text-xs font-semibold text-slate-700" aria-label="Ver detalle"><Eye size={14} /></button>{purchase.status === 'draft' ? <><button disabled={saving} type="button" onClick={() => openEditPurchase(purchase)} className="rounded-xl border px-3 py-2 text-xs font-semibold text-slate-700 disabled:opacity-50" aria-label="Editar borrador"><Pencil size={14} /></button><button disabled={saving} type="button" onClick={() => confirmExisting(purchase)} className="rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">Confirmar</button><button disabled={saving} type="button" onClick={() => { setDialogError(''); setCancelTarget(purchase); }} className="rounded-xl border px-3 py-2 text-xs font-semibold text-amber-700 disabled:opacity-50">Cancelar</button><button disabled={saving} type="button" onClick={() => { setDialogError(''); setDeleteTarget(purchase); }} className="rounded-xl border px-3 py-2 text-xs font-semibold text-red-600 disabled:opacity-50" aria-label="Eliminar borrador"><Trash2 size={14} /></button></> : purchase.status === 'confirmed' ? <button type="button" onClick={() => { setDialogError(''); setCancelTarget(purchase); }} className="inline-flex items-center gap-1 rounded-xl border px-3 py-2 text-xs font-semibold text-slate-600"><XCircle size={14} /> Corregir</button> : null}</div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <Card title="Proveedores" description="Contactos y estado de proveedores.">
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">{suppliers.map((supplier) => <div key={supplier.id} className="rounded-2xl border border-slate-200 p-4"><p className="font-semibold">{supplier.name}</p><p className="text-sm text-slate-500">{supplier.phone || supplier.email || 'Sin contacto cargado'}</p><div className="mt-3 flex flex-wrap gap-2"><button type="button" onClick={() => { setEditingSupplier(supplier); setShowSupplier(true); }} className="rounded-xl border px-3 py-2 text-xs font-semibold">Editar</button><button type="button" onClick={() => { setSearch(supplier.name); setStatusFilter(''); }} className="rounded-xl border px-3 py-2 text-xs font-semibold">Ver compras</button><button type="button" onClick={() => { setDialogError(''); setDeactivateSupplierTarget(supplier); }} className="rounded-xl border px-3 py-2 text-xs font-semibold text-red-600">Desactivar</button></div></div>)}</div>
      </Card>

      {showForm ? (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/50 p-4">
          <div className="mx-auto w-full max-w-5xl rounded-3xl bg-white p-6 shadow-xl">
            <h2 className="text-2xl font-semibold">{editingPurchase ? 'Editar borrador' : 'Nueva compra'}</h2>
            <p className="mt-2 text-sm text-slate-500">La compra no afecta stock ni costos hasta confirmarla.</p>
            <div className="mt-5">
              <InvoiceScanner disabled={saving || ocrStage === 'uploading' || ocrStage === 'processing'} onScan={(file) => void scanInvoice(file)} />
              {ocrPreviewUrl || ocrStage !== 'idle' ? (
                <div className={`mt-4 grid gap-4 rounded-2xl border p-4 text-sm md:grid-cols-[120px_1fr] ${ocrStage === 'error' || ocrStage === 'timeout' ? 'border-red-200 bg-red-50 text-red-800' : ocrStage === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-slate-200 bg-slate-50 text-slate-700'}`}>
                  {ocrPreviewUrl ? <img src={ocrPreviewUrl} alt="Factura seleccionada" className="h-28 w-full rounded-xl object-cover md:w-28" /> : null}
                  <div>
                    <p className="font-semibold">{ocrMessage || 'Imagen cargada.'}</p>
                    {ocrFile ? <p className="mt-1 text-xs opacity-80">{ocrFile.name} Â· {(ocrFile.size / 1024 / 1024).toFixed(2)} MB</p> : null}
                    {ocrError ? <p className="mt-2 text-sm">{ocrError}</p> : null}
                    {ocrResult ? <p className="mt-2">Encontramos {ocrResult.summary.items_found} productos. Solo necesitamos revisar {ocrResult.summary.items_requiring_review}. {ocrResult.processing_time_ms ? <span> Tiempo: {(ocrResult.processing_time_ms / 1000).toFixed(1)}s.</span> : null}</p> : null}
                    {ocrResult?.warnings.length ? <p className="mt-2 text-amber-700">{ocrResult.warnings.join(' ')}</p> : null}
                    {ocrStage === 'error' || ocrStage === 'timeout' ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button type="button" disabled={!ocrFile} onClick={() => { if (ocrFile) void scanInvoice(ocrFile); }} className="rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">Reintentar</button>
                        <button type="button" onClick={resetOcrScan} className="rounded-xl border border-current px-3 py-2 text-xs font-semibold">Cambiar foto</button>
                        <button type="button" onClick={completeManuallyAfterOcr} className="rounded-xl border border-current px-3 py-2 text-xs font-semibold">Completar manualmente</button>
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>
            {ocrResult ? (
              <div className="mt-4 grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm md:grid-cols-2">
                <div><p className="text-xs font-semibold uppercase text-slate-400">Proveedor</p><p className="font-semibold text-slate-900">{ocrResult.supplier.name || 'Sin detectar'}</p><p className="text-slate-500">{ocrResult.supplier.tax_id || 'CUIT sin detectar'}</p></div>
                <div><p className="text-xs font-semibold uppercase text-slate-400">Documento</p><p className="font-semibold text-slate-900">{ocrResult.document_number || 'Sin detectar'}</p><p className="text-slate-500">{ocrResult.date || 'Fecha sin detectar'}</p></div>
                <div><p className="text-xs font-semibold uppercase text-slate-400">Tabla de productos</p><p className={ocrResult.table_detected ? 'font-semibold text-emerald-700' : 'font-semibold text-amber-700'}>{ocrResult.table_detected ? 'Detectada' : 'No detectada con seguridad'}</p><p className="text-slate-500">{ocrResult.buyer?.name ? `Comprador: ${ocrResult.buyer.name}` : 'Comprador sin detectar'}</p></div>
                {ocrResult.supplier.address ? <div className="md:col-span-2"><p className="text-xs font-semibold uppercase text-slate-400">Direccion detectada</p><p className="text-slate-600">{ocrResult.supplier.address}</p></div> : null}
              </div>
            ) : null}
            <div className="mt-5 grid gap-4 md:grid-cols-3">
              <label className="text-sm font-medium">Proveedor<select value={form.supplier ?? ''} onChange={(e) => setForm({ ...form, supplier: e.target.value ? Number(e.target.value) : null })} className="mt-2 w-full rounded-2xl border px-4 py-3"><option value="">Sin proveedor</option>{suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
              <label className="text-sm font-medium">Tipo de documento<select value={form.document_type} onChange={(e) => setForm({ ...form, document_type: e.target.value })} className="mt-2 w-full rounded-2xl border px-4 py-3"><option value="invoice">Factura</option><option value="receipt">Ticket</option><option value="delivery_note">Remito</option><option value="other">Otro</option></select></label>
              <label className="text-sm font-medium">Numero<input value={form.document_number} onChange={(e) => setForm({ ...form, document_number: e.target.value })} placeholder="Ej. A-0001-00001234" className="mt-2 w-full rounded-2xl border px-4 py-3" /></label>
              <label className="text-sm font-medium">Fecha<input type="date" value={form.purchase_date} onChange={(e) => setForm({ ...form, purchase_date: e.target.value })} className="mt-2 w-full rounded-2xl border px-4 py-3" /></label>
              <label className="text-sm font-medium md:col-span-2">Foto de factura o remito<div className="mt-2 flex items-center gap-3 rounded-2xl border border-dashed px-4 py-3"><Camera size={18} /><input type="file" accept="image/*" capture="environment" onChange={(e) => setForm({ ...form, document_image: e.target.files?.[0] ?? null })} className="text-sm" /></div><span className="mt-1 block text-xs text-slate-500">Adjunta una foto de la factura o remito. Pedilo la conservara como respaldo.</span></label>
            </div>
            <div className="mt-6 space-y-3">
              <h3 className="font-semibold">Insumos comprados</h3>
              {ocrItems.length ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-4">
                    <div><p className="font-semibold text-slate-900">Revision inteligente de factura</p><p className="text-sm text-slate-500">Confirma sugerencias o selecciona manualmente los insumos dudosos.</p></div>
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${unresolvedOcrItems ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>{unresolvedOcrItems ? `${unresolvedOcrItems} por revisar` : 'Listo para guardar'}</span>
                  </div>
                  <OCRReviewTable items={ocrItems} ingredients={ingredients} onChange={updateOcrItem} onConfirm={confirmOcrItem} onIgnore={ignoreOcrItem} />
                  {ocrResult?.uncertain_lines?.filter((line) => !ignoredUnknownLines.includes(line.raw_line)).length ? (
                    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                      <p className="font-semibold text-amber-900">Líneas para revisar</p>
                      <p className="mt-1 text-sm text-amber-800">No se agregan como productos automáticamente. Revisalas y convertí solo las que correspondan.</p>
                      <div className="mt-3 space-y-2">
                        {ocrResult.uncertain_lines.filter((line) => !ignoredUnknownLines.includes(line.raw_line)).map((line, lineIndex) => (
                          <div key={`${line.raw_line}-${lineIndex}`} className="flex flex-col gap-2 rounded-xl bg-white p-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                            <div><p className="font-medium text-slate-800">{line.raw_line}</p><p className="text-xs text-slate-500">{line.reason}</p></div>
                            <div className="flex flex-wrap gap-2"><button type="button" onClick={() => markUnknownAsProduct(line.raw_line)} className="rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white">Marcar producto</button><button type="button" onClick={() => assignUnknownAsSupplier(line.raw_line)} className="rounded-xl border px-3 py-2 text-xs font-semibold text-slate-600">Asignar proveedor</button><button type="button" onClick={() => assignUnknownAsAddress(line.raw_line)} className="rounded-xl border px-3 py-2 text-xs font-semibold text-slate-600">Asignar dirección</button><button type="button" onClick={() => ignoreUnknownLine(line.raw_line)} className="rounded-xl border px-3 py-2 text-xs font-semibold text-slate-600">Ignorar</button></div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}
              {form.items.map((item, index) => {
                const selected = ingredients.find((ingredient) => ingredient.id === Number(item.ingredient));
                const calculation = getItemCalculation(item, selected);
                const packageLabel = PACKAGE_OPTIONS.find((option) => option.value === item.package_type)?.label.toLowerCase() ?? 'envase';
                const unusualCost = calculation.unitCost > 0 && calculation.unitCost > 10000;
                return (
                  <div key={index} className="rounded-2xl border border-slate-200 p-4">
                    <div className="grid gap-3 lg:grid-cols-[1.3fr_160px_150px_150px_150px_44px]">
                      <label className="text-sm font-medium text-slate-700">
                        Insumo
                        <select value={item.ingredient} onChange={(e) => { const ingredient = ingredients.find((row) => row.id === Number(e.target.value)); updateItem(index, { ingredient: Number(e.target.value), content_unit: ingredient?.unit ?? item.content_unit, unit: ingredient?.unit ?? item.unit }); }} className="mt-1 w-full rounded-xl border px-3 py-2">
                          <option value={0}>Elegí el insumo</option>
                          {ingredients.map((ingredient) => <option key={ingredient.id} value={ingredient.id}>{ingredient.name}</option>)}
                        </select>
                      </label>
                      <label className="text-sm font-medium text-slate-700">
                        Presentación
                        <select value={item.package_type ?? 'bag'} onChange={(e) => updateItem(index, { package_type: e.target.value as PurchaseItem['package_type'] })} className="mt-1 w-full rounded-xl border px-3 py-2">
                          {PACKAGE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                        </select>
                      </label>
                      <label className="text-sm font-medium text-slate-700">
                        Cantidad de envases
                        <input value={item.package_quantity ?? ''} onChange={(e) => updateItem(index, { package_quantity: e.target.value })} placeholder="Ej. 1" className="mt-1 w-full rounded-xl border px-3 py-2" />
                      </label>
                      <label className="text-sm font-medium text-slate-700">
                        Contenido por envase
                        <input value={item.content_per_package ?? ''} onChange={(e) => updateItem(index, { content_per_package: e.target.value })} placeholder="Ej. 25" className="mt-1 w-full rounded-xl border px-3 py-2" />
                      </label>
                      <label className="text-sm font-medium text-slate-700">
                        Unidad del contenido
                        <select value={item.content_unit || selected?.unit || 'kg'} onChange={(e) => updateItem(index, { content_unit: e.target.value, unit: e.target.value })} className="mt-1 w-full rounded-xl border px-3 py-2">
                          {UNIT_OPTIONS.map((unit) => <option key={unit} value={unit}>{unit}</option>)}
                        </select>
                      </label>
                      <button type="button" onClick={() => removeItem(index)} className="mt-6 rounded-xl border p-2 text-red-600"><Trash2 size={16} /></button>
                    </div>
                    <div className="mt-3 grid gap-3 md:grid-cols-[1fr_1fr]">
                      <label className="text-sm font-medium text-slate-700">
                        Precio total de la línea
                        <input value={item.total_price ?? ''} onChange={(e) => updateItem(index, { total_price: e.target.value })} placeholder="Ej. 12000" className="mt-1 w-full rounded-xl border px-3 py-2" />
                        <span className="mt-1 block text-xs text-slate-500">Usá el total pagado por esta línea. Ejemplo: 1 bolsa de 25 kg por $12.000.</span>
                      </label>
                      <div className={`rounded-2xl p-3 text-sm ${unusualCost ? 'bg-amber-50 text-amber-800' : 'bg-slate-50 text-slate-600'}`}>
                        <p className="font-semibold text-slate-900">Resumen automático</p>
                        <p>Ingresan: {calculation.totalContent ? `${calculation.totalContent} ${calculation.contentUnit}` : '—'}</p>
                        <p>Stock real: {calculation.stockContent !== null && selected ? `${calculation.stockContent} ${selected.unit}` : 'Unidad incompatible o pendiente'}</p>
                        <p>Costo real: {calculation.unitCost ? `${formatCurrency(calculation.unitCost)} por ${selected?.unit ?? calculation.contentUnit}` : '—'}</p>
                        {unusualCost ? <p className="mt-1 text-xs font-semibold">El costo calculado parece inusualmente alto. Revisá presentación, contenido o precio.</p> : null}
                      </div>
                    </div>
                    <p className="mt-2 text-xs text-slate-500">Pedilo calculará automáticamente cuánto ingresa al inventario y el costo por kg, litro o unidad. Una {packageLabel} no reemplaza la unidad real de contenido.</p>
                  </div>
                );
              })}
              <button onClick={addItem} className="rounded-2xl border px-4 py-2 text-sm font-semibold">Agregar linea</button>
            </div>
            <div className="mt-6 grid gap-4 md:grid-cols-3"><label className="text-sm font-medium">Impuestos<input value={form.taxes} onChange={(e) => setForm({ ...form, taxes: e.target.value })} placeholder="Ej. 2100" className="mt-2 w-full rounded-2xl border px-4 py-3" /></label><label className="text-sm font-medium">Descuentos<input value={form.discounts} onChange={(e) => setForm({ ...form, discounts: e.target.value })} placeholder="Ej. 500" className="mt-2 w-full rounded-2xl border px-4 py-3" /></label><label className="text-sm font-medium">Notas<input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Ej. Entrega completa" className="mt-2 w-full rounded-2xl border px-4 py-3" /></label></div>
            <div className="mt-6 rounded-2xl bg-amber-50 p-4 text-sm text-amber-800">Revision: al confirmar ingresara stock, cambiara el costo actual por el ultimo costo comprado y recalculara recetas/margenes.</div>
            <div className="mt-6 flex justify-end gap-3"><button onClick={() => { setShowForm(false); setEditingPurchase(null); }} className="rounded-2xl border px-4 py-2">Cancelar</button><button disabled={saving} onClick={() => void saveDraft()} className="rounded-2xl border px-4 py-2 font-semibold">{saving ? 'Guardando...' : 'Guardar borrador'}</button><button disabled={saving} onClick={() => void confirmDraft()} className="rounded-2xl bg-slate-900 px-4 py-2 font-semibold text-white">Confirmar compra</button></div>
          </div>
        </div>
      ) : null}
      <SupplierFormModal open={showSupplier} supplier={editingSupplier} businessId={businessId} saving={saving} onClose={() => { setShowSupplier(false); setEditingSupplier(null); }} onSubmit={(payload) => void saveSupplier(payload)} />
      <ConfirmPurchaseDialog open={Boolean(confirmTarget)} summary={confirmationSummary} loading={saving} error={dialogError} onClose={() => { if (!saving) setConfirmTarget(null); }} onConfirm={() => void executeConfirm()} />
      <CancelPurchaseDialog purchase={cancelTarget} loading={saving} error={dialogError} onClose={() => { if (!saving) setCancelTarget(null); }} onConfirm={() => void executeCancel()} />
      <DeletePurchaseDialog purchase={deleteTarget} loading={saving} error={dialogError} onClose={() => { if (!saving) setDeleteTarget(null); }} onConfirm={() => void executeDelete()} />
      <DeactivateSupplierDialog supplier={deactivateSupplierTarget} loading={saving} error={dialogError} onClose={() => { if (!saving) setDeactivateSupplierTarget(null); }} onConfirm={() => void executeDeactivateSupplier()} />
      {selectedPurchase ? (
        <div className="fixed inset-0 z-[65] overflow-y-auto bg-slate-950/50 p-4" role="dialog" aria-modal="true">
          <div className="ml-auto min-h-full w-full max-w-2xl rounded-3xl bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between gap-4"><div><h2 className="text-2xl font-semibold text-slate-900">Detalle de compra</h2><p className="mt-1 text-sm text-slate-500">{selectedPurchase.supplier_name ?? 'Sin proveedor'} · {selectedPurchase.purchase_date}</p></div><button onClick={() => setSelectedPurchase(null)} className="rounded-xl border px-3 py-2 text-sm">Cerrar</button></div>
            <div className="mt-5 grid gap-3 rounded-2xl bg-slate-50 p-4 text-sm sm:grid-cols-2">
              <p><span className="text-slate-500">Estado:</span> {selectedPurchase.status === 'confirmed' ? 'Confirmada' : selectedPurchase.status === 'cancelled' ? 'Cancelada' : 'Borrador'}</p>
              <p><span className="text-slate-500">Documento:</span> {selectedPurchase.document_number || 'Sin número'}</p>
              <p><span className="text-slate-500">Confirmada:</span> {selectedPurchase.confirmed_at ?? 'Aún no confirmada'}</p>
              <p><span className="text-slate-500">Comprobante:</span> {selectedPurchase.document_image ? <button onClick={() => setInvoicePreview(selectedPurchase.document_image)} className="font-semibold text-slate-900 underline">Ver factura</button> : 'Sin comprobante adjunto'}</p>
            </div>
            <div className="mt-5 space-y-2">
              {selectedPurchase.items.map((item, index) => (
                <div key={`${item.id ?? index}`} className="rounded-2xl border border-slate-100 p-3 text-sm">
                  <p className="font-semibold">{item.ingredient_name || item.description_snapshot || `Insumo #${item.ingredient}`}</p>
                  {item.package_quantity && item.content_per_package ? (
                    <p className="text-slate-500">{item.package_quantity} {item.package_type ?? 'envase'} · {item.content_per_package} {item.content_unit ?? item.unit} por envase · Total {formatCurrency(Number(item.total_price ?? item.subtotal ?? 0))}</p>
                  ) : (
                    <p className="text-slate-500">{item.quantity} {item.unit} · {formatCurrency(Number(item.unit_price))} · Subtotal {formatCurrency(Number(item.subtotal ?? 0))}</p>
                  )}
                  <p className="text-xs text-emerald-700">Ingresó al stock: {item.total_content_in_stock_unit ?? item.quantity_in_stock_unit ?? '—'} {item.ingredient_unit ?? item.unit} · Costo real: {formatCurrency(Number(item.unit_cost_in_stock_unit ?? item.new_purchase_price ?? 0))} por {item.ingredient_unit ?? item.unit}</p>
                  {item.previous_purchase_price || item.new_purchase_price ? <p className="text-xs text-amber-700">Costo anterior/nuevo: {item.previous_purchase_price ?? '—'} → {item.new_purchase_price ?? '—'}</p> : null}
                </div>
              ))}
            </div>
            <div className="mt-5 grid gap-3 text-sm sm:grid-cols-4"><div className="rounded-2xl bg-slate-50 p-3"><p className="text-slate-500">Subtotal</p><p className="font-semibold">{formatCurrency(Number(selectedPurchase.subtotal))}</p></div><div className="rounded-2xl bg-slate-50 p-3"><p className="text-slate-500">Impuestos</p><p className="font-semibold">{formatCurrency(Number(selectedPurchase.taxes))}</p></div><div className="rounded-2xl bg-slate-50 p-3"><p className="text-slate-500">Descuentos</p><p className="font-semibold">{formatCurrency(Number(selectedPurchase.discounts))}</p></div><div className="rounded-2xl bg-slate-900 p-3 text-white"><p className="text-slate-300">Total</p><p className="font-semibold">{formatCurrency(Number(selectedPurchase.total))}</p></div></div>
          </div>
        </div>
      ) : null}
      {invoicePreview ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/80 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-4xl rounded-3xl bg-white p-4 shadow-xl"><div className="mb-3 flex justify-end"><button onClick={() => setInvoicePreview(null)} className="rounded-xl border px-3 py-2 text-sm">Cerrar</button></div><img src={invoicePreview} alt="Factura adjunta" className="max-h-[75vh] w-full rounded-2xl object-contain" /></div>
        </div>
      ) : null}
      <PurchaseImpactModal impact={impact} onClose={() => setImpact(null)} />
      <OCRProcessingModal open={ocrStage === 'uploading' || ocrStage === 'processing'} stage={ocrStage === 'idle' ? 'processing' : ocrStage} message={ocrMessage} itemsFound={ocrResult?.summary.items_found} itemsRequiringReview={ocrResult?.summary.items_requiring_review} />
    </div>
  );
}

