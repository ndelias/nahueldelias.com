// From Nahuel's account of the vers1ons design system, checked against the
// app's rulebook (.claude/skills/design-system) and its CI gate
// (scripts/lint-design.sh). Partners stay anonymous.
import type { DiagramSpec } from "../types";

export const designSystem: DiagramSpec = {
  id: "design-system",
  eyebrow: "vers1ons · design system",
  title: "One cohesive product",
  subtitle: "Every screen is built from the same tokens and shared components, and a check in CI keeps them that way. A change made once shows up everywhere.",
  columns: 4,
  nodes: [
    {
      id: "figma",
      zone: "design",
      title: "Design file",
      body: ["the visual source", "mirrored in tokens"],
      detail: "The token layers mirror the design file, so a decision made in design has one name in code.",
      col: 1,
      row: 2,
    },
    {
      id: "primitives",
      zone: "tokens",
      title: "Primitive tokens",
      body: ["warm black, lavender", "green, type, space"],
      detail: "The raw values. Dark only, so there's one ramp of surfaces instead of two themes.",
      col: 1,
      row: 1,
    },
    {
      id: "semantic",
      zone: "tokens",
      title: "Semantic tokens",
      body: ["surface, text, status", "green means money"],
      detail: "What each value is for. Lavender is the brand, actions and focus. Green is only ever price or success. Layering and motion have names too.",
      col: 2,
      row: 1,
    },
    {
      id: "components",
      zone: "components",
      title: "Shared components",
      body: ["play button, price pill", "badge, section header"],
      detail: "One of each, built on the tokens, with focus rings and touch sizes inside. Screens compose them instead of copying them.",
      col: 3,
      row: 1,
    },
    {
      id: "screens",
      title: "Every screen",
      body: ["the app and its wizards", "the smaller apps, the landing"],
      detail: "Moved across in five waves, from the shell and wizards to the player, the content and the smaller apps.",
      col: 4,
      row: 1,
    },
    {
      id: "cards",
      zone: "components",
      title: "Card family",
      body: ["listing, featured, artist", "genre, purchase, drop"],
      detail: "The same price pill, the same play button on the art, the same lift on hover, and a loading shape for each.",
      col: 3,
      row: 2,
    },
    {
      id: "mobile",
      zone: "components",
      title: "Mobile spec",
      body: ["touch sizes in the parts", "sheets, not pop-ups"],
      detail: "Touch sizes live in the component variants, so desktop stays the same and every control on a phone is big enough to tap.",
      col: 4,
      row: 2,
    },
    {
      id: "ci",
      zone: "ci",
      title: "Design check",
      body: ["runs on every change", "fails off-system code"],
      detail: "Blocks off-system colors, raw layering values and off-token motion. Rules a simple check can't judge reliably only warn.",
      col: 2,
      row: 2,
    },
  ],
  edges: [
    { from: "figma", to: "primitives", label: "mirrors", tone: "muted", dashed: true },
    { from: "primitives", to: "semantic", label: "named" },
    { from: "semantic", to: "components", label: "builds", tone: "accent" },
    { from: "components", to: "screens", label: "composes", tone: "accent" },
    { from: "components", to: "cards", label: "shapes" },
    { from: "mobile", to: "screens", label: "sizes" },
    { from: "ci", to: "components", label: "checks", tone: "warn", dashed: true },
  ],
  runs: {
    rebrand: {
      label: "Change the brand color",
      short: "Rebrand",
      steps: [
        { nodes: ["primitives"], log: "the lavender changes in one place" },
        { nodes: ["semantic"], edges: [["primitives", "semantic"]], log: "brand, actions and focus all point to it" },
        { nodes: ["components", "cards"], edges: [["semantic", "components"], ["components", "cards"]], log: "every button, badge and card picks it up", tone: "accent" },
        { nodes: ["screens"], edges: [["components", "screens"]], log: "every screen changes, and nothing is edited by hand", tone: "accent" },
      ],
    },
    offsystem: {
      label: "Someone hard-codes a gray",
      short: "Off-system",
      steps: [
        { nodes: ["screens"], log: "a new component uses bg-zinc-900" },
        { nodes: ["ci"], log: "the design check fails · surfaces must come from tokens", tone: "warn" },
        { nodes: ["semantic", "ci"], edges: [["ci", "components"]], log: "it switches to a surface token · the check passes", tone: "accent" },
      ],
    },
    newscreen: {
      label: "Build a new screen",
      short: "New screen",
      steps: [
        { nodes: ["components", "cards"], edges: [["components", "cards"]], log: "it starts from the shared parts" },
        { nodes: ["screens"], edges: [["components", "screens"]], log: "focus rings and the price pill come with them" },
        { nodes: ["ci"], edges: [["ci", "components"]], log: "the check passes · it's on brand without a review", tone: "accent" },
      ],
    },
    phone: {
      label: "Open it on a phone",
      short: "Phone",
      steps: [
        { nodes: ["mobile"], log: "the same tokens and colors carry over" },
        { nodes: ["components"], log: "controls grow to tap size from the variant itself" },
        { nodes: ["screens"], edges: [["mobile", "screens"]], log: "desktop is unchanged · pop-ups become sheets", tone: "accent" },
      ],
    },
  },
};
