import { ApiRoute } from '../../api';


export function filterAndSortRoutes(routes: ApiRoute[], options: {filterMethod: string, filterPath: string, groupBy: string, filterCategory: string, filterGroup: string}) {
    let filteredRoutes = routes.filter(v => {
        if (options.filterMethod && !v.httpMethods.includes(options.filterMethod)) return false;
        if (options.filterPath && !v.path.includes(options.filterPath)) return false;
        if (options.filterCategory && v.category !== options.filterCategory) return false;
        if (options.filterGroup && !v.groups.includes(options.filterGroup)) return false;
        return true;
    });

    if (options.groupBy === 'controller') {
        filteredRoutes.sort((a, b) => {
            if (a.controller > b.controller) return +1;
            if (a.controller < b.controller) return -1;

            if (a.path > b.path) return +1;
            if (a.path < b.path) return -1;
            return 0;
        });
    } else if (options.groupBy === 'method') {
        filteredRoutes.sort((a, b) => {
            if (a.httpMethods[0] > b.httpMethods[0]) return +1;
            if (a.httpMethods[0] < b.httpMethods[0]) return -1;

            if (a.path > b.path) return +1;
            if (a.path < b.path) return -1;
            return 0;
        });
    } else {
        filteredRoutes.sort((a, b) => {
            if (a.path > b.path) return +1;
            if (a.path < b.path) return -1;
            return 0;
        });
    }
    return filteredRoutes;
}
