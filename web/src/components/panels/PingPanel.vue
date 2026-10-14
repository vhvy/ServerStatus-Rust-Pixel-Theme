<script setup lang="ts">
import type { NodeView } from '../../types';

defineProps<{ node: NodeView }>();
</script>

<template>
  <article class="ping-panel panel">
    <div class="panel-heading">
      <h2 class="color-green">PING</h2>
      <span>RTT / LOSS</span>
    </div>
    <table>
      <caption class="sr-only">
        Connectivity probes for selected node
      </caption>
      <thead class="sr-only">
        <tr>
          <th scope="col">Carrier</th>
          <th scope="col">Latency</th>
          <th scope="col">Packet loss</th>
        </tr>
      </thead>
      <tbody id="ping-rows">
        <tr v-for="probe in node.probes" :key="probe.carrier">
          <td>{{ probe.carrier }}</td>
          <td :class="{ bad: probe.timeout }">{{ probe.latency }}</td>
          <td :class="{ bad: probe.lossWarning }">
            {{ probe.loss }}
          </td>
        </tr>
      </tbody>
    </table>
  </article>
</template>
