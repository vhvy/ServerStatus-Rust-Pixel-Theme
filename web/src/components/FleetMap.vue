<script setup lang="ts">
import {
  computed,
  onMounted,
  onUnmounted,
  ref,
  shallowRef,
  useId,
  watch,
} from 'vue';
import land from '../assets/world-land.path?raw';
import { format } from '../lib/core';
import { countryCode, loadGeocoder, type Geocoder } from '../lib/geography';
import {
  mapRoutes,
  mapSites,
  mapView,
  worldLandOffset,
  type MapSite,
  type MapView,
} from '../lib/nodeMap';
import type { NodeView } from '../types';

const props = defineProps<{
  nodes: NodeView[];
  loading: boolean;
}>();
const emit = defineEmits<{ locate: [name: string] }>();
const storageKey = 'pixel-status-map-open';
const expanded = ref(true);
try {
  expanded.value = localStorage.getItem(storageKey) !== 'false';
} catch {
  // The map remains usable when storage is unavailable.
}
watch(expanded, (open) => {
  try {
    localStorage.setItem(storageKey, String(open));
  } catch {
    // Keep the in-memory selection.
  }
  closePopup();
});

const dotsId = useId();
const landId = useId();
const worldClipId = useId();
const bodyId = useId();
const stage = ref<HTMLElement | null>(null);
const size = shallowRef({ width: 900, height: 186 });
let observer: ResizeObserver | undefined;
onMounted(() => {
  observer = new ResizeObserver(([{ contentRect }]) => {
    const { width, height } = contentRect;
    if (width && height) size.value = { width, height };
  });
  if (stage.value) observer.observe(stage.value);
});
onUnmounted(() => observer?.disconnect());

const world = ref(false);
const geocode = shallowRef<Geocoder>();
const loadFailed = ref(false);
const needsIndex = computed(() =>
  props.nodes.some((node) => !!countryCode(node.location)),
);
const loadingLocations = computed(
  () => needsIndex.value && !geocode.value && !loadFailed.value,
);
let loadingIndex = false;
watch(
  [expanded, needsIndex],
  async ([open, needed]) => {
    if (!open || !needed || geocode.value || loadingIndex) return;
    loadingIndex = true;
    loadFailed.value = false;
    try {
      geocode.value = await loadGeocoder();
    } catch {
      loadFailed.value = true;
    } finally {
      loadingIndex = false;
    }
  },
  { immediate: true },
);
const sites = computed(() =>
  geocode.value ? mapSites(props.nodes, geocode.value) : [],
);
const unmapped = computed(
  () =>
    props.nodes.length -
    sites.value.reduce((count, site) => count + site.members.length, 0),
);
const routes = computed(() => mapRoutes(sites.value));
const routePath = computed(() =>
  routes.value
    .map(({ from, to }) => `M ${from.x} ${from.y} L ${to.x} ${to.y}`)
    .join(' '),
);
const target = computed(() =>
  mapView(
    sites.value,
    size.value.width / size.value.height,
    world.value,
    routes.value,
  ),
);
const box = ({ x, y, width, height }: MapView) =>
  `${x} ${y} ${width} ${height}`;
const viewport = shallowRef(target.value);
const viewBox = computed(() => box(viewport.value));
watch(
  () => box(target.value),
  (_, __, onCleanup) => {
    const from = viewport.value;
    const to = target.value;
    if (
      !expanded.value ||
      Math.abs(from.width / from.height - to.width / to.height) > 0.001 ||
      matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      viewport.value = to;
      return;
    }
    const start = performance.now();
    let frame: number;
    function animate(now: number) {
      const progress = Math.min(1, (now - start) / 240);
      const amount = 1 - (1 - progress) ** 3;
      const lerp = (key: keyof MapView) =>
        from[key] + (to[key] - from[key]) * amount;
      viewport.value = {
        x: lerp('x'),
        y: lerp('y'),
        width: lerp('width'),
        height: lerp('height'),
      };
      if (progress < 1) frame = requestAnimationFrame(animate);
    }
    frame = requestAnimationFrame(animate);
    onCleanup(() => cancelAnimationFrame(frame));
  },
);

