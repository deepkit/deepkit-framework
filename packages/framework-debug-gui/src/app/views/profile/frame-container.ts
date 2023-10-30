import { BrowserText } from '@deepkit/desktop-ui';
import { Container, Graphics, Sprite, Text, Texture } from 'pixi.js';
import { Crunch, defaultColors, formatTime, frameColors, FrameItem, getCrunchXCanvas, getFrameWidth, getFrameXCanvas, ViewState } from './frame';

export class TextCalc {
    static browserText?: BrowserText;

    static get(): BrowserText {
        if (!TextCalc.browserText) TextCalc.browserText = new BrowserText;
        return TextCalc.browserText;
    }
}

export class CrunchContainer extends Container {
    public rectangle: Graphics;
    protected textStyle = {
        fontSize: 12,
        fill: 0xffffff
    };
    public title: Text;
    protected itemHeight: number = 20;

    constructor(
        public item: Crunch,
        public viewState: ViewState,
    ) {
        super();
        this.rectangle = new Graphics();
        this.addChild(this.rectangle);

        this.title = new Text(formatTime(item.crunch), this.textStyle);
        // console.log('newCrunchContainer', item);
        this.title.y = 3.5;
        this.title.x = 10.5;
        this.addChild(this.title);
    }

    update() {
        this.rectangle.clear();
        // this.rectangle.beginFill(colors.bg)
        const padding = 3;

        this.rectangle
            .lineStyle(1, 0x444444)
            .moveTo(0, 1500)
            .lineTo(0, -1500)
            .lineStyle(1, 0x49497A)
            .moveTo(10 + padding, 0)
            .lineTo(0 + padding, 10)
            .lineTo(10 + padding, 20)
            .moveTo(0 + padding, 10)
            .lineTo(Math.max(0, this.frameWidth - padding), 10)
            .lineTo(Math.max(0, this.frameWidth - 10 - padding), 0)
            .moveTo(Math.max(0, this.frameWidth - padding), 10)
            .lineTo(Math.max(0, this.frameWidth - 10 - padding), 20)
        ;

        // this.rectangle.lineStyle(1, 0x49497A);
        // this.rectangle.drawRect(0, 0, this.frameWidth - 2, this.itemHeight);
        this.rectangle.endFill();

        this.x = getCrunchXCanvas(this.item, this.viewState) + 0.5;
        this.y = (this.item.y * 25) + 0.5;

        this.title.x = Math.max(0, (this.frameWidth / 2) - (this.title.width / 2) + 0.5);
    }

    get frameWidth(): number {
        return Math.ceil((80)) - 0.5;
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
        public viewState: ViewState,
    ) {
        super();
        this.rectangle = new Graphics();
        this.addChild(this.rectangle);

        // console.log('new FrameContainer', item.frame.label);
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
        return getFrameWidth(this.item, this.viewState);
    }

    protected updatePosition() {
        this.x = getFrameXCanvas(this.item, this.viewState) + 0.5;
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
        // this.title.style.trim = true;
        // this.title.style.breakWords = true;
        // this.title.style.wordWrap = true;
        // this.title.style.wordWrapWidth = this.frameWidth;

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
