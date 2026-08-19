import { routes } from '@/router/index.js';

import type { NavGroup, NavLayoutSettings } from '@shared/types';
import type { Component } from 'vue';
import type { RouteRecordRaw } from 'vue-router';

export type NavLayoutGroup = NavGroup | 'settings';

export const NAV_GROUPS: NavGroup[] = ['main', 'manage', 'system'];
export const ALL_NAV_GROUPS: NavLayoutGroup[] = ['main', 'manage', 'system', 'settings'];

const DEFAULT_COLLAPSIBLE: Record<NavLayoutGroup, boolean> = { main: false, manage: false, system: true, settings: true };

export interface NavLayoutEntry {
  route: RouteRecordRaw;
  name: string;
  labelKey: string;
  to: string;
  icon: Component;
  activeIcon: Component;
  defaultGroup: NavLayoutGroup;
  kind: 'page' | 'settings';
}

function defaultGroup(route: RouteRecordRaw): NavGroup {
  if (route.meta?.navbar?.position === 'top') return 'main';
  return route.meta?.navbar?.group ?? 'main';
}

export function useNavLayout() {
  const authStore = useAuthStore();
  const { user } = storeToRefs(authStore);

  const layout = computed<NavLayoutSettings>(() => user.value?.navLayout ?? {});

  const entries = computed<NavLayoutEntry[]>(() => {
    const out: NavLayoutEntry[] = [];

    for (const route of routes) {
      if (!route.meta?.navbar || (route.meta.navbar.position !== 'top' && !route.meta.navbar.group) || !hasPermission(route)) continue;
      out.push({
        route,
        name: route.name as string,
        labelKey: (route.name as string).toLowerCase(),
        to: route.path,
        icon: route.meta.navbar.icon.default as unknown as Component,
        activeIcon: route.meta.navbar.icon.active as unknown as Component,
        defaultGroup: defaultGroup(route),
        kind: 'page',
      });
    }

    const settings = routes.find((route) => route.name === 'Settings');
    for (const route of settings?.children ?? []) {
      if (!route.meta?.settingsBar || !hasPermission(route)) continue;
      out.push({
        route,
        name: route.name as string,
        labelKey: route.meta.name as string,
        to: `/settings/${route.path}`,
        icon: route.meta.settingsBar.icon.default as unknown as Component,
        activeIcon: route.meta.settingsBar.icon.active as unknown as Component,
        defaultGroup: 'settings',
        kind: 'settings',
      });
    }

    return out;
  });

  const groups = computed<Record<NavLayoutGroup, NavLayoutEntry[]>>(() => {
    const byName = new Map(entries.value.map((entry) => [entry.name, entry]));
    const out: Record<NavLayoutGroup, NavLayoutEntry[]> = { main: [], manage: [], system: [], settings: [] };
    const placed = new Set<string>();

    for (const group of ALL_NAV_GROUPS) {
      for (const name of layout.value.order?.[group] ?? []) {
        const entry = byName.get(name);
        if (!entry || placed.has(name)) continue;
        out[group].push(entry);
        placed.add(name);
      }
    }
    for (const entry of entries.value) {
      if (!placed.has(entry.name)) out[entry.defaultGroup].push(entry);
    }
    return out;
  });

  const hidden = computed<Set<string>>(() => new Set(layout.value.hidden ?? []));

  const settingsInNav = computed(() => layout.value.settingsInNav ?? false);

  function patchLayout(patch: Partial<NavLayoutSettings>): void {
    if (!user.value) return;
    const next: NavLayoutSettings = { ...layout.value, ...patch };
    for (const key of Object.keys(next) as (keyof NavLayoutSettings)[]) {
      if (next[key] === undefined) delete next[key];
    }
    if (next.order && Object.keys(next.order).length === 0) delete next.order;
    if (next.collapsible && Object.keys(next.collapsible).length === 0) delete next.collapsible;
    if (next.hidden && next.hidden.length === 0) delete next.hidden;
    if (!next.settingsInNav) delete next.settingsInNav;

    const value = Object.keys(next).length ? next : null;
    user.value = { ...user.value, navLayout: value };
    authStore.updateUser({ preferences: { navLayout: value } });
  }

  function isCollapsible(group: NavLayoutGroup): boolean {
    return layout.value.collapsible?.[group] ?? DEFAULT_COLLAPSIBLE[group];
  }

  function setCollapsible(group: NavLayoutGroup, value: boolean): void {
    const collapsible = { ...layout.value.collapsible };
    if (value === DEFAULT_COLLAPSIBLE[group]) {
      delete collapsible[group];
    } else {
      collapsible[group] = value;
    }
    patchLayout({ collapsible });
  }

  function setSettingsInNav(value: boolean): void {
    patchLayout({ settingsInNav: value });
  }

  function isHidden(name: string): boolean {
    return hidden.value.has(name);
  }

  function toggleHidden(name: string): void {
    const next = new Set(hidden.value);
    if (next.has(name)) {
      next.delete(name);
    } else {
      next.add(name);
    }
    patchLayout({ hidden: [...next] });
  }

  function persistOrder(lists: Record<NavLayoutGroup, string[]>): void {
    const order = { main: [...lists.main], manage: [...lists.manage], system: [...lists.system], settings: [...lists.settings] };
    const current = layout.value.order;
    const unchanged =
      current &&
      ALL_NAV_GROUPS.every((group) => {
        const previous = current[group] ?? [];
        return previous.length === order[group].length && previous.every((name, index) => name === order[group][index]);
      });
    if (unchanged) return;
    patchLayout({ order });
  }

  function resetOrder(): void {
    patchLayout({ order: undefined, hidden: undefined });
  }

  return {
    entries,
    groups,
    settingsInNav,
    isCollapsible,
    isHidden,
    toggleHidden,
    setCollapsible,
    setSettingsInNav,
    persistOrder,
    resetOrder,
  };
}
