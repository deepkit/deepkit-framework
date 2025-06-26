import { Routes } from '@angular/router';
import { DatabaseBrowserComponent } from './views/database-browser.component';
import { DatabaseComponent } from './views/database.component';

export const routes: Routes = [
    { path: 'database/:database/:entity', component: DatabaseBrowserComponent },
    { path: 'database/:database', component: DatabaseComponent },
];
