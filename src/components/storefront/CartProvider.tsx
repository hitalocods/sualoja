"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  alterarQuantidadeItem,
  cartStorageKey,
  definirQuantidadeItem,
  reconciliarCarrinhoComEstoque,
  resolverItensCarrinho,
  type CartResolvedItem,
  type CartStorageItem,
  type ProdutoPublico,
} from "@/lib/storefront/cart";

type CartContextValue = {
  slug: string;
  items: CartResolvedItem[];
  totalItens: number;
  subtotalCentavos: number;
  hydrated: boolean;
  drawerOpen: boolean;
  openDrawer: () => void;
  closeDrawer: () => void;
  getQuantidade: (produtoId: string) => number;
  incrementar: (produtoId: string) => void;
  decrementar: (produtoId: string) => void;
  remover: (produtoId: string) => void;
  limpar: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({
  slug,
  produtos,
  children,
}: {
  slug: string;
  produtos: ProdutoPublico[];
  children: React.ReactNode;
}) {
  const [rawItems, setRawItems] = useState<CartStorageItem[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const produtosMap = useMemo(
    () => new Map(produtos.map((p) => [p.id, p])),
    [produtos],
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        const saved = window.localStorage.getItem(cartStorageKey(slug));
        if (saved) {
          const parsed: unknown = JSON.parse(saved);
          const lista = Array.isArray(parsed)
            ? parsed
            : parsed &&
                typeof parsed === "object" &&
                "items" in parsed &&
                Array.isArray((parsed as { items: unknown }).items)
              ? (parsed as { items: CartStorageItem[] }).items
              : [];
          setRawItems(reconciliarCarrinhoComEstoque(lista, produtos));
        } else {
          setRawItems([]);
        }
      } catch {
        setRawItems([]);
      } finally {
        setHydrated(true);
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [slug, produtos]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(
        cartStorageKey(slug),
        JSON.stringify({
          items: rawItems,
          updatedAt: Date.now(),
        }),
      );
    } catch {
      // Ignora erro de quota ou modo privado
    }
  }, [slug, rawItems, hydrated]);

  const items = useMemo(
    () => resolverItensCarrinho(rawItems, produtos),
    [rawItems, produtos],
  );

  const totalItens = useMemo(
    () => items.reduce((acc, item) => acc + item.qtd, 0),
    [items],
  );

  const subtotalCentavos = useMemo(
    () => items.reduce((acc, item) => acc + item.subtotal_centavos, 0),
    [items],
  );

  const getQuantidade = useCallback(
    (produtoId: string) =>
      items.find((item) => item.produto.id === produtoId)?.qtd ?? 0,
    [items],
  );

  const incrementar = useCallback(
    (produtoId: string) => {
      const produto = produtosMap.get(produtoId);
      if (!produto || produto.estoque <= 0) return;
      setRawItems((prev) =>
        alterarQuantidadeItem(prev, produtoId, 1, produto.estoque),
      );
    },
    [produtosMap],
  );

  const decrementar = useCallback(
    (produtoId: string) => {
      const produto = produtosMap.get(produtoId);
      const estoque = produto?.estoque ?? 0;
      setRawItems((prev) => alterarQuantidadeItem(prev, produtoId, -1, estoque));
    },
    [produtosMap],
  );

  const remover = useCallback((produtoId: string) => {
    setRawItems((prev) => definirQuantidadeItem(prev, produtoId, 0, 0));
  }, []);

  const limpar = useCallback(() => {
    setRawItems([]);
  }, []);

  const openDrawer = useCallback(() => setDrawerOpen(true), []);
  const closeDrawer = useCallback(() => setDrawerOpen(false), []);

  const value = useMemo<CartContextValue>(
    () => ({
      slug,
      items,
      totalItens,
      subtotalCentavos,
      hydrated,
      drawerOpen,
      openDrawer,
      closeDrawer,
      getQuantidade,
      incrementar,
      decrementar,
      remover,
      limpar,
    }),
    [
      slug,
      items,
      totalItens,
      subtotalCentavos,
      hydrated,
      drawerOpen,
      openDrawer,
      closeDrawer,
      getQuantidade,
      incrementar,
      decrementar,
      remover,
      limpar,
    ],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) {
    throw new Error("useCart deve ser usado dentro de CartProvider.");
  }
  return ctx;
}
