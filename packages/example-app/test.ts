interface FilterQuery<T> {}

class Peter {
    query?: FilterQuery<any>;
}

console.log((Peter as any).__type);
