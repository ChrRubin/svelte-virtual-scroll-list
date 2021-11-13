/**
 * virtual list core calculating center
 */

 const DIRECTION_TYPE = {
    FRONT: "FRONT", // scroll up or left
    BEHIND: "BEHIND", // scroll down or right
}
const CALC_TYPE = {
    INIT: "INIT",
    FIXED: "FIXED",
    DYNAMIC: "DYNAMIC",
}
const LEADING_BUFFER = 2

interface Param {
    [x: string]: any
    slotHeaderSize: number
    keeps: number
    uniqueIds: any[]
    buffer: number
    estimateSize: number
}

type CallUpdate = (range: Range) => void

export interface Range {
    start: number
    end: number
    padFront: number
    padBehind: number
}

export class Virtual {
    param
    callUpdate
    firstRangeTotalSize?
    firstRangeAverageSize
    lastCalcIndex
    fixedSizeValue?
    calcType
    offset
    direction
    range: Range
    sizes

    constructor(param: Param, callUpdate: CallUpdate) {
        // param data
        this.param = param
        this.callUpdate = callUpdate

        // size data
        this.sizes = new Map()
        this.firstRangeTotalSize = 0
        this.firstRangeAverageSize = 0
        this.lastCalcIndex = 0
        this.fixedSizeValue = 0
        this.calcType = CALC_TYPE.INIT

        // scroll data
        this.offset = 0
        this.direction = ""

        // range data
        this.range = Object.create(null)
        if (param) {
            this.checkRange(0, param.keeps - 1)
        }

        // benchmark example data
        // this.__bsearchCalls = 0
        // this.__getIndexOffsetCalls = 0
    }

    isBehind(): boolean {
        return this.direction === DIRECTION_TYPE.BEHIND
    }

    isFront(): boolean {
        return this.direction === DIRECTION_TYPE.FRONT
    }

    // return start index offset
    getOffset(start: number): number {
        return (start < 1 ? 0 : this.getIndexOffset(start)) + this.param.slotHeaderSize
    }

    updateParam(key: string, value: any): void {
        if (this.param && (key in this.param)) {
            // if uniqueIds change, find out deleted id and remove from size map
            if (key === "uniqueIds") {
                this.sizes.forEach((v, key) => {
                    if (!value.includes(key)) {
                        this.sizes.delete(key)
                    }
                })
            }
            this.param[key] = value
        }
    }

    // save each size map by id
    saveSize(id: any, size: number): void {
        this.sizes.set(id, size)

        // we assume size type is fixed at the beginning and remember first size value
        // if there is no size value different from this at next coming saving
        // we think it's a fixed size list, otherwise is dynamic size list
        if (this.calcType === CALC_TYPE.INIT) {
            this.fixedSizeValue = size
            this.calcType = CALC_TYPE.FIXED
        } else if (this.calcType === CALC_TYPE.FIXED && this.fixedSizeValue !== size) {
            this.calcType = CALC_TYPE.DYNAMIC
            // it's no use at all
            delete this.fixedSizeValue
        }

        // calculate the average size only in the first range
        if (this.calcType !== CALC_TYPE.FIXED && typeof this.firstRangeTotalSize !== "undefined") {
            if (this.sizes.size < Math.min(this.param.keeps, this.param.uniqueIds.length)) {
                this.firstRangeTotalSize = [...this.sizes.values()].reduce((acc, val) => acc + val, 0)
                this.firstRangeAverageSize = Math.round(this.firstRangeTotalSize ?? 0 / this.sizes.size)
            } else {
                // it's done using
                delete this.firstRangeTotalSize
            }
        }
    }

    // in some special situation (e.g. length change) we need to update in a row
    // try going to render next range by a leading buffer according to current direction
    handleDataSourcesChange(): void {
        let start = this.range.start

        if (this.isFront()) {
            start = start - LEADING_BUFFER
        } else if (this.isBehind()) {
            start = start + LEADING_BUFFER
        }

        start = Math.max(start, 0)

        this.updateRange(this.range.start, this.getEndByStart(start))
    }

    // when slot size change, we also need force update
    handleSlotSizeChange(): void {
        this.handleDataSourcesChange()
    }

    // calculating range on scroll
    handleScroll(offset: number): void {
        this.direction = offset < this.offset ? DIRECTION_TYPE.FRONT : DIRECTION_TYPE.BEHIND
        this.offset = offset

        if (!this.param) {
            return
        }

        if (this.direction === DIRECTION_TYPE.FRONT) {
            this.handleFront()
        } else if (this.direction === DIRECTION_TYPE.BEHIND) {
            this.handleBehind()
        }
    }

