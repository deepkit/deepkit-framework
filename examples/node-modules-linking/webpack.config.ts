import { composePlugins, withNx } from '@nx/webpack';
import { withDeepkit } from '../../dist/packages/nx-webpack-plugin';

export default composePlugins(withNx(), withDeepkit());
