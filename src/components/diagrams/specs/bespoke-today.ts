// What Nahuel would build today (2026-10-19): storefronts and discovery for
// established artisans, search by image over real work, and a certificate of
// origin instead of a blockchain. A concept, not something built.
import type { DiagramSpec } from "../types";

export const bespokeToday: DiagramSpec = {
  id: "bespoke-today",
  eyebrow: "bespoke · today",
  title: "Help artisans get found",
  subtitle: "Artisans with their own style get a storefront. Buyers find them by scrolling real work, or by searching with a picture of what they like. Every piece ships with a certificate of origin.",
  columns: 4,
  nodes: [
    {
      id: "storefront",
      zone: "artisan",
      title: "Storefront",
      body: ["their own work", "their own story"],
      detail: "An artisan's page with the pieces they make and how they make them. They design what they enjoy making, as they already do.",
      col: 1,
      row: 1,
    },
    {
      id: "certificate",
      zone: "artisan",
      title: "Certificate of origin",
      body: ["made with each piece", "no wallet, no blockchain"],
      detail: "A certificate and an authentication package the artisan puts together in minutes. It proves where a piece came from without asking buyers to learn anything new.",
      col: 4,
      row: 2,
    },
    {
      id: "feed",
      zone: "buyer",
      title: "Discover",
      body: ["real pieces", "scroll it like Pinterest"],
      detail: "A feed of work by the people who made it, browsed for the fun of it.",
      col: 2,
      row: 1,
    },
    {
      id: "search",
      zone: "buyer",
      title: "Search by image",
      body: ["a photo of what you like"],
      detail: "A buyer adds a picture, like a mid-century chair they saw somewhere.",
      col: 2,
      row: 2,
    },
    {
      id: "match",
      zone: "ai",
      title: "Matched to real work",
      body: ["artisans who make that style"],
      detail: "AI reads the artisans' real work and finds who makes pieces like the picture. It never generates a piece that doesn't exist.",
      col: 3,
      row: 2,
    },
    {
      id: "piece",
      title: "A piece",
      body: ["buy it as it is", "or talk to the maker"],
      detail: "Buy a finished piece, or start a conversation with the artisan about something they'd want to make.",
      col: 3,
      row: 1,
    },
    {
      id: "delivered",
      zone: "buyer",
      title: "Delivered",
      body: ["with its certificate"],
      detail: "The piece arrives with its certificate of origin.",
      col: 4,
      row: 1,
    },
  ],
  edges: [
    { from: "storefront", to: "feed", label: "their work", tone: "accent" },
    { from: "feed", to: "piece", label: "found" },
    { from: "search", to: "match", label: "the picture" },
    { from: "match", to: "piece", label: "artisans like this", tone: "accent" },
    { from: "piece", to: "delivered", label: "bought", tone: "money" },
    { from: "certificate", to: "delivered", label: "ships with", tone: "muted" },
  ],
  runs: {
    search: {
      label: "Search with a photo",
      short: "Search",
      steps: [
        { nodes: ["search"], log: "a photo of a mid-century walnut chair" },
        { nodes: ["match"], edges: [["search", "match"]], log: "three furniture makers who work in that style", tone: "accent" },
        { nodes: ["piece"], edges: [["match", "piece"]], log: "a chair they've already made, or a conversation about one" },
        { nodes: ["delivered", "certificate"], edges: [["piece", "delivered"], ["certificate", "delivered"]], log: "delivered with its certificate of origin", tone: "money" },
      ],
    },
    browse: {
      label: "Browse the feed",
      short: "Browse",
      steps: [
        { nodes: ["storefront"], log: "a ceramicist posts a new run of vases" },
        { nodes: ["feed"], edges: [["storefront", "feed"]], log: "they show up in Discover next to other makers" },
        { nodes: ["piece"], edges: [["feed", "piece"]], log: "a buyer saves one, then buys it", tone: "money" },
      ],
    },
  },
};
