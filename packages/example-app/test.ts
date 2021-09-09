import { t } from '@deepkit/type';

interface FilterQuery<T> {}

class Peter {
    @t.map(t.any) query?: FilterQuery<any>;
}
