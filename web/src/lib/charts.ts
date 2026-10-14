/* Pixel charts draw only the samples supplied by the Vue application. */
import { bytes } from './core';
import type { HistorySample } from '../types';
function context(canvas: HTMLCanvasElement | null) {
  if (!canvas) return null;

  const { width, height } = canvas.getBoundingClientRect();
  if (!width || !height) return null;

  canvas.width = Math.max(1, Math.round(width / 2));
  canvas.height = Math.max(1, Math.round(height / 2));

  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const palette = getComputedStyle(document.documentElement);
  const color = (name: string) => palette.getPropertyValue(name);
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = color('--raised');

  for (let x = 0; x < canvas.width; x += 16) {
    for (let y = 0; y < canvas.height; y += 8) {
      ctx.fillRect(x, y, 1, 1);
    }
  }

  return { ctx, color, width: canvas.width, height: canvas.height };
}

function cpu(canvas: HTMLCanvasElement | null, samples: HistorySample[]) {
  const chart = context(canvas);
  if (!chart || !canvas) return;

  const { ctx, color, width, height } = chart;
  const columns = 32;
  const points = samples.slice(-columns);
  const cell = Math.max(2, Math.floor(width / columns));
  const barWidth = Math.max(1, cell - 3);

  ctx.fillStyle = color('--raised');
  for (let column = 0; column < columns; column++) {
    for (let y = height - 3; y >= 1; y -= 5) {
      ctx.fillRect(column * cell, y, barWidth, 3);
    }
  }

  points.forEach((point, index) => {
    if (point.cpu === null) return;

    const x = (columns - points.length + index) * cell;
    const fill = Math.round((point.cpu / 100) * (height - 3));
    ctx.fillStyle = color(point.cpu >= 85 ? '--orange' : '--cyan');

    for (let offset = 0; offset < fill; offset += 5) {
      ctx.fillRect(
        x,
        height - 3 - offset,
        barWidth,
        Math.min(3, fill - offset),
      );
    }
  });

  const count = points.filter((point) => point.cpu !== null).length;
  canvas.setAttribute(
    'aria-label',
    `CPU utilization history, ${count} real session samples, 0 to 100 percent`,
  );
}

function network(canvas: HTMLCanvasElement | null, samples: HistorySample[]) {
  const chart = context(canvas);
  if (!chart || !canvas) return;

  const { ctx, color, width, height } = chart;
  const maximum = Math.max(
    1,
    ...samples.flatMap((point) => [point.rx ?? 0, point.tx ?? 0]),
  );

  for (const [field, stroke] of [
    ['rx', '--purple'],
    ['tx', '--blue'],
  ] as const) {
    ctx.strokeStyle = color(stroke);
    ctx.lineWidth = 1;
    ctx.beginPath();
    let previous: { y: number } | null = null;

    samples.forEach((point, index) => {
      const value = point[field];
      if (value === null) {
        previous = null;
        return;
      }

      const x =
        Math.round((index / Math.max(1, samples.length - 1)) * (width - 2)) + 1;
      const y = height - 2 - Math.round((value / maximum) * (height - 5));

      if (previous) {
        ctx.lineTo(x, previous.y);
        ctx.lineTo(x, y);
      } else {
        ctx.moveTo(x, y);
      }

      previous = { y };
    });

    ctx.stroke();
  }

  canvas.setAttribute(
    'aria-label',
    `Receive and transmit rates, ${samples.length} session samples; scale 0 to ${bytes(maximum)}/s. Purple receive, blue transmit.`,
  );
}

export { cpu, network };
