<script lang="ts">
    import {Virtual} from "./virtual"
    import type {Range} from "./virtual"
    import Item from "./Item.svelte"
    import {createEventDispatcher, onDestroy, onMount} from "svelte"

    type T = $$Generic<Record<string, any>>

    interface $$Events {
        scroll: CustomEvent<{
            event: Event
            range: Range
        }>
        top: CustomEvent<undefined>
        bottom: CustomEvent<undefined>
    }

    interface $$Slots {
        default: {
            data: T
        }
    }

    /**
     * Unique key for getting data from `data`
     */
    export let key = "id"
    /**
     * Source for list
     */
    export let data: T[]
    /**
     * Count of rendered items
     */
    export let keeps = 30
    /**
     * Estimate size of each item, needs for smooth scrollbar
     */
    export let estimateSize = 50
    /**
     * Scroll direction
     */
    export let isHorizontal = false
    /**
     * scroll position start index
     */
    export let start = 0
    /**
     * scroll position offset
     */
    export let offset = 0
    /**
     * Let virtual list using global document to scroll through the list
     */
    export let pageMode = false
    /**
     * The threshold to emit `top` event, attention to multiple calls.
     */
    export let topThreshold = 0
    /**
     * The threshold to emit `bottom` event, attention to multiple calls.
     */
    export let bottomThreshold = 0

    let displayItems: T[] = []
    let paddingStyle: string
    let directionKey: "scrollLeft" | "scrollTop" = isHorizontal ? "scrollLeft" : "scrollTop"
    let range = null
    let virtual = new Virtual({
        slotHeaderSize: 0,
        slotFooterSize: 0,
        keeps: keeps,
        estimateSize: estimateSize,
        buffer: Math.round(keeps / 3), // recommend for a third of keeps
        uniqueIds: getUniqueIdFromDataSources(),
    }, onRangeChanged)
    let root: HTMLDivElement
    let shepherd: HTMLDivElement
    const dispatch = createEventDispatcher()

    export function getSize(id: number): number {
        return virtual.sizes.get(id)
    }

    /**
     * Count of items
     */
    export function getSizes(): number {
        return virtual.sizes.size
    }

    export function getOffset(): number {
        if (pageMode) {
            return document.documentElement[directionKey] || document.body[directionKey]
        } else {
            return root ? Math.ceil(root[directionKey]) : 0
        }
    }

    export function getClientSize(): number {
        const key = isHorizontal ? "clientWidth" : "clientHeight"
        if (pageMode) {
            return document.documentElement[key] || document.body[key]
        } else {
            return root ? Math.ceil(root[key]) : 0
        }
    }

    export function getScrollSize(): number {
        const key = isHorizontal ? "scrollWidth" : "scrollHeight"
        if (pageMode) {
            return document.documentElement[key] || document.body[key]
        } else {
            return root ? Math.ceil(root[key]) : 0
        }
    }

    export function updatePageModeFront() {
        if (root) {
            const rect = root.getBoundingClientRect()
            const {defaultView} = root.ownerDocument
            if (!defaultView) return
            const offsetFront = isHorizontal ? (rect.left + defaultView.pageXOffset) : (rect.top + defaultView.pageYOffset)
            virtual.updateParam("slotHeaderSize", offsetFront)
        }
    }

    export function scrollToOffset(offset: number) {
        if (pageMode) {
            document.body[directionKey] = offset
            document.documentElement[directionKey] = offset
        } else if (root) {
            root[directionKey] = offset
        }
    }

    export function scrollToIndex(index: number) {
        if (index >= data.length - 1) {
            scrollToBottom()
        } else {
            const offset = virtual.getOffset(index)
            scrollToOffset(offset)
        }
    }

    export function scrollToBottom() {
        if (shepherd) {
            const offset = shepherd[isHorizontal ? "offsetLeft" : "offsetTop"]
            scrollToOffset(offset)

            // check if it's really scrolled to the bottom
            // maybe list doesn't render and calculate to last range
            // so we need retry in next event loop until it really at bottom
            setTimeout(() => {
                if (getOffset() + getClientSize() + 1 < getScrollSize()) {
                    scrollToBottom()
                }
            }, 3)
        }
    }

    onMount(() => {
        if (start) {
            scrollToIndex(start)
        } else if (offset) {
            scrollToOffset(offset)
        }

        if (pageMode) {
            updatePageModeFront()

            document.addEventListener("scroll", onScroll, {
                passive: false,
            })
        }
    })

    onDestroy(() => {
        // virtual.destroy()
        if (pageMode) {
            document.removeEventListener("scroll", onScroll)
        }
    })

    function getUniqueIdFromDataSources() {
        return data.map((dataSource) => dataSource[key])
    }

    function onItemResized(event: CustomEvent<{id: string, size: number, type: string}>) {
        const {id, size, type} = event.detail
        if (type === "item")
            virtual.saveSize(id, size)
        else if (type === "slot") {
            if (id === "header")
                virtual.updateParam("slotHeaderSize", size)
            else if (id === "footer")
                virtual.updateParam("slotFooterSize", size)

            // virtual.handleSlotSizeChange()
        }
    }

    function onRangeChanged(range_: Range) {
        range = range_
        paddingStyle = paddingStyle = isHorizontal ? `0px ${range.padBehind}px 0px ${range.padFront}px` : `${range.padFront}px 0px ${range.padBehind}px`
        displayItems = data.slice(range.start, range.end + 1)
    }

    function onScroll(event: Event) {
        const offset = getOffset()
        const clientSize = getClientSize()
        const scrollSize = getScrollSize()

        // iOS scroll-spring-back behavior will make direction mistake
        if (offset < 0 || (offset + clientSize > scrollSize + 1) || !scrollSize) {
            return
        }

        virtual.handleScroll(offset)
        emitEvent(offset, clientSize, scrollSize, event)
    }

    function emitEvent(offset: number, clientSize: number, scrollSize: number, event: Event) {
        dispatch("scroll", {event, range: virtual.range})

        if (virtual.isFront() && !!data.length && (offset - topThreshold <= 0)) {
            dispatch("top")
        } else if (virtual.isBehind() && (offset + clientSize + bottomThreshold >= scrollSize)) {
            dispatch("bottom")
        }
    }

    $: scrollToOffset(offset)
    $: scrollToIndex(start)
    $: handleKeepsChange(keeps)

    function handleKeepsChange(keeps: number) {
        virtual.updateParam("keeps", keeps)
        virtual.handleSlotSizeChange()
    }

    $: handleDataSourcesChange(data)

    async function handleDataSourcesChange(data: T[]) {
        virtual.updateParam("uniqueIds", getUniqueIdFromDataSources())
        virtual.handleDataSourcesChange()
    }
</script>

<div bind:this={root} on:scroll={onScroll} style="overflow-y: auto; height: inherit">
    {#if $$slots.header}
        <Item on:resize={onItemResized} type="slot" uniqueKey="header">
            <slot name="header"/>
        </Item>
    {/if}
    <div style="padding: {paddingStyle}">
        {#each displayItems as data (data[key])}
            <Item
                    on:resize={onItemResized}
                    uniqueKey={data[key]}
                    horizontal={isHorizontal}
                    type="item">
                <slot {data}/>
            </Item>
        {/each}
    </div>
    {#if $$slots.footer}
        <Item on:resize={onItemResized} type="slot" uniqueKey="footer">
            <slot name="footer"/>
        </Item>
    {/if}
    <div bind:this={shepherd} class="shepherd"
         style="width: {isHorizontal ? '0px' : '100%'};height: {isHorizontal ? '100%' : '0px'}"></div>
</div>
