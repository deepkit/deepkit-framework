import { Component, computed, effect, ElementRef, inject, input, signal, viewChild } from '@angular/core';
import { ButtonComponent, ButtonGroupComponent, ButtonGroupsComponent, DropdownComponent, DuiDialog, FilesystemApi, FilesystemFileDialog, InputComponent, ngValueAccessor, ValueAccessorBase } from '@deepkit/desktop-ui';
import { DocumentType, Editor, NodeType } from '@tiptap/core';
import Document from '@tiptap/extension-document';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';
import Bold from '@tiptap/extension-bold';
import Italic from '@tiptap/extension-italic';
import Underline from '@tiptap/extension-underline';
import Strike from '@tiptap/extension-strike';
import Heading from '@tiptap/extension-heading';
import Link from '@tiptap/extension-link';
import TextAlign from '@tiptap/extension-text-align';
import { Image } from './text-editor-image';
import { Dropcursor, Gapcursor, UndoRedo } from '@tiptap/extensions';
import CodeBlock from '@tiptap/extension-code-block';
import { Node as ProseNode } from 'prosemirror-model';
import { FormsModule } from '@angular/forms';

@Component({
    selector: 'app-text-editor',
    imports: [
        ButtonGroupsComponent,
        ButtonGroupComponent,
        ButtonComponent,
        DropdownComponent,
        FormsModule,
        InputComponent,
    ],
    template: `
      <dui-button-groups>
        <dui-button-group padding="none">
          <dui-button small (click)="setHeader(0)" [active]="header() === 0">Body</dui-button>
          <dui-button small (click)="setHeader(1)" [active]="header() === 1">H1</dui-button>
          <dui-button small (click)="setHeader(2)" [active]="header() === 2">H2</dui-button>
          <dui-button small (click)="setHeader(3)" [active]="header() === 3">H3</dui-button>
        </dui-button-group>

        <dui-button-group padding="none">
          <dui-button textured small [active]="format().includes('bold')"
                      (click)="editor().chain().focus().toggleBold().run()" icon="15_text_format_bold"></dui-button>
          <dui-button textured small [active]="format().includes('italic')"
                      (click)="editor().chain().focus().toggleItalic().run()" icon="15_text_format_italic"></dui-button>
          <dui-button textured small [active]="format().includes('underline')"
                      (click)="editor().chain().focus().toggleUnderline().run()" icon="15_text_format_underline"></dui-button>
          <dui-button textured small [active]="format().includes('strike')"
                      (click)="editor().chain().focus().toggleStrike().run()" icon="15_text_format_strikethrough"></dui-button>
        </dui-button-group>


        <dui-button-group padding="none">
          <dui-button textured small [active]="aligned() === 'left'"
                      (click)="editor().chain().focus().unsetTextAlign().run()" icon="15_text_format_align_left"></dui-button>
          <dui-button textured small [active]="aligned() === 'center'"
                      (click)="editor().chain().focus().setTextAlign('center').run()" icon="15_text_format_align_center"></dui-button>
          <dui-button textured small [active]="aligned() === 'right'"
                      (click)="editor().chain().focus().setTextAlign('right').run()" icon="15_text_format_align_right"></dui-button>
        </dui-button-group>

        <dui-button-group padding="none">
          <dui-button textured small [active]="image()" (click)="addImage()" icon="picture"></dui-button>
          <dui-button textured small [active]="codeBlock()" (click)="toggleCodeBlock()" icon="code"></dui-button>
          <dui-button textured small [active]="link()" (click)="toggleLink()" icon="link"></dui-button>
        </dui-button-group>

        <dui-button-group padding="none">
          <dui-button textured small (click)="undo()" icon="arrow_left"></dui-button>
          <dui-button textured small (click)="redo()" icon="arrow_right"></dui-button>
        </dui-button-group>
      </dui-button-groups>

      @if (selection(); as selection) {
        @if (selection.node.type.name === 'image') {
          <dui-dropdown #imageToolbar [show]="true" [host]="selection.element">
            <div class="image-options">
              <dui-input placeholder="Alt Text" [ngModel]="selection.node.attrs.alt" (ngModelChange)="updateAttribute(selection.node, 'alt', $event)" />
              <dui-input placeholder="Width" class="width" [ngModel]="selection.node.attrs.width" (ngModelChange)="updateAttribute(selection.node, 'width', $event)" />
              <dui-button (click)="changeImage()">Change</dui-button>
            </div>
          </dui-dropdown>
        }
      }

      <div class="content-text overlay-scrollbar-small normalize-text" #editorContainer></div>
    `,
    styleUrl: './text-editor.component.scss',
    providers: [ngValueAccessor(TextEditorComponent)],
})
export class TextEditorComponent extends ValueAccessorBase<NodeType[]> {
    editorContainer = viewChild.required('editorContainer', { read: ElementRef });
    imageToolbar = viewChild.required('imageToolbar', { read: DropdownComponent });

