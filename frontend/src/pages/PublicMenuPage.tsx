import { useEffect, useMemo, useState } from 'react';
import { Clock, Mail, MapPin, Phone, Plus, Share2, Store } from 'lucide-react';
import { useParams } from 'react-router-dom';
import { CartDrawer } from '../components/cart/CartDrawer';
import { CartFloatingButton } from '../components/cart/CartFloatingButton';
import { CartProvider, useCart } from '../contexts/CartContext';
import { getPublicMenu, type PublicMenu } from '../services/publicMenu';

function formatPrice(price: string) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(Number(price));
}

function formatNumberPrice(price: number) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(price);
}

function isDarkColor(color: string) {
  const normalized = color.replace('#', '');
  if (normalized.length !== 6) return true;
  const red = Number.parseInt(normalized.slice(0, 2), 16);
  const green = Number.parseInt(normalized.slice(2, 4), 16);
  const blue = Number.parseInt(normalized.slice(4, 6), 16);
  return (red * 299 + green * 587 + blue * 114) / 1000 < 150;
}

export function PublicMenuPage() {
  const { businessId } = useParams();
  const [menu, setMenu] = useState<PublicMenu | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [shared, setShared] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function loadMenu() {
      if (!businessId) {
        setError('Menu no encontrado.');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const response = await getPublicMenu(businessId);
        if (isMounted) {
          setMenu(response);
        }
      } catch {
        if (isMounted) {
          setError('No pudimos cargar este menu.');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    void loadMenu();

    return () => {
      isMounted = false;
    };
  }, [businessId]);

  const categories = useMemo(
    () => menu?.categorias.filter((category) => category.productos.length > 0).sort((first, second) => first.order - second.order || first.name.localeCompare(second.name)) ?? [],
    [menu],
  );
  const primaryColor = menu?.primary_color || '#0f172a';
  const darkHeader = isDarkColor(primaryColor);
  const headerText = darkHeader ? 'text-white' : 'text-slate-950';
  const mutedHeaderText = darkHeader ? 'text-white/75' : 'text-slate-700';

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setShared(true);
      window.setTimeout(() => setShared(false), 2200);
    } catch {
      setShared(false);
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-100 px-4 py-5">
        <div className="mx-auto max-w-md space-y-4">
          <div className="h-44 animate-pulse rounded-3xl bg-slate-200" />
          {Array.from({ length: 4 }).map((_, index) => <div key={index} className="h-28 animate-pulse rounded-3xl bg-white" />)}
        </div>
      </main>
    );
  }

  if (error || !menu) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
        <div className="max-w-sm rounded-3xl bg-white p-6 text-center shadow-sm">
          <Store className="mx-auto text-slate-400" size={34} />
          <h1 className="mt-4 text-xl font-semibold text-slate-900">Menu no disponible</h1>
          <p className="mt-2 text-sm text-slate-500">{error || 'No encontramos este negocio.'}</p>
        </div>
      </main>
    );
  }

  return (
    <CartProvider businessId={menu.id}>
      <PublicMenuContent menu={menu} categories={categories} primaryColor={primaryColor} darkHeader={darkHeader} headerText={headerText} mutedHeaderText={mutedHeaderText} shared={shared} onShare={handleShare} />
    </CartProvider>
  );
}

