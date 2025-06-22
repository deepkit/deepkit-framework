import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommunityQuestion, DocPageResult, link } from '@app/common/models';
import { ControllerClient } from '@app/app/client';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { debounceTime, distinctUntilChanged, Subject } from 'rxjs';
import { LoadingComponent } from '@app/app/components/loading';

import { FormsModule } from '@angular/forms';
import { ContentRenderComponent } from '@app/app/components/content-render.component';
import { SearchResultQuestion } from '@app/app/components/search.component';

@Component({
    imports: [
    LoadingComponent,
    FormsModule,
    ContentRenderComponent,
    SearchResultQuestion,
    RouterLink
],
    styles: [`
        .app-search-field {
            width: 100%;
            height: 45px;
        }
    `],
    template: `
        <div class="app-content-full normalize-text">
          @if (loading) {
            <app-loading></app-loading>
          }
        
          <h1>Search</h1>
        
          <div class="app-search-field">
            <input placeholder="Search the docs" [(ngModel)]="query" (ngModelChange)="find()"/>
            <img alt="search icon" src="/assets/images/icons-search.svg" style="width: 18px; height: 18px;"/>
          </div>
        
          @if (results) {
            <div class="search-results">
              @for (r of results.community; track r) {
                <div [routerLink]="link(r)" class="app-search-result-item">
                  <app-search-result-page [q]="r"></app-search-result-page>
                </div>
              }
              @for (r of results.pages; track r) {
                <div [routerLink]="'/' + r.url" class="app-search-result-item">
                  <div class="path">{{r.path}}</div>
                  <h3 class="title">{{r.title}}</h3>
                  <div class="content">
                    <app-render-content [content]="r.content"></app-render-content>
                  </div>
                </div>
              }
            </div>
          }
        
        </div>
        `
})
export class DocuSearchComponent implements OnInit {
    query: string = '';
    results?: { pages: DocPageResult[], community: CommunityQuestion[] };
    loading = false;
    modelChanged = new Subject<string>();
    link = link;

    constructor(
        private client: ControllerClient,
        private cd: ChangeDetectorRef,
        public router: Router,
        public activatedRoute: ActivatedRoute,
    ) {
        this.modelChanged.pipe(debounceTime(500), distinctUntilChanged()).subscribe((query) => this._find(query));
    }

    ngOnInit() {
        this.activatedRoute.queryParams.subscribe((params) => {
            this.query = params['q'] || '';
            this._find(this.query);
        });
    }

    find() {
        this.modelChanged.next(this.query);
    }

    async _find(query: string) {
        this.loading = true;
        this.cd.detectChanges();
        //change ?q= in url without reloading the page
        this.router.navigate([], {queryParams: {q: query}, queryParamsHandling: 'merge'});

        try {
            this.results = await this.client.main.search(query);
        } finally {
            this.loading = false;
            this.cd.detectChanges();
        }
    }
}
