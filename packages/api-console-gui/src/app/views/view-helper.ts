import { ApiAction, ApiRoute } from '@deepkit/api-console-api';


export function filterAndSortActions(actions: ApiAction[], options: {filterPath: string, groupBy: string, filterCategory: string, filterGroup: string}) {
    let filtered = actions.filter(v => {
        if (options.filterPath && !v.methodName.includes(options.filterPath)) return false;
        if (options.filterCategory && v.category !== options.filterCategory) return false;
        if (options.filterGroup && !v.groups.includes(options.filterGroup)) return false;
        return true;
    });

    if (options.groupBy === 'controller') {
        filtered.sort((a, b) => {
            if (a.controllerClassName > b.controllerClassName) return +1;
            if (a.controllerClassName < b.controllerClassName) return -1;

            if (a.methodName > b.methodName) return +1;
            if (a.methodName < b.methodName) return -1;
            return 0;
        });
    } else {
        filtered.sort((a, b) => {
            if (a.methodName > b.methodName) return +1;
            if (a.methodName < b.methodName) return -1;
            return 0;
        });
    }

    return filtered;
}

export function filterAndSortRoutes(routes: ApiRoute[], options: {filterMethod: string, filterPath: string, groupBy: string, filterCategory: string, filterGroup: string}) {
    let filtered = routes.filter(v => {
        if (options.filterMethod && !v.httpMethods.includes(options.filterMethod)) return false;
        if (options.filterPath && !v.path.includes(options.filterPath)) return false;
        if (options.filterCategory && v.category !== options.filterCategory) return false;
        if (options.filterGroup && !v.groups.includes(options.filterGroup)) return false;
        return true;
    });

    if (options.groupBy === 'controller') {
        filtered.sort((a, b) => {
            if (a.controller > b.controller) return +1;
            if (a.controller < b.controller) return -1;

            if (a.path > b.path) return +1;
            if (a.path < b.path) return -1;
            return 0;
        });
    } else if (options.groupBy === 'method') {
        filtered.sort((a, b) => {
            if (a.httpMethods[0] > b.httpMethods[0]) return +1;
            if (a.httpMethods[0] < b.httpMethods[0]) return -1;

            if (a.path > b.path) return +1;
            if (a.path < b.path) return -1;
            return 0;
        });
    } else {
        filtered.sort((a, b) => {
            if (a.path > b.path) return +1;
            if (a.path < b.path) return -1;
            return 0;
        });
    }
    return filtered;
}
