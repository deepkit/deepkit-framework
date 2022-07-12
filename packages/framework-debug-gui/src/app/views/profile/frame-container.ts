import { BrowserText } from '@deepkit/desktop-ui';
import { Container, Graphics, Sprite, Text, Texture } from 'pixi.js';
import { defaultColors, frameColors, FrameItem } from './frame.js';

export class TextCalc {
    static browserText?: BrowserText;

    static get(): BrowserText {
        if (!TextCalc.browserText) TextCalc.browserText = new BrowserText;
        return TextCalc.browserText;
    }
}

export class FrameContainer extends Container {
    public rectangle: Graphics;
    public text: Container;
    public title: Text;

    // protected textDimensions: { width: number, height: number };
    protected paintOverTextOverflow: Sprite;

    protected textStyle = {
        fontSize: 12,
        fill: 0xffffff
    };

    protected itemHeight: number = 20;

    constructor(
        public item: FrameItem,
        public offset: number,
        public viewState: { zoom: number, scrollX: number },
    ) {
        super();
        this.rectangle = new Graphics();
        this.addChild(this.rectangle);

        this.text = new Container();
        this.addChild(this.text);
        // this.drawBg();

        // TextCalc.get().fontSize = 12;
        // this.textDimensions = TextCalc.get().getDimensions(item.frame.label);

        this.title = new Text(item.frame.label, this.textStyle);
        this.title.y = 3.5;
        this.title.x = 3.5;
        // this.updatePosition();
        this.text.addChild(this.title);

        //since we can not truncate the text in any performant way, we simply paint over the part of the text that is overflowing.
        //we had mask before that, which was way too slow
        this.paintOverTextOverflow = Sprite.from(Texture.WHITE);
        this.paintOverTextOverflow.x = 55;
        this.paintOverTextOverflow.width = 1000;
        this.paintOverTextOverflow.height = this.itemHeight;
        this.paintOverTextOverflow.tint = 0x222222;
        this.addChild(this.paintOverTextOverflow);

        this.update();
    }

    get frameWidth(): number {
        return Math.ceil(this.item.took / this.viewState.zoom);
    }

    protected updatePosition() {
        const x = (this.item.x - this.offset - this.viewState.scrollX) / this.viewState.zoom;
        this.x = x + .5;
        this.y = (this.item.y * 25) + 0.5;
    }

    protected drawBg() {
        this.rectangle.clear();
        const colors = frameColors[this.item.frame.category] || defaultColors;
        this.rectangle.beginFill(colors.bg);
        this.rectangle.lineStyle(1, colors.border);
        this.rectangle.drawRect(0, 0, this.frameWidth, this.itemHeight);
        this.rectangle.endFill();
    }

    update() {
        this.updatePosition();
        this.drawBg();

        // if (this.frameWidth < 10) {
        //     this.paintOverTextOverflow.visible = false;
        //     this.text.visible = false;
        // } else {
        //     this.text.visible = true;
            // if (this.text.width > this.frameWidth) {
        //         this.paintOverTextOverflow.visible = true;
        //     this.paintOverTextOverflow.visible = false;
        this.paintOverTextOverflow.x = this.frameWidth;

        // if (this.itemHeight === 20) {
        //     console.log('this.paintOverTextOverflow.x', this.paintOverTextOverflow.x, this.item.frame.label);
        // }

        //         this.paintOverTextOverflow.width = (this.text.width - this.frameWidth) + 3;
        //     } else {
        //         this.paintOverTextOverflow.visible = false;
        //     }
        // }
        // this.text.width = this.frameWidth;
        // this.mask.width = this.frameWidth;
        // this.mask.height = 20;
    }
}
