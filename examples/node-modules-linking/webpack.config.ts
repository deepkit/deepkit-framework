import { composePlugins, withNx } from '@nx/webpack';
import { withDeepkit } from '@deepkit-modules/nx-webpack-plugin';

export default composePlugins(withNx(), withDeepkit());
