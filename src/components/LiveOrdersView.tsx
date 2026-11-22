import { useMemo, useState } from 'react';
import { deleteDoc, doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { ArrowRight, Check, Clock, Search, ShoppingBag, Trash2 } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { OperationType, db, handleFirestoreError } from '../lib/firebase';
import { ORDER_STATUSES, Order, OrderStatus, formatPrice } from '../types';

interface LiveOrdersViewProps {
  orders: Order[];
  loading: boolean;
  onOpenCustomerPreview: () => void;
}

const STATUS_BUTTON_STYLES: Record<OrderStatus, string> = {
  Pending: 'bg-[#FEF3C7] border-[#F59E0B] text-[#92400E]',
  Preparing: 'bg-[#E0F2FE] border-[#38BDF8] text-[#075985]',
  Ready: 'bg-[#DCFCE7] border-[#4ADE80] text-[#166534]',
  Completed: 'bg-[#EEF2EF] border-[#94A39A] text-[#334139]',
};

export function LiveOrdersView({ orders, loading, onOpenCustomerPreview }: LiveOrdersViewProps) {
  const { lang, t, statusLabel, localizedItemName } = useLanguage();
  const [statusFilter, setStatusFilter] = useState<'All' | OrderStatus>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [confirmDeleteOrder, setConfirmDeleteOrder] = useState<Order | null>(null);
  const [deleting, setDeleting] = useState(false);

  const formatOrderTimestamp = (order: Order): string => {
    if (!order.createdAt) return t.justNow;
    const date = order.createdAt.toDate();
    const locale = lang === 'ar' ? 'ar-SA' : undefined;
    const timeStr = date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
    const diffMins = Math.max(0, Math.floor((Date.now() - date.getTime()) / 60000));
    if (diffMins < 1) return `${timeStr} · ${t.justNow}`;
    if (diffMins < 60) return `${timeStr} · ${diffMins}${t.minsAgo}`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${timeStr} · ${diffHours}${t.hoursAgo}`;
    return `${date.toLocaleDateString(locale, { month: 'short', day: 'numeric' })} · ${timeStr}`;
  };

  const countsByStatus = useMemo(() => {
    const counts: Record<'All' | OrderStatus, number> = {
      All: orders.length,
      Pending: 0,
      Preparing: 0,
      Ready: 0,
      Completed: 0,
    };
    for (const order of orders) {
      counts[order.status] = (counts[order.status] || 0) + 1;
    }
    return counts;
  }, [orders]);

  const filteredOrders = useMemo(() => {
    const queryLower = searchQuery.trim().toLowerCase();
    return orders.filter((order) => {
      if (statusFilter !== 'All' && order.status !== statusFilter) return false;
      if (!queryLower) return true;
      return (
        order.orderNumber.toLowerCase().includes(queryLower) ||
        order.customerName.toLowerCase().includes(queryLower) ||
        order.customerContact.toLowerCase().includes(queryLower) ||
        order.items.some(
          (item) =>
            item.name.toLowerCase().includes(queryLower) ||
            localizedItemName({ id: item.itemId, name: item.name })
              .toLowerCase()
              .includes(queryLower)
        )
      );
    });
  }, [orders, statusFilter, searchQuery, localizedItemName]);

  const handleStatusChange = async (orderId: string, nextStatus: OrderStatus) => {
    setUpdateError(null);
    setUpdatingId(orderId);
    const path = `orders/${orderId}`;
    try {
      await updateDoc(doc(db, 'orders', orderId), {
        status: nextStatus,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      setUpdateError(t.orderStatusUpdateError);
      handleFirestoreError(error, OperationType.UPDATE, path);
    } finally {
      setUpdatingId(null);
    }
  };

  const handleDeleteOrderConfirmed = async () => {
    if (!confirmDeleteOrder) return;
    setDeleting(true);
    const target = confirmDeleteOrder;
    const path = `orders/${target.id}`;
    try {
      await deleteDoc(doc(db, 'orders', target.id));
      setConfirmDeleteOrder(null);
    } catch (error) {
      setUpdateError(t.orderStatusUpdateError);
      handleFirestoreError(error, OperationType.DELETE, path);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Filter & Search Toolbar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex items-center gap-1 p-1 bg-white border border-[#E1E5E0] rounded-xl overflow-x-auto">
          {(['All', ...ORDER_STATUSES] as const).map((tab) => {
            const active = statusFilter === tab;
            const label = tab === 'All' ? t.all : statusLabel(tab);
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

        <div className="relative w-full lg:w-72">
          <Search className="w-4 h-4 text-[#6B786F] absolute start-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t.searchOrdersPlaceholder}
            aria-label={t.searchOrdersPlaceholder}
            className="w-full ps-9 pe-3 py-2 bg-white border border-[#E1E5E0] rounded-xl text-sm text-[#162019] placeholder:text-[#89948C] focus:outline-none focus:border-[#2C4435]"
          />
        </div>
      </div>

      {updateError && (
        <div className="p-3 rounded-xl bg-[#FEF2F2] border border-[#FECACA] text-xs text-[#991B1B]">
          {updateError}
        </div>
      )}

      {/* Orders List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((n) => (
            <div
              key={n}
              className="bg-white border border-[#E1E5E0] rounded-xl p-5 space-y-3 animate-pulse"
            >
              <div className="flex justify-between">
                <div className="h-5 w-40 bg-[#E8EFEA] rounded" />
                <div className="h-5 w-20 bg-[#E8EFEA] rounded" />
              </div>
              <div className="h-4 w-3/4 bg-[#F5F6F4] rounded" />
              <div className="h-9 w-full bg-[#F5F6F4] rounded" />
            </div>
          ))}
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="bg-white border border-[#E1E5E0] rounded-xl p-10 text-center space-y-4">
          <div className="w-11 h-11 rounded-xl bg-[#E8EFEA] text-[#2C4435] flex items-center justify-center mx-auto">
            <ShoppingBag className="w-5 h-5" />
          </div>
          <div className="space-y-1 max-w-md mx-auto">
            <h3 className="font-display text-base font-semibold text-[#162019]">
              {orders.length === 0 ? t.noOrdersYet : t.noMatchingOrders}
            </h3>
            <p className="text-sm text-[#6B786F]">
              {orders.length === 0 ? t.noOrdersDesc : t.noMatchingOrdersDesc}
            </p>
          </div>
          {orders.length === 0 && (
            <button
              type="button"
              onClick={onOpenCustomerPreview}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#2C4435] hover:bg-[#223629] text-white text-xs font-medium transition-colors cursor-pointer"
            >
              <span>{t.openCustomerToTest}</span>
              <ArrowRight className="w-3.5 h-3.5 rtl:rotate-180" />
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredOrders.map((order) => {
            const currentIndex = ORDER_STATUSES.indexOf(order.status);
            const nextStatus =
              currentIndex >= 0 && currentIndex < ORDER_STATUSES.length - 1
                ? ORDER_STATUSES[currentIndex + 1]
                : null;
            const isUpdating = updatingId === order.id;

            return (
              <article
                key={order.id}
                className="bg-white border border-[#E1E5E0] rounded-xl p-4 sm:p-5 transition-colors hover:border-[#BFCAC2]"
              >
                <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                  {/* Left/Start: Order Identity & Line Items */}
                  <div className="space-y-2.5 flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span
                        dir="ltr"
                        className="font-mono text-sm font-semibold text-[#162019] tabular-nums"
                      >
                        #{order.orderNumber}
                      </span>
                      <span className="text-[#C7CEC9]" aria-hidden="true">·</span>
                      <span className="text-sm font-medium text-[#162019] truncate">
                        {order.customerName}
                      </span>
                      <span className="text-[#C7CEC9]" aria-hidden="true">·</span>
                      <span className="text-xs text-[#4A584F]">
                        {order.customerContact}
                      </span>
                      <span className="text-[#C7CEC9]" aria-hidden="true">·</span>
                      <span className="inline-flex items-center gap-1 text-xs text-[#6B786F] tabular-nums">
                        <Clock className="w-3.5 h-3.5" />
                        {formatOrderTimestamp(order)}
                      </span>
                    </div>

                    {/* Items Breakdown */}
                    <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-sm text-[#39463D]">
                      {order.items.map((item, idx) => {
                        const modifiers: string[] = [];
                        if (item.selectedCustomizations && item.selectedCustomizations.length > 0) {
                          for (const custom of item.selectedCustomizations) {
                            const label =
                              lang === 'ar'
                                ? custom.optionNameAr || custom.optionName
                                : custom.optionName || custom.optionNameAr || '';
                            if (label) {
                              modifiers.push(
                                custom.additionalPrice > 0
                                  ? `${label} +${formatPrice(custom.additionalPrice)}`
                                  : label
                              );
                            }
                          }
                        } else {
                          if (item.temperature) {
                            modifiers.push(item.temperature === 'Hot' ? t.tempHot : t.tempCold);
                          }
                          if (item.milkOption === 'regular') {
                            modifiers.push(t.milkRegular);
                          } else if (item.milkOption === 'coconut') {
                            modifiers.push(
                              item.milkExtraPrice && item.milkExtraPrice > 0
                                ? `${t.milkCoconut} +${formatPrice(item.milkExtraPrice)}`
                                : t.milkCoconut
                            );
                          } else if (item.milkOption === 'none') {
                            modifiers.push(t.milkNone);
                          }
                        }
                        return (
                          <span key={`${order.id}-item-${idx}`} className="tabular-nums">
                            <span className="font-mono font-semibold text-[#2C4435]">
                              {item.quantity}×
                            </span>{' '}
                            {localizedItemName({ id: item.itemId, name: item.name })}
                            {modifiers.length > 0 && (
                              <span className="text-xs text-[#2C4435] ms-1">
                                · {modifiers.join(' · ')}
                              </span>
                            )}
                            {item.specialInstructions && (
                              <span className="text-xs text-[#4A6B56] ms-1">
                                · {item.specialInstructions}
                              </span>
                            )}
                            <span className="text-xs text-[#6B786F] ms-1">
                              ({formatPrice(item.price * item.quantity)})
                            </span>
                          </span>
                        );
                      })}
                    </div>

                    {order.notes && (
                      <p className="text-xs text-[#6B786F]">
                        {t.notePrefix} {order.notes}
                      </p>
                    )}
                  </div>

                  {/* Right/End: Total Bill & Quick Status Progression */}
                  <div className="flex flex-col sm:flex-row lg:flex-col items-start sm:items-center lg:items-end justify-between gap-3 shrink-0">
                    <div className="flex items-baseline gap-2">
                      <span className="text-xs text-[#6B786F]">{t.totalWord}</span>
                      <span className="font-mono text-lg font-semibold text-[#162019] tabular-nums">
                        {formatPrice(order.totalBill)}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5">
                      {ORDER_STATUSES.map((statusOption) => {
                        const isCurrent = order.status === statusOption;
                        return (
                          <button
                            key={statusOption}
                            type="button"
                            disabled={isUpdating || isCurrent}
                            onClick={() => handleStatusChange(order.id, statusOption)}
                            className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-xs font-medium whitespace-nowrap shrink-0 transition-colors cursor-pointer disabled:cursor-default ${
                              isCurrent
                                ? STATUS_BUTTON_STYLES[statusOption]
                                : 'bg-[#F5F6F4] border-[#E1E5E0] text-[#4A584F] hover:bg-[#E8EFEA] hover:border-[#B6C7BC] hover:text-[#223629]'
                            }`}
                          >
                            {isCurrent && <Check className="w-3 h-3 shrink-0" />}
                            <span>{statusLabel(statusOption)}</span>
                          </button>
                        );
                      })}

                      {nextStatus && (
                        <button
                          type="button"
                          disabled={isUpdating}
                          onClick={() => handleStatusChange(order.id, nextStatus)}
                          className="ms-1 inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#2C4435] hover:bg-[#223629] disabled:opacity-50 text-white text-xs font-medium whitespace-nowrap shrink-0 transition-colors cursor-pointer"
                        >
                          <span>
                            {t.moveTo} {statusLabel(nextStatus)}
                          </span>
                          <ArrowRight className="w-3 h-3 rtl:rotate-180" />
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => setConfirmDeleteOrder(order)}
                        aria-label={t.deleteOrderAction}
                        title={t.deleteOrderAction}
                        className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg border border-transparent text-xs font-medium text-[#6B786F] hover:bg-[#FEF2F2] hover:text-[#991B1B] transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {confirmDeleteOrder && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={t.deleteOrderAction}
          className="fixed inset-0 z-50 bg-[#162019]/40 backdrop-blur-[2px] flex items-center justify-center p-4"
        >
          <div className="bg-white border border-[#E1E5E0] rounded-2xl w-full max-w-sm p-6 space-y-4">
            <h3 className="font-display text-base font-semibold text-[#162019]">
              {lang === 'ar'
                ? `حذف الطلب #${confirmDeleteOrder.orderNumber}؟`
                : `Delete order #${confirmDeleteOrder.orderNumber}?`}
            </h3>
            <p className="text-sm text-[#4A584F]">{t.deleteOrderConfirmBody}</p>
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                disabled={deleting}
                onClick={() => setConfirmDeleteOrder(null)}
                className="px-4 py-2 rounded-xl border border-[#E1E5E0] text-xs font-medium text-[#4A584F] hover:bg-[#F5F6F4] cursor-pointer"
              >
                {t.cancel}
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={handleDeleteOrderConfirmed}
                className="px-4 py-2 rounded-xl bg-[#DC2626] hover:bg-[#B91C1C] disabled:opacity-60 text-white text-xs font-medium cursor-pointer"
              >
                {deleting ? t.deleting : t.deleteOrderAction}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
