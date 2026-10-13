<script lang="ts">
import { defineComponent, type PropType } from 'vue';

export interface HorizonOption {
  value: number;
  label: string;
}

/** Radio group for the forecast horizon (native radios: keyboard and screen reader support for free). */
export default defineComponent({
  name: 'HomeHorizonPicker',
  props: {
    modelValue: { type: Number, required: true },
    options: { type: Array as PropType<HorizonOption[]>, required: true },
    legend: { type: String, required: true },
  },
  emits: ['update:modelValue'],
  methods: {
    choose(value: number): void {
      this.$emit('update:modelValue', value);
    },
  },
});
</script>

<template>
  <fieldset class="space-y-2">
    <legend class="mb-2 text-sm font-semibold">{{ legend }}</legend>
    <div class="grid gap-2 sm:grid-cols-2">
      <label
        v-for="o in options"
        :key="o.value"
        class="flex cursor-pointer items-center gap-2 rounded-lg border border-[var(--cf-border)] bg-[var(--cf-bg)] px-3 py-2 has-checked:border-[var(--cf-accent)] has-checked:font-semibold"
      >
        <input
          type="radio"
          name="cf-horizon"
          class="h-4 w-4 accent-[var(--cf-accent)]"
          :value="o.value"
          :checked="modelValue === o.value"
          @change="choose(o.value)"
        />
        <span>{{ o.label }}</span>
      </label>
    </div>
  </fieldset>
</template>
