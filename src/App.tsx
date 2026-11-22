import { useEffect, useMemo, useRef, useState } from 'react';
import { collection, doc, onSnapshot, orderBy, query, serverTimestamp, setDoc } from 'firebase/firestore';
import {
  ClipboardList,
  Coffee,
  ExternalLink,
  LogOut,
  Megaphone,
  Menu,
  Plus,
  ShieldCheck,
  Store,
  X,
} from 'lucide-react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { LanguageProvider, useLanguage } from './contexts/LanguageContext';
import { DEFAULT_CATEGORIES, syncDefaultCategories, syncPalmMetricMenu } from './lib/defaultMenu';
import { OperationType, db, handleFirestoreError } from './lib/firebase';
import { sanitizeFirestoreCustomization } from './lib/productCustomizations';
import {
  AdminTab,
  BillboardAd,
  CUSTOMER_APP_URL,
  CategoryItem,
  CoffeeOptionsSettings,
  DEFAULT_COFFEE_OPTIONS,
  MenuItem,
  Order,
  ProductCustomization,
} from './types';
import { AdminAccessModal } from './components/AdminAccessModal';
import { BillboardManagerView } from './components/BillboardManagerView';
import { CustomerStorefrontPreview } from './components/CustomerStorefrontPreview';
import { ErrorBoundary } from './components/ErrorBoundary';
import { LanguageSwitcher } from './components/LanguageSwitcher';
import { LiveOrdersView } from './components/LiveOrdersView';
import { LoginScreen } from './components/LoginScreen';
import { MenuManagerView } from './components/MenuManagerView';
import { SummaryBar } from './components/SummaryBar';

