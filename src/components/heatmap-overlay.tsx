'use client';

import * as React from 'react';
import type { HeatmapElement, HeatmapResult, SnapshotDetail } from '@/lib/api';

/**
 * Behavior heatmap: renders toggleable analytics layers on top of a captured
 * page screenshot. Element geometry comes from the snapshot (recorded at
 * capture time), so zones stay aligned with the image even if the live page
 * changes later. Each layer uses its own visual channel so several can be
 * enabled at once without blending into mud:
 *
 *  - Clicks      → zone FILL, one-hue sequential blue ramp (magnitude).
 *  - Hover       → zone RING, orange, thickness scales with attention time.
 *  - Frustration → corner BADGE, warning icon + dead/rage count (status).
 *  - Scroll      → dashed horizontal RULES with "% of visitors reached" labels.
 *
 * Exact values are always available in the hover tooltip and in the table
 * rendered by the page below the image (the accessible fallback).
 */

export interface HeatmapLayers {
  clicks: boolean;
  hover: boolean;
  frustration: boolean;
  scroll: boolean;
}

// Reference palette (validated; see dataviz notes in the PR/docs).
const CLICK_RAMP = ['#cde2fb', '#9ec5f4', '#5598e7', '#2a78d6']; // blue 100/200/350/450
const CLICK_BORDER = '#1c5cab'; // blue 550
const HOVER_RING = '#eb6834'; // categorical slot 2 (orange)
const FRUSTRATION_INK = '#d03b3b'; // status: critical
const SCROLL_RULE = '#52514e'; // secondary ink

interface Zone {
  selector: string;
  role: string;
  left: number; // all in % of snapshot dimensions
  top: number;
  width: number;
  height: number;
  metrics: HeatmapElement;
}

interface Props {
  snapshot: SnapshotDetail;
  imageUrl: string;
  heatmap: HeatmapResult;
  layers: HeatmapLayers;
}

