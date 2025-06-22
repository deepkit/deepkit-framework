import { Component } from '@angular/core';

@Component({
    standalone: false,
    template: `
        <div class="subline">Desktop UI</div>
        <h2>Checkbox</h2>

        <textarea codeHighlight>
        import {DuiDialogModule} from '@deepkit/desktop-ui';
        </textarea>

        <doc-code-frame>
            <div>
                <dui-dialog [(visible)]="showDialog" title="Cool modal">
                    <h3>Hi this is a new window</h3>

                    <p>
                        There are many variations of passages of Lorem Ipsum available, but the majority have suffered alteration in some form, by
                        injected humour,
                        or randomised words which don't look even slightly believable. If you are going to use a passage of Lorem Ipsum, you need to
                        be sure there
                        isn't anything embarrassing hidden in the middle of text. All the Lorem Ipsum generators on the Internet tend to repeat
                        predefined chunks
                        as necessary, making this the first true generator on the Internet. It uses a dictionary of over 200 Latin words, combined
                        with a handful of
                        model sentence structures, to generate Lorem Ipsum which looks reasonable.
                        The generated Lorem Ipsum is therefore always free from repetition, injected humour, or non-characteristic words etc.
                    </p>

                    <p>
                        There are many variations of passages of Lorem Ipsum available, but the majority have suffered alteration in some form, by
                        injected humour,
                        or randomised words which don't look even slightly believable. If you are going to use a passage of Lorem Ipsum, you need to
                        be sure there
                        isn't anything embarrassing hidden in the middle of text. All the Lorem Ipsum generators on the Internet tend to repeat
                        predefined chunks
                        as necessary, making this the first true generator on the Internet. It uses a dictionary of over 200 Latin words, combined
                        with a handful of
                        model sentence structures, to generate Lorem Ipsum which looks reasonable.
                        The generated Lorem Ipsum is therefore always free from repetition, injected humour, or non-characteristic words etc.
                    </p>

                    <dui-dialog-actions>
                        <dui-button closeDialog>Close</dui-button>
                        <dui-button closeDialog primary>Ok</dui-button>
                    </dui-dialog-actions>
                </dui-dialog>

                <dui-dialog #dialog>
                    <h3>Are you sure?</h3>

                    <dui-dialog #anotherOne [maxWidth]="500">
                        <h3>No worries</h3>
                        <p>
                            There are many variations of passages of Lorem Ipsum available,
                            but the majority have suffered alteration in some form, by injected humour.
                        </p>
                        <dui-dialog-actions>
                            <dui-button closeDialog>Ok, I'm sure now</dui-button>
                        </dui-dialog-actions>
                    </dui-dialog>

                    <dui-button (click)="anotherOne.show()">Not sure</dui-button>

                    <dui-dialog-actions>
                        <dui-button closeDialog>Close</dui-button>
                    </dui-dialog-actions>
                </dui-dialog>

                <dui-dialog #dialog2 [minHeight]="250" [minWidth]="500">
                    <ng-container *dialogContainer>
                        <div style="position: absolute;left: 0; right: 0; top: 0; bottom: 0; border: 2px solid red;">
                            I'm absolute
                        </div>
                        <dui-dialog-actions>
                            <dui-button closeDialog>Close</dui-button>
                        </dui-dialog-actions>
                    </ng-container>
                </dui-dialog>

                <dui-button-group>
                    <dui-button textured (click)="showDialog=!showDialog">
                        {{showDialog ? 'Close' : 'Open'}} Dialog
                    </dui-button>
                    <dui-button textured (click)="dialog.show()">Open sureness</dui-button>
                    <dui-button textured confirm="Really delete?" (click)="confirmed = confirmed+1">Confirm please {{confirmed}}</dui-button>
                    <dui-button textured (click)="dialog2.show()">Absolute dialog</dui-button>
                </dui-button-group>
            </div>
            <textarea codeHighlight="html">
                
                <dui-dialog [(visible)]="showDialog" title="Cool modal">
                    <h3>Hi this is a new window</h3>

                    <p>
                        There are many variations of passages of Lorem Ipsum available, but the majority have suffered alteration in some form, by
                        injected humour,
                        or randomised words which don't look even slightly believable. If you are going to use a passage of Lorem Ipsum, you need to
                        be sure there
                        isn't anything embarrassing hidden in the middle of text. All the Lorem Ipsum generators on the Internet tend to repeat
                        predefined chunks
                        as necessary, making this the first true generator on the Internet. It uses a dictionary of over 200 Latin words, combined
                        with a handful of
                        model sentence structures, to generate Lorem Ipsum which looks reasonable.
                        The generated Lorem Ipsum is therefore always free from repetition, injected humour, or non-characteristic words etc.
                    </p>

                    <p>
                        There are many variations of passages of Lorem Ipsum available, but the majority have suffered alteration in some form, by
                        injected humour,
                        or randomised words which don't look even slightly believable. If you are going to use a passage of Lorem Ipsum, you need to
                        be sure there
                        isn't anything embarrassing hidden in the middle of text. All the Lorem Ipsum generators on the Internet tend to repeat
                        predefined chunks
                        as necessary, making this the first true generator on the Internet. It uses a dictionary of over 200 Latin words, combined
                        with a handful of
                        model sentence structures, to generate Lorem Ipsum which looks reasonable.
                        The generated Lorem Ipsum is therefore always free from repetition, injected humour, or non-characteristic words etc.
                    </p>

                    <dui-dialog-actions>
                        <dui-button closeDialog>Close</dui-button>
                        <dui-button closeDialog primary>Ok</dui-button>
                    </dui-dialog-actions>
                </dui-dialog>

                <dui-dialog #dialog>
                    <h3>Are you sure?</h3>

                    <dui-dialog #anotherOne [maxWidth]="500">
                        <h3>No worries</h3>
                        <p>
                            There are many variations of passages of Lorem Ipsum available,
                            but the majority have suffered alteration in some form, by injected humour.
                        </p>
                        <dui-dialog-actions>
                            <dui-button closeDialog>Ok, I'm sure now</dui-button>
                        </dui-dialog-actions>
                    </dui-dialog>

                    <dui-button (click)="anotherOne.show()">Not sure</dui-button>

                    <dui-dialog-actions>
                        <dui-button closeDialog>Close</dui-button>
                    </dui-dialog-actions>
                </dui-dialog>

                <dui-dialog #dialog2 [minHeight]="250" [minWidth]="500">
                    <ng-container *dialogContainer>
                        <div style="position: absolute;left: 0; right: 0; top: 0; bottom: 0; border: 2px solid red;">
                            I'm absolute
                        </div>
                        <dui-dialog-actions>
                            <dui-button closeDialog>Close</dui-button>
                        </dui-dialog-actions>
                    </ng-container>
                </dui-dialog>

                <dui-button-group>
                    <dui-button textured (click)="showDialog=!showDialog">
                        {{showDialog ? 'Close' : 'Open'}} Dialog
                    </dui-button>
                    <dui-button textured (click)="dialog.show()">Open sureness</dui-button>
                    <dui-button textured confirm="Really delete?" (click)="confirmed = confirmed+1">Confirm please {{confirmed}}</dui-button>
                    <dui-button textured (click)="dialog2.show()">Absolute dialog</dui-button>
                </dui-button-group>
            </textarea>
        </doc-code-frame>

        <api-doc module="components/dialog/dialog.component" component="DialogComponent"></api-doc>
    `
})
export class DocDesktopUIDialogComponent {
    showDialog = false;
    confirmed = 0;
}
