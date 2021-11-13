import { SvelteComponentTyped } from "svelte";
import type { Range } from "./virtual"

export interface VirtualScrollProps<T> {
  key: string;
  data: T[];
  keeps: number;
  estimateSize: number;
  isHorizontal: boolean;
  start: number;
  offset: number;
  pageMode: boolean;
  topThreshold: number;
  bottomThreshold: number;
}

export interface VirtualScrollEvents {
  scroll: CustomEvent<{
    event: Event
    range: Range
  }>
  top: CustomEvent<undefined>
  bottom: CustomEvent<undefined>
}

export interface VirtualScrollSlots<T> {
  default: {
    data: T
  }
}

export default class VirtualScroll<T> extends SvelteComponentTyped<
  VirtualScrollProps<T>,
  VirtualScrollEvents,
  VirtualScrollSlots<T>
> {}