export function HeatmapOverlay({
  snapshot,
  imageUrl,
  heatmap,
  layers,
}: Props): React.ReactElement {
  const [tooltip, setTooltip] = React.useState<{ zone: Zone; x: number; y: number } | null>(
    null,
  );

  const zones = React.useMemo(() => buildZones(snapshot, heatmap), [snapshot, heatmap]);
  const max = React.useMemo(() => maxima(zones), [zones]);

  return (
    <div className="relative w-full overflow-hidden rounded-lg border border-border">
      {/* The captured screenshot; zones are positioned in % of its size. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={imageUrl}
        alt={`Snapshot of ${snapshot.urlPath}`}
        className="block w-full select-none"
        draggable={false}
      />

      {zones.map((zone) => {
        const clicks = zone.metrics.ctaClicks;
        const hoverMs = zone.metrics.hoverMs;
        const frustration = zone.metrics.deadClicks + zone.metrics.rageClicks;

        const showFill = layers.clicks && clicks > 0;
        const showRing = layers.hover && hoverMs > 0;
        const showBadge = layers.frustration && frustration > 0;
        if (!showFill && !showRing && !showBadge) return null;

        const style: React.CSSProperties = {
          left: `${zone.left}%`,
          top: `${zone.top}%`,
          width: `${zone.width}%`,
          height: `${zone.height}%`,
        };
        if (showFill) {
          style.backgroundColor = withAlpha(
            binned(CLICK_RAMP, clicks, max.clicks),
            0.55,
          );
          style.outline = `1px solid ${withAlpha(CLICK_BORDER, 0.7)}`;
          style.outlineOffset = '-1px';
        }
        if (showRing) {
          style.boxShadow = `inset 0 0 0 ${ringWidth(hoverMs, max.hoverMs)}px ${HOVER_RING}`;
        }

        return (
          <div
            key={zone.selector}
            className="absolute rounded-sm"
            style={style}
            onMouseEnter={(e) => onZoneEnter(e, zone, setTooltip)}
            onMouseLeave={() => setTooltip(null)}
          >
            {showBadge ? (
              <span
                className="absolute right-1 top-1 inline-flex items-center gap-1 rounded-full border border-border bg-white px-1.5 py-0.5 text-[11px] font-medium leading-none text-foreground shadow-sm"
                title={`${zone.metrics.deadClicks} dead + ${zone.metrics.rageClicks} rage clicks`}
              >
                <span aria-hidden style={{ color: FRUSTRATION_INK }}>
                  ⚠
                </span>
                {frustration}
              </span>
            ) : null}
          </div>
        );
      })}

      {layers.scroll
        ? heatmap.scrollDepth.map((s) => (
            <div
              key={s.bucket}
              className="pointer-events-none absolute left-0 right-0"
              style={{
                top: `${s.bucket}%`,
                borderTop: `1.5px dashed ${SCROLL_RULE}`,
              }}
            >
              <span className="absolute right-2 -translate-y-1/2 rounded-full border border-border bg-white px-2 py-0.5 text-[11px] leading-none text-foreground shadow-sm">
                {s.bucket}% of page — {Math.round(s.pct * 100)}% of visitors
              </span>
            </div>
          ))
        : null}

      {tooltip ? (
        <div
          className="pointer-events-none absolute z-50 max-w-xs rounded-md bg-gray-900 px-3 py-2 text-xs text-white shadow-lg"
          style={{
            left: `${Math.min(tooltip.x, 70)}%`,
            top: `${tooltip.y}%`,
            transform: 'translateY(-100%)',
          }}
        >
          <div className="mb-1 font-mono text-[11px] text-gray-300">
            {tooltip.zone.selector}
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 tabular-nums">
            <span>Clicks</span>
            <span className="text-right">{tooltip.zone.metrics.ctaClicks}</span>
            <span>Hover time</span>
            <span className="text-right">{formatMs(tooltip.zone.metrics.hoverMs)}</span>
            <span>Dead clicks</span>
            <span className="text-right">{tooltip.zone.metrics.deadClicks}</span>
            <span>Rage clicks</span>
            <span className="text-right">{tooltip.zone.metrics.rageClicks}</span>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** Legend chips describing the enabled layers' encodings. */
export function HeatmapLegend({ layers }: { layers: HeatmapLayers }): React.ReactElement {
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
      {layers.clicks ? (
        <span className="inline-flex items-center gap-1.5">
          <span
            className="h-3 w-8 rounded-sm"
            style={{
              background: `linear-gradient(to right, ${CLICK_RAMP[0]}, ${CLICK_RAMP[3]})`,
            }}
          />
          Clicks (fill: few → many)
        </span>
      ) : null}
      {layers.hover ? (
        <span className="inline-flex items-center gap-1.5">
          <span
            className="h-3 w-3 rounded-sm"
            style={{ boxShadow: `inset 0 0 0 2px ${HOVER_RING}` }}
          />
          Hover attention (ring: thicker = longer)
        </span>
      ) : null}
      {layers.frustration ? (
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden style={{ color: FRUSTRATION_INK }}>
            ⚠
          </span>
          Frustration (dead + rage clicks)
        </span>
      ) : null}
      {layers.scroll ? (
        <span className="inline-flex items-center gap-1.5">
          <span
            className="inline-block w-8"
            style={{ borderTop: `1.5px dashed ${SCROLL_RULE}` }}
          />
          Scroll depth (% of visitors reaching)
        </span>
      ) : null}
    </div>
  );
}

/* --------------------------------- helpers -------------------------------- */

function buildZones(snapshot: SnapshotDetail, heatmap: HeatmapResult): Zone[] {
  const bySelector = new Map(heatmap.elements.map((e) => [e.selector, e]));
  const zones: Zone[] = [];
  for (const node of snapshot.nodes) {
    const metrics = bySelector.get(node.selector);
    if (!metrics) continue;
    const [x, y, w, h] = node.rect;
    zones.push({
      selector: node.selector,
      role: node.role,
      left: (x / snapshot.width) * 100,
      top: (y / snapshot.height) * 100,
      width: (w / snapshot.width) * 100,
      height: (h / snapshot.height) * 100,
      metrics,
    });
  }
  // Large zones first so small ones stack on top and stay hoverable.
  return zones.sort((a, b) => b.width * b.height - a.width * a.height);
}

function maxima(zones: Zone[]): { clicks: number; hoverMs: number } {
  let clicks = 0;
  let hoverMs = 0;
  for (const z of zones) {
    clicks = Math.max(clicks, z.metrics.ctaClicks);
    hoverMs = Math.max(hoverMs, z.metrics.hoverMs);
  }
  return { clicks, hoverMs };
}

/** Bin a value into the sequential ramp (quartiles of the observed max). */
function binned(ramp: string[], value: number, max: number): string {
  if (max <= 0) return ramp[0] ?? '#cde2fb';
  const idx = Math.min(ramp.length - 1, Math.floor((value / max) * ramp.length));
  return ramp[idx] ?? ramp[ramp.length - 1] ?? '#2a78d6';
}

function ringWidth(hoverMs: number, max: number): number {
  if (max <= 0) return 2;
  return 2 + Math.round((hoverMs / max) * 4); // 2..6px
}

function withAlpha(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function formatMs(ms: number): string {
  if (ms < 1000) return `${ms} ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)} s`;
  return `${(ms / 60000).toFixed(1)} min`;
}

function onZoneEnter(
  e: React.MouseEvent<HTMLDivElement>,
  zone: Zone,
  setTooltip: (t: { zone: Zone; x: number; y: number } | null) => void,
): void {
  const container = e.currentTarget.parentElement;
  if (!container) return;
  const rect = container.getBoundingClientRect();
  const zoneRect = e.currentTarget.getBoundingClientRect();
  const x = ((zoneRect.left - rect.left) / rect.width) * 100;
  const y = ((zoneRect.top - rect.top) / rect.height) * 100;
  setTooltip({ zone, x, y: Math.max(y, 4) });
}