function AdminDashboard() {
  const { user, resolvedEmail, loading: authLoading, isAdmin, isBootstrappedAdmin, logout } = useAuth();
  const { t, lang, setDynamicCategories } = useLanguage();
  const [activeTab, setActiveTab] = useState<AdminTab>('orders');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const tabLabels: Record<AdminTab, string> = {
    orders: t.tabOrders,
    menu: t.tabMenu,
    billboard: t.tabBillboard,
    customer: t.tabCustomer,
  };

  const [orders, setOrders] = useState<Order[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [billboards, setBillboards] = useState<BillboardAd[]>([]);
  const [categories, setCategories] = useState<CategoryItem[]>(() =>
    DEFAULT_CATEGORIES.map((c) => ({ ...c, isActive: true }))
  );
  const [coffeeOptions, setCoffeeOptions] = useState<CoffeeOptionsSettings>(
    DEFAULT_COFFEE_OPTIONS
  );
  const [productCustomizations, setProductCustomizations] = useState<
    Record<string, ProductCustomization>
  >({});
  const [categoriesRulesBlocked, setCategoriesRulesBlocked] = useState(false);
  const [coffeeOptionsRulesBlocked, setCoffeeOptionsRulesBlocked] = useState(false);
  const [customizationsRulesBlocked, setCustomizationsRulesBlocked] = useState(false);
  const rulesUpdateRequired =
    categoriesRulesBlocked || coffeeOptionsRulesBlocked || customizationsRulesBlocked;

  const [ordersLoading, setOrdersLoading] = useState(true);
  const [menuLoading, setMenuLoading] = useState(true);
  const [billboardsLoading, setBillboardsLoading] = useState(true);

  const [menuCreateModalOpen, setMenuCreateModalOpen] = useState(false);
  const [billboardCreateModalOpen, setBillboardCreateModalOpen] = useState(false);
  const [adminModalOpen, setAdminModalOpen] = useState(false);
  const menuSeedAttemptedRef = useRef(false);
  const categorySeedAttemptedRef = useRef(false);
  const settingsSeedAttemptedRef = useRef(false);

  useEffect(() => {
    if (authLoading || !user || !isAdmin) {
      return;
    }

    setOrdersLoading(true);
    setMenuLoading(true);
    setBillboardsLoading(true);

    const ordersQuery = query(collection(db, 'orders'), orderBy('createdAt', 'desc'));
    const unsubOrders = onSnapshot(
      ordersQuery,
      (snapshot) => {
        const list: Order[] = snapshot.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<Order, 'id'>),
        }));
        setOrders(list);
        setOrdersLoading(false);
      },
      (error) => {
        setOrdersLoading(false);
        handleFirestoreError(error, OperationType.LIST, 'orders');
      }
    );

    const menuQuery = query(collection(db, 'menu'), orderBy('createdAt', 'desc'));
    const unsubMenu = onSnapshot(
      menuQuery,
      (snapshot) => {
        const list: MenuItem[] = snapshot.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<MenuItem, 'id'>),
        }));
        setMenuItems(list);
        setMenuLoading(false);

        const syncKey = 'palm_metric_menu_synced_palm_metric_app_v1';
        if (snapshot.empty && !menuSeedAttemptedRef.current && localStorage.getItem(syncKey) !== 'true') {
          menuSeedAttemptedRef.current = true;
          const existingIds = new Set(snapshot.docs.map((d) => d.id));
          void syncPalmMetricMenu(existingIds).then(() => {
            localStorage.setItem(syncKey, 'true');
          });
        } else if (!snapshot.empty) {
          localStorage.setItem(syncKey, 'true');
        }
      },
      (error) => {
        setMenuLoading(false);
        handleFirestoreError(error, OperationType.LIST, 'menu');
      }
    );

    const billboardsQuery = query(collection(db, 'billboards'), orderBy('createdAt', 'desc'));
    const unsubBillboards = onSnapshot(
      billboardsQuery,
      (snapshot) => {
        const list: BillboardAd[] = snapshot.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<BillboardAd, 'id'>),
        }));
        setBillboards(list);
        setBillboardsLoading(false);
      },
      (error) => {
        setBillboardsLoading(false);
        handleFirestoreError(error, OperationType.LIST, 'billboards');
      }
    );

    const categoriesQuery = query(collection(db, 'categories'), orderBy('sortOrder', 'asc'));
    const unsubCategories = onSnapshot(
      categoriesQuery,
      (snapshot) => {
        const list: CategoryItem[] = snapshot.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<CategoryItem, 'id'>),
        }));
        const catSyncKey = 'palm_metric_categories_synced_v1';
        if (list.length > 0 || localStorage.getItem(catSyncKey) === 'true') {
          setCategories(list);
          setDynamicCategories(list);
        }
        setCategoriesRulesBlocked(false);

        if (
          snapshot.empty &&
          !categorySeedAttemptedRef.current &&
          localStorage.getItem(catSyncKey) !== 'true'
        ) {
          categorySeedAttemptedRef.current = true;
          const existingKeys = new Set(list.map((c) => c.key));
          const existingIds = new Set(list.map((c) => c.id));
          void syncDefaultCategories(existingKeys, existingIds)
            .then(() => {
              localStorage.setItem(catSyncKey, 'true');
            })
            .catch(() => {
              setCategoriesRulesBlocked(true);
            });
        } else if (!snapshot.empty) {
          localStorage.setItem(catSyncKey, 'true');
        }
      },
      (error) => {
        if ((error as { code?: string })?.code === 'permission-denied') {
          setCategoriesRulesBlocked(true);
          return;
        }
        handleFirestoreError(error, OperationType.LIST, 'categories');
      }
    );

    const coffeeOptionsRef = doc(db, 'settings', 'coffeeOptions');
    const unsubCoffeeOptions = onSnapshot(
      coffeeOptionsRef,
      (snapshot) => {
        setCoffeeOptionsRulesBlocked(false);
        if (snapshot.exists()) {
          const data = snapshot.data() as Partial<CoffeeOptionsSettings>;
          setCoffeeOptions({
            milkSelectionEnabled:
              typeof data.milkSelectionEnabled === 'boolean'
                ? data.milkSelectionEnabled
                : DEFAULT_COFFEE_OPTIONS.milkSelectionEnabled,
            coconutMilkExtraPrice:
              typeof data.coconutMilkExtraPrice === 'number'
                ? data.coconutMilkExtraPrice
                : DEFAULT_COFFEE_OPTIONS.coconutMilkExtraPrice,
            hotColdSelectionEnabled:
              typeof data.hotColdSelectionEnabled === 'boolean'
                ? data.hotColdSelectionEnabled
                : DEFAULT_COFFEE_OPTIONS.hotColdSelectionEnabled,
            updatedAt: data.updatedAt ?? null,
          });
        } else if (!settingsSeedAttemptedRef.current) {
          settingsSeedAttemptedRef.current = true;
          void setDoc(coffeeOptionsRef, {
            ...DEFAULT_COFFEE_OPTIONS,
            updatedAt: serverTimestamp(),
          }).catch(() => {
            setCoffeeOptionsRulesBlocked(true);
          });
        }
      },
      (error) => {
        if ((error as { code?: string })?.code === 'permission-denied') {
          setCoffeeOptionsRulesBlocked(true);
          return;
        }
        handleFirestoreError(error, OperationType.GET, 'settings/coffeeOptions');
      }
    );

    const unsubCustomizations = onSnapshot(
      collection(db, 'productCustomizations'),
      (snapshot) => {
        setCustomizationsRulesBlocked(false);
        const map: Record<string, ProductCustomization> = {};
        for (const d of snapshot.docs) {
          map[d.id] = sanitizeFirestoreCustomization(
            d.id,
            d.data() as Record<string, unknown>
          );
        }
        setProductCustomizations(map);
      },
      (error) => {
        if ((error as { code?: string })?.code === 'permission-denied') {
          setCustomizationsRulesBlocked(true);
          return;
        }
        handleFirestoreError(error, OperationType.LIST, 'productCustomizations');
      }
    );

    return () => {
      unsubOrders();
      unsubMenu();
      unsubBillboards();
      unsubCategories();
      unsubCoffeeOptions();
      unsubCustomizations();
    };
  }, [authLoading, user, isAdmin, setDynamicCategories]);

  const activeOrderCount = useMemo(
    () =>
      orders.filter(
        (order) => order.status === 'Pending' || order.status === 'Preparing'
      ).length,
    [orders]
  );

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#F5F6F4] flex items-center justify-center">
        <div className="text-center space-y-3">
          <img
            src={`${import.meta.env.BASE_URL}assets/aistudio/IMG-20261021-WA0006_53f18f59.jpg`}
            alt="Palm Metric logo"
            className="w-10 h-10 rounded-xl object-cover border border-[#E1E5E0] mx-auto"
          />
          <div className="space-y-1">
            <p className="font-display text-lg font-bold tracking-tight text-[#162019]">
              {t.brandName}
            </p>
            <p className="text-xs text-[#6B786F]">{t.verifyingSession}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!user || !isAdmin) {
    return <LoginScreen />;
  }

  const selectTab = (tab: AdminTab) => {
    setActiveTab(tab);
    setMobileMenuOpen(false);
  };

  const renderPrimaryAction = () => {
    if (activeTab === 'menu') {
      return (
        <button
          type="button"
          onClick={() => setMenuCreateModalOpen(true)}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#2C4435] hover:bg-[#223629] text-white text-xs font-medium whitespace-nowrap shrink-0 transition-colors cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>{t.addMenuItem}</span>
        </button>
      );
    }
    if (activeTab === 'billboard') {
      return (
        <button
          type="button"
          onClick={() => setBillboardCreateModalOpen(true)}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#2C4435] hover:bg-[#223629] text-white text-xs font-medium whitespace-nowrap shrink-0 transition-colors cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>{t.uploadOffer}</span>
        </button>
      );
    }
    if (activeTab === 'orders') {
      return (
        <button
          type="button"
          onClick={() => selectTab('customer')}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-[#CBD4CD] bg-white hover:bg-[#E8EFEA] text-[#162019] text-xs font-medium whitespace-nowrap shrink-0 transition-colors cursor-pointer"
        >
          <ExternalLink className="w-3.5 h-3.5 text-[#2C4435]" />
          <span>{t.openCustomerView}</span>
        </button>
      );
    }
    return (
      <button
        type="button"
        onClick={() => selectTab('orders')}
        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#2C4435] hover:bg-[#223629] text-white text-xs font-medium whitespace-nowrap shrink-0 transition-colors cursor-pointer"
      >
        <span>{t.backToLiveOrders}</span>
      </button>
    );
  };

  const navItems: { id: AdminTab; label: string; icon: typeof ClipboardList; count?: number }[] = [
    { id: 'orders', label: t.tabOrders, icon: ClipboardList, count: activeOrderCount },
    { id: 'menu', label: t.tabMenu, icon: Coffee },
    { id: 'billboard', label: t.tabBillboard, icon: Megaphone },
  ];

  return (
    <div className="min-h-screen bg-[#F5F6F4] text-[#162019] flex flex-col md:flex-row">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex md:w-60 lg:w-64 shrink-0 bg-white border-e border-[#E1E5E0] flex-col justify-between min-h-screen sticky top-0 h-screen">
        <div className="p-5 space-y-6">
          <div className="px-1 pt-1 flex items-center gap-2.5">
            <img
              src={`${import.meta.env.BASE_URL}assets/aistudio/IMG-20261021-WA0006_53f18f59.jpg`}
              alt="Palm Metric logo"
              className="w-7 h-7 rounded-lg object-cover border border-[#E1E5E0] shrink-0"
            />
            <span className="font-display text-lg font-bold tracking-tight text-[#162019] whitespace-nowrap">
              {t.brandName}
            </span>
          </div>

          <nav aria-label="Admin sections" className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isCurrent = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => selectTab(item.id)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition-colors cursor-pointer ${
                    isCurrent
                      ? 'bg-[#E8EFEA] text-[#223629]'
                      : 'text-[#4A584F] hover:bg-[#F5F6F4] hover:text-[#162019]'
                  }`}
                >
                  <span className="flex items-center gap-2.5 whitespace-nowrap">
                    <Icon className="w-4 h-4 shrink-0" />
                    <span>{item.label}</span>
                  </span>
                  {typeof item.count === 'number' && item.count > 0 && (
                    <span className="font-mono text-xs tabular-nums text-[#2C4435]">
                      {item.count}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          <div className="pt-4 border-t border-[#E1E5E0] space-y-1">
            <button
              type="button"
              onClick={() => selectTab('customer')}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors cursor-pointer ${
                activeTab === 'customer'
                  ? 'bg-[#E8EFEA] text-[#223629]'
                  : 'text-[#4A584F] hover:bg-[#F5F6F4] hover:text-[#162019]'
              }`}
            >
              <Store className="w-4 h-4 shrink-0" />
              <span className="whitespace-nowrap">{t.tabCustomer}</span>
            </button>
            <a
              href={CUSTOMER_APP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl text-sm font-medium text-[#2C4435] hover:bg-[#E8EFEA]/60 transition-colors"
            >
              <span className="flex items-center gap-2.5 whitespace-nowrap">
                <ExternalLink className="w-4 h-4 shrink-0" />
                <span>{t.liveCustomerAppLabel}</span>
              </span>
            </a>
          </div>
        </div>

        <div className="p-5 border-t border-[#E1E5E0] space-y-3">
          <div className="px-1">
            <p className="text-xs font-medium text-[#162019] truncate">
              {user.displayName || t.storeAdmin}
            </p>
            <p dir="ltr" className="text-xs text-[#6B786F] truncate text-start">
              {resolvedEmail || user.email}
            </p>
          </div>
          <LanguageSwitcher />
          {isBootstrappedAdmin && (
            <button
              type="button"
              onClick={() => setAdminModalOpen(true)}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-xl border border-[#E1E5E0] text-xs font-medium text-[#2C4435] hover:bg-[#E8EFEA]/60 transition-colors cursor-pointer"
            >
              <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
              <span>{t.manageAdmins}</span>
            </button>
          )}
          <button
            type="button"
            onClick={logout}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl border border-[#E1E5E0] text-xs font-medium text-[#4A584F] hover:bg-[#F5F6F4] hover:text-[#162019] transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5 rtl:rotate-180" />
            <span>{t.signOut}</span>
          </button>
        </div>
      </aside>

      {/* Mobile Slide-Over Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden bg-[#162019]/40 backdrop-blur-[2px] flex">
          <div className="w-72 bg-white h-full border-e border-[#E1E5E0] flex flex-col justify-between p-5">
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <img
                    src={`${import.meta.env.BASE_URL}assets/aistudio/IMG-20261021-WA0006_53f18f59.jpg`}
                    alt="Palm Metric logo"
                    className="w-7 h-7 rounded-lg object-cover border border-[#E1E5E0] shrink-0"
                  />
                  <span className="font-display text-lg font-bold tracking-tight text-[#162019] whitespace-nowrap">
                    {t.brandName}
                  </span>
                </div>
                <button
                  type="button"
                  aria-label={lang === 'ar' ? 'إغلاق القائمة' : 'Close navigation'}
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-1.5 rounded-lg text-[#6B786F] hover:bg-[#F5F6F4] cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <nav className="space-y-1">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const isCurrent = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => selectTab(item.id)}
                      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium cursor-pointer ${
                        isCurrent
                          ? 'bg-[#E8EFEA] text-[#223629]'
                          : 'text-[#4A584F] hover:bg-[#F5F6F4]'
                      }`}
                    >
                      <span className="flex items-center gap-2.5">
                        <Icon className="w-4 h-4" />
                        <span>{item.label}</span>
                      </span>
                      {typeof item.count === 'number' && item.count > 0 && (
                        <span className="font-mono text-xs tabular-nums">{item.count}</span>
                      )}
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={() => selectTab('customer')}
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium cursor-pointer ${
                    activeTab === 'customer'
                      ? 'bg-[#E8EFEA] text-[#223629]'
                      : 'text-[#4A584F] hover:bg-[#F5F6F4]'
                  }`}
                >
                  <Store className="w-4 h-4" />
                  <span>{t.tabCustomer}</span>
                </button>
                <a
                  href={CUSTOMER_APP_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium text-[#2C4435] hover:bg-[#E8EFEA]/60"
                >
                  <ExternalLink className="w-4 h-4 shrink-0" />
                  <span>{t.liveCustomerAppLabel}</span>
                </a>
              </nav>
            </div>

            <div className="pt-4 border-t border-[#E1E5E0] space-y-3">
              <p dir="ltr" className="text-xs text-[#6B786F] truncate text-start">
                {resolvedEmail || user.email}
              </p>
              <LanguageSwitcher />
              {isBootstrappedAdmin && (
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    setAdminModalOpen(true);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-xl border border-[#E1E5E0] text-xs font-medium text-[#2C4435] cursor-pointer"
                >
                  <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                  <span>{t.manageAdmins}</span>
                </button>
              )}
              <button
                type="button"
                onClick={logout}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-xl border border-[#E1E5E0] text-xs font-medium text-[#4A584F] cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5 rtl:rotate-180" />
                <span>{t.signOut}</span>
              </button>
            </div>
          </div>
          <div className="flex-1" onClick={() => setMobileMenuOpen(false)} />
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Workspace Header */}
        <header className="bg-white border-b border-[#E1E5E0] px-4 sm:px-6 h-14 flex items-center justify-between gap-4 sticky top-0 z-30">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              aria-label={lang === 'ar' ? 'فتح قائمة التنقل' : 'Open navigation menu'}
              onClick={() => setMobileMenuOpen(true)}
              className="md:hidden p-2 -ms-1 rounded-lg text-[#4A584F] hover:bg-[#F5F6F4] cursor-pointer"
            >
              <Menu className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-2 text-sm truncate">
              <span className="text-[#6B786F] hidden sm:inline">{t.adminBreadcrumb}</span>
              <span className="text-[#C7CEC9] hidden sm:inline" aria-hidden="true">/</span>
              <h1 className="font-display font-semibold text-[#162019] truncate">
                {tabLabels[activeTab]}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <div className="md:hidden">
              <LanguageSwitcher compact />
            </div>
            <a
              href={CUSTOMER_APP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[#E1E5E0] bg-white hover:bg-[#E8EFEA] text-[#2C4435] text-xs font-medium whitespace-nowrap shrink-0 transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>{t.openLiveCustomerApp}</span>
            </a>
            {renderPrimaryAction()}
          </div>
        </header>

        {/* Mobile Quick Tab Strip */}
        <div className="md:hidden bg-white border-b border-[#E1E5E0] px-3 py-2 flex items-center gap-1 overflow-x-auto">
          {(['orders', 'menu', 'billboard', 'customer'] as AdminTab[]).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => selectTab(tab)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap shrink-0 cursor-pointer ${
                activeTab === tab
                  ? 'bg-[#E8EFEA] text-[#223629]'
                  : 'text-[#4A584F]'
              }`}
            >
              {tabLabels[tab]}
            </button>
          ))}
        </div>

        <main className="flex-1 w-full max-w-6xl mx-auto p-4 sm:p-6 space-y-6">
          {activeTab !== 'customer' && (
            <SummaryBar
              orders={orders}
              menuItems={menuItems}
              loading={ordersLoading || menuLoading}
            />
          )}

          {activeTab === 'orders' && (
            <LiveOrdersView
              orders={orders}
              loading={ordersLoading}
              onOpenCustomerPreview={() => selectTab('customer')}
            />
          )}

          {activeTab === 'menu' && (
            <MenuManagerView
              menuItems={menuItems}
              categories={categories}
              coffeeOptions={coffeeOptions}
              productCustomizations={productCustomizations}
              rulesUpdateRequired={rulesUpdateRequired}
              loading={menuLoading}
              createModalOpen={menuCreateModalOpen}
              onCloseCreateModal={() => setMenuCreateModalOpen(false)}
              onOpenCreateModal={() => setMenuCreateModalOpen(true)}
            />
          )}

          {activeTab === 'billboard' && (
            <BillboardManagerView
              billboards={billboards}
              loading={billboardsLoading}
              createModalOpen={billboardCreateModalOpen}
              onCloseCreateModal={() => setBillboardCreateModalOpen(false)}
              onOpenCreateModal={() => setBillboardCreateModalOpen(true)}
            />
          )}

          {activeTab === 'customer' && (
            <CustomerStorefrontPreview
              billboards={billboards}
              menuItems={menuItems}
              categories={categories}
              coffeeOptions={coffeeOptions}
              productCustomizations={productCustomizations}
              orders={orders}
              onOrderPlaced={() => selectTab('orders')}
            />
          )}
        </main>
      </div>

      {isBootstrappedAdmin && (
        <AdminAccessModal
          open={adminModalOpen}
          onClose={() => setAdminModalOpen(false)}
        />
      )}
    </div>
  );
}

export default function App() {
  return (
    <LanguageProvider>
      <ErrorBoundary>
        <AuthProvider>
          <AdminDashboard />
        </AuthProvider>
      </ErrorBoundary>
    </LanguageProvider>
  );
}
