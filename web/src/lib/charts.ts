/* Pixel charts draw only the samples supplied by the Vue application. */
import { bytes } from './core';
import type { HistorySample, PingHistoryPoint } from '../types';
function context(canvas: HTMLCanvasElement | null, pixelated = true) {
  if (!canvas) return null;

  const bounds = canvas.getBoundingClientRect();
  if (!bounds.width || !bounds.height) return null;

  const scale = pixelated ? 0.5 : window.devicePixelRatio || 1;
  canvas.width = Math.max(1, Math.round(bounds.width * scale));
  canvas.height = Math.max(1, Math.round(bounds.height * scale));
  const width = pixelated ? canvas.width : bounds.width;
  const height = pixelated ? canvas.height : bounds.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const palette = getComputedStyle(document.documentElement);
  const color = (name: string) => palette.getPropertyValue(name);
  ctx.setTransform(canvas.width / width, 0, 0, canvas.height / height, 0, 0);

  if (pixelated) {
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = color('--raised');
    for (let x = 0; x < width; x += 16) {
      for (let y = 0; y < height; y += 8) {
        ctx.fillRect(x, y, 1, 1);
      }
    }
  }

  return { ctx, color, width, height };
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

const pingSeries = [
  ['cu', '--cyan'],
  ['ct', '--purple'],
  ['cm', '--orange'],
] as const;

function pingScale(points: PingHistoryPoint[]) {
  let peak = 0;
  for (const point of points) {
    peak = Math.max(peak, point.cu ?? 0, point.ct ?? 0, point.cm ?? 0);
  }
  const step = Math.max(10, 10 ** Math.floor(Math.log10(peak || 1)));
  return Math.max(2, 2 * Math.ceil(peak / step / 2)) * step;
}

function ping(canvas: HTMLCanvasElement | null, points: PingHistoryPoint[]) {
  const chart = context(canvas, false);
  if (!chart || !points.length) return;
  const { ctx, color, width, height } = chart;
  const maximum = pingScale(points);
  const start = points[0].t;
  const duration = points[points.length - 1].t - start;
  const inset = 2;
  const bottom = height - inset;
  const plotHeight = bottom - inset;

  ctx.fillStyle = color('--line');
  for (const y of [inset, height / 2, bottom]) {
    ctx.fillRect(0, Math.floor(y), width, 1);
  }

  ctx.lineWidth = 1.75;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  for (const [field, stroke] of pingSeries) {
    ctx.strokeStyle = ctx.fillStyle = color(stroke);
    ctx.beginPath();
    let connected = false;
    for (const point of points) {
      const value = point[field];
      if (value === null) {
        connected = false;
        continue;
      }
      const x = duration
        ? inset + ((point.t - start) / duration) * (width - inset * 2)
        : width / 2;
      const y = bottom - (value / maximum) * plotHeight;
      if (connected) ctx.lineTo(x, y);
      else {
        ctx.moveTo(x, y);
        ctx.fillRect(x - 1, y - 1, 2, 2);
      }
      connected = true;
    }
    ctx.stroke();
  }
}

export { cpu, network, ping, pingScale, pingSeries };
