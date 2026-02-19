"use client";

import { useState } from "react";
import { PaymentModal, type Product } from "@/components/PaymentModal";

const imgBlend = "/images/demo-blend-node.jpg";
const imgCitrus = "https://www.figma.com/api/mcp/asset/cae1a130-a0fe-443d-a5ad-e0b098199bec";
const imgDecaf = "https://www.figma.com/api/mcp/asset/0ceeb844-98bb-4a36-a9f2-16217c1ff96f";

const products: Product[] = [
  {
    name: "Node Blend",
    description: "8 oz Medium Roast",
    priceUsd: 17.0,
    imageUrl: imgBlend,
  },
  {
    name: "Node Citrus Blend",
    description: "8 oz Light Roast",
    priceUsd: 23.0,
    imageUrl: imgCitrus,
  },
  {
    name: "Node Decaf Blend",
    description: "8 oz Decaf",
    priceUsd: 1.0,
    imageUrl: imgDecaf,
  },
];

export default function Home() {
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  return (
    <main className="min-h-screen bg-white flex flex-col" style={{ fontFamily: "var(--font-inter), sans-serif" }}>
      {/* Header */}
      <header className="flex items-center justify-center px-4 sm:px-9 bg-white">
        <div className="w-full max-w-[1024px] flex items-center justify-between border-b border-[#c1c8cd] pt-5 pb-4 sm:pt-8 sm:pb-6">
          {/* Logo */}
          <div className="flex items-center">
            <span
              className="text-[#11181c] text-[22px] sm:text-[32px] tracking-[1.5px] sm:tracking-[1.92px]"
              style={{ fontFamily: "var(--font-chivo), sans-serif", fontWeight: 900, fontStyle: "italic" }}
            >
              NODE
            </span>
            <span
              className="text-[#11181c] text-[16px] sm:text-[24px] tracking-[1.5px] sm:tracking-[1.92px] ml-1.5 sm:ml-2"
              style={{ fontFamily: "var(--font-chivo), sans-serif", fontWeight: 600, fontStyle: "normal" }}
            >
              Coffee Shop
            </span>
          </div>

          {/* Nav icons */}
          <div className="flex items-center gap-2 sm:gap-3">
            {[
              <svg key="search" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#193154" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>,
              <svg key="user" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#193154" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
              <svg key="bag" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#193154" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>,
            ].map((icon, i) => (
              <button
                key={i}
                className="w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center rounded-lg border border-[#dfe3e6] bg-white cursor-pointer hover:bg-gray-50 transition-colors"
              >
                {icon}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="flex items-center justify-center flex-1 px-4 sm:px-9">
        <div className="w-full max-w-[1024px] flex flex-col gap-4">
          {/* Hero text */}
          <div className="flex flex-col gap-3 sm:gap-4 pt-8 pb-10 sm:pt-16 sm:pb-[80px]">
            <h1
              className="text-[#11181c] text-[28px] sm:text-[40px] leading-tight"
              style={{ fontFamily: "var(--font-inter), sans-serif", fontWeight: 700 }}
            >
              Experience Coffee.<br />
              Reimagined with{" "}
              <span
                style={{ fontFamily: "var(--font-chivo), sans-serif", fontWeight: 800, fontStyle: "italic" }}
                className="uppercase"
              >
                Node
              </span>
              .
            </h1>
            <p
              className="text-[#687076] text-[14px] sm:text-[16px] max-w-[665px] leading-snug"
              style={{ fontFamily: "var(--font-inter), sans-serif", fontWeight: 500 }}
            >
              By connecting growers, roasters, and consumers into a single, seamless experience, Node turns the fragmented coffee economy into one that just works.
            </p>
          </div>

          {/* Products grid — 1 col mobile, 3 col desktop */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 sm:gap-6 w-full pb-12 sm:pb-0">
            {products.map((product) => (
              <div key={product.name} className="flex flex-col gap-4">
                {/* Product image */}
                <div className="aspect-square w-full overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={product.imageUrl}
                    alt={product.name}
                    className="w-full h-full object-cover"
                  />
                </div>

                {/* Product info + buy */}
                <div className="flex items-center justify-between gap-3">
                  <div className="flex flex-col gap-1 min-w-0">
                    <p
                      className="text-[#687076] text-[15px] sm:text-[18px] truncate"
                      style={{ fontFamily: "var(--font-inter), sans-serif", fontWeight: 500 }}
                    >
                      {product.name}
                    </p>
                    <p
                      className="text-[#11181c] text-[15px] sm:text-[18px]"
                      style={{ fontFamily: "var(--font-inter), sans-serif", fontWeight: 600 }}
                    >
                      ${product.priceUsd.toFixed(2)} USD
                    </p>
                  </div>
                  <button
                    onClick={() => setSelectedProduct(product)}
                    className="h-11 sm:h-14 px-5 sm:px-8 rounded-xl bg-[#4615c8] text-white text-[14px] sm:text-[16px] font-bold hover:bg-[#3a11a8] transition-colors cursor-pointer shrink-0"
                    style={{ fontFamily: "var(--font-inter), sans-serif" }}
                  >
                    Buy
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="flex items-center justify-center px-4 sm:px-9 bg-white mt-auto">
        <div className="w-full max-w-[1024px] flex items-center justify-between border-t border-[#c1c8cd] pt-5 pb-6 sm:pt-6 sm:pb-8">
          <p
            className="text-[#687076] text-[13px] sm:text-[16px]"
            style={{ fontFamily: "var(--font-inter), sans-serif", fontWeight: 500 }}
          >
            Privacy Policy
          </p>
          <p
            className="text-[13px] sm:text-[16px]"
            style={{ fontFamily: "var(--font-inter), sans-serif", fontWeight: 500 }}
          >
            <span className="text-[#687076]">Powered by </span>
            <span className="text-[#5a45df]">Relay</span>
          </p>
        </div>
      </footer>

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
