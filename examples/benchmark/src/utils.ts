interface OptimizationStatus {
    function?: true;
    neverOptimised?: true;
    alwaysOptimised?: true;
    maybeDeoptimized?: true;
    optimized?: true;
    optimizedByTurboFan?: true;
    interpreted?: true;
    markedForOptimization?: true;
    markedForConcurrentOptimization?: true;
    optimizingConcurrently?: true;
    executing?: true;
    turboFanned?: true;
    binary: string;
}

export function warmup(cb: () => any, times: number = 100_000) {
    for (let i = 0; i < times; i++) {
        cb();
    }
}

/**
 * See
 * https://chromium.googlesource.com/external/v8/+/95fef17346bb1ca4e29e5d28115046f52d78af51/src/runtime/runtime.h
 */
export function NativeRuntimeCall(name: string, ...args): any | undefined {
    try {
        const a = args.map((v, i) => 'args[' + i + ']').join(', ');
        return eval('%' + name + '(' + a + ')');
    } catch (e) {
        console.log('error native runtime call', e);
        return;
    }
}

export function HasFastSmiElements(obj: any) {
    NativeRuntimeCall('HasFastSmiElements', obj);
}

export function HasFastObjectElements(obj: any) {
    NativeRuntimeCall('HasFastObjectElements', obj);
}

export function HasFastHoleyElements(obj: any) {
    NativeRuntimeCall('HasFastHoleyElements', obj);
}

export function HasFastProperties(obj: any) {
    NativeRuntimeCall('HasFastProperties', obj);
}

export function OptimizeFunctionOnNextCall(obj: any) {
    NativeRuntimeCall('OptimizeFunctionOnNextCall', obj);
}

/**
 * See https://gist.github.com/naugtur/4b03a9f9f72346a9f79d7969728a849f
 */
export function GetOptimizationStatus(obj: any) {
    const status = NativeRuntimeCall('GetOptimizationStatus', obj);
    if (status === undefined) return;
    const res: OptimizationStatus = {binary: status.toString(2).padStart(12, '0')};

    if (status & (1 << 0)) {
        res.function = true;
    }

    if (status & (1 << 1)) {
        res.neverOptimised = true;
    }

    if (status & (1 << 2)) {
        res.alwaysOptimised = true;
    }

    if (status & (1 << 3)) {
        res.maybeDeoptimized = true;
    }

    if (status & (1 << 4)) {
        res.optimized = true;
    }

    if (status & (1 << 5)) {
        res.optimizedByTurboFan = true;
    }

    if (status & (1 << 6)) {
        res.interpreted = true;
    }

    if (status & (1 << 7)) {
        res.markedForOptimization = true;
    }

    if (status & (1 << 8)) {
        res.markedForConcurrentOptimization = true;
    }

    if (status & (1 << 9)) {
        res.optimizingConcurrently = true;
    }

    if (status & (1 << 10)) {
        res.executing = true;
    }

    if (status & (1 << 11)) {
        res.turboFanned = true;
    }

    return res;
}
