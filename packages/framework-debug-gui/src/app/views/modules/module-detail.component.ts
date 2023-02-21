import { Component, Input, OnChanges } from '@angular/core';
import { ModuleApi, ModuleService } from '@deepkit/framework-debug-api';
import { stringifyType } from '@deepkit/type';
import { trackByIndex } from '@deepkit/ui-library';
import { ModuleImportedService } from '../../../../../framework-debug-api/src/api.js';

@Component({
    selector: 'module-detail-service',
    template: `
        <span [class.exported]="service.exported" [class.for-root]="service.forRoot">
            {{service.token}}
        </span>

        <span class="instantiated" *ngIf="service.instantiations">
            <ng-container *ngIf="service.scope">({{service.instantiations}} instantiations)</ng-container>
            <ng-container *ngIf="!service.scope">(instantiated)</ng-container>
        </span>

        <span class="scope" *ngIf="service.scope">[scope: {{service.scope}}]</span>
    `,
    styles: [`
        :host {
            display: block;
            font-size: 12px;
            overflow: hidden;
            text-overflow: ellipsis;
            padding: 0 3px;
        }

        :host:hover {
            border-radius: 3px;
            background-color: rgba(128, 128, 128, 0.24);
        }

        .exported {
            color: var(--color-orange);
        }

        .for-root {
            color: var(--color-for-root);
        }

        .instantiated {
            color: var(--color-green);
            opacity: 0.6;
        }

        .scope {
            color: var(--text-light);
        }
    `]
})
export class ModuleDetailServiceComponent {
    @Input() service!: ModuleService;
}

@Component({
    selector: 'module-detail',
    template: `
        <deepkit-box [toggleAble]="true" [title]="m.className" class="module" [class.no-imports]="m.imports.length === 0">

            <div class="name">
                Name: {{m.name || 'unnamed'}} #{{m.id}} — This name can be used for environment configuration loader.
            </div>
            <div class="config" *ngIf="m.getConfigSchema() as schema">
                <div class="ts">
                    <div codeHighlight [code]="schemaCode"></div>
                </div>
            </div>

            <div class="sections text-selection">
                <div class="services" *ngIf="services.length">
                    <div class="section-title">Services</div>
                    <div class="entries">
                        <div class="no-entries" *ngIf="services.length === 0">No services</div>
                        <module-detail-service [service]="service" *ngFor="let service of services; trackBy: trackByIndex"></module-detail-service>
                    </div>
                </div>
                <div class="controllers" *ngIf="controllers.length">
                    <div class="section-title">Controllers</div>
                    <div class="entries">
                        <div class="no-entries" *ngIf="controllers.length === 0">No controllers</div>
                        <module-detail-service [service]="service" *ngFor="let service of controllers; trackBy: trackByIndex"></module-detail-service>
                    </div>
                </div>
                <div class="listeners" *ngIf="listeners.length">
                    <div class="section-title">Listeners</div>
                    <div class="entries">
                        <div class="no-entries" *ngIf="listeners.length === 0">No listeners</div>
                        <module-detail-service [service]="service" *ngFor="let service of listeners; trackBy: trackByIndex"></module-detail-service>
                    </div>
                </div>
            </div>
            <div class="imported-services" *ngIf="importedServices.length">
                <div class="title" (click)="showImportedServices = !showImportedServices">
                    <dui-icon clickable [name]="showImportedServices ? 'arrow_down' : 'arrow_right'"></dui-icon>
                    Imported services ({{importedServices.length}})
                </div>
                <div class="description" *ngIf="showImportedServices">
                    The following services have been exported by a module that {{m.className}} imported.
                </div>
                <div class="imported-services-grid text-selection" *ngIf="showImportedServices">
                    <div *ngFor="let service of importedServices; trackBy: trackByIndex">
                        <span>{{service.token}}</span> <span class="module-name">({{service.fromModule}})</span>
                    </div>
                </div>
            </div>
        </deepkit-box>

        <div class="imports" *ngIf="m.imports.length">
            <div class="line-top"></div>
            <div class="import" *ngFor="let child of m.imports; trackBy: trackByIndex; let i = index; let last = last">
                <div class="line-left"></div>
                <div class="line-left-last" *ngIf="last"></div>
                <module-detail [m]="child" [class.margin-bottom]="!last"></module-detail>
            </div>
        </div>
    `,
    styleUrls: ['./module-detail.component.scss']
})
export class ModuleDetailComponent implements OnChanges {
    trackByIndex = trackByIndex;
    @Input() m!: ModuleApi;

    showImportedServices: boolean = false;

    public schemaCode: string = '';
    public services: ModuleService[] = [];
    public controllers: ModuleService[] = [];
    public listeners: ModuleService[] = [];
    public importedServices: ModuleImportedService[] = [];

    ngOnChanges(): void {
        this.services = this.m.services.filter(v => v.type === 'service');
        this.controllers = this.m.services.filter(v => v.type === 'controller');
        this.listeners = this.m.services.filter(v => v.type === 'listener');
        this.importedServices = this.m.importedServices;

        const schema = this.m.getConfigSchema();
        if (schema) {
            this.schemaCode = stringifyType(schema, { showDefaults: true, showFullDefinition: true, defaultValues: this.m.config });
        }
    }
}
