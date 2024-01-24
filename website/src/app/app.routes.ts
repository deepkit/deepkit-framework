import { Route, Routes } from '@angular/router';
import { CommunityComponent } from '@app/app/pages/community.component';
import { DocumentationComponent } from '@app/app/pages/documentation.component';
import { CommunityQuestionComponent } from '@app/app/pages/documentation/community-question.component';
import { CommunityQuestionsComponent } from '@app/app/pages/documentation/community-questions.component';
import { ExampleComponent } from '@app/app/pages/documentation/example.component';
import { ExamplesComponent } from '@app/app/pages/documentation/examples.component';
import { DocumentationPageComponent } from '@app/app/pages/documentation/page.component';
import { DocuSearchComponent } from '@app/app/pages/documentation/search.component';
import { EmptyComponent } from '@app/app/pages/empty.component';
import { EnterpriseComponent } from '@app/app/pages/enterprise.component';
import { LibrariesComponent } from '@app/app/pages/libraries/libraries.component';
import { LibraryComponent } from '@app/app/pages/libraries/library.component';
import { NotFoundComponent } from '@app/app/pages/not-found.component';
import { StartpageComponent } from '@app/app/pages/startpage.component';
import { StaticPageComponent } from '@app/app/pages/static-page.component';

function redirect(from: string, to: string): Route {
    return {
        path: from,
        pathMatch: 'full',
        redirectTo: to,
    };
}

export const routes: Routes = [
    redirect('documentation/orm/plugin/soft-delete', 'documentation/orm/plugin-soft-delete'),
    redirect('documentation/framework/cli', 'documentation/app'),
    redirect('documentation/type/types', 'documentation/runtime-types'),
    redirect('documentation/type/serialization', 'documentation/runtime-types/serialization'),
    redirect('documentation/framework/rpc/controller', 'documentation/rpc/getting-started'),

    {
        path: 'benchmarks',
        loadChildren: () => import('./benchmarks/benchmarks.module').then(m => m.BenchmarksModule),
    },

    { path: '', pathMatch: 'full', component: StartpageComponent },
    { path: 'library', component: LibrariesComponent },
    { path: 'library/:id', component: LibraryComponent },
    { path: 'enterprise', component: EnterpriseComponent },
    { path: 'community', component: CommunityComponent },
    { path: 'terms', component: StaticPageComponent, data: { page: 'terms' } },
    { path: 'about-us', component: StaticPageComponent, data: { page: 'about-us' } },
    { path: 'contact', component: StaticPageComponent, data: { page: 'contact' } },
    { path: 'data-protection', component: StaticPageComponent, data: { page: 'data-protection' } },

    {
        path: 'documentation',
        component: DocumentationComponent,
        data: { stickyHeader: true, search: true, footer: false },
        children: [
            {
                path: 'questions',
                component: EmptyComponent,
                children: [
                    { path: 'post/:id', component: CommunityQuestionComponent },
                    { path: '**', component: CommunityQuestionsComponent },
                ],
            },
            { path: 'search', component: DocuSearchComponent },
            { path: 'examples', component: ExamplesComponent },
            { path: ':category/examples/:slug', component: ExampleComponent },
            { path: ':category/examples', component: ExamplesComponent },
            { path: '**', component: DocumentationPageComponent },
        ],
    },

    // 404
    { path: '**', component: NotFoundComponent },
];
