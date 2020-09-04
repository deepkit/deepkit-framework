export class ExchangeConfig {
    public startOnBootstrap: boolean = true;

    constructor(
        public hostOrUnixPath: string = '/tmp/super-hornet-exchange.sock'
    ) {
    }

    static forUrl(hostOrUnixPath: string): ExchangeConfig {
        return new this(hostOrUnixPath);
    }
}