type Marker = { id: string; x: number; y: number; sites: MapSite[] };
type Box = { left: number; right: number; top: number; bottom: number };
function position(site: { x: number; y: number }, view: MapView) {
  return {
    x: (site.x - view.x) / view.width,
    y: (site.y - view.y) / view.height,
  };
}
function pinPosition(pin: Marker, view: MapView) {
  const { x, y } = position(pin, view);
  return {
    x: Math.min(0.99, Math.max(0.01, x)),
    y: Math.min(0.96, Math.max(0.04, y)),
  };
}
function overlaps(a: Box, b: Box) {
  return (
    a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top
  );
}
const markerGroups = computed(() => {
  const groups: Marker[] = [];
  const { width, height } = size.value;
  for (const site of sites.value) {
    const point = position(site, target.value);
    if (point.x < 0 || point.x > 1 || point.y < 0 || point.y > 1) continue;
    const neighbor = groups.find((group) => {
      const anchor = position(group, target.value);
      return (
        Math.hypot(
          (point.x - anchor.x) * width,
          (point.y - anchor.y) * height,
        ) < 28
      );
    });
    if (neighbor) neighbor.sites.push(site);
    else groups.push({ id: site.id, x: site.x, y: site.y, sites: [site] });
  }
  const occupied: Box[] = [{ left: 6, right: 86, top: 6, bottom: 32 }];
  for (const group of groups) {
    const { x, y } = pinPosition(group, target.value);
    occupied.push({
      left: x * width - 10,
      right: x * width + 10,
      top: y * height - 10,
      bottom: y * height + 10,
    });
  }

  return groups.map((group) => {
    const members = group.sites.flatMap((site) => site.members);
    const { label: place, region } = group.sites[0];
    const label =
      group.sites.length > 1 ? `${place} +${group.sites.length - 1}` : place;
    const status = group.sites.some((site) => site.status === 'warn')
      ? 'warn'
      : group.sites.some((site) => site.status === 'online')
        ? 'online'
        : 'offline';
    const { x, y } = pinPosition(group, target.value);
    const captionWidth = Math.min(
      125,
      Array.from(label).reduce(
        (length, char) => length + (char.charCodeAt(0) > 255 ? 11 : 7),
        8,
      ) + (members.length > 1 ? 16 : 0),
    );
    const preferred = x > 0.72 ? 'left' : 'right';
    const sides = [preferred, preferred === 'left' ? 'right' : 'left'];
    const candidates = [0, -8, 8].flatMap((offset) =>
      sides.map((side) => {
        const left = x * width + (side === 'left' ? -13 - captionWidth : 13);
        const top = y * height - 9 + offset;
        return {
          side,
          offset,
          bounds: { left, top, right: left + captionWidth, bottom: top + 19 },
        };
      }),
    );
    const caption = candidates.find(
      ({ bounds }) =>
        bounds.left >= 2 &&
        bounds.right <= width - 2 &&
        bounds.top >= 0 &&
        bounds.bottom <= height &&
        occupied.every((other) => !overlaps(bounds, other)),
    );
    if (caption) occupied.push(caption.bounds);
    return { ...group, members, status, label, region, caption };
  });
});
const markers = computed(() =>
  markerGroups.value.map((group) => ({
    ...group,
    ...pinPosition(group, viewport.value),
  })),
);

const hovered = ref('');
const focused = ref('');
const pinned = ref('');
const active = computed(() => hovered.value || focused.value || pinned.value);
function closePopup() {
  hovered.value = '';
  focused.value = '';
  pinned.value = '';
}
function leaveFocus(event: FocusEvent) {
  if (
    !(event.currentTarget as HTMLElement).contains(event.relatedTarget as Node)
  )
    focused.value = '';
}
function escape(event: Event) {
  (event.currentTarget as HTMLElement)
    .querySelector<HTMLButtonElement>('.map-pin')
    ?.focus();
  closePopup();
}
function locate(name: string) {
  closePopup();
  emit('locate', name);
}
function choose(marker: (typeof markers.value)[number]) {
  if (marker.members.length === 1) {
    locate(marker.members[0].node.name);
  } else {
    pinned.value = pinned.value === marker.id ? '' : marker.id;
  }
}
function toggleView() {
  closePopup();
  world.value = !world.value;
}
</script>

