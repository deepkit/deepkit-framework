/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import {
    AfterViewInit,
    ChangeDetectorRef,
    Component,
    ElementRef,
    Input,
    OnChanges,
    SimpleChanges,
    ViewChild
} from '@angular/core';
import { DatabaseInfo } from '@deepkit/orm-browser-api';
import { ClassSchema, PropertySchema } from '@deepkit/type';
import { graphlib, layout } from 'dagre';
import { default as createPanZoom, PanZoom } from 'panzoom';
import { BrowserText } from './browser-text';

// @Component({
//   selector: 'app-workflow-card',
//   template: '<ng-template #templateRef><ng-content></ng-content></ng-template>'
// })
// export class WorkflowCardComponent {
//   /**
//    * The name of the field of T.
//    */
//   @Input('name') name!: string;

//   @Input('class') class!: string;

//   @ViewChild('templateRef', { static: false }) template!: TemplateRef<any>;
// }

type EdgeNode = { d: string, class?: string };
type DKNode = { entity: ClassSchema, properties: PropertySchema[], height: number, width: number, x: number, y: number };

@Component({
  selector: 'database-graph',
  template: `
    <div class="nodes" (dblclick)="zoomToFit()"
         #graph
         [style.width.px]="graphWidth"
         [style.height.px]="graphHeight">
      <svg
        [style.width.px]="graphWidth"
        [style.height.px]="graphHeight">
        <path
          *ngFor="let edge of edges"
          [attr.d]="edge.d" [class]="edge.class"></path>
      </svg>

     <div
        *ngFor="let node of nodes"
        [style.left.px]="(node.x - (node.width/2))"
        [style.top.px]="(node.y - (node.height/2))"
        [style.width.px]="node.width"
        [style.height.px]="node.height"
        class="node">
        <ng-container *ngIf="node.property">
            {{node.property.name}}
        </ng-container>
        <ng-container *ngIf="node.entity && node.properties">
          <div class="header">
            {{node.entity.getClassName()}}
          </div>

          <div *ngFor="let property of node.properties">
            {{propertyLabel(property)}}
          </div>
        </ng-container>
      </div>
    </div>
  `,
  styleUrls: ['./database-graph.component.scss']
})
export class DatabaseGraphComponent implements OnChanges, AfterViewInit {
  @Input() database?: DatabaseInfo;

  nodes: any[] = [];
  edges: EdgeNode[] = [];

  svg?: any;
  inner?: any;
  zoom?: any;
  width: number = 1000;
  height: number = 500;

  graphWidth: number = 500;
  graphHeight: number = 500;

  browserText = new BrowserText();

  @ViewChild('graph') graphElement?: ElementRef<HTMLDivElement>;
  graphPanZoom?: PanZoom;

