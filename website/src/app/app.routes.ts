import { ActivatedRouteSnapshot, CanActivate, Route, Router, Routes, UrlMatcher, UrlSegment } from '@angular/router';
import { StartpageComponent } from '@app/app/pages/startpage.component';
import { DocumentationComponent } from '@app/app/pages/documentation.component';
import { EmptyComponent } from '@app/app/pages/empty.component';
import { DocumentationPageComponent } from '@app/app/pages/documentation/page.component';
import { StaticPageComponent } from '@app/app/pages/static-page.component';
import { NotFoundComponent } from '@app/app/pages/not-found.component';
import { Injectable } from '@angular/core';
import { BlogComponent, BlogListComponent, BlogPostDetailComponent } from '@app/app/pages/blog.component';
import { BookComponent } from '@app/app/pages/documentation/book.component.js';

export const legacyDocMatcher: UrlMatcher = (segments: UrlSegment[]) => {
    if (segments.length === 0 || segments[0].path !== 'documentation') return null;
    const rest = segments.slice(1).map(s => s.path).join('/');
    return { consumed: segments, posParams: { rest: new UrlSegment(rest, {}) } };
};

@Injectable({ providedIn: 'root' })
export class LegacyDocRedirectGuard implements CanActivate {
    constructor(private router: Router) {}
    canActivate(route: ActivatedRouteSnapshot): false {
        const rest = (route.params['rest'] as string) || '';
        const target = rest ? `/en/documentation/${rest}` : `/en/documentation`;
        this.router.navigateByUrl(target, { replaceUrl: true });
        return false;
    }
}

function redirect(from: string, to: string): Route {
    return {
        path: from,
        pathMatch: 'full',
        redirectTo: to,
    };
}

@Injectable({ providedIn: 'root' })
export class NotFoundGuard implements CanActivate {
    canActivate(route: ActivatedRouteSnapshot): boolean {
        return !('try' in route.queryParams);
    }
}

export const routes: Routes = [
    redirect('documentation/orm/plugin/soft-delete', 'documentation/orm/plugin-soft-delete'),
    redirect('documentation/framework/cli', 'documentation/app'),
    redirect('documentation/type/types', 'documentation/runtime-types'),
    redirect('documentation/type/serialization', 'documentation/runtime-types/serialization'),
    redirect('documentation/framework/rpc/controller', 'documentation/rpc/getting-started'),

    { path: 'documentation', pathMatch: 'full', redirectTo: 'en/documentation' },
    { matcher: legacyDocMatcher, canActivate: [LegacyDocRedirectGuard], component: EmptyComponent },

    // {
    //     path: 'benchmarks',
    //     loadChildren: () => import('./benchmarks/benchmarks.module').then(m => m.BenchmarksModule),
    // },

    { path: '', pathMatch: 'full', component: StartpageComponent },
    { path: 'zh', pathMatch: 'full', component: StartpageComponent },
    { path: 'ko', pathMatch: 'full', component: StartpageComponent },
    { path: 'ja', pathMatch: 'full', component: StartpageComponent },
    { path: 'de', pathMatch: 'full', component: StartpageComponent },

    { path: 'admin', loadComponent: () => import('./pages/admin/admin.component').then(v => v.AdminComponent) },
    // { path: 'library', component: LibrariesComponent },
    // { path: 'library/:id', component: LibraryComponent },
    // { path: 'enterprise', component: EnterpriseComponent },
    // { path: 'community', component: CommunityComponent },
    { path: 'terms', component: StaticPageComponent, data: { page: 'terms' } },
    { path: 'about-us', component: StaticPageComponent, data: { page: 'about-us' } },
    { path: 'contact', component: StaticPageComponent, data: { page: 'contact' } },
    { path: 'data-protection', component: StaticPageComponent, data: { page: 'data-protection' } },
    { path: ':lang/documentation/book', component: BookComponent },
    {
        path: ':lang/blog', component: BlogComponent, children: [
            { path: '', pathMatch: 'full', component: BlogListComponent },
            { path: ':slug', component: BlogPostDetailComponent },
        ],
    },
    {
        path: ':lang/documentation',
        component: DocumentationComponent,
        data: { search: true, footer: false, hideLogo: true },
        children: [
            // {
            //     path: 'questions', component: EmptyComponent, children: [
            //         { path: 'post/:slug', component: CommunityQuestionComponent },
            //         { path: '**', component: CommunityQuestionsComponent },
            //     ],
            // },
            // { path: 'search', component: DocuSearchComponent },
            // { path: 'examples', component: ExamplesComponent },
            { path: 'desktop-ui', loadChildren: () => import('./pages/documentation/desktop-ui/desktop-ui.module').then(v => v.DocDesktopUIModule) },
            // { path: ':category/examples/:slug', component: ExampleComponent },
            // { path: ':category/examples', component: ExamplesComponent },
            { path: '**', component: DocumentationPageComponent },
        ],
    },

    // 404
    { path: '**', component: NotFoundComponent, canActivate: [NotFoundGuard] },
];
