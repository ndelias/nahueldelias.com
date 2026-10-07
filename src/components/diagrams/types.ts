// Data shape for <SystemDiagram>. Layout is declared on a grid; wires are routed at runtime
// from the rendered boxes, so nothing here holds pixel coordinates.

export type Tone = "accent" | "money" | "muted" | "warn";

export interface SubStep {
  id: string; // addressed as "<node>.<id>" by edges and runs
  label: string;
  detail?: string;
}

export interface DiagramNode {
  id: string;
  title: string;
  zone?: string; // small eyebrow, e.g. "PARTNER"
  body?: string[];
  steps?: SubStep[];
  stepsLayout?: "column" | "row";
  kind?: "step" | "external" | "store";
  detail: string; // shown in the inspector
  col: number;
  row: number;
  colSpan?: number;
  rowSpan?: number;
}

export interface DiagramEdge {
  from: string; // node id or "<node>.<step>"
  to: string;
  label?: string;
  tone?: Tone;
  dashed?: boolean;
}

export interface RunStep {
  nodes?: string[]; // lit as active
  edges?: [string, string][]; // pulse travels these
  log: string;
  tone?: Tone;
  ms?: number; // how long this step holds (default 900)
}

export interface Run {
  label: string;
  short?: string; // for the narrow side panel beside a wide diagram
  steps: RunStep[];
}

export interface DiagramSpec {
  id: string;
  eyebrow: string;
  title: string;
  subtitle: string;
  columns: number;
  nodes: DiagramNode[];
  edges: DiagramEdge[];
  runs: Record<string, Run>; // first key is the default run
}
