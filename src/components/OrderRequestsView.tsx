import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowDownUp,
  ArrowRight,
  BadgeCheck,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  FileSearch,
  History,
  Inbox,
  Search,
  ShieldAlert,
  User,
  X,
  XCircle,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { verifyAndPriceOrderRequest } from '../lib/authoritativePricing';
import { db } from '../lib/firebase';
import {
  OrderWorkflowError,
  approveAndPromoteOrderRequest,
  createFirestoreOrderRequestStore,
  getDeterministicOrderId,
  getOfficialOrderNumber,
  rejectOrderRequest,
  startOrderRequestReview,
  subscribeOrderRequestAuditLogs,
  verifyOrderRequest,
} from '../lib/orderRequests';
import {
  CategoryItem,
  CoffeeOptionsSettings,
  MenuItem,
  ORDER_REQUEST_STATUSES,
  OrderRequest,
  OrderRequestAuditEntry,
  OrderRequestReviewStatus,
  OrderRequestStatus,
  PricingConfigSettings,
  ProductCustomization,
  VALIDATION_LIMITS,
  formatPrice,
} from '../types';
import { FirestoreRulesNotice } from './FirestoreRulesNotice';

interface OrderRequestsViewProps {
  requests: OrderRequest[];
  loading: boolean;
  rulesBlocked: boolean;
  menuItems: MenuItem[];
  categories: CategoryItem[];
  coffeeOptions: CoffeeOptionsSettings;
  productCustomizations: Record<string, ProductCustomization>;
  pricingConfig?: PricingConfigSettings | null;
  onViewCreatedOrder: (orderId: string) => void;
  onOpenCustomerPreview: () => void;
}

const REQUEST_STATUS_STYLES: Record<OrderRequestStatus, string> = {
  pending_review: 'bg-[#FEF3C7] border-[#F59E0B] text-[#92400E]',
  reviewing: 'bg-[#E0F2FE] border-[#38BDF8] text-[#075985]',
  verified: 'bg-[#E8EFEA] border-[#4A6B56] text-[#223629]',
  rejected: 'bg-[#FEF2F2] border-[#FCA5A5] text-[#991B1B]',
  order_created: 'bg-[#DCFCE7] border-[#4ADE80] text-[#166534]',
};

function getTimestampMillis(ts: OrderRequest['createdAt']): number {
  if (!ts || typeof ts.toMillis !== 'function') return 0;
  return ts.toMillis();
}

