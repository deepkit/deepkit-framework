import { PropertySchema } from '@deepkit/type';

export type FakerDataType = 'string' | 'date' | 'number' | 'boolean' | 'any';

export type FakerTypes = Record<string, {
    example: any,
    type: FakerDataType
}>;

export function getType(v: any): FakerDataType {
    if ('string' === typeof v) return 'string';
    if ('number' === typeof v) return 'number';
    if ('boolean' === typeof v) return 'boolean';
    if (v instanceof Date) return 'date';
    return 'any';
}

export function findFakerForName(types: FakerTypes, name: string, type: FakerDataType): string | undefined {
    for (const [fakeName, info] of Object.entries(types)) {
        if (info.type !== type) continue;
        const [p1, p2] = fakeName.toLowerCase().split('.');
        if (p2 && p2.includes(name)) return fakeName;
        if (p2 && name.includes(p2)) return fakeName;
    }
    return undefined;
}

export function findFaker(types: FakerTypes, property: PropertySchema): string {
    const name = property.name.toLowerCase();

    if (property.type === 'date') {
        if (name.includes('birthdate')) return 'date.past';
        if (name.endsWith('ed')) return 'date.past';

        return 'date.future';
    }

    if (property.type === 'number') {
        return findFakerForName(types, name, 'number') || 'random.number';
    }

    if (property.type === 'boolean') {
        return 'random.boolean';
    }

    if (property.type === 'string') {
        if (name.includes('first')) return 'name.firstName';
        if (name.includes('last')) return 'name.lastName';
        if (name.includes('iban')) return 'finance.iban';
        if (name.includes('bic')) return 'finance.bic';
        if (name.includes('name')) return 'internet.userName';
        if (name.includes('image')) return 'image.imageUrl';
        if (name.includes('mobile')) return 'phone.phoneNumber';
        if (name.includes('phone')) return 'phone.phoneNumber';

        return findFakerForName(types, name, 'string') || 'random.alphaNumeric';
    }

    return '';
}

export const fakerFunctions: string[] = [
    'address.zipCode',
    // 'address.zipCodeByState',
    'address.city',
    'address.cityPrefix',
    'address.citySuffix',
    'address.streetName',
    'address.streetAddress',
    'address.streetSuffix',
    'address.streetPrefix',
    'address.secondaryAddress',
    'address.county',
    'address.country',
    'address.countryCode',
    'address.state',
    'address.stateAbbr',
    'address.latitude',
    'address.direction',
    'address.cardinalDirection',
    'address.ordinalDirection',
    // 'address.nearbyGPSCoordinate',
    'address.timeZone',
    'commerce.color',
    'commerce.department',
    'commerce.productName',
    'commerce.price',
    'commerce.productAdjective',
    'commerce.productMaterial',
    'commerce.product',
    'commerce.productDescription',
    'company.suffixes',
    'company.companyName',
    'company.companySuffix',
    'company.catchPhrase',
    'company.bs',
    'company.catchPhraseAdjective',
    'company.catchPhraseDescriptor',
    'company.catchPhraseNoun',
    'company.bsAdjective',
    'company.bsBuzz',
    'company.bsNoun',
    'database.column',
    'database.type',
    'database.collation',
    'database.engine',
    'date.past',
    'date.future',
    'date.between',
    'date.betweens',
    'date.recent',
    'date.soon',
    'date.month',
    'date.weekday',
    'finance.account',
    'finance.accountName',
    'finance.routingNumber',
    'finance.mask',
    'finance.amount',
    'finance.transactionType',
    'finance.currencyCode',
    'finance.currencyName',
    'finance.currencySymbol',
    'finance.bitcoinAddress',
    'finance.litecoinAddress',
    'finance.creditCardNumber',
    'finance.creditCardCVV',
    'finance.ethereumAddress',
    'finance.iban',
    'finance.bic',
    'finance.transactionDescription',
    'git.branch',
    'git.commitEntry',
    'git.commitMessage',
    'git.commitSha',
    'git.shortSha',
    'hacker.abbreviation',
    'hacker.adjective',
    'hacker.noun',
    'hacker.verb',
    'hacker.ingverb',
    'hacker.phrase',
    'image.image',
    // 'image.avatar', //many generated links are 403
    'image.imageUrl',
    'image.abstract',
    'image.animals',
    'image.business',
    'image.cats',
    'image.city',
    'image.food',
    'image.nightlife',
    'image.fashion',
    'image.people',
    'image.nature',
    'image.sports',
    'image.technics',
    'image.transport',
    'image.dataUri',
    'internet.avatar',
    'internet.email',
    'internet.exampleEmail',
    'internet.userName',
    'internet.protocol',
    'internet.httpMethod',
    'internet.url',
    'internet.domainName',
    'internet.domainSuffix',
    'internet.domainWord',
    'internet.ip',
    'internet.ipv6',
    'internet.port',
    'internet.userAgent',
    'internet.color',
    'internet.mac',
    'internet.password',
    'lorem.word',
    'lorem.words',
    'lorem.sentence',
    'lorem.slug',
    'lorem.sentences',
    'lorem.paragraph',
    'lorem.paragraphs',
    'lorem.text',
    'lorem.lines',
    'music.genre',
    'name.firstName',
    'name.lastName',
    'name.middleName',
    'name.findName',
    'name.jobTitle',
    'name.gender',
    'name.prefix',
    'name.suffix',
    'name.title',
    'name.jobDescriptor',
    'name.jobArea',
    'name.jobType',
    'phone.phoneNumber',
    'phone.phoneNumberFormat',
    'phone.phoneFormats',
    'random.number',
    'random.float',
    'random.arrayElement',
    'random.arrayElements',
    'random.objectElement',
    'random.uuid',
    'random.boolean',
    'random.word',
    'random.words',
    'random.image',
    'random.locale',
    'random.alpha',
    'random.alphaNumeric',
    'random.hexaDecimal',
    'system.fileName',
    'system.commonFileName',
    'system.mimeType',
    'system.commonFileType',
    'system.commonFileExt',
    'system.fileType',
    'system.fileExt',
    'system.directoryPath',
    'system.filePath',
    'system.semver',
    'time.recent',
    'vehicle.vehicle',
    'vehicle.manufacturer',
    'vehicle.model',
    'vehicle.type',
    'vehicle.fuel',
    'vehicle.vin',
    'vehicle.color',
    'vehicle.vrm',
];