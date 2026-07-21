import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

export interface CartProduct {
  id: number;
  name: string;
  price: string;
  image: string | null;
}

export interface CartItem {
  product: CartProduct;
  quantity: number;
}

interface CartContextValue {
  items: CartItem[];
  totalItems: number;
  totalPrice: number;
  addItem: (product: CartProduct) => void;
  incrementItem: (productId: number) => void;
  decrementItem: (productId: number) => void;
  removeItem: (productId: number) => void;
  clearCart: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);

function getStorageKey(businessId: number) {
  return `pedilo_cart_${businessId}`;
}

export function CartProvider({ businessId, children }: { businessId: number; children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(() => {
    const stored = localStorage.getItem(getStorageKey(businessId));
    if (!stored) return [];

    try {
      return JSON.parse(stored) as CartItem[];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem(getStorageKey(businessId), JSON.stringify(items));
  }, [businessId, items]);

  useEffect(() => {
    const stored = localStorage.getItem(getStorageKey(businessId));
    if (!stored) {
      setItems([]);
      return;
    }

    try {
      setItems(JSON.parse(stored) as CartItem[]);
    } catch {
      setItems([]);
    }
  }, [businessId]);

  const value = useMemo<CartContextValue>(() => {
    const addItem = (product: CartProduct) => {
      setItems((current) => {
        const existing = current.find((item) => item.product.id === product.id);
        if (existing) {
          return current.map((item) => (item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item));
        }

        return [...current, { product, quantity: 1 }];
      });
    };

    const incrementItem = (productId: number) => {
      setItems((current) => current.map((item) => (item.product.id === productId ? { ...item, quantity: item.quantity + 1 } : item)));
    };

    const decrementItem = (productId: number) => {
      setItems((current) =>
        current
          .map((item) => (item.product.id === productId ? { ...item, quantity: item.quantity - 1 } : item))
          .filter((item) => item.quantity > 0),
      );
    };

    const removeItem = (productId: number) => {
      setItems((current) => current.filter((item) => item.product.id !== productId));
    };

    const clearCart = () => {
      setItems([]);
    };

    return {
      items,
      totalItems: items.reduce((total, item) => total + item.quantity, 0),
      totalPrice: items.reduce((total, item) => total + Number(item.product.price) * item.quantity, 0),
      addItem,
      incrementItem,
      decrementItem,
      removeItem,
      clearCart,
    };
  }, [items]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used inside CartProvider');
  }

  return context;
}
