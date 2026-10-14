<script setup lang="ts">
import { useDialog } from '../composables/useDialog';
import type {} from '../types';

const props = defineProps<{ open: boolean }>();
const emit = defineEmits<{ close: [] }>();

const { close, closeOutside, onClose } = useDialog(
  () => props.open,
  () => emit('close'),
);
</script>

<template>
  <dialog
    id="about-dialog"
    aria-labelledby="about-title"
    ref="dialog"
    @click="closeOutside"
    @close="onClose"
  >
    <div class="dialog-heading">
      <h2 id="about-title">PIXEL / STATUS</h2>
      <button id="about-close" class="text-button" @click="close()">
        CLOSE
      </button>
    </div>
    <p>A pixel-art observatory for ServerStatus-Rust.</p>
    <dl>
      <dt>THE NUMBERS</dt>
      <dd>
        Online means IPv4 or IPv6 is up. Fleet CPU is the average across
        reporting online nodes. Fleet memory is weighted by capacity.
      </dd>
      <dt>THE ART</dt>
      <dd>
        The compute box, NAS and switch are illustrations selected by node name
        or configuration. They do not describe detected hardware.
      </dd>
      <dt>THE GRAPHS</dt>
      <dd>
        Real samples collected during this page session. No invented per-core,
        GPU, temperature or historical data.
      </dd>
      <dt>THE TIMESTAMPS</dt>
      <dd>
        Source time is compared with your local clock. A stale indicator can
        mean old data or a clock mismatch. Previous values remain visible.
      </dd>
      <dt>THE UNITS</dt>
      <dd>
        Memory arrives as KiB. Disk and network respect the backend's SI flag.
        Month traffic is measured from the backend's monthly baseline.
      </dd>
    </dl>
    <a
      href="https://github.com/zdz/ServerStatus-Rust"
      target="_blank"
      rel="noopener noreferrer"
    >
      PROJECT DOCUMENTATION
    </a>
  </dialog>
</template>
