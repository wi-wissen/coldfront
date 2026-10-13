<script lang="ts">
import { defineComponent, type PropType } from 'vue';
import { GermanyMap, type GermanyMapLabels, type GermanyMapProps } from '@coldfront/charts';
import { regionById, type IsoWeek, type WastewaterExport } from '@coldfront/forecast-core';
import { pageHref } from '../../scripts/pages';
import { formatDate } from '../api';
import { isoWeekNumber } from '../lib/forecast-text';
import {
  WASTEWATER_PATHOGENS,
  percentPoints,
  pathogenEntries,
  pointLevel,
  topByPercentile,
  trendSymbol,
  type PathogenEntry,
  type WastewaterPathogen,
} from '../lib/wastewater';
import type { Locale } from '../types';

type MapPoint = NonNullable<GermanyMapProps['points']>[number];
type MapPointsLegend = NonNullable<GermanyMapProps['pointsLegend']>;
type MapPointsTableLabels = NonNullable<GermanyMapProps['pointsTableLabels']>;

interface TopRow {
  id: string;
  name: string;
  state: string;
  percentile: number;
  trend: string;
  trendText: string;
}

/** Start page: wastewater early indicator (points on the state map, top-10 table, pathogen choice). */
export default defineComponent({
  name: 'HomeWastewater',
  components: { GermanyMap },
  props: {
    wastewater: { type: Object as PropType<WastewaterExport>, required: true },
    topology: { type: Object as PropType<unknown>, required: false },
    locale: { type: String as PropType<Locale>, required: true },
    /** entry path of the page, for the links to the region pages */
    path: { type: String, required: true },
  },
  data() {
    return { pathogen: 'sars' as WastewaterPathogen };
  },
  computed: {
    weekLabel(): string {
      return this.$t('weekShort', { week: isoWeekNumber(this.wastewater.last_week) });
    },
    dataLine(): string {
      return this.$t('pages.index.wastewater.dataLine', {
        week: this.weekLabel,
        data: formatDate(this.wastewater.data_version, this.locale),
      });
    },
    pathogenOptions(): Array<{ value: WastewaterPathogen; label: string }> {
      return WASTEWATER_PATHOGENS.map((value) => ({
        value,
        label: this.$t(`pages.index.wastewater.pathogens.${value}`),
      }));
    },
    entries(): PathogenEntry[] {
      return pathogenEntries(this.wastewater.sites, this.pathogen, this.wastewater.last_week);
    },
    points(): MapPoint[] {
      const out: MapPoint[] = [];
      for (const e of this.entries) {
        const { lat, lon } = e.site;
        if (lat === null || lon === null) continue;
        const week = this.weekShort(e.record.last_week);
        out.push({
          id: e.site.id,
          lat,
          lon,
          name: e.site.name,
          label: e.current
            ? this.$t('pages.index.wastewater.point.label', { p: percentPoints(e.record.percentile), week })
            : this.$t('pages.index.wastewater.point.stale', { week }),
          level: pointLevel(e.record, this.wastewater.last_week),
        });
      }
      // Plants without current data would only add clutter; they are counted in the note below the map.
      return out.filter((p) => p.level !== 'none');
    },
    hiddenCount(): number {
      return this.entries.length - this.points.length;
    },
    topRows(): TopRow[] {
      return topByPercentile(this.entries, 10).map((e) => ({
        id: e.site.id,
        name: e.site.name,
        state: this.stateName(e.site.region),
        percentile: percentPoints(e.record.percentile),
        trend: trendSymbol(e.record.trend),
        trendText: this.$t(`pages.index.wastewater.trend.${e.record.trend}`),
      }));
    },
    mapLabels(): GermanyMapLabels {
      const t = (key: string): string => this.$t(`pages.index.wastewater.map.${key}`);
      return {
        title: t('title'),
        legendTitle: '',
        legendLow: '',
        legendHigh: '',
        noData: t('neutral'),
        showTable: t('summary'),
        tableRegion: t('tableSite'),
        tableValue: t('tableValue'),
        levels: { normal: '', elevated: '', high: '' },
      };
    },
    pointsLegend(): MapPointsLegend {
      const t = (key: string): string => this.$t(`pages.index.wastewater.map.${key}`);
      return { title: t('pointsTitle'), low: t('low'), medium: t('medium'), high: t('high'), none: t('none') };
    },
    pointsTableLabels(): MapPointsTableLabels {
      const t = (key: string): string => this.$t(`pages.index.wastewater.map.${key}`);
      return { name: t('tableSite'), value: t('tableValue'), summary: t('summary') };
    },
    mapIntro(): string {
      return this.$t('pages.index.wastewater.map.intro');
    },
    notes(): string[] {
      return [
        this.$t('pages.index.wastewater.percentile'),
        this.$t('pages.index.wastewater.stale'),
        this.$t('pages.index.wastewater.positions'),
      ];
    },
  },
  methods: {
    weekShort(week: IsoWeek): string {
      return this.$t('weekShort', { week: isoWeekNumber(week) });
    },
    stateName(id: string): string {
      const info = regionById(id);
      if (!info) return id;
      return this.locale === 'en' ? info.name_en : info.name_de;
    },
    goRegion(id: string): void {
      window.location.href = pageHref(this.path, { page: 'region', locale: this.locale, region: id });
    },
    choose(value: WastewaterPathogen): void {
      this.pathogen = value;
    },
  },
});
</script>

