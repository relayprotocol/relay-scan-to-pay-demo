"use client";

import { useState } from "react";
import { PaymentModal, type Product } from "@/components/PaymentModal";

const products: Product[] = [
  {
    name: "Demo Blend",
    description: "8 oz Medium Roast",
    priceUsd: 17.0,
    imageUrl: "/images/demo-blend.png",
  },
  {
    name: "Demo Citrus Blend",
    description: "8 oz Light Roast",
    priceUsd: 23.0,
    imageUrl: "/images/demo-citrus-blend.png",
  },
  {
    name: "Demo Decaf Blend",
    description: "8 oz Decaf",
    priceUsd: 1.0,
    imageUrl: "/images/demo-decaf-blend.png",
  },
];

export default function Home() {
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  return (
    <main className="min-h-screen">
      {/* Header */}
      <header className="border-b px-6 py-4">
        <div className="mx-auto max-w-5xl flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">☕</span>
            <span className="font-semibold tracking-tight">Demo Coffee</span>
          </div>
          <nav className="flex items-center gap-6 text-sm text-muted-foreground">
            <a href="/wallet" className="hover:text-foreground transition-colors">
              Wallet
            </a>
          </nav>
        </div>
      </header>

      {/* Products */}
      <section className="mx-auto max-w-5xl px-6 py-12">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold">Our Coffees</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Specialty roasts, shipped to your door.
          </p>
        </div>

        <div className="grid gap-6 sm:grid-cols-3">
          {products.map((product) => (
            <div
              key={product.name}
              className="overflow-hidden rounded-2xl border bg-card shadow-sm transition-shadow hover:shadow-md"
            >
              {/* Product image */}
              <div className="aspect-square overflow-hidden bg-muted">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={product.imageUrl}
                  alt={product.name}
                  className="h-full w-full object-cover"
                />
              </div>

              {/* Product details */}
              <div className="p-5">
                <h3 className="font-semibold">{product.name}</h3>
                <p className="text-sm text-muted-foreground mt-0.5 mb-4">
                  {product.description}
                </p>
                <div className="flex items-center justify-between">
                  <span className="text-lg font-bold">
                    ${product.priceUsd.toFixed(2)}
                  </span>
                  <button
                    onClick={() => setSelectedProduct(product)}
                    className="rounded-xl bg-indigo-600 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700"
                  >
                    Buy
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Payment Modal */}
      {selectedProduct && (
        <PaymentModal
          product={selectedProduct}
          onClose={() => setSelectedProduct(null)}
        />
      )}
    </main>
  );
}
