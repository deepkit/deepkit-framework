!(function (t) {
    var e = {};
    function n(r) {
        if (e[r]) return e[r].exports;
        var i = (e[r] = { i: r, l: !1, exports: {} });
        return t[r].call(i.exports, i, i.exports, n), (i.l = !0), i.exports;
    }
    (n.m = t),
        (n.c = e),
        (n.d = function (t, e, r) {
            n.o(t, e) || Object.defineProperty(t, e, { enumerable: !0, get: r });
        }),
        (n.r = function (t) {
            'undefined' != typeof Symbol &&
                Symbol.toStringTag &&
                Object.defineProperty(t, Symbol.toStringTag, {
                    value: 'Module',
                }),
                Object.defineProperty(t, '__esModule', { value: !0 });
        }),
        (n.t = function (t, e) {
            if ((1 & e && (t = n(t)), 8 & e)) return t;
            if (4 & e && 'object' == typeof t && t && t.__esModule) return t;
            var r = Object.create(null);
            if (
                (n.r(r),
                Object.defineProperty(r, 'default', {
                    enumerable: !0,
                    value: t,
                }),
                2 & e && 'string' != typeof t)
            )
                for (var i in t)
                    n.d(
                        r,
                        i,
                        function (e) {
                            return t[e];
                        }.bind(null, i),
                    );
            return r;
        }),
        (n.n = function (t) {
            var e =
                t && t.__esModule
                    ? function () {
                          return t.default;
                      }
                    : function () {
                          return t;
                      };
            return n.d(e, 'a', e), e;
        }),
        (n.o = function (t, e) {
            return Object.prototype.hasOwnProperty.call(t, e);
        }),
        (n.p = ''),
        n((n.s = 25));
})([
    function (t, e) {
        t.exports = require('path');
    },
    function (t, e, n) {
        var r,
            i,
            o = n(3),
            a = n(26),
            s = n(28),
            u = n(29),
            c = n(30);
        function f(t, e) {
            Object.defineProperty(t, r, {
                get: function () {
                    return e;
                },
            });
        }
        'function' == typeof Symbol && 'function' == typeof Symbol.for
            ? ((r = Symbol.for('graceful-fs.queue')), (i = Symbol.for('graceful-fs.previous')))
            : ((r = '___graceful-fs.queue'), (i = '___graceful-fs.previous'));
        var h = function () {};
        if (
            (c.debuglog
                ? (h = c.debuglog('gfs4'))
                : /\bgfs4\b/i.test(process.env.NODE_DEBUG || '') &&
                  (h = function () {
                      var t = c.format.apply(c, arguments);
                      (t = 'GFS4: ' + t.split(/\n/).join('\nGFS4: ')), console.error(t);
                  }),
            !o[r])
        ) {
            var l = global[r] || [];
            f(o, l),
                (o.close = (function (t) {
                    function e(e, n) {
                        return t.call(o, e, function (t) {
                            t || v(), 'function' == typeof n && n.apply(this, arguments);
                        });
                    }
                    return Object.defineProperty(e, i, { value: t }), e;
                })(o.close)),
                (o.closeSync = (function (t) {
                    function e(e) {
                        t.apply(o, arguments), v();
                    }
                    return Object.defineProperty(e, i, { value: t }), e;
                })(o.closeSync)),
                /\bgfs4\b/i.test(process.env.NODE_DEBUG || '') &&
                    process.on('exit', function () {
                        h(o[r]), n(15).equal(o[r].length, 0);
                    });
        }
        function p(t) {
            a(t),
                (t.gracefulify = p),
                (t.createReadStream = function (e, n) {
                    return new t.ReadStream(e, n);
                }),
                (t.createWriteStream = function (e, n) {
                    return new t.WriteStream(e, n);
                });
            var e = t.readFile;
            t.readFile = function (t, n, r) {
                'function' == typeof n && ((r = n), (n = null));
                return (function t(n, r, i) {
                    return e(n, r, function (e) {
                        !e || ('EMFILE' !== e.code && 'ENFILE' !== e.code)
                            ? ('function' == typeof i && i.apply(this, arguments), v())
                            : d([t, [n, r, i]]);
                    });
                })(t, n, r);
            };
            var n = t.writeFile;
            t.writeFile = function (t, e, r, i) {
                'function' == typeof r && ((i = r), (r = null));
                return (function t(e, r, i, o) {
                    return n(e, r, i, function (n) {
                        !n || ('EMFILE' !== n.code && 'ENFILE' !== n.code)
                            ? ('function' == typeof o && o.apply(this, arguments), v())
                            : d([t, [e, r, i, o]]);
                    });
                })(t, e, r, i);
            };
            var r = t.appendFile;
            r &&
                (t.appendFile = function (t, e, n, i) {
                    'function' == typeof n && ((i = n), (n = null));
                    return (function t(e, n, i, o) {
                        return r(e, n, i, function (r) {
                            !r || ('EMFILE' !== r.code && 'ENFILE' !== r.code)
                                ? ('function' == typeof o && o.apply(this, arguments), v())
                                : d([t, [e, n, i, o]]);
                        });
                    })(t, e, n, i);
                });
            var i = t.copyFile;
            i &&
                (t.copyFile = function (t, e, n, r) {
                    'function' == typeof n && ((r = n), (n = 0));
                    return i(t, e, n, function (o) {
                        !o || ('EMFILE' !== o.code && 'ENFILE' !== o.code)
                            ? ('function' == typeof r && r.apply(this, arguments), v())
                            : d([i, [t, e, n, r]]);
                    });
                });
            var o = t.readdir;
            function u(e) {
                return o.apply(t, e);
            }
            if (
                ((t.readdir = function (t, e, n) {
                    var r = [t];
                    'function' != typeof e ? r.push(e) : (n = e);
                    return (
                        r.push(function (t, e) {
                            e && e.sort && e.sort();
                            !t || ('EMFILE' !== t.code && 'ENFILE' !== t.code)
                                ? ('function' == typeof n && n.apply(this, arguments), v())
                                : d([u, [r]]);
                        }),
                        u(r)
                    );
                }),
                'v0.8' === process.version.substr(0, 4))
            ) {
                var c = s(t);
                (y = c.ReadStream), (g = c.WriteStream);
            }
            var f = t.ReadStream;
            f &&
                ((y.prototype = Object.create(f.prototype)),
                (y.prototype.open = function () {
                    var t = this;
                    w(t.path, t.flags, t.mode, function (e, n) {
                        e
                            ? (t.autoClose && t.destroy(), t.emit('error', e))
                            : ((t.fd = n), t.emit('open', n), t.read());
                    });
                }));
            var h = t.WriteStream;
            h &&
                ((g.prototype = Object.create(h.prototype)),
                (g.prototype.open = function () {
                    var t = this;
                    w(t.path, t.flags, t.mode, function (e, n) {
                        e ? (t.destroy(), t.emit('error', e)) : ((t.fd = n), t.emit('open', n));
                    });
                })),
                Object.defineProperty(t, 'ReadStream', {
                    get: function () {
                        return y;
                    },
                    set: function (t) {
                        y = t;
                    },
                    enumerable: !0,
                    configurable: !0,
                }),
                Object.defineProperty(t, 'WriteStream', {
                    get: function () {
                        return g;
                    },
                    set: function (t) {
                        g = t;
                    },
                    enumerable: !0,
                    configurable: !0,
                });
            var l = y;
            Object.defineProperty(t, 'FileReadStream', {
                get: function () {
                    return l;
                },
                set: function (t) {
                    l = t;
                },
                enumerable: !0,
                configurable: !0,
            });
            var m = g;
            function y(t, e) {
                return this instanceof y
                    ? (f.apply(this, arguments), this)
                    : y.apply(Object.create(y.prototype), arguments);
            }
            function g(t, e) {
                return this instanceof g
                    ? (h.apply(this, arguments), this)
                    : g.apply(Object.create(g.prototype), arguments);
            }
            Object.defineProperty(t, 'FileWriteStream', {
                get: function () {
                    return m;
                },
                set: function (t) {
                    m = t;
                },
                enumerable: !0,
                configurable: !0,
            });
            var _ = t.open;
            function w(t, e, n, r) {
                return (
                    'function' == typeof n && ((r = n), (n = null)),
                    (function t(e, n, r, i) {
                        return _(e, n, r, function (o, a) {
                            !o || ('EMFILE' !== o.code && 'ENFILE' !== o.code)
                                ? ('function' == typeof i && i.apply(this, arguments), v())
                                : d([t, [e, n, r, i]]);
                        });
                    })(t, e, n, r)
                );
            }
            return (t.open = w), t;
        }
        function d(t) {
            h('ENQUEUE', t[0].name, t[1]), o[r].push(t);
        }
        function v() {
            var t = o[r].shift();
            t && (h('RETRY', t[0].name, t[1]), t[0].apply(null, t[1]));
        }
        global[r] || f(global, o[r]),
            (t.exports = p(u(o))),
            process.env.TEST_GRACEFUL_FS_GLOBAL_PATCH && !o.__patched && ((t.exports = p(o)), (o.__patched = !0));
    },
    function (t, e, n) {
        (function (t) {
            var r;
            /**
             * @license
             * Lodash <https://lodash.com/>
             * Copyright OpenJS Foundation and other contributors <https://openjsf.org/>
             * Released under MIT license <https://lodash.com/license>
             * Based on Underscore.js 1.8.3 <http://underscorejs.org/LICENSE>
             * Copyright Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
             */ (function () {
                var i = 'Expected a function',
                    o = '__lodash_placeholder__',
                    a = [
                        ['ary', 128],
                        ['bind', 1],
                        ['bindKey', 2],
                        ['curry', 8],
                        ['curryRight', 16],
                        ['flip', 512],
                        ['partial', 32],
                        ['partialRight', 64],
                        ['rearg', 256],
                    ],
                    s = '[object Arguments]',
                    u = '[object Array]',
                    c = '[object Boolean]',
                    f = '[object Date]',
                    h = '[object Error]',
                    l = '[object Function]',
                    p = '[object GeneratorFunction]',
                    d = '[object Map]',
                    v = '[object Number]',
                    m = '[object Object]',
                    y = '[object RegExp]',
                    g = '[object Set]',
                    _ = '[object String]',
                    w = '[object Symbol]',
                    b = '[object WeakMap]',
                    x = '[object ArrayBuffer]',
                    E = '[object DataView]',
                    S = '[object Float32Array]',
                    T = '[object Float64Array]',
                    N = '[object Int8Array]',
                    O = '[object Int16Array]',
                    A = '[object Int32Array]',
                    C = '[object Uint8Array]',
                    I = '[object Uint16Array]',
                    M = '[object Uint32Array]',
                    D = /\b__p \+= '';/g,
                    U = /\b(__p \+=) '' \+/g,
                    k = /(__e\(.*?\)|\b__t\)) \+\n'';/g,
                    P = /&(?:amp|lt|gt|quot|#39);/g,
                    R = /[&<>"']/g,
                    F = RegExp(P.source),
                    L = RegExp(R.source),
                    j = /<%-([\s\S]+?)%>/g,
                    z = /<%([\s\S]+?)%>/g,
                    B = /<%=([\s\S]+?)%>/g,
                    V = /\.|\[(?:[^[\]]*|(["'])(?:(?!\1)[^\\]|\\.)*?\1)\]/,
                    q = /^\w*$/,
                    Y =
                        /[^.[\]]+|\[(?:(-?\d+(?:\.\d+)?)|(["'])((?:(?!\2)[^\\]|\\.)*?)\2)\]|(?=(?:\.|\[\])(?:\.|\[\]|$))/g,
                    X = /[\\^$.*+?()[\]{}|]/g,
                    G = RegExp(X.source),
                    H = /^\s+|\s+$/g,
                    W = /^\s+/,
                    $ = /\s+$/,
                    Q = /\{(?:\n\/\* \[wrapped with .+\] \*\/)?\n?/,
                    Z = /\{\n\/\* \[wrapped with (.+)\] \*/,
                    J = /,? & /,
                    K = /[^\x00-\x2f\x3a-\x40\x5b-\x60\x7b-\x7f]+/g,
                    tt = /\\(\\)?/g,
                    et = /\$\{([^\\}]*(?:\\.[^\\}]*)*)\}/g,
                    nt = /\w*$/,
                    rt = /^[-+]0x[0-9a-f]+$/i,
                    it = /^0b[01]+$/i,
                    ot = /^\[object .+?Constructor\]$/,
                    at = /^0o[0-7]+$/i,
                    st = /^(?:0|[1-9]\d*)$/,
                    ut = /[\xc0-\xd6\xd8-\xf6\xf8-\xff\u0100-\u017f]/g,
                    ct = /($^)/,
                    ft = /['\n\r\u2028\u2029\\]/g,
                    ht = '\\u0300-\\u036f\\ufe20-\\ufe2f\\u20d0-\\u20ff',
                    lt =
                        '\\xac\\xb1\\xd7\\xf7\\x00-\\x2f\\x3a-\\x40\\x5b-\\x60\\x7b-\\xbf\\u2000-\\u206f \\t\\x0b\\f\\xa0\\ufeff\\n\\r\\u2028\\u2029\\u1680\\u180e\\u2000\\u2001\\u2002\\u2003\\u2004\\u2005\\u2006\\u2007\\u2008\\u2009\\u200a\\u202f\\u205f\\u3000',
                    pt = '[\\ud800-\\udfff]',
                    dt = '[' + lt + ']',
                    vt = '[' + ht + ']',
                    mt = '\\d+',
                    yt = '[\\u2700-\\u27bf]',
                    gt = '[a-z\\xdf-\\xf6\\xf8-\\xff]',
                    _t =
                        '[^\\ud800-\\udfff' +
                        lt +
                        mt +
                        '\\u2700-\\u27bfa-z\\xdf-\\xf6\\xf8-\\xffA-Z\\xc0-\\xd6\\xd8-\\xde]',
                    wt = '\\ud83c[\\udffb-\\udfff]',
                    bt = '[^\\ud800-\\udfff]',
                    xt = '(?:\\ud83c[\\udde6-\\uddff]){2}',
                    Et = '[\\ud800-\\udbff][\\udc00-\\udfff]',
                    St = '[A-Z\\xc0-\\xd6\\xd8-\\xde]',
                    Tt = '(?:' + gt + '|' + _t + ')',
                    Nt = '(?:' + St + '|' + _t + ')',
                    Ot = '(?:' + vt + '|' + wt + ')' + '?',
                    At =
                        '[\\ufe0e\\ufe0f]?' +
                        Ot +
                        ('(?:\\u200d(?:' + [bt, xt, Et].join('|') + ')[\\ufe0e\\ufe0f]?' + Ot + ')*'),
                    Ct = '(?:' + [yt, xt, Et].join('|') + ')' + At,
                    It = '(?:' + [bt + vt + '?', vt, xt, Et, pt].join('|') + ')',
                    Mt = RegExp("['’]", 'g'),
                    Dt = RegExp(vt, 'g'),
                    Ut = RegExp(wt + '(?=' + wt + ')|' + It + At, 'g'),
                    kt = RegExp(
                        [
                            St + '?' + gt + "+(?:['’](?:d|ll|m|re|s|t|ve))?(?=" + [dt, St, '$'].join('|') + ')',
                            Nt + "+(?:['’](?:D|LL|M|RE|S|T|VE))?(?=" + [dt, St + Tt, '$'].join('|') + ')',
                            St + '?' + Tt + "+(?:['’](?:d|ll|m|re|s|t|ve))?",
                            St + "+(?:['’](?:D|LL|M|RE|S|T|VE))?",
                            '\\d*(?:1ST|2ND|3RD|(?![123])\\dTH)(?=\\b|[a-z_])',
                            '\\d*(?:1st|2nd|3rd|(?![123])\\dth)(?=\\b|[A-Z_])',
                            mt,
                            Ct,
                        ].join('|'),
                        'g',
                    ),
                    Pt = RegExp('[\\u200d\\ud800-\\udfff' + ht + '\\ufe0e\\ufe0f]'),
                    Rt = /[a-z][A-Z]|[A-Z]{2}[a-z]|[0-9][a-zA-Z]|[a-zA-Z][0-9]|[^a-zA-Z0-9 ]/,
                    Ft = [
                        'Array',
                        'Buffer',
                        'DataView',
                        'Date',
                        'Error',
                        'Float32Array',
                        'Float64Array',
                        'Function',
                        'Int8Array',
                        'Int16Array',
                        'Int32Array',
                        'Map',
                        'Math',
                        'Object',
                        'Promise',
                        'RegExp',
                        'Set',
                        'String',
                        'Symbol',
                        'TypeError',
                        'Uint8Array',
                        'Uint8ClampedArray',
                        'Uint16Array',
                        'Uint32Array',
                        'WeakMap',
                        '_',
                        'clearTimeout',
                        'isFinite',
                        'parseInt',
                        'setTimeout',
                    ],
                    Lt = -1,
                    jt = {};
                (jt[S] = jt[T] = jt[N] = jt[O] = jt[A] = jt[C] = jt['[object Uint8ClampedArray]'] = jt[I] = jt[M] = !0),
                    (jt[s] =
                        jt[u] =
                        jt[x] =
                        jt[c] =
                        jt[E] =
                        jt[f] =
                        jt[h] =
                        jt[l] =
                        jt[d] =
                        jt[v] =
                        jt[m] =
                        jt[y] =
                        jt[g] =
                        jt[_] =
                        jt[b] =
                            !1);
                var zt = {};
                (zt[s] =
                    zt[u] =
                    zt[x] =
                    zt[E] =
                    zt[c] =
                    zt[f] =
                    zt[S] =
                    zt[T] =
                    zt[N] =
                    zt[O] =
                    zt[A] =
                    zt[d] =
                    zt[v] =
                    zt[m] =
                    zt[y] =
                    zt[g] =
                    zt[_] =
                    zt[w] =
                    zt[C] =
                    zt['[object Uint8ClampedArray]'] =
                    zt[I] =
                    zt[M] =
                        !0),
                    (zt[h] = zt[l] = zt[b] = !1);
                var Bt = {
                        '\\': '\\',
                        "'": "'",
                        '\n': 'n',
                        '\r': 'r',
                        '\u2028': 'u2028',
                        '\u2029': 'u2029',
                    },
                    Vt = parseFloat,
                    qt = parseInt,
                    Yt = 'object' == typeof global && global && global.Object === Object && global,
                    Xt = 'object' == typeof self && self && self.Object === Object && self,
                    Gt = Yt || Xt || Function('return this')(),
                    Ht = e && !e.nodeType && e,
                    Wt = Ht && 'object' == typeof t && t && !t.nodeType && t,
                    $t = Wt && Wt.exports === Ht,
                    Qt = $t && Yt.process,
                    Zt = (function () {
                        try {
                            var t = Wt && Wt.require && Wt.require('util').types;
                            return t || (Qt && Qt.binding && Qt.binding('util'));
                        } catch (t) {}
                    })(),
                    Jt = Zt && Zt.isArrayBuffer,
                    Kt = Zt && Zt.isDate,
                    te = Zt && Zt.isMap,
                    ee = Zt && Zt.isRegExp,
                    ne = Zt && Zt.isSet,
                    re = Zt && Zt.isTypedArray;
                function ie(t, e, n) {
                    switch (n.length) {
                        case 0:
                            return t.call(e);
                        case 1:
                            return t.call(e, n[0]);
                        case 2:
                            return t.call(e, n[0], n[1]);
                        case 3:
                            return t.call(e, n[0], n[1], n[2]);
                    }
                    return t.apply(e, n);
                }
                function oe(t, e, n, r) {
                    for (var i = -1, o = null == t ? 0 : t.length; ++i < o; ) {
                        var a = t[i];
                        e(r, a, n(a), t);
                    }
                    return r;
                }
                function ae(t, e) {
                    for (var n = -1, r = null == t ? 0 : t.length; ++n < r && !1 !== e(t[n], n, t); );
                    return t;
                }
                function se(t, e) {
                    for (var n = null == t ? 0 : t.length; n-- && !1 !== e(t[n], n, t); );
                    return t;
                }
                function ue(t, e) {
                    for (var n = -1, r = null == t ? 0 : t.length; ++n < r; ) if (!e(t[n], n, t)) return !1;
                    return !0;
                }
                function ce(t, e) {
                    for (var n = -1, r = null == t ? 0 : t.length, i = 0, o = []; ++n < r; ) {
                        var a = t[n];
                        e(a, n, t) && (o[i++] = a);
                    }
                    return o;
                }
                function fe(t, e) {
                    return !!(null == t ? 0 : t.length) && we(t, e, 0) > -1;
                }
                function he(t, e, n) {
                    for (var r = -1, i = null == t ? 0 : t.length; ++r < i; ) if (n(e, t[r])) return !0;
                    return !1;
                }
                function le(t, e) {
                    for (var n = -1, r = null == t ? 0 : t.length, i = Array(r); ++n < r; ) i[n] = e(t[n], n, t);
                    return i;
                }
                function pe(t, e) {
                    for (var n = -1, r = e.length, i = t.length; ++n < r; ) t[i + n] = e[n];
                    return t;
                }
                function de(t, e, n, r) {
                    var i = -1,
                        o = null == t ? 0 : t.length;
                    for (r && o && (n = t[++i]); ++i < o; ) n = e(n, t[i], i, t);
                    return n;
                }
                function ve(t, e, n, r) {
                    var i = null == t ? 0 : t.length;
                    for (r && i && (n = t[--i]); i--; ) n = e(n, t[i], i, t);
                    return n;
                }
                function me(t, e) {
                    for (var n = -1, r = null == t ? 0 : t.length; ++n < r; ) if (e(t[n], n, t)) return !0;
                    return !1;
                }
                var ye = Se('length');
                function ge(t, e, n) {
                    var r;
                    return (
                        n(t, function (t, n, i) {
                            if (e(t, n, i)) return (r = n), !1;
                        }),
                        r
                    );
                }
                function _e(t, e, n, r) {
                    for (var i = t.length, o = n + (r ? 1 : -1); r ? o-- : ++o < i; ) if (e(t[o], o, t)) return o;
                    return -1;
                }
                function we(t, e, n) {
                    return e == e
                        ? (function (t, e, n) {
                              var r = n - 1,
                                  i = t.length;
                              for (; ++r < i; ) if (t[r] === e) return r;
                              return -1;
                          })(t, e, n)
                        : _e(t, xe, n);
                }
                function be(t, e, n, r) {
                    for (var i = n - 1, o = t.length; ++i < o; ) if (r(t[i], e)) return i;
                    return -1;
                }
                function xe(t) {
                    return t != t;
                }
                function Ee(t, e) {
                    var n = null == t ? 0 : t.length;
                    return n ? Oe(t, e) / n : NaN;
                }
                function Se(t) {
                    return function (e) {
                        return null == e ? void 0 : e[t];
                    };
                }
                function Te(t) {
                    return function (e) {
                        return null == t ? void 0 : t[e];
                    };
                }
                function Ne(t, e, n, r, i) {
                    return (
                        i(t, function (t, i, o) {
                            n = r ? ((r = !1), t) : e(n, t, i, o);
                        }),
                        n
                    );
                }
                function Oe(t, e) {
                    for (var n, r = -1, i = t.length; ++r < i; ) {
                        var o = e(t[r]);
                        void 0 !== o && (n = void 0 === n ? o : n + o);
                    }
                    return n;
                }
                function Ae(t, e) {
                    for (var n = -1, r = Array(t); ++n < t; ) r[n] = e(n);
                    return r;
                }
                function Ce(t) {
                    return function (e) {
                        return t(e);
                    };
                }
                function Ie(t, e) {
                    return le(e, function (e) {
                        return t[e];
                    });
                }
                function Me(t, e) {
                    return t.has(e);
                }
                function De(t, e) {
                    for (var n = -1, r = t.length; ++n < r && we(e, t[n], 0) > -1; );
                    return n;
                }
                function Ue(t, e) {
                    for (var n = t.length; n-- && we(e, t[n], 0) > -1; );
                    return n;
                }
                function ke(t, e) {
                    for (var n = t.length, r = 0; n--; ) t[n] === e && ++r;
                    return r;
                }
                var Pe = Te({
                        À: 'A',
                        Á: 'A',
                        Â: 'A',
                        Ã: 'A',
                        Ä: 'A',
                        Å: 'A',
                        à: 'a',
                        á: 'a',
                        â: 'a',
                        ã: 'a',
                        ä: 'a',
                        å: 'a',
                        Ç: 'C',
                        ç: 'c',
                        Ð: 'D',
                        ð: 'd',
                        È: 'E',
                        É: 'E',
                        Ê: 'E',
                        Ë: 'E',
                        è: 'e',
                        é: 'e',
                        ê: 'e',
                        ë: 'e',
                        Ì: 'I',
                        Í: 'I',
                        Î: 'I',
                        Ï: 'I',
                        ì: 'i',
                        í: 'i',
                        î: 'i',
                        ï: 'i',
                        Ñ: 'N',
                        ñ: 'n',
                        Ò: 'O',
                        Ó: 'O',
                        Ô: 'O',
                        Õ: 'O',
                        Ö: 'O',
                        Ø: 'O',
                        ò: 'o',
                        ó: 'o',
                        ô: 'o',
                        õ: 'o',
                        ö: 'o',
                        ø: 'o',
                        Ù: 'U',
                        Ú: 'U',
                        Û: 'U',
                        Ü: 'U',
                        ù: 'u',
                        ú: 'u',
                        û: 'u',
                        ü: 'u',
                        Ý: 'Y',
                        ý: 'y',
                        ÿ: 'y',
                        Æ: 'Ae',
                        æ: 'ae',
                        Þ: 'Th',
                        þ: 'th',
                        ß: 'ss',
                        Ā: 'A',
                        Ă: 'A',
                        Ą: 'A',
                        ā: 'a',
                        ă: 'a',
                        ą: 'a',
                        Ć: 'C',
                        Ĉ: 'C',
                        Ċ: 'C',
                        Č: 'C',
                        ć: 'c',
                        ĉ: 'c',
                        ċ: 'c',
                        č: 'c',
                        Ď: 'D',
                        Đ: 'D',
                        ď: 'd',
                        đ: 'd',
                        Ē: 'E',
                        Ĕ: 'E',
                        Ė: 'E',
                        Ę: 'E',
                        Ě: 'E',
                        ē: 'e',
                        ĕ: 'e',
                        ė: 'e',
                        ę: 'e',
                        ě: 'e',
                        Ĝ: 'G',
                        Ğ: 'G',
                        Ġ: 'G',
                        Ģ: 'G',
                        ĝ: 'g',
                        ğ: 'g',
                        ġ: 'g',
                        ģ: 'g',
                        Ĥ: 'H',
                        Ħ: 'H',
                        ĥ: 'h',
                        ħ: 'h',
                        Ĩ: 'I',
                        Ī: 'I',
                        Ĭ: 'I',
                        Į: 'I',
                        İ: 'I',
                        ĩ: 'i',
                        ī: 'i',
                        ĭ: 'i',
                        į: 'i',
                        ı: 'i',
                        Ĵ: 'J',
                        ĵ: 'j',
                        Ķ: 'K',
                        ķ: 'k',
                        ĸ: 'k',
                        Ĺ: 'L',
                        Ļ: 'L',
                        Ľ: 'L',
                        Ŀ: 'L',
                        Ł: 'L',
                        ĺ: 'l',
                        ļ: 'l',
                        ľ: 'l',
                        ŀ: 'l',
                        ł: 'l',
                        Ń: 'N',
                        Ņ: 'N',
                        Ň: 'N',
                        Ŋ: 'N',
                        ń: 'n',
                        ņ: 'n',
                        ň: 'n',
                        ŋ: 'n',
                        Ō: 'O',
                        Ŏ: 'O',
                        Ő: 'O',
                        ō: 'o',
                        ŏ: 'o',
                        ő: 'o',
                        Ŕ: 'R',
                        Ŗ: 'R',
                        Ř: 'R',
                        ŕ: 'r',
                        ŗ: 'r',
                        ř: 'r',
                        Ś: 'S',
                        Ŝ: 'S',
                        Ş: 'S',
                        Š: 'S',
                        ś: 's',
                        ŝ: 's',
                        ş: 's',
                        š: 's',
                        Ţ: 'T',
                        Ť: 'T',
                        Ŧ: 'T',
                        ţ: 't',
                        ť: 't',
                        ŧ: 't',
                        Ũ: 'U',
                        Ū: 'U',
                        Ŭ: 'U',
                        Ů: 'U',
                        Ű: 'U',
                        Ų: 'U',
                        ũ: 'u',
                        ū: 'u',
                        ŭ: 'u',
                        ů: 'u',
                        ű: 'u',
                        ų: 'u',
                        Ŵ: 'W',
                        ŵ: 'w',
                        Ŷ: 'Y',
                        ŷ: 'y',
                        Ÿ: 'Y',
                        Ź: 'Z',
                        Ż: 'Z',
                        Ž: 'Z',
                        ź: 'z',
                        ż: 'z',
                        ž: 'z',
                        Ĳ: 'IJ',
                        ĳ: 'ij',
                        Œ: 'Oe',
                        œ: 'oe',
                        ŉ: "'n",
                        ſ: 's',
                    }),
                    Re = Te({
                        '&': '&amp;',
                        '<': '&lt;',
                        '>': '&gt;',
                        '"': '&quot;',
                        "'": '&#39;',
                    });
                function Fe(t) {
                    return '\\' + Bt[t];
                }
                function Le(t) {
                    return Pt.test(t);
                }
                function je(t) {
                    var e = -1,
                        n = Array(t.size);
                    return (
                        t.forEach(function (t, r) {
                            n[++e] = [r, t];
                        }),
                        n
                    );
                }
                function ze(t, e) {
                    return function (n) {
                        return t(e(n));
                    };
                }
                function Be(t, e) {
                    for (var n = -1, r = t.length, i = 0, a = []; ++n < r; ) {
                        var s = t[n];
                        (s !== e && s !== o) || ((t[n] = o), (a[i++] = n));
                    }
                    return a;
                }
                function Ve(t) {
                    var e = -1,
                        n = Array(t.size);
                    return (
                        t.forEach(function (t) {
                            n[++e] = t;
                        }),
                        n
                    );
                }
                function qe(t) {
                    var e = -1,
                        n = Array(t.size);
                    return (
                        t.forEach(function (t) {
                            n[++e] = [t, t];
                        }),
                        n
                    );
                }
                function Ye(t) {
                    return Le(t)
                        ? (function (t) {
                              var e = (Ut.lastIndex = 0);
                              for (; Ut.test(t); ) ++e;
                              return e;
                          })(t)
                        : ye(t);
                }
                function Xe(t) {
                    return Le(t)
                        ? (function (t) {
                              return t.match(Ut) || [];
                          })(t)
                        : (function (t) {
                              return t.split('');
                          })(t);
                }
                var Ge = Te({
                    '&amp;': '&',
                    '&lt;': '<',
                    '&gt;': '>',
                    '&quot;': '"',
                    '&#39;': "'",
                });
                var He = (function t(e) {
                    var n,
                        r = (e = null == e ? Gt : He.defaults(Gt.Object(), e, He.pick(Gt, Ft))).Array,
                        ht = e.Date,
                        lt = e.Error,
                        pt = e.Function,
                        dt = e.Math,
                        vt = e.Object,
                        mt = e.RegExp,
                        yt = e.String,
                        gt = e.TypeError,
                        _t = r.prototype,
                        wt = pt.prototype,
                        bt = vt.prototype,
                        xt = e['__core-js_shared__'],
                        Et = wt.toString,
                        St = bt.hasOwnProperty,
                        Tt = 0,
                        Nt = (n = /[^.]+$/.exec((xt && xt.keys && xt.keys.IE_PROTO) || '')) ? 'Symbol(src)_1.' + n : '',
                        Ot = bt.toString,
                        At = Et.call(vt),
                        Ct = Gt._,
                        It = mt(
                            '^' +
                                Et.call(St)
                                    .replace(X, '\\$&')
                                    .replace(/hasOwnProperty|(function).*?(?=\\\()| for .+?(?=\\\])/g, '$1.*?') +
                                '$',
                        ),
                        Ut = $t ? e.Buffer : void 0,
                        Pt = e.Symbol,
                        Bt = e.Uint8Array,
                        Yt = Ut ? Ut.allocUnsafe : void 0,
                        Xt = ze(vt.getPrototypeOf, vt),
                        Ht = vt.create,
                        Wt = bt.propertyIsEnumerable,
                        Qt = _t.splice,
                        Zt = Pt ? Pt.isConcatSpreadable : void 0,
                        ye = Pt ? Pt.iterator : void 0,
                        Te = Pt ? Pt.toStringTag : void 0,
                        We = (function () {
                            try {
                                var t = Ki(vt, 'defineProperty');
                                return t({}, '', {}), t;
                            } catch (t) {}
                        })(),
                        $e = e.clearTimeout !== Gt.clearTimeout && e.clearTimeout,
                        Qe = ht && ht.now !== Gt.Date.now && ht.now,
                        Ze = e.setTimeout !== Gt.setTimeout && e.setTimeout,
                        Je = dt.ceil,
                        Ke = dt.floor,
                        tn = vt.getOwnPropertySymbols,
                        en = Ut ? Ut.isBuffer : void 0,
                        nn = e.isFinite,
                        rn = _t.join,
                        on = ze(vt.keys, vt),
                        an = dt.max,
                        sn = dt.min,
                        un = ht.now,
                        cn = e.parseInt,
                        fn = dt.random,
                        hn = _t.reverse,
                        ln = Ki(e, 'DataView'),
                        pn = Ki(e, 'Map'),
                        dn = Ki(e, 'Promise'),
                        vn = Ki(e, 'Set'),
                        mn = Ki(e, 'WeakMap'),
                        yn = Ki(vt, 'create'),
                        gn = mn && new mn(),
                        _n = {},
                        wn = Oo(ln),
                        bn = Oo(pn),
                        xn = Oo(dn),
                        En = Oo(vn),
                        Sn = Oo(mn),
                        Tn = Pt ? Pt.prototype : void 0,
                        Nn = Tn ? Tn.valueOf : void 0,
                        On = Tn ? Tn.toString : void 0;
                    function An(t) {
                        if (Ya(t) && !Ua(t) && !(t instanceof Dn)) {
                            if (t instanceof Mn) return t;
                            if (St.call(t, '__wrapped__')) return Ao(t);
                        }
                        return new Mn(t);
                    }
                    var Cn = (function () {
                        function t() {}
                        return function (e) {
                            if (!qa(e)) return {};
                            if (Ht) return Ht(e);
                            t.prototype = e;
                            var n = new t();
                            return (t.prototype = void 0), n;
                        };
                    })();
                    function In() {}
                    function Mn(t, e) {
                        (this.__wrapped__ = t),
                            (this.__actions__ = []),
                            (this.__chain__ = !!e),
                            (this.__index__ = 0),
                            (this.__values__ = void 0);
                    }
                    function Dn(t) {
                        (this.__wrapped__ = t),
                            (this.__actions__ = []),
                            (this.__dir__ = 1),
                            (this.__filtered__ = !1),
                            (this.__iteratees__ = []),
                            (this.__takeCount__ = 4294967295),
                            (this.__views__ = []);
                    }
                    function Un(t) {
                        var e = -1,
                            n = null == t ? 0 : t.length;
                        for (this.clear(); ++e < n; ) {
                            var r = t[e];
                            this.set(r[0], r[1]);
                        }
                    }
                    function kn(t) {
                        var e = -1,
                            n = null == t ? 0 : t.length;
                        for (this.clear(); ++e < n; ) {
                            var r = t[e];
                            this.set(r[0], r[1]);
                        }
                    }
                    function Pn(t) {
                        var e = -1,
                            n = null == t ? 0 : t.length;
                        for (this.clear(); ++e < n; ) {
                            var r = t[e];
                            this.set(r[0], r[1]);
                        }
                    }
                    function Rn(t) {
                        var e = -1,
                            n = null == t ? 0 : t.length;
                        for (this.__data__ = new Pn(); ++e < n; ) this.add(t[e]);
                    }
                    function Fn(t) {
                        var e = (this.__data__ = new kn(t));
                        this.size = e.size;
                    }
                    function Ln(t, e) {
                        var n = Ua(t),
                            r = !n && Da(t),
                            i = !n && !r && Fa(t),
                            o = !n && !r && !i && Ja(t),
                            a = n || r || i || o,
                            s = a ? Ae(t.length, yt) : [],
                            u = s.length;
                        for (var c in t)
                            (!e && !St.call(t, c)) ||
                                (a &&
                                    ('length' == c ||
                                        (i && ('offset' == c || 'parent' == c)) ||
                                        (o && ('buffer' == c || 'byteLength' == c || 'byteOffset' == c)) ||
                                        ao(c, u))) ||
                                s.push(c);
                        return s;
                    }
                    function jn(t) {
                        var e = t.length;
                        return e ? t[Rr(0, e - 1)] : void 0;
                    }
                    function zn(t, e) {
                        return So(yi(t), $n(e, 0, t.length));
                    }
                    function Bn(t) {
                        return So(yi(t));
                    }
                    function Vn(t, e, n) {
                        ((void 0 !== n && !Ca(t[e], n)) || (void 0 === n && !(e in t))) && Hn(t, e, n);
                    }
                    function qn(t, e, n) {
                        var r = t[e];
                        (St.call(t, e) && Ca(r, n) && (void 0 !== n || e in t)) || Hn(t, e, n);
                    }
                    function Yn(t, e) {
                        for (var n = t.length; n--; ) if (Ca(t[n][0], e)) return n;
                        return -1;
                    }
                    function Xn(t, e, n, r) {
                        return (
                            tr(t, function (t, i, o) {
                                e(r, t, n(t), o);
                            }),
                            r
                        );
                    }
                    function Gn(t, e) {
                        return t && gi(e, ws(e), t);
                    }
                    function Hn(t, e, n) {
                        '__proto__' == e && We
                            ? We(t, e, {
                                  configurable: !0,
                                  enumerable: !0,
                                  value: n,
                                  writable: !0,
                              })
                            : (t[e] = n);
                    }
                    function Wn(t, e) {
                        for (var n = -1, i = e.length, o = r(i), a = null == t; ++n < i; )
                            o[n] = a ? void 0 : vs(t, e[n]);
                        return o;
                    }
                    function $n(t, e, n) {
                        return (
                            t == t && (void 0 !== n && (t = t <= n ? t : n), void 0 !== e && (t = t >= e ? t : e)), t
                        );
                    }
                    function Qn(t, e, n, r, i, o) {
                        var a,
                            u = 1 & e,
                            h = 2 & e,
                            b = 4 & e;
                        if ((n && (a = i ? n(t, r, i, o) : n(t)), void 0 !== a)) return a;
                        if (!qa(t)) return t;
                        var D = Ua(t);
                        if (D) {
                            if (
                                ((a = (function (t) {
                                    var e = t.length,
                                        n = new t.constructor(e);
                                    e &&
                                        'string' == typeof t[0] &&
                                        St.call(t, 'index') &&
                                        ((n.index = t.index), (n.input = t.input));
                                    return n;
                                })(t)),
                                !u)
                            )
                                return yi(t, a);
                        } else {
                            var U = no(t),
                                k = U == l || U == p;
                            if (Fa(t)) return hi(t, u);
                            if (U == m || U == s || (k && !i)) {
                                if (((a = h || k ? {} : io(t)), !u))
                                    return h
                                        ? (function (t, e) {
                                              return gi(t, eo(t), e);
                                          })(
                                              t,
                                              (function (t, e) {
                                                  return t && gi(e, bs(e), t);
                                              })(a, t),
                                          )
                                        : (function (t, e) {
                                              return gi(t, to(t), e);
                                          })(t, Gn(a, t));
                            } else {
                                if (!zt[U]) return i ? t : {};
                                a = (function (t, e, n) {
                                    var r = t.constructor;
                                    switch (e) {
                                        case x:
                                            return li(t);
                                        case c:
                                        case f:
                                            return new r(+t);
                                        case E:
                                            return (function (t, e) {
                                                var n = e ? li(t.buffer) : t.buffer;
                                                return new t.constructor(n, t.byteOffset, t.byteLength);
                                            })(t, n);
                                        case S:
                                        case T:
                                        case N:
                                        case O:
                                        case A:
                                        case C:
                                        case '[object Uint8ClampedArray]':
                                        case I:
                                        case M:
                                            return pi(t, n);
                                        case d:
                                            return new r();
                                        case v:
                                        case _:
                                            return new r(t);
                                        case y:
                                            return (function (t) {
                                                var e = new t.constructor(t.source, nt.exec(t));
                                                return (e.lastIndex = t.lastIndex), e;
                                            })(t);
                                        case g:
                                            return new r();
                                        case w:
                                            return (i = t), Nn ? vt(Nn.call(i)) : {};
                                    }
                                    var i;
                                })(t, U, u);
                            }
                        }
                        o || (o = new Fn());
                        var P = o.get(t);
                        if (P) return P;
                        o.set(t, a),
                            $a(t)
                                ? t.forEach(function (r) {
                                      a.add(Qn(r, e, n, r, t, o));
                                  })
                                : Xa(t) &&
                                  t.forEach(function (r, i) {
                                      a.set(i, Qn(r, e, n, i, t, o));
                                  });
                        var R = D ? void 0 : (b ? (h ? Gi : Xi) : h ? bs : ws)(t);
                        return (
                            ae(R || t, function (r, i) {
                                R && (r = t[(i = r)]), qn(a, i, Qn(r, e, n, i, t, o));
                            }),
                            a
                        );
                    }
                    function Zn(t, e, n) {
                        var r = n.length;
                        if (null == t) return !r;
                        for (t = vt(t); r--; ) {
                            var i = n[r],
                                o = e[i],
                                a = t[i];
                            if ((void 0 === a && !(i in t)) || !o(a)) return !1;
                        }
                        return !0;
                    }
                    function Jn(t, e, n) {
                        if ('function' != typeof t) throw new gt(i);
                        return wo(function () {
                            t.apply(void 0, n);
                        }, e);
                    }
                    function Kn(t, e, n, r) {
                        var i = -1,
                            o = fe,
                            a = !0,
                            s = t.length,
                            u = [],
                            c = e.length;
                        if (!s) return u;
                        n && (e = le(e, Ce(n))),
                            r ? ((o = he), (a = !1)) : e.length >= 200 && ((o = Me), (a = !1), (e = new Rn(e)));
                        t: for (; ++i < s; ) {
                            var f = t[i],
                                h = null == n ? f : n(f);
                            if (((f = r || 0 !== f ? f : 0), a && h == h)) {
                                for (var l = c; l--; ) if (e[l] === h) continue t;
                                u.push(f);
                            } else o(e, h, r) || u.push(f);
                        }
                        return u;
                    }
                    (An.templateSettings = {
                        escape: j,
                        evaluate: z,
                        interpolate: B,
                        variable: '',
                        imports: { _: An },
                    }),
                        (An.prototype = In.prototype),
                        (An.prototype.constructor = An),
                        (Mn.prototype = Cn(In.prototype)),
                        (Mn.prototype.constructor = Mn),
                        (Dn.prototype = Cn(In.prototype)),
                        (Dn.prototype.constructor = Dn),
                        (Un.prototype.clear = function () {
                            (this.__data__ = yn ? yn(null) : {}), (this.size = 0);
                        }),
                        (Un.prototype.delete = function (t) {
                            var e = this.has(t) && delete this.__data__[t];
                            return (this.size -= e ? 1 : 0), e;
                        }),
                        (Un.prototype.get = function (t) {
                            var e = this.__data__;
                            if (yn) {
                                var n = e[t];
                                return '__lodash_hash_undefined__' === n ? void 0 : n;
                            }
                            return St.call(e, t) ? e[t] : void 0;
                        }),
                        (Un.prototype.has = function (t) {
                            var e = this.__data__;
                            return yn ? void 0 !== e[t] : St.call(e, t);
                        }),
                        (Un.prototype.set = function (t, e) {
                            var n = this.__data__;
                            return (
                                (this.size += this.has(t) ? 0 : 1),
                                (n[t] = yn && void 0 === e ? '__lodash_hash_undefined__' : e),
                                this
                            );
                        }),
                        (kn.prototype.clear = function () {
                            (this.__data__ = []), (this.size = 0);
                        }),
                        (kn.prototype.delete = function (t) {
                            var e = this.__data__,
                                n = Yn(e, t);
                            return !(n < 0) && (n == e.length - 1 ? e.pop() : Qt.call(e, n, 1), --this.size, !0);
                        }),
                        (kn.prototype.get = function (t) {
                            var e = this.__data__,
                                n = Yn(e, t);
                            return n < 0 ? void 0 : e[n][1];
                        }),
                        (kn.prototype.has = function (t) {
                            return Yn(this.__data__, t) > -1;
                        }),
                        (kn.prototype.set = function (t, e) {
                            var n = this.__data__,
                                r = Yn(n, t);
                            return r < 0 ? (++this.size, n.push([t, e])) : (n[r][1] = e), this;
                        }),
                        (Pn.prototype.clear = function () {
                            (this.size = 0),
                                (this.__data__ = {
                                    hash: new Un(),
                                    map: new (pn || kn)(),
                                    string: new Un(),
                                });
                        }),
                        (Pn.prototype.delete = function (t) {
                            var e = Zi(this, t).delete(t);
                            return (this.size -= e ? 1 : 0), e;
                        }),
                        (Pn.prototype.get = function (t) {
                            return Zi(this, t).get(t);
                        }),
                        (Pn.prototype.has = function (t) {
                            return Zi(this, t).has(t);
                        }),
                        (Pn.prototype.set = function (t, e) {
                            var n = Zi(this, t),
                                r = n.size;
                            return n.set(t, e), (this.size += n.size == r ? 0 : 1), this;
                        }),
                        (Rn.prototype.add = Rn.prototype.push =
                            function (t) {
                                return this.__data__.set(t, '__lodash_hash_undefined__'), this;
                            }),
                        (Rn.prototype.has = function (t) {
                            return this.__data__.has(t);
                        }),
                        (Fn.prototype.clear = function () {
                            (this.__data__ = new kn()), (this.size = 0);
                        }),
                        (Fn.prototype.delete = function (t) {
                            var e = this.__data__,
                                n = e.delete(t);
                            return (this.size = e.size), n;
                        }),
                        (Fn.prototype.get = function (t) {
                            return this.__data__.get(t);
                        }),
                        (Fn.prototype.has = function (t) {
                            return this.__data__.has(t);
                        }),
                        (Fn.prototype.set = function (t, e) {
                            var n = this.__data__;
                            if (n instanceof kn) {
                                var r = n.__data__;
                                if (!pn || r.length < 199) return r.push([t, e]), (this.size = ++n.size), this;
                                n = this.__data__ = new Pn(r);
                            }
                            return n.set(t, e), (this.size = n.size), this;
                        });
                    var tr = bi(ur),
                        er = bi(cr, !0);
                    function nr(t, e) {
                        var n = !0;
                        return (
                            tr(t, function (t, r, i) {
                                return (n = !!e(t, r, i));
                            }),
                            n
                        );
                    }
                    function rr(t, e, n) {
                        for (var r = -1, i = t.length; ++r < i; ) {
                            var o = t[r],
                                a = e(o);
                            if (null != a && (void 0 === s ? a == a && !Za(a) : n(a, s)))
                                var s = a,
                                    u = o;
                        }
                        return u;
                    }
                    function ir(t, e) {
                        var n = [];
                        return (
                            tr(t, function (t, r, i) {
                                e(t, r, i) && n.push(t);
                            }),
                            n
                        );
                    }
                    function or(t, e, n, r, i) {
                        var o = -1,
                            a = t.length;
                        for (n || (n = oo), i || (i = []); ++o < a; ) {
                            var s = t[o];
                            e > 0 && n(s) ? (e > 1 ? or(s, e - 1, n, r, i) : pe(i, s)) : r || (i[i.length] = s);
                        }
                        return i;
                    }
                    var ar = xi(),
                        sr = xi(!0);
                    function ur(t, e) {
                        return t && ar(t, e, ws);
                    }
                    function cr(t, e) {
                        return t && sr(t, e, ws);
                    }
                    function fr(t, e) {
                        return ce(e, function (e) {
                            return za(t[e]);
                        });
                    }
                    function hr(t, e) {
                        for (var n = 0, r = (e = si(e, t)).length; null != t && n < r; ) t = t[No(e[n++])];
                        return n && n == r ? t : void 0;
                    }
                    function lr(t, e, n) {
                        var r = e(t);
                        return Ua(t) ? r : pe(r, n(t));
                    }
                    function pr(t) {
                        return null == t
                            ? void 0 === t
                                ? '[object Undefined]'
                                : '[object Null]'
                            : Te && Te in vt(t)
                              ? (function (t) {
                                    var e = St.call(t, Te),
                                        n = t[Te];
                                    try {
                                        t[Te] = void 0;
                                        var r = !0;
                                    } catch (t) {}
                                    var i = Ot.call(t);
                                    r && (e ? (t[Te] = n) : delete t[Te]);
                                    return i;
                                })(t)
                              : (function (t) {
                                    return Ot.call(t);
                                })(t);
                    }
                    function dr(t, e) {
                        return t > e;
                    }
                    function vr(t, e) {
                        return null != t && St.call(t, e);
                    }
                    function mr(t, e) {
                        return null != t && e in vt(t);
                    }
                    function yr(t, e, n) {
                        for (
                            var i = n ? he : fe, o = t[0].length, a = t.length, s = a, u = r(a), c = 1 / 0, f = [];
                            s--;

                        ) {
                            var h = t[s];
                            s && e && (h = le(h, Ce(e))),
                                (c = sn(h.length, c)),
                                (u[s] = !n && (e || (o >= 120 && h.length >= 120)) ? new Rn(s && h) : void 0);
                        }
                        h = t[0];
                        var l = -1,
                            p = u[0];
                        t: for (; ++l < o && f.length < c; ) {
                            var d = h[l],
                                v = e ? e(d) : d;
                            if (((d = n || 0 !== d ? d : 0), !(p ? Me(p, v) : i(f, v, n)))) {
                                for (s = a; --s; ) {
                                    var m = u[s];
                                    if (!(m ? Me(m, v) : i(t[s], v, n))) continue t;
                                }
                                p && p.push(v), f.push(d);
                            }
                        }
                        return f;
                    }
                    function gr(t, e, n) {
                        var r = null == (t = mo(t, (e = si(e, t)))) ? t : t[No(jo(e))];
                        return null == r ? void 0 : ie(r, t, n);
                    }
                    function _r(t) {
                        return Ya(t) && pr(t) == s;
                    }
                    function wr(t, e, n, r, i) {
                        return (
                            t === e ||
                            (null == t || null == e || (!Ya(t) && !Ya(e))
                                ? t != t && e != e
                                : (function (t, e, n, r, i, o) {
                                      var a = Ua(t),
                                          l = Ua(e),
                                          p = a ? u : no(t),
                                          b = l ? u : no(e),
                                          S = (p = p == s ? m : p) == m,
                                          T = (b = b == s ? m : b) == m,
                                          N = p == b;
                                      if (N && Fa(t)) {
                                          if (!Fa(e)) return !1;
                                          (a = !0), (S = !1);
                                      }
                                      if (N && !S)
                                          return (
                                              o || (o = new Fn()),
                                              a || Ja(t)
                                                  ? qi(t, e, n, r, i, o)
                                                  : (function (t, e, n, r, i, o, a) {
                                                        switch (n) {
                                                            case E:
                                                                if (
                                                                    t.byteLength != e.byteLength ||
                                                                    t.byteOffset != e.byteOffset
                                                                )
                                                                    return !1;
                                                                (t = t.buffer), (e = e.buffer);
                                                            case x:
                                                                return !(
                                                                    t.byteLength != e.byteLength ||
                                                                    !o(new Bt(t), new Bt(e))
                                                                );
                                                            case c:
                                                            case f:
                                                            case v:
                                                                return Ca(+t, +e);
                                                            case h:
                                                                return t.name == e.name && t.message == e.message;
                                                            case y:
                                                            case _:
                                                                return t == e + '';
                                                            case d:
                                                                var s = je;
                                                            case g:
                                                                var u = 1 & r;
                                                                if ((s || (s = Ve), t.size != e.size && !u)) return !1;
                                                                var l = a.get(t);
                                                                if (l) return l == e;
                                                                (r |= 2), a.set(t, e);
                                                                var p = qi(s(t), s(e), r, i, o, a);
                                                                return a.delete(t), p;
                                                            case w:
                                                                if (Nn) return Nn.call(t) == Nn.call(e);
                                                        }
                                                        return !1;
                                                    })(t, e, p, n, r, i, o)
                                          );
                                      if (!(1 & n)) {
                                          var O = S && St.call(t, '__wrapped__'),
                                              A = T && St.call(e, '__wrapped__');
                                          if (O || A) {
                                              var C = O ? t.value() : t,
                                                  I = A ? e.value() : e;
                                              return o || (o = new Fn()), i(C, I, n, r, o);
                                          }
                                      }
                                      if (!N) return !1;
                                      return (
                                          o || (o = new Fn()),
                                          (function (t, e, n, r, i, o) {
                                              var a = 1 & n,
                                                  s = Xi(t),
                                                  u = s.length,
                                                  c = Xi(e).length;
                                              if (u != c && !a) return !1;
                                              var f = u;
                                              for (; f--; ) {
                                                  var h = s[f];
                                                  if (!(a ? h in e : St.call(e, h))) return !1;
                                              }
                                              var l = o.get(t),
                                                  p = o.get(e);
                                              if (l && p) return l == e && p == t;
                                              var d = !0;
                                              o.set(t, e), o.set(e, t);
                                              var v = a;
                                              for (; ++f < u; ) {
                                                  h = s[f];
                                                  var m = t[h],
                                                      y = e[h];
                                                  if (r) var g = a ? r(y, m, h, e, t, o) : r(m, y, h, t, e, o);
                                                  if (!(void 0 === g ? m === y || i(m, y, n, r, o) : g)) {
                                                      d = !1;
                                                      break;
                                                  }
                                                  v || (v = 'constructor' == h);
                                              }
                                              if (d && !v) {
                                                  var _ = t.constructor,
                                                      w = e.constructor;
                                                  _ == w ||
                                                      !('constructor' in t) ||
                                                      !('constructor' in e) ||
                                                      ('function' == typeof _ &&
                                                          _ instanceof _ &&
                                                          'function' == typeof w &&
                                                          w instanceof w) ||
                                                      (d = !1);
                                              }
                                              return o.delete(t), o.delete(e), d;
                                          })(t, e, n, r, i, o)
                                      );
                                  })(t, e, n, r, wr, i))
                        );
                    }
                    function br(t, e, n, r) {
                        var i = n.length,
                            o = i,
                            a = !r;
                        if (null == t) return !o;
                        for (t = vt(t); i--; ) {
                            var s = n[i];
                            if (a && s[2] ? s[1] !== t[s[0]] : !(s[0] in t)) return !1;
                        }
                        for (; ++i < o; ) {
                            var u = (s = n[i])[0],
                                c = t[u],
                                f = s[1];
                            if (a && s[2]) {
                                if (void 0 === c && !(u in t)) return !1;
                            } else {
                                var h = new Fn();
                                if (r) var l = r(c, f, u, t, e, h);
                                if (!(void 0 === l ? wr(f, c, 3, r, h) : l)) return !1;
                            }
                        }
                        return !0;
                    }
                    function xr(t) {
                        return !(!qa(t) || ((e = t), Nt && Nt in e)) && (za(t) ? It : ot).test(Oo(t));
                        var e;
                    }
                    function Er(t) {
                        return 'function' == typeof t
                            ? t
                            : null == t
                              ? Gs
                              : 'object' == typeof t
                                ? Ua(t)
                                    ? Cr(t[0], t[1])
                                    : Ar(t)
                                : eu(t);
                    }
                    function Sr(t) {
                        if (!ho(t)) return on(t);
                        var e = [];
                        for (var n in vt(t)) St.call(t, n) && 'constructor' != n && e.push(n);
                        return e;
                    }
                    function Tr(t) {
                        if (!qa(t))
                            return (function (t) {
                                var e = [];
                                if (null != t) for (var n in vt(t)) e.push(n);
                                return e;
                            })(t);
                        var e = ho(t),
                            n = [];
                        for (var r in t) ('constructor' != r || (!e && St.call(t, r))) && n.push(r);
                        return n;
                    }
                    function Nr(t, e) {
                        return t < e;
                    }
                    function Or(t, e) {
                        var n = -1,
                            i = Pa(t) ? r(t.length) : [];
                        return (
                            tr(t, function (t, r, o) {
                                i[++n] = e(t, r, o);
                            }),
                            i
                        );
                    }
                    function Ar(t) {
                        var e = Ji(t);
                        return 1 == e.length && e[0][2]
                            ? po(e[0][0], e[0][1])
                            : function (n) {
                                  return n === t || br(n, t, e);
                              };
                    }
                    function Cr(t, e) {
                        return uo(t) && lo(e)
                            ? po(No(t), e)
                            : function (n) {
                                  var r = vs(n, t);
                                  return void 0 === r && r === e ? ms(n, t) : wr(e, r, 3);
                              };
                    }
                    function Ir(t, e, n, r, i) {
                        t !== e &&
                            ar(
                                e,
                                function (o, a) {
                                    if ((i || (i = new Fn()), qa(o)))
                                        !(function (t, e, n, r, i, o, a) {
                                            var s = go(t, n),
                                                u = go(e, n),
                                                c = a.get(u);
                                            if (c) return void Vn(t, n, c);
                                            var f = o ? o(s, u, n + '', t, e, a) : void 0,
                                                h = void 0 === f;
                                            if (h) {
                                                var l = Ua(u),
                                                    p = !l && Fa(u),
                                                    d = !l && !p && Ja(u);
                                                (f = u),
                                                    l || p || d
                                                        ? Ua(s)
                                                            ? (f = s)
                                                            : Ra(s)
                                                              ? (f = yi(s))
                                                              : p
                                                                ? ((h = !1), (f = hi(u, !0)))
                                                                : d
                                                                  ? ((h = !1), (f = pi(u, !0)))
                                                                  : (f = [])
                                                        : Ha(u) || Da(u)
                                                          ? ((f = s),
                                                            Da(s) ? (f = as(s)) : (qa(s) && !za(s)) || (f = io(u)))
                                                          : (h = !1);
                                            }
                                            h && (a.set(u, f), i(f, u, r, o, a), a.delete(u));
                                            Vn(t, n, f);
                                        })(t, e, a, n, Ir, r, i);
                                    else {
                                        var s = r ? r(go(t, a), o, a + '', t, e, i) : void 0;
                                        void 0 === s && (s = o), Vn(t, a, s);
                                    }
                                },
                                bs,
                            );
                    }
                    function Mr(t, e) {
                        var n = t.length;
                        if (n) return ao((e += e < 0 ? n : 0), n) ? t[e] : void 0;
                    }
                    function Dr(t, e, n) {
                        e = e.length
                            ? le(e, function (t) {
                                  return Ua(t)
                                      ? function (e) {
                                            return hr(e, 1 === t.length ? t[0] : t);
                                        }
                                      : t;
                              })
                            : [Gs];
                        var r = -1;
                        return (
                            (e = le(e, Ce(Qi()))),
                            (function (t, e) {
                                var n = t.length;
                                for (t.sort(e); n--; ) t[n] = t[n].value;
                                return t;
                            })(
                                Or(t, function (t, n, i) {
                                    return {
                                        criteria: le(e, function (e) {
                                            return e(t);
                                        }),
                                        index: ++r,
                                        value: t,
                                    };
                                }),
                                function (t, e) {
                                    return (function (t, e, n) {
                                        var r = -1,
                                            i = t.criteria,
                                            o = e.criteria,
                                            a = i.length,
                                            s = n.length;
                                        for (; ++r < a; ) {
                                            var u = di(i[r], o[r]);
                                            if (u) {
                                                if (r >= s) return u;
                                                var c = n[r];
                                                return u * ('desc' == c ? -1 : 1);
                                            }
                                        }
                                        return t.index - e.index;
                                    })(t, e, n);
                                },
                            )
                        );
                    }
                    function Ur(t, e, n) {
                        for (var r = -1, i = e.length, o = {}; ++r < i; ) {
                            var a = e[r],
                                s = hr(t, a);
                            n(s, a) && Br(o, si(a, t), s);
                        }
                        return o;
                    }
                    function kr(t, e, n, r) {
                        var i = r ? be : we,
                            o = -1,
                            a = e.length,
                            s = t;
                        for (t === e && (e = yi(e)), n && (s = le(t, Ce(n))); ++o < a; )
                            for (var u = 0, c = e[o], f = n ? n(c) : c; (u = i(s, f, u, r)) > -1; )
                                s !== t && Qt.call(s, u, 1), Qt.call(t, u, 1);
                        return t;
                    }
                    function Pr(t, e) {
                        for (var n = t ? e.length : 0, r = n - 1; n--; ) {
                            var i = e[n];
                            if (n == r || i !== o) {
                                var o = i;
                                ao(i) ? Qt.call(t, i, 1) : Kr(t, i);
                            }
                        }
                        return t;
                    }
                    function Rr(t, e) {
                        return t + Ke(fn() * (e - t + 1));
                    }
                    function Fr(t, e) {
                        var n = '';
                        if (!t || e < 1 || e > 9007199254740991) return n;
                        do {
                            e % 2 && (n += t), (e = Ke(e / 2)) && (t += t);
                        } while (e);
                        return n;
                    }
                    function Lr(t, e) {
                        return bo(vo(t, e, Gs), t + '');
                    }
                    function jr(t) {
                        return jn(Cs(t));
                    }
                    function zr(t, e) {
                        var n = Cs(t);
                        return So(n, $n(e, 0, n.length));
                    }
                    function Br(t, e, n, r) {
                        if (!qa(t)) return t;
                        for (var i = -1, o = (e = si(e, t)).length, a = o - 1, s = t; null != s && ++i < o; ) {
                            var u = No(e[i]),
                                c = n;
                            if ('__proto__' === u || 'constructor' === u || 'prototype' === u) return t;
                            if (i != a) {
                                var f = s[u];
                                void 0 === (c = r ? r(f, u, s) : void 0) && (c = qa(f) ? f : ao(e[i + 1]) ? [] : {});
                            }
                            qn(s, u, c), (s = s[u]);
                        }
                        return t;
                    }
                    var Vr = gn
                            ? function (t, e) {
                                  return gn.set(t, e), t;
                              }
                            : Gs,
                        qr = We
                            ? function (t, e) {
                                  return We(t, 'toString', {
                                      configurable: !0,
                                      enumerable: !1,
                                      value: qs(e),
                                      writable: !0,
                                  });
                              }
                            : Gs;
                    function Yr(t) {
                        return So(Cs(t));
                    }
                    function Xr(t, e, n) {
                        var i = -1,
                            o = t.length;
                        e < 0 && (e = -e > o ? 0 : o + e),
                            (n = n > o ? o : n) < 0 && (n += o),
                            (o = e > n ? 0 : (n - e) >>> 0),
                            (e >>>= 0);
                        for (var a = r(o); ++i < o; ) a[i] = t[i + e];
                        return a;
                    }
                    function Gr(t, e) {
                        var n;
                        return (
                            tr(t, function (t, r, i) {
                                return !(n = e(t, r, i));
                            }),
                            !!n
                        );
                    }
                    function Hr(t, e, n) {
                        var r = 0,
                            i = null == t ? r : t.length;
                        if ('number' == typeof e && e == e && i <= 2147483647) {
                            for (; r < i; ) {
                                var o = (r + i) >>> 1,
                                    a = t[o];
                                null !== a && !Za(a) && (n ? a <= e : a < e) ? (r = o + 1) : (i = o);
                            }
                            return i;
                        }
                        return Wr(t, e, Gs, n);
                    }
                    function Wr(t, e, n, r) {
                        var i = 0,
                            o = null == t ? 0 : t.length;
                        if (0 === o) return 0;
                        for (var a = (e = n(e)) != e, s = null === e, u = Za(e), c = void 0 === e; i < o; ) {
                            var f = Ke((i + o) / 2),
                                h = n(t[f]),
                                l = void 0 !== h,
                                p = null === h,
                                d = h == h,
                                v = Za(h);
                            if (a) var m = r || d;
                            else
                                m = c
                                    ? d && (r || l)
                                    : s
                                      ? d && l && (r || !p)
                                      : u
                                        ? d && l && !p && (r || !v)
                                        : !p && !v && (r ? h <= e : h < e);
                            m ? (i = f + 1) : (o = f);
                        }
                        return sn(o, 4294967294);
                    }
                    function $r(t, e) {
                        for (var n = -1, r = t.length, i = 0, o = []; ++n < r; ) {
                            var a = t[n],
                                s = e ? e(a) : a;
                            if (!n || !Ca(s, u)) {
                                var u = s;
                                o[i++] = 0 === a ? 0 : a;
                            }
                        }
                        return o;
                    }
                    function Qr(t) {
                        return 'number' == typeof t ? t : Za(t) ? NaN : +t;
                    }
                    function Zr(t) {
                        if ('string' == typeof t) return t;
                        if (Ua(t)) return le(t, Zr) + '';
                        if (Za(t)) return On ? On.call(t) : '';
                        var e = t + '';
                        return '0' == e && 1 / t == -1 / 0 ? '-0' : e;
                    }
                    function Jr(t, e, n) {
                        var r = -1,
                            i = fe,
                            o = t.length,
                            a = !0,
                            s = [],
                            u = s;
                        if (n) (a = !1), (i = he);
                        else if (o >= 200) {
                            var c = e ? null : Fi(t);
                            if (c) return Ve(c);
                            (a = !1), (i = Me), (u = new Rn());
                        } else u = e ? [] : s;
                        t: for (; ++r < o; ) {
                            var f = t[r],
                                h = e ? e(f) : f;
                            if (((f = n || 0 !== f ? f : 0), a && h == h)) {
                                for (var l = u.length; l--; ) if (u[l] === h) continue t;
                                e && u.push(h), s.push(f);
                            } else i(u, h, n) || (u !== s && u.push(h), s.push(f));
                        }
                        return s;
                    }
                    function Kr(t, e) {
                        return null == (t = mo(t, (e = si(e, t)))) || delete t[No(jo(e))];
                    }
                    function ti(t, e, n, r) {
                        return Br(t, e, n(hr(t, e)), r);
                    }
                    function ei(t, e, n, r) {
                        for (var i = t.length, o = r ? i : -1; (r ? o-- : ++o < i) && e(t[o], o, t); );
                        return n ? Xr(t, r ? 0 : o, r ? o + 1 : i) : Xr(t, r ? o + 1 : 0, r ? i : o);
                    }
                    function ni(t, e) {
                        var n = t;
                        return (
                            n instanceof Dn && (n = n.value()),
                            de(
                                e,
                                function (t, e) {
                                    return e.func.apply(e.thisArg, pe([t], e.args));
                                },
                                n,
                            )
                        );
                    }
                    function ri(t, e, n) {
                        var i = t.length;
                        if (i < 2) return i ? Jr(t[0]) : [];
                        for (var o = -1, a = r(i); ++o < i; )
                            for (var s = t[o], u = -1; ++u < i; ) u != o && (a[o] = Kn(a[o] || s, t[u], e, n));
                        return Jr(or(a, 1), e, n);
                    }
                    function ii(t, e, n) {
                        for (var r = -1, i = t.length, o = e.length, a = {}; ++r < i; ) {
                            var s = r < o ? e[r] : void 0;
                            n(a, t[r], s);
                        }
                        return a;
                    }
                    function oi(t) {
                        return Ra(t) ? t : [];
                    }
                    function ai(t) {
                        return 'function' == typeof t ? t : Gs;
                    }
                    function si(t, e) {
                        return Ua(t) ? t : uo(t, e) ? [t] : To(ss(t));
                    }
                    var ui = Lr;
                    function ci(t, e, n) {
                        var r = t.length;
                        return (n = void 0 === n ? r : n), !e && n >= r ? t : Xr(t, e, n);
                    }
                    var fi =
                        $e ||
                        function (t) {
                            return Gt.clearTimeout(t);
                        };
                    function hi(t, e) {
                        if (e) return t.slice();
                        var n = t.length,
                            r = Yt ? Yt(n) : new t.constructor(n);
                        return t.copy(r), r;
                    }
                    function li(t) {
                        var e = new t.constructor(t.byteLength);
                        return new Bt(e).set(new Bt(t)), e;
                    }
                    function pi(t, e) {
                        var n = e ? li(t.buffer) : t.buffer;
                        return new t.constructor(n, t.byteOffset, t.length);
                    }
                    function di(t, e) {
                        if (t !== e) {
                            var n = void 0 !== t,
                                r = null === t,
                                i = t == t,
                                o = Za(t),
                                a = void 0 !== e,
                                s = null === e,
                                u = e == e,
                                c = Za(e);
                            if (
                                (!s && !c && !o && t > e) ||
                                (o && a && u && !s && !c) ||
                                (r && a && u) ||
                                (!n && u) ||
                                !i
                            )
                                return 1;
                            if (
                                (!r && !o && !c && t < e) ||
                                (c && n && i && !r && !o) ||
                                (s && n && i) ||
                                (!a && i) ||
                                !u
                            )
                                return -1;
                        }
                        return 0;
                    }
                    function vi(t, e, n, i) {
                        for (
                            var o = -1,
                                a = t.length,
                                s = n.length,
                                u = -1,
                                c = e.length,
                                f = an(a - s, 0),
                                h = r(c + f),
                                l = !i;
                            ++u < c;

                        )
                            h[u] = e[u];
                        for (; ++o < s; ) (l || o < a) && (h[n[o]] = t[o]);
                        for (; f--; ) h[u++] = t[o++];
                        return h;
                    }
                    function mi(t, e, n, i) {
                        for (
                            var o = -1,
                                a = t.length,
                                s = -1,
                                u = n.length,
                                c = -1,
                                f = e.length,
                                h = an(a - u, 0),
                                l = r(h + f),
                                p = !i;
                            ++o < h;

                        )
                            l[o] = t[o];
                        for (var d = o; ++c < f; ) l[d + c] = e[c];
                        for (; ++s < u; ) (p || o < a) && (l[d + n[s]] = t[o++]);
                        return l;
                    }
                    function yi(t, e) {
                        var n = -1,
                            i = t.length;
                        for (e || (e = r(i)); ++n < i; ) e[n] = t[n];
                        return e;
                    }
                    function gi(t, e, n, r) {
                        var i = !n;
                        n || (n = {});
                        for (var o = -1, a = e.length; ++o < a; ) {
                            var s = e[o],
                                u = r ? r(n[s], t[s], s, n, t) : void 0;
                            void 0 === u && (u = t[s]), i ? Hn(n, s, u) : qn(n, s, u);
                        }
                        return n;
                    }
                    function _i(t, e) {
                        return function (n, r) {
                            var i = Ua(n) ? oe : Xn,
                                o = e ? e() : {};
                            return i(n, t, Qi(r, 2), o);
                        };
                    }
                    function wi(t) {
                        return Lr(function (e, n) {
                            var r = -1,
                                i = n.length,
                                o = i > 1 ? n[i - 1] : void 0,
                                a = i > 2 ? n[2] : void 0;
                            for (
                                o = t.length > 3 && 'function' == typeof o ? (i--, o) : void 0,
                                    a && so(n[0], n[1], a) && ((o = i < 3 ? void 0 : o), (i = 1)),
                                    e = vt(e);
                                ++r < i;

                            ) {
                                var s = n[r];
                                s && t(e, s, r, o);
                            }
                            return e;
                        });
                    }
                    function bi(t, e) {
                        return function (n, r) {
                            if (null == n) return n;
                            if (!Pa(n)) return t(n, r);
                            for (
                                var i = n.length, o = e ? i : -1, a = vt(n);
                                (e ? o-- : ++o < i) && !1 !== r(a[o], o, a);

                            );
                            return n;
                        };
                    }
                    function xi(t) {
                        return function (e, n, r) {
                            for (var i = -1, o = vt(e), a = r(e), s = a.length; s--; ) {
                                var u = a[t ? s : ++i];
                                if (!1 === n(o[u], u, o)) break;
                            }
                            return e;
                        };
                    }
                    function Ei(t) {
                        return function (e) {
                            var n = Le((e = ss(e))) ? Xe(e) : void 0,
                                r = n ? n[0] : e.charAt(0),
                                i = n ? ci(n, 1).join('') : e.slice(1);
                            return r[t]() + i;
                        };
                    }
                    function Si(t) {
                        return function (e) {
                            return de(zs(Ds(e).replace(Mt, '')), t, '');
                        };
                    }
                    function Ti(t) {
                        return function () {
                            var e = arguments;
                            switch (e.length) {
                                case 0:
                                    return new t();
                                case 1:
                                    return new t(e[0]);
                                case 2:
                                    return new t(e[0], e[1]);
                                case 3:
                                    return new t(e[0], e[1], e[2]);
                                case 4:
                                    return new t(e[0], e[1], e[2], e[3]);
                                case 5:
                                    return new t(e[0], e[1], e[2], e[3], e[4]);
                                case 6:
                                    return new t(e[0], e[1], e[2], e[3], e[4], e[5]);
                                case 7:
                                    return new t(e[0], e[1], e[2], e[3], e[4], e[5], e[6]);
                            }
                            var n = Cn(t.prototype),
                                r = t.apply(n, e);
                            return qa(r) ? r : n;
                        };
                    }
                    function Ni(t) {
                        return function (e, n, r) {
                            var i = vt(e);
                            if (!Pa(e)) {
                                var o = Qi(n, 3);
                                (e = ws(e)),
                                    (n = function (t) {
                                        return o(i[t], t, i);
                                    });
                            }
                            var a = t(e, n, r);
                            return a > -1 ? i[o ? e[a] : a] : void 0;
                        };
                    }
                    function Oi(t) {
                        return Yi(function (e) {
                            var n = e.length,
                                r = n,
                                o = Mn.prototype.thru;
                            for (t && e.reverse(); r--; ) {
                                var a = e[r];
                                if ('function' != typeof a) throw new gt(i);
                                if (o && !s && 'wrapper' == Wi(a)) var s = new Mn([], !0);
                            }
                            for (r = s ? r : n; ++r < n; ) {
                                var u = Wi((a = e[r])),
                                    c = 'wrapper' == u ? Hi(a) : void 0;
                                s =
                                    c && co(c[0]) && 424 == c[1] && !c[4].length && 1 == c[9]
                                        ? s[Wi(c[0])].apply(s, c[3])
                                        : 1 == a.length && co(a)
                                          ? s[u]()
                                          : s.thru(a);
                            }
                            return function () {
                                var t = arguments,
                                    r = t[0];
                                if (s && 1 == t.length && Ua(r)) return s.plant(r).value();
                                for (var i = 0, o = n ? e[i].apply(this, t) : r; ++i < n; ) o = e[i].call(this, o);
                                return o;
                            };
                        });
                    }
                    function Ai(t, e, n, i, o, a, s, u, c, f) {
                        var h = 128 & e,
                            l = 1 & e,
                            p = 2 & e,
                            d = 24 & e,
                            v = 512 & e,
                            m = p ? void 0 : Ti(t);
                        return function y() {
                            for (var g = arguments.length, _ = r(g), w = g; w--; ) _[w] = arguments[w];
                            if (d)
                                var b = $i(y),
                                    x = ke(_, b);
                            if ((i && (_ = vi(_, i, o, d)), a && (_ = mi(_, a, s, d)), (g -= x), d && g < f)) {
                                var E = Be(_, b);
                                return Pi(t, e, Ai, y.placeholder, n, _, E, u, c, f - g);
                            }
                            var S = l ? n : this,
                                T = p ? S[t] : t;
                            return (
                                (g = _.length),
                                u ? (_ = yo(_, u)) : v && g > 1 && _.reverse(),
                                h && c < g && (_.length = c),
                                this && this !== Gt && this instanceof y && (T = m || Ti(T)),
                                T.apply(S, _)
                            );
                        };
                    }
                    function Ci(t, e) {
                        return function (n, r) {
                            return (function (t, e, n, r) {
                                return (
                                    ur(t, function (t, i, o) {
                                        e(r, n(t), i, o);
                                    }),
                                    r
                                );
                            })(n, t, e(r), {});
                        };
                    }
                    function Ii(t, e) {
                        return function (n, r) {
                            var i;
                            if (void 0 === n && void 0 === r) return e;
                            if ((void 0 !== n && (i = n), void 0 !== r)) {
                                if (void 0 === i) return r;
                                'string' == typeof n || 'string' == typeof r
                                    ? ((n = Zr(n)), (r = Zr(r)))
                                    : ((n = Qr(n)), (r = Qr(r))),
                                    (i = t(n, r));
                            }
                            return i;
                        };
                    }
                    function Mi(t) {
                        return Yi(function (e) {
                            return (
                                (e = le(e, Ce(Qi()))),
                                Lr(function (n) {
                                    var r = this;
                                    return t(e, function (t) {
                                        return ie(t, r, n);
                                    });
                                })
                            );
                        });
                    }
                    function Di(t, e) {
                        var n = (e = void 0 === e ? ' ' : Zr(e)).length;
                        if (n < 2) return n ? Fr(e, t) : e;
                        var r = Fr(e, Je(t / Ye(e)));
                        return Le(e) ? ci(Xe(r), 0, t).join('') : r.slice(0, t);
                    }
                    function Ui(t) {
                        return function (e, n, i) {
                            return (
                                i && 'number' != typeof i && so(e, n, i) && (n = i = void 0),
                                (e = ns(e)),
                                void 0 === n ? ((n = e), (e = 0)) : (n = ns(n)),
                                (function (t, e, n, i) {
                                    for (var o = -1, a = an(Je((e - t) / (n || 1)), 0), s = r(a); a--; )
                                        (s[i ? a : ++o] = t), (t += n);
                                    return s;
                                })(e, n, (i = void 0 === i ? (e < n ? 1 : -1) : ns(i)), t)
                            );
                        };
                    }
                    function ki(t) {
                        return function (e, n) {
                            return (
                                ('string' == typeof e && 'string' == typeof n) || ((e = os(e)), (n = os(n))), t(e, n)
                            );
                        };
                    }
                    function Pi(t, e, n, r, i, o, a, s, u, c) {
                        var f = 8 & e;
                        (e |= f ? 32 : 64), 4 & (e &= ~(f ? 64 : 32)) || (e &= -4);
                        var h = [t, e, i, f ? o : void 0, f ? a : void 0, f ? void 0 : o, f ? void 0 : a, s, u, c],
                            l = n.apply(void 0, h);
                        return co(t) && _o(l, h), (l.placeholder = r), xo(l, t, e);
                    }
                    function Ri(t) {
                        var e = dt[t];
                        return function (t, n) {
                            if (((t = os(t)), (n = null == n ? 0 : sn(rs(n), 292)) && nn(t))) {
                                var r = (ss(t) + 'e').split('e');
                                return +(
                                    (r = (ss(e(r[0] + 'e' + (+r[1] + n))) + 'e').split('e'))[0] +
                                    'e' +
                                    (+r[1] - n)
                                );
                            }
                            return e(t);
                        };
                    }
                    var Fi =
                        vn && 1 / Ve(new vn([, -0]))[1] == 1 / 0
                            ? function (t) {
                                  return new vn(t);
                              }
                            : Zs;
                    function Li(t) {
                        return function (e) {
                            var n = no(e);
                            return n == d
                                ? je(e)
                                : n == g
                                  ? qe(e)
                                  : (function (t, e) {
                                        return le(e, function (e) {
                                            return [e, t[e]];
                                        });
                                    })(e, t(e));
                        };
                    }
                    function ji(t, e, n, a, s, u, c, f) {
                        var h = 2 & e;
                        if (!h && 'function' != typeof t) throw new gt(i);
                        var l = a ? a.length : 0;
                        if (
                            (l || ((e &= -97), (a = s = void 0)),
                            (c = void 0 === c ? c : an(rs(c), 0)),
                            (f = void 0 === f ? f : rs(f)),
                            (l -= s ? s.length : 0),
                            64 & e)
                        ) {
                            var p = a,
                                d = s;
                            a = s = void 0;
                        }
                        var v = h ? void 0 : Hi(t),
                            m = [t, e, n, a, s, p, d, u, c, f];
                        if (
                            (v &&
                                (function (t, e) {
                                    var n = t[1],
                                        r = e[1],
                                        i = n | r,
                                        a = i < 131,
                                        s =
                                            (128 == r && 8 == n) ||
                                            (128 == r && 256 == n && t[7].length <= e[8]) ||
                                            (384 == r && e[7].length <= e[8] && 8 == n);
                                    if (!a && !s) return t;
                                    1 & r && ((t[2] = e[2]), (i |= 1 & n ? 0 : 4));
                                    var u = e[3];
                                    if (u) {
                                        var c = t[3];
                                        (t[3] = c ? vi(c, u, e[4]) : u), (t[4] = c ? Be(t[3], o) : e[4]);
                                    }
                                    (u = e[5]) &&
                                        ((c = t[5]), (t[5] = c ? mi(c, u, e[6]) : u), (t[6] = c ? Be(t[5], o) : e[6]));
                                    (u = e[7]) && (t[7] = u);
                                    128 & r && (t[8] = null == t[8] ? e[8] : sn(t[8], e[8]));
                                    null == t[9] && (t[9] = e[9]);
                                    (t[0] = e[0]), (t[1] = i);
                                })(m, v),
                            (t = m[0]),
                            (e = m[1]),
                            (n = m[2]),
                            (a = m[3]),
                            (s = m[4]),
                            !(f = m[9] = void 0 === m[9] ? (h ? 0 : t.length) : an(m[9] - l, 0)) &&
                                24 & e &&
                                (e &= -25),
                            e && 1 != e)
                        )
                            y =
                                8 == e || 16 == e
                                    ? (function (t, e, n) {
                                          var i = Ti(t);
                                          return function o() {
                                              for (var a = arguments.length, s = r(a), u = a, c = $i(o); u--; )
                                                  s[u] = arguments[u];
                                              var f = a < 3 && s[0] !== c && s[a - 1] !== c ? [] : Be(s, c);
                                              if ((a -= f.length) < n)
                                                  return Pi(
                                                      t,
                                                      e,
                                                      Ai,
                                                      o.placeholder,
                                                      void 0,
                                                      s,
                                                      f,
                                                      void 0,
                                                      void 0,
                                                      n - a,
                                                  );
                                              var h = this && this !== Gt && this instanceof o ? i : t;
                                              return ie(h, this, s);
                                          };
                                      })(t, e, f)
                                    : (32 != e && 33 != e) || s.length
                                      ? Ai.apply(void 0, m)
                                      : (function (t, e, n, i) {
                                            var o = 1 & e,
                                                a = Ti(t);
                                            return function e() {
                                                for (
                                                    var s = -1,
                                                        u = arguments.length,
                                                        c = -1,
                                                        f = i.length,
                                                        h = r(f + u),
                                                        l = this && this !== Gt && this instanceof e ? a : t;
                                                    ++c < f;

                                                )
                                                    h[c] = i[c];
                                                for (; u--; ) h[c++] = arguments[++s];
                                                return ie(l, o ? n : this, h);
                                            };
                                        })(t, e, n, a);
                        else
                            var y = (function (t, e, n) {
                                var r = 1 & e,
                                    i = Ti(t);
                                return function e() {
                                    var o = this && this !== Gt && this instanceof e ? i : t;
                                    return o.apply(r ? n : this, arguments);
                                };
                            })(t, e, n);
                        return xo((v ? Vr : _o)(y, m), t, e);
                    }
                    function zi(t, e, n, r) {
                        return void 0 === t || (Ca(t, bt[n]) && !St.call(r, n)) ? e : t;
                    }
                    function Bi(t, e, n, r, i, o) {
                        return qa(t) && qa(e) && (o.set(e, t), Ir(t, e, void 0, Bi, o), o.delete(e)), t;
                    }
                    function Vi(t) {
                        return Ha(t) ? void 0 : t;
                    }
                    function qi(t, e, n, r, i, o) {
                        var a = 1 & n,
                            s = t.length,
                            u = e.length;
                        if (s != u && !(a && u > s)) return !1;
                        var c = o.get(t),
                            f = o.get(e);
                        if (c && f) return c == e && f == t;
                        var h = -1,
                            l = !0,
                            p = 2 & n ? new Rn() : void 0;
                        for (o.set(t, e), o.set(e, t); ++h < s; ) {
                            var d = t[h],
                                v = e[h];
                            if (r) var m = a ? r(v, d, h, e, t, o) : r(d, v, h, t, e, o);
                            if (void 0 !== m) {
                                if (m) continue;
                                l = !1;
                                break;
                            }
                            if (p) {
                                if (
                                    !me(e, function (t, e) {
                                        if (!Me(p, e) && (d === t || i(d, t, n, r, o))) return p.push(e);
                                    })
                                ) {
                                    l = !1;
                                    break;
                                }
                            } else if (d !== v && !i(d, v, n, r, o)) {
                                l = !1;
                                break;
                            }
                        }
                        return o.delete(t), o.delete(e), l;
                    }
                    function Yi(t) {
                        return bo(vo(t, void 0, ko), t + '');
                    }
                    function Xi(t) {
                        return lr(t, ws, to);
                    }
                    function Gi(t) {
                        return lr(t, bs, eo);
                    }
                    var Hi = gn
                        ? function (t) {
                              return gn.get(t);
                          }
                        : Zs;
                    function Wi(t) {
                        for (var e = t.name + '', n = _n[e], r = St.call(_n, e) ? n.length : 0; r--; ) {
                            var i = n[r],
                                o = i.func;
                            if (null == o || o == t) return i.name;
                        }
                        return e;
                    }
                    function $i(t) {
                        return (St.call(An, 'placeholder') ? An : t).placeholder;
                    }
                    function Qi() {
                        var t = An.iteratee || Hs;
                        return (t = t === Hs ? Er : t), arguments.length ? t(arguments[0], arguments[1]) : t;
                    }
                    function Zi(t, e) {
                        var n,
                            r,
                            i = t.__data__;
                        return (
                            'string' == (r = typeof (n = e)) || 'number' == r || 'symbol' == r || 'boolean' == r
                                ? '__proto__' !== n
                                : null === n
                        )
                            ? i['string' == typeof e ? 'string' : 'hash']
                            : i.map;
                    }
                    function Ji(t) {
                        for (var e = ws(t), n = e.length; n--; ) {
                            var r = e[n],
                                i = t[r];
                            e[n] = [r, i, lo(i)];
                        }
                        return e;
                    }
                    function Ki(t, e) {
                        var n = (function (t, e) {
                            return null == t ? void 0 : t[e];
                        })(t, e);
                        return xr(n) ? n : void 0;
                    }
                    var to = tn
                            ? function (t) {
                                  return null == t
                                      ? []
                                      : ((t = vt(t)),
                                        ce(tn(t), function (e) {
                                            return Wt.call(t, e);
                                        }));
                              }
                            : iu,
                        eo = tn
                            ? function (t) {
                                  for (var e = []; t; ) pe(e, to(t)), (t = Xt(t));
                                  return e;
                              }
                            : iu,
                        no = pr;
                    function ro(t, e, n) {
                        for (var r = -1, i = (e = si(e, t)).length, o = !1; ++r < i; ) {
                            var a = No(e[r]);
                            if (!(o = null != t && n(t, a))) break;
                            t = t[a];
                        }
                        return o || ++r != i
                            ? o
                            : !!(i = null == t ? 0 : t.length) && Va(i) && ao(a, i) && (Ua(t) || Da(t));
                    }
                    function io(t) {
                        return 'function' != typeof t.constructor || ho(t) ? {} : Cn(Xt(t));
                    }
                    function oo(t) {
                        return Ua(t) || Da(t) || !!(Zt && t && t[Zt]);
                    }
                    function ao(t, e) {
                        var n = typeof t;
                        return (
                            !!(e = null == e ? 9007199254740991 : e) &&
                            ('number' == n || ('symbol' != n && st.test(t))) &&
                            t > -1 &&
                            t % 1 == 0 &&
                            t < e
                        );
                    }
                    function so(t, e, n) {
                        if (!qa(n)) return !1;
                        var r = typeof e;
                        return !!('number' == r ? Pa(n) && ao(e, n.length) : 'string' == r && e in n) && Ca(n[e], t);
                    }
                    function uo(t, e) {
                        if (Ua(t)) return !1;
                        var n = typeof t;
                        return (
                            !('number' != n && 'symbol' != n && 'boolean' != n && null != t && !Za(t)) ||
                            q.test(t) ||
                            !V.test(t) ||
                            (null != e && t in vt(e))
                        );
                    }
                    function co(t) {
                        var e = Wi(t),
                            n = An[e];
                        if ('function' != typeof n || !(e in Dn.prototype)) return !1;
                        if (t === n) return !0;
                        var r = Hi(n);
                        return !!r && t === r[0];
                    }
                    ((ln && no(new ln(new ArrayBuffer(1))) != E) ||
                        (pn && no(new pn()) != d) ||
                        (dn && '[object Promise]' != no(dn.resolve())) ||
                        (vn && no(new vn()) != g) ||
                        (mn && no(new mn()) != b)) &&
                        (no = function (t) {
                            var e = pr(t),
                                n = e == m ? t.constructor : void 0,
                                r = n ? Oo(n) : '';
                            if (r)
                                switch (r) {
                                    case wn:
                                        return E;
                                    case bn:
                                        return d;
                                    case xn:
                                        return '[object Promise]';
                                    case En:
                                        return g;
                                    case Sn:
                                        return b;
                                }
                            return e;
                        });
                    var fo = xt ? za : ou;
                    function ho(t) {
                        var e = t && t.constructor;
                        return t === (('function' == typeof e && e.prototype) || bt);
                    }
                    function lo(t) {
                        return t == t && !qa(t);
                    }
                    function po(t, e) {
                        return function (n) {
                            return null != n && n[t] === e && (void 0 !== e || t in vt(n));
                        };
                    }
                    function vo(t, e, n) {
                        return (
                            (e = an(void 0 === e ? t.length - 1 : e, 0)),
                            function () {
                                for (var i = arguments, o = -1, a = an(i.length - e, 0), s = r(a); ++o < a; )
                                    s[o] = i[e + o];
                                o = -1;
                                for (var u = r(e + 1); ++o < e; ) u[o] = i[o];
                                return (u[e] = n(s)), ie(t, this, u);
                            }
                        );
                    }
                    function mo(t, e) {
                        return e.length < 2 ? t : hr(t, Xr(e, 0, -1));
                    }
                    function yo(t, e) {
                        for (var n = t.length, r = sn(e.length, n), i = yi(t); r--; ) {
                            var o = e[r];
                            t[r] = ao(o, n) ? i[o] : void 0;
                        }
                        return t;
                    }
                    function go(t, e) {
                        if (('constructor' !== e || 'function' != typeof t[e]) && '__proto__' != e) return t[e];
                    }
                    var _o = Eo(Vr),
                        wo =
                            Ze ||
                            function (t, e) {
                                return Gt.setTimeout(t, e);
                            },
                        bo = Eo(qr);
                    function xo(t, e, n) {
                        var r = e + '';
                        return bo(
                            t,
                            (function (t, e) {
                                var n = e.length;
                                if (!n) return t;
                                var r = n - 1;
                                return (
                                    (e[r] = (n > 1 ? '& ' : '') + e[r]),
                                    (e = e.join(n > 2 ? ', ' : ' ')),
                                    t.replace(Q, '{\n/* [wrapped with ' + e + '] */\n')
                                );
                            })(
                                r,
                                (function (t, e) {
                                    return (
                                        ae(a, function (n) {
                                            var r = '_.' + n[0];
                                            e & n[1] && !fe(t, r) && t.push(r);
                                        }),
                                        t.sort()
                                    );
                                })(
                                    (function (t) {
                                        var e = t.match(Z);
                                        return e ? e[1].split(J) : [];
                                    })(r),
                                    n,
                                ),
                            ),
                        );
                    }
                    function Eo(t) {
                        var e = 0,
                            n = 0;
                        return function () {
                            var r = un(),
                                i = 16 - (r - n);
                            if (((n = r), i > 0)) {
                                if (++e >= 800) return arguments[0];
                            } else e = 0;
                            return t.apply(void 0, arguments);
                        };
                    }
                    function So(t, e) {
                        var n = -1,
                            r = t.length,
                            i = r - 1;
                        for (e = void 0 === e ? r : e; ++n < e; ) {
                            var o = Rr(n, i),
                                a = t[o];
                            (t[o] = t[n]), (t[n] = a);
                        }
                        return (t.length = e), t;
                    }
                    var To = (function (t) {
                        var e = Ea(t, function (t) {
                                return 500 === n.size && n.clear(), t;
                            }),
                            n = e.cache;
                        return e;
                    })(function (t) {
                        var e = [];
                        return (
                            46 === t.charCodeAt(0) && e.push(''),
                            t.replace(Y, function (t, n, r, i) {
                                e.push(r ? i.replace(tt, '$1') : n || t);
                            }),
                            e
                        );
                    });
                    function No(t) {
                        if ('string' == typeof t || Za(t)) return t;
                        var e = t + '';
                        return '0' == e && 1 / t == -1 / 0 ? '-0' : e;
                    }
                    function Oo(t) {
                        if (null != t) {
                            try {
                                return Et.call(t);
                            } catch (t) {}
                            try {
                                return t + '';
                            } catch (t) {}
                        }
                        return '';
                    }
                    function Ao(t) {
                        if (t instanceof Dn) return t.clone();
                        var e = new Mn(t.__wrapped__, t.__chain__);
                        return (
                            (e.__actions__ = yi(t.__actions__)),
                            (e.__index__ = t.__index__),
                            (e.__values__ = t.__values__),
                            e
                        );
                    }
                    var Co = Lr(function (t, e) {
                            return Ra(t) ? Kn(t, or(e, 1, Ra, !0)) : [];
                        }),
                        Io = Lr(function (t, e) {
                            var n = jo(e);
                            return Ra(n) && (n = void 0), Ra(t) ? Kn(t, or(e, 1, Ra, !0), Qi(n, 2)) : [];
                        }),
                        Mo = Lr(function (t, e) {
                            var n = jo(e);
                            return Ra(n) && (n = void 0), Ra(t) ? Kn(t, or(e, 1, Ra, !0), void 0, n) : [];
                        });
                    function Do(t, e, n) {
                        var r = null == t ? 0 : t.length;
                        if (!r) return -1;
                        var i = null == n ? 0 : rs(n);
                        return i < 0 && (i = an(r + i, 0)), _e(t, Qi(e, 3), i);
                    }
                    function Uo(t, e, n) {
                        var r = null == t ? 0 : t.length;
                        if (!r) return -1;
                        var i = r - 1;
                        return (
                            void 0 !== n && ((i = rs(n)), (i = n < 0 ? an(r + i, 0) : sn(i, r - 1))),
                            _e(t, Qi(e, 3), i, !0)
                        );
                    }
                    function ko(t) {
                        return (null == t ? 0 : t.length) ? or(t, 1) : [];
                    }
                    function Po(t) {
                        return t && t.length ? t[0] : void 0;
                    }
                    var Ro = Lr(function (t) {
                            var e = le(t, oi);
                            return e.length && e[0] === t[0] ? yr(e) : [];
                        }),
                        Fo = Lr(function (t) {
                            var e = jo(t),
                                n = le(t, oi);
                            return (
                                e === jo(n) ? (e = void 0) : n.pop(), n.length && n[0] === t[0] ? yr(n, Qi(e, 2)) : []
                            );
                        }),
                        Lo = Lr(function (t) {
                            var e = jo(t),
                                n = le(t, oi);
                            return (
                                (e = 'function' == typeof e ? e : void 0) && n.pop(),
                                n.length && n[0] === t[0] ? yr(n, void 0, e) : []
                            );
                        });
                    function jo(t) {
                        var e = null == t ? 0 : t.length;
                        return e ? t[e - 1] : void 0;
                    }
                    var zo = Lr(Bo);
                    function Bo(t, e) {
                        return t && t.length && e && e.length ? kr(t, e) : t;
                    }
                    var Vo = Yi(function (t, e) {
                        var n = null == t ? 0 : t.length,
                            r = Wn(t, e);
                        return (
                            Pr(
                                t,
                                le(e, function (t) {
                                    return ao(t, n) ? +t : t;
                                }).sort(di),
                            ),
                            r
                        );
                    });
                    function qo(t) {
                        return null == t ? t : hn.call(t);
                    }
                    var Yo = Lr(function (t) {
                            return Jr(or(t, 1, Ra, !0));
                        }),
                        Xo = Lr(function (t) {
                            var e = jo(t);
                            return Ra(e) && (e = void 0), Jr(or(t, 1, Ra, !0), Qi(e, 2));
                        }),
                        Go = Lr(function (t) {
                            var e = jo(t);
                            return (e = 'function' == typeof e ? e : void 0), Jr(or(t, 1, Ra, !0), void 0, e);
                        });
                    function Ho(t) {
                        if (!t || !t.length) return [];
                        var e = 0;
                        return (
                            (t = ce(t, function (t) {
                                if (Ra(t)) return (e = an(t.length, e)), !0;
                            })),
                            Ae(e, function (e) {
                                return le(t, Se(e));
                            })
                        );
                    }
                    function Wo(t, e) {
                        if (!t || !t.length) return [];
                        var n = Ho(t);
                        return null == e
                            ? n
                            : le(n, function (t) {
                                  return ie(e, void 0, t);
                              });
                    }
                    var $o = Lr(function (t, e) {
                            return Ra(t) ? Kn(t, e) : [];
                        }),
                        Qo = Lr(function (t) {
                            return ri(ce(t, Ra));
                        }),
                        Zo = Lr(function (t) {
                            var e = jo(t);
                            return Ra(e) && (e = void 0), ri(ce(t, Ra), Qi(e, 2));
                        }),
                        Jo = Lr(function (t) {
                            var e = jo(t);
                            return (e = 'function' == typeof e ? e : void 0), ri(ce(t, Ra), void 0, e);
                        }),
                        Ko = Lr(Ho);
                    var ta = Lr(function (t) {
                        var e = t.length,
                            n = e > 1 ? t[e - 1] : void 0;
                        return (n = 'function' == typeof n ? (t.pop(), n) : void 0), Wo(t, n);
                    });
                    function ea(t) {
                        var e = An(t);
                        return (e.__chain__ = !0), e;
                    }
                    function na(t, e) {
                        return e(t);
                    }
                    var ra = Yi(function (t) {
                        var e = t.length,
                            n = e ? t[0] : 0,
                            r = this.__wrapped__,
                            i = function (e) {
                                return Wn(e, t);
                            };
                        return !(e > 1 || this.__actions__.length) && r instanceof Dn && ao(n)
                            ? ((r = r.slice(n, +n + (e ? 1 : 0))).__actions__.push({
                                  func: na,
                                  args: [i],
                                  thisArg: void 0,
                              }),
                              new Mn(r, this.__chain__).thru(function (t) {
                                  return e && !t.length && t.push(void 0), t;
                              }))
                            : this.thru(i);
                    });
                    var ia = _i(function (t, e, n) {
                        St.call(t, n) ? ++t[n] : Hn(t, n, 1);
                    });
                    var oa = Ni(Do),
                        aa = Ni(Uo);
                    function sa(t, e) {
                        return (Ua(t) ? ae : tr)(t, Qi(e, 3));
                    }
                    function ua(t, e) {
                        return (Ua(t) ? se : er)(t, Qi(e, 3));
                    }
                    var ca = _i(function (t, e, n) {
                        St.call(t, n) ? t[n].push(e) : Hn(t, n, [e]);
                    });
                    var fa = Lr(function (t, e, n) {
                            var i = -1,
                                o = 'function' == typeof e,
                                a = Pa(t) ? r(t.length) : [];
                            return (
                                tr(t, function (t) {
                                    a[++i] = o ? ie(e, t, n) : gr(t, e, n);
                                }),
                                a
                            );
                        }),
                        ha = _i(function (t, e, n) {
                            Hn(t, n, e);
                        });
                    function la(t, e) {
                        return (Ua(t) ? le : Or)(t, Qi(e, 3));
                    }
                    var pa = _i(
                        function (t, e, n) {
                            t[n ? 0 : 1].push(e);
                        },
                        function () {
                            return [[], []];
                        },
                    );
                    var da = Lr(function (t, e) {
                            if (null == t) return [];
                            var n = e.length;
                            return (
                                n > 1 && so(t, e[0], e[1]) ? (e = []) : n > 2 && so(e[0], e[1], e[2]) && (e = [e[0]]),
                                Dr(t, or(e, 1), [])
                            );
                        }),
                        va =
                            Qe ||
                            function () {
                                return Gt.Date.now();
                            };
                    function ma(t, e, n) {
                        return (
                            (e = n ? void 0 : e),
                            ji(t, 128, void 0, void 0, void 0, void 0, (e = t && null == e ? t.length : e))
                        );
                    }
                    function ya(t, e) {
                        var n;
                        if ('function' != typeof e) throw new gt(i);
                        return (
                            (t = rs(t)),
                            function () {
                                return --t > 0 && (n = e.apply(this, arguments)), t <= 1 && (e = void 0), n;
                            }
                        );
                    }
                    var ga = Lr(function (t, e, n) {
                            var r = 1;
                            if (n.length) {
                                var i = Be(n, $i(ga));
                                r |= 32;
                            }
                            return ji(t, r, e, n, i);
                        }),
                        _a = Lr(function (t, e, n) {
                            var r = 3;
                            if (n.length) {
                                var i = Be(n, $i(_a));
                                r |= 32;
                            }
                            return ji(e, r, t, n, i);
                        });
                    function wa(t, e, n) {
                        var r,
                            o,
                            a,
                            s,
                            u,
                            c,
                            f = 0,
                            h = !1,
                            l = !1,
                            p = !0;
                        if ('function' != typeof t) throw new gt(i);
                        function d(e) {
                            var n = r,
                                i = o;
                            return (r = o = void 0), (f = e), (s = t.apply(i, n));
                        }
                        function v(t) {
                            return (f = t), (u = wo(y, e)), h ? d(t) : s;
                        }
                        function m(t) {
                            var n = t - c;
                            return void 0 === c || n >= e || n < 0 || (l && t - f >= a);
                        }
                        function y() {
                            var t = va();
                            if (m(t)) return g(t);
                            u = wo(
                                y,
                                (function (t) {
                                    var n = e - (t - c);
                                    return l ? sn(n, a - (t - f)) : n;
                                })(t),
                            );
                        }
                        function g(t) {
                            return (u = void 0), p && r ? d(t) : ((r = o = void 0), s);
                        }
                        function _() {
                            var t = va(),
                                n = m(t);
                            if (((r = arguments), (o = this), (c = t), n)) {
                                if (void 0 === u) return v(c);
                                if (l) return fi(u), (u = wo(y, e)), d(c);
                            }
                            return void 0 === u && (u = wo(y, e)), s;
                        }
                        return (
                            (e = os(e) || 0),
                            qa(n) &&
                                ((h = !!n.leading),
                                (a = (l = 'maxWait' in n) ? an(os(n.maxWait) || 0, e) : a),
                                (p = 'trailing' in n ? !!n.trailing : p)),
                            (_.cancel = function () {
                                void 0 !== u && fi(u), (f = 0), (r = c = o = u = void 0);
                            }),
                            (_.flush = function () {
                                return void 0 === u ? s : g(va());
                            }),
                            _
                        );
                    }
                    var ba = Lr(function (t, e) {
                            return Jn(t, 1, e);
                        }),
                        xa = Lr(function (t, e, n) {
                            return Jn(t, os(e) || 0, n);
                        });
                    function Ea(t, e) {
                        if ('function' != typeof t || (null != e && 'function' != typeof e)) throw new gt(i);
                        var n = function () {
                            var r = arguments,
                                i = e ? e.apply(this, r) : r[0],
                                o = n.cache;
                            if (o.has(i)) return o.get(i);
                            var a = t.apply(this, r);
                            return (n.cache = o.set(i, a) || o), a;
                        };
                        return (n.cache = new (Ea.Cache || Pn)()), n;
                    }
                    function Sa(t) {
                        if ('function' != typeof t) throw new gt(i);
                        return function () {
                            var e = arguments;
                            switch (e.length) {
                                case 0:
                                    return !t.call(this);
                                case 1:
                                    return !t.call(this, e[0]);
                                case 2:
                                    return !t.call(this, e[0], e[1]);
                                case 3:
                                    return !t.call(this, e[0], e[1], e[2]);
                            }
                            return !t.apply(this, e);
                        };
                    }
                    Ea.Cache = Pn;
                    var Ta = ui(function (t, e) {
                            var n = (e = 1 == e.length && Ua(e[0]) ? le(e[0], Ce(Qi())) : le(or(e, 1), Ce(Qi())))
                                .length;
                            return Lr(function (r) {
                                for (var i = -1, o = sn(r.length, n); ++i < o; ) r[i] = e[i].call(this, r[i]);
                                return ie(t, this, r);
                            });
                        }),
                        Na = Lr(function (t, e) {
                            return ji(t, 32, void 0, e, Be(e, $i(Na)));
                        }),
                        Oa = Lr(function (t, e) {
                            return ji(t, 64, void 0, e, Be(e, $i(Oa)));
                        }),
                        Aa = Yi(function (t, e) {
                            return ji(t, 256, void 0, void 0, void 0, e);
                        });
                    function Ca(t, e) {
                        return t === e || (t != t && e != e);
                    }
                    var Ia = ki(dr),
                        Ma = ki(function (t, e) {
                            return t >= e;
                        }),
                        Da = _r(
                            (function () {
                                return arguments;
                            })(),
                        )
                            ? _r
                            : function (t) {
                                  return Ya(t) && St.call(t, 'callee') && !Wt.call(t, 'callee');
                              },
                        Ua = r.isArray,
                        ka = Jt
                            ? Ce(Jt)
                            : function (t) {
                                  return Ya(t) && pr(t) == x;
                              };
                    function Pa(t) {
                        return null != t && Va(t.length) && !za(t);
                    }
                    function Ra(t) {
                        return Ya(t) && Pa(t);
                    }
                    var Fa = en || ou,
                        La = Kt
                            ? Ce(Kt)
                            : function (t) {
                                  return Ya(t) && pr(t) == f;
                              };
                    function ja(t) {
                        if (!Ya(t)) return !1;
                        var e = pr(t);
                        return (
                            e == h ||
                            '[object DOMException]' == e ||
                            ('string' == typeof t.message && 'string' == typeof t.name && !Ha(t))
                        );
                    }
                    function za(t) {
                        if (!qa(t)) return !1;
                        var e = pr(t);
                        return e == l || e == p || '[object AsyncFunction]' == e || '[object Proxy]' == e;
                    }
                    function Ba(t) {
                        return 'number' == typeof t && t == rs(t);
                    }
                    function Va(t) {
                        return 'number' == typeof t && t > -1 && t % 1 == 0 && t <= 9007199254740991;
                    }
                    function qa(t) {
                        var e = typeof t;
                        return null != t && ('object' == e || 'function' == e);
                    }
                    function Ya(t) {
                        return null != t && 'object' == typeof t;
                    }
                    var Xa = te
                        ? Ce(te)
                        : function (t) {
                              return Ya(t) && no(t) == d;
                          };
                    function Ga(t) {
                        return 'number' == typeof t || (Ya(t) && pr(t) == v);
                    }
                    function Ha(t) {
                        if (!Ya(t) || pr(t) != m) return !1;
                        var e = Xt(t);
                        if (null === e) return !0;
                        var n = St.call(e, 'constructor') && e.constructor;
                        return 'function' == typeof n && n instanceof n && Et.call(n) == At;
                    }
                    var Wa = ee
                        ? Ce(ee)
                        : function (t) {
                              return Ya(t) && pr(t) == y;
                          };
                    var $a = ne
                        ? Ce(ne)
                        : function (t) {
                              return Ya(t) && no(t) == g;
                          };
                    function Qa(t) {
                        return 'string' == typeof t || (!Ua(t) && Ya(t) && pr(t) == _);
                    }
                    function Za(t) {
                        return 'symbol' == typeof t || (Ya(t) && pr(t) == w);
                    }
                    var Ja = re
                        ? Ce(re)
                        : function (t) {
                              return Ya(t) && Va(t.length) && !!jt[pr(t)];
                          };
                    var Ka = ki(Nr),
                        ts = ki(function (t, e) {
                            return t <= e;
                        });
                    function es(t) {
                        if (!t) return [];
                        if (Pa(t)) return Qa(t) ? Xe(t) : yi(t);
                        if (ye && t[ye])
                            return (function (t) {
                                for (var e, n = []; !(e = t.next()).done; ) n.push(e.value);
                                return n;
                            })(t[ye]());
                        var e = no(t);
                        return (e == d ? je : e == g ? Ve : Cs)(t);
                    }
                    function ns(t) {
                        return t
                            ? (t = os(t)) === 1 / 0 || t === -1 / 0
                                ? 17976931348623157e292 * (t < 0 ? -1 : 1)
                                : t == t
                                  ? t
                                  : 0
                            : 0 === t
                              ? t
                              : 0;
                    }
                    function rs(t) {
                        var e = ns(t),
                            n = e % 1;
                        return e == e ? (n ? e - n : e) : 0;
                    }
                    function is(t) {
                        return t ? $n(rs(t), 0, 4294967295) : 0;
                    }
                    function os(t) {
                        if ('number' == typeof t) return t;
                        if (Za(t)) return NaN;
                        if (qa(t)) {
                            var e = 'function' == typeof t.valueOf ? t.valueOf() : t;
                            t = qa(e) ? e + '' : e;
                        }
                        if ('string' != typeof t) return 0 === t ? t : +t;
                        t = t.replace(H, '');
                        var n = it.test(t);
                        return n || at.test(t) ? qt(t.slice(2), n ? 2 : 8) : rt.test(t) ? NaN : +t;
                    }
                    function as(t) {
                        return gi(t, bs(t));
                    }
                    function ss(t) {
                        return null == t ? '' : Zr(t);
                    }
                    var us = wi(function (t, e) {
                            if (ho(e) || Pa(e)) gi(e, ws(e), t);
                            else for (var n in e) St.call(e, n) && qn(t, n, e[n]);
                        }),
                        cs = wi(function (t, e) {
                            gi(e, bs(e), t);
                        }),
                        fs = wi(function (t, e, n, r) {
                            gi(e, bs(e), t, r);
                        }),
                        hs = wi(function (t, e, n, r) {
                            gi(e, ws(e), t, r);
                        }),
                        ls = Yi(Wn);
                    var ps = Lr(function (t, e) {
                            t = vt(t);
                            var n = -1,
                                r = e.length,
                                i = r > 2 ? e[2] : void 0;
                            for (i && so(e[0], e[1], i) && (r = 1); ++n < r; )
                                for (var o = e[n], a = bs(o), s = -1, u = a.length; ++s < u; ) {
                                    var c = a[s],
                                        f = t[c];
                                    (void 0 === f || (Ca(f, bt[c]) && !St.call(t, c))) && (t[c] = o[c]);
                                }
                            return t;
                        }),
                        ds = Lr(function (t) {
                            return t.push(void 0, Bi), ie(Es, void 0, t);
                        });
                    function vs(t, e, n) {
                        var r = null == t ? void 0 : hr(t, e);
                        return void 0 === r ? n : r;
                    }
                    function ms(t, e) {
                        return null != t && ro(t, e, mr);
                    }
                    var ys = Ci(function (t, e, n) {
                            null != e && 'function' != typeof e.toString && (e = Ot.call(e)), (t[e] = n);
                        }, qs(Gs)),
                        gs = Ci(function (t, e, n) {
                            null != e && 'function' != typeof e.toString && (e = Ot.call(e)),
                                St.call(t, e) ? t[e].push(n) : (t[e] = [n]);
                        }, Qi),
                        _s = Lr(gr);
                    function ws(t) {
                        return Pa(t) ? Ln(t) : Sr(t);
                    }
                    function bs(t) {
                        return Pa(t) ? Ln(t, !0) : Tr(t);
                    }
                    var xs = wi(function (t, e, n) {
                            Ir(t, e, n);
                        }),
                        Es = wi(function (t, e, n, r) {
                            Ir(t, e, n, r);
                        }),
                        Ss = Yi(function (t, e) {
                            var n = {};
                            if (null == t) return n;
                            var r = !1;
                            (e = le(e, function (e) {
                                return (e = si(e, t)), r || (r = e.length > 1), e;
                            })),
                                gi(t, Gi(t), n),
                                r && (n = Qn(n, 7, Vi));
                            for (var i = e.length; i--; ) Kr(n, e[i]);
                            return n;
                        });
                    var Ts = Yi(function (t, e) {
                        return null == t
                            ? {}
                            : (function (t, e) {
                                  return Ur(t, e, function (e, n) {
                                      return ms(t, n);
                                  });
                              })(t, e);
                    });
                    function Ns(t, e) {
                        if (null == t) return {};
                        var n = le(Gi(t), function (t) {
                            return [t];
                        });
                        return (
                            (e = Qi(e)),
                            Ur(t, n, function (t, n) {
                                return e(t, n[0]);
                            })
                        );
                    }
                    var Os = Li(ws),
                        As = Li(bs);
                    function Cs(t) {
                        return null == t ? [] : Ie(t, ws(t));
                    }
                    var Is = Si(function (t, e, n) {
                        return (e = e.toLowerCase()), t + (n ? Ms(e) : e);
                    });
                    function Ms(t) {
                        return js(ss(t).toLowerCase());
                    }
                    function Ds(t) {
                        return (t = ss(t)) && t.replace(ut, Pe).replace(Dt, '');
                    }
                    var Us = Si(function (t, e, n) {
                            return t + (n ? '-' : '') + e.toLowerCase();
                        }),
                        ks = Si(function (t, e, n) {
                            return t + (n ? ' ' : '') + e.toLowerCase();
                        }),
                        Ps = Ei('toLowerCase');
                    var Rs = Si(function (t, e, n) {
                        return t + (n ? '_' : '') + e.toLowerCase();
                    });
                    var Fs = Si(function (t, e, n) {
                        return t + (n ? ' ' : '') + js(e);
                    });
                    var Ls = Si(function (t, e, n) {
                            return t + (n ? ' ' : '') + e.toUpperCase();
                        }),
                        js = Ei('toUpperCase');
                    function zs(t, e, n) {
                        return (
                            (t = ss(t)),
                            void 0 === (e = n ? void 0 : e)
                                ? (function (t) {
                                      return Rt.test(t);
                                  })(t)
                                    ? (function (t) {
                                          return t.match(kt) || [];
                                      })(t)
                                    : (function (t) {
                                          return t.match(K) || [];
                                      })(t)
                                : t.match(e) || []
                        );
                    }
                    var Bs = Lr(function (t, e) {
                            try {
                                return ie(t, void 0, e);
                            } catch (t) {
                                return ja(t) ? t : new lt(t);
                            }
                        }),
                        Vs = Yi(function (t, e) {
                            return (
                                ae(e, function (e) {
                                    (e = No(e)), Hn(t, e, ga(t[e], t));
                                }),
                                t
                            );
                        });
                    function qs(t) {
                        return function () {
                            return t;
                        };
                    }
                    var Ys = Oi(),
                        Xs = Oi(!0);
                    function Gs(t) {
                        return t;
                    }
                    function Hs(t) {
                        return Er('function' == typeof t ? t : Qn(t, 1));
                    }
                    var Ws = Lr(function (t, e) {
                            return function (n) {
                                return gr(n, t, e);
                            };
                        }),
                        $s = Lr(function (t, e) {
                            return function (n) {
                                return gr(t, n, e);
                            };
                        });
                    function Qs(t, e, n) {
                        var r = ws(e),
                            i = fr(e, r);
                        null != n ||
                            (qa(e) && (i.length || !r.length)) ||
                            ((n = e), (e = t), (t = this), (i = fr(e, ws(e))));
                        var o = !(qa(n) && 'chain' in n && !n.chain),
                            a = za(t);
                        return (
                            ae(i, function (n) {
                                var r = e[n];
                                (t[n] = r),
                                    a &&
                                        (t.prototype[n] = function () {
                                            var e = this.__chain__;
                                            if (o || e) {
                                                var n = t(this.__wrapped__),
                                                    i = (n.__actions__ = yi(this.__actions__));
                                                return (
                                                    i.push({
                                                        func: r,
                                                        args: arguments,
                                                        thisArg: t,
                                                    }),
                                                    (n.__chain__ = e),
                                                    n
                                                );
                                            }
                                            return r.apply(t, pe([this.value()], arguments));
                                        });
                            }),
                            t
                        );
                    }
                    function Zs() {}
                    var Js = Mi(le),
                        Ks = Mi(ue),
                        tu = Mi(me);
                    function eu(t) {
                        return uo(t)
                            ? Se(No(t))
                            : (function (t) {
                                  return function (e) {
                                      return hr(e, t);
                                  };
                              })(t);
                    }
                    var nu = Ui(),
                        ru = Ui(!0);
                    function iu() {
                        return [];
                    }
                    function ou() {
                        return !1;
                    }
                    var au = Ii(function (t, e) {
                            return t + e;
                        }, 0),
                        su = Ri('ceil'),
                        uu = Ii(function (t, e) {
                            return t / e;
                        }, 1),
                        cu = Ri('floor');
                    var fu,
                        hu = Ii(function (t, e) {
                            return t * e;
                        }, 1),
                        lu = Ri('round'),
                        pu = Ii(function (t, e) {
                            return t - e;
                        }, 0);
                    return (
                        (An.after = function (t, e) {
                            if ('function' != typeof e) throw new gt(i);
                            return (
                                (t = rs(t)),
                                function () {
                                    if (--t < 1) return e.apply(this, arguments);
                                }
                            );
                        }),
                        (An.ary = ma),
                        (An.assign = us),
                        (An.assignIn = cs),
                        (An.assignInWith = fs),
                        (An.assignWith = hs),
                        (An.at = ls),
                        (An.before = ya),
                        (An.bind = ga),
                        (An.bindAll = Vs),
                        (An.bindKey = _a),
                        (An.castArray = function () {
                            if (!arguments.length) return [];
                            var t = arguments[0];
                            return Ua(t) ? t : [t];
                        }),
                        (An.chain = ea),
                        (An.chunk = function (t, e, n) {
                            e = (n ? so(t, e, n) : void 0 === e) ? 1 : an(rs(e), 0);
                            var i = null == t ? 0 : t.length;
                            if (!i || e < 1) return [];
                            for (var o = 0, a = 0, s = r(Je(i / e)); o < i; ) s[a++] = Xr(t, o, (o += e));
                            return s;
                        }),
                        (An.compact = function (t) {
                            for (var e = -1, n = null == t ? 0 : t.length, r = 0, i = []; ++e < n; ) {
                                var o = t[e];
                                o && (i[r++] = o);
                            }
                            return i;
                        }),
                        (An.concat = function () {
                            var t = arguments.length;
                            if (!t) return [];
                            for (var e = r(t - 1), n = arguments[0], i = t; i--; ) e[i - 1] = arguments[i];
                            return pe(Ua(n) ? yi(n) : [n], or(e, 1));
                        }),
                        (An.cond = function (t) {
                            var e = null == t ? 0 : t.length,
                                n = Qi();
                            return (
                                (t = e
                                    ? le(t, function (t) {
                                          if ('function' != typeof t[1]) throw new gt(i);
                                          return [n(t[0]), t[1]];
                                      })
                                    : []),
                                Lr(function (n) {
                                    for (var r = -1; ++r < e; ) {
                                        var i = t[r];
                                        if (ie(i[0], this, n)) return ie(i[1], this, n);
                                    }
                                })
                            );
                        }),
                        (An.conforms = function (t) {
                            return (function (t) {
                                var e = ws(t);
                                return function (n) {
                                    return Zn(n, t, e);
                                };
                            })(Qn(t, 1));
                        }),
                        (An.constant = qs),
                        (An.countBy = ia),
                        (An.create = function (t, e) {
                            var n = Cn(t);
                            return null == e ? n : Gn(n, e);
                        }),
                        (An.curry = function t(e, n, r) {
                            var i = ji(e, 8, void 0, void 0, void 0, void 0, void 0, (n = r ? void 0 : n));
                            return (i.placeholder = t.placeholder), i;
                        }),
                        (An.curryRight = function t(e, n, r) {
                            var i = ji(e, 16, void 0, void 0, void 0, void 0, void 0, (n = r ? void 0 : n));
                            return (i.placeholder = t.placeholder), i;
                        }),
                        (An.debounce = wa),
                        (An.defaults = ps),
                        (An.defaultsDeep = ds),
                        (An.defer = ba),
                        (An.delay = xa),
                        (An.difference = Co),
                        (An.differenceBy = Io),
                        (An.differenceWith = Mo),
                        (An.drop = function (t, e, n) {
                            var r = null == t ? 0 : t.length;
                            return r ? Xr(t, (e = n || void 0 === e ? 1 : rs(e)) < 0 ? 0 : e, r) : [];
                        }),
                        (An.dropRight = function (t, e, n) {
                            var r = null == t ? 0 : t.length;
                            return r ? Xr(t, 0, (e = r - (e = n || void 0 === e ? 1 : rs(e))) < 0 ? 0 : e) : [];
                        }),
                        (An.dropRightWhile = function (t, e) {
                            return t && t.length ? ei(t, Qi(e, 3), !0, !0) : [];
                        }),
                        (An.dropWhile = function (t, e) {
                            return t && t.length ? ei(t, Qi(e, 3), !0) : [];
                        }),
                        (An.fill = function (t, e, n, r) {
                            var i = null == t ? 0 : t.length;
                            return i
                                ? (n && 'number' != typeof n && so(t, e, n) && ((n = 0), (r = i)),
                                  (function (t, e, n, r) {
                                      var i = t.length;
                                      for (
                                          (n = rs(n)) < 0 && (n = -n > i ? 0 : i + n),
                                              (r = void 0 === r || r > i ? i : rs(r)) < 0 && (r += i),
                                              r = n > r ? 0 : is(r);
                                          n < r;

                                      )
                                          t[n++] = e;
                                      return t;
                                  })(t, e, n, r))
                                : [];
                        }),
                        (An.filter = function (t, e) {
                            return (Ua(t) ? ce : ir)(t, Qi(e, 3));
                        }),
                        (An.flatMap = function (t, e) {
                            return or(la(t, e), 1);
                        }),
                        (An.flatMapDeep = function (t, e) {
                            return or(la(t, e), 1 / 0);
                        }),
                        (An.flatMapDepth = function (t, e, n) {
                            return (n = void 0 === n ? 1 : rs(n)), or(la(t, e), n);
                        }),
                        (An.flatten = ko),
                        (An.flattenDeep = function (t) {
                            return (null == t ? 0 : t.length) ? or(t, 1 / 0) : [];
                        }),
                        (An.flattenDepth = function (t, e) {
                            return (null == t ? 0 : t.length) ? or(t, (e = void 0 === e ? 1 : rs(e))) : [];
                        }),
                        (An.flip = function (t) {
                            return ji(t, 512);
                        }),
                        (An.flow = Ys),
                        (An.flowRight = Xs),
                        (An.fromPairs = function (t) {
                            for (var e = -1, n = null == t ? 0 : t.length, r = {}; ++e < n; ) {
                                var i = t[e];
                                r[i[0]] = i[1];
                            }
                            return r;
                        }),
                        (An.functions = function (t) {
                            return null == t ? [] : fr(t, ws(t));
                        }),
                        (An.functionsIn = function (t) {
                            return null == t ? [] : fr(t, bs(t));
                        }),
                        (An.groupBy = ca),
                        (An.initial = function (t) {
                            return (null == t ? 0 : t.length) ? Xr(t, 0, -1) : [];
                        }),
                        (An.intersection = Ro),
                        (An.intersectionBy = Fo),
                        (An.intersectionWith = Lo),
                        (An.invert = ys),
                        (An.invertBy = gs),
                        (An.invokeMap = fa),
                        (An.iteratee = Hs),
                        (An.keyBy = ha),
                        (An.keys = ws),
                        (An.keysIn = bs),
                        (An.map = la),
                        (An.mapKeys = function (t, e) {
                            var n = {};
                            return (
                                (e = Qi(e, 3)),
                                ur(t, function (t, r, i) {
                                    Hn(n, e(t, r, i), t);
                                }),
                                n
                            );
                        }),
                        (An.mapValues = function (t, e) {
                            var n = {};
                            return (
                                (e = Qi(e, 3)),
                                ur(t, function (t, r, i) {
                                    Hn(n, r, e(t, r, i));
                                }),
                                n
                            );
                        }),
                        (An.matches = function (t) {
                            return Ar(Qn(t, 1));
                        }),
                        (An.matchesProperty = function (t, e) {
                            return Cr(t, Qn(e, 1));
                        }),
                        (An.memoize = Ea),
                        (An.merge = xs),
                        (An.mergeWith = Es),
                        (An.method = Ws),
                        (An.methodOf = $s),
                        (An.mixin = Qs),
                        (An.negate = Sa),
                        (An.nthArg = function (t) {
                            return (
                                (t = rs(t)),
                                Lr(function (e) {
                                    return Mr(e, t);
                                })
                            );
                        }),
                        (An.omit = Ss),
                        (An.omitBy = function (t, e) {
                            return Ns(t, Sa(Qi(e)));
                        }),
                        (An.once = function (t) {
                            return ya(2, t);
                        }),
                        (An.orderBy = function (t, e, n, r) {
                            return null == t
                                ? []
                                : (Ua(e) || (e = null == e ? [] : [e]),
                                  Ua((n = r ? void 0 : n)) || (n = null == n ? [] : [n]),
                                  Dr(t, e, n));
                        }),
                        (An.over = Js),
                        (An.overArgs = Ta),
                        (An.overEvery = Ks),
                        (An.overSome = tu),
                        (An.partial = Na),
                        (An.partialRight = Oa),
                        (An.partition = pa),
                        (An.pick = Ts),
                        (An.pickBy = Ns),
                        (An.property = eu),
                        (An.propertyOf = function (t) {
                            return function (e) {
                                return null == t ? void 0 : hr(t, e);
                            };
                        }),
                        (An.pull = zo),
                        (An.pullAll = Bo),
                        (An.pullAllBy = function (t, e, n) {
                            return t && t.length && e && e.length ? kr(t, e, Qi(n, 2)) : t;
                        }),
                        (An.pullAllWith = function (t, e, n) {
                            return t && t.length && e && e.length ? kr(t, e, void 0, n) : t;
                        }),
                        (An.pullAt = Vo),
                        (An.range = nu),
                        (An.rangeRight = ru),
                        (An.rearg = Aa),
                        (An.reject = function (t, e) {
                            return (Ua(t) ? ce : ir)(t, Sa(Qi(e, 3)));
                        }),
                        (An.remove = function (t, e) {
                            var n = [];
                            if (!t || !t.length) return n;
                            var r = -1,
                                i = [],
                                o = t.length;
                            for (e = Qi(e, 3); ++r < o; ) {
                                var a = t[r];
                                e(a, r, t) && (n.push(a), i.push(r));
                            }
                            return Pr(t, i), n;
                        }),
                        (An.rest = function (t, e) {
                            if ('function' != typeof t) throw new gt(i);
                            return Lr(t, (e = void 0 === e ? e : rs(e)));
                        }),
                        (An.reverse = qo),
                        (An.sampleSize = function (t, e, n) {
                            return (e = (n ? so(t, e, n) : void 0 === e) ? 1 : rs(e)), (Ua(t) ? zn : zr)(t, e);
                        }),
                        (An.set = function (t, e, n) {
                            return null == t ? t : Br(t, e, n);
                        }),
                        (An.setWith = function (t, e, n, r) {
                            return (r = 'function' == typeof r ? r : void 0), null == t ? t : Br(t, e, n, r);
                        }),
                        (An.shuffle = function (t) {
                            return (Ua(t) ? Bn : Yr)(t);
                        }),
                        (An.slice = function (t, e, n) {
                            var r = null == t ? 0 : t.length;
                            return r
                                ? (n && 'number' != typeof n && so(t, e, n)
                                      ? ((e = 0), (n = r))
                                      : ((e = null == e ? 0 : rs(e)), (n = void 0 === n ? r : rs(n))),
                                  Xr(t, e, n))
                                : [];
                        }),
                        (An.sortBy = da),
                        (An.sortedUniq = function (t) {
                            return t && t.length ? $r(t) : [];
                        }),
                        (An.sortedUniqBy = function (t, e) {
                            return t && t.length ? $r(t, Qi(e, 2)) : [];
                        }),
                        (An.split = function (t, e, n) {
                            return (
                                n && 'number' != typeof n && so(t, e, n) && (e = n = void 0),
                                (n = void 0 === n ? 4294967295 : n >>> 0)
                                    ? (t = ss(t)) &&
                                      ('string' == typeof e || (null != e && !Wa(e))) &&
                                      !(e = Zr(e)) &&
                                      Le(t)
                                        ? ci(Xe(t), 0, n)
                                        : t.split(e, n)
                                    : []
                            );
                        }),
                        (An.spread = function (t, e) {
                            if ('function' != typeof t) throw new gt(i);
                            return (
                                (e = null == e ? 0 : an(rs(e), 0)),
                                Lr(function (n) {
                                    var r = n[e],
                                        i = ci(n, 0, e);
                                    return r && pe(i, r), ie(t, this, i);
                                })
                            );
                        }),
                        (An.tail = function (t) {
                            var e = null == t ? 0 : t.length;
                            return e ? Xr(t, 1, e) : [];
                        }),
                        (An.take = function (t, e, n) {
                            return t && t.length ? Xr(t, 0, (e = n || void 0 === e ? 1 : rs(e)) < 0 ? 0 : e) : [];
                        }),
                        (An.takeRight = function (t, e, n) {
                            var r = null == t ? 0 : t.length;
                            return r ? Xr(t, (e = r - (e = n || void 0 === e ? 1 : rs(e))) < 0 ? 0 : e, r) : [];
                        }),
                        (An.takeRightWhile = function (t, e) {
                            return t && t.length ? ei(t, Qi(e, 3), !1, !0) : [];
                        }),
                        (An.takeWhile = function (t, e) {
                            return t && t.length ? ei(t, Qi(e, 3)) : [];
                        }),
                        (An.tap = function (t, e) {
                            return e(t), t;
                        }),
                        (An.throttle = function (t, e, n) {
                            var r = !0,
                                o = !0;
                            if ('function' != typeof t) throw new gt(i);
                            return (
                                qa(n) &&
                                    ((r = 'leading' in n ? !!n.leading : r), (o = 'trailing' in n ? !!n.trailing : o)),
                                wa(t, e, {
                                    leading: r,
                                    maxWait: e,
                                    trailing: o,
                                })
                            );
                        }),
                        (An.thru = na),
                        (An.toArray = es),
                        (An.toPairs = Os),
                        (An.toPairsIn = As),
                        (An.toPath = function (t) {
                            return Ua(t) ? le(t, No) : Za(t) ? [t] : yi(To(ss(t)));
                        }),
                        (An.toPlainObject = as),
                        (An.transform = function (t, e, n) {
                            var r = Ua(t),
                                i = r || Fa(t) || Ja(t);
                            if (((e = Qi(e, 4)), null == n)) {
                                var o = t && t.constructor;
                                n = i ? (r ? new o() : []) : qa(t) && za(o) ? Cn(Xt(t)) : {};
                            }
                            return (
                                (i ? ae : ur)(t, function (t, r, i) {
                                    return e(n, t, r, i);
                                }),
                                n
                            );
                        }),
                        (An.unary = function (t) {
                            return ma(t, 1);
                        }),
                        (An.union = Yo),
                        (An.unionBy = Xo),
                        (An.unionWith = Go),
                        (An.uniq = function (t) {
                            return t && t.length ? Jr(t) : [];
                        }),
                        (An.uniqBy = function (t, e) {
                            return t && t.length ? Jr(t, Qi(e, 2)) : [];
                        }),
                        (An.uniqWith = function (t, e) {
                            return (e = 'function' == typeof e ? e : void 0), t && t.length ? Jr(t, void 0, e) : [];
                        }),
                        (An.unset = function (t, e) {
                            return null == t || Kr(t, e);
                        }),
                        (An.unzip = Ho),
                        (An.unzipWith = Wo),
                        (An.update = function (t, e, n) {
                            return null == t ? t : ti(t, e, ai(n));
                        }),
                        (An.updateWith = function (t, e, n, r) {
                            return (r = 'function' == typeof r ? r : void 0), null == t ? t : ti(t, e, ai(n), r);
                        }),
                        (An.values = Cs),
                        (An.valuesIn = function (t) {
                            return null == t ? [] : Ie(t, bs(t));
                        }),
                        (An.without = $o),
                        (An.words = zs),
                        (An.wrap = function (t, e) {
                            return Na(ai(e), t);
                        }),
                        (An.xor = Qo),
                        (An.xorBy = Zo),
                        (An.xorWith = Jo),
                        (An.zip = Ko),
                        (An.zipObject = function (t, e) {
                            return ii(t || [], e || [], qn);
                        }),
                        (An.zipObjectDeep = function (t, e) {
                            return ii(t || [], e || [], Br);
                        }),
                        (An.zipWith = ta),
                        (An.entries = Os),
                        (An.entriesIn = As),
                        (An.extend = cs),
                        (An.extendWith = fs),
                        Qs(An, An),
                        (An.add = au),
                        (An.attempt = Bs),
                        (An.camelCase = Is),
                        (An.capitalize = Ms),
                        (An.ceil = su),
                        (An.clamp = function (t, e, n) {
                            return (
                                void 0 === n && ((n = e), (e = void 0)),
                                void 0 !== n && (n = (n = os(n)) == n ? n : 0),
                                void 0 !== e && (e = (e = os(e)) == e ? e : 0),
                                $n(os(t), e, n)
                            );
                        }),
                        (An.clone = function (t) {
                            return Qn(t, 4);
                        }),
                        (An.cloneDeep = function (t) {
                            return Qn(t, 5);
                        }),
                        (An.cloneDeepWith = function (t, e) {
                            return Qn(t, 5, (e = 'function' == typeof e ? e : void 0));
                        }),
                        (An.cloneWith = function (t, e) {
                            return Qn(t, 4, (e = 'function' == typeof e ? e : void 0));
                        }),
                        (An.conformsTo = function (t, e) {
                            return null == e || Zn(t, e, ws(e));
                        }),
                        (An.deburr = Ds),
                        (An.defaultTo = function (t, e) {
                            return null == t || t != t ? e : t;
                        }),
                        (An.divide = uu),
                        (An.endsWith = function (t, e, n) {
                            (t = ss(t)), (e = Zr(e));
                            var r = t.length,
                                i = (n = void 0 === n ? r : $n(rs(n), 0, r));
                            return (n -= e.length) >= 0 && t.slice(n, i) == e;
                        }),
                        (An.eq = Ca),
                        (An.escape = function (t) {
                            return (t = ss(t)) && L.test(t) ? t.replace(R, Re) : t;
                        }),
                        (An.escapeRegExp = function (t) {
                            return (t = ss(t)) && G.test(t) ? t.replace(X, '\\$&') : t;
                        }),
                        (An.every = function (t, e, n) {
                            var r = Ua(t) ? ue : nr;
                            return n && so(t, e, n) && (e = void 0), r(t, Qi(e, 3));
                        }),
                        (An.find = oa),
                        (An.findIndex = Do),
                        (An.findKey = function (t, e) {
                            return ge(t, Qi(e, 3), ur);
                        }),
                        (An.findLast = aa),
                        (An.findLastIndex = Uo),
                        (An.findLastKey = function (t, e) {
                            return ge(t, Qi(e, 3), cr);
                        }),
                        (An.floor = cu),
                        (An.forEach = sa),
                        (An.forEachRight = ua),
                        (An.forIn = function (t, e) {
                            return null == t ? t : ar(t, Qi(e, 3), bs);
                        }),
                        (An.forInRight = function (t, e) {
                            return null == t ? t : sr(t, Qi(e, 3), bs);
                        }),
                        (An.forOwn = function (t, e) {
                            return t && ur(t, Qi(e, 3));
                        }),
                        (An.forOwnRight = function (t, e) {
                            return t && cr(t, Qi(e, 3));
                        }),
                        (An.get = vs),
                        (An.gt = Ia),
                        (An.gte = Ma),
                        (An.has = function (t, e) {
                            return null != t && ro(t, e, vr);
                        }),
                        (An.hasIn = ms),
                        (An.head = Po),
                        (An.identity = Gs),
                        (An.includes = function (t, e, n, r) {
                            (t = Pa(t) ? t : Cs(t)), (n = n && !r ? rs(n) : 0);
                            var i = t.length;
                            return (
                                n < 0 && (n = an(i + n, 0)),
                                Qa(t) ? n <= i && t.indexOf(e, n) > -1 : !!i && we(t, e, n) > -1
                            );
                        }),
                        (An.indexOf = function (t, e, n) {
                            var r = null == t ? 0 : t.length;
                            if (!r) return -1;
                            var i = null == n ? 0 : rs(n);
                            return i < 0 && (i = an(r + i, 0)), we(t, e, i);
                        }),
                        (An.inRange = function (t, e, n) {
                            return (
                                (e = ns(e)),
                                void 0 === n ? ((n = e), (e = 0)) : (n = ns(n)),
                                (function (t, e, n) {
                                    return t >= sn(e, n) && t < an(e, n);
                                })((t = os(t)), e, n)
                            );
                        }),
                        (An.invoke = _s),
                        (An.isArguments = Da),
                        (An.isArray = Ua),
                        (An.isArrayBuffer = ka),
                        (An.isArrayLike = Pa),
                        (An.isArrayLikeObject = Ra),
                        (An.isBoolean = function (t) {
                            return !0 === t || !1 === t || (Ya(t) && pr(t) == c);
                        }),
                        (An.isBuffer = Fa),
                        (An.isDate = La),
                        (An.isElement = function (t) {
                            return Ya(t) && 1 === t.nodeType && !Ha(t);
                        }),
                        (An.isEmpty = function (t) {
                            if (null == t) return !0;
                            if (
                                Pa(t) &&
                                (Ua(t) ||
                                    'string' == typeof t ||
                                    'function' == typeof t.splice ||
                                    Fa(t) ||
                                    Ja(t) ||
                                    Da(t))
                            )
                                return !t.length;
                            var e = no(t);
                            if (e == d || e == g) return !t.size;
                            if (ho(t)) return !Sr(t).length;
                            for (var n in t) if (St.call(t, n)) return !1;
                            return !0;
                        }),
                        (An.isEqual = function (t, e) {
                            return wr(t, e);
                        }),
                        (An.isEqualWith = function (t, e, n) {
                            var r = (n = 'function' == typeof n ? n : void 0) ? n(t, e) : void 0;
                            return void 0 === r ? wr(t, e, void 0, n) : !!r;
                        }),
                        (An.isError = ja),
                        (An.isFinite = function (t) {
                            return 'number' == typeof t && nn(t);
                        }),
                        (An.isFunction = za),
                        (An.isInteger = Ba),
                        (An.isLength = Va),
                        (An.isMap = Xa),
                        (An.isMatch = function (t, e) {
                            return t === e || br(t, e, Ji(e));
                        }),
                        (An.isMatchWith = function (t, e, n) {
                            return (n = 'function' == typeof n ? n : void 0), br(t, e, Ji(e), n);
                        }),
                        (An.isNaN = function (t) {
                            return Ga(t) && t != +t;
                        }),
                        (An.isNative = function (t) {
                            if (fo(t)) throw new lt('Unsupported core-js use. Try https://npms.io/search?q=ponyfill.');
                            return xr(t);
                        }),
                        (An.isNil = function (t) {
                            return null == t;
                        }),
                        (An.isNull = function (t) {
                            return null === t;
                        }),
                        (An.isNumber = Ga),
                        (An.isObject = qa),
                        (An.isObjectLike = Ya),
                        (An.isPlainObject = Ha),
                        (An.isRegExp = Wa),
                        (An.isSafeInteger = function (t) {
                            return Ba(t) && t >= -9007199254740991 && t <= 9007199254740991;
                        }),
                        (An.isSet = $a),
                        (An.isString = Qa),
                        (An.isSymbol = Za),
                        (An.isTypedArray = Ja),
                        (An.isUndefined = function (t) {
                            return void 0 === t;
                        }),
                        (An.isWeakMap = function (t) {
                            return Ya(t) && no(t) == b;
                        }),
                        (An.isWeakSet = function (t) {
                            return Ya(t) && '[object WeakSet]' == pr(t);
                        }),
                        (An.join = function (t, e) {
                            return null == t ? '' : rn.call(t, e);
                        }),
                        (An.kebabCase = Us),
                        (An.last = jo),
                        (An.lastIndexOf = function (t, e, n) {
                            var r = null == t ? 0 : t.length;
                            if (!r) return -1;
                            var i = r;
                            return (
                                void 0 !== n && (i = (i = rs(n)) < 0 ? an(r + i, 0) : sn(i, r - 1)),
                                e == e
                                    ? (function (t, e, n) {
                                          for (var r = n + 1; r--; ) if (t[r] === e) return r;
                                          return r;
                                      })(t, e, i)
                                    : _e(t, xe, i, !0)
                            );
                        }),
                        (An.lowerCase = ks),
                        (An.lowerFirst = Ps),
                        (An.lt = Ka),
                        (An.lte = ts),
                        (An.max = function (t) {
                            return t && t.length ? rr(t, Gs, dr) : void 0;
                        }),
                        (An.maxBy = function (t, e) {
                            return t && t.length ? rr(t, Qi(e, 2), dr) : void 0;
                        }),
                        (An.mean = function (t) {
                            return Ee(t, Gs);
                        }),
                        (An.meanBy = function (t, e) {
                            return Ee(t, Qi(e, 2));
                        }),
                        (An.min = function (t) {
                            return t && t.length ? rr(t, Gs, Nr) : void 0;
                        }),
                        (An.minBy = function (t, e) {
                            return t && t.length ? rr(t, Qi(e, 2), Nr) : void 0;
                        }),
                        (An.stubArray = iu),
                        (An.stubFalse = ou),
                        (An.stubObject = function () {
                            return {};
                        }),
                        (An.stubString = function () {
                            return '';
                        }),
                        (An.stubTrue = function () {
                            return !0;
                        }),
                        (An.multiply = hu),
                        (An.nth = function (t, e) {
                            return t && t.length ? Mr(t, rs(e)) : void 0;
                        }),
                        (An.noConflict = function () {
                            return Gt._ === this && (Gt._ = Ct), this;
                        }),
                        (An.noop = Zs),
                        (An.now = va),
                        (An.pad = function (t, e, n) {
                            t = ss(t);
                            var r = (e = rs(e)) ? Ye(t) : 0;
                            if (!e || r >= e) return t;
                            var i = (e - r) / 2;
                            return Di(Ke(i), n) + t + Di(Je(i), n);
                        }),
                        (An.padEnd = function (t, e, n) {
                            t = ss(t);
                            var r = (e = rs(e)) ? Ye(t) : 0;
                            return e && r < e ? t + Di(e - r, n) : t;
                        }),
                        (An.padStart = function (t, e, n) {
                            t = ss(t);
                            var r = (e = rs(e)) ? Ye(t) : 0;
                            return e && r < e ? Di(e - r, n) + t : t;
                        }),
                        (An.parseInt = function (t, e, n) {
                            return n || null == e ? (e = 0) : e && (e = +e), cn(ss(t).replace(W, ''), e || 0);
                        }),
                        (An.random = function (t, e, n) {
                            if (
                                (n && 'boolean' != typeof n && so(t, e, n) && (e = n = void 0),
                                void 0 === n &&
                                    ('boolean' == typeof e
                                        ? ((n = e), (e = void 0))
                                        : 'boolean' == typeof t && ((n = t), (t = void 0))),
                                void 0 === t && void 0 === e
                                    ? ((t = 0), (e = 1))
                                    : ((t = ns(t)), void 0 === e ? ((e = t), (t = 0)) : (e = ns(e))),
                                t > e)
                            ) {
                                var r = t;
                                (t = e), (e = r);
                            }
                            if (n || t % 1 || e % 1) {
                                var i = fn();
                                return sn(t + i * (e - t + Vt('1e-' + ((i + '').length - 1))), e);
                            }
                            return Rr(t, e);
                        }),
                        (An.reduce = function (t, e, n) {
                            var r = Ua(t) ? de : Ne,
                                i = arguments.length < 3;
                            return r(t, Qi(e, 4), n, i, tr);
                        }),
                        (An.reduceRight = function (t, e, n) {
                            var r = Ua(t) ? ve : Ne,
                                i = arguments.length < 3;
                            return r(t, Qi(e, 4), n, i, er);
                        }),
                        (An.repeat = function (t, e, n) {
                            return (e = (n ? so(t, e, n) : void 0 === e) ? 1 : rs(e)), Fr(ss(t), e);
                        }),
                        (An.replace = function () {
                            var t = arguments,
                                e = ss(t[0]);
                            return t.length < 3 ? e : e.replace(t[1], t[2]);
                        }),
                        (An.result = function (t, e, n) {
                            var r = -1,
                                i = (e = si(e, t)).length;
                            for (i || ((i = 1), (t = void 0)); ++r < i; ) {
                                var o = null == t ? void 0 : t[No(e[r])];
                                void 0 === o && ((r = i), (o = n)), (t = za(o) ? o.call(t) : o);
                            }
                            return t;
                        }),
                        (An.round = lu),
                        (An.runInContext = t),
                        (An.sample = function (t) {
                            return (Ua(t) ? jn : jr)(t);
                        }),
                        (An.size = function (t) {
                            if (null == t) return 0;
                            if (Pa(t)) return Qa(t) ? Ye(t) : t.length;
                            var e = no(t);
                            return e == d || e == g ? t.size : Sr(t).length;
                        }),
                        (An.snakeCase = Rs),
                        (An.some = function (t, e, n) {
                            var r = Ua(t) ? me : Gr;
                            return n && so(t, e, n) && (e = void 0), r(t, Qi(e, 3));
                        }),
                        (An.sortedIndex = function (t, e) {
                            return Hr(t, e);
                        }),
                        (An.sortedIndexBy = function (t, e, n) {
                            return Wr(t, e, Qi(n, 2));
                        }),
                        (An.sortedIndexOf = function (t, e) {
                            var n = null == t ? 0 : t.length;
                            if (n) {
                                var r = Hr(t, e);
                                if (r < n && Ca(t[r], e)) return r;
                            }
                            return -1;
                        }),
                        (An.sortedLastIndex = function (t, e) {
                            return Hr(t, e, !0);
                        }),
                        (An.sortedLastIndexBy = function (t, e, n) {
                            return Wr(t, e, Qi(n, 2), !0);
                        }),
                        (An.sortedLastIndexOf = function (t, e) {
                            if (null == t ? 0 : t.length) {
                                var n = Hr(t, e, !0) - 1;
                                if (Ca(t[n], e)) return n;
                            }
                            return -1;
                        }),
                        (An.startCase = Fs),
                        (An.startsWith = function (t, e, n) {
                            return (
                                (t = ss(t)),
                                (n = null == n ? 0 : $n(rs(n), 0, t.length)),
                                (e = Zr(e)),
                                t.slice(n, n + e.length) == e
                            );
                        }),
                        (An.subtract = pu),
                        (An.sum = function (t) {
                            return t && t.length ? Oe(t, Gs) : 0;
                        }),
                        (An.sumBy = function (t, e) {
                            return t && t.length ? Oe(t, Qi(e, 2)) : 0;
                        }),
                        (An.template = function (t, e, n) {
                            var r = An.templateSettings;
                            n && so(t, e, n) && (e = void 0), (t = ss(t)), (e = fs({}, e, r, zi));
                            var i,
                                o,
                                a = fs({}, e.imports, r.imports, zi),
                                s = ws(a),
                                u = Ie(a, s),
                                c = 0,
                                f = e.interpolate || ct,
                                h = "__p += '",
                                l = mt(
                                    (e.escape || ct).source +
                                        '|' +
                                        f.source +
                                        '|' +
                                        (f === B ? et : ct).source +
                                        '|' +
                                        (e.evaluate || ct).source +
                                        '|$',
                                    'g',
                                ),
                                p =
                                    '//# sourceURL=' +
                                    (St.call(e, 'sourceURL')
                                        ? (e.sourceURL + '').replace(/\s/g, ' ')
                                        : 'lodash.templateSources[' + ++Lt + ']') +
                                    '\n';
                            t.replace(l, function (e, n, r, a, s, u) {
                                return (
                                    r || (r = a),
                                    (h += t.slice(c, u).replace(ft, Fe)),
                                    n && ((i = !0), (h += "' +\n__e(" + n + ") +\n'")),
                                    s && ((o = !0), (h += "';\n" + s + ";\n__p += '")),
                                    r && (h += "' +\n((__t = (" + r + ")) == null ? '' : __t) +\n'"),
                                    (c = u + e.length),
                                    e
                                );
                            }),
                                (h += "';\n");
                            var d = St.call(e, 'variable') && e.variable;
                            d || (h = 'with (obj) {\n' + h + '\n}\n'),
                                (h = (o ? h.replace(D, '') : h).replace(U, '$1').replace(k, '$1;')),
                                (h =
                                    'function(' +
                                    (d || 'obj') +
                                    ') {\n' +
                                    (d ? '' : 'obj || (obj = {});\n') +
                                    "var __t, __p = ''" +
                                    (i ? ', __e = _.escape' : '') +
                                    (o
                                        ? ", __j = Array.prototype.join;\nfunction print() { __p += __j.call(arguments, '') }\n"
                                        : ';\n') +
                                    h +
                                    'return __p\n}');
                            var v = Bs(function () {
                                return pt(s, p + 'return ' + h).apply(void 0, u);
                            });
                            if (((v.source = h), ja(v))) throw v;
                            return v;
                        }),
                        (An.times = function (t, e) {
                            if ((t = rs(t)) < 1 || t > 9007199254740991) return [];
                            var n = 4294967295,
                                r = sn(t, 4294967295);
                            t -= 4294967295;
                            for (var i = Ae(r, (e = Qi(e))); ++n < t; ) e(n);
                            return i;
                        }),
                        (An.toFinite = ns),
                        (An.toInteger = rs),
                        (An.toLength = is),
                        (An.toLower = function (t) {
                            return ss(t).toLowerCase();
                        }),
                        (An.toNumber = os),
                        (An.toSafeInteger = function (t) {
                            return t ? $n(rs(t), -9007199254740991, 9007199254740991) : 0 === t ? t : 0;
                        }),
                        (An.toString = ss),
                        (An.toUpper = function (t) {
                            return ss(t).toUpperCase();
                        }),
                        (An.trim = function (t, e, n) {
                            if ((t = ss(t)) && (n || void 0 === e)) return t.replace(H, '');
                            if (!t || !(e = Zr(e))) return t;
                            var r = Xe(t),
                                i = Xe(e);
                            return ci(r, De(r, i), Ue(r, i) + 1).join('');
                        }),
                        (An.trimEnd = function (t, e, n) {
                            if ((t = ss(t)) && (n || void 0 === e)) return t.replace($, '');
                            if (!t || !(e = Zr(e))) return t;
                            var r = Xe(t);
                            return ci(r, 0, Ue(r, Xe(e)) + 1).join('');
                        }),
                        (An.trimStart = function (t, e, n) {
                            if ((t = ss(t)) && (n || void 0 === e)) return t.replace(W, '');
                            if (!t || !(e = Zr(e))) return t;
                            var r = Xe(t);
                            return ci(r, De(r, Xe(e))).join('');
                        }),
                        (An.truncate = function (t, e) {
                            var n = 30,
                                r = '...';
                            if (qa(e)) {
                                var i = 'separator' in e ? e.separator : i;
                                (n = 'length' in e ? rs(e.length) : n), (r = 'omission' in e ? Zr(e.omission) : r);
                            }
                            var o = (t = ss(t)).length;
                            if (Le(t)) {
                                var a = Xe(t);
                                o = a.length;
                            }
                            if (n >= o) return t;
                            var s = n - Ye(r);
                            if (s < 1) return r;
                            var u = a ? ci(a, 0, s).join('') : t.slice(0, s);
                            if (void 0 === i) return u + r;
                            if ((a && (s += u.length - s), Wa(i))) {
                                if (t.slice(s).search(i)) {
                                    var c,
                                        f = u;
                                    for (
                                        i.global || (i = mt(i.source, ss(nt.exec(i)) + 'g')), i.lastIndex = 0;
                                        (c = i.exec(f));

                                    )
                                        var h = c.index;
                                    u = u.slice(0, void 0 === h ? s : h);
                                }
                            } else if (t.indexOf(Zr(i), s) != s) {
                                var l = u.lastIndexOf(i);
                                l > -1 && (u = u.slice(0, l));
                            }
                            return u + r;
                        }),
                        (An.unescape = function (t) {
                            return (t = ss(t)) && F.test(t) ? t.replace(P, Ge) : t;
                        }),
                        (An.uniqueId = function (t) {
                            var e = ++Tt;
                            return ss(t) + e;
                        }),
                        (An.upperCase = Ls),
                        (An.upperFirst = js),
                        (An.each = sa),
                        (An.eachRight = ua),
                        (An.first = Po),
                        Qs(
                            An,
                            ((fu = {}),
                            ur(An, function (t, e) {
                                St.call(An.prototype, e) || (fu[e] = t);
                            }),
                            fu),
                            { chain: !1 },
                        ),
                        (An.VERSION = '4.17.20'),
                        ae(['bind', 'bindKey', 'curry', 'curryRight', 'partial', 'partialRight'], function (t) {
                            An[t].placeholder = An;
                        }),
                        ae(['drop', 'take'], function (t, e) {
                            (Dn.prototype[t] = function (n) {
                                n = void 0 === n ? 1 : an(rs(n), 0);
                                var r = this.__filtered__ && !e ? new Dn(this) : this.clone();
                                return (
                                    r.__filtered__
                                        ? (r.__takeCount__ = sn(n, r.__takeCount__))
                                        : r.__views__.push({
                                              size: sn(n, 4294967295),
                                              type: t + (r.__dir__ < 0 ? 'Right' : ''),
                                          }),
                                    r
                                );
                            }),
                                (Dn.prototype[t + 'Right'] = function (e) {
                                    return this.reverse()[t](e).reverse();
                                });
                        }),
                        ae(['filter', 'map', 'takeWhile'], function (t, e) {
                            var n = e + 1,
                                r = 1 == n || 3 == n;
                            Dn.prototype[t] = function (t) {
                                var e = this.clone();
                                return (
                                    e.__iteratees__.push({
                                        iteratee: Qi(t, 3),
                                        type: n,
                                    }),
                                    (e.__filtered__ = e.__filtered__ || r),
                                    e
                                );
                            };
                        }),
                        ae(['head', 'last'], function (t, e) {
                            var n = 'take' + (e ? 'Right' : '');
                            Dn.prototype[t] = function () {
                                return this[n](1).value()[0];
                            };
                        }),
                        ae(['initial', 'tail'], function (t, e) {
                            var n = 'drop' + (e ? '' : 'Right');
                            Dn.prototype[t] = function () {
                                return this.__filtered__ ? new Dn(this) : this[n](1);
                            };
                        }),
                        (Dn.prototype.compact = function () {
                            return this.filter(Gs);
                        }),
                        (Dn.prototype.find = function (t) {
                            return this.filter(t).head();
                        }),
                        (Dn.prototype.findLast = function (t) {
                            return this.reverse().find(t);
                        }),
                        (Dn.prototype.invokeMap = Lr(function (t, e) {
                            return 'function' == typeof t
                                ? new Dn(this)
                                : this.map(function (n) {
                                      return gr(n, t, e);
                                  });
                        })),
                        (Dn.prototype.reject = function (t) {
                            return this.filter(Sa(Qi(t)));
                        }),
                        (Dn.prototype.slice = function (t, e) {
                            t = rs(t);
                            var n = this;
                            return n.__filtered__ && (t > 0 || e < 0)
                                ? new Dn(n)
                                : (t < 0 ? (n = n.takeRight(-t)) : t && (n = n.drop(t)),
                                  void 0 !== e && (n = (e = rs(e)) < 0 ? n.dropRight(-e) : n.take(e - t)),
                                  n);
                        }),
                        (Dn.prototype.takeRightWhile = function (t) {
                            return this.reverse().takeWhile(t).reverse();
                        }),
                        (Dn.prototype.toArray = function () {
                            return this.take(4294967295);
                        }),
                        ur(Dn.prototype, function (t, e) {
                            var n = /^(?:filter|find|map|reject)|While$/.test(e),
                                r = /^(?:head|last)$/.test(e),
                                i = An[r ? 'take' + ('last' == e ? 'Right' : '') : e],
                                o = r || /^find/.test(e);
                            i &&
                                (An.prototype[e] = function () {
                                    var e = this.__wrapped__,
                                        a = r ? [1] : arguments,
                                        s = e instanceof Dn,
                                        u = a[0],
                                        c = s || Ua(e),
                                        f = function (t) {
                                            var e = i.apply(An, pe([t], a));
                                            return r && h ? e[0] : e;
                                        };
                                    c && n && 'function' == typeof u && 1 != u.length && (s = c = !1);
                                    var h = this.__chain__,
                                        l = !!this.__actions__.length,
                                        p = o && !h,
                                        d = s && !l;
                                    if (!o && c) {
                                        e = d ? e : new Dn(this);
                                        var v = t.apply(e, a);
                                        return (
                                            v.__actions__.push({
                                                func: na,
                                                args: [f],
                                                thisArg: void 0,
                                            }),
                                            new Mn(v, h)
                                        );
                                    }
                                    return p && d
                                        ? t.apply(this, a)
                                        : ((v = this.thru(f)), p ? (r ? v.value()[0] : v.value()) : v);
                                });
                        }),
                        ae(['pop', 'push', 'shift', 'sort', 'splice', 'unshift'], function (t) {
                            var e = _t[t],
                                n = /^(?:push|sort|unshift)$/.test(t) ? 'tap' : 'thru',
                                r = /^(?:pop|shift)$/.test(t);
                            An.prototype[t] = function () {
                                var t = arguments;
                                if (r && !this.__chain__) {
                                    var i = this.value();
                                    return e.apply(Ua(i) ? i : [], t);
                                }
                                return this[n](function (n) {
                                    return e.apply(Ua(n) ? n : [], t);
                                });
                            };
                        }),
                        ur(Dn.prototype, function (t, e) {
                            var n = An[e];
                            if (n) {
                                var r = n.name + '';
                                St.call(_n, r) || (_n[r] = []), _n[r].push({ name: e, func: n });
                            }
                        }),
                        (_n[Ai(void 0, 2).name] = [{ name: 'wrapper', func: void 0 }]),
                        (Dn.prototype.clone = function () {
                            var t = new Dn(this.__wrapped__);
                            return (
                                (t.__actions__ = yi(this.__actions__)),
                                (t.__dir__ = this.__dir__),
                                (t.__filtered__ = this.__filtered__),
                                (t.__iteratees__ = yi(this.__iteratees__)),
                                (t.__takeCount__ = this.__takeCount__),
                                (t.__views__ = yi(this.__views__)),
                                t
                            );
                        }),
                        (Dn.prototype.reverse = function () {
                            if (this.__filtered__) {
                                var t = new Dn(this);
                                (t.__dir__ = -1), (t.__filtered__ = !0);
                            } else (t = this.clone()).__dir__ *= -1;
                            return t;
                        }),
                        (Dn.prototype.value = function () {
                            var t = this.__wrapped__.value(),
                                e = this.__dir__,
                                n = Ua(t),
                                r = e < 0,
                                i = n ? t.length : 0,
                                o = (function (t, e, n) {
                                    var r = -1,
                                        i = n.length;
                                    for (; ++r < i; ) {
                                        var o = n[r],
                                            a = o.size;
                                        switch (o.type) {
                                            case 'drop':
                                                t += a;
                                                break;
                                            case 'dropRight':
                                                e -= a;
                                                break;
                                            case 'take':
                                                e = sn(e, t + a);
                                                break;
                                            case 'takeRight':
                                                t = an(t, e - a);
                                        }
                                    }
                                    return { start: t, end: e };
                                })(0, i, this.__views__),
                                a = o.start,
                                s = o.end,
                                u = s - a,
                                c = r ? s : a - 1,
                                f = this.__iteratees__,
                                h = f.length,
                                l = 0,
                                p = sn(u, this.__takeCount__);
                            if (!n || (!r && i == u && p == u)) return ni(t, this.__actions__);
                            var d = [];
                            t: for (; u-- && l < p; ) {
                                for (var v = -1, m = t[(c += e)]; ++v < h; ) {
                                    var y = f[v],
                                        g = y.iteratee,
                                        _ = y.type,
                                        w = g(m);
                                    if (2 == _) m = w;
                                    else if (!w) {
                                        if (1 == _) continue t;
                                        break t;
                                    }
                                }
                                d[l++] = m;
                            }
                            return d;
                        }),
                        (An.prototype.at = ra),
                        (An.prototype.chain = function () {
                            return ea(this);
                        }),
                        (An.prototype.commit = function () {
                            return new Mn(this.value(), this.__chain__);
                        }),
                        (An.prototype.next = function () {
                            void 0 === this.__values__ && (this.__values__ = es(this.value()));
                            var t = this.__index__ >= this.__values__.length;
                            return {
                                done: t,
                                value: t ? void 0 : this.__values__[this.__index__++],
                            };
                        }),
                        (An.prototype.plant = function (t) {
                            for (var e, n = this; n instanceof In; ) {
                                var r = Ao(n);
                                (r.__index__ = 0), (r.__values__ = void 0), e ? (i.__wrapped__ = r) : (e = r);
                                var i = r;
                                n = n.__wrapped__;
                            }
                            return (i.__wrapped__ = t), e;
                        }),
                        (An.prototype.reverse = function () {
                            var t = this.__wrapped__;
                            if (t instanceof Dn) {
                                var e = t;
                                return (
                                    this.__actions__.length && (e = new Dn(this)),
                                    (e = e.reverse()).__actions__.push({
                                        func: na,
                                        args: [qo],
                                        thisArg: void 0,
                                    }),
                                    new Mn(e, this.__chain__)
                                );
                            }
                            return this.thru(qo);
                        }),
                        (An.prototype.toJSON =
                            An.prototype.valueOf =
                            An.prototype.value =
                                function () {
                                    return ni(this.__wrapped__, this.__actions__);
                                }),
                        (An.prototype.first = An.prototype.head),
                        ye &&
                            (An.prototype[ye] = function () {
                                return this;
                            }),
                        An
                    );
                })();
                (Gt._ = He),
                    void 0 ===
                        (r = function () {
                            return He;
                        }.call(e, n, e, t)) || (t.exports = r);
            }).call(this);
        }).call(this, n(55)(t));
    },
    function (t, e) {
        t.exports = require('fs');
    },
    function (t, e, n) {
        'use strict';
        (e.fromCallback = function (t) {
            return Object.defineProperty(
                function () {
                    if ('function' != typeof arguments[arguments.length - 1])
                        return new Promise((e, n) => {
                            (arguments[arguments.length] = (t, r) => {
                                if (t) return n(t);
                                e(r);
                            }),
                                arguments.length++,
                                t.apply(this, arguments);
                        });
                    t.apply(this, arguments);
                },
                'name',
                { value: t.name },
            );
        }),
            (e.fromPromise = function (t) {
                return Object.defineProperty(
                    function () {
                        const e = arguments[arguments.length - 1];
                        if ('function' != typeof e) return t.apply(this, arguments);
                        t.apply(this, arguments).then(t => e(null, t), e);
                    },
                    'name',
                    { value: t.name },
                );
            });
    },
    function (t, e, n) {
        'use strict';
        var r = 'undefined' != typeof Uint8Array;
        function i(t, e, n) {
            var o,
                a = t instanceof i;
            (this.buffer = a ? t.buffer : 'number' == typeof t ? ((o = t), r ? new Uint8Array(o) : Array(o)) : t),
                (this.start = (e || 0) + (a ? t.start : 0)),
                (this.length = n || this.buffer.length - this.start),
                (this.offset = 0),
                (this.isTyped = !Array.isArray(this.buffer));
        }
        (i.prototype.getUint8 = function (t) {
            return this.buffer[t + this.start];
        }),
            (i.prototype.getUint16 = function (t, e) {
                var n;
                if (e) throw new Error('not implemented');
                return (n = this.buffer[t + 1 + this.start]), (n += (this.buffer[t + this.start] << 8) >>> 0);
            }),
            (i.prototype.getUint32 = function (t, e) {
                var n;
                if (e) throw new Error('not implemented');
                return (
                    (n = this.buffer[t + 1 + this.start] << 16),
                    (n |= this.buffer[t + 2 + this.start] << 8),
                    (n |= this.buffer[t + 3 + this.start]),
                    (n += (this.buffer[t + this.start] << 24) >>> 0)
                );
            }),
            (i.prototype.setUint8 = function (t, e) {
                this.buffer[t + this.start] = 255 & e;
            }),
            (i.prototype.setUint16 = function (t, e, n) {
                var r = t + this.start,
                    i = this.buffer;
                n ? ((i[r] = 255 & e), (i[r + 1] = (e >>> 8) & 255)) : ((i[r] = (e >>> 8) & 255), (i[r + 1] = 255 & e));
            }),
            (i.prototype.setUint32 = function (t, e, n) {
                var r = t + this.start,
                    i = this.buffer;
                n
                    ? ((i[r] = 255 & e),
                      (i[r + 1] = (e >>> 8) & 255),
                      (i[r + 2] = (e >>> 16) & 255),
                      (i[r + 3] = (e >>> 24) & 255))
                    : ((i[r] = (e >>> 24) & 255),
                      (i[r + 1] = (e >>> 16) & 255),
                      (i[r + 2] = (e >>> 8) & 255),
                      (i[r + 3] = 255 & e));
            }),
            (i.prototype.writeUint8 = function (t) {
                (this.buffer[this.offset + this.start] = 255 & t), this.offset++;
            }),
            (i.prototype.writeInt8 = function (t) {
                this.setUint8(this.offset, t < 0 ? 255 + t + 1 : t), this.offset++;
            }),
            (i.prototype.writeUint16 = function (t, e) {
                this.setUint16(this.offset, t, e), (this.offset += 2);
            }),
            (i.prototype.writeInt16 = function (t, e) {
                this.setUint16(this.offset, t < 0 ? 65535 + t + 1 : t, e), (this.offset += 2);
            }),
            (i.prototype.writeUint32 = function (t, e) {
                this.setUint32(this.offset, t, e), (this.offset += 4);
            }),
            (i.prototype.writeInt32 = function (t, e) {
                this.setUint32(this.offset, t < 0 ? 4294967295 + t + 1 : t, e), (this.offset += 4);
            }),
            (i.prototype.tell = function () {
                return this.offset;
            }),
            (i.prototype.seek = function (t) {
                this.offset = t;
            }),
            (i.prototype.fill = function (t) {
                for (var e = this.length - 1; e >= 0; ) (this.buffer[e + this.start] = t), e--;
            }),
            (i.prototype.writeUint64 = function (t) {
                var e = Math.floor(t / 4294967296),
                    n = t - 4294967296 * e;
                this.writeUint32(e), this.writeUint32(n);
            }),
            (i.prototype.writeBytes = function (t) {
                var e = this.buffer,
                    n = this.offset + this.start;
                if (this.isTyped) e.set(t, n);
                else for (var r = 0; r < t.length; r++) e[r + n] = t[r];
                this.offset += t.length;
            }),
            (i.prototype.toString = function (t, e) {
                (t = t || 0), (e = e || this.length - t);
                for (var n = t + this.start, r = n + e, i = '', o = n; o < r; o++)
                    i += String.fromCharCode(this.buffer[o]);
                return i;
            }),
            (i.prototype.toArray = function () {
                return this.isTyped
                    ? this.buffer.subarray(this.start, this.start + this.length)
                    : this.buffer.slice(this.start, this.start + this.length);
            }),
            (t.exports = i);
    },
    function (t, e, n) {
        'use strict';
        const r = (0, n(4).fromCallback)(n(32)),
            i = n(33);
        t.exports = {
            mkdirs: r,
            mkdirsSync: i,
            mkdirp: r,
            mkdirpSync: i,
            ensureDir: r,
            ensureDirSync: i,
        };
    },
    function (t, e, n) {
        'use strict';
        const r = n(4).fromPromise,
            i = n(14);
        t.exports = {
            pathExists: r(function (t) {
                return i
                    .access(t)
                    .then(() => !0)
                    .catch(() => !1);
            }),
            pathExistsSync: i.existsSync,
        };
    },
    function (t, e, n) {
        'use strict';
        const r = n(1),
            i = n(0),
            o = process.versions.node.split('.'),
            a = Number.parseInt(o[0], 10),
            s = Number.parseInt(o[1], 10),
            u = Number.parseInt(o[2], 10);
        function c() {
            if (a > 10) return !0;
            if (10 === a) {
                if (s > 5) return !0;
                if (5 === s && u >= 0) return !0;
            }
            return !1;
        }
        function f(t, e) {
            const n = i
                    .resolve(t)
                    .split(i.sep)
                    .filter(t => t),
                r = i
                    .resolve(e)
                    .split(i.sep)
                    .filter(t => t);
            return n.reduce((t, e, n) => t && r[n] === e, !0);
        }
        function h(t, e, n) {
            return `Cannot ${n} '${t}' to a subdirectory of itself, '${e}'.`;
        }
        t.exports = {
            checkPaths: function (t, e, n, i) {
                !(function (t, e, n) {
                    c()
                        ? r.stat(t, { bigint: !0 }, (t, i) => {
                              if (t) return n(t);
                              r.stat(e, { bigint: !0 }, (t, e) =>
                                  t
                                      ? 'ENOENT' === t.code
                                          ? n(null, {
                                                srcStat: i,
                                                destStat: null,
                                            })
                                          : n(t)
                                      : n(null, { srcStat: i, destStat: e }),
                              );
                          })
                        : r.stat(t, (t, i) => {
                              if (t) return n(t);
                              r.stat(e, (t, e) =>
                                  t
                                      ? 'ENOENT' === t.code
                                          ? n(null, {
                                                srcStat: i,
                                                destStat: null,
                                            })
                                          : n(t)
                                      : n(null, { srcStat: i, destStat: e }),
                              );
                          });
                })(t, e, (r, o) => {
                    if (r) return i(r);
                    const { srcStat: a, destStat: s } = o;
                    return s && s.ino && s.dev && s.ino === a.ino && s.dev === a.dev
                        ? i(new Error('Source and destination must not be the same.'))
                        : a.isDirectory() && f(t, e)
                          ? i(new Error(h(t, e, n)))
                          : i(null, { srcStat: a, destStat: s });
                });
            },
            checkPathsSync: function (t, e, n) {
                const { srcStat: i, destStat: o } = (function (t, e) {
                    let n, i;
                    n = c() ? r.statSync(t, { bigint: !0 }) : r.statSync(t);
                    try {
                        i = c() ? r.statSync(e, { bigint: !0 }) : r.statSync(e);
                    } catch (t) {
                        if ('ENOENT' === t.code) return { srcStat: n, destStat: null };
                        throw t;
                    }
                    return { srcStat: n, destStat: i };
                })(t, e);
                if (o && o.ino && o.dev && o.ino === i.ino && o.dev === i.dev)
                    throw new Error('Source and destination must not be the same.');
                if (i.isDirectory() && f(t, e)) throw new Error(h(t, e, n));
                return { srcStat: i, destStat: o };
            },
            checkParentPaths: function t(e, n, o, a, s) {
                const u = i.resolve(i.dirname(e)),
                    f = i.resolve(i.dirname(o));
                if (f === u || f === i.parse(f).root) return s();
                c()
                    ? r.stat(f, { bigint: !0 }, (r, i) =>
                          r
                              ? 'ENOENT' === r.code
                                  ? s()
                                  : s(r)
                              : i.ino && i.dev && i.ino === n.ino && i.dev === n.dev
                                ? s(new Error(h(e, o, a)))
                                : t(e, n, f, a, s),
                      )
                    : r.stat(f, (r, i) =>
                          r
                              ? 'ENOENT' === r.code
                                  ? s()
                                  : s(r)
                              : i.ino && i.dev && i.ino === n.ino && i.dev === n.dev
                                ? s(new Error(h(e, o, a)))
                                : t(e, n, f, a, s),
                      );
            },
            checkParentPathsSync: function t(e, n, o, a) {
                const s = i.resolve(i.dirname(e)),
                    u = i.resolve(i.dirname(o));
                if (u === s || u === i.parse(u).root) return;
                let f;
                try {
                    f = c() ? r.statSync(u, { bigint: !0 }) : r.statSync(u);
                } catch (t) {
                    if ('ENOENT' === t.code) return;
                    throw t;
                }
                if (f.ino && f.dev && f.ino === n.ino && f.dev === n.dev) throw new Error(h(e, o, a));
                return t(e, n, u, a);
            },
            isSrcSubdir: f,
        };
    },
    function (t, e, n) {
        'use strict';
        const r = n(4).fromCallback,
            i = n(38);
        t.exports = { remove: r(i), removeSync: i.sync };
    },
    function (t, e, n) {
        'use strict';
        var r =
            'undefined' != typeof Uint8Array && 'undefined' != typeof Uint16Array && 'undefined' != typeof Int32Array;
        function i(t, e) {
            return Object.prototype.hasOwnProperty.call(t, e);
        }
        (e.assign = function (t) {
            for (var e = Array.prototype.slice.call(arguments, 1); e.length; ) {
                var n = e.shift();
                if (n) {
                    if ('object' != typeof n) throw new TypeError(n + 'must be non-object');
                    for (var r in n) i(n, r) && (t[r] = n[r]);
                }
            }
            return t;
        }),
            (e.shrinkBuf = function (t, e) {
                return t.length === e ? t : t.subarray ? t.subarray(0, e) : ((t.length = e), t);
            });
        var o = {
                arraySet: function (t, e, n, r, i) {
                    if (e.subarray && t.subarray) t.set(e.subarray(n, n + r), i);
                    else for (var o = 0; o < r; o++) t[i + o] = e[n + o];
                },
                flattenChunks: function (t) {
                    var e, n, r, i, o, a;
                    for (r = 0, e = 0, n = t.length; e < n; e++) r += t[e].length;
                    for (a = new Uint8Array(r), i = 0, e = 0, n = t.length; e < n; e++)
                        (o = t[e]), a.set(o, i), (i += o.length);
                    return a;
                },
            },
            a = {
                arraySet: function (t, e, n, r, i) {
                    for (var o = 0; o < r; o++) t[i + o] = e[n + o];
                },
                flattenChunks: function (t) {
                    return [].concat.apply([], t);
                },
            };
        (e.setTyped = function (t) {
            t
                ? ((e.Buf8 = Uint8Array), (e.Buf16 = Uint16Array), (e.Buf32 = Int32Array), e.assign(e, o))
                : ((e.Buf8 = Array), (e.Buf16 = Array), (e.Buf32 = Array), e.assign(e, a));
        }),
            e.setTyped(r);
    },
    function (t, e) {
        t.exports = require('stream');
    },
    function (t, e, n) {
        'use strict';
        const r = n(4).fromCallback,
            i = n(46);
        t.exports = {
            readJson: r(i.readFile),
            readJsonSync: i.readFileSync,
            writeJson: r(i.writeFile),
            writeJsonSync: i.writeFileSync,
        };
    },
    function (t, e, n) {
        'use strict';
        var r = n(2),
            i = n(69);
        (t.exports.interpolate = function (t, e) {
            return r.map(t, function (t) {
                var n = [];
                return (
                    r.forEach(t, function (r, o) {
                        if (0 !== o && o !== t.length - 1) {
                            var a,
                                s,
                                u,
                                c = t[o - 1],
                                f = t[o + 1];
                            (!c.onCurve &&
                                r.onCurve &&
                                !f.onCurve &&
                                ((a = new i.Point(r.x, r.y)),
                                (s = new i.Point(c.x, c.y)),
                                (u = new i.Point(f.x, f.y)),
                                s.add(u).div(2).sub(a).dist() < e)) ||
                                n.push(r);
                        } else n.push(r);
                    }),
                    n
                );
            });
        }),
            (t.exports.simplify = function (t, e) {
                return r.map(t, function (t) {
                    var n, r, o, a, s, u, c;
                    for (n = t.length - 2; n > 1; n--)
                        (o = t[n - 1]),
                            (a = t[n + 1]),
                            (r = t[n]),
                            o.onCurve &&
                                a.onCurve &&
                                ((s = new i.Point(r.x, r.y)),
                                (u = new i.Point(o.x, o.y)),
                                (c = new i.Point(a.x, a.y)),
                                i.isInLine(u, s, c, e) && t.splice(n, 1));
                    return t;
                });
            }),
            (t.exports.roundPoints = function (t) {
                return r.map(t, function (t) {
                    return r.map(t, function (t) {
                        return {
                            x: Math.round(t.x),
                            y: Math.round(t.y),
                            onCurve: t.onCurve,
                        };
                    });
                });
            }),
            (t.exports.removeClosingReturnPoints = function (t) {
                return r.map(t, function (t) {
                    var e = t.length;
                    return e > 1 && t[0].x === t[e - 1].x && t[0].y === t[e - 1].y && t.splice(e - 1), t;
                });
            }),
            (t.exports.toRelative = function (t) {
                var e,
                    n = { x: 0, y: 0 },
                    i = [];
                return (
                    r.forEach(t, function (t) {
                        (e = []),
                            i.push(e),
                            r.forEach(t, function (t) {
                                e.push({
                                    x: t.x - n.x,
                                    y: t.y - n.y,
                                    onCurve: t.onCurve,
                                }),
                                    (n = t);
                            });
                    }),
                    i
                );
            }),
            (t.exports.identifier = function (t, e) {
                for (var n = 0, r = 0; r < t.length; r++) {
                    n <<= 8;
                    var i = e ? t.length - r - 1 : r;
                    n += t.charCodeAt(i);
                }
                return n;
            });
    },
    function (t, e, n) {
        'use strict';
        const r = n(4).fromCallback,
            i = n(1),
            o = [
                'access',
                'appendFile',
                'chmod',
                'chown',
                'close',
                'copyFile',
                'fchmod',
                'fchown',
                'fdatasync',
                'fstat',
                'fsync',
                'ftruncate',
                'futimes',
                'lchown',
                'lchmod',
                'link',
                'lstat',
                'mkdir',
                'mkdtemp',
                'open',
                'readFile',
                'readdir',
                'readlink',
                'realpath',
                'rename',
                'rmdir',
                'stat',
                'symlink',
                'truncate',
                'unlink',
                'utimes',
                'writeFile',
            ].filter(t => 'function' == typeof i[t]);
        Object.keys(i).forEach(t => {
            'promises' !== t && (e[t] = i[t]);
        }),
            o.forEach(t => {
                e[t] = r(i[t]);
            }),
            (e.exists = function (t, e) {
                return 'function' == typeof e ? i.exists(t, e) : new Promise(e => i.exists(t, e));
            }),
            (e.read = function (t, e, n, r, o, a) {
                return 'function' == typeof a
                    ? i.read(t, e, n, r, o, a)
                    : new Promise((a, s) => {
                          i.read(t, e, n, r, o, (t, e, n) => {
                              if (t) return s(t);
                              a({ bytesRead: e, buffer: n });
                          });
                      });
            }),
            (e.write = function (t, e, ...n) {
                return 'function' == typeof n[n.length - 1]
                    ? i.write(t, e, ...n)
                    : new Promise((r, o) => {
                          i.write(t, e, ...n, (t, e, n) => {
                              if (t) return o(t);
                              r({ bytesWritten: e, buffer: n });
                          });
                      });
            }),
            'function' == typeof i.realpath.native && (e.realpath.native = r(i.realpath.native));
    },
    function (t, e) {
        t.exports = require('assert');
    },
    function (t, e, n) {
        'use strict';
        t.exports = { copySync: n(31) };
    },
    function (t, e, n) {
        'use strict';
        const r = n(0);
        function i(t) {
            return (t = r.normalize(r.resolve(t)).split(r.sep)).length > 0 ? t[0] : null;
        }
        const o = /[<>:"|?*]/;
        t.exports = {
            getRootPath: i,
            invalidWin32Path: function (t) {
                const e = i(t);
                return (t = t.replace(e, '')), o.test(t);
            },
        };
    },
    function (t, e, n) {
        'use strict';
        const r = n(1),
            i = n(34),
            o = n(0);
        t.exports = {
            hasMillisRes: function (t) {
                let e = o.join('millis-test' + Date.now().toString() + Math.random().toString().slice(2));
                e = o.join(i.tmpdir(), e);
                const n = new Date(1435410243862);
                r.writeFile(e, 'https://github.com/jprichardson/node-fs-extra/pull/141', i => {
                    if (i) return t(i);
                    r.open(e, 'r+', (i, o) => {
                        if (i) return t(i);
                        r.futimes(o, n, n, n => {
                            if (n) return t(n);
                            r.close(o, n => {
                                if (n) return t(n);
                                r.stat(e, (e, n) => {
                                    if (e) return t(e);
                                    t(null, n.mtime > 1435410243e3);
                                });
                            });
                        });
                    });
                });
            },
            hasMillisResSync: function () {
                let t = o.join('millis-test-sync' + Date.now().toString() + Math.random().toString().slice(2));
                t = o.join(i.tmpdir(), t);
                const e = new Date(1435410243862);
                r.writeFileSync(t, 'https://github.com/jprichardson/node-fs-extra/pull/141');
                const n = r.openSync(t, 'r+');
                return r.futimesSync(n, e, e), r.closeSync(n), r.statSync(t).mtime > 1435410243e3;
            },
            timeRemoveMillis: function (t) {
                if ('number' == typeof t) return 1e3 * Math.floor(t / 1e3);
                if (t instanceof Date) return new Date(1e3 * Math.floor(t.getTime() / 1e3));
                throw new Error('fs-extra: timeRemoveMillis() unknown parameter type');
            },
            utimesMillis: function (t, e, n, i) {
                r.open(t, 'r+', (t, o) => {
                    if (t) return i(t);
                    r.futimes(o, e, n, t => {
                        r.close(o, e => {
                            i && i(t || e);
                        });
                    });
                });
            },
            utimesMillisSync: function (t, e, n) {
                const i = r.openSync(t, 'r+');
                return r.futimesSync(i, e, n), r.closeSync(i);
            },
        };
    },
    function (t, e, n) {
        'use strict';
        const r = n(4).fromCallback;
        t.exports = { copy: r(n(36)) };
    },
    function (t, e, n) {
        'use strict';
        function r() {
            if (!(this instanceof r)) return new r();
            (this.queue = []), (this.cache = null);
        }
        (r.prototype.matrix = function (t) {
            return (
                (1 === t[0] && 0 === t[1] && 0 === t[2] && 1 === t[3] && 0 === t[4] && 0 === t[5]) ||
                    ((this.cache = null), this.queue.push(t)),
                this
            );
        }),
            (r.prototype.translate = function (t, e) {
                return (0 === t && 0 === e) || ((this.cache = null), this.queue.push([1, 0, 0, 1, t, e])), this;
            }),
            (r.prototype.scale = function (t, e) {
                return (1 === t && 1 === e) || ((this.cache = null), this.queue.push([t, 0, 0, e, 0, 0])), this;
            }),
            (r.prototype.rotate = function (t, e, n) {
                var r, i, o;
                return (
                    0 !== t &&
                        (this.translate(e, n),
                        (r = (t * Math.PI) / 180),
                        (i = Math.cos(r)),
                        (o = Math.sin(r)),
                        this.queue.push([i, o, -o, i, 0, 0]),
                        (this.cache = null),
                        this.translate(-e, -n)),
                    this
                );
            }),
            (r.prototype.skewX = function (t) {
                return (
                    0 !== t && ((this.cache = null), this.queue.push([1, 0, Math.tan((t * Math.PI) / 180), 1, 0, 0])),
                    this
                );
            }),
            (r.prototype.skewY = function (t) {
                return (
                    0 !== t && ((this.cache = null), this.queue.push([1, Math.tan((t * Math.PI) / 180), 0, 1, 0, 0])),
                    this
                );
            }),
            (r.prototype.toArray = function () {
                if (this.cache) return this.cache;
                if (!this.queue.length) return (this.cache = [1, 0, 0, 1, 0, 0]), this.cache;
                if (((this.cache = this.queue[0]), 1 === this.queue.length)) return this.cache;
                for (var t = 1; t < this.queue.length; t++)
                    this.cache =
                        ((e = this.cache),
                        (n = this.queue[t]),
                        [
                            e[0] * n[0] + e[2] * n[1],
                            e[1] * n[0] + e[3] * n[1],
                            e[0] * n[2] + e[2] * n[3],
                            e[1] * n[2] + e[3] * n[3],
                            e[0] * n[4] + e[2] * n[5] + e[4],
                            e[1] * n[4] + e[3] * n[5] + e[5],
                        ]);
                var e, n;
                return this.cache;
            }),
            (r.prototype.calc = function (t, e, n) {
                var r;
                return this.queue.length
                    ? (this.cache || (this.cache = this.toArray()),
                      [t * (r = this.cache)[0] + e * r[2] + (n ? 0 : r[4]), t * r[1] + e * r[3] + (n ? 0 : r[5])])
                    : [t, e];
            }),
            (t.exports = r);
    },
    function (t, e, n) {
        'use strict';
        var r = n(2);
        t.exports = {
            encode: function (t) {
                return r
                    .map(t, function (t) {
                        var e = '';
                        return (
                            t > 65535 &&
                                ((t -= 65536),
                                (e += String.fromCharCode(((t >>> 10) & 1023) | 55296)),
                                (t = 56320 | (1023 & t))),
                            (e += String.fromCharCode(t))
                        );
                    })
                    .join('');
            },
            decode: function (t) {
                for (var e, n, r = [], i = 0, o = t.length; i < o; )
                    (e = t.charCodeAt(i++)) >= 55296 && e <= 56319 && i < o
                        ? 56320 == (64512 & (n = t.charCodeAt(i++)))
                            ? r.push(((1023 & e) << 10) + (1023 & n) + 65536)
                            : (r.push(e), i--)
                        : r.push(e);
                return r;
            },
        };
    },
    function (t, e) {
        function n(t, e) {
            for (var n in t) e[n] = t[n];
        }
        function r(t, e) {
            var r = t.prototype;
            if (Object.create) {
                var i = Object.create(e.prototype);
                r.__proto__ = i;
            }
            if (!(r instanceof e)) {
                function o() {}
                (o.prototype = e.prototype), n(r, (o = new o())), (t.prototype = r = o);
            }
            r.constructor != t && ('function' != typeof t && console.error('unknow Class:' + t), (r.constructor = t));
        }
        var i = {},
            o = (i.ELEMENT_NODE = 1),
            a = (i.ATTRIBUTE_NODE = 2),
            s = (i.TEXT_NODE = 3),
            u = (i.CDATA_SECTION_NODE = 4),
            c = (i.ENTITY_REFERENCE_NODE = 5),
            f = (i.ENTITY_NODE = 6),
            h = (i.PROCESSING_INSTRUCTION_NODE = 7),
            l = (i.COMMENT_NODE = 8),
            p = (i.DOCUMENT_NODE = 9),
            d = (i.DOCUMENT_TYPE_NODE = 10),
            v = (i.DOCUMENT_FRAGMENT_NODE = 11),
            m = (i.NOTATION_NODE = 12),
            y = {},
            g = {},
            _ =
                ((y.INDEX_SIZE_ERR = ((g[1] = 'Index size error'), 1)),
                (y.DOMSTRING_SIZE_ERR = ((g[2] = 'DOMString size error'), 2)),
                (y.HIERARCHY_REQUEST_ERR = ((g[3] = 'Hierarchy request error'), 3))),
            w =
                ((y.WRONG_DOCUMENT_ERR = ((g[4] = 'Wrong document'), 4)),
                (y.INVALID_CHARACTER_ERR = ((g[5] = 'Invalid character'), 5)),
                (y.NO_DATA_ALLOWED_ERR = ((g[6] = 'No data allowed'), 6)),
                (y.NO_MODIFICATION_ALLOWED_ERR = ((g[7] = 'No modification allowed'), 7)),
                (y.NOT_FOUND_ERR = ((g[8] = 'Not found'), 8))),
            b =
                ((y.NOT_SUPPORTED_ERR = ((g[9] = 'Not supported'), 9)),
                (y.INUSE_ATTRIBUTE_ERR = ((g[10] = 'Attribute in use'), 10)));
        (y.INVALID_STATE_ERR = ((g[11] = 'Invalid state'), 11)),
            (y.SYNTAX_ERR = ((g[12] = 'Syntax error'), 12)),
            (y.INVALID_MODIFICATION_ERR = ((g[13] = 'Invalid modification'), 13)),
            (y.NAMESPACE_ERR = ((g[14] = 'Invalid namespace'), 14)),
            (y.INVALID_ACCESS_ERR = ((g[15] = 'Invalid access'), 15));
        function x(t, e) {
            if (e instanceof Error) var n = e;
            else
                (n = this),
                    Error.call(this, g[t]),
                    (this.message = g[t]),
                    Error.captureStackTrace && Error.captureStackTrace(this, x);
            return (n.code = t), e && (this.message = this.message + ': ' + e), n;
        }
        function E() {}
        function S(t, e) {
            (this._node = t), (this._refresh = e), T(this);
        }
        function T(t) {
            var e = t._node._inc || t._node.ownerDocument._inc;
            if (t._inc != e) {
                var r = t._refresh(t._node);
                et(t, 'length', r.length), n(r, t), (t._inc = e);
            }
        }
        function N() {}
        function O(t, e) {
            for (var n = t.length; n--; ) if (t[n] === e) return n;
        }
        function A(t, e, n, r) {
            if ((r ? (e[O(e, r)] = n) : (e[e.length++] = n), t)) {
                n.ownerElement = t;
                var i = t.ownerDocument;
                i &&
                    (r && P(i, t, r),
                    (function (t, e, n) {
                        t && t._inc++,
                            'http://www.w3.org/2000/xmlns/' == n.namespaceURI &&
                                (e._nsMap[n.prefix ? n.localName : ''] = n.value);
                    })(i, t, n));
            }
        }
        function C(t, e, n) {
            var r = O(e, n);
            if (!(r >= 0)) throw x(w, new Error(t.tagName + '@' + n));
            for (var i = e.length - 1; r < i; ) e[r] = e[++r];
            if (((e.length = i), t)) {
                var o = t.ownerDocument;
                o && (P(o, t, n), (n.ownerElement = null));
            }
        }
        function I(t) {
            if (((this._features = {}), t)) for (var e in t) this._features = t[e];
        }
        function M() {}
        function D(t) {
            return (
                ('<' == t ? '&lt;' : '>' == t && '&gt;') ||
                ('&' == t && '&amp;') ||
                ('"' == t && '&quot;') ||
                '&#' + t.charCodeAt() + ';'
            );
        }
        function U(t, e) {
            if (e(t)) return !0;
            if ((t = t.firstChild))
                do {
                    if (U(t, e)) return !0;
                } while ((t = t.nextSibling));
        }
        function k() {}
        function P(t, e, n, r) {
            t && t._inc++,
                'http://www.w3.org/2000/xmlns/' == n.namespaceURI && delete e._nsMap[n.prefix ? n.localName : ''];
        }
        function R(t, e, n) {
            if (t && t._inc) {
                t._inc++;
                var r = e.childNodes;
                if (n) r[r.length++] = n;
                else {
                    for (var i = e.firstChild, o = 0; i; ) (r[o++] = i), (i = i.nextSibling);
                    r.length = o;
                }
            }
        }
        function F(t, e) {
            var n = e.previousSibling,
                r = e.nextSibling;
            return (
                n ? (n.nextSibling = r) : (t.firstChild = r),
                r ? (r.previousSibling = n) : (t.lastChild = n),
                R(t.ownerDocument, t),
                e
            );
        }
        function L(t, e, n) {
            var r = e.parentNode;
            if ((r && r.removeChild(e), e.nodeType === v)) {
                var i = e.firstChild;
                if (null == i) return e;
                var o = e.lastChild;
            } else i = o = e;
            var a = n ? n.previousSibling : t.lastChild;
            (i.previousSibling = a),
                (o.nextSibling = n),
                a ? (a.nextSibling = i) : (t.firstChild = i),
                null == n ? (t.lastChild = o) : (n.previousSibling = o);
            do {
                i.parentNode = t;
            } while (i !== o && (i = i.nextSibling));
            return R(t.ownerDocument || t, t), e.nodeType == v && (e.firstChild = e.lastChild = null), e;
        }
        function j() {
            this._nsMap = {};
        }
        function z() {}
        function B() {}
        function V() {}
        function q() {}
        function Y() {}
        function X() {}
        function G() {}
        function H() {}
        function W() {}
        function $() {}
        function Q() {}
        function Z() {}
        function J(t, e) {
            var n = [],
                r = 9 == this.nodeType ? this.documentElement : this,
                i = r.prefix,
                o = r.namespaceURI;
            if (o && null == i && null == (i = r.lookupPrefix(o))) var a = [{ namespace: o, prefix: null }];
            return tt(this, n, t, e, a), n.join('');
        }
        function K(t, e, n) {
            var r = t.prefix || '',
                i = t.namespaceURI;
            if (!r && !i) return !1;
            if (('xml' === r && 'http://www.w3.org/XML/1998/namespace' === i) || 'http://www.w3.org/2000/xmlns/' == i)
                return !1;
            for (var o = n.length; o--; ) {
                var a = n[o];
                if (a.prefix == r) return a.namespace != i;
            }
            return !0;
        }
        function tt(t, e, n, r, i) {
            if (r) {
                if (!(t = r(t))) return;
                if ('string' == typeof t) return void e.push(t);
            }
            switch (t.nodeType) {
                case o:
                    i || (i = []);
                    i.length;
                    var f = t.attributes,
                        m = f.length,
                        y = t.firstChild,
                        g = t.tagName;
                    (n = 'http://www.w3.org/1999/xhtml' === t.namespaceURI || n), e.push('<', g);
                    for (var _ = 0; _ < m; _++) {
                        'xmlns' == (w = f.item(_)).prefix
                            ? i.push({
                                  prefix: w.localName,
                                  namespace: w.value,
                              })
                            : 'xmlns' == w.nodeName && i.push({ prefix: '', namespace: w.value });
                    }
                    for (_ = 0; _ < m; _++) {
                        var w;
                        if (K((w = f.item(_)), 0, i)) {
                            var b = w.prefix || '',
                                x = w.namespaceURI,
                                E = b ? ' xmlns:' + b : ' xmlns';
                            e.push(E, '="', x, '"'), i.push({ prefix: b, namespace: x });
                        }
                        tt(w, e, n, r, i);
                    }
                    if (K(t, 0, i)) {
                        (b = t.prefix || ''), (x = t.namespaceURI), (E = b ? ' xmlns:' + b : ' xmlns');
                        e.push(E, '="', x, '"'), i.push({ prefix: b, namespace: x });
                    }
                    if (y || (n && !/^(?:meta|link|img|br|hr|input)$/i.test(g))) {
                        if ((e.push('>'), n && /^script$/i.test(g)))
                            for (; y; ) y.data ? e.push(y.data) : tt(y, e, n, r, i), (y = y.nextSibling);
                        else for (; y; ) tt(y, e, n, r, i), (y = y.nextSibling);
                        e.push('</', g, '>');
                    } else e.push('/>');
                    return;
                case p:
                case v:
                    for (y = t.firstChild; y; ) tt(y, e, n, r, i), (y = y.nextSibling);
                    return;
                case a:
                    return e.push(' ', t.name, '="', t.value.replace(/[<&"]/g, D), '"');
                case s:
                    return e.push(t.data.replace(/[<&]/g, D));
                case u:
                    return e.push('<![CDATA[', t.data, ']]>');
                case l:
                    return e.push('\x3c!--', t.data, '--\x3e');
                case d:
                    var S = t.publicId,
                        T = t.systemId;
                    if ((e.push('<!DOCTYPE ', t.name), S))
                        e.push(' PUBLIC "', S), T && '.' != T && e.push('" "', T), e.push('">');
                    else if (T && '.' != T) e.push(' SYSTEM "', T, '">');
                    else {
                        var N = t.internalSubset;
                        N && e.push(' [', N, ']'), e.push('>');
                    }
                    return;
                case h:
                    return e.push('<?', t.target, ' ', t.data, '?>');
                case c:
                    return e.push('&', t.nodeName, ';');
                default:
                    e.push('??', t.nodeName);
            }
        }
        function et(t, e, n) {
            t[e] = n;
        }
        (x.prototype = Error.prototype),
            n(y, x),
            (E.prototype = {
                length: 0,
                item: function (t) {
                    return this[t] || null;
                },
                toString: function (t, e) {
                    for (var n = [], r = 0; r < this.length; r++) tt(this[r], n, t, e);
                    return n.join('');
                },
            }),
            (S.prototype.item = function (t) {
                return T(this), this[t];
            }),
            r(S, E),
            (N.prototype = {
                length: 0,
                item: E.prototype.item,
                getNamedItem: function (t) {
                    for (var e = this.length; e--; ) {
                        var n = this[e];
                        if (n.nodeName == t) return n;
                    }
                },
                setNamedItem: function (t) {
                    var e = t.ownerElement;
                    if (e && e != this._ownerElement) throw new x(b);
                    var n = this.getNamedItem(t.nodeName);
                    return A(this._ownerElement, this, t, n), n;
                },
                setNamedItemNS: function (t) {
                    var e,
                        n = t.ownerElement;
                    if (n && n != this._ownerElement) throw new x(b);
                    return (e = this.getNamedItemNS(t.namespaceURI, t.localName)), A(this._ownerElement, this, t, e), e;
                },
                removeNamedItem: function (t) {
                    var e = this.getNamedItem(t);
                    return C(this._ownerElement, this, e), e;
                },
                removeNamedItemNS: function (t, e) {
                    var n = this.getNamedItemNS(t, e);
                    return C(this._ownerElement, this, n), n;
                },
                getNamedItemNS: function (t, e) {
                    for (var n = this.length; n--; ) {
                        var r = this[n];
                        if (r.localName == e && r.namespaceURI == t) return r;
                    }
                    return null;
                },
            }),
            (I.prototype = {
                hasFeature: function (t, e) {
                    var n = this._features[t.toLowerCase()];
                    return !(!n || (e && !(e in n)));
                },
                createDocument: function (t, e, n) {
                    var r = new k();
                    if (
                        ((r.implementation = this), (r.childNodes = new E()), (r.doctype = n), n && r.appendChild(n), e)
                    ) {
                        var i = r.createElementNS(t, e);
                        r.appendChild(i);
                    }
                    return r;
                },
                createDocumentType: function (t, e, n) {
                    var r = new X();
                    return (r.name = t), (r.nodeName = t), (r.publicId = e), (r.systemId = n), r;
                },
            }),
            (M.prototype = {
                firstChild: null,
                lastChild: null,
                previousSibling: null,
                nextSibling: null,
                attributes: null,
                parentNode: null,
                childNodes: null,
                ownerDocument: null,
                nodeValue: null,
                namespaceURI: null,
                prefix: null,
                localName: null,
                insertBefore: function (t, e) {
                    return L(this, t, e);
                },
                replaceChild: function (t, e) {
                    this.insertBefore(t, e), e && this.removeChild(e);
                },
                removeChild: function (t) {
                    return F(this, t);
                },
                appendChild: function (t) {
                    return this.insertBefore(t, null);
                },
                hasChildNodes: function () {
                    return null != this.firstChild;
                },
                cloneNode: function (t) {
                    return (function t(e, n, r) {
                        var i = new n.constructor();
                        for (var s in n) {
                            var u = n[s];
                            'object' != typeof u && u != i[s] && (i[s] = u);
                        }
                        n.childNodes && (i.childNodes = new E());
                        switch (((i.ownerDocument = e), i.nodeType)) {
                            case o:
                                var c = n.attributes,
                                    f = (i.attributes = new N()),
                                    h = c.length;
                                f._ownerElement = i;
                                for (var l = 0; l < h; l++) i.setAttributeNode(t(e, c.item(l), !0));
                                break;
                            case a:
                                r = !0;
                        }
                        if (r) for (var p = n.firstChild; p; ) i.appendChild(t(e, p, r)), (p = p.nextSibling);
                        return i;
                    })(this.ownerDocument || this, this, t);
                },
                normalize: function () {
                    for (var t = this.firstChild; t; ) {
                        var e = t.nextSibling;
                        e && e.nodeType == s && t.nodeType == s
                            ? (this.removeChild(e), t.appendData(e.data))
                            : (t.normalize(), (t = e));
                    }
                },
                isSupported: function (t, e) {
                    return this.ownerDocument.implementation.hasFeature(t, e);
                },
                hasAttributes: function () {
                    return this.attributes.length > 0;
                },
                lookupPrefix: function (t) {
                    for (var e = this; e; ) {
                        var n = e._nsMap;
                        if (n) for (var r in n) if (n[r] == t) return r;
                        e = e.nodeType == a ? e.ownerDocument : e.parentNode;
                    }
                    return null;
                },
                lookupNamespaceURI: function (t) {
                    for (var e = this; e; ) {
                        var n = e._nsMap;
                        if (n && t in n) return n[t];
                        e = e.nodeType == a ? e.ownerDocument : e.parentNode;
                    }
                    return null;
                },
                isDefaultNamespace: function (t) {
                    return null == this.lookupPrefix(t);
                },
            }),
            n(i, M),
            n(i, M.prototype),
            (k.prototype = {
                nodeName: '#document',
                nodeType: p,
                doctype: null,
                documentElement: null,
                _inc: 1,
                insertBefore: function (t, e) {
                    if (t.nodeType == v) {
                        for (var n = t.firstChild; n; ) {
                            var r = n.nextSibling;
                            this.insertBefore(n, e), (n = r);
                        }
                        return t;
                    }
                    return (
                        null == this.documentElement && t.nodeType == o && (this.documentElement = t),
                        L(this, t, e),
                        (t.ownerDocument = this),
                        t
                    );
                },
                removeChild: function (t) {
                    return this.documentElement == t && (this.documentElement = null), F(this, t);
                },
                importNode: function (t, e) {
                    return (function t(e, n, r) {
                        var i;
                        switch (n.nodeType) {
                            case o:
                                (i = n.cloneNode(!1)).ownerDocument = e;
                            case v:
                                break;
                            case a:
                                r = !0;
                        }
                        i || (i = n.cloneNode(!1));
                        if (((i.ownerDocument = e), (i.parentNode = null), r))
                            for (var s = n.firstChild; s; ) i.appendChild(t(e, s, r)), (s = s.nextSibling);
                        return i;
                    })(this, t, e);
                },
                getElementById: function (t) {
                    var e = null;
                    return (
                        U(this.documentElement, function (n) {
                            if (n.nodeType == o && n.getAttribute('id') == t) return (e = n), !0;
                        }),
                        e
                    );
                },
                createElement: function (t) {
                    var e = new j();
                    return (
                        (e.ownerDocument = this),
                        (e.nodeName = t),
                        (e.tagName = t),
                        (e.childNodes = new E()),
                        ((e.attributes = new N())._ownerElement = e),
                        e
                    );
                },
                createDocumentFragment: function () {
                    var t = new $();
                    return (t.ownerDocument = this), (t.childNodes = new E()), t;
                },
                createTextNode: function (t) {
                    var e = new V();
                    return (e.ownerDocument = this), e.appendData(t), e;
                },
                createComment: function (t) {
                    var e = new q();
                    return (e.ownerDocument = this), e.appendData(t), e;
                },
                createCDATASection: function (t) {
                    var e = new Y();
                    return (e.ownerDocument = this), e.appendData(t), e;
                },
                createProcessingInstruction: function (t, e) {
                    var n = new Q();
                    return (n.ownerDocument = this), (n.tagName = n.target = t), (n.nodeValue = n.data = e), n;
                },
                createAttribute: function (t) {
                    var e = new z();
                    return (
                        (e.ownerDocument = this),
                        (e.name = t),
                        (e.nodeName = t),
                        (e.localName = t),
                        (e.specified = !0),
                        e
                    );
                },
                createEntityReference: function (t) {
                    var e = new W();
                    return (e.ownerDocument = this), (e.nodeName = t), e;
                },
                createElementNS: function (t, e) {
                    var n = new j(),
                        r = e.split(':'),
                        i = (n.attributes = new N());
                    return (
                        (n.childNodes = new E()),
                        (n.ownerDocument = this),
                        (n.nodeName = e),
                        (n.tagName = e),
                        (n.namespaceURI = t),
                        2 == r.length ? ((n.prefix = r[0]), (n.localName = r[1])) : (n.localName = e),
                        (i._ownerElement = n),
                        n
                    );
                },
                createAttributeNS: function (t, e) {
                    var n = new z(),
                        r = e.split(':');
                    return (
                        (n.ownerDocument = this),
                        (n.nodeName = e),
                        (n.name = e),
                        (n.namespaceURI = t),
                        (n.specified = !0),
                        2 == r.length ? ((n.prefix = r[0]), (n.localName = r[1])) : (n.localName = e),
                        n
                    );
                },
            }),
            r(k, M),
            (j.prototype = {
                nodeType: o,
                hasAttribute: function (t) {
                    return null != this.getAttributeNode(t);
                },
                getAttribute: function (t) {
                    var e = this.getAttributeNode(t);
                    return (e && e.value) || '';
                },
                getAttributeNode: function (t) {
                    return this.attributes.getNamedItem(t);
                },
                setAttribute: function (t, e) {
                    var n = this.ownerDocument.createAttribute(t);
                    (n.value = n.nodeValue = '' + e), this.setAttributeNode(n);
                },
                removeAttribute: function (t) {
                    var e = this.getAttributeNode(t);
                    e && this.removeAttributeNode(e);
                },
                appendChild: function (t) {
                    return t.nodeType === v
                        ? this.insertBefore(t, null)
                        : (function (t, e) {
                              var n = e.parentNode;
                              if (n) {
                                  var r = t.lastChild;
                                  n.removeChild(e);
                                  r = t.lastChild;
                              }
                              return (
                                  (r = t.lastChild),
                                  (e.parentNode = t),
                                  (e.previousSibling = r),
                                  (e.nextSibling = null),
                                  r ? (r.nextSibling = e) : (t.firstChild = e),
                                  (t.lastChild = e),
                                  R(t.ownerDocument, t, e),
                                  e
                              );
                          })(this, t);
                },
                setAttributeNode: function (t) {
                    return this.attributes.setNamedItem(t);
                },
                setAttributeNodeNS: function (t) {
                    return this.attributes.setNamedItemNS(t);
                },
                removeAttributeNode: function (t) {
                    return this.attributes.removeNamedItem(t.nodeName);
                },
                removeAttributeNS: function (t, e) {
                    var n = this.getAttributeNodeNS(t, e);
                    n && this.removeAttributeNode(n);
                },
                hasAttributeNS: function (t, e) {
                    return null != this.getAttributeNodeNS(t, e);
                },
                getAttributeNS: function (t, e) {
                    var n = this.getAttributeNodeNS(t, e);
                    return (n && n.value) || '';
                },
                setAttributeNS: function (t, e, n) {
                    var r = this.ownerDocument.createAttributeNS(t, e);
                    (r.value = r.nodeValue = '' + n), this.setAttributeNode(r);
                },
                getAttributeNodeNS: function (t, e) {
                    return this.attributes.getNamedItemNS(t, e);
                },
                getElementsByTagName: function (t) {
                    return new S(this, function (e) {
                        var n = [];
                        return (
                            U(e, function (r) {
                                r === e || r.nodeType != o || ('*' !== t && r.tagName != t) || n.push(r);
                            }),
                            n
                        );
                    });
                },
                getElementsByTagNameNS: function (t, e) {
                    return new S(this, function (n) {
                        var r = [];
                        return (
                            U(n, function (i) {
                                i === n ||
                                    i.nodeType !== o ||
                                    ('*' !== t && i.namespaceURI !== t) ||
                                    ('*' !== e && i.localName != e) ||
                                    r.push(i);
                            }),
                            r
                        );
                    });
                },
            }),
            (k.prototype.getElementsByTagName = j.prototype.getElementsByTagName),
            (k.prototype.getElementsByTagNameNS = j.prototype.getElementsByTagNameNS),
            r(j, M),
            (z.prototype.nodeType = a),
            r(z, M),
            (B.prototype = {
                data: '',
                substringData: function (t, e) {
                    return this.data.substring(t, t + e);
                },
                appendData: function (t) {
                    (t = this.data + t), (this.nodeValue = this.data = t), (this.length = t.length);
                },
                insertData: function (t, e) {
                    this.replaceData(t, 0, e);
                },
                appendChild: function (t) {
                    throw new Error(g[_]);
                },
                deleteData: function (t, e) {
                    this.replaceData(t, e, '');
                },
                replaceData: function (t, e, n) {
                    (n = this.data.substring(0, t) + n + this.data.substring(t + e)),
                        (this.nodeValue = this.data = n),
                        (this.length = n.length);
                },
            }),
            r(B, M),
            (V.prototype = {
                nodeName: '#text',
                nodeType: s,
                splitText: function (t) {
                    var e = this.data,
                        n = e.substring(t);
                    (e = e.substring(0, t)), (this.data = this.nodeValue = e), (this.length = e.length);
                    var r = this.ownerDocument.createTextNode(n);
                    return this.parentNode && this.parentNode.insertBefore(r, this.nextSibling), r;
                },
            }),
            r(V, B),
            (q.prototype = { nodeName: '#comment', nodeType: l }),
            r(q, B),
            (Y.prototype = { nodeName: '#cdata-section', nodeType: u }),
            r(Y, B),
            (X.prototype.nodeType = d),
            r(X, M),
            (G.prototype.nodeType = m),
            r(G, M),
            (H.prototype.nodeType = f),
            r(H, M),
            (W.prototype.nodeType = c),
            r(W, M),
            ($.prototype.nodeName = '#document-fragment'),
            ($.prototype.nodeType = v),
            r($, M),
            (Q.prototype.nodeType = h),
            r(Q, M),
            (Z.prototype.serializeToString = function (t, e, n) {
                return J.call(t, e, n);
            }),
            (M.prototype.toString = J);
        try {
            if (Object.defineProperty) {
                Object.defineProperty(S.prototype, 'length', {
                    get: function () {
                        return T(this), this.$$length;
                    },
                }),
                    Object.defineProperty(M.prototype, 'textContent', {
                        get: function () {
                            return (function t(e) {
                                switch (e.nodeType) {
                                    case o:
                                    case v:
                                        var n = [];
                                        for (e = e.firstChild; e; )
                                            7 !== e.nodeType && 8 !== e.nodeType && n.push(t(e)), (e = e.nextSibling);
                                        return n.join('');
                                    default:
                                        return e.nodeValue;
                                }
                            })(this);
                        },
                        set: function (t) {
                            switch (this.nodeType) {
                                case o:
                                case v:
                                    for (; this.firstChild; ) this.removeChild(this.firstChild);
                                    (t || String(t)) && this.appendChild(this.ownerDocument.createTextNode(t));
                                    break;
                                default:
                                    (this.data = t), (this.value = t), (this.nodeValue = t);
                            }
                        },
                    }),
                    (et = function (t, e, n) {
                        t['$$' + e] = n;
                    });
            }
        } catch (t) {}
        (e.DOMImplementation = I), (e.XMLSerializer = Z);
    },
    function (t, e, n) {
        'use strict';
        t.exports = {
            2: 'need dictionary',
            1: 'stream end',
            0: '',
            '-1': 'file error',
            '-2': 'stream error',
            '-3': 'data error',
            '-4': 'insufficient memory',
            '-5': 'buffer error',
            '-6': 'incompatible version',
        };
    },
    function (t, e, n) {
        'use strict';
        t.exports = Object.assign({}, n(14), n(16), n(19), n(37), n(39), n(45), n(6), n(49), n(51), n(53), n(7), n(9));
        const r = n(3);
        Object.getOwnPropertyDescriptor(r, 'promises') &&
            Object.defineProperty(t.exports, 'promises', {
                get: () => r.promises,
            });
    },
    function (t, e, n) {
        'use strict';
        n.r(e);
        var r = n(3),
            i = n(0),
            o = n(24),
            a = function (t, e, n, r) {
                return new (n || (n = Promise))(function (i, o) {
                    function a(t) {
                        try {
                            u(r.next(t));
                        } catch (t) {
                            o(t);
                        }
                    }
                    function s(t) {
                        try {
                            u(r.throw(t));
                        } catch (t) {
                            o(t);
                        }
                    }
                    function u(t) {
                        var e;
                        t.done
                            ? i(t.value)
                            : ((e = t.value),
                              e instanceof n
                                  ? e
                                  : new n(function (t) {
                                        t(e);
                                    })).then(a, s);
                    }
                    u((r = r.apply(t, e || [])).next());
                });
            };
        const s = n(54),
            u = n(81),
            c = n(89);
        function f(t, e) {
            const n = Object(r.readdirSync)(t);
            for (const o of n) {
                Object(r.lstatSync)(Object(i.join)(t, o)).isDirectory()
                    ? f(Object(i.join)(t, o), e)
                    : o.endsWith('.svg') && (e[Object(i.join)(t, o)] = o.replace('.svg', ''));
            }
        }
        const h = process.argv[2] ? process.argv[2] : void 0,
            l = './src/assets/fonts';
        Object(o.ensureDirSync)(l),
            a(void 0, void 0, void 0, function* () {
                const t = {};
                f(__dirname + '/../src/assets/icons', t), h && f(h, t);
                const e = new c({
                    fontName: 'Desktop UI icon Mono',
                    fontHeight: 1700,
                    normalize: !0,
                    fixedWidth: !0,
                });
                e.pipe(Object(r.createWriteStream)(l + '/ui-icons.svg'))
                    .on('finish', function () {
                        console.log('SVG successfully created!');
                        const t = s(Object(r.readFileSync)(l + '/ui-icons.svg', 'utf8'), {
                            description: 'Desktop UI Icons',
                        });
                        Object(r.writeFileSync)(l + '/ui-icons.ttf', new Buffer(t.buffer)),
                            console.log('TTF successfully created!');
                        {
                            const t = Object(r.readFileSync)(l + '/ui-icons.ttf'),
                                e = new Uint8Array(t),
                                n = new Buffer(u(e, {}).buffer);
                            Object(r.writeFileSync)(l + '/ui-icons.woff', n), console.log('WOFF successfully created!');
                        }
                        h &&
                            (console.log('Done. Dont forget to add following code in your styles.scss.'),
                            console.log(
                                Object(r.readFileSync)(__dirname + '/../src/scss/icon.scss', 'utf8').replace(
                                    /\.\.\/assets\/fonts/,
                                    l,
                                ),
                            ));
                    })
                    .on('error', function (t) {
                        console.log(t), process.exit(1);
                    });
                let n = 57345;
                const i = [];
                for (const o in t) {
                    const a = Object(r.createReadStream)(o),
                        s = t[o];
                    i.push(s),
                        (a.metadata = {
                            unicode: [String.fromCharCode(n++), s],
                            name: s,
                        }),
                        console.log('Glyph', s),
                        e.write(a);
                }
                e.end(), Object(r.writeFileSync)(l + '/icon-names.json', JSON.stringify(i));
            });
    },
    function (t, e, n) {
        var r = n(27),
            i = process.cwd,
            o = null,
            a = process.env.GRACEFUL_FS_PLATFORM || process.platform;
        process.cwd = function () {
            return o || (o = i.call(process)), o;
        };
        try {
            process.cwd();
        } catch (t) {}
        if ('function' == typeof process.chdir) {
            var s = process.chdir;
            (process.chdir = function (t) {
                (o = null), s.call(process, t);
            }),
                Object.setPrototypeOf && Object.setPrototypeOf(process.chdir, s);
        }
        t.exports = function (t) {
            r.hasOwnProperty('O_SYMLINK') &&
                process.version.match(/^v0\.6\.[0-2]|^v0\.5\./) &&
                (function (t) {
                    (t.lchmod = function (e, n, i) {
                        t.open(e, r.O_WRONLY | r.O_SYMLINK, n, function (e, r) {
                            e
                                ? i && i(e)
                                : t.fchmod(r, n, function (e) {
                                      t.close(r, function (t) {
                                          i && i(e || t);
                                      });
                                  });
                        });
                    }),
                        (t.lchmodSync = function (e, n) {
                            var i,
                                o = t.openSync(e, r.O_WRONLY | r.O_SYMLINK, n),
                                a = !0;
                            try {
                                (i = t.fchmodSync(o, n)), (a = !1);
                            } finally {
                                if (a)
                                    try {
                                        t.closeSync(o);
                                    } catch (t) {}
                                else t.closeSync(o);
                            }
                            return i;
                        });
                })(t);
            t.lutimes ||
                (function (t) {
                    r.hasOwnProperty('O_SYMLINK')
                        ? ((t.lutimes = function (e, n, i, o) {
                              t.open(e, r.O_SYMLINK, function (e, r) {
                                  e
                                      ? o && o(e)
                                      : t.futimes(r, n, i, function (e) {
                                            t.close(r, function (t) {
                                                o && o(e || t);
                                            });
                                        });
                              });
                          }),
                          (t.lutimesSync = function (e, n, i) {
                              var o,
                                  a = t.openSync(e, r.O_SYMLINK),
                                  s = !0;
                              try {
                                  (o = t.futimesSync(a, n, i)), (s = !1);
                              } finally {
                                  if (s)
                                      try {
                                          t.closeSync(a);
                                      } catch (t) {}
                                  else t.closeSync(a);
                              }
                              return o;
                          }))
                        : ((t.lutimes = function (t, e, n, r) {
                              r && process.nextTick(r);
                          }),
                          (t.lutimesSync = function () {}));
                })(t);
            (t.chown = o(t.chown)),
                (t.fchown = o(t.fchown)),
                (t.lchown = o(t.lchown)),
                (t.chmod = n(t.chmod)),
                (t.fchmod = n(t.fchmod)),
                (t.lchmod = n(t.lchmod)),
                (t.chownSync = s(t.chownSync)),
                (t.fchownSync = s(t.fchownSync)),
                (t.lchownSync = s(t.lchownSync)),
                (t.chmodSync = i(t.chmodSync)),
                (t.fchmodSync = i(t.fchmodSync)),
                (t.lchmodSync = i(t.lchmodSync)),
                (t.stat = u(t.stat)),
                (t.fstat = u(t.fstat)),
                (t.lstat = u(t.lstat)),
                (t.statSync = c(t.statSync)),
                (t.fstatSync = c(t.fstatSync)),
                (t.lstatSync = c(t.lstatSync)),
                t.lchmod ||
                    ((t.lchmod = function (t, e, n) {
                        n && process.nextTick(n);
                    }),
                    (t.lchmodSync = function () {}));
            t.lchown ||
                ((t.lchown = function (t, e, n, r) {
                    r && process.nextTick(r);
                }),
                (t.lchownSync = function () {}));
            'win32' === a &&
                (t.rename =
                    ((e = t.rename),
                    function (n, r, i) {
                        var o = Date.now(),
                            a = 0;
                        e(n, r, function s(u) {
                            if (u && ('EACCES' === u.code || 'EPERM' === u.code) && Date.now() - o < 6e4)
                                return (
                                    setTimeout(function () {
                                        t.stat(r, function (t, o) {
                                            t && 'ENOENT' === t.code ? e(n, r, s) : i(u);
                                        });
                                    }, a),
                                    void (a < 100 && (a += 10))
                                );
                            i && i(u);
                        });
                    }));
            var e;
            function n(e) {
                return e
                    ? function (n, r, i) {
                          return e.call(t, n, r, function (t) {
                              f(t) && (t = null), i && i.apply(this, arguments);
                          });
                      }
                    : e;
            }
            function i(e) {
                return e
                    ? function (n, r) {
                          try {
                              return e.call(t, n, r);
                          } catch (t) {
                              if (!f(t)) throw t;
                          }
                      }
                    : e;
            }
            function o(e) {
                return e
                    ? function (n, r, i, o) {
                          return e.call(t, n, r, i, function (t) {
                              f(t) && (t = null), o && o.apply(this, arguments);
                          });
                      }
                    : e;
            }
            function s(e) {
                return e
                    ? function (n, r, i) {
                          try {
                              return e.call(t, n, r, i);
                          } catch (t) {
                              if (!f(t)) throw t;
                          }
                      }
                    : e;
            }
            function u(e) {
                return e
                    ? function (n, r, i) {
                          function o(t, e) {
                              e && (e.uid < 0 && (e.uid += 4294967296), e.gid < 0 && (e.gid += 4294967296)),
                                  i && i.apply(this, arguments);
                          }
                          return (
                              'function' == typeof r && ((i = r), (r = null)), r ? e.call(t, n, r, o) : e.call(t, n, o)
                          );
                      }
                    : e;
            }
            function c(e) {
                return e
                    ? function (n, r) {
                          var i = r ? e.call(t, n, r) : e.call(t, n);
                          return i.uid < 0 && (i.uid += 4294967296), i.gid < 0 && (i.gid += 4294967296), i;
                      }
                    : e;
            }
            function f(t) {
                return (
                    !t ||
                    'ENOSYS' === t.code ||
                    !((process.getuid && 0 === process.getuid()) || ('EINVAL' !== t.code && 'EPERM' !== t.code))
                );
            }
            (t.read = (function (e) {
                function n(n, r, i, o, a, s) {
                    var u;
                    if (s && 'function' == typeof s) {
                        var c = 0;
                        u = function (f, h, l) {
                            if (f && 'EAGAIN' === f.code && c < 10) return c++, e.call(t, n, r, i, o, a, u);
                            s.apply(this, arguments);
                        };
                    }
                    return e.call(t, n, r, i, o, a, u);
                }
                return Object.setPrototypeOf && Object.setPrototypeOf(n, e), n;
            })(t.read)),
                (t.readSync =
                    ((h = t.readSync),
                    function (e, n, r, i, o) {
                        for (var a = 0; ; )
                            try {
                                return h.call(t, e, n, r, i, o);
                            } catch (t) {
                                if ('EAGAIN' === t.code && a < 10) {
                                    a++;
                                    continue;
                                }
                                throw t;
                            }
                    }));
            var h;
        };
    },
    function (t, e) {
        t.exports = require('constants');
    },
    function (t, e, n) {
        var r = n(11).Stream;
        t.exports = function (t) {
            return {
                ReadStream: function e(n, i) {
                    if (!(this instanceof e)) return new e(n, i);
                    r.call(this);
                    var o = this;
                    (this.path = n),
                        (this.fd = null),
                        (this.readable = !0),
                        (this.paused = !1),
                        (this.flags = 'r'),
                        (this.mode = 438),
                        (this.bufferSize = 65536),
                        (i = i || {});
                    for (var a = Object.keys(i), s = 0, u = a.length; s < u; s++) {
                        var c = a[s];
                        this[c] = i[c];
                    }
                    this.encoding && this.setEncoding(this.encoding);
                    if (void 0 !== this.start) {
                        if ('number' != typeof this.start) throw TypeError('start must be a Number');
                        if (void 0 === this.end) this.end = 1 / 0;
                        else if ('number' != typeof this.end) throw TypeError('end must be a Number');
                        if (this.start > this.end) throw new Error('start must be <= end');
                        this.pos = this.start;
                    }
                    if (null !== this.fd)
                        return void process.nextTick(function () {
                            o._read();
                        });
                    t.open(this.path, this.flags, this.mode, function (t, e) {
                        if (t) return o.emit('error', t), void (o.readable = !1);
                        (o.fd = e), o.emit('open', e), o._read();
                    });
                },
                WriteStream: function e(n, i) {
                    if (!(this instanceof e)) return new e(n, i);
                    r.call(this),
                        (this.path = n),
                        (this.fd = null),
                        (this.writable = !0),
                        (this.flags = 'w'),
                        (this.encoding = 'binary'),
                        (this.mode = 438),
                        (this.bytesWritten = 0),
                        (i = i || {});
                    for (var o = Object.keys(i), a = 0, s = o.length; a < s; a++) {
                        var u = o[a];
                        this[u] = i[u];
                    }
                    if (void 0 !== this.start) {
                        if ('number' != typeof this.start) throw TypeError('start must be a Number');
                        if (this.start < 0) throw new Error('start must be >= zero');
                        this.pos = this.start;
                    }
                    (this.busy = !1),
                        (this._queue = []),
                        null === this.fd &&
                            ((this._open = t.open),
                            this._queue.push([this._open, this.path, this.flags, this.mode, void 0]),
                            this.flush());
                },
            };
        };
    },
    function (t, e, n) {
        'use strict';
        t.exports = function (t) {
            if (null === t || 'object' != typeof t) return t;
            if (t instanceof Object) var e = { __proto__: r(t) };
            else e = Object.create(null);
            return (
                Object.getOwnPropertyNames(t).forEach(function (n) {
                    Object.defineProperty(e, n, Object.getOwnPropertyDescriptor(t, n));
                }),
                e
            );
        };
        var r =
            Object.getPrototypeOf ||
            function (t) {
                return t.__proto__;
            };
    },
    function (t, e) {
        t.exports = require('util');
    },
    function (t, e, n) {
        'use strict';
        const r = n(1),
            i = n(0),
            o = n(6).mkdirsSync,
            a = n(18).utimesMillisSync,
            s = n(8);
        function u(t, e, n, o) {
            if (!o.filter || o.filter(e, n))
                return (function (t, e, n, o) {
                    const a = (o.dereference ? r.statSync : r.lstatSync)(e);
                    if (a.isDirectory())
                        return (function (t, e, n, i, o) {
                            if (!e)
                                return (function (t, e, n, i) {
                                    return r.mkdirSync(n), f(e, n, i), r.chmodSync(n, t.mode);
                                })(t, n, i, o);
                            if (e && !e.isDirectory())
                                throw new Error(`Cannot overwrite non-directory '${i}' with directory '${n}'.`);
                            return f(n, i, o);
                        })(a, t, e, n, o);
                    if (a.isFile() || a.isCharacterDevice() || a.isBlockDevice())
                        return (function (t, e, n, i, o) {
                            return e
                                ? (function (t, e, n, i) {
                                      if (i.overwrite) return r.unlinkSync(n), c(t, e, n, i);
                                      if (i.errorOnExist) throw new Error(`'${n}' already exists`);
                                  })(t, n, i, o)
                                : c(t, n, i, o);
                        })(a, t, e, n, o);
                    if (a.isSymbolicLink())
                        return (function (t, e, n, o) {
                            let a = r.readlinkSync(e);
                            o.dereference && (a = i.resolve(process.cwd(), a));
                            if (t) {
                                let t;
                                try {
                                    t = r.readlinkSync(n);
                                } catch (t) {
                                    if ('EINVAL' === t.code || 'UNKNOWN' === t.code) return r.symlinkSync(a, n);
                                    throw t;
                                }
                                if ((o.dereference && (t = i.resolve(process.cwd(), t)), s.isSrcSubdir(a, t)))
                                    throw new Error(`Cannot copy '${a}' to a subdirectory of itself, '${t}'.`);
                                if (r.statSync(n).isDirectory() && s.isSrcSubdir(t, a))
                                    throw new Error(`Cannot overwrite '${t}' with '${a}'.`);
                                return (function (t, e) {
                                    return r.unlinkSync(e), r.symlinkSync(t, e);
                                })(a, n);
                            }
                            return r.symlinkSync(a, n);
                        })(t, e, n, o);
                })(t, e, n, o);
        }
        function c(t, e, i, o) {
            return 'function' == typeof r.copyFileSync
                ? (r.copyFileSync(e, i), r.chmodSync(i, t.mode), o.preserveTimestamps ? a(i, t.atime, t.mtime) : void 0)
                : (function (t, e, i, o) {
                      const a = n(35)(65536),
                          s = r.openSync(e, 'r'),
                          u = r.openSync(i, 'w', t.mode);
                      let c = 0;
                      for (; c < t.size; ) {
                          const t = r.readSync(s, a, 0, 65536, c);
                          r.writeSync(u, a, 0, t), (c += t);
                      }
                      o.preserveTimestamps && r.futimesSync(u, t.atime, t.mtime);
                      r.closeSync(s), r.closeSync(u);
                  })(t, e, i, o);
        }
        function f(t, e, n) {
            r.readdirSync(t).forEach(r =>
                (function (t, e, n, r) {
                    const o = i.join(e, t),
                        a = i.join(n, t),
                        { destStat: c } = s.checkPathsSync(o, a, 'copy');
                    return u(c, o, a, r);
                })(r, t, e, n),
            );
        }
        t.exports = function (t, e, n) {
            'function' == typeof n && (n = { filter: n }),
                ((n = n || {}).clobber = !('clobber' in n) || !!n.clobber),
                (n.overwrite = 'overwrite' in n ? !!n.overwrite : n.clobber),
                n.preserveTimestamps &&
                    'ia32' === process.arch &&
                    console.warn(
                        'fs-extra: Using the preserveTimestamps option in 32-bit node is not recommended;\n\n    see https://github.com/jprichardson/node-fs-extra/issues/269',
                    );
            const { srcStat: a, destStat: c } = s.checkPathsSync(t, e, 'copy');
            return (
                s.checkParentPathsSync(t, a, e, 'copy'),
                (function (t, e, n, a) {
                    if (a.filter && !a.filter(e, n)) return;
                    const s = i.dirname(n);
                    r.existsSync(s) || o(s);
                    return u(t, e, n, a);
                })(c, t, e, n)
            );
        };
    },
    function (t, e, n) {
        'use strict';
        const r = n(1),
            i = n(0),
            o = n(17).invalidWin32Path,
            a = parseInt('0777', 8);
        t.exports = function t(e, n, s, u) {
            if (
                ('function' == typeof n ? ((s = n), (n = {})) : (n && 'object' == typeof n) || (n = { mode: n }),
                'win32' === process.platform && o(e))
            ) {
                const t = new Error(e + ' contains invalid WIN32 path characters.');
                return (t.code = 'EINVAL'), s(t);
            }
            let c = n.mode;
            const f = n.fs || r;
            void 0 === c && (c = a & ~process.umask()),
                u || (u = null),
                (s = s || function () {}),
                (e = i.resolve(e)),
                f.mkdir(e, c, r => {
                    if (!r) return s(null, (u = u || e));
                    switch (r.code) {
                        case 'ENOENT':
                            if (i.dirname(e) === e) return s(r);
                            t(i.dirname(e), n, (r, i) => {
                                r ? s(r, i) : t(e, n, s, i);
                            });
                            break;
                        default:
                            f.stat(e, (t, e) => {
                                t || !e.isDirectory() ? s(r, u) : s(null, u);
                            });
                    }
                });
        };
    },
    function (t, e, n) {
        'use strict';
        const r = n(1),
            i = n(0),
            o = n(17).invalidWin32Path,
            a = parseInt('0777', 8);
        t.exports = function t(e, n, s) {
            (n && 'object' == typeof n) || (n = { mode: n });
            let u = n.mode;
            const c = n.fs || r;
            if ('win32' === process.platform && o(e)) {
                const t = new Error(e + ' contains invalid WIN32 path characters.');
                throw ((t.code = 'EINVAL'), t);
            }
            void 0 === u && (u = a & ~process.umask()), s || (s = null), (e = i.resolve(e));
            try {
                c.mkdirSync(e, u), (s = s || e);
            } catch (r) {
                if ('ENOENT' === r.code) {
                    if (i.dirname(e) === e) throw r;
                    (s = t(i.dirname(e), n, s)), t(e, n, s);
                } else {
                    let t;
                    try {
                        t = c.statSync(e);
                    } catch (t) {
                        throw r;
                    }
                    if (!t.isDirectory()) throw r;
                }
            }
            return s;
        };
    },
    function (t, e) {
        t.exports = require('os');
    },
    function (t, e, n) {
        'use strict';
        t.exports = function (t) {
            if ('function' == typeof Buffer.allocUnsafe)
                try {
                    return Buffer.allocUnsafe(t);
                } catch (e) {
                    return new Buffer(t);
                }
            return new Buffer(t);
        };
    },
    function (t, e, n) {
        'use strict';
        const r = n(1),
            i = n(0),
            o = n(6).mkdirs,
            a = n(7).pathExists,
            s = n(18).utimesMillis,
            u = n(8);
        function c(t, e, n, r, s) {
            const u = i.dirname(n);
            a(u, (i, a) => (i ? s(i) : a ? h(t, e, n, r, s) : void o(u, i => (i ? s(i) : h(t, e, n, r, s)))));
        }
        function f(t, e, n, r, i, o) {
            Promise.resolve(i.filter(n, r)).then(
                a => (a ? t(e, n, r, i, o) : o()),
                t => o(t),
            );
        }
        function h(t, e, n, r, i) {
            return r.filter ? f(l, t, e, n, r, i) : l(t, e, n, r, i);
        }
        function l(t, e, n, i, o) {
            (i.dereference ? r.stat : r.lstat)(e, (a, s) =>
                a
                    ? o(a)
                    : s.isDirectory()
                      ? (function (t, e, n, i, o, a) {
                            if (!e)
                                return (function (t, e, n, i, o) {
                                    r.mkdir(n, a => {
                                        if (a) return o(a);
                                        v(e, n, i, e => (e ? o(e) : r.chmod(n, t.mode, o)));
                                    });
                                })(t, n, i, o, a);
                            if (e && !e.isDirectory())
                                return a(new Error(`Cannot overwrite non-directory '${i}' with directory '${n}'.`));
                            return v(n, i, o, a);
                        })(s, t, e, n, i, o)
                      : s.isFile() || s.isCharacterDevice() || s.isBlockDevice()
                        ? (function (t, e, n, i, o, a) {
                              return e
                                  ? (function (t, e, n, i, o) {
                                        if (!i.overwrite)
                                            return i.errorOnExist ? o(new Error(`'${n}' already exists`)) : o();
                                        r.unlink(n, r => (r ? o(r) : p(t, e, n, i, o)));
                                    })(t, n, i, o, a)
                                  : p(t, n, i, o, a);
                          })(s, t, e, n, i, o)
                        : s.isSymbolicLink()
                          ? y(t, e, n, i, o)
                          : void 0,
            );
        }
        function p(t, e, n, i, o) {
            return 'function' == typeof r.copyFile
                ? r.copyFile(e, n, e => (e ? o(e) : d(t, n, i, o)))
                : (function (t, e, n, i, o) {
                      const a = r.createReadStream(e);
                      a.on('error', t => o(t)).once('open', () => {
                          const e = r.createWriteStream(n, { mode: t.mode });
                          e.on('error', t => o(t))
                              .on('open', () => a.pipe(e))
                              .once('close', () => d(t, n, i, o));
                      });
                  })(t, e, n, i, o);
        }
        function d(t, e, n, i) {
            r.chmod(e, t.mode, r => (r ? i(r) : n.preserveTimestamps ? s(e, t.atime, t.mtime, i) : i()));
        }
        function v(t, e, n, i) {
            r.readdir(t, (r, o) => (r ? i(r) : m(o, t, e, n, i)));
        }
        function m(t, e, n, r, o) {
            const a = t.pop();
            return a
                ? (function (t, e, n, r, o, a) {
                      const s = i.join(n, e),
                          c = i.join(r, e);
                      u.checkPaths(s, c, 'copy', (e, i) => {
                          if (e) return a(e);
                          const { destStat: u } = i;
                          h(u, s, c, o, e => (e ? a(e) : m(t, n, r, o, a)));
                      });
                  })(t, a, e, n, r, o)
                : o();
        }
        function y(t, e, n, o, a) {
            r.readlink(e, (e, s) =>
                e
                    ? a(e)
                    : (o.dereference && (s = i.resolve(process.cwd(), s)),
                      t
                          ? void r.readlink(n, (e, c) =>
                                e
                                    ? 'EINVAL' === e.code || 'UNKNOWN' === e.code
                                        ? r.symlink(s, n, a)
                                        : a(e)
                                    : (o.dereference && (c = i.resolve(process.cwd(), c)),
                                      u.isSrcSubdir(s, c)
                                          ? a(new Error(`Cannot copy '${s}' to a subdirectory of itself, '${c}'.`))
                                          : t.isDirectory() && u.isSrcSubdir(c, s)
                                            ? a(new Error(`Cannot overwrite '${c}' with '${s}'.`))
                                            : (function (t, e, n) {
                                                  r.unlink(e, i => (i ? n(i) : r.symlink(t, e, n)));
                                              })(s, n, a)),
                            )
                          : r.symlink(s, n, a)),
            );
        }
        t.exports = function (t, e, n, r) {
            'function' != typeof n || r ? 'function' == typeof n && (n = { filter: n }) : ((r = n), (n = {})),
                (r = r || function () {}),
                ((n = n || {}).clobber = !('clobber' in n) || !!n.clobber),
                (n.overwrite = 'overwrite' in n ? !!n.overwrite : n.clobber),
                n.preserveTimestamps &&
                    'ia32' === process.arch &&
                    console.warn(
                        'fs-extra: Using the preserveTimestamps option in 32-bit node is not recommended;\n\n    see https://github.com/jprichardson/node-fs-extra/issues/269',
                    ),
                u.checkPaths(t, e, 'copy', (i, o) => {
                    if (i) return r(i);
                    const { srcStat: a, destStat: s } = o;
                    u.checkParentPaths(t, a, e, 'copy', i =>
                        i ? r(i) : n.filter ? f(c, s, t, e, n, r) : c(s, t, e, n, r),
                    );
                });
        };
    },
    function (t, e, n) {
        'use strict';
        const r = n(4).fromCallback,
            i = n(1),
            o = n(0),
            a = n(6),
            s = n(9),
            u = r(function (t, e) {
                (e = e || function () {}),
                    i.readdir(t, (n, r) => {
                        if (n) return a.mkdirs(t, e);
                        (r = r.map(e => o.join(t, e))),
                            (function t() {
                                const n = r.pop();
                                if (!n) return e();
                                s.remove(n, n => {
                                    if (n) return e(n);
                                    t();
                                });
                            })();
                    });
            });
        function c(t) {
            let e;
            try {
                e = i.readdirSync(t);
            } catch (e) {
                return a.mkdirsSync(t);
            }
            e.forEach(e => {
                (e = o.join(t, e)), s.removeSync(e);
            });
        }
        t.exports = {
            emptyDirSync: c,
            emptydirSync: c,
            emptyDir: u,
            emptydir: u,
        };
    },
    function (t, e, n) {
        'use strict';
        const r = n(1),
            i = n(0),
            o = n(15),
            a = 'win32' === process.platform;
        function s(t) {
            ['unlink', 'chmod', 'stat', 'lstat', 'rmdir', 'readdir'].forEach(e => {
                (t[e] = t[e] || r[e]), (t[(e += 'Sync')] = t[e] || r[e]);
            }),
                (t.maxBusyTries = t.maxBusyTries || 3);
        }
        function u(t, e, n) {
            let r = 0;
            'function' == typeof e && ((n = e), (e = {})),
                o(t, 'rimraf: missing path'),
                o.strictEqual(typeof t, 'string', 'rimraf: path should be a string'),
                o.strictEqual(typeof n, 'function', 'rimraf: callback function required'),
                o(e, 'rimraf: invalid options argument provided'),
                o.strictEqual(typeof e, 'object', 'rimraf: options should be object'),
                s(e),
                c(t, e, function i(o) {
                    if (o) {
                        if (
                            ('EBUSY' === o.code || 'ENOTEMPTY' === o.code || 'EPERM' === o.code) &&
                            r < e.maxBusyTries
                        ) {
                            r++;
                            return setTimeout(() => c(t, e, i), 100 * r);
                        }
                        'ENOENT' === o.code && (o = null);
                    }
                    n(o);
                });
        }
        function c(t, e, n) {
            o(t),
                o(e),
                o('function' == typeof n),
                e.lstat(t, (r, i) =>
                    r && 'ENOENT' === r.code
                        ? n(null)
                        : r && 'EPERM' === r.code && a
                          ? f(t, e, r, n)
                          : i && i.isDirectory()
                            ? l(t, e, r, n)
                            : void e.unlink(t, r => {
                                  if (r) {
                                      if ('ENOENT' === r.code) return n(null);
                                      if ('EPERM' === r.code) return a ? f(t, e, r, n) : l(t, e, r, n);
                                      if ('EISDIR' === r.code) return l(t, e, r, n);
                                  }
                                  return n(r);
                              }),
                );
        }
        function f(t, e, n, r) {
            o(t),
                o(e),
                o('function' == typeof r),
                n && o(n instanceof Error),
                e.chmod(t, 438, i => {
                    i
                        ? r('ENOENT' === i.code ? null : n)
                        : e.stat(t, (i, o) => {
                              i ? r('ENOENT' === i.code ? null : n) : o.isDirectory() ? l(t, e, n, r) : e.unlink(t, r);
                          });
                });
        }
        function h(t, e, n) {
            let r;
            o(t), o(e), n && o(n instanceof Error);
            try {
                e.chmodSync(t, 438);
            } catch (t) {
                if ('ENOENT' === t.code) return;
                throw n;
            }
            try {
                r = e.statSync(t);
            } catch (t) {
                if ('ENOENT' === t.code) return;
                throw n;
            }
            r.isDirectory() ? d(t, e, n) : e.unlinkSync(t);
        }
        function l(t, e, n, r) {
            o(t),
                o(e),
                n && o(n instanceof Error),
                o('function' == typeof r),
                e.rmdir(t, a => {
                    !a || ('ENOTEMPTY' !== a.code && 'EEXIST' !== a.code && 'EPERM' !== a.code)
                        ? a && 'ENOTDIR' === a.code
                            ? r(n)
                            : r(a)
                        : (function (t, e, n) {
                              o(t),
                                  o(e),
                                  o('function' == typeof n),
                                  e.readdir(t, (r, o) => {
                                      if (r) return n(r);
                                      let a,
                                          s = o.length;
                                      if (0 === s) return e.rmdir(t, n);
                                      o.forEach(r => {
                                          u(i.join(t, r), e, r => {
                                              if (!a) return r ? n((a = r)) : void (0 == --s && e.rmdir(t, n));
                                          });
                                      });
                                  });
                          })(t, e, r);
                });
        }
        function p(t, e) {
            let n;
            s((e = e || {})),
                o(t, 'rimraf: missing path'),
                o.strictEqual(typeof t, 'string', 'rimraf: path should be a string'),
                o(e, 'rimraf: missing options'),
                o.strictEqual(typeof e, 'object', 'rimraf: options should be object');
            try {
                n = e.lstatSync(t);
            } catch (n) {
                if ('ENOENT' === n.code) return;
                'EPERM' === n.code && a && h(t, e, n);
            }
            try {
                n && n.isDirectory() ? d(t, e, null) : e.unlinkSync(t);
            } catch (n) {
                if ('ENOENT' === n.code) return;
                if ('EPERM' === n.code) return a ? h(t, e, n) : d(t, e, n);
                if ('EISDIR' !== n.code) throw n;
                d(t, e, n);
            }
        }
        function d(t, e, n) {
            o(t), o(e), n && o(n instanceof Error);
            try {
                e.rmdirSync(t);
            } catch (r) {
                if ('ENOTDIR' === r.code) throw n;
                if ('ENOTEMPTY' === r.code || 'EEXIST' === r.code || 'EPERM' === r.code)
                    !(function (t, e) {
                        if ((o(t), o(e), e.readdirSync(t).forEach(n => p(i.join(t, n), e)), !a)) {
                            return e.rmdirSync(t, e);
                        }
                        {
                            const n = Date.now();
                            do {
                                try {
                                    return e.rmdirSync(t, e);
                                } catch (t) {}
                            } while (Date.now() - n < 500);
                        }
                    })(t, e);
                else if ('ENOENT' !== r.code) throw r;
            }
        }
        (t.exports = u), (u.sync = p);
    },
    function (t, e, n) {
        'use strict';
        const r = n(40),
            i = n(41),
            o = n(42);
        t.exports = {
            createFile: r.createFile,
            createFileSync: r.createFileSync,
            ensureFile: r.createFile,
            ensureFileSync: r.createFileSync,
            createLink: i.createLink,
            createLinkSync: i.createLinkSync,
            ensureLink: i.createLink,
            ensureLinkSync: i.createLinkSync,
            createSymlink: o.createSymlink,
            createSymlinkSync: o.createSymlinkSync,
            ensureSymlink: o.createSymlink,
            ensureSymlinkSync: o.createSymlinkSync,
        };
    },
    function (t, e, n) {
        'use strict';
        const r = n(4).fromCallback,
            i = n(0),
            o = n(1),
            a = n(6),
            s = n(7).pathExists;
        t.exports = {
            createFile: r(function (t, e) {
                function n() {
                    o.writeFile(t, '', t => {
                        if (t) return e(t);
                        e();
                    });
                }
                o.stat(t, (r, o) => {
                    if (!r && o.isFile()) return e();
                    const u = i.dirname(t);
                    s(u, (t, r) =>
                        t
                            ? e(t)
                            : r
                              ? n()
                              : void a.mkdirs(u, t => {
                                    if (t) return e(t);
                                    n();
                                }),
                    );
                });
            }),
            createFileSync: function (t) {
                let e;
                try {
                    e = o.statSync(t);
                } catch (t) {}
                if (e && e.isFile()) return;
                const n = i.dirname(t);
                o.existsSync(n) || a.mkdirsSync(n), o.writeFileSync(t, '');
            },
        };
    },
    function (t, e, n) {
        'use strict';
        const r = n(4).fromCallback,
            i = n(0),
            o = n(1),
            a = n(6),
            s = n(7).pathExists;
        t.exports = {
            createLink: r(function (t, e, n) {
                function r(t, e) {
                    o.link(t, e, t => {
                        if (t) return n(t);
                        n(null);
                    });
                }
                s(e, (u, c) =>
                    u
                        ? n(u)
                        : c
                          ? n(null)
                          : void o.lstat(t, o => {
                                if (o) return (o.message = o.message.replace('lstat', 'ensureLink')), n(o);
                                const u = i.dirname(e);
                                s(u, (i, o) =>
                                    i
                                        ? n(i)
                                        : o
                                          ? r(t, e)
                                          : void a.mkdirs(u, i => {
                                                if (i) return n(i);
                                                r(t, e);
                                            }),
                                );
                            }),
                );
            }),
            createLinkSync: function (t, e) {
                if (o.existsSync(e)) return;
                try {
                    o.lstatSync(t);
                } catch (t) {
                    throw ((t.message = t.message.replace('lstat', 'ensureLink')), t);
                }
                const n = i.dirname(e);
                return o.existsSync(n) || a.mkdirsSync(n), o.linkSync(t, e);
            },
        };
    },
    function (t, e, n) {
        'use strict';
        const r = n(4).fromCallback,
            i = n(0),
            o = n(1),
            a = n(6),
            s = a.mkdirs,
            u = a.mkdirsSync,
            c = n(43),
            f = c.symlinkPaths,
            h = c.symlinkPathsSync,
            l = n(44),
            p = l.symlinkType,
            d = l.symlinkTypeSync,
            v = n(7).pathExists;
        t.exports = {
            createSymlink: r(function (t, e, n, r) {
                (r = 'function' == typeof n ? n : r),
                    (n = 'function' != typeof n && n),
                    v(e, (a, u) =>
                        a
                            ? r(a)
                            : u
                              ? r(null)
                              : void f(t, e, (a, u) => {
                                    if (a) return r(a);
                                    (t = u.toDst),
                                        p(u.toCwd, n, (n, a) => {
                                            if (n) return r(n);
                                            const u = i.dirname(e);
                                            v(u, (n, i) =>
                                                n
                                                    ? r(n)
                                                    : i
                                                      ? o.symlink(t, e, a, r)
                                                      : void s(u, n => {
                                                            if (n) return r(n);
                                                            o.symlink(t, e, a, r);
                                                        }),
                                            );
                                        });
                                }),
                    );
            }),
            createSymlinkSync: function (t, e, n) {
                if (o.existsSync(e)) return;
                const r = h(t, e);
                (t = r.toDst), (n = d(r.toCwd, n));
                const a = i.dirname(e);
                return o.existsSync(a) || u(a), o.symlinkSync(t, e, n);
            },
        };
    },
    function (t, e, n) {
        'use strict';
        const r = n(0),
            i = n(1),
            o = n(7).pathExists;
        t.exports = {
            symlinkPaths: function (t, e, n) {
                if (r.isAbsolute(t))
                    return i.lstat(t, e =>
                        e
                            ? ((e.message = e.message.replace('lstat', 'ensureSymlink')), n(e))
                            : n(null, { toCwd: t, toDst: t }),
                    );
                {
                    const a = r.dirname(e),
                        s = r.join(a, t);
                    return o(s, (e, o) =>
                        e
                            ? n(e)
                            : o
                              ? n(null, { toCwd: s, toDst: t })
                              : i.lstat(t, e =>
                                    e
                                        ? ((e.message = e.message.replace('lstat', 'ensureSymlink')), n(e))
                                        : n(null, {
                                              toCwd: t,
                                              toDst: r.relative(a, t),
                                          }),
                                ),
                    );
                }
            },
            symlinkPathsSync: function (t, e) {
                let n;
                if (r.isAbsolute(t)) {
                    if (((n = i.existsSync(t)), !n)) throw new Error('absolute srcpath does not exist');
                    return { toCwd: t, toDst: t };
                }
                {
                    const o = r.dirname(e),
                        a = r.join(o, t);
                    if (((n = i.existsSync(a)), n)) return { toCwd: a, toDst: t };
                    if (((n = i.existsSync(t)), !n)) throw new Error('relative srcpath does not exist');
                    return { toCwd: t, toDst: r.relative(o, t) };
                }
            },
        };
    },
    function (t, e, n) {
        'use strict';
        const r = n(1);
        t.exports = {
            symlinkType: function (t, e, n) {
                if (((n = 'function' == typeof e ? e : n), (e = 'function' != typeof e && e))) return n(null, e);
                r.lstat(t, (t, r) => {
                    if (t) return n(null, 'file');
                    (e = r && r.isDirectory() ? 'dir' : 'file'), n(null, e);
                });
            },
            symlinkTypeSync: function (t, e) {
                let n;
                if (e) return e;
                try {
                    n = r.lstatSync(t);
                } catch (t) {
                    return 'file';
                }
                return n && n.isDirectory() ? 'dir' : 'file';
            },
        };
    },
    function (t, e, n) {
        'use strict';
        const r = n(4).fromCallback,
            i = n(12);
        (i.outputJson = r(n(47))),
            (i.outputJsonSync = n(48)),
            (i.outputJSON = i.outputJson),
            (i.outputJSONSync = i.outputJsonSync),
            (i.writeJSON = i.writeJson),
            (i.writeJSONSync = i.writeJsonSync),
            (i.readJSON = i.readJson),
            (i.readJSONSync = i.readJsonSync),
            (t.exports = i);
    },
    function (t, e, n) {
        var r;
        try {
            r = n(1);
        } catch (t) {
            r = n(3);
        }
        function i(t, e) {
            var n,
                r = '\n';
            return (
                'object' == typeof e && null !== e && (e.spaces && (n = e.spaces), e.EOL && (r = e.EOL)),
                JSON.stringify(t, e ? e.replacer : null, n).replace(/\n/g, r) + r
            );
        }
        function o(t) {
            return Buffer.isBuffer(t) && (t = t.toString('utf8')), (t = t.replace(/^\uFEFF/, ''));
        }
        var a = {
            readFile: function (t, e, n) {
                null == n && ((n = e), (e = {})), 'string' == typeof e && (e = { encoding: e });
                var i = (e = e || {}).fs || r,
                    a = !0;
                'throws' in e && (a = e.throws),
                    i.readFile(t, e, function (r, i) {
                        if (r) return n(r);
                        var s;
                        i = o(i);
                        try {
                            s = JSON.parse(i, e ? e.reviver : null);
                        } catch (e) {
                            return a ? ((e.message = t + ': ' + e.message), n(e)) : n(null, null);
                        }
                        n(null, s);
                    });
            },
            readFileSync: function (t, e) {
                'string' == typeof (e = e || {}) && (e = { encoding: e });
                var n = e.fs || r,
                    i = !0;
                'throws' in e && (i = e.throws);
                try {
                    var a = n.readFileSync(t, e);
                    return (a = o(a)), JSON.parse(a, e.reviver);
                } catch (e) {
                    if (i) throw ((e.message = t + ': ' + e.message), e);
                    return null;
                }
            },
            writeFile: function (t, e, n, o) {
                null == o && ((o = n), (n = {}));
                var a = (n = n || {}).fs || r,
                    s = '';
                try {
                    s = i(e, n);
                } catch (t) {
                    return void (o && o(t, null));
                }
                a.writeFile(t, s, n, o);
            },
            writeFileSync: function (t, e, n) {
                var o = (n = n || {}).fs || r,
                    a = i(e, n);
                return o.writeFileSync(t, a, n);
            },
        };
        t.exports = a;
    },
    function (t, e, n) {
        'use strict';
        const r = n(0),
            i = n(6),
            o = n(7).pathExists,
            a = n(12);
        t.exports = function (t, e, n, s) {
            'function' == typeof n && ((s = n), (n = {}));
            const u = r.dirname(t);
            o(u, (r, o) =>
                r
                    ? s(r)
                    : o
                      ? a.writeJson(t, e, n, s)
                      : void i.mkdirs(u, r => {
                            if (r) return s(r);
                            a.writeJson(t, e, n, s);
                        }),
            );
        };
    },
    function (t, e, n) {
        'use strict';
        const r = n(1),
            i = n(0),
            o = n(6),
            a = n(12);
        t.exports = function (t, e, n) {
            const s = i.dirname(t);
            r.existsSync(s) || o.mkdirsSync(s), a.writeJsonSync(t, e, n);
        };
    },
    function (t, e, n) {
        'use strict';
        t.exports = { moveSync: n(50) };
    },
    function (t, e, n) {
        'use strict';
        const r = n(1),
            i = n(0),
            o = n(16).copySync,
            a = n(9).removeSync,
            s = n(6).mkdirpSync,
            u = n(8);
        function c(t, e, n) {
            try {
                r.renameSync(t, e);
            } catch (r) {
                if ('EXDEV' !== r.code) throw r;
                return (function (t, e, n) {
                    return o(t, e, { overwrite: n, errorOnExist: true }), a(t);
                })(t, e, n);
            }
        }
        t.exports = function (t, e, n) {
            const o = (n = n || {}).overwrite || n.clobber || !1,
                { srcStat: f } = u.checkPathsSync(t, e, 'move');
            return (
                u.checkParentPathsSync(t, f, e, 'move'),
                s(i.dirname(e)),
                (function (t, e, n) {
                    if (n) return a(e), c(t, e, n);
                    if (r.existsSync(e)) throw new Error('dest already exists.');
                    return c(t, e, n);
                })(t, e, o)
            );
        };
    },
    function (t, e, n) {
        'use strict';
        const r = n(4).fromCallback;
        t.exports = { move: r(n(52)) };
    },
    function (t, e, n) {
        'use strict';
        const r = n(1),
            i = n(0),
            o = n(19).copy,
            a = n(9).remove,
            s = n(6).mkdirp,
            u = n(7).pathExists,
            c = n(8);
        function f(t, e, n, i) {
            r.rename(t, e, r =>
                r
                    ? 'EXDEV' !== r.code
                        ? i(r)
                        : (function (t, e, n, r) {
                              o(t, e, { overwrite: n, errorOnExist: !0 }, e => (e ? r(e) : a(t, r)));
                          })(t, e, n, i)
                    : i(),
            );
        }
        t.exports = function (t, e, n, r) {
            'function' == typeof n && ((r = n), (n = {}));
            const o = n.overwrite || n.clobber || !1;
            c.checkPaths(t, e, 'move', (n, h) => {
                if (n) return r(n);
                const { srcStat: l } = h;
                c.checkParentPaths(t, l, e, 'move', n => {
                    if (n) return r(n);
                    s(i.dirname(e), n =>
                        n
                            ? r(n)
                            : (function (t, e, n, r) {
                                  if (n) return a(e, i => (i ? r(i) : f(t, e, n, r)));
                                  u(e, (i, o) => (i ? r(i) : o ? r(new Error('dest already exists.')) : f(t, e, n, r)));
                              })(t, e, o, r),
                    );
                });
            });
        };
    },
    function (t, e, n) {
        'use strict';
        const r = n(4).fromCallback,
            i = n(1),
            o = n(0),
            a = n(6),
            s = n(7).pathExists;
        t.exports = {
            outputFile: r(function (t, e, n, r) {
                'function' == typeof n && ((r = n), (n = 'utf8'));
                const u = o.dirname(t);
                s(u, (o, s) =>
                    o
                        ? r(o)
                        : s
                          ? i.writeFile(t, e, n, r)
                          : void a.mkdirs(u, o => {
                                if (o) return r(o);
                                i.writeFile(t, e, n, r);
                            }),
                );
            }),
            outputFileSync: function (t, ...e) {
                const n = o.dirname(t);
                if (i.existsSync(n)) return i.writeFileSync(t, ...e);
                a.mkdirsSync(n), i.writeFileSync(t, ...e);
            },
        };
    },
    function (t, e, n) {
        'use strict';
        var r = n(2),
            i = n(56),
            o = n(21),
            a = n(62),
            s = n(66),
            u = /^(Version )?(\d+[.]\d+)$/i;
        t.exports = function (t, e) {
            var n = new s.Font(),
                c = a.load(t);
            (e = e || {}),
                (n.id = e.id || c.id),
                (n.familyName = e.familyname || c.familyName || c.id),
                (n.copyright = e.copyright || c.metadata),
                (n.description = e.description || 'Generated by svg2ttf from Fontello project.'),
                (n.url = e.url || 'http://fontello.com'),
                n.sfntNames.push({
                    id: 2,
                    value: e.subfamilyname || c.subfamilyName || 'Regular',
                }),
                n.sfntNames.push({ id: 4, value: e.fullname || c.id });
            var f = e.version || 'Version 1.0';
            if ('string' != typeof f) throw new Error('svg2ttf: version option should be a string');
            if (!u.test(f)) throw new Error('svg2ttf: invalid option, version - "' + e.version + '"');
            (f = 'Version ' + f.match(u)[2]),
                n.sfntNames.push({ id: 5, value: f }),
                n.sfntNames.push({
                    id: 6,
                    value: (e.fullname || c.id).replace(/[\s\(\)\[\]<>%\/]/g, '').substr(0, 62),
                }),
                void 0 !== e.ts && (n.createdDate = n.modifiedDate = new Date(1e3 * parseInt(e.ts, 10))),
                (n.unitsPerEm = c.unitsPerEm || 1e3),
                (n.horizOriginX = c.horizOriginX || 0),
                (n.horizOriginY = c.horizOriginY || 0),
                (n.vertOriginX = c.vertOriginX || 0),
                (n.vertOriginY = c.vertOriginY || 0),
                (n.width = c.width || c.unitsPerEm),
                (n.height = c.height || c.unitsPerEm),
                (n.descent = isNaN(c.descent) ? -n.vertOriginY : c.descent),
                (n.ascent = c.ascent || n.unitsPerEm - n.vertOriginY),
                void 0 !== c.underlinePosition && (n.underlinePosition = c.underlinePosition),
                void 0 !== c.underlineThickness && (n.underlineThickness = c.underlineThickness);
            var h,
                l = n.glyphs,
                p = n.codePoints,
                d = n.ligatures;
            function v(t, e) {
                return !p[t] && ((p[t] = e), !0);
            }
            r.forEach(c.glyphs, function (t) {
                var e = new s.Glyph();
                (e.name = t.name),
                    (e.d = t.d),
                    (e.height = isNaN(t.height) ? n.height : t.height),
                    (e.width = isNaN(t.width) ? n.width : t.width),
                    l.push(e),
                    (t.sfntGlyph = e),
                    r.forEach(t.unicode, function (t) {
                        v(t, e);
                    });
            }),
                c.missingGlyph
                    ? (((h = new s.Glyph()).d = c.missingGlyph.d),
                      (h.height = isNaN(c.missingGlyph.height) ? n.height : c.missingGlyph.height),
                      (h.width = isNaN(c.missingGlyph.width) ? n.width : c.missingGlyph.width))
                    : (h = r.find(l, function (t) {
                          return '.notdef' === t.name;
                      })),
                h || (h = new s.Glyph()),
                r.forEach(c.ligatures, function (t) {
                    var e = {
                        ligature: t.ligature,
                        unicode: t.unicode,
                        glyph: t.glyph.sfntGlyph,
                    };
                    r.forEach(e.unicode, function (t) {
                        var e = new s.Glyph();
                        v(t, e) && ((e.name = o.encode([t])), l.push(e));
                    }),
                        d.push(e);
                }),
                -1 !== l.indexOf(h) && l.splice(l.indexOf(h), 1),
                l.unshift(h);
            var m = 0;
            return (
                r.forEach(l, function (t) {
                    (t.id = m), m++;
                }),
                r.forEach(l, function (t) {
                    var e = Math.max(t.width, t.height),
                        n = e > 500 ? 0.3 : 6e-4 * e,
                        o = new i(t.d)
                            .abs()
                            .unshort()
                            .unarc()
                            .iterate(function (t, e, r, i) {
                                return a.cubicToQuad(t, e, r, i, n);
                            }),
                        u = a.toSfntCoutours(o);
                    t.contours = r.map(u, function (t) {
                        var e = new s.Contour();
                        return (
                            (e.points = r.map(t, function (t) {
                                var e = new s.Point();
                                return (e.x = t.x), (e.y = t.y), (e.onCurve = t.onCurve), e;
                            })),
                            e
                        );
                    });
                }),
                s.toTTF(n)
            );
        };
    },
    function (t, e) {
        t.exports = function (t) {
            return (
                t.webpackPolyfill ||
                    ((t.deprecate = function () {}),
                    (t.paths = []),
                    t.children || (t.children = []),
                    Object.defineProperty(t, 'loaded', {
                        enumerable: !0,
                        get: function () {
                            return t.l;
                        },
                    }),
                    Object.defineProperty(t, 'id', {
                        enumerable: !0,
                        get: function () {
                            return t.i;
                        },
                    }),
                    (t.webpackPolyfill = 1)),
                t
            );
        };
    },
    function (t, e, n) {
        'use strict';
        t.exports = n(57);
    },
    function (t, e, n) {
        'use strict';
        var r = n(58),
            i = n(59),
            o = n(20),
            a = n(60),
            s = n(61);
        function u(t) {
            if (!(this instanceof u)) return new u(t);
            var e = r(t);
            (this.segments = e.segments), (this.err = e.err), (this.__stack = []);
        }
        (u.from = function (t) {
            if ('string' == typeof t) return new u(t);
            if (t instanceof u) {
                var e = new u('');
                return (
                    (e.err = t.err),
                    (e.segments = t.segments.map(function (t) {
                        return t.slice();
                    })),
                    (e.__stack = t.__stack.map(function (t) {
                        return o().matrix(t.toArray());
                    })),
                    e
                );
            }
            throw new Error('SvgPath.from: invalid param type ' + t);
        }),
            (u.prototype.__matrix = function (t) {
                var e,
                    n = this;
                t.queue.length &&
                    this.iterate(function (r, i, o, a) {
                        var u, c, f, h;
                        switch (r[0]) {
                            case 'v':
                                c = 0 === (u = t.calc(0, r[1], !0))[0] ? ['v', u[1]] : ['l', u[0], u[1]];
                                break;
                            case 'V':
                                c =
                                    (u = t.calc(o, r[1], !1))[0] === t.calc(o, a, !1)[0]
                                        ? ['V', u[1]]
                                        : ['L', u[0], u[1]];
                                break;
                            case 'h':
                                c = 0 === (u = t.calc(r[1], 0, !0))[1] ? ['h', u[0]] : ['l', u[0], u[1]];
                                break;
                            case 'H':
                                c =
                                    (u = t.calc(r[1], a, !1))[1] === t.calc(o, a, !1)[1]
                                        ? ['H', u[0]]
                                        : ['L', u[0], u[1]];
                                break;
                            case 'a':
                            case 'A':
                                var l = t.toArray(),
                                    p = s(r[1], r[2], r[3]).transform(l);
                                if (
                                    (l[0] * l[3] - l[1] * l[2] < 0 && (r[5] = r[5] ? '0' : '1'),
                                    (u = t.calc(r[6], r[7], 'a' === r[0])),
                                    ('A' === r[0] && r[6] === o && r[7] === a) ||
                                        ('a' === r[0] && 0 === r[6] && 0 === r[7]))
                                ) {
                                    c = ['a' === r[0] ? 'l' : 'L', u[0], u[1]];
                                    break;
                                }
                                c = p.isDegenerate()
                                    ? ['a' === r[0] ? 'l' : 'L', u[0], u[1]]
                                    : [r[0], p.rx, p.ry, p.ax, r[4], r[5], u[0], u[1]];
                                break;
                            case 'm':
                                (h = i > 0), (c = ['m', (u = t.calc(r[1], r[2], h))[0], u[1]]);
                                break;
                            default:
                                for (c = [(f = r[0])], h = f.toLowerCase() === f, e = 1; e < r.length; e += 2)
                                    (u = t.calc(r[e], r[e + 1], h)), c.push(u[0], u[1]);
                        }
                        n.segments[i] = c;
                    }, !0);
            }),
            (u.prototype.__evaluateStack = function () {
                var t, e;
                if (this.__stack.length) {
                    if (1 === this.__stack.length) return this.__matrix(this.__stack[0]), void (this.__stack = []);
                    for (t = o(), e = this.__stack.length; --e >= 0; ) t.matrix(this.__stack[e].toArray());
                    this.__matrix(t), (this.__stack = []);
                }
            }),
            (u.prototype.toString = function () {
                var t,
                    e,
                    n = [];
                this.__evaluateStack();
                for (var r = 0; r < this.segments.length; r++)
                    (e = this.segments[r][0]),
                        (t = r > 0 && 'm' !== e && 'M' !== e && e === this.segments[r - 1][0]),
                        (n = n.concat(t ? this.segments[r].slice(1) : this.segments[r]));
                return n
                    .join(' ')
                    .replace(/ ?([achlmqrstvz]) ?/gi, '$1')
                    .replace(/ \-/g, '-')
                    .replace(/zm/g, 'z m');
            }),
            (u.prototype.translate = function (t, e) {
                return this.__stack.push(o().translate(t, e || 0)), this;
            }),
            (u.prototype.scale = function (t, e) {
                return this.__stack.push(o().scale(t, e || 0 === e ? e : t)), this;
            }),
            (u.prototype.rotate = function (t, e, n) {
                return this.__stack.push(o().rotate(t, e || 0, n || 0)), this;
            }),
            (u.prototype.skewX = function (t) {
                return this.__stack.push(o().skewX(t)), this;
            }),
            (u.prototype.skewY = function (t) {
                return this.__stack.push(o().skewY(t)), this;
            }),
            (u.prototype.matrix = function (t) {
                return this.__stack.push(o().matrix(t)), this;
            }),
            (u.prototype.transform = function (t) {
                return t.trim() ? (this.__stack.push(i(t)), this) : this;
            }),
            (u.prototype.round = function (t) {
                var e,
                    n = 0,
                    r = 0,
                    i = 0,
                    o = 0;
                return (
                    (t = t || 0),
                    this.__evaluateStack(),
                    this.segments.forEach(function (a) {
                        var s = a[0].toLowerCase() === a[0];
                        switch (a[0]) {
                            case 'H':
                            case 'h':
                                return s && (a[1] += i), (i = a[1] - a[1].toFixed(t)), void (a[1] = +a[1].toFixed(t));
                            case 'V':
                            case 'v':
                                return s && (a[1] += o), (o = a[1] - a[1].toFixed(t)), void (a[1] = +a[1].toFixed(t));
                            case 'Z':
                            case 'z':
                                return (i = n), void (o = r);
                            case 'M':
                            case 'm':
                                return (
                                    s && ((a[1] += i), (a[2] += o)),
                                    (i = a[1] - a[1].toFixed(t)),
                                    (o = a[2] - a[2].toFixed(t)),
                                    (n = i),
                                    (r = o),
                                    (a[1] = +a[1].toFixed(t)),
                                    void (a[2] = +a[2].toFixed(t))
                                );
                            case 'A':
                            case 'a':
                                return (
                                    s && ((a[6] += i), (a[7] += o)),
                                    (i = a[6] - a[6].toFixed(t)),
                                    (o = a[7] - a[7].toFixed(t)),
                                    (a[1] = +a[1].toFixed(t)),
                                    (a[2] = +a[2].toFixed(t)),
                                    (a[3] = +a[3].toFixed(t + 2)),
                                    (a[6] = +a[6].toFixed(t)),
                                    void (a[7] = +a[7].toFixed(t))
                                );
                            default:
                                return (
                                    (e = a.length),
                                    s && ((a[e - 2] += i), (a[e - 1] += o)),
                                    (i = a[e - 2] - a[e - 2].toFixed(t)),
                                    (o = a[e - 1] - a[e - 1].toFixed(t)),
                                    void a.forEach(function (e, n) {
                                        n && (a[n] = +a[n].toFixed(t));
                                    })
                                );
                        }
                    }),
                    this
                );
            }),
            (u.prototype.iterate = function (t, e) {
                var n,
                    r,
                    i,
                    o = this.segments,
                    a = {},
                    s = !1,
                    u = 0,
                    c = 0,
                    f = 0,
                    h = 0;
                if (
                    (e || this.__evaluateStack(),
                    o.forEach(function (e, n) {
                        var r = t(e, n, u, c);
                        Array.isArray(r) && ((a[n] = r), (s = !0));
                        var i = e[0] === e[0].toLowerCase();
                        switch (e[0]) {
                            case 'm':
                            case 'M':
                                return (u = e[1] + (i ? u : 0)), (c = e[2] + (i ? c : 0)), (f = u), void (h = c);
                            case 'h':
                            case 'H':
                                return void (u = e[1] + (i ? u : 0));
                            case 'v':
                            case 'V':
                                return void (c = e[1] + (i ? c : 0));
                            case 'z':
                            case 'Z':
                                return (u = f), void (c = h);
                            default:
                                (u = e[e.length - 2] + (i ? u : 0)), (c = e[e.length - 1] + (i ? c : 0));
                        }
                    }),
                    !s)
                )
                    return this;
                for (i = [], n = 0; n < o.length; n++)
                    if (void 0 !== a[n]) for (r = 0; r < a[n].length; r++) i.push(a[n][r]);
                    else i.push(o[n]);
                return (this.segments = i), this;
            }),
            (u.prototype.abs = function () {
                return (
                    this.iterate(function (t, e, n, r) {
                        var i,
                            o = t[0],
                            a = o.toUpperCase();
                        if (o !== a)
                            switch (((t[0] = a), o)) {
                                case 'v':
                                    return void (t[1] += r);
                                case 'a':
                                    return (t[6] += n), void (t[7] += r);
                                default:
                                    for (i = 1; i < t.length; i++) t[i] += i % 2 ? n : r;
                            }
                    }, !0),
                    this
                );
            }),
            (u.prototype.rel = function () {
                return (
                    this.iterate(function (t, e, n, r) {
                        var i,
                            o = t[0],
                            a = o.toLowerCase();
                        if (o !== a && (0 !== e || 'M' !== o))
                            switch (((t[0] = a), o)) {
                                case 'V':
                                    return void (t[1] -= r);
                                case 'A':
                                    return (t[6] -= n), void (t[7] -= r);
                                default:
                                    for (i = 1; i < t.length; i++) t[i] -= i % 2 ? n : r;
                            }
                    }, !0),
                    this
                );
            }),
            (u.prototype.unarc = function () {
                return (
                    this.iterate(function (t, e, n, r) {
                        var i,
                            o,
                            s,
                            u = [],
                            c = t[0];
                        return 'A' !== c && 'a' !== c
                            ? null
                            : ('a' === c ? ((o = n + t[6]), (s = r + t[7])) : ((o = t[6]), (s = t[7])),
                              0 === (i = a(n, r, o, s, t[4], t[5], t[1], t[2], t[3])).length
                                  ? [['a' === t[0] ? 'l' : 'L', t[6], t[7]]]
                                  : (i.forEach(function (t) {
                                        u.push(['C', t[2], t[3], t[4], t[5], t[6], t[7]]);
                                    }),
                                    u));
                    }),
                    this
                );
            }),
            (u.prototype.unshort = function () {
                var t,
                    e,
                    n,
                    r,
                    i,
                    o = this.segments;
                return (
                    this.iterate(function (a, s, u, c) {
                        var f,
                            h = a[0],
                            l = h.toUpperCase();
                        s &&
                            ('T' === l
                                ? ((f = 't' === h),
                                  'Q' === (n = o[s - 1])[0]
                                      ? ((t = n[1] - u), (e = n[2] - c))
                                      : 'q' === n[0]
                                        ? ((t = n[1] - n[3]), (e = n[2] - n[4]))
                                        : ((t = 0), (e = 0)),
                                  (r = -t),
                                  (i = -e),
                                  f || ((r += u), (i += c)),
                                  (o[s] = [f ? 'q' : 'Q', r, i, a[1], a[2]]))
                                : 'S' === l &&
                                  ((f = 's' === h),
                                  'C' === (n = o[s - 1])[0]
                                      ? ((t = n[3] - u), (e = n[4] - c))
                                      : 'c' === n[0]
                                        ? ((t = n[3] - n[5]), (e = n[4] - n[6]))
                                        : ((t = 0), (e = 0)),
                                  (r = -t),
                                  (i = -e),
                                  f || ((r += u), (i += c)),
                                  (o[s] = [f ? 'c' : 'C', r, i, a[1], a[2], a[3], a[4]])));
                    }),
                    this
                );
            }),
            (t.exports = u);
    },
    function (t, e, n) {
        'use strict';
        var r = {
                a: 7,
                c: 6,
                h: 1,
                l: 2,
                m: 2,
                r: 4,
                q: 4,
                s: 4,
                t: 2,
                v: 1,
                z: 0,
            },
            i = [
                5760, 6158, 8192, 8193, 8194, 8195, 8196, 8197, 8198, 8199, 8200, 8201, 8202, 8239, 8287, 12288, 65279,
            ];
        function o(t) {
            return t >= 48 && t <= 57;
        }
        function a(t) {
            return (t >= 48 && t <= 57) || 43 === t || 45 === t || 46 === t;
        }
        function s(t) {
            (this.index = 0),
                (this.path = t),
                (this.max = t.length),
                (this.result = []),
                (this.param = 0),
                (this.err = ''),
                (this.segmentStart = 0),
                (this.data = []);
        }
        function u(t) {
            for (
                ;
                t.index < t.max &&
                (10 === (e = t.path.charCodeAt(t.index)) ||
                    13 === e ||
                    8232 === e ||
                    8233 === e ||
                    32 === e ||
                    9 === e ||
                    11 === e ||
                    12 === e ||
                    160 === e ||
                    (e >= 5760 && i.indexOf(e) >= 0));

            )
                t.index++;
            var e;
        }
        function c(t) {
            var e = t.path.charCodeAt(t.index);
            return 48 === e
                ? ((t.param = 0), void t.index++)
                : 49 === e
                  ? ((t.param = 1), void t.index++)
                  : void (t.err = 'SvgPath: arc flag can be 0 or 1 only (at pos ' + t.index + ')');
        }
        function f(t) {
            var e,
                n = t.index,
                r = n,
                i = t.max,
                a = !1,
                s = !1,
                u = !1,
                c = !1;
            if (r >= i) t.err = 'SvgPath: missed param (at pos ' + r + ')';
            else if (
                ((43 !== (e = t.path.charCodeAt(r)) && 45 !== e) || (e = ++r < i ? t.path.charCodeAt(r) : 0),
                o(e) || 46 === e)
            ) {
                if (46 !== e) {
                    if (((a = 48 === e), (e = ++r < i ? t.path.charCodeAt(r) : 0), a && r < i && e && o(e)))
                        return void (t.err =
                            'SvgPath: numbers started with `0` such as `09` are illegal (at pos ' + n + ')');
                    for (; r < i && o(t.path.charCodeAt(r)); ) r++, (s = !0);
                    e = r < i ? t.path.charCodeAt(r) : 0;
                }
                if (46 === e) {
                    for (c = !0, r++; o(t.path.charCodeAt(r)); ) r++, (u = !0);
                    e = r < i ? t.path.charCodeAt(r) : 0;
                }
                if (101 === e || 69 === e) {
                    if (c && !s && !u) return void (t.err = 'SvgPath: invalid float exponent (at pos ' + r + ')');
                    if (
                        ((43 !== (e = ++r < i ? t.path.charCodeAt(r) : 0) && 45 !== e) || r++,
                        !(r < i && o(t.path.charCodeAt(r))))
                    )
                        return void (t.err = 'SvgPath: invalid float exponent (at pos ' + r + ')');
                    for (; r < i && o(t.path.charCodeAt(r)); ) r++;
                }
                (t.index = r), (t.param = parseFloat(t.path.slice(n, r)) + 0);
            } else t.err = 'SvgPath: param should start with 0..9 or `.` (at pos ' + r + ')';
        }
        function h(t) {
            var e, n;
            n = (e = t.path[t.segmentStart]).toLowerCase();
            var i = t.data;
            if (
                ('m' === n &&
                    i.length > 2 &&
                    (t.result.push([e, i[0], i[1]]), (i = i.slice(2)), (n = 'l'), (e = 'm' === e ? 'l' : 'L')),
                'r' === n)
            )
                t.result.push([e].concat(i));
            else for (; i.length >= r[n] && (t.result.push([e].concat(i.splice(0, r[n]))), r[n]); );
        }
        function l(t) {
            var e,
                n,
                i,
                o,
                s,
                l = t.max;
            if (
                ((t.segmentStart = t.index),
                (e = t.path.charCodeAt(t.index)),
                (n = 97 == (32 | e)),
                (function (t) {
                    switch (32 | t) {
                        case 109:
                        case 122:
                        case 108:
                        case 104:
                        case 118:
                        case 99:
                        case 115:
                        case 113:
                        case 116:
                        case 97:
                        case 114:
                            return !0;
                    }
                    return !1;
                })(e))
            )
                if (((o = r[t.path[t.index].toLowerCase()]), t.index++, u(t), (t.data = []), o)) {
                    for (i = !1; ; ) {
                        for (s = o; s > 0; s--) {
                            if ((!n || (3 !== s && 4 !== s) ? f(t) : c(t), t.err.length)) return;
                            t.data.push(t.param),
                                u(t),
                                (i = !1),
                                t.index < l && 44 === t.path.charCodeAt(t.index) && (t.index++, u(t), (i = !0));
                        }
                        if (!i) {
                            if (t.index >= t.max) break;
                            if (!a(t.path.charCodeAt(t.index))) break;
                        }
                    }
                    h(t);
                } else h(t);
            else t.err = 'SvgPath: bad command ' + t.path[t.index] + ' (at pos ' + t.index + ')';
        }
        t.exports = function (t) {
            var e = new s(t),
                n = e.max;
            for (u(e); e.index < n && !e.err.length; ) l(e);
            return (
                e.err.length
                    ? (e.result = [])
                    : e.result.length &&
                      ('mM'.indexOf(e.result[0][0]) < 0
                          ? ((e.err = 'SvgPath: string should start with `M` or `m`'), (e.result = []))
                          : (e.result[0][0] = 'M')),
                { err: e.err, segments: e.result }
            );
        };
    },
    function (t, e, n) {
        'use strict';
        var r = n(20),
            i = {
                matrix: !0,
                scale: !0,
                rotate: !0,
                translate: !0,
                skewX: !0,
                skewY: !0,
            },
            o = /\s*(matrix|translate|scale|rotate|skewX|skewY)\s*\(\s*(.+?)\s*\)[\s,]*/,
            a = /[\s,]+/;
        t.exports = function (t) {
            var e,
                n,
                s = new r();
            return (
                t.split(o).forEach(function (t) {
                    if (t.length)
                        if (void 0 === i[t])
                            switch (
                                ((n = t.split(a).map(function (t) {
                                    return +t || 0;
                                })),
                                e)
                            ) {
                                case 'matrix':
                                    return void (6 === n.length && s.matrix(n));
                                case 'scale':
                                    return void (1 === n.length
                                        ? s.scale(n[0], n[0])
                                        : 2 === n.length && s.scale(n[0], n[1]));
                                case 'rotate':
                                    return void (1 === n.length
                                        ? s.rotate(n[0], 0, 0)
                                        : 3 === n.length && s.rotate(n[0], n[1], n[2]));
                                case 'translate':
                                    return void (1 === n.length
                                        ? s.translate(n[0], 0)
                                        : 2 === n.length && s.translate(n[0], n[1]));
                                case 'skewX':
                                    return void (1 === n.length && s.skewX(n[0]));
                                case 'skewY':
                                    return void (1 === n.length && s.skewY(n[0]));
                            }
                        else e = t;
                }),
                s
            );
        };
    },
    function (t, e, n) {
        'use strict';
        var r = 2 * Math.PI;
        function i(t, e, n, r) {
            var i = t * n + e * r;
            return i > 1 && (i = 1), i < -1 && (i = -1), (t * r - e * n < 0 ? -1 : 1) * Math.acos(i);
        }
        function o(t, e) {
            var n = (4 / 3) * Math.tan(e / 4),
                r = Math.cos(t),
                i = Math.sin(t),
                o = Math.cos(t + e),
                a = Math.sin(t + e);
            return [r, i, r - i * n, i + r * n, o + a * n, a - o * n, o, a];
        }
        t.exports = function (t, e, n, a, s, u, c, f, h) {
            var l = Math.sin((h * r) / 360),
                p = Math.cos((h * r) / 360),
                d = (p * (t - n)) / 2 + (l * (e - a)) / 2,
                v = (-l * (t - n)) / 2 + (p * (e - a)) / 2;
            if (0 === d && 0 === v) return [];
            if (0 === c || 0 === f) return [];
            (c = Math.abs(c)), (f = Math.abs(f));
            var m = (d * d) / (c * c) + (v * v) / (f * f);
            m > 1 && ((c *= Math.sqrt(m)), (f *= Math.sqrt(m)));
            var y = (function (t, e, n, o, a, s, u, c, f, h) {
                    var l = (h * (t - n)) / 2 + (f * (e - o)) / 2,
                        p = (-f * (t - n)) / 2 + (h * (e - o)) / 2,
                        d = u * u,
                        v = c * c,
                        m = l * l,
                        y = p * p,
                        g = d * v - d * y - v * m;
                    g < 0 && (g = 0), (g /= d * y + v * m);
                    var _ = (((g = Math.sqrt(g) * (a === s ? -1 : 1)) * u) / c) * p,
                        w = ((g * -c) / u) * l,
                        b = h * _ - f * w + (t + n) / 2,
                        x = f * _ + h * w + (e + o) / 2,
                        E = (l - _) / u,
                        S = (p - w) / c,
                        T = (-l - _) / u,
                        N = (-p - w) / c,
                        O = i(1, 0, E, S),
                        A = i(E, S, T, N);
                    return 0 === s && A > 0 && (A -= r), 1 === s && A < 0 && (A += r), [b, x, O, A];
                })(t, e, n, a, s, u, c, f, l, p),
                g = [],
                _ = y[2],
                w = y[3],
                b = Math.max(Math.ceil(Math.abs(w) / (r / 4)), 1);
            w /= b;
            for (var x = 0; x < b; x++) g.push(o(_, w)), (_ += w);
            return g.map(function (t) {
                for (var e = 0; e < t.length; e += 2) {
                    var n = t[e + 0],
                        r = t[e + 1],
                        i = p * (n *= c) - l * (r *= f),
                        o = l * n + p * r;
                    (t[e + 0] = i + y[0]), (t[e + 1] = o + y[1]);
                }
                return t;
            });
        };
    },
    function (t, e, n) {
        'use strict';
        var r = Math.PI / 180;
        function i(t, e, n) {
            if (!(this instanceof i)) return new i(t, e, n);
            (this.rx = t), (this.ry = e), (this.ax = n);
        }
        (i.prototype.transform = function (t) {
            var e = Math.cos(this.ax * r),
                n = Math.sin(this.ax * r),
                i = [
                    this.rx * (t[0] * e + t[2] * n),
                    this.rx * (t[1] * e + t[3] * n),
                    this.ry * (-t[0] * n + t[2] * e),
                    this.ry * (-t[1] * n + t[3] * e),
                ],
                o = i[0] * i[0] + i[2] * i[2],
                a = i[1] * i[1] + i[3] * i[3],
                s =
                    ((i[0] - i[3]) * (i[0] - i[3]) + (i[2] + i[1]) * (i[2] + i[1])) *
                    ((i[0] + i[3]) * (i[0] + i[3]) + (i[2] - i[1]) * (i[2] - i[1])),
                u = (o + a) / 2;
            if (s < 1e-10 * u) return (this.rx = this.ry = Math.sqrt(u)), (this.ax = 0), this;
            var c = i[0] * i[1] + i[2] * i[3],
                f = u + (s = Math.sqrt(s)) / 2,
                h = u - s / 2;
            return (
                (this.ax =
                    Math.abs(c) < 1e-10 && Math.abs(f - a) < 1e-10
                        ? 90
                        : (180 * Math.atan(Math.abs(c) > Math.abs(f - a) ? (f - o) / c : c / (f - a))) / Math.PI),
                this.ax >= 0
                    ? ((this.rx = Math.sqrt(f)), (this.ry = Math.sqrt(h)))
                    : ((this.ax += 90), (this.rx = Math.sqrt(h)), (this.ry = Math.sqrt(f))),
                this
            );
        }),
            (i.prototype.isDegenerate = function () {
                return this.rx < 1e-10 * this.ry || this.ry < 1e-10 * this.rx;
            }),
            (t.exports = i);
    },
    function (t, e, n) {
        'use strict';
        var r = n(2),
            i = n(63),
            o = n(64).DOMParser,
            a = n(21);
        (t.exports.load = function (t) {
            var e,
                n,
                i,
                s,
                u = new o().parseFromString(t, 'application/xml');
            if (((n = u.getElementsByTagName('metadata')[0]), !(i = u.getElementsByTagName('font')[0])))
                throw new Error("Can't find <font> tag. Make sure you SVG file is font, not image.");
            var c = (s = i.getElementsByTagName('font-face')[0]).getAttribute('font-family') || 'fontello',
                f = s.getAttribute('font-style') || 'Regular',
                h = {
                    id: i.getAttribute('id') || (c + '-' + f).replace(/[\s\(\)\[\]<>%\/]/g, '').substr(0, 62),
                    familyName: c,
                    subfamilyName: f,
                    stretch: s.getAttribute('font-stretch') || 'normal',
                };
            n && n.textContent && (h.metadata = n.textContent),
                (e = {
                    width: 'horiz-adv-x',
                    horizOriginX: 'horiz-origin-x',
                    horizOriginY: 'horiz-origin-y',
                    vertOriginX: 'vert-origin-x',
                    vertOriginY: 'vert-origin-y',
                }),
                r.forEach(e, function (t, e) {
                    i.hasAttribute(t) && (h[e] = parseInt(i.getAttribute(t), 10));
                }),
                (e = {
                    ascent: 'ascent',
                    descent: 'descent',
                    unitsPerEm: 'units-per-em',
                    underlineThickness: 'underline-thickness',
                    underlinePosition: 'underline-position',
                }),
                r.forEach(e, function (t, e) {
                    s.hasAttribute(t) && (h[e] = parseInt(s.getAttribute(t), 10));
                }),
                s.hasAttribute('font-weight') && (h.weightClass = s.getAttribute('font-weight'));
            var l = i.getElementsByTagName('missing-glyph')[0];
            l &&
                ((h.missingGlyph = {}),
                (h.missingGlyph.d = l.getAttribute('d') || ''),
                l.getAttribute('horiz-adv-x') && (h.missingGlyph.width = parseInt(l.getAttribute('horiz-adv-x'), 10)));
            var p = [],
                d = [];
            return (
                r.forEach(i.getElementsByTagName('glyph'), function (t) {
                    var e = (function (t) {
                        var e = {};
                        if (((e.d = t.getAttribute('d').trim()), (e.unicode = []), t.getAttribute('unicode'))) {
                            e.character = t.getAttribute('unicode');
                            var n = a.decode(e.character);
                            n.length > 1 ? ((e.ligature = e.character), (e.ligatureCodes = n)) : e.unicode.push(n[0]);
                        }
                        return (
                            (e.name = t.getAttribute('glyph-name')),
                            t.getAttribute('horiz-adv-x') && (e.width = parseInt(t.getAttribute('horiz-adv-x'), 10)),
                            e
                        );
                    })(t);
                    r.has(e, 'ligature') &&
                        d.push({
                            ligature: e.ligature,
                            unicode: e.ligatureCodes,
                            glyph: e,
                        }),
                        p.push(e);
                }),
                (p = (function (t, e) {
                    var n = [];
                    return (
                        r.forEach(t, function (t) {
                            var e = r.find(n, { width: t.width, d: t.d });
                            e ? ((e.unicode = e.unicode.concat(t.unicode)), (t.canonical = e)) : n.push(t);
                        }),
                        r.forEach(e, function (t) {
                            for (; r.has(t.glyph, 'canonical'); ) t.glyph = t.glyph.canonical;
                        }),
                        n
                    );
                })(p, d)),
                (h.glyphs = p),
                (h.ligatures = d),
                h
            );
        }),
            (t.exports.cubicToQuad = function (t, e, n, r, o) {
                if ('C' === t[0]) {
                    for (var a = i(n, r, t[1], t[2], t[3], t[4], t[5], t[6], o), s = [], u = 2; u < a.length; u += 4)
                        s.push(['Q', a[u], a[u + 1], a[u + 2], a[u + 3]]);
                    return s;
                }
            }),
            (t.exports.toSfntCoutours = function (t) {
                var e = [],
                    n = [];
                return (
                    t.iterate(function (t, r, i, o) {
                        (0 !== r && 'M' !== t[0]) || ((n = []), e.push(n));
                        var a = t[0];
                        'Q' === a && n.push({ x: t[1], y: t[2], onCurve: !1 }),
                            'H' === a
                                ? n.push({ x: t[1], y: o, onCurve: !0 })
                                : 'V' === a
                                  ? n.push({ x: i, y: t[1], onCurve: !0 })
                                  : 'Z' !== a &&
                                    n.push({
                                        x: t[t.length - 2],
                                        y: t[t.length - 1],
                                        onCurve: !0,
                                    });
                    }),
                    e
                );
            });
    },
    function (t, e, n) {
        'use strict';
        function r(t, e) {
            (this.x = t), (this.y = e);
        }
        function i(t, e, n, r) {
            return [r.sub(t).add(e.sub(n).mul(3)), t.add(n).mul(3).sub(e.mul(6)), e.sub(t).mul(3), t];
        }
        function o(t, e, n, r, i) {
            return t.mul(i).add(e).mul(i).add(n).mul(i).add(r);
        }
        function a(t, e, n, r) {
            return t.mul(r).add(e).mul(r).add(n);
        }
        function s(t, e, n, r, i) {
            return t
                .mul(3 * i)
                .add(e.mul(2))
                .mul(i)
                .add(n);
        }
        function u(t, e, n) {
            if (0 === t) return 0 === e ? [] : [-n / e];
            var r = e * e - 4 * t * n;
            if (r < 0) return [];
            if (0 === r) return [-e / (2 * t)];
            var i = Math.sqrt(r);
            return [(-e - i) / (2 * t), (-e + i) / (2 * t)];
        }
        function c(t) {
            return t < 0 ? -Math.pow(-t, 1 / 3) : Math.pow(t, 1 / 3);
        }
        function f(t, e, n, r) {
            if (0 === t) return u(e, n, r);
            var i = -e / (3 * t),
                o = ((t * i + e) * i + n) * i + r,
                a = (e * e - 3 * t * n) / (9 * t * t),
                s = 4 * t * t * Math.pow(a, 3),
                f = o * o - s;
            if (f > 0) {
                var h = Math.sqrt(f);
                return [i + c((-o + h) / (2 * t)) + c((-o - h) / (2 * t))];
            }
            if (0 === f) {
                var l = c(o / (2 * t));
                return [i - 2 * l, i + l];
            }
            var p = Math.acos(-o / Math.sqrt(s)) / 3,
                d = Math.sqrt(a);
            return [
                i + 2 * d * Math.cos(p),
                i + 2 * d * Math.cos(p + (2 * Math.PI) / 3),
                i + 2 * d * Math.cos(p + (4 * Math.PI) / 3),
            ];
        }
        function h(t, e, n, r) {
            for (
                var i = e.add(r).sub(n.mul(2)),
                    o = n.sub(e).mul(2),
                    s = e,
                    u = f(2 * i.sqr(), 3 * i.dot(o), o.sqr() + 2 * i.dot(s.sub(t)), s.sub(t).dot(o))
                        .filter(function (t) {
                            return t > 0 && t < 1;
                        })
                        .concat([0, 1]),
                    c = 1e9,
                    h = 0;
                h < u.length;
                h++
            ) {
                var l = a(i, o, s, u[h]).sub(t).dist();
                l < c && (c = l);
            }
            return c;
        }
        function l(t, e, n, i, a, u) {
            var c = o(t, e, n, i, a),
                f = o(t, e, n, i, u),
                h = s(t, e, n, 0, a),
                l = s(t, e, n, 0, u),
                p = -h.x * l.y + l.x * h.y;
            return Math.abs(p) < 1e-8
                ? [c, c.add(f).div(2), f]
                : [
                      c,
                      new r(
                          (h.x * (f.y * l.x - f.x * l.y) + l.x * (c.x * h.y - c.y * h.x)) / p,
                          (h.y * (f.y * l.x - f.x * l.y) + l.y * (c.x * h.y - c.y * h.x)) / p,
                      ),
                      f,
                  ];
        }
        function p(t, e, n, r, i, a, s, u, c, f) {
            for (var l = (a - i) / 10, p = i + l; p < a - l; p += l) {
                if (h(o(t, e, n, r, p), s, u, c) > f) return !1;
            }
            return !0;
        }
        function d(t, e, n, r, i, o) {
            for (var a = 1 / i.length, s = 0; s < i.length; s++) {
                if (!p(t, e, n, r, s * a, (s + 1) * a, i[s][0], i[s][1], i[s][2], o)) return !1;
            }
            return !0;
        }
        function v(t, e, n, r, i, o, a, s, u) {
            var c = 1 - u,
                f = t * c + n * u,
                h = n * c + i * u,
                l = i * c + a * u,
                p = f * c + h * u,
                d = h * c + l * u,
                v = p * c + d * u,
                m = e * c + r * u,
                y = r * c + o * u,
                g = o * c + s * u,
                _ = m * c + y * u,
                w = y * c + g * u,
                b = _ * c + w * u;
            return [
                [t, e, f, m, p, _, v, b],
                [v, b, d, w, l, g, a, s],
            ];
        }
        function m(t, e) {
            return t - e;
        }
        function y(t, e, n, o, a, s, u, c, f) {
            for (
                var h,
                    p = new r(t, e),
                    v = new r(n, o),
                    m = new r(a, s),
                    y = new r(u, c),
                    g = i(p, v, m, y),
                    _ = g[0],
                    w = g[1],
                    b = g[2],
                    x = g[3],
                    E = 1;
                E <= 8;
                E++
            ) {
                h = [];
                for (var S = 0; S < 1; S += 1 / E) h.push(l(_, w, b, x, S, S + 1 / E));
                if (
                    (1 !== E || !(h[0][1].sub(p).dot(v.sub(p)) < 0 || h[0][1].sub(y).dot(m.sub(y)) < 0)) &&
                    d(_, w, b, x, h, f)
                )
                    break;
            }
            return (function (t) {
                var e = [];
                e.push(t[0][0].x), e.push(t[0][0].y);
                for (var n = 0; n < t.length; n++)
                    e.push(t[n][1].x), e.push(t[n][1].y), e.push(t[n][2].x), e.push(t[n][2].y);
                return e;
            })(h);
        }
        (r.prototype.add = function (t) {
            return new r(this.x + t.x, this.y + t.y);
        }),
            (r.prototype.sub = function (t) {
                return new r(this.x - t.x, this.y - t.y);
            }),
            (r.prototype.mul = function (t) {
                return new r(this.x * t, this.y * t);
            }),
            (r.prototype.div = function (t) {
                return new r(this.x / t, this.y / t);
            }),
            (r.prototype.dist = function () {
                return Math.sqrt(this.x * this.x + this.y * this.y);
            }),
            (r.prototype.sqr = function () {
                return this.x * this.x + this.y * this.y;
            }),
            (r.prototype.dot = function (t) {
                return this.x * t.x + this.y * t.y;
            }),
            (t.exports = function (t, e, n, r, i, o, a, s, c) {
                var f,
                    h,
                    l,
                    p,
                    d,
                    g,
                    _,
                    w,
                    b = u(
                        -(_ = a) * ((h = e) - 2 * (p = r) + (g = o)) +
                            (d = i) * (2 * h - 3 * p + (w = s)) +
                            (f = t) * (p - 2 * g + w) -
                            (l = n) * (h - 3 * g + 2 * w),
                        _ * (h - p) + 3 * d * (-h + p) + l * (2 * h - 3 * g + w) - f * (2 * p - 3 * g + w),
                        d * (h - p) + f * (p - g) + l * (-h + g),
                    )
                        .filter(function (t) {
                            return t > 1e-8 && t < 1 - 1e-8;
                        })
                        .sort(m);
                if (!b.length) return y(t, e, n, r, i, o, a, s, c);
                for (var x, E, S = [], T = [t, e, n, r, i, o, a, s], N = 0, O = 0; O < b.length; O++)
                    (x = y(
                        (E = v(T[0], T[1], T[2], T[3], T[4], T[5], T[6], T[7], 1 - (1 - b[O]) / (1 - N)))[0][0],
                        E[0][1],
                        E[0][2],
                        E[0][3],
                        E[0][4],
                        E[0][5],
                        E[0][6],
                        E[0][7],
                        c,
                    )),
                        (S = S.concat(x.slice(0, -2))),
                        (T = E[1]),
                        (N = b[O]);
                return (x = y(T[0], T[1], T[2], T[3], T[4], T[5], T[6], T[7], c)), S.concat(x);
            }),
            (t.exports.isApproximationClose = function (t, e, n, o, a, s, u, c, f, h) {
                var l = i(new r(t, e), new r(n, o), new r(a, s), new r(u, c));
                return d(
                    l[0],
                    l[1],
                    l[2],
                    l[3],
                    (function (t) {
                        for (var e = [], n = (t.length - 2) / 4, i = 0; i < n; i++)
                            e.push([
                                new r(t[4 * i], t[4 * i + 1]),
                                new r(t[4 * i + 2], t[4 * i + 3]),
                                new r(t[4 * i + 4], t[4 * i + 5]),
                            ]);
                        return e;
                    })(f),
                    h,
                );
            }),
            (t.exports.cubicSolve = f);
    },
    function (t, e, n) {
        function r(t) {
            this.options = t || { locator: {} };
        }
        function i() {
            this.cdata = !1;
        }
        function o(t, e) {
            (e.lineNumber = t.lineNumber), (e.columnNumber = t.columnNumber);
        }
        function a(t) {
            if (t) return '\n@' + (t.systemId || '') + '#[line:' + t.lineNumber + ',col:' + t.columnNumber + ']';
        }
        function s(t, e, n) {
            return 'string' == typeof t
                ? t.substr(e, n)
                : t.length >= e + n || e
                  ? new java.lang.String(t, e, n) + ''
                  : t;
        }
        function u(t, e) {
            t.currentElement ? t.currentElement.appendChild(e) : t.doc.appendChild(e);
        }
        (r.prototype.parseFromString = function (t, e) {
            var n = this.options,
                r = new c(),
                o = n.domBuilder || new i(),
                s = n.errorHandler,
                u = n.locator,
                f = n.xmlns || {},
                h = { lt: '<', gt: '>', amp: '&', quot: '"', apos: "'" };
            return (
                u && o.setDocumentLocator(u),
                (r.errorHandler = (function (t, e, n) {
                    if (!t) {
                        if (e instanceof i) return e;
                        t = e;
                    }
                    var r = {},
                        o = t instanceof Function;
                    function s(e) {
                        var i = t[e];
                        !i &&
                            o &&
                            (i =
                                2 == t.length
                                    ? function (n) {
                                          t(e, n);
                                      }
                                    : t),
                            (r[e] =
                                (i &&
                                    function (t) {
                                        i('[xmldom ' + e + ']\t' + t + a(n));
                                    }) ||
                                function () {});
                    }
                    return (n = n || {}), s('warning'), s('error'), s('fatalError'), r;
                })(s, o, u)),
                (r.domBuilder = n.domBuilder || o),
                /\/x?html?$/.test(e) && ((h.nbsp = ' '), (h.copy = '©'), (f[''] = 'http://www.w3.org/1999/xhtml')),
                (f.xml = f.xml || 'http://www.w3.org/XML/1998/namespace'),
                t ? r.parse(t, f, h) : r.errorHandler.error('invalid doc source'),
                o.doc
            );
        }),
            (i.prototype = {
                startDocument: function () {
                    (this.doc = new f().createDocument(null, null, null)),
                        this.locator && (this.doc.documentURI = this.locator.systemId);
                },
                startElement: function (t, e, n, r) {
                    var i = this.doc,
                        a = i.createElementNS(t, n || e),
                        s = r.length;
                    u(this, a), (this.currentElement = a), this.locator && o(this.locator, a);
                    for (var c = 0; c < s; c++) {
                        t = r.getURI(c);
                        var f = r.getValue(c),
                            h = ((n = r.getQName(c)), i.createAttributeNS(t, n));
                        this.locator && o(r.getLocator(c), h), (h.value = h.nodeValue = f), a.setAttributeNode(h);
                    }
                },
                endElement: function (t, e, n) {
                    var r = this.currentElement;
                    r.tagName;
                    this.currentElement = r.parentNode;
                },
                startPrefixMapping: function (t, e) {},
                endPrefixMapping: function (t) {},
                processingInstruction: function (t, e) {
                    var n = this.doc.createProcessingInstruction(t, e);
                    this.locator && o(this.locator, n), u(this, n);
                },
                ignorableWhitespace: function (t, e, n) {},
                characters: function (t, e, n) {
                    if ((t = s.apply(this, arguments))) {
                        if (this.cdata) var r = this.doc.createCDATASection(t);
                        else r = this.doc.createTextNode(t);
                        this.currentElement
                            ? this.currentElement.appendChild(r)
                            : /^\s*$/.test(t) && this.doc.appendChild(r),
                            this.locator && o(this.locator, r);
                    }
                },
                skippedEntity: function (t) {},
                endDocument: function () {
                    this.doc.normalize();
                },
                setDocumentLocator: function (t) {
                    (this.locator = t) && (t.lineNumber = 0);
                },
                comment: function (t, e, n) {
                    t = s.apply(this, arguments);
                    var r = this.doc.createComment(t);
                    this.locator && o(this.locator, r), u(this, r);
                },
                startCDATA: function () {
                    this.cdata = !0;
                },
                endCDATA: function () {
                    this.cdata = !1;
                },
                startDTD: function (t, e, n) {
                    var r = this.doc.implementation;
                    if (r && r.createDocumentType) {
                        var i = r.createDocumentType(t, e, n);
                        this.locator && o(this.locator, i), u(this, i);
                    }
                },
                warning: function (t) {
                    console.warn('[xmldom warning]\t' + t, a(this.locator));
                },
                error: function (t) {
                    console.error('[xmldom error]\t' + t, a(this.locator));
                },
                fatalError: function (t) {
                    throw (console.error('[xmldom fatalError]\t' + t, a(this.locator)), t);
                },
            }),
            'endDTD,startEntity,endEntity,attributeDecl,elementDecl,externalEntityDecl,internalEntityDecl,resolveEntity,getExternalSubset,notationDecl,unparsedEntityDecl'.replace(
                /\w+/g,
                function (t) {
                    i.prototype[t] = function () {
                        return null;
                    };
                },
            );
        var c = n(65).XMLReader,
            f = (e.DOMImplementation = n(22).DOMImplementation);
        (e.XMLSerializer = n(22).XMLSerializer), (e.DOMParser = r);
    },
    function (t, e) {
        var n =
                /[A-Z_a-z\xC0-\xD6\xD8-\xF6\u00F8-\u02FF\u0370-\u037D\u037F-\u1FFF\u200C-\u200D\u2070-\u218F\u2C00-\u2FEF\u3001-\uD7FF\uF900-\uFDCF\uFDF0-\uFFFD]/,
            r = new RegExp('[\\-\\.0-9' + n.source.slice(1, -1) + '\\u00B7\\u0300-\\u036F\\u203F-\\u2040]'),
            i = new RegExp('^' + n.source + r.source + '*(?::' + n.source + r.source + '*)?$');
        function o() {}
        function a(t, e) {
            return (e.lineNumber = t.lineNumber), (e.columnNumber = t.columnNumber), e;
        }
        function s(t, e, n, r, i, o) {
            for (var a, s = ++e, u = 0; ; ) {
                var c = t.charAt(s);
                switch (c) {
                    case '=':
                        if (1 === u) (a = t.slice(e, s)), (u = 3);
                        else {
                            if (2 !== u) throw new Error('attribute equal must after attrName');
                            u = 3;
                        }
                        break;
                    case "'":
                    case '"':
                        if (3 === u || 1 === u) {
                            if (
                                (1 === u && (o.warning('attribute value must after "="'), (a = t.slice(e, s))),
                                (e = s + 1),
                                !((s = t.indexOf(c, e)) > 0))
                            )
                                throw new Error("attribute value no end '" + c + "' match");
                            (f = t.slice(e, s).replace(/&#?\w+;/g, i)), n.add(a, f, e - 1), (u = 5);
                        } else {
                            if (4 != u) throw new Error('attribute value must after "="');
                            (f = t.slice(e, s).replace(/&#?\w+;/g, i)),
                                n.add(a, f, e),
                                o.warning('attribute "' + a + '" missed start quot(' + c + ')!!'),
                                (e = s + 1),
                                (u = 5);
                        }
                        break;
                    case '/':
                        switch (u) {
                            case 0:
                                n.setTagName(t.slice(e, s));
                            case 5:
                            case 6:
                            case 7:
                                (u = 7), (n.closed = !0);
                            case 4:
                            case 1:
                            case 2:
                                break;
                            default:
                                throw new Error("attribute invalid close char('/')");
                        }
                        break;
                    case '':
                        return o.error('unexpected end of input'), 0 == u && n.setTagName(t.slice(e, s)), s;
                    case '>':
                        switch (u) {
                            case 0:
                                n.setTagName(t.slice(e, s));
                            case 5:
                            case 6:
                            case 7:
                                break;
                            case 4:
                            case 1:
                                '/' === (f = t.slice(e, s)).slice(-1) && ((n.closed = !0), (f = f.slice(0, -1)));
                            case 2:
                                2 === u && (f = a),
                                    4 == u
                                        ? (o.warning('attribute "' + f + '" missed quot(")!!'),
                                          n.add(a, f.replace(/&#?\w+;/g, i), e))
                                        : (('http://www.w3.org/1999/xhtml' === r[''] &&
                                              f.match(/^(?:disabled|checked|selected)$/i)) ||
                                              o.warning('attribute "' + f + '" missed value!! "' + f + '" instead!!'),
                                          n.add(f, f, e));
                                break;
                            case 3:
                                throw new Error('attribute value missed!!');
                        }
                        return s;
                    case '':
                        c = ' ';
                    default:
                        if (c <= ' ')
                            switch (u) {
                                case 0:
                                    n.setTagName(t.slice(e, s)), (u = 6);
                                    break;
                                case 1:
                                    (a = t.slice(e, s)), (u = 2);
                                    break;
                                case 4:
                                    var f = t.slice(e, s).replace(/&#?\w+;/g, i);
                                    o.warning('attribute "' + f + '" missed quot(")!!'), n.add(a, f, e);
                                case 5:
                                    u = 6;
                            }
                        else
                            switch (u) {
                                case 2:
                                    n.tagName;
                                    ('http://www.w3.org/1999/xhtml' === r[''] &&
                                        a.match(/^(?:disabled|checked|selected)$/i)) ||
                                        o.warning('attribute "' + a + '" missed value!! "' + a + '" instead2!!'),
                                        n.add(a, a, e),
                                        (e = s),
                                        (u = 1);
                                    break;
                                case 5:
                                    o.warning('attribute space is required"' + a + '"!!');
                                case 6:
                                    (u = 1), (e = s);
                                    break;
                                case 3:
                                    (u = 4), (e = s);
                                    break;
                                case 7:
                                    throw new Error("elements closed character '/' and '>' must be connected to");
                            }
                }
                s++;
            }
        }
        function u(t, e, n) {
            for (var r = t.tagName, i = null, o = t.length; o--; ) {
                var a = t[o],
                    s = a.qName,
                    u = a.value;
                if ((p = s.indexOf(':')) > 0)
                    var c = (a.prefix = s.slice(0, p)),
                        f = s.slice(p + 1),
                        l = 'xmlns' === c && f;
                else (f = s), (c = null), (l = 'xmlns' === s && '');
                (a.localName = f),
                    !1 !== l &&
                        (null == i && ((i = {}), h(n, (n = {}))),
                        (n[l] = i[l] = u),
                        (a.uri = 'http://www.w3.org/2000/xmlns/'),
                        e.startPrefixMapping(l, u));
            }
            for (o = t.length; o--; ) {
                (c = (a = t[o]).prefix) &&
                    ('xml' === c && (a.uri = 'http://www.w3.org/XML/1998/namespace'),
                    'xmlns' !== c && (a.uri = n[c || '']));
            }
            var p;
            (p = r.indexOf(':')) > 0
                ? ((c = t.prefix = r.slice(0, p)), (f = t.localName = r.slice(p + 1)))
                : ((c = null), (f = t.localName = r));
            var d = (t.uri = n[c || '']);
            if ((e.startElement(d, f, r, t), !t.closed)) return (t.currentNSMap = n), (t.localNSMap = i), !0;
            if ((e.endElement(d, f, r), i)) for (c in i) e.endPrefixMapping(c);
        }
        function c(t, e, n, r, i) {
            if (/^(?:script|textarea)$/i.test(n)) {
                var o = t.indexOf('</' + n + '>', e),
                    a = t.substring(e + 1, o);
                if (/[&<]/.test(a))
                    return /^script$/i.test(n)
                        ? (i.characters(a, 0, a.length), o)
                        : ((a = a.replace(/&#?\w+;/g, r)), i.characters(a, 0, a.length), o);
            }
            return e + 1;
        }
        function f(t, e, n, r) {
            var i = r[n];
            return (
                null == i && ((i = t.lastIndexOf('</' + n + '>')) < e && (i = t.lastIndexOf('</' + n)), (r[n] = i)),
                i < e
            );
        }
        function h(t, e) {
            for (var n in t) e[n] = t[n];
        }
        function l(t, e, n, r) {
            switch (t.charAt(e + 2)) {
                case '-':
                    return '-' === t.charAt(e + 3)
                        ? (i = t.indexOf('--\x3e', e + 4)) > e
                            ? (n.comment(t, e + 4, i - e - 4), i + 3)
                            : (r.error('Unclosed comment'), -1)
                        : -1;
                default:
                    if ('CDATA[' == t.substr(e + 3, 6)) {
                        var i = t.indexOf(']]>', e + 9);
                        return n.startCDATA(), n.characters(t, e + 9, i - e - 9), n.endCDATA(), i + 3;
                    }
                    var o = (function (t, e) {
                            var n,
                                r = [],
                                i = /'[^']+'|"[^"]+"|[^\s<>\/=]+=?|(\/?\s*>|<)/g;
                            (i.lastIndex = e), i.exec(t);
                            for (; (n = i.exec(t)); ) if ((r.push(n), n[1])) return r;
                        })(t, e),
                        a = o.length;
                    if (a > 1 && /!doctype/i.test(o[0][0])) {
                        var s = o[1][0],
                            u = a > 3 && /^public$/i.test(o[2][0]) && o[3][0],
                            c = a > 4 && o[4][0],
                            f = o[a - 1];
                        return (
                            n.startDTD(
                                s,
                                u && u.replace(/^(['"])(.*?)\1$/, '$2'),
                                c && c.replace(/^(['"])(.*?)\1$/, '$2'),
                            ),
                            n.endDTD(),
                            f.index + f[0].length
                        );
                    }
            }
            return -1;
        }
        function p(t, e, n) {
            var r = t.indexOf('?>', e);
            if (r) {
                var i = t.substring(e, r).match(/^<\?(\S*)\s*([\s\S]*?)\s*$/);
                if (i) {
                    i[0].length;
                    return n.processingInstruction(i[1], i[2]), r + 2;
                }
                return -1;
            }
            return -1;
        }
        function d(t) {}
        function v(t, e) {
            return (t.__proto__ = e), t;
        }
        (o.prototype = {
            parse: function (t, e, n) {
                var r = this.domBuilder;
                r.startDocument(),
                    h(e, (e = {})),
                    (function (t, e, n, r, i) {
                        function o(t) {
                            var e = t.slice(1, -1);
                            return e in n
                                ? n[e]
                                : '#' === e.charAt(0)
                                  ? (function (t) {
                                        if (t > 65535) {
                                            var e = 55296 + ((t -= 65536) >> 10),
                                                n = 56320 + (1023 & t);
                                            return String.fromCharCode(e, n);
                                        }
                                        return String.fromCharCode(t);
                                    })(parseInt(e.substr(1).replace('x', '0x')))
                                  : (i.error('entity not found:' + t), t);
                        }
                        function h(e) {
                            if (e > x) {
                                var n = t.substring(x, e).replace(/&#?\w+;/g, o);
                                _ && v(x), r.characters(n, 0, e - x), (x = e);
                            }
                        }
                        function v(e, n) {
                            for (; e >= y && (n = g.exec(t)); ) (m = n.index), (y = m + n[0].length), _.lineNumber++;
                            _.columnNumber = e - m + 1;
                        }
                        var m = 0,
                            y = 0,
                            g = /.*(?:\r\n?|\n)|.*$/g,
                            _ = r.locator,
                            w = [{ currentNSMap: e }],
                            b = {},
                            x = 0;
                        for (;;) {
                            try {
                                var E = t.indexOf('<', x);
                                if (E < 0) {
                                    if (!t.substr(x).match(/^\s*$/)) {
                                        var S = r.doc,
                                            T = S.createTextNode(t.substr(x));
                                        S.appendChild(T), (r.currentElement = T);
                                    }
                                    return;
                                }
                                switch ((E > x && h(E), t.charAt(E + 1))) {
                                    case '/':
                                        var N = t.indexOf('>', E + 3),
                                            O = t.substring(E + 2, N),
                                            A = w.pop();
                                        N < 0
                                            ? ((O = t.substring(E + 2).replace(/[\s<].*/, '')),
                                              i.error('end tag name: ' + O + ' is not complete:' + A.tagName),
                                              (N = E + 1 + O.length))
                                            : O.match(/\s</) &&
                                              ((O = O.replace(/[\s<].*/, '')),
                                              i.error('end tag name: ' + O + ' maybe not complete'),
                                              (N = E + 1 + O.length));
                                        var C = A.localNSMap,
                                            I = A.tagName == O;
                                        if (I || (A.tagName && A.tagName.toLowerCase() == O.toLowerCase())) {
                                            if ((r.endElement(A.uri, A.localName, O), C))
                                                for (var M in C) r.endPrefixMapping(M);
                                            I ||
                                                i.fatalError(
                                                    'end tag name: ' +
                                                        O +
                                                        ' is not match the current start tagName:' +
                                                        A.tagName,
                                                );
                                        } else w.push(A);
                                        N++;
                                        break;
                                    case '?':
                                        _ && v(E), (N = p(t, E, r));
                                        break;
                                    case '!':
                                        _ && v(E), (N = l(t, E, r, i));
                                        break;
                                    default:
                                        _ && v(E);
                                        var D = new d(),
                                            U = w[w.length - 1].currentNSMap,
                                            k = ((N = s(t, E, D, U, o, i)), D.length);
                                        if (
                                            (!D.closed &&
                                                f(t, N, D.tagName, b) &&
                                                ((D.closed = !0), n.nbsp || i.warning('unclosed xml attribute')),
                                            _ && k)
                                        ) {
                                            for (var P = a(_, {}), R = 0; R < k; R++) {
                                                var F = D[R];
                                                v(F.offset), (F.locator = a(_, {}));
                                            }
                                            (r.locator = P), u(D, r, U) && w.push(D), (r.locator = _);
                                        } else u(D, r, U) && w.push(D);
                                        'http://www.w3.org/1999/xhtml' !== D.uri || D.closed
                                            ? N++
                                            : (N = c(t, N, D.tagName, o, r));
                                }
                            } catch (t) {
                                i.error('element parse error: ' + t), (N = -1);
                            }
                            N > x ? (x = N) : h(Math.max(E, x) + 1);
                        }
                    })(t, e, n, r, this.errorHandler),
                    r.endDocument();
            },
        }),
            (d.prototype = {
                setTagName: function (t) {
                    if (!i.test(t)) throw new Error('invalid tagName:' + t);
                    this.tagName = t;
                },
                add: function (t, e, n) {
                    if (!i.test(t)) throw new Error('invalid attribute:' + t);
                    this[this.length++] = { qName: t, value: e, offset: n };
                },
                length: 0,
                getLocalName: function (t) {
                    return this[t].localName;
                },
                getLocator: function (t) {
                    return this[t].locator;
                },
                getQName: function (t) {
                    return this[t].qName;
                },
                getURI: function (t) {
                    return this[t].uri;
                },
                getValue: function (t) {
                    return this[t].value;
                },
            }),
            v({}, v.prototype) instanceof v ||
                (v = function (t, e) {
                    function n() {}
                    for (e in ((n.prototype = e), (n = new n()), t)) n[e] = t[e];
                    return n;
                }),
            (e.XMLReader = o);
    },
    function (t, e, n) {
        'use strict';
        var r = n(2);
        function i() {
            (this.contours = []), (this.d = ''), (this.id = ''), (this.height = 0), (this.name = ''), (this.width = 0);
        }
        Object.defineProperty(i.prototype, 'xMin', {
            get: function () {
                var t = 0,
                    e = !1;
                return (
                    r.forEach(this.contours, function (n) {
                        r.forEach(n.points, function (n) {
                            (t = Math.min(t, Math.floor(n.x))), (e = !0);
                        });
                    }),
                    e ? t : 0
                );
            },
        }),
            Object.defineProperty(i.prototype, 'xMax', {
                get: function () {
                    var t = 0,
                        e = !1;
                    return (
                        r.forEach(this.contours, function (n) {
                            r.forEach(n.points, function (n) {
                                (t = Math.max(t, -Math.floor(-n.x))), (e = !0);
                            });
                        }),
                        e ? t : this.width
                    );
                },
            }),
            Object.defineProperty(i.prototype, 'yMin', {
                get: function () {
                    var t = 0,
                        e = !1;
                    return (
                        r.forEach(this.contours, function (n) {
                            r.forEach(n.points, function (n) {
                                (t = Math.min(t, Math.floor(n.y))), (e = !0);
                            });
                        }),
                        e ? t : 0
                    );
                },
            }),
            Object.defineProperty(i.prototype, 'yMax', {
                get: function () {
                    var t = 0,
                        e = !1;
                    return (
                        r.forEach(this.contours, function (n) {
                            r.forEach(n.points, function (n) {
                                (t = Math.max(t, -Math.floor(-n.y))), (e = !0);
                            });
                        }),
                        e ? t : 0
                    );
                },
            }),
            (t.exports.Font = function () {
                (this.ascent = 850),
                    (this.copyright = ''),
                    (this.createdDate = new Date()),
                    (this.glyphs = []),
                    (this.ligatures = []),
                    (this.codePoints = {}),
                    (this.isFixedPitch = 0),
                    (this.italicAngle = 0),
                    (this.familyClass = 0),
                    (this.familyName = ''),
                    (this.fsSelection = 64),
                    (this.fsType = 0),
                    (this.lowestRecPPEM = 8),
                    (this.macStyle = 0),
                    (this.modifiedDate = new Date()),
                    (this.panose = {
                        familyType: 2,
                        serifStyle: 0,
                        weight: 5,
                        proportion: 3,
                        contrast: 0,
                        strokeVariation: 0,
                        armStyle: 0,
                        letterform: 0,
                        midline: 0,
                        xHeight: 0,
                    }),
                    (this.revision = 1),
                    (this.sfntNames = []),
                    (this.underlineThickness = 0),
                    (this.unitsPerEm = 1e3),
                    (this.weightClass = 400),
                    (this.width = 1e3),
                    (this.widthClass = 5),
                    (this.ySubscriptXOffset = 0),
                    (this.ySuperscriptXOffset = 0),
                    (this.int_descent = -150),
                    Object.defineProperty(this, 'descent', {
                        get: function () {
                            return this.int_descent;
                        },
                        set: function (t) {
                            this.int_descent = parseInt(Math.round(-Math.abs(t)), 10);
                        },
                    }),
                    this.__defineGetter__('avgCharWidth', function () {
                        if (0 === this.glyphs.length) return 0;
                        var t = r.map(this.glyphs, 'width');
                        return parseInt(
                            t.reduce(function (t, e) {
                                return t + e;
                            }) / t.length,
                            10,
                        );
                    }),
                    Object.defineProperty(this, 'ySubscriptXSize', {
                        get: function () {
                            return parseInt(
                                r.isUndefined(this.int_ySubscriptXSize)
                                    ? 0.6347 * this.width
                                    : this.int_ySubscriptXSize,
                                10,
                            );
                        },
                        set: function (t) {
                            this.int_ySubscriptXSize = t;
                        },
                    }),
                    Object.defineProperty(this, 'ySubscriptYSize', {
                        get: function () {
                            return parseInt(
                                r.isUndefined(this.int_ySubscriptYSize)
                                    ? 0.7 * (this.ascent - this.descent)
                                    : this.int_ySubscriptYSize,
                                10,
                            );
                        },
                        set: function (t) {
                            this.int_ySubscriptYSize = t;
                        },
                    }),
                    Object.defineProperty(this, 'ySubscriptYOffset', {
                        get: function () {
                            return parseInt(
                                r.isUndefined(this.int_ySubscriptYOffset)
                                    ? 0.14 * (this.ascent - this.descent)
                                    : this.int_ySubscriptYOffset,
                                10,
                            );
                        },
                        set: function (t) {
                            this.int_ySubscriptYOffset = t;
                        },
                    }),
                    Object.defineProperty(this, 'ySuperscriptXSize', {
                        get: function () {
                            return parseInt(
                                r.isUndefined(this.int_ySuperscriptXSize)
                                    ? 0.6347 * this.width
                                    : this.int_ySuperscriptXSize,
                                10,
                            );
                        },
                        set: function (t) {
                            this.int_ySuperscriptXSize = t;
                        },
                    }),
                    Object.defineProperty(this, 'ySuperscriptYSize', {
                        get: function () {
                            return parseInt(
                                r.isUndefined(this.int_ySuperscriptYSize)
                                    ? 0.7 * (this.ascent - this.descent)
                                    : this.int_ySuperscriptYSize,
                                10,
                            );
                        },
                        set: function (t) {
                            this.int_ySuperscriptYSize = t;
                        },
                    }),
                    Object.defineProperty(this, 'ySuperscriptYOffset', {
                        get: function () {
                            return parseInt(
                                r.isUndefined(this.int_ySuperscriptYOffset)
                                    ? 0.48 * (this.ascent - this.descent)
                                    : this.int_ySuperscriptYOffset,
                                10,
                            );
                        },
                        set: function (t) {
                            this.int_ySuperscriptYOffset = t;
                        },
                    }),
                    Object.defineProperty(this, 'yStrikeoutSize', {
                        get: function () {
                            return parseInt(
                                r.isUndefined(this.int_yStrikeoutSize)
                                    ? 0.049 * (this.ascent - this.descent)
                                    : this.int_yStrikeoutSize,
                                10,
                            );
                        },
                        set: function (t) {
                            this.int_yStrikeoutSize = t;
                        },
                    }),
                    Object.defineProperty(this, 'yStrikeoutPosition', {
                        get: function () {
                            return parseInt(
                                r.isUndefined(this.int_yStrikeoutPosition)
                                    ? 0.258 * (this.ascent - this.descent)
                                    : this.int_yStrikeoutPosition,
                                10,
                            );
                        },
                        set: function (t) {
                            this.int_yStrikeoutPosition = t;
                        },
                    }),
                    Object.defineProperty(this, 'minLsb', {
                        get: function () {
                            return parseInt(r.min(r.map(this.glyphs, 'xMin')), 10);
                        },
                    }),
                    Object.defineProperty(this, 'minRsb', {
                        get: function () {
                            return this.glyphs.length
                                ? parseInt(
                                      r.reduce(
                                          this.glyphs,
                                          function (t, e) {
                                              return Math.min(t, e.width - e.xMax);
                                          },
                                          0,
                                      ),
                                      10,
                                  )
                                : parseInt(this.width, 10);
                        },
                    }),
                    Object.defineProperty(this, 'xMin', {
                        get: function () {
                            return this.glyphs.length
                                ? r.reduce(
                                      this.glyphs,
                                      function (t, e) {
                                          return Math.min(t, e.xMin);
                                      },
                                      0,
                                  )
                                : this.width;
                        },
                    }),
                    Object.defineProperty(this, 'yMin', {
                        get: function () {
                            return this.glyphs.length
                                ? r.reduce(
                                      this.glyphs,
                                      function (t, e) {
                                          return Math.min(t, e.yMin);
                                      },
                                      0,
                                  )
                                : this.width;
                        },
                    }),
                    Object.defineProperty(this, 'xMax', {
                        get: function () {
                            return this.glyphs.length
                                ? r.reduce(
                                      this.glyphs,
                                      function (t, e) {
                                          return Math.max(t, e.xMax);
                                      },
                                      0,
                                  )
                                : this.width;
                        },
                    }),
                    Object.defineProperty(this, 'yMax', {
                        get: function () {
                            return this.glyphs.length
                                ? r.reduce(
                                      this.glyphs,
                                      function (t, e) {
                                          return Math.max(t, e.yMax);
                                      },
                                      0,
                                  )
                                : this.width;
                        },
                    }),
                    Object.defineProperty(this, 'avgWidth', {
                        get: function () {
                            var t = this.glyphs.length;
                            if (0 === t) return this.width;
                            var e = r.reduce(
                                this.glyphs,
                                function (t, e) {
                                    return t + e.width;
                                },
                                0,
                            );
                            return Math.round(e / t);
                        },
                    }),
                    Object.defineProperty(this, 'maxWidth', {
                        get: function () {
                            return this.glyphs.length
                                ? r.reduce(
                                      this.glyphs,
                                      function (t, e) {
                                          return Math.max(t, e.width);
                                      },
                                      0,
                                  )
                                : this.width;
                        },
                    }),
                    Object.defineProperty(this, 'maxExtent', {
                        get: function () {
                            return this.glyphs.length
                                ? r.reduce(
                                      this.glyphs,
                                      function (t, e) {
                                          return Math.max(t, e.xMax);
                                      },
                                      0,
                                  )
                                : this.width;
                        },
                    }),
                    Object.defineProperty(this, 'lineGap', {
                        get: function () {
                            return parseInt(
                                r.isUndefined(this.int_lineGap)
                                    ? 0.09 * (this.ascent - this.descent)
                                    : this.int_lineGap,
                                10,
                            );
                        },
                        set: function (t) {
                            this.int_lineGap = t;
                        },
                    }),
                    Object.defineProperty(this, 'underlinePosition', {
                        get: function () {
                            return parseInt(
                                r.isUndefined(this.int_underlinePosition)
                                    ? 0.01 * (this.ascent - this.descent)
                                    : this.int_underlinePosition,
                                10,
                            );
                        },
                        set: function (t) {
                            this.int_underlinePosition = t;
                        },
                    });
            }),
            (t.exports.Glyph = i),
            (t.exports.Contour = function () {
                this.points = [];
            }),
            (t.exports.Point = function () {
                (this.onCurve = !0), (this.x = 0), (this.y = 0);
            }),
            (t.exports.SfntName = function () {
                (this.id = 0), (this.value = '');
            }),
            (t.exports.toTTF = n(67));
    },
    function (t, e, n) {
        'use strict';
        var r = n(2),
            i = n(5),
            o = n(68),
            a = n(70),
            s = n(71),
            u = n(72),
            c = n(73),
            f = n(74),
            h = n(75),
            l = n(76),
            p = n(77),
            d = n(78),
            v = n(80),
            m = n(13),
            y = [
                { innerName: 'GSUB', order: 4, create: o },
                { innerName: 'OS/2', order: 4, create: a },
                { innerName: 'cmap', order: 6, create: s },
                { innerName: 'glyf', order: 8, create: u },
                { innerName: 'head', order: 2, create: c },
                { innerName: 'hhea', order: 1, create: f },
                { innerName: 'hmtx', order: 5, create: h },
                { innerName: 'loca', order: 7, create: l },
                { innerName: 'maxp', order: 3, create: p },
                { innerName: 'name', order: 9, create: d },
                { innerName: 'post', order: 10, create: v },
            ],
            g = 65536,
            _ = 2981146554;
        function w(t) {
            return (t &= 4294967295) < 0 && (t += 4294967296), t;
        }
        function b(t) {
            var e,
                n = 0,
                r = Math.floor(t.length / 4);
            for (e = 0; e < r; ++e) {
                n = w(n + t.getUint32(4 * e));
            }
            var i = t.length - 4 * r;
            if (i > 0) {
                var o = 0;
                for (e = 0; e < 4; e++) o = (o << 8) + (e < i ? t.getUint8(4 * r + e) : 0);
                n = w(n + o);
            }
            return n;
        }
        t.exports = function (t) {
            r.forEach(t.glyphs, function (t) {
                t.ttfContours = r.map(t.contours, function (t) {
                    return t.points;
                });
            }),
                r.forEach(t.glyphs, function (t) {
                    (t.ttfContours = m.simplify(t.ttfContours, 0.3)),
                        (t.ttfContours = m.simplify(t.ttfContours, 0.3)),
                        (t.ttfContours = m.interpolate(t.ttfContours, 1.1)),
                        (t.ttfContours = m.roundPoints(t.ttfContours)),
                        (t.ttfContours = m.removeClosingReturnPoints(t.ttfContours)),
                        (t.ttfContours = m.toRelative(t.ttfContours));
                });
            var e = 12 + 16 * y.length,
                n = e;
            r.forEach(y, function (e) {
                (e.buffer = e.create(t)),
                    (e.length = e.buffer.length),
                    (e.corLength = e.length + ((4 - (e.length % 4)) % 4)),
                    (e.checkSum = b(e.buffer)),
                    (n += e.corLength);
            });
            var o = e;
            r.forEach(r.sortBy(y, 'order'), function (t) {
                (t.offset = o), (o += t.corLength);
            });
            var a = new i(n),
                s = Math.floor(Math.log(y.length) / Math.LN2),
                u = 16 * Math.pow(2, s),
                c = 16 * y.length - u;
            a.writeUint32(g),
                a.writeUint16(y.length),
                a.writeUint16(u),
                a.writeUint16(s),
                a.writeUint16(c),
                r.forEach(y, function (t) {
                    a.writeUint32(m.identifier(t.innerName)),
                        a.writeUint32(t.checkSum),
                        a.writeUint32(t.offset),
                        a.writeUint32(t.length);
                });
            var f = 0;
            return (
                r.forEach(r.sortBy(y, 'order'), function (t) {
                    'head' === t.innerName && (f = a.tell()), a.writeBytes(t.buffer.buffer);
                    for (var e = t.length; e < t.corLength; e++) a.writeUint8(0);
                }),
                a.setUint32(f + 8, w(_ - b(a))),
                a
            );
        };
    },
    function (t, e, n) {
        'use strict';
        var r = n(2),
            i = n(13).identifier,
            o = n(5);
        function a() {
            var t = new o(12);
            return (
                t.writeUint16(4),
                t.writeUint16(0),
                t.writeUint16(0),
                t.writeUint16(0),
                t.writeUint16(1),
                t.writeUint16(0),
                t
            );
        }
        function s(t, e, n) {
            var i = [];
            r.forEach(n, function (e) {
                i.push(
                    (function (t, e) {
                        var n = t.codePoints,
                            r = e.unicode,
                            i = 4 + 2 * (r.length - 1),
                            a = new o(i),
                            s = e.glyph;
                        a.writeUint16(s.id), a.writeUint16(r.length);
                        for (var u = 1; u < r.length; u++) (s = n[r[u]]), a.writeUint16(s.id);
                        return a;
                    })(t, e),
                );
            });
            var a = r.reduce(
                    r.map(i, 'length'),
                    function (t, e) {
                        return t + e;
                    },
                    0,
                ),
                s = 2 + 2 * n.length,
                u = new o(0 + s + a);
            return (
                u.writeUint16(n.length),
                r.forEach(i, function (t) {
                    u.writeUint16(s), (s += t.length);
                }),
                r.forEach(i, function (t) {
                    u.writeBytes(t.buffer);
                }),
                u
            );
        }
        function u(t, e) {
            var n = [];
            r.forEach(e, function (e) {
                var r = s(t, e.codePoint, e.ligatures);
                n.push(r);
            });
            var i = r.reduce(
                    r.map(n, 'length'),
                    function (t, e) {
                        return t + e;
                    },
                    0,
                ),
                a = (function (t, e) {
                    var n = e.length,
                        i = new o(4 + 2 * n);
                    return (
                        i.writeUint16(1),
                        i.writeUint16(n),
                        r.forEach(e, function (t) {
                            i.writeUint16(t.startGlyph.id);
                        }),
                        i
                    );
                })(0, e),
                u = 6 + 2 * n.length,
                c = u + i,
                f = 8 + c + a.length,
                h = new o(f);
            return (
                h.writeUint16(4),
                h.writeUint16(0),
                h.writeUint16(1),
                h.writeUint16(8),
                h.writeUint16(1),
                h.writeUint16(c),
                h.writeUint16(n.length),
                r.forEach(n, function (t) {
                    h.writeUint16(u), (u += t.length);
                }),
                r.forEach(n, function (t) {
                    h.writeBytes(t.buffer);
                }),
                h.writeBytes(a.buffer),
                h
            );
        }
        t.exports = function (t) {
            var e = [
                    (function () {
                        var t = [
                                ['DFLT', a()],
                                ['latn', a()],
                            ],
                            e = 2 + 6 * t.length,
                            n = r.reduce(
                                r.map(t, function (t) {
                                    return t[1].length;
                                }),
                                function (t, e) {
                                    return t + e;
                                },
                                0,
                            ),
                            s = new o(0 + e + n);
                        s.writeUint16(t.length);
                        var u = e;
                        return (
                            r.forEach(t, function (t) {
                                var e = t[0],
                                    n = t[1];
                                s.writeUint32(i(e)), s.writeUint16(u), (u += n.length);
                            }),
                            r.forEach(t, function (t) {
                                var e = t[1];
                                s.writeBytes(e.buffer);
                            }),
                            s
                        );
                    })(),
                    (function () {
                        var t = new o(14);
                        return (
                            t.writeUint16(1),
                            t.writeUint32(i('liga')),
                            t.writeUint16(8),
                            t.writeUint16(0),
                            t.writeUint16(1),
                            t.writeUint16(0),
                            t
                        );
                    })(),
                    (function (t) {
                        var e = t.ligatures,
                            n = {};
                        r.forEach(e, function (t) {
                            var e = t.unicode[0];
                            r.has(n, e) || (n[e] = []), n[e].push(t);
                        });
                        var i = [];
                        r.forEach(n, function (e, n) {
                            (n = parseInt(n, 10)),
                                e.sort(function (t, e) {
                                    return e.unicode.length - t.unicode.length;
                                }),
                                i.push({
                                    codePoint: n,
                                    ligatures: e,
                                    startGlyph: t.codePoints[n],
                                });
                        }),
                            i.sort(function (t, e) {
                                return t.startGlyph.id - e.startGlyph.id;
                            });
                        var a = u(t, i),
                            s = 4 + a.length,
                            c = new o(s);
                        return c.writeUint16(1), c.writeUint16(4), c.writeBytes(a.buffer), c;
                    })(t),
                ],
                n = 4 + 2 * e.length;
            r.forEach(e, function (t) {
                (t._listOffset = n), (n += t.length);
            });
            var s = new o(n);
            return (
                s.writeUint32(65536),
                r.forEach(e, function (t) {
                    s.writeUint16(t._listOffset);
                }),
                r.forEach(e, function (t) {
                    s.writeBytes(t.buffer);
                }),
                s
            );
        };
    },
    function (t, e, n) {
        'use strict';
        function r(t, e) {
            (this.x = t), (this.y = e);
        }
        (r.prototype.add = function (t) {
            return new r(this.x + t.x, this.y + t.y);
        }),
            (r.prototype.sub = function (t) {
                return new r(this.x - t.x, this.y - t.y);
            }),
            (r.prototype.mul = function (t) {
                return new r(this.x * t, this.y * t);
            }),
            (r.prototype.div = function (t) {
                return new r(this.x / t, this.y / t);
            }),
            (r.prototype.dist = function () {
                return Math.sqrt(this.x * this.x + this.y * this.y);
            }),
            (r.prototype.sqr = function () {
                return this.x * this.x + this.y * this.y;
            }),
            (t.exports.Point = r),
            (t.exports.isInLine = function (t, e, n, r) {
                var i = t.sub(e).sqr(),
                    o = n.sub(e).sqr(),
                    a = t.sub(n).sqr();
                return (
                    !(i > o + a || o > i + a) &&
                    Math.sqrt(Math.pow((t.x - e.x) * (n.y - e.y) - (n.x - e.x) * (t.y - e.y), 2) / a) < r
                );
            });
    },
    function (t, e, n) {
        'use strict';
        var r = n(2),
            i = n(13).identifier,
            o = n(5);
        t.exports = function (t) {
            var e = new o(86);
            return (
                e.writeUint16(1),
                e.writeInt16(t.avgWidth),
                e.writeUint16(t.weightClass),
                e.writeUint16(t.widthClass),
                e.writeInt16(t.fsType),
                e.writeInt16(t.ySubscriptXSize),
                e.writeInt16(t.ySubscriptYSize),
                e.writeInt16(t.ySubscriptXOffset),
                e.writeInt16(t.ySubscriptYOffset),
                e.writeInt16(t.ySuperscriptXSize),
                e.writeInt16(t.ySuperscriptYSize),
                e.writeInt16(t.ySuperscriptXOffset),
                e.writeInt16(t.ySuperscriptYOffset),
                e.writeInt16(t.yStrikeoutSize),
                e.writeInt16(t.yStrikeoutPosition),
                e.writeInt16(t.familyClass),
                e.writeUint8(t.panose.familyType),
                e.writeUint8(t.panose.serifStyle),
                e.writeUint8(t.panose.weight),
                e.writeUint8(t.panose.proportion),
                e.writeUint8(t.panose.contrast),
                e.writeUint8(t.panose.strokeVariation),
                e.writeUint8(t.panose.armStyle),
                e.writeUint8(t.panose.letterform),
                e.writeUint8(t.panose.midline),
                e.writeUint8(t.panose.xHeight),
                e.writeUint32(0),
                e.writeUint32(0),
                e.writeUint32(0),
                e.writeUint32(0),
                e.writeUint32(i('PfEd')),
                e.writeUint16(t.fsSelection),
                e.writeUint16(
                    (function (t) {
                        return Math.max(
                            0,
                            Math.min(
                                65535,
                                Math.abs(
                                    r.minBy(Object.keys(t.codePoints), function (t) {
                                        return parseInt(t, 10);
                                    }),
                                ),
                            ),
                        );
                    })(t),
                ),
                e.writeUint16(
                    (function (t) {
                        return Math.max(
                            0,
                            Math.min(
                                65535,
                                Math.abs(
                                    r.maxBy(Object.keys(t.codePoints), function (t) {
                                        return parseInt(t, 10);
                                    }),
                                ),
                            ),
                        );
                    })(t),
                ),
                e.writeInt16(t.ascent),
                e.writeInt16(t.descent),
                e.writeInt16(t.lineGap),
                e.writeInt16(Math.max(t.yMax, t.ascent)),
                e.writeInt16(-Math.min(t.yMin, t.descent)),
                e.writeInt32(1),
                e.writeInt32(0),
                e
            );
        };
    },
    function (t, e, n) {
        'use strict';
        var r = n(2),
            i = n(5);
        function o(t, e) {
            return t.codePoints[e] ? t.codePoints[e].id : 0;
        }
        function a(t, e) {
            var n = 8 === t || 10 === t || 12 === t || 13 === t ? 4 : 2,
                r = new i((e += 0 + n + n + n)),
                o = 4 === n ? r.writeUint32 : r.writeUint16;
            return r.writeUint16(t), 4 === n && r.writeUint16(0), o.call(r, e), o.call(r, 0), r;
        }
        function s(t) {
            var e,
                n = (function (t, e) {
                    e = e || Number.MAX_VALUE;
                    var n,
                        i = [];
                    return (
                        r.forEach(t.codePoints, function (t, r) {
                            if ((r = parseInt(r, 10)) >= e) return !1;
                            (n && r === n.end + 1) || (n && i.push(n), (n = { start: r })), (n.end = r);
                        }),
                        n && i.push(n),
                        r.forEach(i, function (t) {
                            t.length = t.end - t.start + 1;
                        }),
                        i
                    );
                })(t, 65535),
                i = [];
            r.forEach(n, function (e) {
                for (var n = [], r = e.start; r <= e.end; r++) n.push(o(t, r));
                i.push(n);
            });
            var s = n.length + 1,
                u = a(
                    4,
                    8 +
                        2 * s +
                        2 +
                        2 * s +
                        2 * s +
                        2 * s +
                        2 *
                            r.reduce(
                                r.map(i, 'length'),
                                function (t, e) {
                                    return t + e;
                                },
                                0,
                            ),
                );
            u.writeUint16(2 * s);
            var c = Math.floor(Math.log(s) / Math.LN2),
                f = 2 * Math.pow(2, c);
            for (
                u.writeUint16(f),
                    u.writeUint16(c),
                    u.writeUint16(2 * s - f),
                    r.forEach(n, function (t) {
                        u.writeUint16(t.end);
                    }),
                    u.writeUint16(65535),
                    u.writeUint16(0),
                    r.forEach(n, function (t) {
                        u.writeUint16(t.start);
                    }),
                    u.writeUint16(65535),
                    e = 0;
                e < n.length;
                e++
            )
                u.writeUint16(0);
            u.writeUint16(1);
            var h = 0;
            for (e = 0; e < n.length; e++) u.writeUint16(2 * (n.length - e + 1 + h)), (h += i[e].length);
            return (
                u.writeUint16(0),
                r.forEach(i, function (t) {
                    r.forEach(t, function (t) {
                        u.writeUint16(t);
                    });
                }),
                u
            );
        }
        function u(t) {
            var e = (function (t, e) {
                    e = e || Number.MAX_VALUE;
                    var n = [];
                    return (
                        r.forEach(t, function (t, r) {
                            if ((r = parseInt(r, 10)) > e) return !1;
                            n.push({ unicode: r, glyph: t });
                        }),
                        n
                    );
                })(t.codePoints),
                n = a(12, 4 + 4 * e.length + 4 * e.length + 4 * e.length);
            return (
                n.writeUint32(e.length),
                r.forEach(e, function (t) {
                    n.writeUint32(t.unicode), n.writeUint32(t.unicode), n.writeUint32(t.glyph.id);
                }),
                n
            );
        }
        t.exports = function (t) {
            var e = (function (t) {
                    var e,
                        n = a(0, 256);
                    for (e = 0; e < 256; e++) n.writeUint8(o(t, e));
                    return n;
                })(t),
                n = s(t),
                c = u(t),
                f = [
                    { platformID: 0, encodingID: 3, table: n },
                    { platformID: 0, encodingID: 4, table: c },
                    { platformID: 1, encodingID: 0, table: e },
                    { platformID: 3, encodingID: 1, table: n },
                    { platformID: 3, encodingID: 10, table: c },
                ],
                h = [n, e, c],
                l = 4 + 8 * f.length;
            r.forEach(h, function (t) {
                (t._tableOffset = l), (l += t.length);
            });
            var p = new i(l);
            return (
                p.writeUint16(0),
                p.writeUint16(f.length),
                r.forEach(f, function (t) {
                    p.writeUint16(t.platformID), p.writeUint16(t.encodingID), p.writeUint32(t.table._tableOffset);
                }),
                r.forEach(h, function (t) {
                    p.writeBytes(t.buffer);
                }),
                p
            );
        };
    },
    function (t, e, n) {
        'use strict';
        var r = n(2),
            i = n(5);
        function o(t, e) {
            var n = [];
            return (
                r.forEach(t.ttfContours, function (t) {
                    n.push.apply(n, r.map(t, e));
                }),
                n
            );
        }
        function a(t) {
            return r.filter(t, function (t) {
                return 0 !== t;
            });
        }
        function s(t) {
            var e = 0;
            return (
                r.forEach(t.glyphs, function (t) {
                    (t.ttf_size = (function (t) {
                        if (!t.contours.length) return 0;
                        var e = 12;
                        return (
                            (e += 2 * t.contours.length),
                            r.forEach(t.ttf_x, function (t) {
                                e += -255 <= t && t <= 255 ? 1 : 2;
                            }),
                            r.forEach(t.ttf_y, function (t) {
                                e += -255 <= t && t <= 255 ? 1 : 2;
                            }),
                            (e += t.ttf_flags.length) % 4 != 0 && (e += 4 - (e % 4)),
                            e
                        );
                    })(t)),
                        (e += t.ttf_size);
                }),
                (t.ttf_glyph_size = e),
                e
            );
        }
        t.exports = function (t) {
            r.forEach(t.glyphs, function (t) {
                var e, n, i, s;
                (t.ttf_flags = (function (t) {
                    var e = [];
                    return (
                        r.forEach(t.ttfContours, function (t) {
                            r.forEach(t, function (t) {
                                var n = t.onCurve ? 1 : 0;
                                0 === t.x
                                    ? (n += 16)
                                    : (-255 <= t.x && t.x <= 255 && (n += 2), t.x > 0 && t.x <= 255 && (n += 16)),
                                    0 === t.y
                                        ? (n += 32)
                                        : (-255 <= t.y && t.y <= 255 && (n += 4), t.y > 0 && t.y <= 255 && (n += 32)),
                                    e.push(n);
                            });
                        }),
                        e
                    );
                })(t)),
                    (t.ttf_flags =
                        ((e = t.ttf_flags),
                        (n = []),
                        (i = -1),
                        (s = !1),
                        r.forEach(e, function (t) {
                            i === t
                                ? s
                                    ? ((n[n.length - 1] += 8), n.push(1), (s = !1))
                                    : n[n.length - 1]++
                                : ((s = !0), (i = t), n.push(t));
                        }),
                        n)),
                    (t.ttf_x = o(t, 'x')),
                    (t.ttf_x = a(t.ttf_x)),
                    (t.ttf_y = o(t, 'y')),
                    (t.ttf_y = a(t.ttf_y));
            });
            var e = new i(s(t));
            return (
                r.forEach(t.glyphs, function (t) {
                    if (t.contours.length) {
                        var n = e.tell();
                        e.writeInt16(t.contours.length),
                            e.writeInt16(t.xMin),
                            e.writeInt16(t.yMin),
                            e.writeInt16(t.xMax),
                            e.writeInt16(t.yMax);
                        var i = -1,
                            o = t.ttfContours;
                        r.forEach(o, function (t) {
                            (i += t.length), e.writeInt16(i);
                        }),
                            e.writeInt16(0),
                            r.forEach(t.ttf_flags, function (t) {
                                e.writeInt8(t);
                            }),
                            r.forEach(t.ttf_x, function (t) {
                                -255 <= t && t <= 255 ? e.writeUint8(Math.abs(t)) : e.writeInt16(t);
                            }),
                            r.forEach(t.ttf_y, function (t) {
                                -255 <= t && t <= 255 ? e.writeUint8(Math.abs(t)) : e.writeInt16(t);
                            });
                        var a = (e.tell() - n) % 4;
                        if (0 !== a) for (; a < 4; a++) e.writeUint8(0);
                    }
                }),
                e
            );
        };
    },
    function (t, e, n) {
        'use strict';
        var r = n(5);
        function i(t) {
            var e = new Date('1904-01-01T00:00:00.000Z');
            return Math.floor((t - e) / 1e3);
        }
        t.exports = function (t) {
            var e = new r(54);
            return (
                e.writeInt32(65536),
                e.writeInt32(65536 * t.revision),
                e.writeUint32(0),
                e.writeUint32(1594834165),
                e.writeUint16(11),
                e.writeUint16(t.unitsPerEm),
                e.writeUint64(i(t.createdDate)),
                e.writeUint64(i(t.modifiedDate)),
                e.writeInt16(t.xMin),
                e.writeInt16(t.yMin),
                e.writeInt16(t.xMax),
                e.writeInt16(t.yMax),
                e.writeUint16(t.macStyle),
                e.writeUint16(t.lowestRecPPEM),
                e.writeInt16(2),
                e.writeInt16(t.ttf_glyph_size < 131072 ? 0 : 1),
                e.writeInt16(0),
                e
            );
        };
    },
    function (t, e, n) {
        'use strict';
        var r = n(5);
        t.exports = function (t) {
            var e = new r(36);
            return (
                e.writeInt32(65536),
                e.writeInt16(t.ascent),
                e.writeInt16(t.descent),
                e.writeInt16(0),
                e.writeUint16(t.maxWidth),
                e.writeInt16(t.minLsb),
                e.writeInt16(t.minRsb),
                e.writeInt16(t.maxExtent),
                e.writeInt16(1),
                e.writeInt16(0),
                e.writeUint32(0),
                e.writeUint32(0),
                e.writeUint16(0),
                e.writeInt16(0),
                e.writeUint16(t.glyphs.length),
                e
            );
        };
    },
    function (t, e, n) {
        'use strict';
        var r = n(2),
            i = n(5);
        t.exports = function (t) {
            var e = new i(4 * t.glyphs.length);
            return (
                r.forEach(t.glyphs, function (t) {
                    e.writeUint16(t.width), e.writeInt16(t.xMin);
                }),
                e
            );
        };
    },
    function (t, e, n) {
        'use strict';
        var r = n(2),
            i = n(5);
        t.exports = function (t) {
            var e = t.ttf_glyph_size < 131072,
                n = new i(
                    (function (t, e) {
                        return (t.glyphs.length + 1) * (e ? 2 : 4);
                    })(t, e),
                ),
                o = 0;
            return (
                r.forEach(t.glyphs, function (t) {
                    e ? (n.writeUint16(o), (o += t.ttf_size / 2)) : (n.writeUint32(o), (o += t.ttf_size));
                }),
                e ? n.writeUint16(o) : n.writeUint32(o),
                n
            );
        };
    },
    function (t, e, n) {
        'use strict';
        var r = n(2),
            i = n(5);
        t.exports = function (t) {
            var e = new i(32);
            return (
                e.writeInt32(65536),
                e.writeUint16(t.glyphs.length),
                e.writeUint16(
                    (function (t) {
                        return r.max(
                            r.map(t.glyphs, function (t) {
                                return r.reduce(
                                    t.ttfContours,
                                    function (t, e) {
                                        return t + e.length;
                                    },
                                    0,
                                );
                            }),
                        );
                    })(t),
                ),
                e.writeUint16(
                    (function (t) {
                        return r.max(
                            r.map(t.glyphs, function (t) {
                                return t.ttfContours.length;
                            }),
                        );
                    })(t),
                ),
                e.writeUint16(0),
                e.writeUint16(0),
                e.writeUint16(2),
                e.writeUint16(0),
                e.writeUint16(10),
                e.writeUint16(10),
                e.writeUint16(0),
                e.writeUint16(255),
                e.writeUint16(0),
                e.writeUint16(0),
                e.writeUint16(0),
                e
            );
        };
    },
    function (t, e, n) {
        'use strict';
        var r = n(2),
            i = n(5),
            o = n(79),
            a = 0,
            s = 1,
            u = 3,
            c = 10,
            f = 11;
        function h(t, e) {
            var n = [],
                r = new o(t);
            return (
                n.push({
                    data: r.toUTF8Bytes(),
                    id: e,
                    platformID: 1,
                    encodingID: 0,
                    languageID: 0,
                }),
                n.push({
                    data: r.toUCS2Bytes(),
                    id: e,
                    platformID: 3,
                    encodingID: 1,
                    languageID: 1033,
                }),
                n
            );
        }
        t.exports = function (t) {
            var e = (function (t) {
                    var e = [];
                    return (
                        t.copyright && e.push.apply(e, h(t.copyright, a)),
                        t.familyName && e.push.apply(e, h(t.familyName, s)),
                        t.id && e.push.apply(e, h(t.id, u)),
                        e.push.apply(e, h(t.description, c)),
                        e.push.apply(e, h(t.url, f)),
                        r.forEach(t.sfntNames, function (t) {
                            e.push.apply(e, h(t.value, t.id));
                        }),
                        e.sort(function (t, e) {
                            var n,
                                r = ['platformID', 'encodingID', 'languageID', 'id'];
                            for (n = 0; n < r.length; n++) if (t[r[n]] !== e[r[n]]) return t[r[n]] < e[r[n]] ? -1 : 1;
                            return 0;
                        }),
                        e
                    );
                })(t),
                n = new i(
                    (function (t) {
                        var e = 6;
                        return (
                            r.forEach(t, function (t) {
                                e += 12 + t.data.length;
                            }),
                            e
                        );
                    })(e),
                );
            n.writeUint16(0), n.writeUint16(e.length);
            var o = n.tell();
            n.writeUint16(0);
            var l = 0;
            r.forEach(e, function (t) {
                n.writeUint16(t.platformID),
                    n.writeUint16(t.encodingID),
                    n.writeUint16(t.languageID),
                    n.writeUint16(t.id),
                    n.writeUint16(t.data.length),
                    n.writeUint16(l),
                    (l += t.data.length);
            });
            var p = n.tell();
            return (
                r.forEach(e, function (t) {
                    n.writeBytes(t.data);
                }),
                n.seek(o),
                n.writeUint16(p),
                n
            );
        };
    },
    function (t, e, n) {
        'use strict';
        t.exports = function t(e) {
            if (!(this instanceof t)) return new t(e);
            (this.str = e),
                (this.toUTF8Bytes = function () {
                    for (var t = [], n = 0; n < e.length; n++)
                        if (e.charCodeAt(n) <= 127) t.push(e.charCodeAt(n));
                        else
                            for (var r = encodeURIComponent(e.charAt(n)).substr(1).split('%'), i = 0; i < r.length; i++)
                                t.push(parseInt(r[i], 16));
                    return t;
                }),
                (this.toUCS2Bytes = function () {
                    for (var t, n = [], r = 0; r < e.length; ++r)
                        (t = e.charCodeAt(r)), n.push(t >> 8), n.push(255 & t);
                    return n;
                });
        };
    },
    function (t, e, n) {
        'use strict';
        var r = n(2),
            i = n(5);
        t.exports = function (t) {
            var e = [];
            r.forEach(t.glyphs, function (t) {
                0 !== t.unicode &&
                    e.push(
                        (function (t) {
                            var e = [],
                                n = t ? (t.length < 256 ? t.length : 255) : 0;
                            e.push(n);
                            for (var r = 0; r < n; r++) {
                                var i = t.charCodeAt(r);
                                e.push(i < 128 ? i : 95);
                            }
                            return e;
                        })(t.name),
                    );
            });
            var n = new i(
                (function (t, e) {
                    var n = 36;
                    return (
                        (n += 2 * t.glyphs.length),
                        r.forEach(e, function (t) {
                            n += t.length;
                        }),
                        n
                    );
                })(t, e),
            );
            n.writeInt32(131072),
                n.writeInt32(t.italicAngle),
                n.writeInt16(t.underlinePosition),
                n.writeInt16(t.underlineThickness),
                n.writeUint32(t.isFixedPitch),
                n.writeUint32(0),
                n.writeUint32(0),
                n.writeUint32(0),
                n.writeUint32(0),
                n.writeUint16(t.glyphs.length);
            var o = 258;
            return (
                r.forEach(t.glyphs, function (t) {
                    0 === t.unicode ? n.writeUint16(0) : n.writeUint16(o++);
                }),
                r.forEach(e, function (t) {
                    n.writeBytes(t);
                }),
                n
            );
        };
    },
    function (t, e, n) {
        'use strict';
        var r = n(5),
            i = n(82).deflate;
        function o(t) {
            return (t &= 4294967295) < 0 && (t += 4294967296), t;
        }
        function a(t) {
            return (t + 3) & -4;
        }
        function s(t) {
            for (var e = 0, n = t.length / 4, r = 0; r < n; ++r) {
                e = o(e + t.getUint32(4 * r));
            }
            return e;
        }
        var u = 0,
            c = 4,
            f = 8,
            h = 12,
            l = 14,
            p = 16,
            d = 20,
            v = 22,
            m = 24,
            y = 28,
            g = 32,
            _ = 36,
            w = 40,
            b = 0,
            x = 4,
            E = 8,
            S = 12,
            T = 16,
            N = 0,
            O = 4,
            A = 8,
            C = 12,
            I = 0,
            M = 4,
            D = 6,
            U = 8,
            k = 2001684038,
            P = 2981146554,
            R = 44,
            F = 20,
            L = 12,
            j = 16;
        t.exports = function (t, e) {
            var n = new r(t);
            e = e || {};
            var z = { maj: 0, min: 1 },
                B = n.getUint16(4),
                V = 65536,
                q = new r(R);
            q.setUint32(u, k),
                q.setUint16(h, B),
                q.setUint16(l, 0),
                q.setUint32(p, 0),
                q.setUint32(m, 0),
                q.setUint32(y, 0),
                q.setUint32(g, 0),
                q.setUint32(_, 0),
                q.setUint32(w, 0);
            var Y,
                X,
                G = [];
            for (Y = 0; Y < B; ++Y) {
                var H = new r(n.buffer, L + Y * j);
                (X = {
                    Tag: new r(H, N, 4),
                    checkSum: H.getUint32(O),
                    Offset: H.getUint32(A),
                    Length: H.getUint32(C),
                }),
                    G.push(X);
            }
            G = G.sort(function (t, e) {
                var n = t.Tag.toString(),
                    r = e.Tag.toString();
                return n === r ? 0 : n < r ? -1 : 1;
            });
            var W = R + B * F,
                $ = W,
                Q = L + B * j,
                Z = new r(B * F);
            for (Y = 0; Y < B; ++Y) {
                if ('head' !== (X = G[Y]).Tag.toString())
                    if (s(new r(n.buffer, X.Offset, a(X.Length))) !== X.checkSum)
                        throw 'Checksum error in ' + X.Tag.toString();
                Z.setUint32(Y * F + b, X.Tag.getUint32(0)),
                    Z.setUint32(Y * F + S, X.Length),
                    Z.setUint32(Y * F + T, X.checkSum),
                    (Q += a(X.Length));
            }
            var J = L + G.length * j,
                K = s(new r(n.buffer, 0, L));
            for (Y = 0; Y < G.length; ++Y) {
                X = G[Y];
                var tt = new r(j);
                tt.setUint32(N, X.Tag.getUint32(0)),
                    tt.setUint32(O, X.checkSum),
                    tt.setUint32(A, J),
                    tt.setUint32(C, X.Length),
                    (J += a(X.Length)),
                    (K += s(tt)),
                    (K += X.checkSum);
            }
            var et,
                nt = o(P - K),
                rt = [];
            for (Y = 0; Y < G.length; ++Y) {
                X = G[Y];
                var it = new r(n.buffer, X.Offset, X.Length);
                'head' === X.Tag.toString() &&
                    ((z.maj = it.getUint16(M)), (z.min = it.getUint16(D)), (V = it.getUint32(I)), it.setUint32(U, nt));
                var ot,
                    at = i(it.toArray());
                et = a((ot = Math.min(at.length, it.length)));
                var st = new r(et);
                st.fill(0),
                    at.length >= it.length ? st.writeBytes(it.toArray()) : st.writeBytes(at),
                    Z.setUint32(Y * F + x, W),
                    (W += st.length),
                    ($ += st.length),
                    Z.setUint32(Y * F + E, ot),
                    rt.push(st);
            }
            q.setUint32(f, $), q.setUint32(p, Q), q.setUint16(d, z.maj), q.setUint16(v, z.min), q.setUint32(c, V);
            var ut = new r($);
            for (ut.writeBytes(q.buffer), ut.writeBytes(Z.buffer), Y = 0; Y < rt.length; Y++)
                ut.writeBytes(rt[Y].buffer);
            return e.metadata
                ? (function (t, e) {
                      var n = i(e);
                      t.setUint32(f, t.length + n.length),
                          t.setUint32(m, t.length),
                          t.setUint32(y, n.length),
                          t.setUint32(g, e.length);
                      var o = new r(t.length + n.length);
                      return o.writeBytes(t.toArray()), o.writeBytes(n), o;
                  })(ut, e.metadata)
                : ut;
        };
    },
    function (t, e, n) {
        'use strict';
        var r = n(83),
            i = n(10),
            o = n(87),
            a = n(23),
            s = n(88),
            u = Object.prototype.toString;
        function c(t) {
            if (!(this instanceof c)) return new c(t);
            this.options = i.assign(
                {
                    level: -1,
                    method: 8,
                    chunkSize: 16384,
                    windowBits: 15,
                    memLevel: 8,
                    strategy: 0,
                    to: '',
                },
                t || {},
            );
            var e = this.options;
            e.raw && e.windowBits > 0
                ? (e.windowBits = -e.windowBits)
                : e.gzip && e.windowBits > 0 && e.windowBits < 16 && (e.windowBits += 16),
                (this.err = 0),
                (this.msg = ''),
                (this.ended = !1),
                (this.chunks = []),
                (this.strm = new s()),
                (this.strm.avail_out = 0);
            var n = r.deflateInit2(this.strm, e.level, e.method, e.windowBits, e.memLevel, e.strategy);
            if (0 !== n) throw new Error(a[n]);
            if ((e.header && r.deflateSetHeader(this.strm, e.header), e.dictionary)) {
                var f;
                if (
                    ((f =
                        'string' == typeof e.dictionary
                            ? o.string2buf(e.dictionary)
                            : '[object ArrayBuffer]' === u.call(e.dictionary)
                              ? new Uint8Array(e.dictionary)
                              : e.dictionary),
                    0 !== (n = r.deflateSetDictionary(this.strm, f)))
                )
                    throw new Error(a[n]);
                this._dict_set = !0;
            }
        }
        function f(t, e) {
            var n = new c(e);
            if ((n.push(t, !0), n.err)) throw n.msg || a[n.err];
            return n.result;
        }
        (c.prototype.push = function (t, e) {
            var n,
                a,
                s = this.strm,
                c = this.options.chunkSize;
            if (this.ended) return !1;
            (a = e === ~~e ? e : !0 === e ? 4 : 0),
                'string' == typeof t
                    ? (s.input = o.string2buf(t))
                    : '[object ArrayBuffer]' === u.call(t)
                      ? (s.input = new Uint8Array(t))
                      : (s.input = t),
                (s.next_in = 0),
                (s.avail_in = s.input.length);
            do {
                if (
                    (0 === s.avail_out && ((s.output = new i.Buf8(c)), (s.next_out = 0), (s.avail_out = c)),
                    1 !== (n = r.deflate(s, a)) && 0 !== n)
                )
                    return this.onEnd(n), (this.ended = !0), !1;
                (0 !== s.avail_out && (0 !== s.avail_in || (4 !== a && 2 !== a))) ||
                    ('string' === this.options.to
                        ? this.onData(o.buf2binstring(i.shrinkBuf(s.output, s.next_out)))
                        : this.onData(i.shrinkBuf(s.output, s.next_out)));
            } while ((s.avail_in > 0 || 0 === s.avail_out) && 1 !== n);
            return 4 === a
                ? ((n = r.deflateEnd(this.strm)), this.onEnd(n), (this.ended = !0), 0 === n)
                : 2 !== a || (this.onEnd(0), (s.avail_out = 0), !0);
        }),
            (c.prototype.onData = function (t) {
                this.chunks.push(t);
            }),
            (c.prototype.onEnd = function (t) {
                0 === t &&
                    ('string' === this.options.to
                        ? (this.result = this.chunks.join(''))
                        : (this.result = i.flattenChunks(this.chunks))),
                    (this.chunks = []),
                    (this.err = t),
                    (this.msg = this.strm.msg);
            }),
            (e.Deflate = c),
            (e.deflate = f),
            (e.deflateRaw = function (t, e) {
                return ((e = e || {}).raw = !0), f(t, e);
            }),
            (e.gzip = function (t, e) {
                return ((e = e || {}).gzip = !0), f(t, e);
            });
    },
    function (t, e, n) {
        'use strict';
        var r,
            i = n(10),
            o = n(84),
            a = n(85),
            s = n(86),
            u = n(23);
        function c(t, e) {
            return (t.msg = u[e]), e;
        }
        function f(t) {
            return (t << 1) - (t > 4 ? 9 : 0);
        }
        function h(t) {
            for (var e = t.length; --e >= 0; ) t[e] = 0;
        }
        function l(t) {
            var e = t.state,
                n = e.pending;
            n > t.avail_out && (n = t.avail_out),
                0 !== n &&
                    (i.arraySet(t.output, e.pending_buf, e.pending_out, n, t.next_out),
                    (t.next_out += n),
                    (e.pending_out += n),
                    (t.total_out += n),
                    (t.avail_out -= n),
                    (e.pending -= n),
                    0 === e.pending && (e.pending_out = 0));
        }
        function p(t, e) {
            o._tr_flush_block(t, t.block_start >= 0 ? t.block_start : -1, t.strstart - t.block_start, e),
                (t.block_start = t.strstart),
                l(t.strm);
        }
        function d(t, e) {
            t.pending_buf[t.pending++] = e;
        }
        function v(t, e) {
            (t.pending_buf[t.pending++] = (e >>> 8) & 255), (t.pending_buf[t.pending++] = 255 & e);
        }
        function m(t, e) {
            var n,
                r,
                i = t.max_chain_length,
                o = t.strstart,
                a = t.prev_length,
                s = t.nice_match,
                u = t.strstart > t.w_size - 262 ? t.strstart - (t.w_size - 262) : 0,
                c = t.window,
                f = t.w_mask,
                h = t.prev,
                l = t.strstart + 258,
                p = c[o + a - 1],
                d = c[o + a];
            t.prev_length >= t.good_match && (i >>= 2), s > t.lookahead && (s = t.lookahead);
            do {
                if (c[(n = e) + a] === d && c[n + a - 1] === p && c[n] === c[o] && c[++n] === c[o + 1]) {
                    (o += 2), n++;
                    do {} while (
                        c[++o] === c[++n] &&
                        c[++o] === c[++n] &&
                        c[++o] === c[++n] &&
                        c[++o] === c[++n] &&
                        c[++o] === c[++n] &&
                        c[++o] === c[++n] &&
                        c[++o] === c[++n] &&
                        c[++o] === c[++n] &&
                        o < l
                    );
                    if (((r = 258 - (l - o)), (o = l - 258), r > a)) {
                        if (((t.match_start = e), (a = r), r >= s)) break;
                        (p = c[o + a - 1]), (d = c[o + a]);
                    }
                }
            } while ((e = h[e & f]) > u && 0 != --i);
            return a <= t.lookahead ? a : t.lookahead;
        }
        function y(t) {
            var e,
                n,
                r,
                o,
                u,
                c,
                f,
                h,
                l,
                p,
                d = t.w_size;
            do {
                if (((o = t.window_size - t.lookahead - t.strstart), t.strstart >= d + (d - 262))) {
                    i.arraySet(t.window, t.window, d, d, 0),
                        (t.match_start -= d),
                        (t.strstart -= d),
                        (t.block_start -= d),
                        (e = n = t.hash_size);
                    do {
                        (r = t.head[--e]), (t.head[e] = r >= d ? r - d : 0);
                    } while (--n);
                    e = n = d;
                    do {
                        (r = t.prev[--e]), (t.prev[e] = r >= d ? r - d : 0);
                    } while (--n);
                    o += d;
                }
                if (0 === t.strm.avail_in) break;
                if (
                    ((c = t.strm),
                    (f = t.window),
                    (h = t.strstart + t.lookahead),
                    (l = o),
                    (p = void 0),
                    (p = c.avail_in) > l && (p = l),
                    (n =
                        0 === p
                            ? 0
                            : ((c.avail_in -= p),
                              i.arraySet(f, c.input, c.next_in, p, h),
                              1 === c.state.wrap
                                  ? (c.adler = a(c.adler, f, p, h))
                                  : 2 === c.state.wrap && (c.adler = s(c.adler, f, p, h)),
                              (c.next_in += p),
                              (c.total_in += p),
                              p)),
                    (t.lookahead += n),
                    t.lookahead + t.insert >= 3)
                )
                    for (
                        u = t.strstart - t.insert,
                            t.ins_h = t.window[u],
                            t.ins_h = ((t.ins_h << t.hash_shift) ^ t.window[u + 1]) & t.hash_mask;
                        t.insert &&
                        ((t.ins_h = ((t.ins_h << t.hash_shift) ^ t.window[u + 3 - 1]) & t.hash_mask),
                        (t.prev[u & t.w_mask] = t.head[t.ins_h]),
                        (t.head[t.ins_h] = u),
                        u++,
                        t.insert--,
                        !(t.lookahead + t.insert < 3));

                    );
            } while (t.lookahead < 262 && 0 !== t.strm.avail_in);
        }
        function g(t, e) {
            for (var n, r; ; ) {
                if (t.lookahead < 262) {
                    if ((y(t), t.lookahead < 262 && 0 === e)) return 1;
                    if (0 === t.lookahead) break;
                }
                if (
                    ((n = 0),
                    t.lookahead >= 3 &&
                        ((t.ins_h = ((t.ins_h << t.hash_shift) ^ t.window[t.strstart + 3 - 1]) & t.hash_mask),
                        (n = t.prev[t.strstart & t.w_mask] = t.head[t.ins_h]),
                        (t.head[t.ins_h] = t.strstart)),
                    0 !== n && t.strstart - n <= t.w_size - 262 && (t.match_length = m(t, n)),
                    t.match_length >= 3)
                )
                    if (
                        ((r = o._tr_tally(t, t.strstart - t.match_start, t.match_length - 3)),
                        (t.lookahead -= t.match_length),
                        t.match_length <= t.max_lazy_match && t.lookahead >= 3)
                    ) {
                        t.match_length--;
                        do {
                            t.strstart++,
                                (t.ins_h = ((t.ins_h << t.hash_shift) ^ t.window[t.strstart + 3 - 1]) & t.hash_mask),
                                (n = t.prev[t.strstart & t.w_mask] = t.head[t.ins_h]),
                                (t.head[t.ins_h] = t.strstart);
                        } while (0 != --t.match_length);
                        t.strstart++;
                    } else
                        (t.strstart += t.match_length),
                            (t.match_length = 0),
                            (t.ins_h = t.window[t.strstart]),
                            (t.ins_h = ((t.ins_h << t.hash_shift) ^ t.window[t.strstart + 1]) & t.hash_mask);
                else (r = o._tr_tally(t, 0, t.window[t.strstart])), t.lookahead--, t.strstart++;
                if (r && (p(t, !1), 0 === t.strm.avail_out)) return 1;
            }
            return (
                (t.insert = t.strstart < 2 ? t.strstart : 2),
                4 === e
                    ? (p(t, !0), 0 === t.strm.avail_out ? 3 : 4)
                    : t.last_lit && (p(t, !1), 0 === t.strm.avail_out)
                      ? 1
                      : 2
            );
        }
        function _(t, e) {
            for (var n, r, i; ; ) {
                if (t.lookahead < 262) {
                    if ((y(t), t.lookahead < 262 && 0 === e)) return 1;
                    if (0 === t.lookahead) break;
                }
                if (
                    ((n = 0),
                    t.lookahead >= 3 &&
                        ((t.ins_h = ((t.ins_h << t.hash_shift) ^ t.window[t.strstart + 3 - 1]) & t.hash_mask),
                        (n = t.prev[t.strstart & t.w_mask] = t.head[t.ins_h]),
                        (t.head[t.ins_h] = t.strstart)),
                    (t.prev_length = t.match_length),
                    (t.prev_match = t.match_start),
                    (t.match_length = 2),
                    0 !== n &&
                        t.prev_length < t.max_lazy_match &&
                        t.strstart - n <= t.w_size - 262 &&
                        ((t.match_length = m(t, n)),
                        t.match_length <= 5 &&
                            (1 === t.strategy || (3 === t.match_length && t.strstart - t.match_start > 4096)) &&
                            (t.match_length = 2)),
                    t.prev_length >= 3 && t.match_length <= t.prev_length)
                ) {
                    (i = t.strstart + t.lookahead - 3),
                        (r = o._tr_tally(t, t.strstart - 1 - t.prev_match, t.prev_length - 3)),
                        (t.lookahead -= t.prev_length - 1),
                        (t.prev_length -= 2);
                    do {
                        ++t.strstart <= i &&
                            ((t.ins_h = ((t.ins_h << t.hash_shift) ^ t.window[t.strstart + 3 - 1]) & t.hash_mask),
                            (n = t.prev[t.strstart & t.w_mask] = t.head[t.ins_h]),
                            (t.head[t.ins_h] = t.strstart));
                    } while (0 != --t.prev_length);
                    if (
                        ((t.match_available = 0),
                        (t.match_length = 2),
                        t.strstart++,
                        r && (p(t, !1), 0 === t.strm.avail_out))
                    )
                        return 1;
                } else if (t.match_available) {
                    if (
                        ((r = o._tr_tally(t, 0, t.window[t.strstart - 1])) && p(t, !1),
                        t.strstart++,
                        t.lookahead--,
                        0 === t.strm.avail_out)
                    )
                        return 1;
                } else (t.match_available = 1), t.strstart++, t.lookahead--;
            }
            return (
                t.match_available && ((r = o._tr_tally(t, 0, t.window[t.strstart - 1])), (t.match_available = 0)),
                (t.insert = t.strstart < 2 ? t.strstart : 2),
                4 === e
                    ? (p(t, !0), 0 === t.strm.avail_out ? 3 : 4)
                    : t.last_lit && (p(t, !1), 0 === t.strm.avail_out)
                      ? 1
                      : 2
            );
        }
        function w(t, e, n, r, i) {
            (this.good_length = t), (this.max_lazy = e), (this.nice_length = n), (this.max_chain = r), (this.func = i);
        }
        function b() {
            (this.strm = null),
                (this.status = 0),
                (this.pending_buf = null),
                (this.pending_buf_size = 0),
                (this.pending_out = 0),
                (this.pending = 0),
                (this.wrap = 0),
                (this.gzhead = null),
                (this.gzindex = 0),
                (this.method = 8),
                (this.last_flush = -1),
                (this.w_size = 0),
                (this.w_bits = 0),
                (this.w_mask = 0),
                (this.window = null),
                (this.window_size = 0),
                (this.prev = null),
                (this.head = null),
                (this.ins_h = 0),
                (this.hash_size = 0),
                (this.hash_bits = 0),
                (this.hash_mask = 0),
                (this.hash_shift = 0),
                (this.block_start = 0),
                (this.match_length = 0),
                (this.prev_match = 0),
                (this.match_available = 0),
                (this.strstart = 0),
                (this.match_start = 0),
                (this.lookahead = 0),
                (this.prev_length = 0),
                (this.max_chain_length = 0),
                (this.max_lazy_match = 0),
                (this.level = 0),
                (this.strategy = 0),
                (this.good_match = 0),
                (this.nice_match = 0),
                (this.dyn_ltree = new i.Buf16(1146)),
                (this.dyn_dtree = new i.Buf16(122)),
                (this.bl_tree = new i.Buf16(78)),
                h(this.dyn_ltree),
                h(this.dyn_dtree),
                h(this.bl_tree),
                (this.l_desc = null),
                (this.d_desc = null),
                (this.bl_desc = null),
                (this.bl_count = new i.Buf16(16)),
                (this.heap = new i.Buf16(573)),
                h(this.heap),
                (this.heap_len = 0),
                (this.heap_max = 0),
                (this.depth = new i.Buf16(573)),
                h(this.depth),
                (this.l_buf = 0),
                (this.lit_bufsize = 0),
                (this.last_lit = 0),
                (this.d_buf = 0),
                (this.opt_len = 0),
                (this.static_len = 0),
                (this.matches = 0),
                (this.insert = 0),
                (this.bi_buf = 0),
                (this.bi_valid = 0);
        }
        function x(t) {
            var e;
            return t && t.state
                ? ((t.total_in = t.total_out = 0),
                  (t.data_type = 2),
                  ((e = t.state).pending = 0),
                  (e.pending_out = 0),
                  e.wrap < 0 && (e.wrap = -e.wrap),
                  (e.status = e.wrap ? 42 : 113),
                  (t.adler = 2 === e.wrap ? 0 : 1),
                  (e.last_flush = 0),
                  o._tr_init(e),
                  0)
                : c(t, -2);
        }
        function E(t) {
            var e,
                n = x(t);
            return (
                0 === n &&
                    (((e = t.state).window_size = 2 * e.w_size),
                    h(e.head),
                    (e.max_lazy_match = r[e.level].max_lazy),
                    (e.good_match = r[e.level].good_length),
                    (e.nice_match = r[e.level].nice_length),
                    (e.max_chain_length = r[e.level].max_chain),
                    (e.strstart = 0),
                    (e.block_start = 0),
                    (e.lookahead = 0),
                    (e.insert = 0),
                    (e.match_length = e.prev_length = 2),
                    (e.match_available = 0),
                    (e.ins_h = 0)),
                n
            );
        }
        function S(t, e, n, r, o, a) {
            if (!t) return -2;
            var s = 1;
            if (
                (-1 === e && (e = 6),
                r < 0 ? ((s = 0), (r = -r)) : r > 15 && ((s = 2), (r -= 16)),
                o < 1 || o > 9 || 8 !== n || r < 8 || r > 15 || e < 0 || e > 9 || a < 0 || a > 4)
            )
                return c(t, -2);
            8 === r && (r = 9);
            var u = new b();
            return (
                (t.state = u),
                (u.strm = t),
                (u.wrap = s),
                (u.gzhead = null),
                (u.w_bits = r),
                (u.w_size = 1 << u.w_bits),
                (u.w_mask = u.w_size - 1),
                (u.hash_bits = o + 7),
                (u.hash_size = 1 << u.hash_bits),
                (u.hash_mask = u.hash_size - 1),
                (u.hash_shift = ~~((u.hash_bits + 3 - 1) / 3)),
                (u.window = new i.Buf8(2 * u.w_size)),
                (u.head = new i.Buf16(u.hash_size)),
                (u.prev = new i.Buf16(u.w_size)),
                (u.lit_bufsize = 1 << (o + 6)),
                (u.pending_buf_size = 4 * u.lit_bufsize),
                (u.pending_buf = new i.Buf8(u.pending_buf_size)),
                (u.d_buf = 1 * u.lit_bufsize),
                (u.l_buf = 3 * u.lit_bufsize),
                (u.level = e),
                (u.strategy = a),
                (u.method = n),
                E(t)
            );
        }
        (r = [
            new w(0, 0, 0, 0, function (t, e) {
                var n = 65535;
                for (n > t.pending_buf_size - 5 && (n = t.pending_buf_size - 5); ; ) {
                    if (t.lookahead <= 1) {
                        if ((y(t), 0 === t.lookahead && 0 === e)) return 1;
                        if (0 === t.lookahead) break;
                    }
                    (t.strstart += t.lookahead), (t.lookahead = 0);
                    var r = t.block_start + n;
                    if (
                        (0 === t.strstart || t.strstart >= r) &&
                        ((t.lookahead = t.strstart - r), (t.strstart = r), p(t, !1), 0 === t.strm.avail_out)
                    )
                        return 1;
                    if (t.strstart - t.block_start >= t.w_size - 262 && (p(t, !1), 0 === t.strm.avail_out)) return 1;
                }
                return (
                    (t.insert = 0),
                    4 === e
                        ? (p(t, !0), 0 === t.strm.avail_out ? 3 : 4)
                        : (t.strstart > t.block_start && (p(t, !1), t.strm.avail_out), 1)
                );
            }),
            new w(4, 4, 8, 4, g),
            new w(4, 5, 16, 8, g),
            new w(4, 6, 32, 32, g),
            new w(4, 4, 16, 16, _),
            new w(8, 16, 32, 32, _),
            new w(8, 16, 128, 128, _),
            new w(8, 32, 128, 256, _),
            new w(32, 128, 258, 1024, _),
            new w(32, 258, 258, 4096, _),
        ]),
            (e.deflateInit = function (t, e) {
                return S(t, e, 8, 15, 8, 0);
            }),
            (e.deflateInit2 = S),
            (e.deflateReset = E),
            (e.deflateResetKeep = x),
            (e.deflateSetHeader = function (t, e) {
                return t && t.state ? (2 !== t.state.wrap ? -2 : ((t.state.gzhead = e), 0)) : -2;
            }),
            (e.deflate = function (t, e) {
                var n, i, a, u;
                if (!t || !t.state || e > 5 || e < 0) return t ? c(t, -2) : -2;
                if (((i = t.state), !t.output || (!t.input && 0 !== t.avail_in) || (666 === i.status && 4 !== e)))
                    return c(t, 0 === t.avail_out ? -5 : -2);
                if (((i.strm = t), (n = i.last_flush), (i.last_flush = e), 42 === i.status))
                    if (2 === i.wrap)
                        (t.adler = 0),
                            d(i, 31),
                            d(i, 139),
                            d(i, 8),
                            i.gzhead
                                ? (d(
                                      i,
                                      (i.gzhead.text ? 1 : 0) +
                                          (i.gzhead.hcrc ? 2 : 0) +
                                          (i.gzhead.extra ? 4 : 0) +
                                          (i.gzhead.name ? 8 : 0) +
                                          (i.gzhead.comment ? 16 : 0),
                                  ),
                                  d(i, 255 & i.gzhead.time),
                                  d(i, (i.gzhead.time >> 8) & 255),
                                  d(i, (i.gzhead.time >> 16) & 255),
                                  d(i, (i.gzhead.time >> 24) & 255),
                                  d(i, 9 === i.level ? 2 : i.strategy >= 2 || i.level < 2 ? 4 : 0),
                                  d(i, 255 & i.gzhead.os),
                                  i.gzhead.extra &&
                                      i.gzhead.extra.length &&
                                      (d(i, 255 & i.gzhead.extra.length), d(i, (i.gzhead.extra.length >> 8) & 255)),
                                  i.gzhead.hcrc && (t.adler = s(t.adler, i.pending_buf, i.pending, 0)),
                                  (i.gzindex = 0),
                                  (i.status = 69))
                                : (d(i, 0),
                                  d(i, 0),
                                  d(i, 0),
                                  d(i, 0),
                                  d(i, 0),
                                  d(i, 9 === i.level ? 2 : i.strategy >= 2 || i.level < 2 ? 4 : 0),
                                  d(i, 3),
                                  (i.status = 113));
                    else {
                        var m = (8 + ((i.w_bits - 8) << 4)) << 8;
                        (m |= (i.strategy >= 2 || i.level < 2 ? 0 : i.level < 6 ? 1 : 6 === i.level ? 2 : 3) << 6),
                            0 !== i.strstart && (m |= 32),
                            (m += 31 - (m % 31)),
                            (i.status = 113),
                            v(i, m),
                            0 !== i.strstart && (v(i, t.adler >>> 16), v(i, 65535 & t.adler)),
                            (t.adler = 1);
                    }
                if (69 === i.status)
                    if (i.gzhead.extra) {
                        for (
                            a = i.pending;
                            i.gzindex < (65535 & i.gzhead.extra.length) &&
                            (i.pending !== i.pending_buf_size ||
                                (i.gzhead.hcrc &&
                                    i.pending > a &&
                                    (t.adler = s(t.adler, i.pending_buf, i.pending - a, a)),
                                l(t),
                                (a = i.pending),
                                i.pending !== i.pending_buf_size));

                        )
                            d(i, 255 & i.gzhead.extra[i.gzindex]), i.gzindex++;
                        i.gzhead.hcrc && i.pending > a && (t.adler = s(t.adler, i.pending_buf, i.pending - a, a)),
                            i.gzindex === i.gzhead.extra.length && ((i.gzindex = 0), (i.status = 73));
                    } else i.status = 73;
                if (73 === i.status)
                    if (i.gzhead.name) {
                        a = i.pending;
                        do {
                            if (
                                i.pending === i.pending_buf_size &&
                                (i.gzhead.hcrc &&
                                    i.pending > a &&
                                    (t.adler = s(t.adler, i.pending_buf, i.pending - a, a)),
                                l(t),
                                (a = i.pending),
                                i.pending === i.pending_buf_size)
                            ) {
                                u = 1;
                                break;
                            }
                            (u = i.gzindex < i.gzhead.name.length ? 255 & i.gzhead.name.charCodeAt(i.gzindex++) : 0),
                                d(i, u);
                        } while (0 !== u);
                        i.gzhead.hcrc && i.pending > a && (t.adler = s(t.adler, i.pending_buf, i.pending - a, a)),
                            0 === u && ((i.gzindex = 0), (i.status = 91));
                    } else i.status = 91;
                if (91 === i.status)
                    if (i.gzhead.comment) {
                        a = i.pending;
                        do {
                            if (
                                i.pending === i.pending_buf_size &&
                                (i.gzhead.hcrc &&
                                    i.pending > a &&
                                    (t.adler = s(t.adler, i.pending_buf, i.pending - a, a)),
                                l(t),
                                (a = i.pending),
                                i.pending === i.pending_buf_size)
                            ) {
                                u = 1;
                                break;
                            }
                            (u =
                                i.gzindex < i.gzhead.comment.length
                                    ? 255 & i.gzhead.comment.charCodeAt(i.gzindex++)
                                    : 0),
                                d(i, u);
                        } while (0 !== u);
                        i.gzhead.hcrc && i.pending > a && (t.adler = s(t.adler, i.pending_buf, i.pending - a, a)),
                            0 === u && (i.status = 103);
                    } else i.status = 103;
                if (
                    (103 === i.status &&
                        (i.gzhead.hcrc
                            ? (i.pending + 2 > i.pending_buf_size && l(t),
                              i.pending + 2 <= i.pending_buf_size &&
                                  (d(i, 255 & t.adler), d(i, (t.adler >> 8) & 255), (t.adler = 0), (i.status = 113)))
                            : (i.status = 113)),
                    0 !== i.pending)
                ) {
                    if ((l(t), 0 === t.avail_out)) return (i.last_flush = -1), 0;
                } else if (0 === t.avail_in && f(e) <= f(n) && 4 !== e) return c(t, -5);
                if (666 === i.status && 0 !== t.avail_in) return c(t, -5);
                if (0 !== t.avail_in || 0 !== i.lookahead || (0 !== e && 666 !== i.status)) {
                    var g =
                        2 === i.strategy
                            ? (function (t, e) {
                                  for (var n; ; ) {
                                      if (0 === t.lookahead && (y(t), 0 === t.lookahead)) {
                                          if (0 === e) return 1;
                                          break;
                                      }
                                      if (
                                          ((t.match_length = 0),
                                          (n = o._tr_tally(t, 0, t.window[t.strstart])),
                                          t.lookahead--,
                                          t.strstart++,
                                          n && (p(t, !1), 0 === t.strm.avail_out))
                                      )
                                          return 1;
                                  }
                                  return (
                                      (t.insert = 0),
                                      4 === e
                                          ? (p(t, !0), 0 === t.strm.avail_out ? 3 : 4)
                                          : t.last_lit && (p(t, !1), 0 === t.strm.avail_out)
                                            ? 1
                                            : 2
                                  );
                              })(i, e)
                            : 3 === i.strategy
                              ? (function (t, e) {
                                    for (var n, r, i, a, s = t.window; ; ) {
                                        if (t.lookahead <= 258) {
                                            if ((y(t), t.lookahead <= 258 && 0 === e)) return 1;
                                            if (0 === t.lookahead) break;
                                        }
                                        if (
                                            ((t.match_length = 0),
                                            t.lookahead >= 3 &&
                                                t.strstart > 0 &&
                                                (r = s[(i = t.strstart - 1)]) === s[++i] &&
                                                r === s[++i] &&
                                                r === s[++i])
                                        ) {
                                            a = t.strstart + 258;
                                            do {} while (
                                                r === s[++i] &&
                                                r === s[++i] &&
                                                r === s[++i] &&
                                                r === s[++i] &&
                                                r === s[++i] &&
                                                r === s[++i] &&
                                                r === s[++i] &&
                                                r === s[++i] &&
                                                i < a
                                            );
                                            (t.match_length = 258 - (a - i)),
                                                t.match_length > t.lookahead && (t.match_length = t.lookahead);
                                        }
                                        if (
                                            (t.match_length >= 3
                                                ? ((n = o._tr_tally(t, 1, t.match_length - 3)),
                                                  (t.lookahead -= t.match_length),
                                                  (t.strstart += t.match_length),
                                                  (t.match_length = 0))
                                                : ((n = o._tr_tally(t, 0, t.window[t.strstart])),
                                                  t.lookahead--,
                                                  t.strstart++),
                                            n && (p(t, !1), 0 === t.strm.avail_out))
                                        )
                                            return 1;
                                    }
                                    return (
                                        (t.insert = 0),
                                        4 === e
                                            ? (p(t, !0), 0 === t.strm.avail_out ? 3 : 4)
                                            : t.last_lit && (p(t, !1), 0 === t.strm.avail_out)
                                              ? 1
                                              : 2
                                    );
                                })(i, e)
                              : r[i.level].func(i, e);
                    if (((3 !== g && 4 !== g) || (i.status = 666), 1 === g || 3 === g))
                        return 0 === t.avail_out && (i.last_flush = -1), 0;
                    if (
                        2 === g &&
                        (1 === e
                            ? o._tr_align(i)
                            : 5 !== e &&
                              (o._tr_stored_block(i, 0, 0, !1),
                              3 === e &&
                                  (h(i.head),
                                  0 === i.lookahead && ((i.strstart = 0), (i.block_start = 0), (i.insert = 0)))),
                        l(t),
                        0 === t.avail_out)
                    )
                        return (i.last_flush = -1), 0;
                }
                return 4 !== e
                    ? 0
                    : i.wrap <= 0
                      ? 1
                      : (2 === i.wrap
                            ? (d(i, 255 & t.adler),
                              d(i, (t.adler >> 8) & 255),
                              d(i, (t.adler >> 16) & 255),
                              d(i, (t.adler >> 24) & 255),
                              d(i, 255 & t.total_in),
                              d(i, (t.total_in >> 8) & 255),
                              d(i, (t.total_in >> 16) & 255),
                              d(i, (t.total_in >> 24) & 255))
                            : (v(i, t.adler >>> 16), v(i, 65535 & t.adler)),
                        l(t),
                        i.wrap > 0 && (i.wrap = -i.wrap),
                        0 !== i.pending ? 0 : 1);
            }),
            (e.deflateEnd = function (t) {
                var e;
                return t && t.state
                    ? 42 !== (e = t.state.status) &&
                      69 !== e &&
                      73 !== e &&
                      91 !== e &&
                      103 !== e &&
                      113 !== e &&
                      666 !== e
                        ? c(t, -2)
                        : ((t.state = null), 113 === e ? c(t, -3) : 0)
                    : -2;
            }),
            (e.deflateSetDictionary = function (t, e) {
                var n,
                    r,
                    o,
                    s,
                    u,
                    c,
                    f,
                    l,
                    p = e.length;
                if (!t || !t.state) return -2;
                if (2 === (s = (n = t.state).wrap) || (1 === s && 42 !== n.status) || n.lookahead) return -2;
                for (
                    1 === s && (t.adler = a(t.adler, e, p, 0)),
                        n.wrap = 0,
                        p >= n.w_size &&
                            (0 === s && (h(n.head), (n.strstart = 0), (n.block_start = 0), (n.insert = 0)),
                            (l = new i.Buf8(n.w_size)),
                            i.arraySet(l, e, p - n.w_size, n.w_size, 0),
                            (e = l),
                            (p = n.w_size)),
                        u = t.avail_in,
                        c = t.next_in,
                        f = t.input,
                        t.avail_in = p,
                        t.next_in = 0,
                        t.input = e,
                        y(n);
                    n.lookahead >= 3;

                ) {
                    (r = n.strstart), (o = n.lookahead - 2);
                    do {
                        (n.ins_h = ((n.ins_h << n.hash_shift) ^ n.window[r + 3 - 1]) & n.hash_mask),
                            (n.prev[r & n.w_mask] = n.head[n.ins_h]),
                            (n.head[n.ins_h] = r),
                            r++;
                    } while (--o);
                    (n.strstart = r), (n.lookahead = 2), y(n);
                }
                return (
                    (n.strstart += n.lookahead),
                    (n.block_start = n.strstart),
                    (n.insert = n.lookahead),
                    (n.lookahead = 0),
                    (n.match_length = n.prev_length = 2),
                    (n.match_available = 0),
                    (t.next_in = c),
                    (t.input = f),
                    (t.avail_in = u),
                    (n.wrap = s),
                    0
                );
            }),
            (e.deflateInfo = 'pako deflate (from Nodeca project)');
    },
    function (t, e, n) {
        'use strict';
        var r = n(10);
        function i(t) {
            for (var e = t.length; --e >= 0; ) t[e] = 0;
        }
        var o = [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0],
            a = [0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13],
            s = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 3, 7],
            u = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15],
            c = new Array(576);
        i(c);
        var f = new Array(60);
        i(f);
        var h = new Array(512);
        i(h);
        var l = new Array(256);
        i(l);
        var p = new Array(29);
        i(p);
        var d,
            v,
            m,
            y = new Array(30);
        function g(t, e, n, r, i) {
            (this.static_tree = t),
                (this.extra_bits = e),
                (this.extra_base = n),
                (this.elems = r),
                (this.max_length = i),
                (this.has_stree = t && t.length);
        }
        function _(t, e) {
            (this.dyn_tree = t), (this.max_code = 0), (this.stat_desc = e);
        }
        function w(t) {
            return t < 256 ? h[t] : h[256 + (t >>> 7)];
        }
        function b(t, e) {
            (t.pending_buf[t.pending++] = 255 & e), (t.pending_buf[t.pending++] = (e >>> 8) & 255);
        }
        function x(t, e, n) {
            t.bi_valid > 16 - n
                ? ((t.bi_buf |= (e << t.bi_valid) & 65535),
                  b(t, t.bi_buf),
                  (t.bi_buf = e >> (16 - t.bi_valid)),
                  (t.bi_valid += n - 16))
                : ((t.bi_buf |= (e << t.bi_valid) & 65535), (t.bi_valid += n));
        }
        function E(t, e, n) {
            x(t, n[2 * e], n[2 * e + 1]);
        }
        function S(t, e) {
            var n = 0;
            do {
                (n |= 1 & t), (t >>>= 1), (n <<= 1);
            } while (--e > 0);
            return n >>> 1;
        }
        function T(t, e, n) {
            var r,
                i,
                o = new Array(16),
                a = 0;
            for (r = 1; r <= 15; r++) o[r] = a = (a + n[r - 1]) << 1;
            for (i = 0; i <= e; i++) {
                var s = t[2 * i + 1];
                0 !== s && (t[2 * i] = S(o[s]++, s));
            }
        }
        function N(t) {
            var e;
            for (e = 0; e < 286; e++) t.dyn_ltree[2 * e] = 0;
            for (e = 0; e < 30; e++) t.dyn_dtree[2 * e] = 0;
            for (e = 0; e < 19; e++) t.bl_tree[2 * e] = 0;
            (t.dyn_ltree[512] = 1), (t.opt_len = t.static_len = 0), (t.last_lit = t.matches = 0);
        }
        function O(t) {
            t.bi_valid > 8 ? b(t, t.bi_buf) : t.bi_valid > 0 && (t.pending_buf[t.pending++] = t.bi_buf),
                (t.bi_buf = 0),
                (t.bi_valid = 0);
        }
        function A(t, e, n, r) {
            var i = 2 * e,
                o = 2 * n;
            return t[i] < t[o] || (t[i] === t[o] && r[e] <= r[n]);
        }
        function C(t, e, n) {
            for (
                var r = t.heap[n], i = n << 1;
                i <= t.heap_len &&
                (i < t.heap_len && A(e, t.heap[i + 1], t.heap[i], t.depth) && i++, !A(e, r, t.heap[i], t.depth));

            )
                (t.heap[n] = t.heap[i]), (n = i), (i <<= 1);
            t.heap[n] = r;
        }
        function I(t, e, n) {
            var r,
                i,
                s,
                u,
                c = 0;
            if (0 !== t.last_lit)
                do {
                    (r = (t.pending_buf[t.d_buf + 2 * c] << 8) | t.pending_buf[t.d_buf + 2 * c + 1]),
                        (i = t.pending_buf[t.l_buf + c]),
                        c++,
                        0 === r
                            ? E(t, i, e)
                            : (E(t, (s = l[i]) + 256 + 1, e),
                              0 !== (u = o[s]) && x(t, (i -= p[s]), u),
                              E(t, (s = w(--r)), n),
                              0 !== (u = a[s]) && x(t, (r -= y[s]), u));
                } while (c < t.last_lit);
            E(t, 256, e);
        }
        function M(t, e) {
            var n,
                r,
                i,
                o = e.dyn_tree,
                a = e.stat_desc.static_tree,
                s = e.stat_desc.has_stree,
                u = e.stat_desc.elems,
                c = -1;
            for (t.heap_len = 0, t.heap_max = 573, n = 0; n < u; n++)
                0 !== o[2 * n] ? ((t.heap[++t.heap_len] = c = n), (t.depth[n] = 0)) : (o[2 * n + 1] = 0);
            for (; t.heap_len < 2; )
                (o[2 * (i = t.heap[++t.heap_len] = c < 2 ? ++c : 0)] = 1),
                    (t.depth[i] = 0),
                    t.opt_len--,
                    s && (t.static_len -= a[2 * i + 1]);
            for (e.max_code = c, n = t.heap_len >> 1; n >= 1; n--) C(t, o, n);
            i = u;
            do {
                (n = t.heap[1]),
                    (t.heap[1] = t.heap[t.heap_len--]),
                    C(t, o, 1),
                    (r = t.heap[1]),
                    (t.heap[--t.heap_max] = n),
                    (t.heap[--t.heap_max] = r),
                    (o[2 * i] = o[2 * n] + o[2 * r]),
                    (t.depth[i] = (t.depth[n] >= t.depth[r] ? t.depth[n] : t.depth[r]) + 1),
                    (o[2 * n + 1] = o[2 * r + 1] = i),
                    (t.heap[1] = i++),
                    C(t, o, 1);
            } while (t.heap_len >= 2);
            (t.heap[--t.heap_max] = t.heap[1]),
                (function (t, e) {
                    var n,
                        r,
                        i,
                        o,
                        a,
                        s,
                        u = e.dyn_tree,
                        c = e.max_code,
                        f = e.stat_desc.static_tree,
                        h = e.stat_desc.has_stree,
                        l = e.stat_desc.extra_bits,
                        p = e.stat_desc.extra_base,
                        d = e.stat_desc.max_length,
                        v = 0;
                    for (o = 0; o <= 15; o++) t.bl_count[o] = 0;
                    for (u[2 * t.heap[t.heap_max] + 1] = 0, n = t.heap_max + 1; n < 573; n++)
                        (o = u[2 * u[2 * (r = t.heap[n]) + 1] + 1] + 1) > d && ((o = d), v++),
                            (u[2 * r + 1] = o),
                            r > c ||
                                (t.bl_count[o]++,
                                (a = 0),
                                r >= p && (a = l[r - p]),
                                (s = u[2 * r]),
                                (t.opt_len += s * (o + a)),
                                h && (t.static_len += s * (f[2 * r + 1] + a)));
                    if (0 !== v) {
                        do {
                            for (o = d - 1; 0 === t.bl_count[o]; ) o--;
                            t.bl_count[o]--, (t.bl_count[o + 1] += 2), t.bl_count[d]--, (v -= 2);
                        } while (v > 0);
                        for (o = d; 0 !== o; o--)
                            for (r = t.bl_count[o]; 0 !== r; )
                                (i = t.heap[--n]) > c ||
                                    (u[2 * i + 1] !== o &&
                                        ((t.opt_len += (o - u[2 * i + 1]) * u[2 * i]), (u[2 * i + 1] = o)),
                                    r--);
                    }
                })(t, e),
                T(o, c, t.bl_count);
        }
        function D(t, e, n) {
            var r,
                i,
                o = -1,
                a = e[1],
                s = 0,
                u = 7,
                c = 4;
            for (0 === a && ((u = 138), (c = 3)), e[2 * (n + 1) + 1] = 65535, r = 0; r <= n; r++)
                (i = a),
                    (a = e[2 * (r + 1) + 1]),
                    (++s < u && i === a) ||
                        (s < c
                            ? (t.bl_tree[2 * i] += s)
                            : 0 !== i
                              ? (i !== o && t.bl_tree[2 * i]++, t.bl_tree[32]++)
                              : s <= 10
                                ? t.bl_tree[34]++
                                : t.bl_tree[36]++,
                        (s = 0),
                        (o = i),
                        0 === a ? ((u = 138), (c = 3)) : i === a ? ((u = 6), (c = 3)) : ((u = 7), (c = 4)));
        }
        function U(t, e, n) {
            var r,
                i,
                o = -1,
                a = e[1],
                s = 0,
                u = 7,
                c = 4;
            for (0 === a && ((u = 138), (c = 3)), r = 0; r <= n; r++)
                if (((i = a), (a = e[2 * (r + 1) + 1]), !(++s < u && i === a))) {
                    if (s < c)
                        do {
                            E(t, i, t.bl_tree);
                        } while (0 != --s);
                    else
                        0 !== i
                            ? (i !== o && (E(t, i, t.bl_tree), s--), E(t, 16, t.bl_tree), x(t, s - 3, 2))
                            : s <= 10
                              ? (E(t, 17, t.bl_tree), x(t, s - 3, 3))
                              : (E(t, 18, t.bl_tree), x(t, s - 11, 7));
                    (s = 0),
                        (o = i),
                        0 === a ? ((u = 138), (c = 3)) : i === a ? ((u = 6), (c = 3)) : ((u = 7), (c = 4));
                }
        }
        i(y);
        var k = !1;
        function P(t, e, n, i) {
            x(t, 0 + (i ? 1 : 0), 3),
                (function (t, e, n, i) {
                    O(t),
                        i && (b(t, n), b(t, ~n)),
                        r.arraySet(t.pending_buf, t.window, e, n, t.pending),
                        (t.pending += n);
                })(t, e, n, !0);
        }
        (e._tr_init = function (t) {
            k ||
                (!(function () {
                    var t,
                        e,
                        n,
                        r,
                        i,
                        u = new Array(16);
                    for (n = 0, r = 0; r < 28; r++) for (p[r] = n, t = 0; t < 1 << o[r]; t++) l[n++] = r;
                    for (l[n - 1] = r, i = 0, r = 0; r < 16; r++) for (y[r] = i, t = 0; t < 1 << a[r]; t++) h[i++] = r;
                    for (i >>= 7; r < 30; r++) for (y[r] = i << 7, t = 0; t < 1 << (a[r] - 7); t++) h[256 + i++] = r;
                    for (e = 0; e <= 15; e++) u[e] = 0;
                    for (t = 0; t <= 143; ) (c[2 * t + 1] = 8), t++, u[8]++;
                    for (; t <= 255; ) (c[2 * t + 1] = 9), t++, u[9]++;
                    for (; t <= 279; ) (c[2 * t + 1] = 7), t++, u[7]++;
                    for (; t <= 287; ) (c[2 * t + 1] = 8), t++, u[8]++;
                    for (T(c, 287, u), t = 0; t < 30; t++) (f[2 * t + 1] = 5), (f[2 * t] = S(t, 5));
                    (d = new g(c, o, 257, 286, 15)),
                        (v = new g(f, a, 0, 30, 15)),
                        (m = new g(new Array(0), s, 0, 19, 7));
                })(),
                (k = !0)),
                (t.l_desc = new _(t.dyn_ltree, d)),
                (t.d_desc = new _(t.dyn_dtree, v)),
                (t.bl_desc = new _(t.bl_tree, m)),
                (t.bi_buf = 0),
                (t.bi_valid = 0),
                N(t);
        }),
            (e._tr_stored_block = P),
            (e._tr_flush_block = function (t, e, n, r) {
                var i,
                    o,
                    a = 0;
                t.level > 0
                    ? (2 === t.strm.data_type &&
                          (t.strm.data_type = (function (t) {
                              var e,
                                  n = 4093624447;
                              for (e = 0; e <= 31; e++, n >>>= 1) if (1 & n && 0 !== t.dyn_ltree[2 * e]) return 0;
                              if (0 !== t.dyn_ltree[18] || 0 !== t.dyn_ltree[20] || 0 !== t.dyn_ltree[26]) return 1;
                              for (e = 32; e < 256; e++) if (0 !== t.dyn_ltree[2 * e]) return 1;
                              return 0;
                          })(t)),
                      M(t, t.l_desc),
                      M(t, t.d_desc),
                      (a = (function (t) {
                          var e;
                          for (
                              D(t, t.dyn_ltree, t.l_desc.max_code),
                                  D(t, t.dyn_dtree, t.d_desc.max_code),
                                  M(t, t.bl_desc),
                                  e = 18;
                              e >= 3 && 0 === t.bl_tree[2 * u[e] + 1];
                              e--
                          );
                          return (t.opt_len += 3 * (e + 1) + 5 + 5 + 4), e;
                      })(t)),
                      (i = (t.opt_len + 3 + 7) >>> 3),
                      (o = (t.static_len + 3 + 7) >>> 3) <= i && (i = o))
                    : (i = o = n + 5),
                    n + 4 <= i && -1 !== e
                        ? P(t, e, n, r)
                        : 4 === t.strategy || o === i
                          ? (x(t, 2 + (r ? 1 : 0), 3), I(t, c, f))
                          : (x(t, 4 + (r ? 1 : 0), 3),
                            (function (t, e, n, r) {
                                var i;
                                for (x(t, e - 257, 5), x(t, n - 1, 5), x(t, r - 4, 4), i = 0; i < r; i++)
                                    x(t, t.bl_tree[2 * u[i] + 1], 3);
                                U(t, t.dyn_ltree, e - 1), U(t, t.dyn_dtree, n - 1);
                            })(t, t.l_desc.max_code + 1, t.d_desc.max_code + 1, a + 1),
                            I(t, t.dyn_ltree, t.dyn_dtree)),
                    N(t),
                    r && O(t);
            }),
            (e._tr_tally = function (t, e, n) {
                return (
                    (t.pending_buf[t.d_buf + 2 * t.last_lit] = (e >>> 8) & 255),
                    (t.pending_buf[t.d_buf + 2 * t.last_lit + 1] = 255 & e),
                    (t.pending_buf[t.l_buf + t.last_lit] = 255 & n),
                    t.last_lit++,
                    0 === e
                        ? t.dyn_ltree[2 * n]++
                        : (t.matches++, e--, t.dyn_ltree[2 * (l[n] + 256 + 1)]++, t.dyn_dtree[2 * w(e)]++),
                    t.last_lit === t.lit_bufsize - 1
                );
            }),
            (e._tr_align = function (t) {
                x(t, 2, 3),
                    E(t, 256, c),
                    (function (t) {
                        16 === t.bi_valid
                            ? (b(t, t.bi_buf), (t.bi_buf = 0), (t.bi_valid = 0))
                            : t.bi_valid >= 8 &&
                              ((t.pending_buf[t.pending++] = 255 & t.bi_buf), (t.bi_buf >>= 8), (t.bi_valid -= 8));
                    })(t);
            });
    },
    function (t, e, n) {
        'use strict';
        t.exports = function (t, e, n, r) {
            for (var i = (65535 & t) | 0, o = ((t >>> 16) & 65535) | 0, a = 0; 0 !== n; ) {
                n -= a = n > 2e3 ? 2e3 : n;
                do {
                    o = (o + (i = (i + e[r++]) | 0)) | 0;
                } while (--a);
                (i %= 65521), (o %= 65521);
            }
            return i | (o << 16) | 0;
        };
    },
    function (t, e, n) {
        'use strict';
        var r = (function () {
            for (var t, e = [], n = 0; n < 256; n++) {
                t = n;
                for (var r = 0; r < 8; r++) t = 1 & t ? 3988292384 ^ (t >>> 1) : t >>> 1;
                e[n] = t;
            }
            return e;
        })();
        t.exports = function (t, e, n, i) {
            var o = r,
                a = i + n;
            t ^= -1;
            for (var s = i; s < a; s++) t = (t >>> 8) ^ o[255 & (t ^ e[s])];
            return -1 ^ t;
        };
    },
    function (t, e, n) {
        'use strict';
        var r = n(10),
            i = !0,
            o = !0;
        try {
            String.fromCharCode.apply(null, [0]);
        } catch (t) {
            i = !1;
        }
        try {
            String.fromCharCode.apply(null, new Uint8Array(1));
        } catch (t) {
            o = !1;
        }
        for (var a = new r.Buf8(256), s = 0; s < 256; s++)
            a[s] = s >= 252 ? 6 : s >= 248 ? 5 : s >= 240 ? 4 : s >= 224 ? 3 : s >= 192 ? 2 : 1;
        function u(t, e) {
            if (e < 65534 && ((t.subarray && o) || (!t.subarray && i)))
                return String.fromCharCode.apply(null, r.shrinkBuf(t, e));
            for (var n = '', a = 0; a < e; a++) n += String.fromCharCode(t[a]);
            return n;
        }
        (a[254] = a[254] = 1),
            (e.string2buf = function (t) {
                var e,
                    n,
                    i,
                    o,
                    a,
                    s = t.length,
                    u = 0;
                for (o = 0; o < s; o++)
                    55296 == (64512 & (n = t.charCodeAt(o))) &&
                        o + 1 < s &&
                        56320 == (64512 & (i = t.charCodeAt(o + 1))) &&
                        ((n = 65536 + ((n - 55296) << 10) + (i - 56320)), o++),
                        (u += n < 128 ? 1 : n < 2048 ? 2 : n < 65536 ? 3 : 4);
                for (e = new r.Buf8(u), a = 0, o = 0; a < u; o++)
                    55296 == (64512 & (n = t.charCodeAt(o))) &&
                        o + 1 < s &&
                        56320 == (64512 & (i = t.charCodeAt(o + 1))) &&
                        ((n = 65536 + ((n - 55296) << 10) + (i - 56320)), o++),
                        n < 128
                            ? (e[a++] = n)
                            : n < 2048
                              ? ((e[a++] = 192 | (n >>> 6)), (e[a++] = 128 | (63 & n)))
                              : n < 65536
                                ? ((e[a++] = 224 | (n >>> 12)),
                                  (e[a++] = 128 | ((n >>> 6) & 63)),
                                  (e[a++] = 128 | (63 & n)))
                                : ((e[a++] = 240 | (n >>> 18)),
                                  (e[a++] = 128 | ((n >>> 12) & 63)),
                                  (e[a++] = 128 | ((n >>> 6) & 63)),
                                  (e[a++] = 128 | (63 & n)));
                return e;
            }),
            (e.buf2binstring = function (t) {
                return u(t, t.length);
            }),
            (e.binstring2buf = function (t) {
                for (var e = new r.Buf8(t.length), n = 0, i = e.length; n < i; n++) e[n] = t.charCodeAt(n);
                return e;
            }),
            (e.buf2string = function (t, e) {
                var n,
                    r,
                    i,
                    o,
                    s = e || t.length,
                    c = new Array(2 * s);
                for (r = 0, n = 0; n < s; )
                    if ((i = t[n++]) < 128) c[r++] = i;
                    else if ((o = a[i]) > 4) (c[r++] = 65533), (n += o - 1);
                    else {
                        for (i &= 2 === o ? 31 : 3 === o ? 15 : 7; o > 1 && n < s; )
                            (i = (i << 6) | (63 & t[n++])), o--;
                        o > 1
                            ? (c[r++] = 65533)
                            : i < 65536
                              ? (c[r++] = i)
                              : ((i -= 65536), (c[r++] = 55296 | ((i >> 10) & 1023)), (c[r++] = 56320 | (1023 & i)));
                    }
                return u(c, r);
            }),
            (e.utf8border = function (t, e) {
                var n;
                for ((e = e || t.length) > t.length && (e = t.length), n = e - 1; n >= 0 && 128 == (192 & t[n]); ) n--;
                return n < 0 || 0 === n ? e : n + a[t[n]] > e ? n : e;
            });
    },
    function (t, e, n) {
        'use strict';
        t.exports = function () {
            (this.input = null),
                (this.next_in = 0),
                (this.avail_in = 0),
                (this.total_in = 0),
                (this.output = null),
                (this.next_out = 0),
                (this.avail_out = 0),
                (this.total_out = 0),
                (this.msg = ''),
                (this.state = null),
                (this.data_type = 2),
                (this.adler = 0);
        };
    },
    function (t, e, n) {
        'use strict';
        const { ucs2: r } = n(90),
            { Transform: i } = n(11),
            o = n(91),
            { SVGPathData: a } = n(93),
            s = n(94),
            { Matrix: u } = n(95);
        n(96);
        t.exports = class extends i {
            constructor(t) {
                super({ objectMode: !0 }),
                    (this._writableState.objectMode = !0),
                    (this._readableState.objectMode = !1),
                    (this.glyphs = []),
                    (this._options = t || {}),
                    (this._options.fontName = this._options.fontName || 'iconfont'),
                    (this._options.fontId = this._options.fontId || this._options.fontName),
                    (this._options.fixedWidth = this._options.fixedWidth || !1),
                    (this._options.descent = this._options.descent || 0),
                    (this._options.round = this._options.round || 1e13),
                    (this._options.metadata = this._options.metadata || ''),
                    (this.log = this._options.log || console.log.bind(console));
            }
            _transform(t, e, n) {
                const r = o.createStream(!0),
                    i = [],
                    c = [new u()];
                function f(t) {
                    return new a(t).matrix(...c[c.length - 1].toArray());
                }
                const h = t.metadata || {};
                (h.width = 0),
                    (h.height = 1),
                    (h.paths = []),
                    this.glyphs.push(h),
                    'string' != typeof h.name &&
                        this.emit(
                            'error',
                            new Error('Please provide a name for the glyph at index ' + (this.glyphs.length - 1)),
                        ),
                    this.glyphs.some(t => t !== h && t.name === h.name) &&
                        this.emit('error', new Error(`The glyph name "${h.name}" must be unique.`)),
                    h.unicode && h.unicode instanceof Array && h.unicode.length
                        ? h.unicode.some((t, e) => h.unicode.some((n, r) => e !== r && t === n)) &&
                          this.emit(
                              'error',
                              new Error(`Given codepoints for the glyph "${h.name}" contain duplicates.`),
                          )
                        : 'string' != typeof h.unicode &&
                          this.emit('error', new Error(`Please provide a codepoint for the glyph "${h.name}"`)),
                    this.glyphs.some(t => t !== h && t.unicode === h.unicode) &&
                        this.emit(
                            'error',
                            new Error(`The glyph "${h.name}" codepoint seems to be used already elsewhere.`),
                        ),
                    r.on('opentag', t => {
                        let e, n;
                        i.push(t);
                        try {
                            const r = c[c.length - 1];
                            if (void 0 !== t.attributes.transform) {
                                const e = (function (t) {
                                    const e = {
                                            matrix: (t, ...e) => t.transform(...e),
                                            translate: (t, e, n = 0) => t.translate(e, n),
                                            scale: (t, e, n = e) => t.scale(e, n),
                                            rotate: (t, e, n = 0, r = 0) => {
                                                0 === n && 0 === r
                                                    ? t.rotateDeg(e)
                                                    : t.translate(n, r).rotateDeg(e).translate(-n, -r);
                                            },
                                            skewX: (t, e) => t.skewX((e * Math.PI) / 180),
                                            skewY: (t, e) => t.skewY((e * Math.PI) / 180),
                                        },
                                        n = new u();
                                    for (const r of t
                                        .match(/(rotate|translate|scale|skewX|skewY|matrix)\s*\(([^)]*)\)\s*/g)
                                        .map(t => t.match(/[\w.-]+/g)))
                                        e[r[0]](n, ...r.slice(1).map(parseFloat));
                                    return n;
                                })(t.attributes.transform);
                                c.push(r.clone().multiply(e));
                            } else c.push(r);
                            if (
                                !(function (t, e) {
                                    let n;
                                    return !e.some(
                                        t =>
                                            (void 0 !== t.attributes.display &&
                                                'none' === t.attributes.display.toLowerCase()) ||
                                            (void 0 !== t.attributes.width && 0 === parseFloat(t.attributes.width)) ||
                                            (void 0 !== t.attributes.height && 0 === parseFloat(t.attributes.height)) ||
                                            (void 0 !== t.attributes.viewBox &&
                                                ((n = t.attributes.viewBox.split(/\s*,*\s|\s,*\s*|,/)),
                                                0 === parseFloat(n[2]) || 0 === parseFloat(n[3]))),
                                    );
                                })(0, i)
                            )
                                return;
                            if ('svg' === t.name)
                                if ('viewBox' in t.attributes) {
                                    e = t.attributes.viewBox.split(/\s*,*\s|\s,*\s*|,/);
                                    const n = parseFloat(e[0]),
                                        r = parseFloat(e[1]),
                                        i = parseFloat(e[2]),
                                        o = parseFloat(e[3]);
                                    (h.width = 'width' in t.attributes ? parseFloat(t.attributes.width) : i),
                                        (h.height = 'height' in t.attributes ? parseFloat(t.attributes.height) : o),
                                        c[c.length - 1].translate(-n, -r).scale(h.width / i, h.height / o);
                                } else
                                    'width' in t.attributes
                                        ? (h.width = parseFloat(t.attributes.width))
                                        : (this.log(`Glyph "${h.name}" has no width attribute, defaulting to 150.`),
                                          (h.width = 150)),
                                        'height' in t.attributes
                                            ? (h.height = parseFloat(t.attributes.height))
                                            : (this.log(
                                                  `Glyph "${h.name}" has no height attribute, defaulting to 150.`,
                                              ),
                                              (h.height = 150));
                            else
                                'clipPath' === t.name
                                    ? this.log(
                                          `Found a clipPath element in the icon "${h.name}" the result may be different than expected.`,
                                      )
                                    : 'rect' === t.name && 'none' !== t.attributes.fill
                                      ? h.paths.push(f(s.rectToPath(t.attributes)))
                                      : 'line' === t.name && 'none' !== t.attributes.fill
                                        ? (this.log(
                                              `Found a line element in the icon "${h.name}" the result could be different than expected.`,
                                          ),
                                          h.paths.push(f(s.lineToPath(t.attributes))))
                                        : 'polyline' === t.name && 'none' !== t.attributes.fill
                                          ? (this.log(
                                                `Found a polyline element in the icon "${h.name}" the result could be different than expected.`,
                                            ),
                                            h.paths.push(f(s.polylineToPath(t.attributes))))
                                          : 'polygon' === t.name && 'none' !== t.attributes.fill
                                            ? h.paths.push(f(s.polygonToPath(t.attributes)))
                                            : ['circle', 'ellipse'].includes(t.name) && 'none' !== t.attributes.fill
                                              ? h.paths.push(f(s.circleToPath(t.attributes)))
                                              : 'path' === t.name &&
                                                t.attributes.d &&
                                                'none' !== t.attributes.fill &&
                                                h.paths.push(f(t.attributes.d));
                            'none' !== t.attributes.fill &&
                                ((n = (function t(e, n) {
                                    const r = e.attributes.fill,
                                        i = n.length;
                                    if ('none' !== r)
                                        return 'currentColor' === r
                                            ? 'black'
                                            : 'inherit' === r
                                              ? 0 === i
                                                  ? 'black'
                                                  : t(n[i - 1], n.slice(0, i - 1))
                                              : r;
                                })(t, i)),
                                void 0 !== n && (h.color = n));
                        } catch (t) {
                            this.emit('error', new Error(`Got an error parsing the glyph "${h.name}": ${t.message}.`));
                        }
                    }),
                    r.on('error', t => {
                        this.emit('error', t);
                    }),
                    r.on('closetag', () => {
                        c.pop(), i.pop();
                    }),
                    r.on('end', () => {
                        n();
                    }),
                    t.pipe(r);
            }
            _flush(t) {
                const e = this.glyphs.reduce((t, e) => Math.max(t, e.height), 0),
                    n = this.glyphs.reduce((t, e) => Math.max(t, e.width), 0),
                    i = this._options.fontHeight || e;
                let o = n;
                this._options.normalize
                    ? (o = this.glyphs.reduce((t, e) => Math.max(t, (i / e.height) * e.width), 0))
                    : this._options.fontHeight && (o *= i / e),
                    (this._options.ascent =
                        void 0 !== this._options.ascent ? this._options.ascent : i - this._options.descent),
                    !this._options.normalize &&
                        i >
                            (1 < this.glyphs.length
                                ? this.glyphs.reduce((t, e) => Math.min(t, e.height), 1 / 0)
                                : this.glyphs[0].height) &&
                        this.log(
                            'The provided icons do not have the same heights. This could lead to unexpected results. Using the normalize option may help.',
                        ),
                    1e3 > i &&
                        this.log(
                            'A fontHeight of at least than 1000 is recommended, otherwise further steps (rounding in svg2ttf) could lead to ugly results. Use the fontHeight option to scale icons.',
                        ),
                    this.push(
                        '<?xml version="1.0" standalone="no"?>\n<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd" >\n<svg xmlns="http://www.w3.org/2000/svg">\n' +
                            (this._options.metadata ? '<metadata>' + this._options.metadata + '</metadata>\n' : '') +
                            '<defs>\n  <font id="' +
                            this._options.fontId +
                            '" horiz-adv-x="' +
                            o +
                            '">\n    <font-face font-family="' +
                            this._options.fontName +
                            '"\n      units-per-em="' +
                            i +
                            '" ascent="' +
                            this._options.ascent +
                            '"\n      descent="' +
                            this._options.descent +
                            '"' +
                            (this._options.fontWeight ? '\n      font-weight="' + this._options.fontWeight + '"' : '') +
                            (this._options.fontStyle ? '\n      font-style="' + this._options.fontStyle + '"' : '') +
                            ' />\n    <missing-glyph horiz-adv-x="0" />\n',
                    ),
                    this.glyphs.forEach(t => {
                        const n = this._options.normalize ? i / t.height : i / e;
                        if (!isFinite(n)) throw new Error('foo');
                        (t.width *= n), (t.height *= n);
                        const s = new a('');
                        this._options.fixedWidth && (t.width = o);
                        const c = t.height - this._options.descent,
                            f = new u().transform(1, 0, 0, -1, 0, c);
                        if (
                            (1 !== n && f.scale(n, n),
                            t.paths.forEach(t => {
                                s.commands.push(...t.toAbs().matrix(...f.toArray()).commands);
                            }),
                            this._options.centerHorizontally)
                        ) {
                            const e = s.getBounds();
                            s.translate((t.width - (e.maxX - e.minX)) / 2 - e.minX);
                        }
                        delete t.paths,
                            t.unicode.forEach((e, n) => {
                                const i = r
                                        .decode(e)
                                        .map(t => '&#x' + t.toString(16).toUpperCase() + ';')
                                        .join(''),
                                    o = s.round(this._options.round).encode();
                                this.push(
                                    '    <glyph glyph-name="' +
                                        t.name +
                                        (0 === n ? '' : '-' + n) +
                                        '"\n      unicode="' +
                                        i +
                                        '"\n      horiz-adv-x="' +
                                        t.width +
                                        '" d="' +
                                        o +
                                        '" />\n',
                                );
                            });
                    }),
                    this.push('  </font>\n</defs>\n</svg>\n'),
                    this.log('Font created'),
                    'function' == typeof this._options.callback && this._options.callback(this.glyphs),
                    t();
            }
        };
    },
    function (t, e) {
        t.exports = require('punycode');
    },
    function (t, e, n) {
        !(function (t) {
            (t.parser = function (t, e) {
                return new i(t, e);
            }),
                (t.SAXParser = i),
                (t.SAXStream = a),
                (t.createStream = function (t, e) {
                    return new a(t, e);
                }),
                (t.MAX_BUFFER_LENGTH = 65536);
            var e,
                r = [
                    'comment',
                    'sgmlDecl',
                    'textNode',
                    'tagName',
                    'doctype',
                    'procInstName',
                    'procInstBody',
                    'entity',
                    'attribName',
                    'attribValue',
                    'cdata',
                    'script',
                ];
            function i(e, n) {
                if (!(this instanceof i)) return new i(e, n);
                !(function (t) {
                    for (var e = 0, n = r.length; e < n; e++) t[r[e]] = '';
                })(this),
                    (this.q = this.c = ''),
                    (this.bufferCheckPosition = t.MAX_BUFFER_LENGTH),
                    (this.opt = n || {}),
                    (this.opt.lowercase = this.opt.lowercase || this.opt.lowercasetags),
                    (this.looseCase = this.opt.lowercase ? 'toLowerCase' : 'toUpperCase'),
                    (this.tags = []),
                    (this.closed = this.closedRoot = this.sawRoot = !1),
                    (this.tag = this.error = null),
                    (this.strict = !!e),
                    (this.noscript = !(!e && !this.opt.noscript)),
                    (this.state = b.BEGIN),
                    (this.strictEntities = this.opt.strictEntities),
                    (this.ENTITIES = this.strictEntities ? Object.create(t.XML_ENTITIES) : Object.create(t.ENTITIES)),
                    (this.attribList = []),
                    this.opt.xmlns && (this.ns = Object.create(u)),
                    (this.trackPosition = !1 !== this.opt.position),
                    this.trackPosition && (this.position = this.line = this.column = 0),
                    E(this, 'onready');
            }
            (t.EVENTS = [
                'text',
                'processinginstruction',
                'sgmldeclaration',
                'doctype',
                'comment',
                'opentagstart',
                'attribute',
                'opentag',
                'closetag',
                'opencdata',
                'cdata',
                'closecdata',
                'error',
                'end',
                'ready',
                'script',
                'opennamespace',
                'closenamespace',
            ]),
                Object.create ||
                    (Object.create = function (t) {
                        function e() {}
                        return (e.prototype = t), new e();
                    }),
                Object.keys ||
                    (Object.keys = function (t) {
                        var e = [];
                        for (var n in t) t.hasOwnProperty(n) && e.push(n);
                        return e;
                    }),
                (i.prototype = {
                    end: function () {
                        A(this);
                    },
                    write: function (e) {
                        if (this.error) throw this.error;
                        if (this.closed) return O(this, 'Cannot write after close. Assign an onready handler.');
                        if (null === e) return A(this);
                        'object' == typeof e && (e = e.toString());
                        var n = 0,
                            i = '';
                        for (; (i = F(e, n++)), (this.c = i), i; )
                            switch (
                                (this.trackPosition &&
                                    (this.position++, '\n' === i ? (this.line++, (this.column = 0)) : this.column++),
                                this.state)
                            ) {
                                case b.BEGIN:
                                    if (((this.state = b.BEGIN_WHITESPACE), '\ufeff' === i)) continue;
                                    R(this, i);
                                    continue;
                                case b.BEGIN_WHITESPACE:
                                    R(this, i);
                                    continue;
                                case b.TEXT:
                                    if (this.sawRoot && !this.closedRoot) {
                                        for (var o = n - 1; i && '<' !== i && '&' !== i; )
                                            (i = F(e, n++)) &&
                                                this.trackPosition &&
                                                (this.position++,
                                                '\n' === i ? (this.line++, (this.column = 0)) : this.column++);
                                        this.textNode += e.substring(o, n - 1);
                                    }
                                    '<' !== i || (this.sawRoot && this.closedRoot && !this.strict)
                                        ? (p(i) ||
                                              (this.sawRoot && !this.closedRoot) ||
                                              C(this, 'Text data outside of root node.'),
                                          '&' === i ? (this.state = b.TEXT_ENTITY) : (this.textNode += i))
                                        : ((this.state = b.OPEN_WAKA), (this.startTagPosition = this.position));
                                    continue;
                                case b.SCRIPT:
                                    '<' === i ? (this.state = b.SCRIPT_ENDING) : (this.script += i);
                                    continue;
                                case b.SCRIPT_ENDING:
                                    '/' === i
                                        ? (this.state = b.CLOSE_TAG)
                                        : ((this.script += '<' + i), (this.state = b.SCRIPT));
                                    continue;
                                case b.OPEN_WAKA:
                                    if ('!' === i) (this.state = b.SGML_DECL), (this.sgmlDecl = '');
                                    else if (p(i));
                                    else if (m(c, i)) (this.state = b.OPEN_TAG), (this.tagName = i);
                                    else if ('/' === i) (this.state = b.CLOSE_TAG), (this.tagName = '');
                                    else if ('?' === i)
                                        (this.state = b.PROC_INST), (this.procInstName = this.procInstBody = '');
                                    else {
                                        if ((C(this, 'Unencoded <'), this.startTagPosition + 1 < this.position)) {
                                            var a = this.position - this.startTagPosition;
                                            i = new Array(a).join(' ') + i;
                                        }
                                        (this.textNode += '<' + i), (this.state = b.TEXT);
                                    }
                                    continue;
                                case b.SGML_DECL:
                                    '[CDATA[' === (this.sgmlDecl + i).toUpperCase()
                                        ? (S(this, 'onopencdata'),
                                          (this.state = b.CDATA),
                                          (this.sgmlDecl = ''),
                                          (this.cdata = ''))
                                        : this.sgmlDecl + i === '--'
                                          ? ((this.state = b.COMMENT), (this.comment = ''), (this.sgmlDecl = ''))
                                          : 'DOCTYPE' === (this.sgmlDecl + i).toUpperCase()
                                            ? ((this.state = b.DOCTYPE),
                                              (this.doctype || this.sawRoot) &&
                                                  C(this, 'Inappropriately located doctype declaration'),
                                              (this.doctype = ''),
                                              (this.sgmlDecl = ''))
                                            : '>' === i
                                              ? (S(this, 'onsgmldeclaration', this.sgmlDecl),
                                                (this.sgmlDecl = ''),
                                                (this.state = b.TEXT))
                                              : d(i)
                                                ? ((this.state = b.SGML_DECL_QUOTED), (this.sgmlDecl += i))
                                                : (this.sgmlDecl += i);
                                    continue;
                                case b.SGML_DECL_QUOTED:
                                    i === this.q && ((this.state = b.SGML_DECL), (this.q = '')), (this.sgmlDecl += i);
                                    continue;
                                case b.DOCTYPE:
                                    '>' === i
                                        ? ((this.state = b.TEXT),
                                          S(this, 'ondoctype', this.doctype),
                                          (this.doctype = !0))
                                        : ((this.doctype += i),
                                          '[' === i
                                              ? (this.state = b.DOCTYPE_DTD)
                                              : d(i) && ((this.state = b.DOCTYPE_QUOTED), (this.q = i)));
                                    continue;
                                case b.DOCTYPE_QUOTED:
                                    (this.doctype += i), i === this.q && ((this.q = ''), (this.state = b.DOCTYPE));
                                    continue;
                                case b.DOCTYPE_DTD:
                                    (this.doctype += i),
                                        ']' === i
                                            ? (this.state = b.DOCTYPE)
                                            : d(i) && ((this.state = b.DOCTYPE_DTD_QUOTED), (this.q = i));
                                    continue;
                                case b.DOCTYPE_DTD_QUOTED:
                                    (this.doctype += i), i === this.q && ((this.state = b.DOCTYPE_DTD), (this.q = ''));
                                    continue;
                                case b.COMMENT:
                                    '-' === i ? (this.state = b.COMMENT_ENDING) : (this.comment += i);
                                    continue;
                                case b.COMMENT_ENDING:
                                    '-' === i
                                        ? ((this.state = b.COMMENT_ENDED),
                                          (this.comment = N(this.opt, this.comment)),
                                          this.comment && S(this, 'oncomment', this.comment),
                                          (this.comment = ''))
                                        : ((this.comment += '-' + i), (this.state = b.COMMENT));
                                    continue;
                                case b.COMMENT_ENDED:
                                    '>' !== i
                                        ? (C(this, 'Malformed comment'),
                                          (this.comment += '--' + i),
                                          (this.state = b.COMMENT))
                                        : (this.state = b.TEXT);
                                    continue;
                                case b.CDATA:
                                    ']' === i ? (this.state = b.CDATA_ENDING) : (this.cdata += i);
                                    continue;
                                case b.CDATA_ENDING:
                                    ']' === i
                                        ? (this.state = b.CDATA_ENDING_2)
                                        : ((this.cdata += ']' + i), (this.state = b.CDATA));
                                    continue;
                                case b.CDATA_ENDING_2:
                                    '>' === i
                                        ? (this.cdata && S(this, 'oncdata', this.cdata),
                                          S(this, 'onclosecdata'),
                                          (this.cdata = ''),
                                          (this.state = b.TEXT))
                                        : ']' === i
                                          ? (this.cdata += ']')
                                          : ((this.cdata += ']]' + i), (this.state = b.CDATA));
                                    continue;
                                case b.PROC_INST:
                                    '?' === i
                                        ? (this.state = b.PROC_INST_ENDING)
                                        : p(i)
                                          ? (this.state = b.PROC_INST_BODY)
                                          : (this.procInstName += i);
                                    continue;
                                case b.PROC_INST_BODY:
                                    if (!this.procInstBody && p(i)) continue;
                                    '?' === i ? (this.state = b.PROC_INST_ENDING) : (this.procInstBody += i);
                                    continue;
                                case b.PROC_INST_ENDING:
                                    '>' === i
                                        ? (S(this, 'onprocessinginstruction', {
                                              name: this.procInstName,
                                              body: this.procInstBody,
                                          }),
                                          (this.procInstName = this.procInstBody = ''),
                                          (this.state = b.TEXT))
                                        : ((this.procInstBody += '?' + i), (this.state = b.PROC_INST_BODY));
                                    continue;
                                case b.OPEN_TAG:
                                    m(f, i)
                                        ? (this.tagName += i)
                                        : (I(this),
                                          '>' === i
                                              ? U(this)
                                              : '/' === i
                                                ? (this.state = b.OPEN_TAG_SLASH)
                                                : (p(i) || C(this, 'Invalid character in tag name'),
                                                  (this.state = b.ATTRIB)));
                                    continue;
                                case b.OPEN_TAG_SLASH:
                                    '>' === i
                                        ? (U(this, !0), k(this))
                                        : (C(this, 'Forward-slash in opening tag not followed by >'),
                                          (this.state = b.ATTRIB));
                                    continue;
                                case b.ATTRIB:
                                    if (p(i)) continue;
                                    '>' === i
                                        ? U(this)
                                        : '/' === i
                                          ? (this.state = b.OPEN_TAG_SLASH)
                                          : m(c, i)
                                            ? ((this.attribName = i),
                                              (this.attribValue = ''),
                                              (this.state = b.ATTRIB_NAME))
                                            : C(this, 'Invalid attribute name');
                                    continue;
                                case b.ATTRIB_NAME:
                                    '=' === i
                                        ? (this.state = b.ATTRIB_VALUE)
                                        : '>' === i
                                          ? (C(this, 'Attribute without value'),
                                            (this.attribValue = this.attribName),
                                            D(this),
                                            U(this))
                                          : p(i)
                                            ? (this.state = b.ATTRIB_NAME_SAW_WHITE)
                                            : m(f, i)
                                              ? (this.attribName += i)
                                              : C(this, 'Invalid attribute name');
                                    continue;
                                case b.ATTRIB_NAME_SAW_WHITE:
                                    if ('=' === i) this.state = b.ATTRIB_VALUE;
                                    else {
                                        if (p(i)) continue;
                                        C(this, 'Attribute without value'),
                                            (this.tag.attributes[this.attribName] = ''),
                                            (this.attribValue = ''),
                                            S(this, 'onattribute', {
                                                name: this.attribName,
                                                value: '',
                                            }),
                                            (this.attribName = ''),
                                            '>' === i
                                                ? U(this)
                                                : m(c, i)
                                                  ? ((this.attribName = i), (this.state = b.ATTRIB_NAME))
                                                  : (C(this, 'Invalid attribute name'), (this.state = b.ATTRIB));
                                    }
                                    continue;
                                case b.ATTRIB_VALUE:
                                    if (p(i)) continue;
                                    d(i)
                                        ? ((this.q = i), (this.state = b.ATTRIB_VALUE_QUOTED))
                                        : (C(this, 'Unquoted attribute value'),
                                          (this.state = b.ATTRIB_VALUE_UNQUOTED),
                                          (this.attribValue = i));
                                    continue;
                                case b.ATTRIB_VALUE_QUOTED:
                                    if (i !== this.q) {
                                        '&' === i ? (this.state = b.ATTRIB_VALUE_ENTITY_Q) : (this.attribValue += i);
                                        continue;
                                    }
                                    D(this), (this.q = ''), (this.state = b.ATTRIB_VALUE_CLOSED);
                                    continue;
                                case b.ATTRIB_VALUE_CLOSED:
                                    p(i)
                                        ? (this.state = b.ATTRIB)
                                        : '>' === i
                                          ? U(this)
                                          : '/' === i
                                            ? (this.state = b.OPEN_TAG_SLASH)
                                            : m(c, i)
                                              ? (C(this, 'No whitespace between attributes'),
                                                (this.attribName = i),
                                                (this.attribValue = ''),
                                                (this.state = b.ATTRIB_NAME))
                                              : C(this, 'Invalid attribute name');
                                    continue;
                                case b.ATTRIB_VALUE_UNQUOTED:
                                    if (!v(i)) {
                                        '&' === i ? (this.state = b.ATTRIB_VALUE_ENTITY_U) : (this.attribValue += i);
                                        continue;
                                    }
                                    D(this), '>' === i ? U(this) : (this.state = b.ATTRIB);
                                    continue;
                                case b.CLOSE_TAG:
                                    if (this.tagName)
                                        '>' === i
                                            ? k(this)
                                            : m(f, i)
                                              ? (this.tagName += i)
                                              : this.script
                                                ? ((this.script += '</' + this.tagName),
                                                  (this.tagName = ''),
                                                  (this.state = b.SCRIPT))
                                                : (p(i) || C(this, 'Invalid tagname in closing tag'),
                                                  (this.state = b.CLOSE_TAG_SAW_WHITE));
                                    else {
                                        if (p(i)) continue;
                                        y(c, i)
                                            ? this.script
                                                ? ((this.script += '</' + i), (this.state = b.SCRIPT))
                                                : C(this, 'Invalid tagname in closing tag.')
                                            : (this.tagName = i);
                                    }
                                    continue;
                                case b.CLOSE_TAG_SAW_WHITE:
                                    if (p(i)) continue;
                                    '>' === i ? k(this) : C(this, 'Invalid characters in closing tag');
                                    continue;
                                case b.TEXT_ENTITY:
                                case b.ATTRIB_VALUE_ENTITY_Q:
                                case b.ATTRIB_VALUE_ENTITY_U:
                                    var s, u;
                                    switch (this.state) {
                                        case b.TEXT_ENTITY:
                                            (s = b.TEXT), (u = 'textNode');
                                            break;
                                        case b.ATTRIB_VALUE_ENTITY_Q:
                                            (s = b.ATTRIB_VALUE_QUOTED), (u = 'attribValue');
                                            break;
                                        case b.ATTRIB_VALUE_ENTITY_U:
                                            (s = b.ATTRIB_VALUE_UNQUOTED), (u = 'attribValue');
                                    }
                                    ';' === i
                                        ? ((this[u] += P(this)), (this.entity = ''), (this.state = s))
                                        : m(this.entity.length ? l : h, i)
                                          ? (this.entity += i)
                                          : (C(this, 'Invalid character in entity name'),
                                            (this[u] += '&' + this.entity + i),
                                            (this.entity = ''),
                                            (this.state = s));
                                    continue;
                                default:
                                    throw new Error(this, 'Unknown state: ' + this.state);
                            }
                        this.position >= this.bufferCheckPosition &&
                            (function (e) {
                                for (
                                    var n = Math.max(t.MAX_BUFFER_LENGTH, 10), i = 0, o = 0, a = r.length;
                                    o < a;
                                    o++
                                ) {
                                    var s = e[r[o]].length;
                                    if (s > n)
                                        switch (r[o]) {
                                            case 'textNode':
                                                T(e);
                                                break;
                                            case 'cdata':
                                                S(e, 'oncdata', e.cdata), (e.cdata = '');
                                                break;
                                            case 'script':
                                                S(e, 'onscript', e.script), (e.script = '');
                                                break;
                                            default:
                                                O(e, 'Max buffer length exceeded: ' + r[o]);
                                        }
                                    i = Math.max(i, s);
                                }
                                var u = t.MAX_BUFFER_LENGTH - i;
                                e.bufferCheckPosition = u + e.position;
                            })(this);
                        return this;
                    },
                    /*! http://mths.be/fromcodepoint v0.1.0 by @mathias */ resume: function () {
                        return (this.error = null), this;
                    },
                    close: function () {
                        return this.write(null);
                    },
                    flush: function () {
                        var t;
                        T((t = this)),
                            '' !== t.cdata && (S(t, 'oncdata', t.cdata), (t.cdata = '')),
                            '' !== t.script && (S(t, 'onscript', t.script), (t.script = ''));
                    },
                });
            try {
                e = n(11).Stream;
            } catch (t) {
                e = function () {};
            }
            var o = t.EVENTS.filter(function (t) {
                return 'error' !== t && 'end' !== t;
            });
            function a(t, n) {
                if (!(this instanceof a)) return new a(t, n);
                e.apply(this), (this._parser = new i(t, n)), (this.writable = !0), (this.readable = !0);
                var r = this;
                (this._parser.onend = function () {
                    r.emit('end');
                }),
                    (this._parser.onerror = function (t) {
                        r.emit('error', t), (r._parser.error = null);
                    }),
                    (this._decoder = null),
                    o.forEach(function (t) {
                        Object.defineProperty(r, 'on' + t, {
                            get: function () {
                                return r._parser['on' + t];
                            },
                            set: function (e) {
                                if (!e) return r.removeAllListeners(t), (r._parser['on' + t] = e), e;
                                r.on(t, e);
                            },
                            enumerable: !0,
                            configurable: !1,
                        });
                    });
            }
            (a.prototype = Object.create(e.prototype, {
                constructor: { value: a },
            })),
                (a.prototype.write = function (t) {
                    if ('function' == typeof Buffer && 'function' == typeof Buffer.isBuffer && Buffer.isBuffer(t)) {
                        if (!this._decoder) {
                            var e = n(92).StringDecoder;
                            this._decoder = new e('utf8');
                        }
                        t = this._decoder.write(t);
                    }
                    return this._parser.write(t.toString()), this.emit('data', t), !0;
                }),
                (a.prototype.end = function (t) {
                    return t && t.length && this.write(t), this._parser.end(), !0;
                }),
                (a.prototype.on = function (t, n) {
                    var r = this;
                    return (
                        r._parser['on' + t] ||
                            -1 === o.indexOf(t) ||
                            (r._parser['on' + t] = function () {
                                var e = 1 === arguments.length ? [arguments[0]] : Array.apply(null, arguments);
                                e.splice(0, 0, t), r.emit.apply(r, e);
                            }),
                        e.prototype.on.call(r, t, n)
                    );
                });
            var s = 'http://www.w3.org/XML/1998/namespace',
                u = { xml: s, xmlns: 'http://www.w3.org/2000/xmlns/' },
                c =
                    /[:_A-Za-z\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u02FF\u0370-\u037D\u037F-\u1FFF\u200C-\u200D\u2070-\u218F\u2C00-\u2FEF\u3001-\uD7FF\uF900-\uFDCF\uFDF0-\uFFFD]/,
                f =
                    /[:_A-Za-z\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u02FF\u0370-\u037D\u037F-\u1FFF\u200C-\u200D\u2070-\u218F\u2C00-\u2FEF\u3001-\uD7FF\uF900-\uFDCF\uFDF0-\uFFFD\u00B7\u0300-\u036F\u203F-\u2040.\d-]/,
                h =
                    /[#:_A-Za-z\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u02FF\u0370-\u037D\u037F-\u1FFF\u200C-\u200D\u2070-\u218F\u2C00-\u2FEF\u3001-\uD7FF\uF900-\uFDCF\uFDF0-\uFFFD]/,
                l =
                    /[#:_A-Za-z\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u02FF\u0370-\u037D\u037F-\u1FFF\u200C-\u200D\u2070-\u218F\u2C00-\u2FEF\u3001-\uD7FF\uF900-\uFDCF\uFDF0-\uFFFD\u00B7\u0300-\u036F\u203F-\u2040.\d-]/;
            function p(t) {
                return ' ' === t || '\n' === t || '\r' === t || '\t' === t;
            }
            function d(t) {
                return '"' === t || "'" === t;
            }
            function v(t) {
                return '>' === t || p(t);
            }
            function m(t, e) {
                return t.test(e);
            }
            function y(t, e) {
                return !m(t, e);
            }
            var g,
                _,
                w,
                b = 0;
            for (var x in ((t.STATE = {
                BEGIN: b++,
                BEGIN_WHITESPACE: b++,
                TEXT: b++,
                TEXT_ENTITY: b++,
                OPEN_WAKA: b++,
                SGML_DECL: b++,
                SGML_DECL_QUOTED: b++,
                DOCTYPE: b++,
                DOCTYPE_QUOTED: b++,
                DOCTYPE_DTD: b++,
                DOCTYPE_DTD_QUOTED: b++,
                COMMENT_STARTING: b++,
                COMMENT: b++,
                COMMENT_ENDING: b++,
                COMMENT_ENDED: b++,
                CDATA: b++,
                CDATA_ENDING: b++,
                CDATA_ENDING_2: b++,
                PROC_INST: b++,
                PROC_INST_BODY: b++,
                PROC_INST_ENDING: b++,
                OPEN_TAG: b++,
                OPEN_TAG_SLASH: b++,
                ATTRIB: b++,
                ATTRIB_NAME: b++,
                ATTRIB_NAME_SAW_WHITE: b++,
                ATTRIB_VALUE: b++,
                ATTRIB_VALUE_QUOTED: b++,
                ATTRIB_VALUE_CLOSED: b++,
                ATTRIB_VALUE_UNQUOTED: b++,
                ATTRIB_VALUE_ENTITY_Q: b++,
                ATTRIB_VALUE_ENTITY_U: b++,
                CLOSE_TAG: b++,
                CLOSE_TAG_SAW_WHITE: b++,
                SCRIPT: b++,
                SCRIPT_ENDING: b++,
            }),
            (t.XML_ENTITIES = {
                amp: '&',
                gt: '>',
                lt: '<',
                quot: '"',
                apos: "'",
            }),
            (t.ENTITIES = {
                amp: '&',
                gt: '>',
                lt: '<',
                quot: '"',
                apos: "'",
                AElig: 198,
                Aacute: 193,
                Acirc: 194,
                Agrave: 192,
                Aring: 197,
                Atilde: 195,
                Auml: 196,
                Ccedil: 199,
                ETH: 208,
                Eacute: 201,
                Ecirc: 202,
                Egrave: 200,
                Euml: 203,
                Iacute: 205,
                Icirc: 206,
                Igrave: 204,
                Iuml: 207,
                Ntilde: 209,
                Oacute: 211,
                Ocirc: 212,
                Ograve: 210,
                Oslash: 216,
                Otilde: 213,
                Ouml: 214,
                THORN: 222,
                Uacute: 218,
                Ucirc: 219,
                Ugrave: 217,
                Uuml: 220,
                Yacute: 221,
                aacute: 225,
                acirc: 226,
                aelig: 230,
                agrave: 224,
                aring: 229,
                atilde: 227,
                auml: 228,
                ccedil: 231,
                eacute: 233,
                ecirc: 234,
                egrave: 232,
                eth: 240,
                euml: 235,
                iacute: 237,
                icirc: 238,
                igrave: 236,
                iuml: 239,
                ntilde: 241,
                oacute: 243,
                ocirc: 244,
                ograve: 242,
                oslash: 248,
                otilde: 245,
                ouml: 246,
                szlig: 223,
                thorn: 254,
                uacute: 250,
                ucirc: 251,
                ugrave: 249,
                uuml: 252,
                yacute: 253,
                yuml: 255,
                copy: 169,
                reg: 174,
                nbsp: 160,
                iexcl: 161,
                cent: 162,
                pound: 163,
                curren: 164,
                yen: 165,
                brvbar: 166,
                sect: 167,
                uml: 168,
                ordf: 170,
                laquo: 171,
                not: 172,
                shy: 173,
                macr: 175,
                deg: 176,
                plusmn: 177,
                sup1: 185,
                sup2: 178,
                sup3: 179,
                acute: 180,
                micro: 181,
                para: 182,
                middot: 183,
                cedil: 184,
                ordm: 186,
                raquo: 187,
                frac14: 188,
                frac12: 189,
                frac34: 190,
                iquest: 191,
                times: 215,
                divide: 247,
                OElig: 338,
                oelig: 339,
                Scaron: 352,
                scaron: 353,
                Yuml: 376,
                fnof: 402,
                circ: 710,
                tilde: 732,
                Alpha: 913,
                Beta: 914,
                Gamma: 915,
                Delta: 916,
                Epsilon: 917,
                Zeta: 918,
                Eta: 919,
                Theta: 920,
                Iota: 921,
                Kappa: 922,
                Lambda: 923,
                Mu: 924,
                Nu: 925,
                Xi: 926,
                Omicron: 927,
                Pi: 928,
                Rho: 929,
                Sigma: 931,
                Tau: 932,
                Upsilon: 933,
                Phi: 934,
                Chi: 935,
                Psi: 936,
                Omega: 937,
                alpha: 945,
                beta: 946,
                gamma: 947,
                delta: 948,
                epsilon: 949,
                zeta: 950,
                eta: 951,
                theta: 952,
                iota: 953,
                kappa: 954,
                lambda: 955,
                mu: 956,
                nu: 957,
                xi: 958,
                omicron: 959,
                pi: 960,
                rho: 961,
                sigmaf: 962,
                sigma: 963,
                tau: 964,
                upsilon: 965,
                phi: 966,
                chi: 967,
                psi: 968,
                omega: 969,
                thetasym: 977,
                upsih: 978,
                piv: 982,
                ensp: 8194,
                emsp: 8195,
                thinsp: 8201,
                zwnj: 8204,
                zwj: 8205,
                lrm: 8206,
                rlm: 8207,
                ndash: 8211,
                mdash: 8212,
                lsquo: 8216,
                rsquo: 8217,
                sbquo: 8218,
                ldquo: 8220,
                rdquo: 8221,
                bdquo: 8222,
                dagger: 8224,
                Dagger: 8225,
                bull: 8226,
                hellip: 8230,
                permil: 8240,
                prime: 8242,
                Prime: 8243,
                lsaquo: 8249,
                rsaquo: 8250,
                oline: 8254,
                frasl: 8260,
                euro: 8364,
                image: 8465,
                weierp: 8472,
                real: 8476,
                trade: 8482,
                alefsym: 8501,
                larr: 8592,
                uarr: 8593,
                rarr: 8594,
                darr: 8595,
                harr: 8596,
                crarr: 8629,
                lArr: 8656,
                uArr: 8657,
                rArr: 8658,
                dArr: 8659,
                hArr: 8660,
                forall: 8704,
                part: 8706,
                exist: 8707,
                empty: 8709,
                nabla: 8711,
                isin: 8712,
                notin: 8713,
                ni: 8715,
                prod: 8719,
                sum: 8721,
                minus: 8722,
                lowast: 8727,
                radic: 8730,
                prop: 8733,
                infin: 8734,
                ang: 8736,
                and: 8743,
                or: 8744,
                cap: 8745,
                cup: 8746,
                int: 8747,
                there4: 8756,
                sim: 8764,
                cong: 8773,
                asymp: 8776,
                ne: 8800,
                equiv: 8801,
                le: 8804,
                ge: 8805,
                sub: 8834,
                sup: 8835,
                nsub: 8836,
                sube: 8838,
                supe: 8839,
                oplus: 8853,
                otimes: 8855,
                perp: 8869,
                sdot: 8901,
                lceil: 8968,
                rceil: 8969,
                lfloor: 8970,
                rfloor: 8971,
                lang: 9001,
                rang: 9002,
                loz: 9674,
                spades: 9824,
                clubs: 9827,
                hearts: 9829,
                diams: 9830,
            }),
            Object.keys(t.ENTITIES).forEach(function (e) {
                var n = t.ENTITIES[e],
                    r = 'number' == typeof n ? String.fromCharCode(n) : n;
                t.ENTITIES[e] = r;
            }),
            t.STATE))
                t.STATE[t.STATE[x]] = x;
            function E(t, e, n) {
                t[e] && t[e](n);
            }
            function S(t, e, n) {
                t.textNode && T(t), E(t, e, n);
            }
            function T(t) {
                (t.textNode = N(t.opt, t.textNode)), t.textNode && E(t, 'ontext', t.textNode), (t.textNode = '');
            }
            function N(t, e) {
                return t.trim && (e = e.trim()), t.normalize && (e = e.replace(/\s+/g, ' ')), e;
            }
            function O(t, e) {
                return (
                    T(t),
                    t.trackPosition && (e += '\nLine: ' + t.line + '\nColumn: ' + t.column + '\nChar: ' + t.c),
                    (e = new Error(e)),
                    (t.error = e),
                    E(t, 'onerror', e),
                    t
                );
            }
            function A(t) {
                return (
                    t.sawRoot && !t.closedRoot && C(t, 'Unclosed root tag'),
                    t.state !== b.BEGIN &&
                        t.state !== b.BEGIN_WHITESPACE &&
                        t.state !== b.TEXT &&
                        O(t, 'Unexpected end'),
                    T(t),
                    (t.c = ''),
                    (t.closed = !0),
                    E(t, 'onend'),
                    i.call(t, t.strict, t.opt),
                    t
                );
            }
            function C(t, e) {
                if ('object' != typeof t || !(t instanceof i)) throw new Error('bad call to strictFail');
                t.strict && O(t, e);
            }
            function I(t) {
                t.strict || (t.tagName = t.tagName[t.looseCase]());
                var e = t.tags[t.tags.length - 1] || t,
                    n = (t.tag = { name: t.tagName, attributes: {} });
                t.opt.xmlns && (n.ns = e.ns), (t.attribList.length = 0), S(t, 'onopentagstart', n);
            }
            function M(t, e) {
                var n = t.indexOf(':') < 0 ? ['', t] : t.split(':'),
                    r = n[0],
                    i = n[1];
                return e && 'xmlns' === t && ((r = 'xmlns'), (i = '')), { prefix: r, local: i };
            }
            function D(t) {
                if (
                    (t.strict || (t.attribName = t.attribName[t.looseCase]()),
                    -1 !== t.attribList.indexOf(t.attribName) || t.tag.attributes.hasOwnProperty(t.attribName))
                )
                    t.attribName = t.attribValue = '';
                else {
                    if (t.opt.xmlns) {
                        var e = M(t.attribName, !0),
                            n = e.prefix,
                            r = e.local;
                        if ('xmlns' === n)
                            if ('xml' === r && t.attribValue !== s)
                                C(t, 'xml: prefix must be bound to ' + s + '\nActual: ' + t.attribValue);
                            else if ('xmlns' === r && 'http://www.w3.org/2000/xmlns/' !== t.attribValue)
                                C(
                                    t,
                                    'xmlns: prefix must be bound to http://www.w3.org/2000/xmlns/\nActual: ' +
                                        t.attribValue,
                                );
                            else {
                                var i = t.tag,
                                    o = t.tags[t.tags.length - 1] || t;
                                i.ns === o.ns && (i.ns = Object.create(o.ns)), (i.ns[r] = t.attribValue);
                            }
                        t.attribList.push([t.attribName, t.attribValue]);
                    } else
                        (t.tag.attributes[t.attribName] = t.attribValue),
                            S(t, 'onattribute', {
                                name: t.attribName,
                                value: t.attribValue,
                            });
                    t.attribName = t.attribValue = '';
                }
            }
            function U(t, e) {
                if (t.opt.xmlns) {
                    var n = t.tag,
                        r = M(t.tagName);
                    (n.prefix = r.prefix),
                        (n.local = r.local),
                        (n.uri = n.ns[r.prefix] || ''),
                        n.prefix &&
                            !n.uri &&
                            (C(t, 'Unbound namespace prefix: ' + JSON.stringify(t.tagName)), (n.uri = r.prefix));
                    var i = t.tags[t.tags.length - 1] || t;
                    n.ns &&
                        i.ns !== n.ns &&
                        Object.keys(n.ns).forEach(function (e) {
                            S(t, 'onopennamespace', {
                                prefix: e,
                                uri: n.ns[e],
                            });
                        });
                    for (var o = 0, a = t.attribList.length; o < a; o++) {
                        var s = t.attribList[o],
                            u = s[0],
                            c = s[1],
                            f = M(u, !0),
                            h = f.prefix,
                            l = f.local,
                            p = '' === h ? '' : n.ns[h] || '',
                            d = {
                                name: u,
                                value: c,
                                prefix: h,
                                local: l,
                                uri: p,
                            };
                        h &&
                            'xmlns' !== h &&
                            !p &&
                            (C(t, 'Unbound namespace prefix: ' + JSON.stringify(h)), (d.uri = h)),
                            (t.tag.attributes[u] = d),
                            S(t, 'onattribute', d);
                    }
                    t.attribList.length = 0;
                }
                (t.tag.isSelfClosing = !!e),
                    (t.sawRoot = !0),
                    t.tags.push(t.tag),
                    S(t, 'onopentag', t.tag),
                    e ||
                        (t.noscript || 'script' !== t.tagName.toLowerCase() ? (t.state = b.TEXT) : (t.state = b.SCRIPT),
                        (t.tag = null),
                        (t.tagName = '')),
                    (t.attribName = t.attribValue = ''),
                    (t.attribList.length = 0);
            }
            function k(t) {
                if (!t.tagName) return C(t, 'Weird empty close tag.'), (t.textNode += '</>'), void (t.state = b.TEXT);
                if (t.script) {
                    if ('script' !== t.tagName)
                        return (t.script += '</' + t.tagName + '>'), (t.tagName = ''), void (t.state = b.SCRIPT);
                    S(t, 'onscript', t.script), (t.script = '');
                }
                var e = t.tags.length,
                    n = t.tagName;
                t.strict || (n = n[t.looseCase]());
                for (var r = n; e--; ) {
                    if (t.tags[e].name === r) break;
                    C(t, 'Unexpected close tag');
                }
                if (e < 0)
                    return (
                        C(t, 'Unmatched closing tag: ' + t.tagName),
                        (t.textNode += '</' + t.tagName + '>'),
                        void (t.state = b.TEXT)
                    );
                t.tagName = n;
                for (var i = t.tags.length; i-- > e; ) {
                    var o = (t.tag = t.tags.pop());
                    (t.tagName = t.tag.name), S(t, 'onclosetag', t.tagName);
                    var a = {};
                    for (var s in o.ns) a[s] = o.ns[s];
                    var u = t.tags[t.tags.length - 1] || t;
                    t.opt.xmlns &&
                        o.ns !== u.ns &&
                        Object.keys(o.ns).forEach(function (e) {
                            var n = o.ns[e];
                            S(t, 'onclosenamespace', { prefix: e, uri: n });
                        });
                }
                0 === e && (t.closedRoot = !0),
                    (t.tagName = t.attribValue = t.attribName = ''),
                    (t.attribList.length = 0),
                    (t.state = b.TEXT);
            }
            function P(t) {
                var e,
                    n = t.entity,
                    r = n.toLowerCase(),
                    i = '';
                return t.ENTITIES[n]
                    ? t.ENTITIES[n]
                    : t.ENTITIES[r]
                      ? t.ENTITIES[r]
                      : ('#' === (n = r).charAt(0) &&
                            ('x' === n.charAt(1)
                                ? ((n = n.slice(2)), (i = (e = parseInt(n, 16)).toString(16)))
                                : ((n = n.slice(1)), (i = (e = parseInt(n, 10)).toString(10)))),
                        (n = n.replace(/^0+/, '')),
                        isNaN(e) || i.toLowerCase() !== n
                            ? (C(t, 'Invalid character entity'), '&' + t.entity + ';')
                            : String.fromCodePoint(e));
            }
            function R(t, e) {
                '<' === e
                    ? ((t.state = b.OPEN_WAKA), (t.startTagPosition = t.position))
                    : p(e) || (C(t, 'Non-whitespace before first tag.'), (t.textNode = e), (t.state = b.TEXT));
            }
            function F(t, e) {
                var n = '';
                return e < t.length && (n = t.charAt(e)), n;
            }
            (b = t.STATE),
                String.fromCodePoint ||
                    ((g = String.fromCharCode),
                    (_ = Math.floor),
                    (w = function () {
                        var t,
                            e,
                            n = 16384,
                            r = [],
                            i = -1,
                            o = arguments.length;
                        if (!o) return '';
                        for (var a = ''; ++i < o; ) {
                            var s = Number(arguments[i]);
                            if (!isFinite(s) || s < 0 || s > 1114111 || _(s) !== s)
                                throw RangeError('Invalid code point: ' + s);
                            s <= 65535
                                ? r.push(s)
                                : ((t = 55296 + ((s -= 65536) >> 10)), (e = (s % 1024) + 56320), r.push(t, e)),
                                (i + 1 === o || r.length > n) && ((a += g.apply(null, r)), (r.length = 0));
                        }
                        return a;
                    }),
                    Object.defineProperty
                        ? Object.defineProperty(String, 'fromCodePoint', {
                              value: w,
                              configurable: !0,
                              writable: !0,
                          })
                        : (String.fromCodePoint = w));
        })(e);
    },
    function (t, e) {
        t.exports = require('string_decoder');
    },
    function (t, e, n) {
        'use strict';
        n.r(e),
            n.d(e, 'COMMAND_ARG_COUNTS', function () {
                return E;
            }),
            n.d(e, 'SVGPathData', function () {
                return x;
            }),
            n.d(e, 'SVGPathDataParser', function () {
                return b;
            }),
            n.d(e, 'SVGPathDataTransformer', function () {
                return h;
            }),
            n.d(e, 'encodeSVGPath', function () {
                return o;
            });
        /*! *****************************************************************************
Copyright (c) Microsoft Corporation. All rights reserved.
Licensed under the Apache License, Version 2.0 (the "License"); you may not use
this file except in compliance with the License. You may obtain a copy of the
License at http://www.apache.org/licenses/LICENSE-2.0

THIS CODE IS PROVIDED ON AN *AS IS* BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
KIND, EITHER EXPRESS OR IMPLIED, INCLUDING WITHOUT LIMITATION ANY IMPLIED
WARRANTIES OR CONDITIONS OF TITLE, FITNESS FOR A PARTICULAR PURPOSE,
MERCHANTABLITY OR NON-INFRINGEMENT.

See the Apache Version 2.0 License for specific language governing permissions
and limitations under the License.
***************************************************************************** */
        var r = function (t, e) {
            return (r =
                Object.setPrototypeOf ||
                ({ __proto__: [] } instanceof Array &&
                    function (t, e) {
                        t.__proto__ = e;
                    }) ||
                function (t, e) {
                    for (var n in e) e.hasOwnProperty(n) && (t[n] = e[n]);
                })(t, e);
        };
        function i(t, e) {
            function n() {
                this.constructor = t;
            }
            r(t, e), (t.prototype = null === e ? Object.create(e) : ((n.prototype = e.prototype), new n()));
        }
        function o(t) {
            var e = '';
            Array.isArray(t) || (t = [t]);
            for (var n = 0; n < t.length; n++) {
                var r = t[n];
                if (r.type === x.CLOSE_PATH) e += 'z';
                else if (r.type === x.HORIZ_LINE_TO) e += (r.relative ? 'h' : 'H') + r.x;
                else if (r.type === x.VERT_LINE_TO) e += (r.relative ? 'v' : 'V') + r.y;
                else if (r.type === x.MOVE_TO) e += (r.relative ? 'm' : 'M') + r.x + ' ' + r.y;
                else if (r.type === x.LINE_TO) e += (r.relative ? 'l' : 'L') + r.x + ' ' + r.y;
                else if (r.type === x.CURVE_TO)
                    e += (r.relative ? 'c' : 'C') + r.x1 + ' ' + r.y1 + ' ' + r.x2 + ' ' + r.y2 + ' ' + r.x + ' ' + r.y;
                else if (r.type === x.SMOOTH_CURVE_TO)
                    e += (r.relative ? 's' : 'S') + r.x2 + ' ' + r.y2 + ' ' + r.x + ' ' + r.y;
                else if (r.type === x.QUAD_TO)
                    e += (r.relative ? 'q' : 'Q') + r.x1 + ' ' + r.y1 + ' ' + r.x + ' ' + r.y;
                else if (r.type === x.SMOOTH_QUAD_TO) e += (r.relative ? 't' : 'T') + r.x + ' ' + r.y;
                else {
                    if (r.type !== x.ARC)
                        throw new Error('Unexpected command type "' + r.type + '" at index ' + n + '.');
                    e +=
                        (r.relative ? 'a' : 'A') +
                        r.rX +
                        ' ' +
                        r.rY +
                        ' ' +
                        r.xRot +
                        ' ' +
                        +r.lArcFlag +
                        ' ' +
                        +r.sweepFlag +
                        ' ' +
                        r.x +
                        ' ' +
                        r.y;
                }
            }
            return e;
        }
        function a(t, e) {
            var n = t[0],
                r = t[1];
            return [n * Math.cos(e) - r * Math.sin(e), n * Math.sin(e) + r * Math.cos(e)];
        }
        function s() {
            for (var t = [], e = 0; e < arguments.length; e++) t[e] = arguments[e];
            for (var n = 0; n < t.length; n++)
                if ('number' != typeof t[n])
                    throw new Error(
                        'assertNumbers arguments[' + n + '] is not a number. ' + typeof t[n] + ' == typeof ' + t[n],
                    );
            return !0;
        }
        var u = Math.PI;
        function c(t, e, n) {
            (t.lArcFlag = 0 === t.lArcFlag ? 0 : 1), (t.sweepFlag = 0 === t.sweepFlag ? 0 : 1);
            var r = t.rX,
                i = t.rY,
                o = t.x,
                s = t.y;
            (r = Math.abs(t.rX)), (i = Math.abs(t.rY));
            var c = a([(e - o) / 2, (n - s) / 2], (-t.xRot / 180) * u),
                f = c[0],
                h = c[1],
                l = Math.pow(f, 2) / Math.pow(r, 2) + Math.pow(h, 2) / Math.pow(i, 2);
            1 < l && ((r *= Math.sqrt(l)), (i *= Math.sqrt(l))), (t.rX = r), (t.rY = i);
            var p = Math.pow(r, 2) * Math.pow(h, 2) + Math.pow(i, 2) * Math.pow(f, 2),
                d =
                    (t.lArcFlag !== t.sweepFlag ? 1 : -1) *
                    Math.sqrt(Math.max(0, (Math.pow(r, 2) * Math.pow(i, 2) - p) / p)),
                v = ((r * h) / i) * d,
                m = ((-i * f) / r) * d,
                y = a([v, m], (t.xRot / 180) * u);
            (t.cX = y[0] + (e + o) / 2),
                (t.cY = y[1] + (n + s) / 2),
                (t.phi1 = Math.atan2((h - m) / i, (f - v) / r)),
                (t.phi2 = Math.atan2((-h - m) / i, (-f - v) / r)),
                0 === t.sweepFlag && t.phi2 > t.phi1 && (t.phi2 -= 2 * u),
                1 === t.sweepFlag && t.phi2 < t.phi1 && (t.phi2 += 2 * u),
                (t.phi1 *= 180 / u),
                (t.phi2 *= 180 / u);
        }
        function f(t, e, n) {
            s(t, e, n);
            var r = t * t + e * e - n * n;
            if (0 > r) return [];
            if (0 === r) return [[(t * n) / (t * t + e * e), (e * n) / (t * t + e * e)]];
            var i = Math.sqrt(r);
            return [
                [(t * n + e * i) / (t * t + e * e), (e * n - t * i) / (t * t + e * e)],
                [(t * n - e * i) / (t * t + e * e), (e * n + t * i) / (t * t + e * e)],
            ];
        }
        var h,
            l = Math.PI / 180;
        function p(t, e, n) {
            return (1 - n) * t + n * e;
        }
        function d(t, e, n, r) {
            return t + Math.cos((r / 180) * u) * e + Math.sin((r / 180) * u) * n;
        }
        function v(t, e, n, r) {
            var i = e - t,
                o = n - e,
                a = 3 * i + 3 * (r - n) - 6 * o,
                s = 6 * (o - i),
                u = 3 * i;
            return Math.abs(a) < 1e-6
                ? [-u / s]
                : (function (t, e, n) {
                      void 0 === n && (n = 1e-6);
                      var r = (t * t) / 4 - e;
                      if (r < -n) return [];
                      if (r <= n) return [-t / 2];
                      var i = Math.sqrt(r);
                      return [-t / 2 - i, -t / 2 + i];
                  })(s / a, u / a, 1e-6);
        }
        function m(t, e, n, r, i) {
            var o = 1 - i;
            return t * (o * o * o) + e * (3 * o * o * i) + n * (3 * o * i * i) + r * (i * i * i);
        }
        !(function (t) {
            function e() {
                return i(function (t, e, n) {
                    return (
                        t.relative &&
                            (void 0 !== t.x1 && (t.x1 += e),
                            void 0 !== t.y1 && (t.y1 += n),
                            void 0 !== t.x2 && (t.x2 += e),
                            void 0 !== t.y2 && (t.y2 += n),
                            void 0 !== t.x && (t.x += e),
                            void 0 !== t.y && (t.y += n),
                            (t.relative = !1)),
                        t
                    );
                });
            }
            function n() {
                var t = NaN,
                    e = NaN,
                    n = NaN,
                    r = NaN;
                return i(function (i, o, a) {
                    return (
                        i.type & x.SMOOTH_CURVE_TO &&
                            ((i.type = x.CURVE_TO),
                            (t = isNaN(t) ? o : t),
                            (e = isNaN(e) ? a : e),
                            (i.x1 = i.relative ? o - t : 2 * o - t),
                            (i.y1 = i.relative ? a - e : 2 * a - e)),
                        i.type & x.CURVE_TO
                            ? ((t = i.relative ? o + i.x2 : i.x2), (e = i.relative ? a + i.y2 : i.y2))
                            : ((t = NaN), (e = NaN)),
                        i.type & x.SMOOTH_QUAD_TO &&
                            ((i.type = x.QUAD_TO),
                            (n = isNaN(n) ? o : n),
                            (r = isNaN(r) ? a : r),
                            (i.x1 = i.relative ? o - n : 2 * o - n),
                            (i.y1 = i.relative ? a - r : 2 * a - r)),
                        i.type & x.QUAD_TO
                            ? ((n = i.relative ? o + i.x1 : i.x1), (r = i.relative ? a + i.y1 : i.y1))
                            : ((n = NaN), (r = NaN)),
                        i
                    );
                });
            }
            function r() {
                var t = NaN,
                    e = NaN;
                return i(function (n, r, i) {
                    if (
                        (n.type & x.SMOOTH_QUAD_TO &&
                            ((n.type = x.QUAD_TO),
                            (t = isNaN(t) ? r : t),
                            (e = isNaN(e) ? i : e),
                            (n.x1 = n.relative ? r - t : 2 * r - t),
                            (n.y1 = n.relative ? i - e : 2 * i - e)),
                        n.type & x.QUAD_TO)
                    ) {
                        (t = n.relative ? r + n.x1 : n.x1), (e = n.relative ? i + n.y1 : n.y1);
                        var o = n.x1,
                            a = n.y1;
                        (n.type = x.CURVE_TO),
                            (n.x1 = ((n.relative ? 0 : r) + 2 * o) / 3),
                            (n.y1 = ((n.relative ? 0 : i) + 2 * a) / 3),
                            (n.x2 = (n.x + 2 * o) / 3),
                            (n.y2 = (n.y + 2 * a) / 3);
                    } else (t = NaN), (e = NaN);
                    return n;
                });
            }
            function i(t) {
                var e = 0,
                    n = 0,
                    r = NaN,
                    i = NaN;
                return function (o) {
                    if (isNaN(r) && !(o.type & x.MOVE_TO)) throw new Error('path must start with moveto');
                    var a = t(o, e, n, r, i);
                    return (
                        o.type & x.CLOSE_PATH && ((e = r), (n = i)),
                        void 0 !== o.x && (e = o.relative ? e + o.x : o.x),
                        void 0 !== o.y && (n = o.relative ? n + o.y : o.y),
                        o.type & x.MOVE_TO && ((r = e), (i = n)),
                        a
                    );
                };
            }
            function o(t, e, n, r, o, a) {
                return (
                    s(t, e, n, r, o, a),
                    i(function (i, s, u, c) {
                        var f = i.x1,
                            h = i.x2,
                            l = i.relative && !isNaN(c),
                            p = void 0 !== i.x ? i.x : l ? 0 : s,
                            d = void 0 !== i.y ? i.y : l ? 0 : u;
                        function v(t) {
                            return t * t;
                        }
                        i.type & x.HORIZ_LINE_TO && 0 !== e && ((i.type = x.LINE_TO), (i.y = i.relative ? 0 : u)),
                            i.type & x.VERT_LINE_TO && 0 !== n && ((i.type = x.LINE_TO), (i.x = i.relative ? 0 : s)),
                            void 0 !== i.x && (i.x = i.x * t + d * n + (l ? 0 : o)),
                            void 0 !== i.y && (i.y = p * e + i.y * r + (l ? 0 : a)),
                            void 0 !== i.x1 && (i.x1 = i.x1 * t + i.y1 * n + (l ? 0 : o)),
                            void 0 !== i.y1 && (i.y1 = f * e + i.y1 * r + (l ? 0 : a)),
                            void 0 !== i.x2 && (i.x2 = i.x2 * t + i.y2 * n + (l ? 0 : o)),
                            void 0 !== i.y2 && (i.y2 = h * e + i.y2 * r + (l ? 0 : a));
                        var m = t * r - e * n;
                        if (void 0 !== i.xRot && (1 !== t || 0 !== e || 0 !== n || 1 !== r))
                            if (0 === m)
                                delete i.rX,
                                    delete i.rY,
                                    delete i.xRot,
                                    delete i.lArcFlag,
                                    delete i.sweepFlag,
                                    (i.type = x.LINE_TO);
                            else {
                                var y = (i.xRot * Math.PI) / 180,
                                    g = Math.sin(y),
                                    _ = Math.cos(y),
                                    w = 1 / v(i.rX),
                                    b = 1 / v(i.rY),
                                    E = v(_) * w + v(g) * b,
                                    S = 2 * g * _ * (w - b),
                                    T = v(g) * w + v(_) * b,
                                    N = E * r * r - S * e * r + T * e * e,
                                    O = S * (t * r + e * n) - 2 * (E * n * r + T * t * e),
                                    A = E * n * n - S * t * n + T * t * t,
                                    C = ((Math.atan2(O, N - A) + Math.PI) % Math.PI) / 2,
                                    I = Math.sin(C),
                                    M = Math.cos(C);
                                (i.rX = Math.abs(m) / Math.sqrt(N * v(M) + O * I * M + A * v(I))),
                                    (i.rY = Math.abs(m) / Math.sqrt(N * v(I) - O * I * M + A * v(M))),
                                    (i.xRot = (180 * C) / Math.PI);
                            }
                        return void 0 !== i.sweepFlag && 0 > m && (i.sweepFlag = +!i.sweepFlag), i;
                    })
                );
            }
            (t.ROUND = function (t) {
                function e(e) {
                    return Math.round(e * t) / t;
                }
                return (
                    void 0 === t && (t = 1e13),
                    s(t),
                    function (t) {
                        return (
                            void 0 !== t.x1 && (t.x1 = e(t.x1)),
                            void 0 !== t.y1 && (t.y1 = e(t.y1)),
                            void 0 !== t.x2 && (t.x2 = e(t.x2)),
                            void 0 !== t.y2 && (t.y2 = e(t.y2)),
                            void 0 !== t.x && (t.x = e(t.x)),
                            void 0 !== t.y && (t.y = e(t.y)),
                            void 0 !== t.rX && (t.rX = e(t.rX)),
                            void 0 !== t.rY && (t.rY = e(t.rY)),
                            t
                        );
                    }
                );
            }),
                (t.TO_ABS = e),
                (t.TO_REL = function () {
                    return i(function (t, e, n) {
                        return (
                            t.relative ||
                                (void 0 !== t.x1 && (t.x1 -= e),
                                void 0 !== t.y1 && (t.y1 -= n),
                                void 0 !== t.x2 && (t.x2 -= e),
                                void 0 !== t.y2 && (t.y2 -= n),
                                void 0 !== t.x && (t.x -= e),
                                void 0 !== t.y && (t.y -= n),
                                (t.relative = !0)),
                            t
                        );
                    });
                }),
                (t.NORMALIZE_HVZ = function (t, e, n) {
                    return (
                        void 0 === t && (t = !0),
                        void 0 === e && (e = !0),
                        void 0 === n && (n = !0),
                        i(function (r, i, o, a, s) {
                            if (isNaN(a) && !(r.type & x.MOVE_TO)) throw new Error('path must start with moveto');
                            return (
                                e && r.type & x.HORIZ_LINE_TO && ((r.type = x.LINE_TO), (r.y = r.relative ? 0 : o)),
                                n && r.type & x.VERT_LINE_TO && ((r.type = x.LINE_TO), (r.x = r.relative ? 0 : i)),
                                t &&
                                    r.type & x.CLOSE_PATH &&
                                    ((r.type = x.LINE_TO),
                                    (r.x = r.relative ? a - i : a),
                                    (r.y = r.relative ? s - o : s)),
                                r.type & x.ARC &&
                                    (0 === r.rX || 0 === r.rY) &&
                                    ((r.type = x.LINE_TO),
                                    delete r.rX,
                                    delete r.rY,
                                    delete r.xRot,
                                    delete r.lArcFlag,
                                    delete r.sweepFlag),
                                r
                            );
                        })
                    );
                }),
                (t.NORMALIZE_ST = n),
                (t.QT_TO_C = r),
                (t.INFO = i),
                (t.SANITIZE = function (t) {
                    void 0 === t && (t = 0), s(t);
                    var e = NaN,
                        n = NaN,
                        r = NaN,
                        o = NaN;
                    return i(function (i, a, s, u, c) {
                        var f = Math.abs,
                            h = !1,
                            l = 0,
                            p = 0;
                        if (
                            (i.type & x.SMOOTH_CURVE_TO && ((l = isNaN(e) ? 0 : a - e), (p = isNaN(n) ? 0 : s - n)),
                            i.type & (x.CURVE_TO | x.SMOOTH_CURVE_TO)
                                ? ((e = i.relative ? a + i.x2 : i.x2), (n = i.relative ? s + i.y2 : i.y2))
                                : ((e = NaN), (n = NaN)),
                            i.type & x.SMOOTH_QUAD_TO
                                ? ((r = isNaN(r) ? a : 2 * a - r), (o = isNaN(o) ? s : 2 * s - o))
                                : i.type & x.QUAD_TO
                                  ? ((r = i.relative ? a + i.x1 : i.x1), (o = i.relative ? s + i.y1 : i.y2))
                                  : ((r = NaN), (o = NaN)),
                            i.type & x.LINE_COMMANDS ||
                                (i.type & x.ARC && (0 === i.rX || 0 === i.rY || !i.lArcFlag)) ||
                                i.type & x.CURVE_TO ||
                                i.type & x.SMOOTH_CURVE_TO ||
                                i.type & x.QUAD_TO ||
                                i.type & x.SMOOTH_QUAD_TO)
                        ) {
                            var d = void 0 === i.x ? 0 : i.relative ? i.x : i.x - a,
                                v = void 0 === i.y ? 0 : i.relative ? i.y : i.y - s;
                            (l = isNaN(r) ? (void 0 === i.x1 ? l : i.relative ? i.x : i.x1 - a) : r - a),
                                (p = isNaN(o) ? (void 0 === i.y1 ? p : i.relative ? i.y : i.y1 - s) : o - s);
                            var m = void 0 === i.x2 ? 0 : i.relative ? i.x : i.x2 - a,
                                y = void 0 === i.y2 ? 0 : i.relative ? i.y : i.y2 - s;
                            f(d) <= t && f(v) <= t && f(l) <= t && f(p) <= t && f(m) <= t && f(y) <= t && (h = !0);
                        }
                        return i.type & x.CLOSE_PATH && f(a - u) <= t && f(s - c) <= t && (h = !0), h ? [] : i;
                    });
                }),
                (t.MATRIX = o),
                (t.ROTATE = function (t, e, n) {
                    void 0 === e && (e = 0), void 0 === n && (n = 0), s(t, e, n);
                    var r = Math.sin(t),
                        i = Math.cos(t);
                    return o(i, r, -r, i, e - e * i + n * r, n - e * r - n * i);
                }),
                (t.TRANSLATE = function (t, e) {
                    return void 0 === e && (e = 0), s(t, e), o(1, 0, 0, 1, t, e);
                }),
                (t.SCALE = function (t, e) {
                    return void 0 === e && (e = t), s(t, e), o(t, 0, 0, e, 0, 0);
                }),
                (t.SKEW_X = function (t) {
                    return s(t), o(1, 0, Math.atan(t), 1, 0, 0);
                }),
                (t.SKEW_Y = function (t) {
                    return s(t), o(1, Math.atan(t), 0, 1, 0, 0);
                }),
                (t.X_AXIS_SYMMETRY = function (t) {
                    return void 0 === t && (t = 0), s(t), o(-1, 0, 0, 1, t, 0);
                }),
                (t.Y_AXIS_SYMMETRY = function (t) {
                    return void 0 === t && (t = 0), s(t), o(1, 0, 0, -1, 0, t);
                }),
                (t.A_TO_C = function () {
                    return i(function (t, e, n) {
                        return x.ARC === t.type
                            ? (function (t, e, n) {
                                  var r, i, o, s;
                                  t.cX || c(t, e, n);
                                  for (
                                      var u = Math.min(t.phi1, t.phi2),
                                          f = Math.max(t.phi1, t.phi2) - u,
                                          h = Math.ceil(f / 90),
                                          d = new Array(h),
                                          v = e,
                                          m = n,
                                          y = 0;
                                      y < h;
                                      y++
                                  ) {
                                      var g = p(t.phi1, t.phi2, y / h),
                                          _ = p(t.phi1, t.phi2, (y + 1) / h),
                                          w = _ - g,
                                          b = (4 / 3) * Math.tan((w * l) / 4),
                                          E = [
                                              Math.cos(g * l) - b * Math.sin(g * l),
                                              Math.sin(g * l) + b * Math.cos(g * l),
                                          ],
                                          S = E[0],
                                          T = E[1],
                                          N = [Math.cos(_ * l), Math.sin(_ * l)],
                                          O = N[0],
                                          A = N[1],
                                          C = [O + b * Math.sin(_ * l), A - b * Math.cos(_ * l)],
                                          I = C[0],
                                          M = C[1];
                                      d[y] = {
                                          relative: t.relative,
                                          type: x.CURVE_TO,
                                      };
                                      var D = function (e, n) {
                                          var r = a([e * t.rX, n * t.rY], t.xRot),
                                              i = r[0],
                                              o = r[1];
                                          return [t.cX + i, t.cY + o];
                                      };
                                      (r = D(S, T)),
                                          (d[y].x1 = r[0]),
                                          (d[y].y1 = r[1]),
                                          (i = D(I, M)),
                                          (d[y].x2 = i[0]),
                                          (d[y].y2 = i[1]),
                                          (o = D(O, A)),
                                          (d[y].x = o[0]),
                                          (d[y].y = o[1]),
                                          t.relative &&
                                              ((d[y].x1 -= v),
                                              (d[y].y1 -= m),
                                              (d[y].x2 -= v),
                                              (d[y].y2 -= m),
                                              (d[y].x -= v),
                                              (d[y].y -= m)),
                                          (v = (s = [d[y].x, d[y].y])[0]),
                                          (m = s[1]);
                                  }
                                  return d;
                              })(t, t.relative ? 0 : e, t.relative ? 0 : n)
                            : t;
                    });
                }),
                (t.ANNOTATE_ARCS = function () {
                    return i(function (t, e, n) {
                        return t.relative && ((e = 0), (n = 0)), x.ARC === t.type && c(t, e, n), t;
                    });
                }),
                (t.CLONE = function () {
                    return function (t) {
                        var e = {};
                        for (var n in t) e[n] = t[n];
                        return e;
                    };
                }),
                (t.CALCULATE_BOUNDS = function () {
                    var t = e(),
                        o = r(),
                        a = n(),
                        s = i(function (e, n, r) {
                            var i = a(
                                o(
                                    t(
                                        (function (t) {
                                            var e = {};
                                            for (var n in t) e[n] = t[n];
                                            return e;
                                        })(e),
                                    ),
                                ),
                            );
                            function u(t) {
                                t > s.maxX && (s.maxX = t), t < s.minX && (s.minX = t);
                            }
                            function h(t) {
                                t > s.maxY && (s.maxY = t), t < s.minY && (s.minY = t);
                            }
                            if (
                                (i.type & x.DRAWING_COMMANDS && (u(n), h(r)),
                                i.type & x.HORIZ_LINE_TO && u(i.x),
                                i.type & x.VERT_LINE_TO && h(i.y),
                                i.type & x.LINE_TO && (u(i.x), h(i.y)),
                                i.type & x.CURVE_TO)
                            ) {
                                u(i.x), h(i.y);
                                for (var l = 0, p = v(n, i.x1, i.x2, i.x); l < p.length; l++)
                                    0 < (U = p[l]) && 1 > U && u(m(n, i.x1, i.x2, i.x, U));
                                for (var y = 0, g = v(r, i.y1, i.y2, i.y); y < g.length; y++)
                                    0 < (U = g[y]) && 1 > U && h(m(r, i.y1, i.y2, i.y, U));
                            }
                            if (i.type & x.ARC) {
                                u(i.x), h(i.y), c(i, n, r);
                                for (
                                    var _ = (i.xRot / 180) * Math.PI,
                                        w = Math.cos(_) * i.rX,
                                        b = Math.sin(_) * i.rX,
                                        E = -Math.sin(_) * i.rY,
                                        S = Math.cos(_) * i.rY,
                                        T =
                                            i.phi1 < i.phi2
                                                ? [i.phi1, i.phi2]
                                                : -180 > i.phi2
                                                  ? [i.phi2 + 360, i.phi1 + 360]
                                                  : [i.phi2, i.phi1],
                                        N = T[0],
                                        O = T[1],
                                        A = function (t) {
                                            var e = t[0],
                                                n = t[1],
                                                r = (180 * Math.atan2(n, e)) / Math.PI;
                                            return r < N ? r + 360 : r;
                                        },
                                        C = 0,
                                        I = f(E, -w, 0).map(A);
                                    C < I.length;
                                    C++
                                )
                                    (U = I[C]) > N && U < O && u(d(i.cX, w, E, U));
                                for (var M = 0, D = f(S, -b, 0).map(A); M < D.length; M++) {
                                    var U;
                                    (U = D[M]) > N && U < O && h(d(i.cY, b, S, U));
                                }
                            }
                            return e;
                        });
                    return (s.minX = 1 / 0), (s.maxX = -1 / 0), (s.minY = 1 / 0), (s.maxY = -1 / 0), s;
                });
        })(h || (h = {}));
        var y,
            g = (function () {
                function t() {}
                return (
                    (t.prototype.round = function (t) {
                        return this.transform(h.ROUND(t));
                    }),
                    (t.prototype.toAbs = function () {
                        return this.transform(h.TO_ABS());
                    }),
                    (t.prototype.toRel = function () {
                        return this.transform(h.TO_REL());
                    }),
                    (t.prototype.normalizeHVZ = function (t, e, n) {
                        return this.transform(h.NORMALIZE_HVZ(t, e, n));
                    }),
                    (t.prototype.normalizeST = function () {
                        return this.transform(h.NORMALIZE_ST());
                    }),
                    (t.prototype.qtToC = function () {
                        return this.transform(h.QT_TO_C());
                    }),
                    (t.prototype.aToC = function () {
                        return this.transform(h.A_TO_C());
                    }),
                    (t.prototype.sanitize = function (t) {
                        return this.transform(h.SANITIZE(t));
                    }),
                    (t.prototype.translate = function (t, e) {
                        return this.transform(h.TRANSLATE(t, e));
                    }),
                    (t.prototype.scale = function (t, e) {
                        return this.transform(h.SCALE(t, e));
                    }),
                    (t.prototype.rotate = function (t, e, n) {
                        return this.transform(h.ROTATE(t, e, n));
                    }),
                    (t.prototype.matrix = function (t, e, n, r, i, o) {
                        return this.transform(h.MATRIX(t, e, n, r, i, o));
                    }),
                    (t.prototype.skewX = function (t) {
                        return this.transform(h.SKEW_X(t));
                    }),
                    (t.prototype.skewY = function (t) {
                        return this.transform(h.SKEW_Y(t));
                    }),
                    (t.prototype.xSymmetry = function (t) {
                        return this.transform(h.X_AXIS_SYMMETRY(t));
                    }),
                    (t.prototype.ySymmetry = function (t) {
                        return this.transform(h.Y_AXIS_SYMMETRY(t));
                    }),
                    (t.prototype.annotateArcs = function () {
                        return this.transform(h.ANNOTATE_ARCS());
                    }),
                    t
                );
            })(),
            _ = function (t) {
                return ' ' === t || '\t' === t || '\r' === t || '\n' === t;
            },
            w = function (t) {
                return '0'.charCodeAt(0) <= t.charCodeAt(0) && t.charCodeAt(0) <= '9'.charCodeAt(0);
            },
            b = (function (t) {
                function e() {
                    var e = t.call(this) || this;
                    return (
                        (e.curNumber = ''),
                        (e.curCommandType = -1),
                        (e.curCommandRelative = !1),
                        (e.canParseCommandOrComma = !0),
                        (e.curNumberHasExp = !1),
                        (e.curNumberHasExpDigits = !1),
                        (e.curNumberHasDecimal = !1),
                        (e.curArgs = []),
                        e
                    );
                }
                return (
                    i(e, t),
                    (e.prototype.finish = function (t) {
                        if (
                            (void 0 === t && (t = []),
                            this.parse(' ', t),
                            0 !== this.curArgs.length || !this.canParseCommandOrComma)
                        )
                            throw new SyntaxError('Unterminated command at the path end.');
                        return t;
                    }),
                    (e.prototype.parse = function (t, e) {
                        var n = this;
                        void 0 === e && (e = []);
                        for (
                            var r = function (t) {
                                    e.push(t), (n.curArgs.length = 0), (n.canParseCommandOrComma = !0);
                                },
                                i = 0;
                            i < t.length;
                            i++
                        ) {
                            var o = t[i],
                                a = !(
                                    this.curCommandType !== x.ARC ||
                                    (3 !== this.curArgs.length && 4 !== this.curArgs.length) ||
                                    1 !== this.curNumber.length ||
                                    ('0' !== this.curNumber && '1' !== this.curNumber)
                                ),
                                s = w(o) && (('0' === this.curNumber && '0' === o) || a);
                            if (!w(o) || s)
                                if ('e' !== o && 'E' !== o)
                                    if (('-' !== o && '+' !== o) || !this.curNumberHasExp || this.curNumberHasExpDigits)
                                        if ('.' !== o || this.curNumberHasExp || this.curNumberHasDecimal || a) {
                                            if (this.curNumber && -1 !== this.curCommandType) {
                                                var u = Number(this.curNumber);
                                                if (isNaN(u)) throw new SyntaxError('Invalid number ending at ' + i);
                                                if (this.curCommandType === x.ARC)
                                                    if (0 === this.curArgs.length || 1 === this.curArgs.length) {
                                                        if (0 > u)
                                                            throw new SyntaxError(
                                                                'Expected positive number, got "' +
                                                                    u +
                                                                    '" at index "' +
                                                                    i +
                                                                    '"',
                                                            );
                                                    } else if (
                                                        (3 === this.curArgs.length || 4 === this.curArgs.length) &&
                                                        '0' !== this.curNumber &&
                                                        '1' !== this.curNumber
                                                    )
                                                        throw new SyntaxError(
                                                            'Expected a flag, got "' +
                                                                this.curNumber +
                                                                '" at index "' +
                                                                i +
                                                                '"',
                                                        );
                                                this.curArgs.push(u),
                                                    this.curArgs.length === E[this.curCommandType] &&
                                                        (x.HORIZ_LINE_TO === this.curCommandType
                                                            ? r({
                                                                  type: x.HORIZ_LINE_TO,
                                                                  relative: this.curCommandRelative,
                                                                  x: u,
                                                              })
                                                            : x.VERT_LINE_TO === this.curCommandType
                                                              ? r({
                                                                    type: x.VERT_LINE_TO,
                                                                    relative: this.curCommandRelative,
                                                                    y: u,
                                                                })
                                                              : this.curCommandType === x.MOVE_TO ||
                                                                  this.curCommandType === x.LINE_TO ||
                                                                  this.curCommandType === x.SMOOTH_QUAD_TO
                                                                ? (r({
                                                                      type: this.curCommandType,
                                                                      relative: this.curCommandRelative,
                                                                      x: this.curArgs[0],
                                                                      y: this.curArgs[1],
                                                                  }),
                                                                  x.MOVE_TO === this.curCommandType &&
                                                                      (this.curCommandType = x.LINE_TO))
                                                                : this.curCommandType === x.CURVE_TO
                                                                  ? r({
                                                                        type: x.CURVE_TO,
                                                                        relative: this.curCommandRelative,
                                                                        x1: this.curArgs[0],
                                                                        y1: this.curArgs[1],
                                                                        x2: this.curArgs[2],
                                                                        y2: this.curArgs[3],
                                                                        x: this.curArgs[4],
                                                                        y: this.curArgs[5],
                                                                    })
                                                                  : this.curCommandType === x.SMOOTH_CURVE_TO
                                                                    ? r({
                                                                          type: x.SMOOTH_CURVE_TO,
                                                                          relative: this.curCommandRelative,
                                                                          x2: this.curArgs[0],
                                                                          y2: this.curArgs[1],
                                                                          x: this.curArgs[2],
                                                                          y: this.curArgs[3],
                                                                      })
                                                                    : this.curCommandType === x.QUAD_TO
                                                                      ? r({
                                                                            type: x.QUAD_TO,
                                                                            relative: this.curCommandRelative,
                                                                            x1: this.curArgs[0],
                                                                            y1: this.curArgs[1],
                                                                            x: this.curArgs[2],
                                                                            y: this.curArgs[3],
                                                                        })
                                                                      : this.curCommandType === x.ARC &&
                                                                        r({
                                                                            type: x.ARC,
                                                                            relative: this.curCommandRelative,
                                                                            rX: this.curArgs[0],
                                                                            rY: this.curArgs[1],
                                                                            xRot: this.curArgs[2],
                                                                            lArcFlag: this.curArgs[3],
                                                                            sweepFlag: this.curArgs[4],
                                                                            x: this.curArgs[5],
                                                                            y: this.curArgs[6],
                                                                        })),
                                                    (this.curNumber = ''),
                                                    (this.curNumberHasExpDigits = !1),
                                                    (this.curNumberHasExp = !1),
                                                    (this.curNumberHasDecimal = !1),
                                                    (this.canParseCommandOrComma = !0);
                                            }
                                            if (!_(o))
                                                if (',' === o && this.canParseCommandOrComma)
                                                    this.canParseCommandOrComma = !1;
                                                else if ('+' !== o && '-' !== o && '.' !== o)
                                                    if (s) (this.curNumber = o), (this.curNumberHasDecimal = !1);
                                                    else {
                                                        if (0 !== this.curArgs.length)
                                                            throw new SyntaxError(
                                                                'Unterminated command at index ' + i + '.',
                                                            );
                                                        if (!this.canParseCommandOrComma)
                                                            throw new SyntaxError(
                                                                'Unexpected character "' +
                                                                    o +
                                                                    '" at index ' +
                                                                    i +
                                                                    '. Command cannot follow comma',
                                                            );
                                                        if (
                                                            ((this.canParseCommandOrComma = !1), 'z' !== o && 'Z' !== o)
                                                        )
                                                            if ('h' === o || 'H' === o)
                                                                (this.curCommandType = x.HORIZ_LINE_TO),
                                                                    (this.curCommandRelative = 'h' === o);
                                                            else if ('v' === o || 'V' === o)
                                                                (this.curCommandType = x.VERT_LINE_TO),
                                                                    (this.curCommandRelative = 'v' === o);
                                                            else if ('m' === o || 'M' === o)
                                                                (this.curCommandType = x.MOVE_TO),
                                                                    (this.curCommandRelative = 'm' === o);
                                                            else if ('l' === o || 'L' === o)
                                                                (this.curCommandType = x.LINE_TO),
                                                                    (this.curCommandRelative = 'l' === o);
                                                            else if ('c' === o || 'C' === o)
                                                                (this.curCommandType = x.CURVE_TO),
                                                                    (this.curCommandRelative = 'c' === o);
                                                            else if ('s' === o || 'S' === o)
                                                                (this.curCommandType = x.SMOOTH_CURVE_TO),
                                                                    (this.curCommandRelative = 's' === o);
                                                            else if ('q' === o || 'Q' === o)
                                                                (this.curCommandType = x.QUAD_TO),
                                                                    (this.curCommandRelative = 'q' === o);
                                                            else if ('t' === o || 'T' === o)
                                                                (this.curCommandType = x.SMOOTH_QUAD_TO),
                                                                    (this.curCommandRelative = 't' === o);
                                                            else {
                                                                if ('a' !== o && 'A' !== o)
                                                                    throw new SyntaxError(
                                                                        'Unexpected character "' +
                                                                            o +
                                                                            '" at index ' +
                                                                            i +
                                                                            '.',
                                                                    );
                                                                (this.curCommandType = x.ARC),
                                                                    (this.curCommandRelative = 'a' === o);
                                                            }
                                                        else
                                                            e.push({
                                                                type: x.CLOSE_PATH,
                                                            }),
                                                                (this.canParseCommandOrComma = !0),
                                                                (this.curCommandType = -1);
                                                    }
                                                else (this.curNumber = o), (this.curNumberHasDecimal = '.' === o);
                                        } else (this.curNumber += o), (this.curNumberHasDecimal = !0);
                                    else this.curNumber += o;
                                else (this.curNumber += o), (this.curNumberHasExp = !0);
                            else (this.curNumber += o), (this.curNumberHasExpDigits = this.curNumberHasExp);
                        }
                        return e;
                    }),
                    (e.prototype.transform = function (t) {
                        return Object.create(this, {
                            parse: {
                                value: function (e, n) {
                                    void 0 === n && (n = []);
                                    for (
                                        var r = 0, i = Object.getPrototypeOf(this).parse.call(this, e);
                                        r < i.length;
                                        r++
                                    ) {
                                        var o = i[r],
                                            a = t(o);
                                        Array.isArray(a) ? n.push.apply(n, a) : n.push(a);
                                    }
                                    return n;
                                },
                            },
                        });
                    }),
                    e
                );
            })(g),
            x = (function (t) {
                function e(n) {
                    var r = t.call(this) || this;
                    return (r.commands = 'string' == typeof n ? e.parse(n) : n), r;
                }
                return (
                    i(e, t),
                    (e.prototype.encode = function () {
                        return e.encode(this.commands);
                    }),
                    (e.prototype.getBounds = function () {
                        var t = h.CALCULATE_BOUNDS();
                        return this.transform(t), t;
                    }),
                    (e.prototype.transform = function (t) {
                        for (var e = [], n = 0, r = this.commands; n < r.length; n++) {
                            var i = t(r[n]);
                            Array.isArray(i) ? e.push.apply(e, i) : e.push(i);
                        }
                        return (this.commands = e), this;
                    }),
                    (e.encode = function (t) {
                        return o(t);
                    }),
                    (e.parse = function (t) {
                        var e = new b(),
                            n = [];
                        return e.parse(t, n), e.finish(n), n;
                    }),
                    (e.CLOSE_PATH = 1),
                    (e.MOVE_TO = 2),
                    (e.HORIZ_LINE_TO = 4),
                    (e.VERT_LINE_TO = 8),
                    (e.LINE_TO = 16),
                    (e.CURVE_TO = 32),
                    (e.SMOOTH_CURVE_TO = 64),
                    (e.QUAD_TO = 128),
                    (e.SMOOTH_QUAD_TO = 256),
                    (e.ARC = 512),
                    (e.LINE_COMMANDS = e.LINE_TO | e.HORIZ_LINE_TO | e.VERT_LINE_TO),
                    (e.DRAWING_COMMANDS =
                        e.HORIZ_LINE_TO |
                        e.VERT_LINE_TO |
                        e.LINE_TO |
                        e.CURVE_TO |
                        e.SMOOTH_CURVE_TO |
                        e.QUAD_TO |
                        e.SMOOTH_QUAD_TO |
                        e.ARC),
                    e
                );
            })(g),
            E =
                (((y = {})[x.MOVE_TO] = 2),
                (y[x.LINE_TO] = 2),
                (y[x.HORIZ_LINE_TO] = 1),
                (y[x.VERT_LINE_TO] = 1),
                (y[x.CLOSE_PATH] = 0),
                (y[x.QUAD_TO] = 4),
                (y[x.SMOOTH_QUAD_TO] = 2),
                (y[x.CURVE_TO] = 6),
                (y[x.SMOOTH_CURVE_TO] = 4),
                (y[x.ARC] = 7),
                y);
    },
    function (t, e, n) {
        'use strict';
        const r = {
            rectToPath: function (t) {
                const e = void 0 !== t.x ? parseFloat(t.x) : 0,
                    n = void 0 !== t.y ? parseFloat(t.y) : 0,
                    r = void 0 !== t.width ? parseFloat(t.width) : 0,
                    i = void 0 !== t.height ? parseFloat(t.height) : 0,
                    o = void 0 !== t.rx ? parseFloat(t.rx) : void 0 !== t.ry ? parseFloat(t.ry) : 0,
                    a = void 0 !== t.ry ? parseFloat(t.ry) : o;
                return (
                    'M' +
                    (e + o) +
                    ' ' +
                    n +
                    'h' +
                    (r - 2 * o) +
                    (o || a ? 'a ' + o + ' ' + a + ' 0 0 1 ' + o + ' ' + a : '') +
                    'v' +
                    (i - 2 * a) +
                    (o || a ? 'a ' + o + ' ' + a + ' 0 0 1 ' + -1 * o + ' ' + a : '') +
                    'h' +
                    -1 * (r - 2 * o) +
                    (o || a ? 'a ' + o + ' ' + a + ' 0 0 1 ' + -1 * o + ' ' + -1 * a : '') +
                    'v' +
                    -1 * (i - 2 * a) +
                    (o || a ? 'a ' + o + ' ' + a + ' 0 0 1 ' + o + ' ' + -1 * a : '') +
                    'z'
                );
            },
            polylineToPath: function (t) {
                return 'M' + t.points;
            },
            lineToPath: function (t) {
                return (
                    'M' +
                    (parseFloat(t.x1) || 0).toString(10) +
                    ' ' +
                    (parseFloat(t.y1) || 0).toString(10) +
                    ' ' +
                    ((parseFloat(t.x1) || 0) + 1).toString(10) +
                    ' ' +
                    ((parseFloat(t.y1) || 0) + 1).toString(10) +
                    ' ' +
                    ((parseFloat(t.x2) || 0) + 1).toString(10) +
                    ' ' +
                    ((parseFloat(t.y2) || 0) + 1).toString(10) +
                    ' ' +
                    (parseFloat(t.x2) || 0).toString(10) +
                    ' ' +
                    (parseFloat(t.y2) || 0).toString(10) +
                    'Z'
                );
            },
            circleToPath: function (t) {
                const e = parseFloat(t.cx),
                    n = parseFloat(t.cy),
                    r = void 0 !== t.rx ? parseFloat(t.rx) : parseFloat(t.r),
                    i = void 0 !== t.ry ? parseFloat(t.ry) : parseFloat(t.r);
                return (
                    'M' +
                    (e - r) +
                    ',' +
                    n +
                    'A' +
                    r +
                    ',' +
                    i +
                    ' 0,0,0 ' +
                    (e + r) +
                    ',' +
                    n +
                    'A' +
                    r +
                    ',' +
                    i +
                    ' 0,0,0 ' +
                    (e - r) +
                    ',' +
                    n
                );
            },
            polygonToPath: function (t) {
                return 'M' + t.points + 'Z';
            },
        };
        t.exports = r;
    },
    function (t, e, n) {
        /*!
	2D Transformation Matrix v2.7.1
	(c) Epistemex.com 2014-2017
	License: MIT, header required.
*/
        /**
         * 2D transformation matrix object initialized with identity matrix.
         *
         * The matrix can synchronize a canvas 2D context by supplying the context
         * as an argument, or later apply current absolute transform to an
         * existing context.
         *
         * To synchronize a DOM element you can use [`toCSS()`]{@link Matrix#toCSS} or [`toCSS3D()`]{@link Matrix#toCSS3D}.
         *
         * @param {CanvasRenderingContext2D} [context] - Optional context to sync with Matrix
         * @param {HTMLElement} [element=null] - DOM Element to synchronize
         * @prop {number} a - scale x
         * @prop {number} b - shear y
         * @prop {number} c - shear x
         * @prop {number} d - scale y
         * @prop {number} e - translate x
         * @prop {number} f - translate y
         * @prop {CanvasRenderingContext2D} [context] - set or get current synchronized 2D context
         * @prop {HTMLElement} [element] - get current synchronized DOM element
         * @prop {boolean} [useCSS3D=false] - is a DOM element is defined for sync., choose whether to use 2D (false) or 3D (true) matrix to sync it.
         * @constructor
         * @license MIT license (header required)
         * @copyright Epistemex.com 2014-2016
         */
        function r(t, e) {
            var n,
                r = this;
            (r._t = r.transform),
                (r.a = r.d = 1),
                (r.b = r.c = r.e = r.f = 0),
                t && (r.context = t).setTransform(1, 0, 0, 1, 0, 0),
                Object.defineProperty(r, 'element', {
                    get: function () {
                        return n;
                    },
                    set: function (t) {
                        n || ((r._px = r._getPX()), (r.useCSS3D = !1)), (n = t), ((r._st = n.style)[r._px] = r.toCSS());
                    },
                }),
                e && (r.element = e);
        }
        (r.fromTriangles = function (t, e, n) {
            var i,
                o,
                a,
                s,
                u,
                c,
                f = new r(),
                h = new r(n);
            return (
                Array.isArray(t)
                    ? 'number' == typeof t[0]
                        ? ((a = t[4]),
                          (s = t[5]),
                          (u = e[4]),
                          (c = e[5]),
                          (i = [t[0] - a, t[1] - s, t[2] - a, t[3] - s, a, s]),
                          (o = [e[0] - u, e[1] - c, e[2] - u, e[3] - c, u, c]))
                        : ((a = t[2].x),
                          (s = t[2].y),
                          (u = e[2].x),
                          (c = e[2].y),
                          (i = [t[0].x - a, t[0].y - s, t[1].x - a, t[1].y - s, a, s]),
                          (o = [e[0].x - u, e[0].y - c, e[1].x - u, e[1].y - c, u, c]))
                    : ((i = [t.px - t.rx, t.py - t.ry, t.qx - t.rx, t.qy - t.ry, t.rx, t.ry]),
                      (o = [e.px - e.rx, e.py - e.ry, e.qx - e.rx, e.qy - e.ry, e.rx, e.ry])),
                f.setTransform.apply(f, i),
                h.setTransform.apply(h, o),
                h.multiply(f.inverse())
            );
        }),
            (r.fromSVGTransformList = function (t, e, n) {
                for (var i = new r(e, n), o = 0; o < t.length; ) i.multiply(t[o++].matrix);
                return i;
            }),
            (r.from = function (t, e, n, i, o, a, s, u) {
                var c,
                    f,
                    h,
                    l = new r(s, u);
                if ('number' == typeof t) l.setTransform(t, e, n, i, o, a);
                else if ('number' == typeof t.x)
                    (h = Math.sqrt(t.x * t.x + t.y * t.y)),
                        (c = f = 1),
                        i ? (c = h) : (f = h),
                        l
                            .translate(e || 0, n || 0)
                            .rotateFromVector(t)
                            .scaleU(c)
                            .translate(f, 0);
                else {
                    if ('boolean' == typeof t.is2D && !t.is2D) throw 'Cannot use 3D DOMMatrix.';
                    e && (l.context = e), n && (l.element = n), l.multiply(t);
                }
                return l;
            }),
            (r.prototype = {
                _getPX: function () {
                    for (
                        var t,
                            e = ['t', 'oT', 'msT', 'mozT', 'webkitT', 'khtmlT'],
                            n = 0,
                            r = document.createElement('div').style;
                        (t = e[n++]);

                    )
                        if (void 0 !== r[t + 'ransform']) return t + 'ransform';
                },
                concat: function (t) {
                    return this.clone().multiply(t);
                },
                flipX: function () {
                    return this._t(-1, 0, 0, 1, 0, 0);
                },
                flipY: function () {
                    return this._t(1, 0, 0, -1, 0, 0);
                },
                reflectVector: function (t, e) {
                    var n = this.applyToPoint(0, 1),
                        r = 2 * (n.x * t + n.y * e);
                    return { x: (t -= r * n.x), y: (e -= r * n.y) };
                },
                reset: function () {
                    return this.setTransform(1, 0, 0, 1, 0, 0);
                },
                rotate: function (t) {
                    var e = Math.cos(t),
                        n = Math.sin(t);
                    return this._t(e, n, -n, e, 0, 0);
                },
                rotateFromVector: function (t, e) {
                    return this.rotate('number' == typeof t ? Math.atan2(e, t) : Math.atan2(t.y, t.x));
                },
                rotateDeg: function (t) {
                    return this.rotate((t * Math.PI) / 180);
                },
                scaleU: function (t) {
                    return this._t(t, 0, 0, t, 0, 0);
                },
                scale: function (t, e) {
                    return this._t(t, 0, 0, e, 0, 0);
                },
                scaleX: function (t) {
                    return this._t(t, 0, 0, 1, 0, 0);
                },
                scaleY: function (t) {
                    return this._t(1, 0, 0, t, 0, 0);
                },
                scaleFromVector: function (t, e) {
                    return this.scaleU(Math.sqrt(t * t + e * e));
                },
                shear: function (t, e) {
                    return this._t(1, e, t, 1, 0, 0);
                },
                shearX: function (t) {
                    return this._t(1, 0, t, 1, 0, 0);
                },
                shearY: function (t) {
                    return this._t(1, t, 0, 1, 0, 0);
                },
                skew: function (t, e) {
                    return this.shear(Math.tan(t), Math.tan(e));
                },
                skewDeg: function (t, e) {
                    return this.shear(Math.tan((t / 180) * Math.PI), Math.tan((e / 180) * Math.PI));
                },
                skewX: function (t) {
                    return this.shearX(Math.tan(t));
                },
                skewY: function (t) {
                    return this.shearY(Math.tan(t));
                },
                setTransform: function (t, e, n, r, i, o) {
                    var a = this;
                    return (a.a = t), (a.b = e), (a.c = n), (a.d = r), (a.e = i), (a.f = o), a._x();
                },
                translate: function (t, e) {
                    return this._t(1, 0, 0, 1, t, e);
                },
                translateX: function (t) {
                    return this._t(1, 0, 0, 1, t, 0);
                },
                translateY: function (t) {
                    return this._t(1, 0, 0, 1, 0, t);
                },
                transform: function (t, e, n, r, i, o) {
                    var a = this,
                        s = a.a,
                        u = a.b,
                        c = a.c,
                        f = a.d,
                        h = a.e,
                        l = a.f;
                    return (
                        (a.a = s * t + c * e),
                        (a.b = u * t + f * e),
                        (a.c = s * n + c * r),
                        (a.d = u * n + f * r),
                        (a.e = s * i + c * o + h),
                        (a.f = u * i + f * o + l),
                        a._x()
                    );
                },
                multiply: function (t) {
                    return this._t(t.a, t.b, t.c, t.d, t.e, t.f);
                },
                divide: function (t) {
                    return this.multiply(t.inverse());
                },
                divideScalar: function (t) {
                    var e = this;
                    if (!t) throw 'Division on zero';
                    return (e.a /= t), (e.b /= t), (e.c /= t), (e.d /= t), (e.e /= t), (e.f /= t), e._x();
                },
                inverse: function (t, e) {
                    var n = this,
                        i = new r(t ? n.context : null, e ? n.element : null),
                        o = n.determinant();
                    if (n._q(o, 0)) throw 'Matrix not invertible.';
                    return (
                        (i.a = n.d / o),
                        (i.b = -n.b / o),
                        (i.c = -n.c / o),
                        (i.d = n.a / o),
                        (i.e = (n.c * n.f - n.d * n.e) / o),
                        (i.f = -(n.a * n.f - n.b * n.e) / o),
                        i
                    );
                },
                interpolate: function (t, e, n, i) {
                    var o = this,
                        a = new r(n, i);
                    return (
                        (a.a = o.a + (t.a - o.a) * e),
                        (a.b = o.b + (t.b - o.b) * e),
                        (a.c = o.c + (t.c - o.c) * e),
                        (a.d = o.d + (t.d - o.d) * e),
                        (a.e = o.e + (t.e - o.e) * e),
                        (a.f = o.f + (t.f - o.f) * e),
                        a._x()
                    );
                },
                interpolateAnim: function (t, e, n, i) {
                    var o = new r(n, i),
                        a = this.decompose(),
                        s = t.decompose(),
                        u = a.translate,
                        c = s.translate,
                        f = a.scale;
                    return (
                        o.translate(u.x + (c.x - u.x) * e, u.y + (c.y - u.y) * e),
                        o.rotate(a.rotation + (s.rotation - a.rotation) * e),
                        o.scale(f.x + (s.scale.x - f.x) * e, f.y + (s.scale.y - f.y) * e),
                        o._x()
                    );
                },
                decompose: function (t) {
                    var e = this,
                        n = e.a,
                        r = e.b,
                        i = e.c,
                        o = e.d,
                        a = Math.acos,
                        s = Math.atan,
                        u = Math.sqrt,
                        c = Math.PI,
                        f = { x: e.e, y: e.f },
                        h = 0,
                        l = { x: 1, y: 1 },
                        p = { x: 0, y: 0 },
                        d = n * o - r * i;
                    if (t)
                        n
                            ? ((p = { x: s(i / n), y: s(r / n) }), (l = { x: n, y: d / n }))
                            : r
                              ? ((h = 0.5 * c), (l = { x: r, y: d / r }), (p.x = s(o / r)))
                              : ((l = { x: i, y: o }), (p.x = 0.25 * c));
                    else if (n || r) {
                        var v = u(n * n + r * r);
                        (h = r > 0 ? a(n / v) : -a(n / v)),
                            (l = { x: v, y: d / v }),
                            (p.x = s((n * i + r * o) / (v * v)));
                    } else if (i || o) {
                        var m = u(i * i + o * o);
                        (h = 0.5 * c - (o > 0 ? a(-i / m) : -a(i / m))),
                            (l = { x: d / m, y: m }),
                            (p.y = s((n * i + r * o) / (m * m)));
                    } else l = { x: 0, y: 0 };
                    return { translate: f, rotation: h, scale: l, skew: p };
                },
                determinant: function () {
                    return this.a * this.d - this.b * this.c;
                },
                applyToPoint: function (t, e) {
                    var n = this;
                    return {
                        x: t * n.a + e * n.c + n.e,
                        y: t * n.b + e * n.d + n.f,
                    };
                },
                applyToArray: function (t) {
                    var e,
                        n,
                        r = 0,
                        i = [];
                    if ('number' == typeof t[0])
                        for (n = t.length; r < n; ) (e = this.applyToPoint(t[r++], t[r++])), i.push(e.x, e.y);
                    else for (; (e = t[r++]); ) i.push(this.applyToPoint(e.x, e.y));
                    return i;
                },
                applyToTypedArray: function (t, e) {
                    for (var n, r = 0, i = t.length, o = e ? new Float64Array(i) : new Float32Array(i); r < i; )
                        (n = this.applyToPoint(t[r], t[r + 1])), (o[r++] = n.x), (o[r++] = n.y);
                    return o;
                },
                applyToContext: function (t) {
                    var e = this;
                    return t.setTransform(e.a, e.b, e.c, e.d, e.e, e.f), e;
                },
                applyToElement: function (t, e) {
                    var n = this;
                    return n._px || (n._px = n._getPX()), (t.style[n._px] = e ? n.toCSS3D() : n.toCSS()), n;
                },
                applyToObject: function (t) {
                    var e = this;
                    return (t.a = e.a), (t.b = e.b), (t.c = e.c), (t.d = e.d), (t.e = e.e), (t.f = e.f), e;
                },
                isIdentity: function () {
                    var t = this;
                    return t._q(t.a, 1) && t._q(t.b, 0) && t._q(t.c, 0) && t._q(t.d, 1) && t._q(t.e, 0) && t._q(t.f, 0);
                },
                isInvertible: function () {
                    return !this._q(this.determinant(), 0);
                },
                isValid: function () {
                    return !(this.a * this.d);
                },
                isEqual: function (t) {
                    var e = this,
                        n = e._q;
                    return n(e.a, t.a) && n(e.b, t.b) && n(e.c, t.c) && n(e.d, t.d) && n(e.e, t.e) && n(e.f, t.f);
                },
                clone: function (t) {
                    return new r(t ? null : this.context).multiply(this);
                },
                toArray: function () {
                    var t = this;
                    return [t.a, t.b, t.c, t.d, t.e, t.f];
                },
                toTypedArray: function (t) {
                    var e = t ? new Float64Array(6) : new Float32Array(6),
                        n = this;
                    return (e[0] = n.a), (e[1] = n.b), (e[2] = n.c), (e[3] = n.d), (e[4] = n.e), (e[5] = n.f), e;
                },
                toCSS: function () {
                    return 'matrix(' + this.toArray() + ')';
                },
                toCSS3D: function () {
                    var t = this;
                    return (
                        'matrix3d(' +
                        t.a +
                        ',' +
                        t.b +
                        ',0,0,' +
                        t.c +
                        ',' +
                        t.d +
                        ',0,0,0,0,1,0,' +
                        t.e +
                        ',' +
                        t.f +
                        ',0,1)'
                    );
                },
                toJSON: function () {
                    var t = this;
                    return (
                        '{"a":' +
                        t.a +
                        ',"b":' +
                        t.b +
                        ',"c":' +
                        t.c +
                        ',"d":' +
                        t.d +
                        ',"e":' +
                        t.e +
                        ',"f":' +
                        t.f +
                        '}'
                    );
                },
                toString: function (t) {
                    var e = this;
                    return (
                        (t = t || 4),
                        'a=' +
                            e.a.toFixed(t) +
                            ' b=' +
                            e.b.toFixed(t) +
                            ' c=' +
                            e.c.toFixed(t) +
                            ' d=' +
                            e.d.toFixed(t) +
                            ' e=' +
                            e.e.toFixed(t) +
                            ' f=' +
                            e.f.toFixed(t)
                    );
                },
                toCSV: function () {
                    return this.toArray().join() + '\r\n';
                },
                toDOMMatrix: function () {
                    var t = null;
                    return (
                        'DOMMatrix' in window &&
                            (((t = new DOMMatrix()).a = this.a),
                            (t.b = this.b),
                            (t.c = this.c),
                            (t.d = this.d),
                            (t.e = this.e),
                            (t.f = this.f)),
                        t
                    );
                },
                toSVGMatrix: function () {
                    var t = this,
                        e = document.createElementNS('http://www.w3.org/2000/svg', 'svg'),
                        n = null;
                    return (
                        e &&
                            (((n = e.createSVGMatrix()).a = t.a),
                            (n.b = t.b),
                            (n.c = t.c),
                            (n.d = t.d),
                            (n.e = t.e),
                            (n.f = t.f)),
                        n
                    );
                },
                _q: function (t, e) {
                    return Math.abs(t - e) < 1e-14;
                },
                _x: function () {
                    var t = this;
                    return (
                        t.context && t.context.setTransform(t.a, t.b, t.c, t.d, t.e, t.f),
                        t._st && (t._st[t._px] = t.useCSS3D ? t.toCSS3D() : t.toCSS()),
                        t
                    );
                },
            }),
            (e.Matrix = r);
    },
    function (t, e) {
        /*! https://mths.be/codepointat v0.2.0 by @mathias */
        String.prototype.codePointAt ||
            (function () {
                'use strict';
                var t = (function () {
                        try {
                            var t = {},
                                e = Object.defineProperty,
                                n = e(t, t, t) && e;
                        } catch (t) {}
                        return n;
                    })(),
                    e = function (t) {
                        if (null == this) throw TypeError();
                        var e = String(this),
                            n = e.length,
                            r = t ? Number(t) : 0;
                        if ((r != r && (r = 0), !(r < 0 || r >= n))) {
                            var i,
                                o = e.charCodeAt(r);
                            return o >= 55296 &&
                                o <= 56319 &&
                                n > r + 1 &&
                                (i = e.charCodeAt(r + 1)) >= 56320 &&
                                i <= 57343
                                ? 1024 * (o - 55296) + i - 56320 + 65536
                                : o;
                        }
                    };
                t
                    ? t(String.prototype, 'codePointAt', {
                          value: e,
                          configurable: !0,
                          writable: !0,
                      })
                    : (String.prototype.codePointAt = e);
            })();
    },
]);
//# sourceMappingURL=create-font.js.map