function PublicMenuContent({
  menu,
  categories,
  primaryColor,
  darkHeader,
  headerText,
  mutedHeaderText,
  shared,
  onShare,
}: {
  menu: PublicMenu;
  categories: PublicMenu['categorias'];
  primaryColor: string;
  darkHeader: boolean;
  headerText: string;
  mutedHeaderText: string;
  shared: boolean;
  onShare: () => Promise<void>;
}) {
  const { addItem } = useCart();
  const [cartOpen, setCartOpen] = useState(false);
  const [toast, setToast] = useState('');
  const [addedProductId, setAddedProductId] = useState<number | null>(null);

  const handleAddProduct = (product: PublicMenu['categorias'][number]['productos'][number]) => {
    if (!product.available) return;

    addItem({
      id: product.id,
      name: product.name,
      price: product.price,
      image: product.image,
    });
    setAddedProductId(product.id);
    setToast(`${product.name} agregado.`);
    window.setTimeout(() => setAddedProductId(null), 350);
    window.setTimeout(() => setToast(''), 2200);
  };

  return (
    <main className="min-h-screen bg-slate-100 pb-28">
      <section className={`relative overflow-hidden px-4 pb-7 pt-5 ${headerText}`} style={{ backgroundColor: primaryColor }}>
        {menu.cover_image ? <img src={menu.cover_image} alt="" className="absolute inset-0 h-full w-full object-cover opacity-35" /> : null}
        <div className={`absolute inset-0 ${darkHeader ? 'bg-slate-950/45' : 'bg-white/45'}`} />
        <div className="relative mx-auto max-w-3xl">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-3xl bg-white/10">
                {menu.logo ? <img src={menu.logo} alt={menu.name} className="h-full w-full object-cover" /> : <Store size={28} />}
              </div>
              <div>
                <p className={`text-xs font-medium uppercase tracking-[0.2em] ${mutedHeaderText}`}>Pedilo</p>
                <h1 className="mt-1 text-2xl font-semibold">{menu.name}</h1>
              </div>
            </div>
            <button type="button" onClick={() => void onShare()} className="inline-flex items-center gap-2 rounded-2xl bg-white px-3 py-2 text-xs font-medium text-slate-900 transition hover:bg-slate-100">
              <Share2 size={15} />
              {shared ? 'Copiado' : 'Compartir'}
            </button>
          </div>

          {menu.description ? <p className={`mt-5 max-w-xl text-sm leading-6 ${mutedHeaderText}`}>{menu.description}</p> : null}

          <div className={`mt-5 space-y-2 text-sm ${mutedHeaderText}`}>
            {menu.address ? <p className="flex items-center gap-2"><MapPin size={16} />{menu.address}</p> : null}
            {menu.phone ? <p className="flex items-center gap-2"><Phone size={16} />{menu.phone}</p> : null}
            {menu.email ? <p className="flex items-center gap-2"><Mail size={16} />{menu.email}</p> : null}
            {menu.opening_hours ? <p className="flex items-center gap-2"><Clock size={16} />{menu.opening_hours}</p> : null}
          </div>

          {(menu.instagram || menu.facebook) ? (
            <div className="mt-5 flex flex-wrap gap-2">
              {menu.instagram ? (
                <a href={menu.instagram} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-2xl bg-white/90 px-3 py-2 text-xs font-semibold text-slate-900 transition hover:bg-white">
                  <Share2 size={15} />
                  Instagram
                </a>
              ) : null}
              {menu.facebook ? (
                <a href={menu.facebook} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-2xl bg-white/90 px-3 py-2 text-xs font-semibold text-slate-900 transition hover:bg-white">
                  <Share2 size={15} />
                  Facebook
                </a>
              ) : null}
            </div>
          ) : null}
        </div>
      </section>

      <div className="mx-auto max-w-3xl space-y-6 px-4 pt-6">
        {categories.length === 0 ? (
          <div className="rounded-3xl bg-white p-6 text-center shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Todavia no hay productos disponibles</h2>
            <p className="mt-2 text-sm text-slate-500">Volvi a revisar el menu mas tarde.</p>
          </div>
        ) : categories.map((category) => (
          <section key={category.id} className="space-y-3">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">{category.name}</h2>
              {category.description ? <p className="mt-1 text-sm text-slate-500">{category.description}</p> : null}
            </div>
            <div className="space-y-3">
              {category.productos.map((product) => (
                <article key={product.id} className={`flex gap-3 rounded-3xl bg-white p-3 shadow-sm transition duration-300 ${addedProductId === product.id ? 'scale-[1.01] ring-2 ring-emerald-300' : ''} ${!product.available ? 'opacity-70' : ''}`}>
                  <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-slate-100 text-slate-400">
                    {product.image ? <img src={product.image} alt={product.name} className="h-full w-full object-cover" /> : <Store size={22} />}
                  </div>
                  <div className="min-w-0 flex-1 py-1">
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="text-base font-semibold text-slate-900">{product.name}</h3>
                      <p className="shrink-0 text-sm font-semibold" style={{ color: primaryColor }}>{formatPrice(product.price)}</p>
                    </div>
                    {product.description ? <p className="mt-2 line-clamp-2 text-sm leading-5 text-slate-500">{product.description}</p> : null}
                    <div className="mt-3 flex justify-end">
                      {product.available ? (
                        <button type="button" onClick={() => handleAddProduct(product)} className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-slate-800">
                          <Plus size={15} />
                          Agregar
                        </button>
                      ) : (
                        <span className="rounded-2xl bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-500">Agotado</span>
                      )}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>
        ))}
      </div>

      {toast ? <div className="fixed left-1/2 top-4 z-30 -translate-x-1/2 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-medium text-white shadow-xl">{toast}</div> : null}

      <CartFloatingButton onOpen={() => setCartOpen(true)} formatPrice={formatNumberPrice} />
      <CartDrawer open={cartOpen} businessId={menu.id} businessPhone={menu.phone} formatPrice={formatNumberPrice} onClose={() => setCartOpen(false)} />
    </main>
  );
}
