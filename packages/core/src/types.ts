export type InjectMeta<T = never> = { __meta?: never & ['inject', T] };
export type Inject<Type, Token = never> = Type & InjectMeta<Token>;
