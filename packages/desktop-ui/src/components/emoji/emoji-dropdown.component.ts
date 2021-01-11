import {
    AfterViewInit, ChangeDetectorRef,
    Component, ComponentFactoryResolver, ComponentRef,
    Directive,
    ElementRef,
    EventEmitter,
    HostListener, Input, OnChanges, OnDestroy,
    Output, SimpleChanges,
    ViewChild,
    ViewContainerRef
} from "@angular/core";
import * as emojis from './emojis';
import { EmojiCategory } from './emojis';
import { DropdownComponent } from "../button";

@Component({
    selector: 'dui-emoji-dropdown',
    template: `
        <dui-dropdown overlay [center]="true" (shown)="searchInput.focusInput()" #dropdown [height]="360" [width]="320" [minWidth]="320">
            <div class="dropdown">
                <dui-input round style="width: calc(100% - 13px)" clearer focus #searchInput
                           icon="search" placeholder="Search" [(ngModel)]="search"></dui-input>

                <div *ngIf="search">
                    <div class="emojis">
                        <div class="emoji" *ngFor="let name of find(search)"
                             [class.selected]="name === emoji"
                             [attr.id]="'emoji_' + name"
                             (click)="choose(name)">
                            <div class="emoji-image"
                                 [style.backgroundPosition]="emojis.emojis[name] ? (-((emojis.emojis[name].x * 34) + 1) + 'px ' + -((emojis.emojis[name].y * 34) + 1) + 'px') : ''"></div>
                        </div>
                    </div>
                </div>
                <ng-container *ngIf="!search">
                    <div *ngIf="getLast(lastEmojis) as lastEmojis">
                        <div class="category-title">
                            Frequently used
                        </div>

                        <div class="emojis">
                            <div class="emoji" *ngFor="let name of lastEmojis"
                                 [attr.id]="'emoji_' + name"
                                 [class.selected]="name === emoji"
                                 (click)="choose(name)">
                                <div class="emoji-image"
                                     [style.backgroundPosition]="emojis.emojis[name] ? (-((emojis.emojis[name].x * 34) + 1) + 'px ' + -((emojis.emojis[name].y * 34) + 1) + 'px') : ''"></div>
                            </div>
                        </div>
                    </div>

                    <div *ngFor="let categoryName of categories">
                        <ng-container *ngIf="getCategory(categoryName) as category">
                            <div class="category-title">
                                {{category.name}}
                            </div>

                            <div class="emojis">
                                <div class="emoji" *ngFor="let name of category.emojis"
                                     [attr.id]="'emoji_' + name"
                                     [class.selected]="name === emoji"
                                     (click)="choose(name)">
                                    <div class="emoji-image"
                                         [style.backgroundPosition]="emojis.emojis[name] ? (-((emojis.emojis[name].x * 34) + 1) + 'px ' + -((emojis.emojis[name].y * 34) + 1) + 'px') : ''"></div>
                                </div>
                            </div>
                        </ng-container>
                    </div>
                </ng-container>
            </div>
        </dui-dropdown>
    `,
    styleUrls: ['./emoji-dropdown.component.scss'],
})
export class EmojiDropdownComponent implements AfterViewInit {
    @Input() blacklist: string[] = [];

    @Input() lastEmojis: string[] = [];
    @Output() lastEmojisChange = new EventEmitter();

    @Input() emoji: string = '';
    @Output() emojiChange = new EventEmitter();

    @ViewChild(DropdownComponent, { static: true }) dropdown!: DropdownComponent;

    emojis = emojis;

    search: string = '';

    categories: string[] = [
        'Smileys & People',
        'Animals & Nature',
        'Food & Drink',
        'Activities',
        'Travel & Places',
        'Objects',
        'Symbols',
        'Flags',
    ];

    constructor(protected element: ElementRef, protected cd: ChangeDetectorRef) {
    }

    getLast(emojis: string[]): string[] | undefined {
        if (!emojis.length) return;

        return [...new Set(emojis.map(v => {
            if (v[0] === ':') return v.substring(1, v.length - 1);
            return v[0];
        }))];
    }

    ngAfterViewInit() {
        this.element.nativeElement.remove();
    }

    public open(target: ElementRef) {
        if (this.search) {
            this.search = '';
            this.cd.detectChanges();
        }

        this.dropdown.toggle(target);
        if (this.emoji) {
            const element = document.getElementById('emoji_' + this.emoji);
            if (element) {
                element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }
    }

    find(search: string): string[] {
        search = search.toLowerCase();
        const result: string[] = [];

        for (const emoji of Object.values(emojis.emojis)) {
            if (-1 !== emoji.name.toLowerCase().indexOf(search)) {
                result.push(emoji.shortName);
            }
        }

        return result;
    }

    choose(name: string) {
        name = ':' + name + ':';

        this.emoji = name;
        this.emojiChange.emit(name);

        if (-1 === this.lastEmojis.indexOf(name)) {
            this.lastEmojis.push(name);
        } else {
            const index = this.lastEmojis.indexOf(name);
            if (index > 0) {
                this.lastEmojis.splice(index, 1);
                this.lastEmojis.splice(index - 1, 0, name);
            }
        }
        this.lastEmojis = this.lastEmojis.slice(0);

        this.dropdown.close();
        this.cd.detectChanges();
    }

    getCategory(name: string): EmojiCategory {
        for (const category of emojis.categories) {
            if (category.name === name) return category;
        }
        throw new Error(`No category for name ${name} found`);
    }
}

@Directive({
    selector: '[duiEmojiDropdown]'
})
export class EmojiDropdownDirective implements OnChanges, AfterViewInit, OnDestroy {
    protected dropdown?: ComponentRef<EmojiDropdownComponent>;

    @Input() lastEmojis: string[] = [];
    @Output() lastEmojisChange = new EventEmitter();

    @Input() blacklist: string[] = [];

    @Input() emoji: string = '';
    @Output() emojiChange = new EventEmitter();

    constructor(
        protected elementRef: ElementRef,
        protected view: ViewContainerRef,
        protected resolver: ComponentFactoryResolver,
    ) {

    }

    ngAfterViewInit() {
        const factory = this.resolver.resolveComponentFactory(EmojiDropdownComponent);
        this.dropdown = this.view.createComponent(factory);
        this.dropdown.instance.emojiChange = this.emojiChange;
        this.dropdown.instance.lastEmojisChange = this.lastEmojisChange;

        this.dropdown.instance.blacklist = this.blacklist;
        this.dropdown.instance.lastEmojis = this.lastEmojis;
        this.dropdown.instance.emoji = this.emoji;
        this.dropdown.changeDetectorRef.detectChanges();
    }

    ngOnChanges(changes: SimpleChanges): void {
        if (this.dropdown) {
            this.dropdown.instance.blacklist = this.blacklist;
            this.dropdown.instance.emoji = this.emoji;
            this.dropdown.instance.lastEmojis = this.lastEmojis;
            this.dropdown.changeDetectorRef.detectChanges();
        }
    }

    @HostListener('click')
    onClick() {
        if (this.dropdown) {
            this.dropdown.instance.open(this.elementRef);
        }
    }

    ngOnDestroy() {
        if (this.dropdown) {
            this.dropdown.destroy();
        }
    }
}
