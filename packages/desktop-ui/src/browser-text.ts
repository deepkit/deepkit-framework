
export class BrowserText {
    protected canvas = document.createElement('canvas');

    protected context = this.canvas.getContext('2d')!;

    constructor(public fontSize: number = 11, public fontFamily: string = getComputedStyle(document.body).fontFamily) {
        document.body.appendChild(this.canvas);
    }

    destroy() {
        document.body.removeChild(this.canvas);
    }

    getDimensions(text: string) {
        this.context.font = this.fontSize + 'px ' + this.fontFamily;
        const m = this.context.measureText(text);
        return {
            width: m.width,
            height: m.actualBoundingBoxAscent + m.actualBoundingBoxDescent
        };
    }
}