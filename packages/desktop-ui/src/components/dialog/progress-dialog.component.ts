import {BehaviorSubject} from "rxjs";
import {Component, Input, OnInit} from "@angular/core";
import {DialogComponent} from "./dialog.component";

class State {
    title: string = '';
    step: number = 0;
    steps: number = 1;
}

export class ProgressDialogState extends BehaviorSubject<State | undefined> {
    protected readonly state = new State;

    public readonly closer = new BehaviorSubject<boolean>(false);

    constructor() {
        super(undefined);
        this.next(this.state);
    }

    public cancel() {
        this.closer.next(true);
    }

    public close() {
        this.closer.next(true);
    }

    public async waitForClose(): Promise<boolean> {
        return new Promise<boolean>((resolve, reject) => {
            this.closer.subscribe((next) => {
                if (next) {
                    resolve(next);
                }
            });
        });
    }

    set title(v: string) {
        this.state.title = v;
        this.next(this.state);
    }

    get title(): string {
        return this.state.title;
    }

    set step(v: number) {
        this.state.step = v;
        this.next(this.state);
    }

    get step(): number {
        return this.state.step;
    }

    set steps(v: number) {
        this.state.steps = v;
        this.next(this.state);
    }

    get steps(): number {
        return this.state.steps;
    }
}

@Component({
    template: `
        <div *ngIf="state$|async as state">
            <h3>{{state.title}}</h3>
            <div>
                <div style="text-align: right; padding: 2px 0;">
                    {{state.step}} / {{state.steps}}
                </div>
                <!--                <mat-progress-bar mode="determinate" [value]="state.step/state.steps * 100"></mat-progress-bar>-->
            </div>
        </div>

        <dui-dialog-actions>
            <button mat-button (click)="onCancelClick()">Cancel</button>
        </dui-dialog-actions>
    `
})
export class DuiDialogProgress implements OnInit {
    @Input() public state$!: ProgressDialogState;

    constructor(protected dialog: DialogComponent) {
    }

    ngOnInit(): void {
        this.state$.closer.subscribe((v) => {
            if (v) {
                this.dialog.close(v);
            }
        });
    }

    onCancelClick() {
        this.state$.closer.next(true);
        this.dialog.close(false);
    }
}