export function OrderRequestsView({
  requests,
  loading,
  rulesBlocked,
  menuItems,
  categories,
  coffeeOptions,
  productCustomizations,
  pricingConfig,
  onViewCreatedOrder,
  onOpenCustomerPreview,
}: OrderRequestsViewProps) {
  const { user, resolvedEmail } = useAuth();
  const { lang, t, localizedItemName } = useLanguage();

  const [statusFilter, setStatusFilter] = useState<'All' | OrderRequestStatus>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [actionInFlight, setActionInFlight] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const [approveModalOpen, setApproveModalOpen] = useState(false);
  const [approvalNote, setApprovalNote] = useState('');
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [auditLogs, setAuditLogs] = useState<OrderRequestAuditEntry[]>([]);

  const statusText = (status: OrderRequestStatus): string => {
    switch (status) {
      case 'pending_review':
        return t.filterPendingReview;
      case 'reviewing':
        return t.filterUnderReview;
      case 'verified':
        return t.filterVerified;
      case 'rejected':
        return t.filterRejected;
      case 'order_created':
        return t.filterOrderCreated;
    }
  };

  const reviewStatusText = (reviewStatus: OrderRequestReviewStatus): string => {
    if (lang === 'ar') {
      switch (reviewStatus) {
        case 'unreviewed':
          return 'غير مراجع';
        case 'in_review':
          return 'قيد الفحص';
        case 'verified':
          return 'تم التحقق';
        case 'needs_attention':
          return 'يحتاج معالجة';
        case 'approved':
          return 'معتمد';
        case 'rejected':
          return 'مرفوض';
      }
    }
    switch (reviewStatus) {
      case 'unreviewed':
        return 'Unreviewed';
      case 'in_review':
        return 'In Review';
      case 'verified':
        return 'Verified';
      case 'needs_attention':
        return 'Needs Attention';
      case 'approved':
        return 'Approved';
      case 'rejected':
        return 'Rejected';
    }
  };

  const formatDateTime = (ts: OrderRequest['createdAt'], fallbackIso?: string): string => {
    const locale = lang === 'ar' ? 'ar-SA' : 'en-US';
    if (ts && typeof ts.toDate === 'function') {
      const date = ts.toDate();
      return date.toLocaleString(locale, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    }
    if (fallbackIso) {
      const parsed = new Date(fallbackIso);
      if (!Number.isNaN(parsed.getTime())) {
        return parsed.toLocaleString(locale, {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        });
      }
    }
    return t.justNow;
  };

  const countsByStatus = useMemo(() => {
    const counts: Record<'All' | OrderRequestStatus, number> = {
      All: requests.length,
      pending_review: 0,
      reviewing: 0,
      verified: 0,
      rejected: 0,
      order_created: 0,
    };
    for (const req of requests) {
      counts[req.status] = (counts[req.status] || 0) + 1;
    }
    return counts;
  }, [requests]);

  const filteredRequests = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = requests.filter((req) => {
      if (statusFilter !== 'All' && req.status !== statusFilter) return false;
      if (!q) return true;
      return (
        req.requestReference.toLowerCase().includes(q) ||
        req.id.toLowerCase().includes(q) ||
        req.customerName.toLowerCase().includes(q) ||
        req.customerContact.toLowerCase().includes(q) ||
        (req.approvedOrderNumber || '').toLowerCase().includes(q) ||
        req.items.some((i) => (i.name || i.itemId).toLowerCase().includes(q))
      );
    });

    return [...list].sort((a, b) => {
      const diff = getTimestampMillis(a.createdAt) - getTimestampMillis(b.createdAt);
      return sortOrder === 'newest' ? -diff : diff;
    });
  }, [requests, statusFilter, searchQuery, sortOrder]);

  useEffect(() => {
    if (filteredRequests.length === 0) {
      setSelectedId(null);
      return;
    }
    if (!selectedId || !filteredRequests.some((r) => r.id === selectedId)) {
      setSelectedId(filteredRequests[0].id);
    }
  }, [filteredRequests, selectedId]);

  const selectedRequest = useMemo(
    () => filteredRequests.find((r) => r.id === selectedId) || null,
    [filteredRequests, selectedId]
  );

  // Subscribe to subcollection audit logs for the selected request with proper cleanup
  useEffect(() => {
    setActionError(null);
    if (!selectedRequest) {
      setAuditLogs([]);
      return;
    }
    const unsub = subscribeOrderRequestAuditLogs(
      db,
      selectedRequest.id,
      (logs) => setAuditLogs(logs),
      () => {
        // Gracefully fall back to embedded auditTrail summary if rules block subcollection read
        setAuditLogs([]);
      }
    );
    return () => unsub();
  }, [selectedRequest?.id]);

  const menuById = useMemo(() => {
    const map = new Map<string, MenuItem>();
    for (const item of menuItems) {
      map.set(item.id, item);
    }
    return map;
  }, [menuItems]);

  const liveVerification = useMemo(() => {
    if (!selectedRequest) return null;
    return verifyAndPriceOrderRequest(selectedRequest, {
      menuById,
      customizationsByProductId: productCustomizations,
      categories,
      coffeeOptions,
      pricingConfig,
    });
  }, [selectedRequest, menuById, productCustomizations, categories, coffeeOptions, pricingConfig]);

  const effectiveAuditEntries = useMemo(() => {
    if (auditLogs.length > 0) return auditLogs;
    return selectedRequest?.auditTrail ?? [];
  }, [auditLogs, selectedRequest?.auditTrail]);

  const adminActor = useMemo(
    () => ({
      uid: user?.uid || '',
      email: resolvedEmail || user?.email || undefined,
    }),
    [user?.uid, user?.email, resolvedEmail]
  );

  const runStore = () => createFirestoreOrderRequestStore(db, categories);

  const handleStartReview = async () => {
    if (!selectedRequest || actionInFlight) return;
    setActionError(null);
    setActionSuccess(null);
    setActionInFlight('start_review');
    try {
      await startOrderRequestReview({
        store: runStore(),
        requestId: selectedRequest.id,
        actor: adminActor,
      });
      setActionSuccess(
        lang === 'ar'
          ? 'تم نقل الطلب إلى حالة قيد المراجعة.'
          : 'Request moved to Under Review.'
      );
    } catch (err) {
      setActionError(
        err instanceof OrderWorkflowError || err instanceof Error
          ? err.message
          : 'Failed to start review.'
      );
    } finally {
      setActionInFlight(null);
    }
  };

  const handleVerifyRequest = async () => {
    if (!selectedRequest || actionInFlight) return;
    setActionError(null);
    setActionSuccess(null);
    setActionInFlight('verify');
    try {
      await verifyOrderRequest({
        store: runStore(),
        requestId: selectedRequest.id,
        actor: adminActor,
      });
      setActionSuccess(
        lang === 'ar'
          ? 'تم التحقق من التوفر والأسعار المعتمدة وحفظ النتيجة.'
          : 'Request items and authoritative SAR prices verified.'
      );
    } catch (err) {
      setActionError(
        err instanceof OrderWorkflowError || err instanceof Error
          ? err.message
          : 'Verification failed.'
      );
    } finally {
      setActionInFlight(null);
    }
  };

  const handleApproveAndCreateOrder = async () => {
    if (!selectedRequest || actionInFlight) return;
    setActionError(null);
    setActionSuccess(null);
    setActionInFlight('approve');
    try {
      const result = await approveAndPromoteOrderRequest({
        store: runStore(),
        requestId: selectedRequest.id,
        actor: adminActor,
        note: approvalNote.trim() || undefined,
      });
      setApproveModalOpen(false);
      setApprovalNote('');
      setActionSuccess(
        result.idempotentReplay
          ? lang === 'ar'
            ? `الطلب الرسمي #${result.order.orderNumber} موجود مسبقاً (لم يتم إنشاء نسخة مكررة).`
            : `Official order #${result.order.orderNumber} already exists (idempotent replay).`
          : lang === 'ar'
          ? `تم اعتماد الطلب وإنشاء الطلب الرسمي #${result.order.orderNumber}.`
          : `Approved and created official order #${result.order.orderNumber}.`
      );
    } catch (err) {
      setApproveModalOpen(false);
      setActionError(
        err instanceof OrderWorkflowError || err instanceof Error
          ? err.message
          : 'Failed to approve and promote order.'
      );
    } finally {
      setActionInFlight(null);
    }
  };

  const handleRejectRequest = async () => {
    if (!selectedRequest || actionInFlight) return;
    const trimmed = rejectionReason.trim();
    if (!trimmed) {
      setActionError(
        lang === 'ar'
          ? 'يرجى كتابة سبب الرفض قبل المتابعة.'
          : 'A rejection reason is required.'
      );
      return;
    }
    setActionError(null);
    setActionSuccess(null);
    setActionInFlight('reject');
    try {
      await rejectOrderRequest({
        store: runStore(),
        requestId: selectedRequest.id,
        actor: adminActor,
        rejectionReason: trimmed,
      });
      setRejectModalOpen(false);
      setRejectionReason('');
      setActionSuccess(
        lang === 'ar' ? 'تم رفض الطلب وتسجيل السبب.' : 'Order request rejected and recorded.'
      );
    } catch (err) {
      setRejectModalOpen(false);
      setActionError(
        err instanceof OrderWorkflowError || err instanceof Error
          ? err.message
          : 'Failed to reject order request.'
      );
    } finally {
      setActionInFlight(null);
    }
  };

  const canActOnSelected =
    selectedRequest !== null &&
    selectedRequest.status !== 'rejected' &&
    selectedRequest.status !== 'order_created';

  const verificationOk = Boolean(liveVerification?.ok);

  return (
    <div className="space-y-5">
      {rulesBlocked && <FirestoreRulesNotice />}

      {/* Filter, Search & Sort Bar */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex items-center gap-1 p-1 bg-white border border-[#E1E5E0] rounded-xl overflow-x-auto">
            {(['All', ...ORDER_REQUEST_STATUSES] as const).map((tab) => {
              const active = statusFilter === tab;
              const label = tab === 'All' ? t.all : statusText(tab);
              return (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setStatusFilter(tab)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                    active
                      ? 'bg-[#E8EFEA] text-[#223629]'
                      : 'text-[#4A584F] hover:text-[#162019] hover:bg-[#F5F6F4]'
                  }`}
                >
                  <span>{label}</span>
                  <span className="ms-1.5 font-mono tabular-nums opacity-75">
                    {countsByStatus[tab]}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2">
            <div className="relative flex-1 lg:w-72">
              <Search className="w-4 h-4 text-[#6B786F] absolute start-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t.searchRequestsPlaceholder}
                aria-label={t.searchRequestsPlaceholder}
                className="w-full ps-9 pe-3 py-2 bg-white border border-[#E1E5E0] rounded-xl text-sm text-[#162019] placeholder:text-[#89948C] focus:outline-none focus:border-[#2C4435]"
              />
            </div>

            <button
              type="button"
              onClick={() => setSortOrder((prev) => (prev === 'newest' ? 'oldest' : 'newest'))}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-[#E1E5E0] text-xs font-medium text-[#39463D] hover:bg-[#F5F6F4] whitespace-nowrap shrink-0 cursor-pointer"
            >
              <ArrowDownUp className="w-3.5 h-3.5 text-[#2C4435]" />
              <span>{sortOrder === 'newest' ? t.sortNewestFirst : t.sortOldestFirst}</span>
            </button>
          </div>
        </div>
      </div>

      {actionSuccess && (
        <div className="p-3.5 rounded-xl bg-[#DCFCE7] border border-[#86EFAC] text-xs text-[#166534] flex items-center justify-between gap-3">
          <span>{actionSuccess}</span>
          <button
            type="button"
            onClick={() => setActionSuccess(null)}
            aria-label={t.dismiss}
            className="p-1 rounded-lg hover:bg-[#BBF7D0] text-[#166534] cursor-pointer shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <div className="lg:col-span-5 space-y-3">
            {[1, 2, 3].map((n) => (
              <div
                key={n}
                className="bg-white border border-[#E1E5E0] rounded-xl p-4 space-y-2.5 animate-pulse"
              >
                <div className="h-4 w-32 bg-[#E8EFEA] rounded" />
                <div className="h-4 w-48 bg-[#F5F6F4] rounded" />
                <div className="h-3 w-full bg-[#F5F6F4] rounded" />
              </div>
            ))}
          </div>
          <div className="lg:col-span-7 bg-white border border-[#E1E5E0] rounded-xl p-6 h-80 animate-pulse" />
        </div>
      ) : filteredRequests.length === 0 ? (
        <div className="bg-white border border-[#E1E5E0] rounded-xl p-10 text-center space-y-4">
          <div className="w-11 h-11 rounded-xl bg-[#E8EFEA] text-[#2C4435] flex items-center justify-center mx-auto">
            <Inbox className="w-5 h-5" />
          </div>
          <div className="space-y-1 max-w-md mx-auto">
            <h3 className="font-display text-base font-semibold text-[#162019]">
              {requests.length === 0 ? t.noRequestsYet : t.noMatchingRequests}
            </h3>
            <p className="text-sm text-[#6B786F]">
              {requests.length === 0 ? t.noRequestsDesc : t.noMatchingOrdersDesc}
            </p>
          </div>
          {requests.length === 0 && (
            <button
              type="button"
              onClick={onOpenCustomerPreview}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#2C4435] hover:bg-[#223629] text-white text-xs font-medium transition-colors cursor-pointer"
            >
              <span>{t.openCustomerView}</span>
              <ArrowRight className="w-3.5 h-3.5 rtl:rotate-180" />
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* Left Column: Requests Queue */}
          <div className="lg:col-span-5 space-y-2.5">
            {filteredRequests.map((req) => {
              const isSelected = selectedRequest?.id === req.id;
              const totalUnits = req.items.reduce(
                (acc, item) => acc + (Number.isFinite(item.quantity) ? item.quantity : 0),
                0
              );
              return (
                <button
                  key={req.id}
                  type="button"
                  onClick={() => setSelectedId(req.id)}
                  className={`w-full text-start p-4 rounded-xl border transition-colors cursor-pointer space-y-2.5 ${
                    isSelected
                      ? 'bg-[#F9FAF8] border-[#2C4435] ring-1 ring-[#2C4435]/20'
                      : 'bg-white border-[#E1E5E0] hover:border-[#B6C7BC]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          dir="ltr"
                          className="font-mono text-xs font-semibold text-[#162019] tabular-nums"
                        >
                          {req.requestReference}
                        </span>
                        <span className="text-[11px] text-[#6B786F]">
                          {reviewStatusText(req.reviewStatus)}
                        </span>
                      </div>
                      <p className="text-sm font-semibold text-[#162019] truncate mt-0.5">
                        {req.customerName || 'Guest Customer'}
                      </p>
                      <p className="text-xs text-[#4A584F] truncate">
                        {req.customerContact || '—'}
                      </p>
                    </div>

                    <span
                      className={`px-2 py-0.5 rounded-md border text-[11px] font-medium whitespace-nowrap shrink-0 ${
                        REQUEST_STATUS_STYLES[req.status]
                      }`}
                    >
                      {statusText(req.status)}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-x-2.5 gap-y-1 text-xs text-[#39463D]">
                    {req.items.slice(0, 3).map((item, idx) => (
                      <span key={`${req.id}-preview-${idx}`} className="tabular-nums">
                        <span className="font-mono font-semibold text-[#2C4435]">
                          {item.quantity}×
                        </span>{' '}
                        {localizedItemName({
                          id: item.itemId || item.productId || '',
                          name: item.name || item.itemId,
                          nameAr: item.nameAr,
                        })}
                      </span>
                    ))}
                    {req.items.length > 3 && (
                      <span className="text-[#6B786F]">+{req.items.length - 3}</span>
                    )}
                  </div>

                  {req.notes && (
                    <p className="text-xs text-[#6B786F] truncate">
                      {t.notePrefix} {req.notes}
                    </p>
                  )}

                  <div className="flex items-center justify-between pt-1 border-t border-[#E1E5E0]/70 text-[11px] text-[#6B786F] tabular-nums">
                    <span className="inline-flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatDateTime(req.createdAt)}
                    </span>
                    <span>
                      {totalUnits} {t.itemsCountWord}
                      {req.approvedOrderNumber ? ` · #${req.approvedOrderNumber}` : ''}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Right Column: Detailed Request Review, Verification & Approval */}
          <div className="lg:col-span-7">
            {!selectedRequest ? (
              <div className="bg-white border border-[#E1E5E0] rounded-xl p-8 text-center text-sm text-[#6B786F]">
                {t.selectRequestHint}
              </div>
            ) : (
              <div className="bg-white border border-[#E1E5E0] rounded-xl overflow-hidden">
                {/* Request Header */}
                <div className="p-5 border-b border-[#E1E5E0] space-y-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          dir="ltr"
                          className="font-mono text-base font-bold text-[#162019]"
                        >
                          {selectedRequest.requestReference}
                        </span>
                        <span
                          className={`px-2.5 py-0.5 rounded-md border text-xs font-medium ${
                            REQUEST_STATUS_STYLES[selectedRequest.status]
                          }`}
                        >
                          {statusText(selectedRequest.status)}
                        </span>
                        <span className="px-2 py-0.5 rounded-md bg-[#F5F6F4] border border-[#E1E5E0] text-[11px] font-medium text-[#4A584F]">
                          {t.pickupOnlyBadge}
                        </span>
                      </div>
                      <p className="text-xs text-[#6B786F] tabular-nums">
                        {t.submittedAtLabel}: {formatDateTime(selectedRequest.createdAt)} ·{' '}
                        {t.reviewStatusLabel}: {reviewStatusText(selectedRequest.reviewStatus)}
                      </p>
                    </div>

                    {liveVerification && (
                      <div
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium ${
                          liveVerification.ok
                            ? 'bg-[#DCFCE7] border-[#86EFAC] text-[#166534]'
                            : 'bg-[#FEF2F2] border-[#FECACA] text-[#991B1B]'
                        }`}
                      >
                        {liveVerification.ok ? (
                          <BadgeCheck className="w-3.5 h-3.5 shrink-0" />
                        ) : (
                          <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
                        )}
                        <span>
                          {liveVerification.ok
                            ? t.verificationPassedBadge
                            : t.verificationBlockedBadge}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Customer Info & Notes */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                    <div className="p-3 rounded-xl bg-[#F9FAF8] border border-[#E1E5E0] space-y-1">
                      <p className="text-[11px] font-medium text-[#6B786F] flex items-center gap-1">
                        <User className="w-3 h-3" />
                        <span>{t.customerInfoLabel}</span>
                      </p>
                      <p className="text-sm font-semibold text-[#162019]">
                        {selectedRequest.customerName}
                      </p>
                      <p dir="ltr" className="text-xs text-[#4A584F] text-start">
                        {selectedRequest.customerContact}
                      </p>
                      {selectedRequest.pickupWindow && (
                        <p className="text-[11px] text-[#2C4435]">
                          {selectedRequest.pickupWindow}
                        </p>
                      )}
                    </div>

                    <div className="p-3 rounded-xl bg-[#F9FAF8] border border-[#E1E5E0] space-y-1">
                      <p className="text-[11px] font-medium text-[#6B786F]">
                        {t.customerNotesLabel}
                      </p>
                      <p className="text-xs text-[#162019] leading-relaxed">
                        {selectedRequest.notes || (lang === 'ar' ? 'لا توجد ملاحظات' : 'No special notes')}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Alerts / Status Banners */}
                <div className="p-5 space-y-4">
                  {actionError && (
                    <div className="p-3 rounded-xl bg-[#FEF2F2] border border-[#FECACA] text-xs text-[#991B1B]">
                      {actionError}
                    </div>
                  )}

                  {selectedRequest.status === 'order_created' && (
                    <div className="p-4 rounded-xl bg-[#DCFCE7]/60 border border-[#86EFAC] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="space-y-1">
                        <p className="text-xs font-semibold text-[#166534] flex items-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4" />
                          <span>{t.officialOrderCreatedBanner}</span>
                        </p>
                        <p className="text-xs text-[#166534]/90 font-mono" dir="ltr">
                          {t.officialOrderNumberLabel}: #{selectedRequest.approvedOrderNumber} ·{' '}
                          {t.officialOrderIdLabel}: {selectedRequest.approvedOrderId}
                        </p>
                        {selectedRequest.approvedByEmail && (
                          <p className="text-[11px] text-[#166534]/80">
                            {selectedRequest.approvedByEmail}
                          </p>
                        )}
                      </div>
                      {selectedRequest.approvedOrderId && (
                        <button
                          type="button"
                          onClick={() => onViewCreatedOrder(selectedRequest.approvedOrderId!)}
                          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#166534] hover:bg-[#14532D] text-white text-xs font-medium whitespace-nowrap shrink-0 cursor-pointer"
                        >
                          <span>{t.viewOfficialOrderBtn}</span>
                          <ArrowRight className="w-3.5 h-3.5 rtl:rotate-180" />
                        </button>
                      )}
                    </div>
                  )}

                  {selectedRequest.status === 'rejected' && (
                    <div className="p-4 rounded-xl bg-[#FEF2F2] border border-[#FECACA] space-y-1">
                      <p className="text-xs font-semibold text-[#991B1B] flex items-center gap-1.5">
                        <XCircle className="w-4 h-4" />
                        <span>{t.rejectionReasonBannerTitle}</span>
                      </p>
                      <p className="text-xs text-[#7F1D1D]">
                        {selectedRequest.rejectionReason}
                      </p>
                      {selectedRequest.rejectedByEmail && (
                        <p className="text-[11px] text-[#991B1B]/80">
                          {selectedRequest.rejectedByEmail}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Blocking Issues & Mismatch Warnings */}
                  {liveVerification && liveVerification.blockingIssues.length > 0 && (
                    <div className="p-3.5 rounded-xl bg-[#FEF2F2] border border-[#FECACA] space-y-1.5">
                      <p className="text-xs font-semibold text-[#991B1B] flex items-center gap-1.5">
                        <ShieldAlert className="w-4 h-4 shrink-0" />
                        <span>{t.verificationBlockedBadge}</span>
                      </p>
                      <ul className="space-y-1 text-xs text-[#7F1D1D] list-disc ps-5">
                        {liveVerification.blockingIssues.map((issue, idx) => (
                          <li key={`${issue.code}-${idx}`}>
                            {lang === 'ar' ? issue.ar : issue.en}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {liveVerification && liveVerification.warnings.length > 0 && (
                    <div className="p-3.5 rounded-xl bg-[#FFFBEB] border border-[#FCD34D] space-y-1">
                      <p className="text-xs font-semibold text-[#92400E] flex items-center gap-1.5">
                        <AlertTriangle className="w-4 h-4 shrink-0" />
                        <span>{t.priceMismatchWarningTitle}</span>
                      </p>
                      {liveVerification.warnings.map((w, idx) => (
                        <p key={`${w.code}-${idx}`} className="text-xs text-[#78350F]">
                          {lang === 'ar' ? w.ar : w.en}
                        </p>
                      ))}
                    </div>
                  )}

                  {/* Requested Items Verification List */}
                  <div className="space-y-2.5">
                    <h4 className="font-display text-xs font-semibold uppercase tracking-wide text-[#4A584F]">
                      {t.requestedItemsTitle}
                    </h4>

                    <div className="divide-y divide-[#E1E5E0] border border-[#E1E5E0] rounded-xl overflow-hidden">
                      {(selectedRequest.status === 'order_created' &&
                      selectedRequest.verifiedItems?.length
                        ? selectedRequest.verifiedItems
                        : liveVerification?.verifiedItems || []
                      ).map((vItem, idx) => (
                        <div
                          key={`${selectedRequest.id}-vitem-${idx}`}
                          className="p-3.5 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                        >
                          <div className="space-y-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-mono text-xs font-bold text-[#2C4435] tabular-nums">
                                {vItem.quantity}×
                              </span>
                              <span className="text-sm font-semibold text-[#162019]">
                                {localizedItemName({
                                  id: vItem.itemId,
                                  name: vItem.name,
                                  nameAr: vItem.nameAr,
                                })}
                              </span>
                              <span
                                className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                                  vItem.inStockVerified
                                    ? 'bg-[#DCFCE7] text-[#166534]'
                                    : 'bg-[#FEF2F2] text-[#991B1B]'
                                }`}
                              >
                                {vItem.inStockVerified
                                  ? t.itemInStockTag
                                  : t.itemUnavailableTag}
                              </span>
                            </div>

                            {vItem.note && (
                              <p className="text-xs text-[#4A584F]">{vItem.note}</p>
                            )}

                            <p className="text-[11px] text-[#6B786F] tabular-nums">
                              {t.basePriceLabel}: {formatPrice(vItem.basePrice)}
                              {vItem.customizationTotal > 0
                                ? ` · ${t.extrasPriceLabel}: +${formatPrice(vItem.customizationTotal)}`
                                : ''}{' '}
                              · {t.unitPriceVerifiedLabel}:{' '}
                              <span className="font-mono font-semibold text-[#162019]">
                                {formatPrice(vItem.price)}
                              </span>
                              {vItem.priceAdjustedFromSubmitted &&
                                typeof vItem.submittedUnitPrice === 'number' && (
                                  <span className="ms-2 text-[#B45309] line-through">
                                    ({t.submittedEstimateLabel}: {formatPrice(vItem.submittedUnitPrice)})
                                  </span>
                                )}
                            </p>
                          </div>

                          <div className="text-start sm:text-end shrink-0">
                            <p className="text-[11px] text-[#6B786F]">
                              {t.lineTotalVerifiedLabel}
                            </p>
                            <p className="font-mono text-sm font-semibold text-[#162019] tabular-nums">
                              {formatPrice(vItem.lineTotal)}
                            </p>
                          </div>
                        </div>
                      ))}

                      {/* Render fallback raw items if any item failed lookup completely before verifiedItems populated */}
                      {liveVerification &&
                        liveVerification.verifiedItems.length < selectedRequest.items.length &&
                        selectedRequest.items
                          .filter(
                            (raw) =>
                              !liveVerification.verifiedItems.some(
                                (vi) => vi.itemId === (raw.itemId || raw.productId)
                              )
                          )
                          .map((missingItem, mIdx) => (
                            <div
                              key={`missing-${mIdx}`}
                              className="p-3.5 bg-[#FEF2F2]/50 flex items-center justify-between gap-3"
                            >
                              <div className="space-y-0.5">
                                <p className="text-sm font-semibold text-[#991B1B]">
                                  {missingItem.quantity}×{' '}
                                  {missingItem.name || missingItem.itemId || missingItem.productId}
                                </p>
                                <p className="text-[11px] text-[#991B1B]">
                                  ID: {missingItem.itemId || missingItem.productId || '—'}
                                </p>
                              </div>
                              <span className="px-2 py-0.5 rounded bg-[#FEF2F2] border border-[#FECACA] text-[11px] font-medium text-[#991B1B]">
                                {t.itemUnavailableTag}
                              </span>
                            </div>
                          ))}
                    </div>
                  </div>

                  {/* Authoritative Pricing Breakdown */}
                  {(() => {
                    const breakdown =
                      selectedRequest.status === 'order_created' && selectedRequest.verifiedPricing
                        ? selectedRequest.verifiedPricing
                        : liveVerification?.breakdown;
                    if (!breakdown) return null;
                    return (
                      <div className="p-4 rounded-xl bg-[#F9FAF8] border border-[#E1E5E0] space-y-2">
                        <h4 className="font-display text-xs font-semibold uppercase tracking-wide text-[#4A584F]">
                          {t.verifiedPricingTitle}
                        </h4>
                        <div className="space-y-1.5 text-xs">
                          <div className="flex justify-between text-[#4A584F] tabular-nums">
                            <span>{t.subtotalLabel}</span>
                            <span className="font-mono">{formatPrice(breakdown.subtotalSar)}</span>
                          </div>
                          {breakdown.discountSar > 0 && (
                            <div className="flex justify-between text-[#166534] tabular-nums">
                              <span>
                                {t.discountLabel}
                                {breakdown.appliedDiscountLabel
                                  ? ` (${breakdown.appliedDiscountLabel})`
                                  : ''}
                              </span>
                              <span className="font-mono">-{formatPrice(breakdown.discountSar)}</span>
                            </div>
                          )}
                          {breakdown.taxSar > 0 && (
                            <div className="flex justify-between text-[#4A584F] tabular-nums">
                              <span>
                                {t.taxLabel}
                                {breakdown.appliedTaxRatePercent
                                  ? ` (${breakdown.appliedTaxRatePercent}%)`
                                  : ''}
                              </span>
                              <span className="font-mono">{formatPrice(breakdown.taxSar)}</span>
                            </div>
                          )}
                          <div className="flex justify-between items-baseline pt-2 border-t border-[#E1E5E0]">
                            <span className="text-sm font-semibold text-[#162019]">
                              {t.verifiedOrderTotalSar}
                            </span>
                            <span className="font-mono text-lg font-bold text-[#2C4435] tabular-nums">
                              {formatPrice(breakdown.totalSar)}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Admin Action Controls */}
                  {canActOnSelected && (
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      {selectedRequest.status === 'pending_review' && (
                        <button
                          type="button"
                          disabled={Boolean(actionInFlight)}
                          onClick={handleStartReview}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-[#CBD4CD] bg-white hover:bg-[#F5F6F4] disabled:opacity-50 text-xs font-medium text-[#162019] cursor-pointer"
                        >
                          <FileSearch className="w-3.5 h-3.5 text-[#2C4435]" />
                          <span>{t.startReviewBtn}</span>
                        </button>
                      )}

                      {(selectedRequest.status === 'pending_review' ||
                        selectedRequest.status === 'reviewing') && (
                        <button
                          type="button"
                          disabled={Boolean(actionInFlight) || !verificationOk}
                          onClick={handleVerifyRequest}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-[#2C4435] bg-[#E8EFEA] hover:bg-[#D7E4DC] disabled:opacity-50 text-xs font-medium text-[#223629] cursor-pointer"
                        >
                          <ClipboardCheck className="w-3.5 h-3.5" />
                          <span>{t.markVerifiedBtn}</span>
                        </button>
                      )}

                      <button
                        type="button"
                        disabled={Boolean(actionInFlight) || !verificationOk}
                        onClick={() => setApproveModalOpen(true)}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#2C4435] hover:bg-[#223629] disabled:opacity-50 text-white text-xs font-medium cursor-pointer"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>{t.approveCreateOrderBtn}</span>
                      </button>

                      <button
                        type="button"
                        disabled={Boolean(actionInFlight)}
                        onClick={() => {
                          setRejectionReason('');
                          setRejectModalOpen(true);
                        }}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-[#FECACA] bg-white hover:bg-[#FEF2F2] disabled:opacity-50 text-xs font-medium text-[#991B1B] cursor-pointer"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        <span>{t.rejectRequestBtn}</span>
                      </button>
                    </div>
                  )}

                  {/* Audit Trail */}
                  <div className="pt-3 border-t border-[#E1E5E0] space-y-2.5">
                    <h4 className="font-display text-xs font-semibold uppercase tracking-wide text-[#4A584F] flex items-center gap-1.5">
                      <History className="w-3.5 h-3.5 text-[#2C4435]" />
                      <span>{t.auditTrailTitle}</span>
                    </h4>

                    {effectiveAuditEntries.length === 0 ? (
                      <p className="text-xs text-[#6B786F]">{t.noAuditLogsYet}</p>
                    ) : (
                      <div className="space-y-2">
                        {effectiveAuditEntries.map((entry) => (
                          <div
                            key={entry.id}
                            className="p-2.5 rounded-lg bg-[#F9FAF8] border border-[#E1E5E0] flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs"
                          >
                            <div className="space-y-0.5 min-w-0">
                              <p className="font-medium text-[#162019]">
                                <span className="font-mono text-[11px] text-[#2C4435]">
                                  {entry.action}
                                </span>{' '}
                                · {entry.actorEmail || entry.actorUid}
                              </p>
                              {(entry.note || entry.rejectionReason) && (
                                <p className="text-[11px] text-[#4A584F] truncate">
                                  {entry.rejectionReason || entry.note}
                                </p>
                              )}
                            </div>
                            <span className="text-[11px] text-[#6B786F] tabular-nums shrink-0">
                              {formatDateTime(entry.createdAt, entry.createdAtIso)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Confirm Approve & Promote Modal */}
      {approveModalOpen && selectedRequest && liveVerification && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={t.confirmApproveTitle}
          className="fixed inset-0 z-50 bg-[#162019]/45 backdrop-blur-[2px] flex items-center justify-center p-4"
        >
          <div className="bg-white border border-[#E1E5E0] rounded-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <h3 className="font-display text-base font-semibold text-[#162019]">
                {t.confirmApproveTitle}
              </h3>
              <button
                type="button"
                onClick={() => setApproveModalOpen(false)}
                className="p-1 rounded-lg text-[#6B786F] hover:bg-[#F5F6F4] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-[#4A584F] leading-relaxed">{t.confirmApproveDesc}</p>

            <div className="p-3.5 rounded-xl bg-[#F9FAF8] border border-[#E1E5E0] space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-[#6B786F]">{t.requestRefLabel}</span>
                <span dir="ltr" className="font-mono font-semibold text-[#162019]">
                  {selectedRequest.requestReference}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#6B786F]">{t.officialOrderNumberLabel}</span>
                <span dir="ltr" className="font-mono font-semibold text-[#2C4435]">
                  #{getOfficialOrderNumber(selectedRequest.id, selectedRequest.requestReference)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#6B786F]">{t.officialOrderIdLabel}</span>
                <span dir="ltr" className="font-mono text-[11px] text-[#4A584F] truncate max-w-[200px]">
                  {getDeterministicOrderId(selectedRequest.id)}
                </span>
              </div>
              <div className="flex justify-between pt-1.5 border-t border-[#E1E5E0]">
                <span className="font-semibold text-[#162019]">{t.verifiedOrderTotalSar}</span>
                <span className="font-mono font-bold text-[#2C4435]">
                  {formatPrice(liveVerification.breakdown.totalSar)}
                </span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-[#162019] mb-1">
                {lang === 'ar' ? 'ملاحظة اعتماد اختيارية' : 'Optional Admin Note'}
              </label>
              <input
                type="text"
                maxLength={120}
                value={approvalNote}
                onChange={(e) => setApprovalNote(e.target.value)}
                placeholder={lang === 'ar' ? 'مثال: مؤكد للاستلام خلال 15 دقيقة' : 'e.g. Verified for counter pickup'}
                className="w-full px-3 py-2 rounded-xl border border-[#CBD4CD] text-xs text-[#162019] focus:outline-none focus:border-[#2C4435]"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                disabled={actionInFlight === 'approve'}
                onClick={() => setApproveModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-[#E1E5E0] text-xs font-medium text-[#4A584F] hover:bg-[#F5F6F4] cursor-pointer"
              >
                {t.cancel}
              </button>
              <button
                type="button"
                disabled={actionInFlight === 'approve'}
                onClick={handleApproveAndCreateOrder}
                className="px-4 py-2 rounded-xl bg-[#2C4435] hover:bg-[#223629] disabled:opacity-60 text-white text-xs font-medium cursor-pointer"
              >
                {actionInFlight === 'approve' ? t.approvingOrderBtn : t.confirmApproveAction}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mandatory Rejection Reason Modal */}
      {rejectModalOpen && selectedRequest && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={t.rejectModalTitle}
          className="fixed inset-0 z-50 bg-[#162019]/45 backdrop-blur-[2px] flex items-center justify-center p-4"
        >
          <div className="bg-white border border-[#E1E5E0] rounded-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <h3 className="font-display text-base font-semibold text-[#162019]">
                {t.rejectModalTitle}
              </h3>
              <button
                type="button"
                onClick={() => setRejectModalOpen(false)}
                className="p-1 rounded-lg text-[#6B786F] hover:bg-[#F5F6F4] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-[#4A584F] leading-relaxed">{t.rejectModalDesc}</p>

            <div>
              <label className="block text-xs font-medium text-[#162019] mb-1">
                {t.rejectionReasonLabel}
              </label>
              <textarea
                rows={3}
                required
                maxLength={VALIDATION_LIMITS.orderRequest.rejectionReasonMaxLength}
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder={t.rejectionReasonPlaceholder}
                className="w-full px-3 py-2 rounded-xl border border-[#CBD4CD] text-xs text-[#162019] focus:outline-none focus:border-[#991B1B]"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                disabled={actionInFlight === 'reject'}
                onClick={() => setRejectModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-[#E1E5E0] text-xs font-medium text-[#4A584F] hover:bg-[#F5F6F4] cursor-pointer"
              >
                {t.cancel}
              </button>
              <button
                type="button"
                disabled={actionInFlight === 'reject' || !rejectionReason.trim()}
                onClick={handleRejectRequest}
                className="px-4 py-2 rounded-xl bg-[#DC2626] hover:bg-[#B91C1C] disabled:opacity-60 text-white text-xs font-medium cursor-pointer"
              >
                {actionInFlight === 'reject' ? t.rejectingBtn : t.confirmRejectAction}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
