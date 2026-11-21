import { useLanguage } from '../contexts/LanguageContext';
import { MenuItem, Order, formatPrice } from '../types';

interface SummaryBarProps {
  orders: Order[];
  menuItems: MenuItem[];
  loading: boolean;
}

function isSameLocalDay(date: Date, reference: Date): boolean {
  return (
    date.getFullYear() === reference.getFullYear() &&
    date.getMonth() === reference.getMonth() &&
    date.getDate() === reference.getDate()
  );
}

export function SummaryBar({ orders, menuItems, loading }: SummaryBarProps) {
  const { t } = useLanguage();
  const now = new Date();
  const todaysOrders = orders.filter((order) => {
    if (!order.createdAt) return true;
    return isSameLocalDay(order.createdAt.toDate(), now);
  });

  const todaysRevenue = todaysOrders.reduce((sum, order) => sum + (order.totalBill || 0), 0);
  const pendingOrPreparing = todaysOrders.filter(
    (order) => order.status === 'Pending' || order.status === 'Preparing'
  ).length;
  const readyCount = todaysOrders.filter((order) => order.status === 'Ready').length;

  const activeMenuCount = menuItems.filter((item) => item.inStock).length;
  const totalMenuCount = menuItems.length;
  const avgOrder = todaysOrders.length > 0 ? todaysRevenue / todaysOrders.length : 0;

  return (
    <section
      aria-label={t.summaryTitle}
      className="bg-white border border-[#E1E5E0] rounded-xl overflow-hidden"
    >
      <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x sm:rtl:divide-x-reverse divide-[#E1E5E0]">
        {/* Metric 1: Today's Total Orders */}
        <div className="px-5 py-4 flex flex-col justify-between gap-1.5">
          <span className="text-xs font-medium text-[#6B786F]">{t.todaysTotalOrders}</span>
          <div className="flex items-baseline justify-between gap-3">
            {loading ? (
              <div className="h-8 w-16 bg-[#E8EFEA] rounded animate-pulse" />
            ) : (
              <span className="font-display text-2xl font-semibold text-[#162019] tabular-nums">
                {todaysOrders.length}
              </span>
            )}
            <span className="text-xs text-[#6B786F] tabular-nums">
              {pendingOrPreparing} {t.activeLabel} · {readyCount} {t.readyLabel}
            </span>
          </div>
        </div>

        {/* Metric 2: Total Revenue */}
        <div className="px-5 py-4 flex flex-col justify-between gap-1.5 bg-[#F9FAF8]">
          <span className="text-xs font-medium text-[#6B786F]">{t.todaysRevenue}</span>
          <div className="flex items-baseline justify-between gap-3">
            {loading ? (
              <div className="h-8 w-24 bg-[#E8EFEA] rounded animate-pulse" />
            ) : (
              <span className="font-mono text-2xl font-semibold text-[#2C4435] tabular-nums">
                {formatPrice(todaysRevenue)}
              </span>
            )}
            <span className="text-xs text-[#6B786F] tabular-nums">
              {t.avgPerOrder} {formatPrice(avgOrder)} {t.perOrder}
            </span>
          </div>
        </div>

        {/* Metric 3: Active Menu Items */}
        <div className="px-5 py-4 flex flex-col justify-between gap-1.5">
          <span className="text-xs font-medium text-[#6B786F]">{t.activeMenuItems}</span>
          <div className="flex items-baseline justify-between gap-3">
            {loading ? (
              <div className="h-8 w-16 bg-[#E8EFEA] rounded animate-pulse" />
            ) : (
              <span className="font-display text-2xl font-semibold text-[#162019] tabular-nums">
                {activeMenuCount}
              </span>
            )}
            <span className="text-xs text-[#6B786F] tabular-nums">
              {totalMenuCount - activeMenuCount} {t.outOfStockLabel} · {totalMenuCount} {t.totalLabel}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
