import api from './api';

export interface PurchaseItem {
  id?: number;
  ingredient: number;
  ingredient_name?: string;
  ingredient_unit?: string;
  description_snapshot?: string;
  package_quantity?: string;
  package_type?: 'bag' | 'box' | 'pack' | 'bottle' | 'can' | 'sack' | 'unit' | 'other';
  content_per_package?: string;
  content_unit?: string;
  total_content_in_stock_unit?: string;
  total_price?: string;
  unit_cost_in_stock_unit?: string;
  quantity: string;
  unit: string;
  quantity_in_stock_unit?: string;
  unit_price: string;
  subtotal?: string;
  previous_purchase_price?: string;
  new_purchase_price?: string;
}

export interface Purchase {
  id: number;
  negocio: number;
  supplier: number | null;
  supplier_name: string | null;
  status: 'draft' | 'confirmed' | 'cancelled';
  document_type: 'invoice' | 'receipt' | 'delivery_note' | 'other';
  document_number: string;
  purchase_date: string;
  notes: string;
  document_image: string | null;
  subtotal: string;
  taxes: string;
  discounts: string;
  total: string;
  confirmed_at: string | null;
  created_at: string;
  updated_at: string;
  items: PurchaseItem[];
}

export interface PurchasePayload {
  negocio: number;
  supplier: number | null;
  document_type: string;
  document_number: string;
  purchase_date: string;
  notes: string;
  taxes: string;
  discounts: string;
  items: PurchaseItem[];
  document_image?: File | null;
}

export interface PurchaseSummary {
  total_spent: string;
  purchases_count: number;
  average_purchase: string;
  top_supplier: { id: number | null; name: string | null; total: string } | null;
  top_ingredient_by_spend: { id: number | null; name: string | null; total: string } | null;
  spending_by_category: Array<{ category: string; total: string }>;
  recent_purchases: Purchase[];
}

export interface PurchaseImpact {
  ingredients_updated: Array<{ ingredient_id: number; name: string; unit: string; previous_stock: string; new_stock: string; previous_price: string; new_price: string; affected_products: unknown[] }>;
  movements_created: number;
  affected_products_count: number;
  alerts_created: number;
}

export interface OCRDetectedItem {
  detected_text: string;
  raw_text?: string;
  code?: string | null;
  description?: string;
  ingredient: number | null;
  ingredient_name: string;
  ingredient_unit: string;
  confidence: number;
  extraction_confidence?: number;
  match_strategy: string;
  match?: { ingredient: number | null; ingredient_name: string; confidence: number; strategy: string };
  requires_review: boolean;
  needs_review?: boolean;
  validation_warnings?: string[];
  presentation?: {
    presentation_type: PurchaseItem['package_type'] | 'other';
    package_quantity: string;
    content_per_package: string;
    content_unit: string;
    original_content_unit?: string;
    total_stock_quantity: string;
    base_unit_cost: string;
    source: string;
    confidence: number;
    needs_review: boolean;
  };
  presentation_type?: PurchaseItem['package_type'] | 'other';
  package_quantity?: string;
  content_per_package?: string;
  content_unit?: string;
  total_stock_quantity?: string;
  base_unit_cost?: string;
  presentation_source?: string;
  presentation_confidence?: number;
  confirmed?: boolean;
  line_status?: 'pending' | 'confirmed' | 'ignored';
  ocr_quantity?: string;
  ocr_unit_price?: string;
  ocr_subtotal?: string;
  quantity: string;
  unit: string;
  unit_price: string;
  subtotal: string;
}