    filesystemApi = input.required<FilesystemApi>();
    changed = signal(0);

    selection = signal<{ node: ProseNode, element: HTMLElement } | undefined>(undefined);

    protected fromEditor?: NodeType[];

    editor = computed(() => {
        const editor = new Editor({
            element: this.editorContainer().nativeElement,
            extensions: [
                UndoRedo, Gapcursor, Document, Paragraph, Text, Dropcursor,
                Link.configure({
                    openOnClick: false,
                    enableClickSelection: true,
                }),
                TextAlign.configure({
                    types: ['heading', 'paragraph', 'image'],
                }),
                Bold, Heading, Italic, Underline, Strike,
                CodeBlock.configure({
                    defaultLanguage: 'typescript',
                    languageClassPrefix: 'language-',
                }),
                Image.configure({
                    // inline: true,
                    textEditor: this,
                }),
            ],
        });
        editor.on('update', (props) => {
            const value = props.editor.getJSON() as DocumentType;
            this.fromEditor = value.content;
            this.changed.update(v => ++v);
            this.setValue(value.content);
        });
        editor.on('selectionUpdate', (props) => {
            this.changed.update(v => ++v);
            const node = props.editor.state.selection.$head.nodeBefore || undefined;
            const element = props.editor.view.nodeDOM(props.editor.state.selection.anchor)
                || props.editor.view.domAtPos(props.editor.state.selection.anchor, 0)?.node;
            this.selection.set(node && element ? { node, element: element as HTMLElement } : undefined);
            // console.log('selectionUpdate', node, element);
            // console.log('props.editor.state.selection.$head', props.editor.state.selection.$head);
        });
        return editor;
    });

    header = this.trackChange((editor) => editor.getAttributes('heading')?.level || 0);

    image = this.trackChange((editor) => editor.isActive('image'));

    format = this.trackChange((editor) => {
        return ''
            + (editor.isActive('bold') && 'bold')
            + (editor.isActive('italic') && 'italic')
            + (editor.isActive('underline') && 'underline')
            + (editor.isActive('strike') && 'strike');
    });

    aligned = this.trackChange((editor) => {
        if (editor.isActive({ textAlign: 'center' })) return 'center';
        if (editor.isActive({ textAlign: 'right' })) return 'right';
        return 'left';
    });

    codeBlock = this.trackChange((editor) => editor.isActive('codeBlock'));
    link = this.trackChange((editor) => editor.isActive('link'));

    dialog = inject(DuiDialog);

    constructor() {
        super();
        effect(() => {
            const editor = this.editor();
            const value = this.value();
            if (this.fromEditor === value) return;
            if (!value || !value.length) {
                this.editor().commands.clearContent();
                return;
            }
            editor.commands.setContent(value);
        });
    }

    async addImage() {
        const api = this.filesystemApi();
        const path = await this.dialog.open(FilesystemFileDialog, { api }, { backDropCloses: true }).close;
        if (!path) return;
        this.editor().chain().insertContent({ type: 'image', attrs: { path: path } }).focus().run();
    }

    async changeImage() {
        const api = this.filesystemApi();
        const path = await this.dialog.open(FilesystemFileDialog, { api }, { backDropCloses: true }).close;
        if (!path) return;
        this.editor().chain().updateAttributes('image', { path: path }).run();
    }

    trackChange<T>(callback: (editor: Editor) => T) {
        return computed<T>(() => {
            this.changed();
            return callback(this.editor());
        });
    }

    undo() {
        this.editor().chain().focus().undo().run();
    }

    redo() {
        this.editor().chain().focus().redo().run();
    }

    updateAttribute(node: ProseNode, name: string, value: any) {
        this.editor().chain().updateAttributes(node.type.name, { [name]: value }).run();
    }

    toggleCodeBlock() {
        this.editor().chain().focus().toggleCodeBlock().run();
    }

    toggleLink() {
        if (this.editor().isActive('link')) {
            this.editor().chain().focus().unsetLink().run();
        } else {
            const href = prompt('Enter link URL:', '') || '';
            if (!href) return;
            this.editor().chain().focus().toggleLink({ href }).run();
        }
    }

    setHeader(h: 0 | 1 | 2 | 3) {
        if (!h) {
            this.editor().chain().setParagraph().focus().run();
        } else {
            this.editor().chain().setHeading({ level: h }).focus().run();
        }
    }

}
