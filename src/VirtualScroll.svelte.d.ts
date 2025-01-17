import { SvelteComponentTyped } from "svelte"

interface Range {
  start: number
  end: number
  padFront: number
  padBehind: number
}

export interface VirtualScrollProps<T> {
  /** Unique key for getting data from `data` */
  key: string
  /** Source for list */
  data: T[]
  /** Count of rendered items */
  keeps?: number
  /** Estimate size of each item, needs for smooth scrollbar */
  estimateSize?: number
  /** Scroll direction */
  isHorizontal?: boolean
  /** scroll position start index */
  start?: number
  /** scroll position offset */
  offset?: number
  /** Let virtual list using global document to scroll through the list */
  pageMode?: boolean
  /** The threshold to emit `top` event, attention to multiple calls. */
  topThreshold?: number
  /** The threshold to emit `bottom` event, attention to multiple calls. */
  bottomThreshold?: number
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
> {
  getSize(id: number): number
  /** Count of items */
  getSizes(): number
  getOffset(): number
  getClientSize(): number
  getScrollSize(): number
  updatePageModeFront(): void
  scrollToOffset(offset: number): void
  scrollToIndex(index: number): void
  scrollToBottom(): void
}