    // ----------- public method end -----------

    private handleFront(): void {
        const overs = this.getScrollOvers()
        // should not change range if start doesn't exceed overs
        if (overs > this.range.start) {
            return
        }

        // move up start by a buffer length, and make sure its safety
        const start = Math.max(overs - this.param.buffer, 0)
        this.checkRange(start, this.getEndByStart(start))
    }

    private handleBehind(): void {
        const overs = this.getScrollOvers()
        // range should not change if scroll overs within buffer
        if (overs < this.range.start + this.param.buffer) {
            return
        }

        this.checkRange(overs, this.getEndByStart(overs))
    }

    // return the pass overs according to current scroll offset
    private getScrollOvers(): number {
        // if slot header exist, we need subtract its size
        const offset = this.offset - this.param.slotHeaderSize
        if (offset <= 0) {
            return 0
        }

        // if is fixed type, that can be easily
        if (this.isFixedType() && this.fixedSizeValue != null) {
            return Math.floor(offset / this.fixedSizeValue)
        }

        let low = 0
        let middle = 0
        let middleOffset = 0
        let high = this.param.uniqueIds.length

        while (low <= high) {
            // this.__bsearchCalls++
            middle = low + Math.floor((high - low) / 2)
            middleOffset = this.getIndexOffset(middle)

            if (middleOffset === offset) {
                return middle
            } else if (middleOffset < offset) {
                low = middle + 1
            } else if (middleOffset > offset) {
                high = middle - 1
            }
        }

        return low > 0 ? --low : 0
    }

    // return a scroll offset from given index, can efficiency be improved more here?
    // although the call frequency is very high, its only a superposition of numbers
    private getIndexOffset(givenIndex: number): number {
        if (!givenIndex) {
            return 0
        }

        let offset = 0
        let indexSize = 0
        for (let index = 0; index < givenIndex; index++) {
            // this.__getIndexOffsetCalls++
            indexSize = this.sizes.get(this.param.uniqueIds[index])
            offset = offset + (typeof indexSize === "number" ? indexSize : this.getEstimateSize())
        }

        // remember last calculate index
        this.lastCalcIndex = Math.max(this.lastCalcIndex, givenIndex - 1)
        this.lastCalcIndex = Math.min(this.lastCalcIndex, this.getLastIndex())

        return offset
    }

    // is fixed size type
    private isFixedType(): boolean {
        return this.calcType === CALC_TYPE.FIXED
    }

    // return the real last index
    private getLastIndex(): number {
        return this.param.uniqueIds.length - 1
    }

    // in some conditions range is broke, we need correct it
    // and then decide whether need update to next range
    private checkRange(start: number, end: number): void {
        const keeps = this.param.keeps
        const total = this.param.uniqueIds.length

        // data less than keeps, render all
        if (total <= keeps) {
            start = 0
            end = this.getLastIndex()
        } else if (end - start < keeps - 1) {
            // if range length is less than keeps, correct it base on end
            start = end - keeps + 1
        }

        if (this.range.start !== start) {
            this.updateRange(start, end)
        }
    }

    // setting to a new range and rerender
    private updateRange(start: number, end: number): void {
        this.range.start = start
        this.range.end = end
        this.range.padFront = this.getPadFront()
        this.range.padBehind = this.getPadBehind()
        this.callUpdate(this.range)
    }

    // return end base on start
    private getEndByStart(start: number): number {
        const theoryEnd = start + this.param.keeps - 1
        const truelyEnd = Math.min(theoryEnd, this.getLastIndex())
        return truelyEnd
    }

    // return total front offset
    private getPadFront(): number {
        if (this.isFixedType() && this.fixedSizeValue != null) {
            return this.fixedSizeValue * this.range.start
        } else {
            return this.getIndexOffset(this.range.start)
        }
    }

    // return total behind offset
    private getPadBehind(): number {
        const end = this.range.end
        const lastIndex = this.getLastIndex()

        if (this.isFixedType() && this.fixedSizeValue != null) {
            return (lastIndex - end) * this.fixedSizeValue
        }

        // if it's all calculated, return the exactly offset
        if (this.lastCalcIndex === lastIndex) {
            return this.getIndexOffset(lastIndex) - this.getIndexOffset(end)
        } else {
            // if not, use a estimated value
            return (lastIndex - end) * this.getEstimateSize()
        }
    }

    // get the item estimate size
    private getEstimateSize(): number {
        return this.isFixedType() ? (this.fixedSizeValue ?? 0) : (this.firstRangeAverageSize || this.param.estimateSize)
    }
}
