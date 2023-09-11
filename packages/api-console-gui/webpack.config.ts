import { composePlugins, withNx } from '@nx/webpack';
import { withDeepkit } from '@deepkit/nx-webpack-plugin';

// FIXME: TypeError: transformer is not a function
export default composePlugins(withNx(), withDeepkit());
