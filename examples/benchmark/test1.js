function memoize(fn) {
    'use strict';
    var stack0, stack1;

    return function (arg0, arg1, arg2, arg3, arg4) {
        'use strict';
        switch (true) {

            case (!stack0 || (arg0 === stack0.arg0 && arg1 === stack0.arg1 && arg2 === stack0.arg2 && arg3 === stack0.arg3 && arg4 === stack0.arg4)): {
                if (!stack0) {
                    stack0 = {arg0, arg1, arg2, arg3, arg4, result: fn(arg0, arg1, arg2, arg3, arg4)};
                }
                return stack0.result;
            }


            case (!stack1 || (arg0 === stack1.arg0 && arg1 === stack1.arg1 && arg2 === stack1.arg2 && arg3 === stack1.arg3 && arg4 === stack1.arg4)): {
                if (!stack1) {
                    stack1 = {arg0, arg1, arg2, arg3, arg4, result: fn(arg0, arg1, arg2, arg3, arg4)};
                }
                return stack1.result;
            }

        }

        //here could be other linked memoizeWithJIT() calls
        //or in worst case a array/hashmap lookup
        return fn(arg0, arg1, arg2, arg3, arg4);
    }
}

//coped from https://github.com/medikoo/memoizee/issues/27
function fn(value, leftMin, leftMax, rightMin, rightMax) {
    var leftSpan = leftMax - leftMin;
    var rightSpan = rightMax - rightMin;

    var scaled = (value - leftMin) / leftSpan;
    return rightMin + scaled * rightSpan;
}

const memoized = memoize(fn);

for (let i = 0; i < 10000000; i++) {
    memoized(0, 0, 10, 10, 100);
}
