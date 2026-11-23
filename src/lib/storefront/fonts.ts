import {
  Bebas_Neue,
  DM_Sans,
  Inter,
  Lora,
  Montserrat,
  Nunito,
  Playfair_Display,
  Poppins,
} from "next/font/google";
import type { FonteLoja } from "./theme";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-store-inter",
  display: "swap",
});

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-store-poppins",
  display: "swap",
});

const playfairDisplay = Playfair_Display({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-store-playfair",
  display: "swap",
});

const montserrat = Montserrat({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-store-montserrat",
  display: "swap",
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-store-dm-sans",
  display: "swap",
});

const lora = Lora({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-store-lora",
  display: "swap",
});

const nunito = Nunito({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-store-nunito",
  display: "swap",
});

const bebasNeue = Bebas_Neue({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-store-bebas-neue",
  display: "swap",
});

export const STORE_FONTS: Record<
  FonteLoja,
  { variable: string; cssFontFamily: string }
> = {
  Inter: {
    variable: inter.variable,
    cssFontFamily: "var(--font-store-inter), ui-sans-serif, system-ui, sans-serif",
  },
  Poppins: {
    variable: poppins.variable,
    cssFontFamily: "var(--font-store-poppins), ui-sans-serif, system-ui, sans-serif",
  },
  "Playfair Display": {
    variable: playfairDisplay.variable,
    cssFontFamily: "var(--font-store-playfair), ui-serif, Georgia, serif",
  },
  Montserrat: {
    variable: montserrat.variable,
    cssFontFamily:
      "var(--font-store-montserrat), ui-sans-serif, system-ui, sans-serif",
  },
  "DM Sans": {
    variable: dmSans.variable,
    cssFontFamily: "var(--font-store-dm-sans), ui-sans-serif, system-ui, sans-serif",
  },
  Lora: {
    variable: lora.variable,
    cssFontFamily: "var(--font-store-lora), ui-serif, Georgia, serif",
  },
  Nunito: {
    variable: nunito.variable,
    cssFontFamily: "var(--font-store-nunito), ui-sans-serif, system-ui, sans-serif",
  },
  "Bebas Neue": {
    variable: bebasNeue.variable,
    cssFontFamily:
      "var(--font-store-bebas-neue), ui-sans-serif, system-ui, sans-serif",
  },
};