export interface OCRResult {
  status?: 'success';
  provider?: string;
  supplier: { id: number | null; name: string; tax_id: string | null; address?: string };
  buyer?: { name?: string | null; address?: string | null; phone?: string | null };
  document?: { type?: string | null; number?: string | null; date?: string | null; subtotal?: string | null; taxes?: string | null; discount?: string | null; total?: string | null; currency?: string | null };
  table_detected?: boolean;
  date: string | null;
  document_type: 'invoice' | 'receipt' | 'delivery_note' | 'other';
  document_number: string;
  total: string;
  items: OCRDetectedItem[];
  confidence: number;
  summary: { items_found: number; items_requiring_review: number };
  warnings: string[];
  uncertain_lines?: Array<{ raw_line: string; normalized_line: string; classification: string; confidence: number; reason: string; product_score?: number; region?: string }>;
  ignored_regions?: Array<{ raw_line: string; normalized_line: string; classification: string; confidence: number; reason: string; product_score?: number; region?: string }>;
  unresolved_lines?: Array<{ raw_line: string; normalized_line: string; classification: string; confidence: number; reason: string; product_score?: number }>;
  processing_time_ms?: number;
  ocr_provider: string;
  raw_text: string;
  unknown_lines?: Array<{ raw_line: string; normalized_line: string; classification: string; confidence: number; reason: string; product_score?: number }>;
  debug?: {
    supplier_candidates: unknown[];
    classified_lines: Array<{ raw_line: string; normalized_line: string; classification: string; confidence: number; reason: string; product_score?: number }>;
    product_block_start: number | null;
    product_block_end: number | null;
    rejected_product_candidates: unknown[];
    product_score_threshold: number;
  };
}

export interface OCRStatus {
  provider: string;
  available: boolean;
  engine?: string;
  version?: string;
  language?: string;
  ocr_version?: string;
  python_version?: string;
  paddle_version?: string;
  message: string;
}

function toFormData(payload: PurchasePayload) {
  const form = new FormData();
  Object.entries(payload).forEach(([key, value]) => {
    if (key === 'items' || key === 'document_image') return;
    if (value !== null && value !== undefined) form.append(key, String(value));
  });
  const itemsJson = JSON.stringify(payload.items ?? []);
  if (import.meta.env.DEV) console.log('[purchases service] FormData items:', itemsJson);
  form.append('items', itemsJson);
  if (payload.document_image) form.append('document_image', payload.document_image);
  return form;
}

function logPurchaseRequest(operation: string, payload: PurchasePayload) {
  if (!import.meta.env.DEV) return;
  console.log(`[purchases service] ${operation} payload:`, payload);
  console.log(`[purchases service] ${operation} items:`, payload.items);
}

export async function getPurchases(params?: Record<string, string | number | boolean | undefined>) {
  const response = await api.get<Purchase[]>('/purchases/', { params });
  return response.data;
}

export async function getPurchaseSummary(businessId: number) {
  const response = await api.get<PurchaseSummary>('/purchases/summary/', { params: { business_id: businessId, period: 'month' } });
  return response.data;
}

export async function createPurchase(payload: PurchasePayload) {
  logPurchaseRequest('createPurchase', payload);
  const response = await api.post<Purchase>('/purchases/', toFormData(payload));
  return response.data;
}

export async function updatePurchase(id: number, payload: PurchasePayload) {
  logPurchaseRequest('updatePurchase', payload);
  const response = await api.patch<Purchase>(`/purchases/${id}/`, toFormData(payload));
  return response.data;
}

export async function confirmPurchase(id: number) {
  const response = await api.post<{ purchase: Purchase; impact: PurchaseImpact }>(`/purchases/${id}/confirm/`);
  return response.data;
}

export async function cancelPurchase(id: number) {
  const response = await api.post<Purchase>(`/purchases/${id}/cancel/`);
  return response.data;
}

export async function deletePurchase(id: number) {
  await api.delete(`/purchases/${id}/`);
}

export async function getOCRStatus() {
  const response = await api.get<OCRStatus>('/ocr/status/');
  return response.data;
}

export async function scanPurchaseInvoice(businessId: number, image: File, rawText?: string) {
  const form = new FormData();
  form.append('business_id', String(businessId));
  form.append('image', image);
  if (rawText) form.append('raw_text', rawText);
  const response = await api.post<OCRResult>('/purchases/ocr/', form, { timeout: 180000 });
  return response.data;
}
