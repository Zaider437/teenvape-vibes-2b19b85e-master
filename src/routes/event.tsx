import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { CartProvider } from "../lib/cart";
import { FallingEffects } from "../components/FallingEffects";
import { Toaster } from "sonner";
import { Shop } from "./index";

export const Route = createFileRoute("/event")({
  head: () => ({
    meta: [
      { title: "LoveVape — ивент" },
      {
        name: "description",
        content: "Праздничный ивент LoveVape.",
      },
    ],
  }),
  component: () => {
    const [snowActive, setSnowActive] = useState<boolean | undefined>(undefined);
    return (
      <CartProvider>
        <FallingEffects onSnowChange={setSnowActive} disabled />
        <Shop snowActive={snowActive} eventPreview />
        <Toaster position="top-center" theme="dark" richColors />
      </CartProvider>
    );
  },
});