<template>
  <section class="fleet-map" aria-labelledby="fleet-map-heading">
    <div class="map-heading">
      <h2 id="fleet-map-heading">GEOLOCATION &amp; NETWORKS</h2>
      <button
        type="button"
        :aria-controls="bodyId"
        :aria-expanded="expanded"
        @click="expanded = !expanded"
      >
        [ MAP: {{ expanded ? 'ON' : 'OFF' }} ]
      </button>
    </div>
    <div :id="bodyId" v-show="expanded" class="map-layout">
      <div ref="stage" class="map-stage">
        <svg class="map-land" :viewBox="viewBox" aria-hidden="true">
          <defs>
            <pattern
              :id="dotsId"
              width="0.86"
              height="0.86"
              patternUnits="userSpaceOnUse"
            >
              <rect width="0.59" height="0.59" fill="currentColor" />
            </pattern>
            <path :id="landId" :d="land" fill-rule="evenodd" />
            <clipPath :id="worldClipId">
              <rect width="360" height="180" />
            </clipPath>
          </defs>
          <g :clip-path="`url(#${worldClipId})`" :fill="`url(#${dotsId})`">
            <use :href="`#${landId}`" :x="-worldLandOffset" />
            <use :href="`#${landId}`" :x="360 - worldLandOffset" />
          </g>
          <g v-if="routePath" class="map-routes">
            <path
              class="map-route-halo"
              :d="routePath"
              vector-effect="non-scaling-stroke"
            />
            <path
              class="map-route"
              :d="routePath"
              vector-effect="non-scaling-stroke"
            />
          </g>
        </svg>
        <button
          class="map-view"
          type="button"
          :aria-pressed="world"
          aria-label="World view"
          @click="toggleView"
        >
          [ {{ world ? 'WORLD' : 'AUTO' }} ]
        </button>
        <div
          v-for="marker in markers"
          :key="marker.id"
          class="map-marker"
          :class="[
            marker.status,
            {
              'label-left': marker.caption?.side === 'left',
              'popup-left': marker.x > 0.56,
              'popup-above': marker.y > 0.48,
              'popup-open': active === marker.id,
            },
          ]"
          :style="{ '--x': marker.x * 100 + '%', '--y': marker.y * 100 + '%' }"
          @pointerenter="
            $event.pointerType !== 'touch' && (hovered = marker.id)
          "
          @pointerleave="hovered === marker.id && (hovered = '')"
          @focusin="focused = marker.id"
          @focusout="leaveFocus"
          @keydown.esc.stop="escape"
        >
          <button
            type="button"
            class="map-pin"
            :aria-label="`${marker.label}, ${marker.members.length} ${marker.members.length === 1 ? 'node' : 'nodes'}, ${marker.status}`"
            :aria-expanded="
              marker.members.length > 1 ? active === marker.id : undefined
            "
            @click="choose(marker)"
          >
            <i class="map-dot" aria-hidden="true"></i>
            <span
              v-if="marker.caption"
              class="map-label"
              :style="{ top: 5 + marker.caption.offset + 'px' }"
              aria-hidden="true"
            >
              {{ marker.label
              }}<b v-if="marker.members.length > 1">{{
                marker.members.length
              }}</b>
            </span>
          </button>
          <div v-if="active === marker.id" class="map-popup">
            <strong
              >{{ marker.region ? marker.region + ' / ' : ''
              }}{{ marker.label }}</strong
            >
            <ul>
              <li v-for="member in marker.members" :key="member.node.name">
                <button
                  v-if="marker.members.length > 1"
                  type="button"
                  class="map-member"
                  @click="locate(member.node.name)"
                >
                  {{ member.node.displayName }}
                  <span>#{{ format.count(member.number) }}</span>
                </button>
                <span v-else class="map-member">
                  {{ member.node.displayName }}
                  <span>#{{ format.count(member.number) }}</span>
                </span>
                <small :class="member.status">
                  {{ member.status.toUpperCase() }}
                  <span v-for="probe in member.node.probes" :key="probe.carrier"
                    >{{ probe.carrier }} {{ probe.latency }}</span
                  >
                </small>
              </li>
            </ul>
          </div>
        </div>
      </div>
      <div class="map-summary">
        <div class="map-summary-heading">
          <h3>NODE TOPOLOGY &amp; LATENCY</h3>
          <span>AVG RTT</span>
        </div>
        <ul v-if="sites.length" class="map-readings">
          <li v-for="site in sites" :key="site.id">
            <span class="map-site">{{ site.label }}</span>
            <span v-if="site.status === 'warn'" class="warn">WARN</span>
            <span v-else-if="site.status === 'offline'" class="offline"
              >OFFLINE</span
            >
            <span class="map-rtt">{{
              site.rtt === null ? '—' : site.rtt + 'ms'
            }}</span>
          </li>
        </ul>
        <p v-else class="map-empty">
          {{
            loading || loadingLocations
              ? 'WAITING FOR NODE LOCATIONS…'
              : loadFailed
                ? 'LOCATION INDEX UNAVAILABLE'
                : 'NO KNOWN NODE LOCATIONS'
          }}
        </p>
        <div class="map-legend" aria-label="Map states">
          <span class="online"><i></i> ONLINE</span>
          <span class="warn"><i></i> WARN</span>
          <span class="offline"><i></i> OFFLINE</span>
          <span v-if="unmapped && !loadingLocations" class="map-unmapped"
            >{{ unmapped }} UNMAPPED</span
          >
          <a
            class="map-attribution"
            href="https://www.geonames.org/"
            target="_blank"
            rel="noopener noreferrer"
            >GeoNames</a
          >
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.fleet-map {
  margin: 3px 0 12px;
}
.map-heading {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
  margin-bottom: 7px;
}
.map-heading h2,
.map-summary h3 {
  margin: 0;
  font-size: inherit;
  font-weight: 400;
}
.map-heading h2 {
  color: var(--muted);
}
.map-heading button,
.map-view {
  padding: 2px 6px;
  border: 1px solid var(--line);
  background: var(--surface);
  white-space: nowrap;
}
.map-heading button:hover,
.map-view:hover {
  color: var(--cyan);
  border-color: var(--cyan);
}
.map-layout {
  display: grid;
  grid-template-columns: minmax(0, 3fr) minmax(244px, 1fr);
  padding: 3px;
  gap: 3px;
  border: 1px solid var(--dim);
  background: var(--raised);
}
.map-stage {
  position: relative;
  min-width: 0;
  height: 186px;
  border: 1px solid var(--line);
  background: var(--surface);
  isolation: isolate;
}
.map-land {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  color: color-mix(in srgb, var(--muted) 78%, var(--surface));
  pointer-events: none;
}
.map-routes {
  fill: none;
  stroke-linecap: round;
}
.map-route-halo {
  stroke: var(--surface);
  stroke-width: 4.5;
}
.map-route {
  stroke: var(--cyan);
  stroke-width: 2;
  stroke-dasharray: 6 4;
}
.map-view {
  position: absolute;
  top: 7px;
  left: 7px;
  z-index: 2;
}
.online {
  --status: var(--green);
}
.warn {
  --status: var(--yellow);
  color: var(--status);
}
.offline {
  --status: var(--danger);
  color: var(--status);
}
.map-marker {
  position: absolute;
  top: var(--y);
  left: var(--x);
  width: 28px;
  height: 28px;
  transform: translate(-50%, -50%);
  z-index: 1;
}
.map-marker.popup-open {
  z-index: 3;
}
.map-pin {
  display: grid;
  place-items: center;
  width: 100%;
  height: 100%;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: transparent;
}
.map-dot,
.map-legend i {
  width: 8px;
  height: 8px;
  background: var(--status);
  border-radius: 50%;
}
.map-attribution {
  margin-left: auto;
  color: var(--muted);
  text-decoration: underline;
}
.map-dot {
  position: relative;
  outline: 2px solid var(--surface);
  box-shadow: 0 0 0 5px color-mix(in srgb, var(--status) 32%, transparent);
}
.online .map-dot::before {
  position: absolute;
  inset: -5px;
  border: 1px solid var(--status);
  border-radius: 50%;
  content: '';
  animation: map-pulse 2.6s ease-out infinite;
}
@keyframes map-pulse {
  0% {
    opacity: 0.7;
    transform: scale(0.8);
  }
  75%,
  100% {
    opacity: 0;
    transform: scale(1.45);
  }
}
.map-pin:is(:hover, :focus-visible) .map-dot {
  box-shadow: 0 0 0 6px color-mix(in srgb, var(--status) 52%, transparent);
}
.map-label {
  position: absolute;
  left: 27px;
  max-width: 125px;
  padding: 0 4px;
  overflow: hidden;
  background: var(--text);
  color: var(--surface);
  text-overflow: ellipsis;
  white-space: nowrap;
  pointer-events: none;
}
.label-left .map-label {
  right: 27px;
  left: auto;
}
.map-label b {
  margin-left: 4px;
  color: var(--line);
}
.map-popup {
  position: absolute;
  top: 100%;
  left: 0;
  width: min(245px, calc(100vw - 44px));
  max-height: 180px;
  padding: 8px 10px;
  overflow: auto;
  border: 1px solid var(--dim);
  background: var(--surface);
  box-shadow: 2px 3px 0 var(--line);
  color: var(--text);
}
.popup-left .map-popup {
  right: 0;
  left: auto;
}
.popup-above .map-popup {
  top: auto;
  bottom: 100%;
}
.map-popup strong {
  display: block;
  margin-bottom: 2px;
  color: var(--muted);
  font-weight: 400;
}
.map-popup ul,
.map-readings {
  padding: 0;
  list-style: none;
}
.map-popup ul {
  margin: 0;
}
.map-popup li {
  padding: 4px 0;
  border-top: 1px solid var(--line);
}
.map-member {
  display: flex;
  justify-content: space-between;
  gap: 6px;
  width: 100%;
  padding: 0;
  border: 0;
  background: transparent;
  text-align: left;
}
button.map-member:hover {
  color: var(--cyan);
}
.map-popup small {
  display: flex;
  flex-wrap: wrap;
  column-gap: 7px;
  color: var(--status);
  font-size: 10px;
}
.map-popup small span {
  color: var(--muted);
}
.map-summary {
  display: flex;
  min-width: 0;
  height: 186px;
  flex-direction: column;
  padding: 7px 10px;
  border: 1px solid var(--line);
  background: var(--surface);
}
.map-summary-heading,
.map-legend {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
}
.map-summary-heading {
  padding-bottom: 4px;
  border-bottom: 1px solid var(--line);
}
.map-summary-heading span,
.map-empty,
.map-unmapped {
  color: var(--muted);
}
.map-readings {
  margin: 4px 0;
  overflow: auto;
  scrollbar-width: thin;
}
.map-readings li {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto;
  align-items: center;
  gap: 8px;
  padding-block: 1px;
  line-height: 1.3;
}
.map-site {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.map-rtt {
  grid-column: 3;
  min-width: 5ch;
  text-align: right;
}
.map-legend {
  flex-wrap: wrap;
  justify-content: flex-start;
  gap: 2px 10px;
  margin-top: auto;
  padding-top: 4px;
  border-top: 1px solid var(--line);
  font-size: 10px;
}
.map-legend span {
  color: var(--status, var(--muted));
  white-space: nowrap;
}
.map-legend i {
  display: inline-block;
  width: 6px;
  height: 6px;
}
@media (max-width: 700px) {
  .map-layout {
    grid-template-columns: minmax(0, 1fr);
  }
  .map-stage {
    height: 158px;
  }
  .map-summary {
    height: auto;
    max-height: 155px;
  }
  .map-label {
    display: none;
  }
  .map-marker .map-popup {
    position: fixed;
    top: auto;
    bottom: 9px;
    right: 8px;
    left: 8px;
    width: auto;
  }
  .map-marker {
    transform: none;
    margin: -14px;
  }
  .popup-left .map-popup {
    right: 8px;
    left: 8px;
  }
}
@media (prefers-reduced-motion: reduce) {
  .online .map-dot::before {
    animation: none;
    display: none;
  }
}
</style>
