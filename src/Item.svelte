<script lang="ts">
    import {afterUpdate, createEventDispatcher, onDestroy, onMount} from "svelte"

    export let horizontal = false
    export let uniqueKey: string
    export let type = "item"

    let resizeObserver: ResizeObserver | null
    let itemDiv: HTMLDivElement
    let previousSize: number

    const dispatch = createEventDispatcher()
    const shapeKey = horizontal ? "offsetWidth" : "offsetHeight"

    interface $$Events {
        resize: CustomEvent<{
            id: string
            size: number
            type: string
        }>
    }

    onMount(() => {
        if (typeof ResizeObserver !== "undefined") {
            resizeObserver = new ResizeObserver(dispatchSizeChange)
            resizeObserver.observe(itemDiv)
        }
    })
    afterUpdate(dispatchSizeChange)
    onDestroy(() => {
        if (resizeObserver) {
            resizeObserver.disconnect()
            resizeObserver = null
        }
    })

    function dispatchSizeChange() {
        const size = itemDiv ? itemDiv[shapeKey] : 0
        if (size === previousSize) return
        previousSize = size
        dispatch("resize", {id: uniqueKey, size, type})
    }
</script>

<div bind:this={itemDiv} class="virtual-scroll-item">
    <slot/>
</div>
