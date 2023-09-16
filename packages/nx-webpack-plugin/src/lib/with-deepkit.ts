import type { NxWebpackPlugin } from '@nx/webpack';
import type { RuleSetRule } from 'webpack';
import type { LoaderOptions } from 'ts-loader/dist/interfaces';
import * as typeCompiler from '@deepkit/type-compiler';

interface TsLoaderRule extends RuleSetRule {
  readonly options: LoaderOptions;
}

type GetCustomTransformers = Exclude<
  LoaderOptions['getCustomTransformers'],
  string
>;

function addDeepkitTransformer(
  prevGetCustomTransformers: Exclude<
    LoaderOptions['getCustomTransformers'],
    string
  >,
): GetCustomTransformers {
  return (program, getProgram) => {
    const customTransformers = {
      ...prevGetCustomTransformers?.(program, getProgram),
    };
    customTransformers.before = [
      typeCompiler.transformer,
      ...(customTransformers.before || []),
    ];
    customTransformers.afterDeclarations = [
      typeCompiler.declarationTransformer,
      ...(customTransformers.afterDeclarations || []),
    ];
    return customTransformers;
  };
}

export function withDeepkit(): NxWebpackPlugin {
  return config => {
    const rules = config.module!.rules! as readonly RuleSetRule[];

    rules
      .filter(
        (rule): rule is TsLoaderRule => !!rule.loader?.includes('ts-loader'),
      )
      .forEach(tsRule => {
        tsRule.options!.getCustomTransformers = addDeepkitTransformer(
          tsRule.options.getCustomTransformers as GetCustomTransformers,
        );
      });

    return config;
  };
}