  constructor(
    protected cd: ChangeDetectorRef,
    protected host: ElementRef<HTMLElement>,
  ) {
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes.database) this.loadGraph();
  }

  ngAfterViewInit(): void {
    //   if (!this.cards) return;
    //   this.cards.changes.subscribe((cards) => {
    //     this.loadCards(cards);
    //   });
    //   this.loadCards(this.cards.toArray());
    setTimeout(() => this.loadGraph(), 100);
  }

  // protected loadCards(cards: WorkflowCardComponent[]) {
  //   for (const card of cards) {
  //     this.cardMap[card.name] = card;
  //   }
  //   this.cd.detectChanges();
  // }

  public propertyLabel(property: PropertySchema): string {
    let type = property.toString(false);
    if (property.isReference) type = 'Reference<' + type + '>';
    if (property.backReference) type = 'BackReference<' + type + '>';
    if (property.isId) type = 'Primary<' + type + '>';
    return property.name + (property.isOptional ? '?' : '') + ': ' + type;
  }

  protected loadGraph() {
    if (!this.database) return;

    const g = new graphlib.Graph({ directed: true, compound: true, multigraph: false });
    g.setGraph({
      nodesep: 50,
      ranksep: 50,
      rankdir: "LR",
      align: 'DL',
      // rankdir: 'LR',
      // ranker: 'longest-path'
    });
    g.setDefaultEdgeLabel(() => {
      return { labelpos: 'c', labeloffset: 0 };
    });

    this.nodes = [];
    this.edges = [];

    const propertyHeight = 16;
    const propertyListOffset = 28;

    // for (const node of this.workflow.places) {
    //   g.setNode(node, { label: node, width, height });
    // }

    for (const entity of this.database.getClassSchemas()) {
      const properties = [...entity.getProperties()];

      let maxWidth = this.browserText.getDimensions(entity.getClassName()).width + 25;
      for (const property of properties) {
        const w = this.browserText.getDimensions(this.propertyLabel(property)).width + 25;
        if (w > maxWidth) maxWidth = w;
      }

      g.setNode(entity.getName(), { entity: entity, properties, width: maxWidth, height: propertyListOffset + (entity.getPropertiesMap().size * propertyHeight), });
    }

    function addEdge(entity: ClassSchema, rootProperty: PropertySchema, property: PropertySchema) {
      if (property.type === 'partial' || property.type === 'array' || property.type === 'map') {
        addEdge(entity, rootProperty, property.getSubType());
      } else if (property.type === 'class') {
        g.setEdge(entity.getName(), property.getResolvedClassSchema().getName());
      }
      //todo: backReference.via
    }

    for (const entity of this.database.getClassSchemas()) {
      for (const property of entity.getProperties()) {
        addEdge(entity, property, property);
      }
    }

    try {
      layout(g);
    } catch (error) {
      console.error('Could not calc layout for graph', error);
    }

    // dagre calcs sometimes edges with minus coordinates. We forbid that and
    // offset everything back
    let offsetX = 0;
    let offsetY = 0;
    this.graphWidth = g.graph().width || 0;
    this.graphHeight = g.graph().height || 0;

    offsetX = offsetX * -1;
    offsetY = offsetY * -1;

    // now adjust everything
    if (offsetX !== 0 || offsetY !== 0) {
      this.graphWidth += offsetX;
      this.graphHeight += offsetY;

      for (const edge of g.edges()) {
        const points = g.edge(edge).points;
        if (!points) continue;
        for (const item of points) {
          item.x += offsetX;
          item.y += offsetY;
        }
      }

      for (const nodeId of g.nodes()) {
        const node = g.node(nodeId);
        node.x += offsetX;
        node.y += offsetY;
      }
    }

    const nodeMap: { [name: string]: DKNode } = {};
    for (const nodeName of g.nodes()) {
      const node = g.node(nodeName);
      nodeMap[nodeName] = node as any;
      // if (node.width + (node.x - (width / 2)) > this.graphWidth) {
      //   this.graphWidth = node.width + (node.x - (width / 2));
      // }
      // if (node.height + (node.y - (height / 2)) > this.graphHeight) {
      //   this.graphHeight = node.height + (node.y - (height / 2));
      // }
      this.nodes.push(node as any);
    }

    const extractEdges = (i: number, node: DKNode, rootProperty: PropertySchema, property: PropertySchema) => {
      if (property.type === 'array' || property.type === 'map' || property.type === 'partial') {
        extractEdges(i, node, rootProperty, property.getSubType());
      }
      if (property.type === 'class') {

        const toNode = nodeMap[property.getResolvedClassSchema().getName()];

        let from = { x: node.x - Math.floor(node.width / 2), y: node.y - Math.floor(node.height / 2) };
        let to = { x: toNode.x - Math.floor(toNode.width / 2), y: toNode.y - Math.floor(toNode.height / 2) + Math.floor(propertyListOffset / 2) };

        if (to.x > from.x) {
          from.x += node.width;
        } else if (from.x > to.x) {
          to.x += toNode.width;
        }

        from.y += propertyListOffset + (i * propertyHeight) + Math.floor(propertyHeight / 2);

        if (from.x > to.x) {
          const t = from;
          from = to;
          to = t;
        }
        const middleX = to.x - Math.floor(Math.abs(to.x - from.x) / 2);

        const edge: EdgeNode = { d: `M ${from.x} ${from.y} C ${middleX} ${from.y} ${middleX} ${to.y} ${to.x} ${to.y}` };
        if (rootProperty.backReference) {
          edge.class = 'back-reference';
        } else if (!rootProperty.isReference) {
          edge.class = 'embedded';
        }

        this.edges.push(edge);
      }
    }

    for (const nodeName of g.nodes()) {
      const node = nodeMap[nodeName];
      for (let i = 0; i < node.properties.length; i++) {
        const property = node.properties[i];
        extractEdges(i, node, property, property);
      }
    }

    // for (const edge of g.edges()) {
    //   const points = g.edge(edge).points;
    //   const d: string[] = [];
    //   d.push('M ' + (points[0].x + 0.5) + ',' + (points[0].y + 0.5));
    //   if (points[0].y > this.graphHeight) this.graphHeight = points[0].y + 1;

    //   for (let i = 1; i < points.length; i++) {
    //     if (points[i].y > this.graphHeight) this.graphHeight = points[i].y + 1;
    //     d.push('L ' + (points[i].x + 0.5) + ',' + (points[i].y + 0.5));
    //   }
    //   this.edges.push(d.join(' '));
    // }

    this.cd.detectChanges();

    if (this.graphElement) {
      if (!this.graphPanZoom) {
        this.graphPanZoom = createPanZoom(this.graphElement.nativeElement, {
          bounds: true,
          zoomSpeed: 0.065,
          zoomDoubleClickSpeed: 1
        });
        this.zoomToFit(true);
      } else if (true) {
        this.zoomToFit(true);
      }
    }

    this.cd.detectChanges();
  }

  async zoomToFit(force: boolean = false) {
    this._zoomToFit();
    requestAnimationFrame(this._zoomToFit.bind(this, force));
  }

  async _zoomToFit(force: boolean = false) {
    try {
      if (this.graphElement && this.graphPanZoom) {
        const svg = this.graphElement.nativeElement;

        const rectParent = this.host.nativeElement.getBoundingClientRect();
        const rectScene = svg.getBoundingClientRect();

        const xys = this.graphPanZoom.getTransform();
        const originWidth = rectScene.width / xys.scale;
        const originHeight = rectScene.height / xys.scale;
        const zoomX = (rectParent.width - 20) / originWidth;
        const zoomY = (rectParent.height - 20) / originHeight;

        let targetScale = zoomX < zoomY ? zoomX : zoomY;

        if (!force) {
          if (xys.scale > 1.001) {
            //zoom back to 100% first before to bigpicture
            this.graphPanZoom.smoothZoomAbs(
              rectParent.width / 2,
              rectParent.height / 2,
              1,
            );
            return;
          } else if (Math.abs(targetScale - xys.scale) < 0.005) {
            //when target scale is the same as currently, we reset back to 100%, so it acts as toggle.
            //reset to 100%
            targetScale = 1;
          }
        }

        targetScale = Math.min(1, targetScale);

        const targetWidth = originWidth * xys.scale;
        const targetHeight = originHeight * xys.scale;
        const newX = targetWidth > rectParent.width ? -(targetWidth / 2) + rectParent.width / 2 : (rectParent.width / 2) - (targetWidth / 2);
        const newY = targetHeight > rectParent.height ? -(targetHeight / 2) + rectParent.height / 2 : (rectParent.height / 2) - (targetHeight / 2);

        //we need to cancel current running animations
        this.graphPanZoom.pause();
        this.graphPanZoom.resume();

        this.graphPanZoom.moveBy(
          Math.floor(newX - xys.x),
          Math.floor(newY - xys.y),
          false
        );

        //correct way to zoom with center of graph as origin when scaled
        this.graphPanZoom.smoothZoomAbs(
          Math.floor(xys.x + originWidth * xys.scale / 2),
          Math.floor(xys.y + originHeight * xys.scale / 2),
          1,
        );
      }
    } catch (error) {
      console.log('error zooming', error);
    }
  }
}