<template>
  <div class="space-y-5">
    <div class="max-w-3xl space-y-2">
      <p>{{ $t('pages.index.wastewater.intro') }}</p>
      <p>{{ $t('pages.index.wastewater.timing') }}</p>
      <ul class="list-disc space-y-1 pl-5 text-sm cf-muted">
        <li v-for="note in notes" :key="note">{{ note }}</li>
      </ul>
    </div>
    <p class="text-sm cf-muted">{{ dataLine }}</p>

    <fieldset class="space-y-2">
      <legend class="mb-2 text-sm font-semibold">{{ $t('pages.index.wastewater.pathogenLegend') }}</legend>
      <div class="grid gap-2 sm:grid-cols-3">
        <label
          v-for="o in pathogenOptions"
          :key="o.value"
          class="flex cursor-pointer items-center gap-2 rounded-lg border border-[var(--cf-border)] bg-[var(--cf-bg)] px-3 py-2 has-checked:border-[var(--cf-accent)] has-checked:font-semibold"
        >
          <input
            type="radio"
            name="cf-wastewater-pathogen"
            class="h-4 w-4 accent-[var(--cf-accent)]"
            :value="o.value"
            :checked="pathogen === o.value"
            @change="choose(o.value)"
          />
          <span>{{ o.label }}</span>
        </label>
      </div>
    </fieldset>

    <p class="max-w-3xl text-sm">{{ mapIntro }}</p>
    <div class="grid items-start gap-6 md:grid-cols-2">
      <div class="cf-card min-w-0">
        <GermanyMap
          v-if="topology"
          :topology="topology"
          :values="[]"
          :labels="mapLabels"
          :selected="null"
          :source-line="wastewater.attribution"
          :points="points"
          :points-legend="pointsLegend"
          :points-table-labels="pointsTableLabels"
          :show-scale="false"
          :show-state-table="false"
          :plain-states="true"
          @select="goRegion"
        />
      </div>
      <div class="cf-card min-w-0 space-y-3">
        <h3 class="text-base font-semibold">{{ $t('pages.index.wastewater.top.heading') }}</h3>
        <p class="text-sm cf-muted">{{ $t('pages.index.wastewater.top.intro') }}</p>
        <div v-if="topRows.length" class="overflow-x-auto">
          <table class="w-full border-collapse text-xs sm:text-sm">
            <thead>
              <tr class="text-left">
                <th scope="col" class="border-b border-[var(--cf-border)] px-1.5 py-2 sm:px-2">{{ $t('pages.index.wastewater.top.site') }}</th>
                <th scope="col" class="border-b border-[var(--cf-border)] px-1.5 py-2 sm:px-2">{{ $t('pages.index.wastewater.top.state') }}</th>
                <th scope="col" class="border-b border-[var(--cf-border)] px-1.5 py-2 sm:px-2 text-right">{{ $t('pages.index.wastewater.top.percentile') }}</th>
                <th scope="col" class="border-b border-[var(--cf-border)] px-1.5 py-2 sm:px-2">{{ $t('pages.index.wastewater.top.trend') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="r in topRows" :key="r.id">
                <th scope="row" class="border-b border-[var(--cf-border)] px-1.5 py-2 sm:px-2 text-left font-medium">{{ r.name }}</th>
                <td class="border-b border-[var(--cf-border)] px-1.5 py-2 sm:px-2">{{ r.state }}</td>
                <td class="border-b border-[var(--cf-border)] px-1.5 py-2 sm:px-2 text-right tabular-nums">{{ r.percentile }}</td>
                <td class="border-b border-[var(--cf-border)] px-1.5 py-2 sm:px-2 whitespace-nowrap">
                  <span aria-hidden="true">{{ r.trend }}</span>
                  <span class="sr-only">{{ r.trendText }}</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p v-else class="text-sm cf-muted">{{ $t('pages.index.wastewater.top.empty') }}</p>
      </div>
    </div>
    <p v-if="hiddenCount" class="text-sm cf-muted">{{ $t('pages.index.wastewater.hidden', { n: hiddenCount }) }}</p>
  </div>
</template>
