import { ReflectionKind, Type } from '@deepkit/type';

export type FakerDataType = 'string' | 'date' | 'number' | 'boolean' | 'any';

export type FakerTypes = Record<
    string,
    {
        example: any;
        type: FakerDataType;
    }
>;

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

export function findFaker(types: FakerTypes, propertyName: string, type: Type): string {
    const name = propertyName.toLowerCase();

    if (type.kind === ReflectionKind.class && type.classType === Date) {
        if (name.includes('birthdate')) return 'date.past';
        if (name.endsWith('ed')) return 'date.past';

        return 'date.future';
    } else if (type.kind === ReflectionKind.number || type.kind === ReflectionKind.bigint) {
        return findFakerForName(types, name, 'number') || 'number.int';
    } else if (type.kind === ReflectionKind.boolean) {
        return 'datatype.boolean';
    } else if (type.kind === ReflectionKind.string) {
        if (name.includes('first')) return 'person.firstName';
        if (name.includes('last')) return 'person.lastName';
        if (name.includes('iban')) return 'finance.iban';
        if (name.includes('bic')) return 'finance.bic';
        if (name.includes('name')) return 'internet.username';
        if (name.includes('image')) return 'image.url';
        if (name.includes('mobile')) return 'phone.number';
        if (name.includes('phone')) return 'phone.number';

        return findFakerForName(types, name, 'string') || 'string.alphanumeric';
    }

    return '';
}

// Lightweight faker implementation - no external dependencies
// Provides the same interface as @faker-js/faker but with minimal footprint

const pick = <T>(arr: readonly T[]): T => arr[Math.floor(Math.random() * arr.length)];
const randInt = (min: number, max: number): number => Math.floor(Math.random() * (max - min + 1)) + min;
const randFloat = (min: number, max: number, precision = 2): number =>
    +(Math.random() * (max - min) + min).toFixed(precision);
const randHex = (len: number): string =>
    Array.from({ length: len }, () => Math.floor(Math.random() * 16).toString(16)).join('');
const alphaChars = 'abcdefghijklmnopqrstuvwxyz'.split('');
const alphaNumChars = 'abcdefghijklmnopqrstuvwxyz0123456789'.split('');
const randAlpha = (len: number): string => Array.from({ length: len }, () => pick(alphaChars)).join('');
const randAlphaNum = (len: number): string => Array.from({ length: len }, () => pick(alphaNumChars)).join('');

// Data arrays
const firstNames = [
    'James',
    'Mary',
    'John',
    'Patricia',
    'Robert',
    'Jennifer',
    'Michael',
    'Linda',
    'William',
    'Elizabeth',
    'David',
    'Susan',
    'Joseph',
    'Jessica',
    'Thomas',
    'Sarah',
    'Charles',
    'Karen',
    'Daniel',
    'Lisa',
    'Emma',
    'Olivia',
    'Ava',
    'Sophia',
    'Mia',
    'Liam',
    'Noah',
    'Oliver',
    'Lucas',
    'Mason',
];
const lastNames = [
    'Smith',
    'Johnson',
    'Williams',
    'Brown',
    'Jones',
    'Garcia',
    'Miller',
    'Davis',
    'Rodriguez',
    'Martinez',
    'Hernandez',
    'Lopez',
    'Gonzalez',
    'Wilson',
    'Anderson',
    'Thomas',
    'Taylor',
    'Moore',
    'Jackson',
    'Martin',
    'Lee',
    'Thompson',
    'White',
    'Harris',
    'Clark',
];
const cities = [
    'New York',
    'Los Angeles',
    'Chicago',
    'Houston',
    'Phoenix',
    'Philadelphia',
    'San Antonio',
    'San Diego',
    'Dallas',
    'San Jose',
    'Austin',
    'Jacksonville',
    'Fort Worth',
    'Columbus',
    'Charlotte',
    'Seattle',
    'Denver',
    'Boston',
    'Portland',
    'Miami',
];
const countries = [
    'United States',
    'Canada',
    'United Kingdom',
    'Germany',
    'France',
    'Australia',
    'Japan',
    'Brazil',
    'India',
    'Mexico',
    'Spain',
    'Italy',
    'Netherlands',
    'Sweden',
    'Norway',
];
const countryCodes = ['US', 'CA', 'GB', 'DE', 'FR', 'AU', 'JP', 'BR', 'IN', 'MX', 'ES', 'IT', 'NL', 'SE', 'NO'];
const states = [
    'California',
    'Texas',
    'Florida',
    'New York',
    'Pennsylvania',
    'Illinois',
    'Ohio',
    'Georgia',
    'North Carolina',
    'Michigan',
    'Washington',
    'Arizona',
    'Colorado',
    'Virginia',
    'Oregon',
];
const streets = [
    'Main',
    'Oak',
    'Maple',
    'Cedar',
    'Pine',
    'Elm',
    'Washington',
    'Lake',
    'Hill',
    'Park',
    'River',
    'Spring',
    'Valley',
    'Forest',
    'Sunset',
];
const streetSuffixes = ['Street', 'Avenue', 'Boulevard', 'Drive', 'Lane', 'Road', 'Way', 'Court', 'Place', 'Circle'];
const colors = [
    'red',
    'blue',
    'green',
    'yellow',
    'purple',
    'orange',
    'pink',
    'brown',
    'black',
    'white',
    'gray',
    'cyan',
    'magenta',
    'lime',
    'teal',
];
const departments = [
    'Electronics',
    'Clothing',
    'Home',
    'Garden',
    'Sports',
    'Toys',
    'Books',
    'Music',
    'Movies',
    'Games',
    'Health',
    'Beauty',
    'Automotive',
    'Grocery',
    'Office',
];
const productAdjectives = [
    'Small',
    'Ergonomic',
    'Rustic',
    'Intelligent',
    'Gorgeous',
    'Incredible',
    'Fantastic',
    'Practical',
    'Sleek',
    'Awesome',
    'Refined',
    'Handmade',
    'Licensed',
    'Recycled',
    'Premium',
];
const productMaterials = [
    'Steel',
    'Wooden',
    'Concrete',
    'Plastic',
    'Cotton',
    'Granite',
    'Rubber',
    'Metal',
    'Soft',
    'Fresh',
    'Frozen',
    'Leather',
    'Silk',
    'Wool',
    'Bronze',
];
const products = [
    'Chair',
    'Car',
    'Computer',
    'Keyboard',
    'Mouse',
    'Bike',
    'Ball',
    'Gloves',
    'Pants',
    'Shirt',
    'Table',
    'Shoes',
    'Hat',
    'Towels',
    'Soap',
    'Tuna',
    'Chicken',
    'Fish',
    'Cheese',
    'Bacon',
];
const companySuffixes = [
    'Inc',
    'LLC',
    'Group',
    'Corp',
    'Ltd',
    'Co',
    'Industries',
    'Solutions',
    'Technologies',
    'Systems',
];
const buzzAdjectives = [
    'innovative',
    'cutting-edge',
    'next-generation',
    'world-class',
    'best-of-breed',
    'killer',
    'magnetic',
    'revolutionary',
    'scalable',
    'robust',
];
const buzzNouns = [
    'synergies',
    'paradigms',
    'markets',
    'partnerships',
    'infrastructures',
    'platforms',
    'initiatives',
    'channels',
    'communities',
    'solutions',
];
const buzzVerbs = [
    'implement',
    'utilize',
    'integrate',
    'streamline',
    'optimize',
    'evolve',
    'transform',
    'embrace',
    'enable',
    'orchestrate',
];
const dbColumns = [
    'id',
    'title',
    'name',
    'email',
    'status',
    'created_at',
    'updated_at',
    'category',
    'price',
    'description',
];
const dbTypes = ['int', 'varchar', 'text', 'datetime', 'boolean', 'decimal', 'float', 'bigint', 'json', 'uuid'];
const dbCollations = ['utf8_general_ci', 'utf8mb4_unicode_ci', 'latin1_swedish_ci', 'ascii_general_ci', 'utf8_bin'];
const dbEngines = ['InnoDB', 'MyISAM', 'MEMORY', 'CSV', 'ARCHIVE', 'PostgreSQL', 'SQLite'];
const months = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
];
const weekdays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const currencyCodes = ['USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'CHF', 'CNY', 'INR', 'MXN'];
const currencyNames = [
    'US Dollar',
    'Euro',
    'British Pound',
    'Japanese Yen',
    'Canadian Dollar',
    'Australian Dollar',
    'Swiss Franc',
    'Chinese Yuan',
    'Indian Rupee',
    'Mexican Peso',
];
const currencySymbols = ['$', '€', '£', '¥', 'C$', 'A$', 'CHF', '¥', '₹', 'MX$'];
const transactionTypes = ['deposit', 'withdrawal', 'payment', 'invoice', 'transfer'];
const hackerAbbreviations = [
    'TCP',
    'HTTP',
    'SDD',
    'RAM',
    'GB',
    'CSS',
    'SSL',
    'AGP',
    'SQL',
    'FTP',
    'PNG',
    'SAS',
    'AI',
    'API',
    'CLI',
];
const hackerAdjectives = [
    'auxiliary',
    'primary',
    'back-end',
    'digital',
    'open-source',
    'virtual',
    'cross-platform',
    'redundant',
    'online',
    'haptic',
];
const hackerNouns = [
    'driver',
    'protocol',
    'bandwidth',
    'panel',
    'microchip',
    'program',
    'port',
    'card',
    'array',
    'interface',
];
const hackerVerbs = [
    'back up',
    'bypass',
    'hack',
    'override',
    'compress',
    'copy',
    'navigate',
    'index',
    'connect',
    'generate',
];
const hackerIngverbs = [
    'backing up',
    'bypassing',
    'hacking',
    'overriding',
    'compressing',
    'copying',
    'navigating',
    'indexing',
    'connecting',
    'generating',
];
const loremWords = [
    'lorem',
    'ipsum',
    'dolor',
    'sit',
    'amet',
    'consectetur',
    'adipiscing',
    'elit',
    'sed',
    'do',
    'eiusmod',
    'tempor',
    'incididunt',
    'ut',
    'labore',
    'et',
    'dolore',
    'magna',
    'aliqua',
];
const musicGenres = [
    'Rock',
    'Pop',
    'Hip Hop',
    'Jazz',
    'Classical',
    'Country',
    'Electronic',
    'R&B',
    'Reggae',
    'Blues',
    'Folk',
    'Metal',
    'Punk',
    'Soul',
    'Disco',
];
const jobDescriptors = [
    'Lead',
    'Senior',
    'Direct',
    'Corporate',
    'Dynamic',
    'Future',
    'Product',
    'National',
    'Regional',
    'District',
    'Central',
    'Global',
    'Chief',
    'Principal',
];
const jobAreas = [
    'Response',
    'Program',
    'Brand',
    'Security',
    'Research',
    'Marketing',
    'Directives',
    'Implementation',
    'Integration',
    'Functionality',
];
const jobTypes = [
    'Supervisor',
    'Associate',
    'Executive',
    'Liaison',
    'Officer',
    'Manager',
    'Engineer',
    'Specialist',
    'Director',
    'Coordinator',
];
const mimeTypes = [
    'application/json',
    'text/html',
    'text/plain',
    'image/png',
    'image/jpeg',
    'application/pdf',
    'application/xml',
    'text/css',
    'application/javascript',
];
const fileTypes = ['video', 'audio', 'image', 'text', 'application'];
const fileExtensions = [
    'pdf',
    'txt',
    'doc',
    'docx',
    'xls',
    'xlsx',
    'png',
    'jpg',
    'gif',
    'mp3',
    'mp4',
    'zip',
    'json',
    'xml',
    'csv',
];
const commonFileTypes = ['video', 'audio', 'image', 'text', 'application'];
const commonFileExts = ['pdf', 'txt', 'png', 'jpg', 'gif', 'mp3', 'mp4', 'zip'];
const vehicleManufacturers = [
    'Toyota',
    'Ford',
    'Honda',
    'Chevrolet',
    'BMW',
    'Mercedes',
    'Audi',
    'Volkswagen',
    'Nissan',
    'Hyundai',
    'Kia',
    'Tesla',
    'Volvo',
    'Mazda',
    'Subaru',
];
const vehicleModels = [
    'Model S',
    'Mustang',
    'Civic',
    'Camry',
    'Accord',
    'F-150',
    'Silverado',
    'Corolla',
    'RAV4',
    'CR-V',
    'Altima',
    'Elantra',
    'Sonata',
    'Outback',
    'CX-5',
];
const vehicleTypes = [
    'Sedan',
    'SUV',
    'Truck',
    'Coupe',
    'Hatchback',
    'Convertible',
    'Van',
    'Wagon',
    'Minivan',
    'Crossover',
];
const vehicleFuels = ['Gasoline', 'Diesel', 'Electric', 'Hybrid', 'Hydrogen', 'Biodiesel', 'Ethanol', 'Natural Gas'];
const adjectives = ['quick', 'lazy', 'sleepy', 'noisy', 'hungry', 'beautiful', 'clever', 'brave', 'calm', 'eager'];
const adverbs = [
    'quickly',
    'slowly',
    'easily',
    'happily',
    'sadly',
    'loudly',
    'quietly',
    'carefully',
    'suddenly',
    'finally',
];
const conjunctions = ['and', 'but', 'or', 'nor', 'for', 'yet', 'so', 'because', 'although', 'while'];
const interjections = ['oh', 'wow', 'hey', 'oops', 'ouch', 'yay', 'ugh', 'hmm', 'ah', 'well'];
const nouns = ['time', 'year', 'people', 'way', 'day', 'man', 'woman', 'child', 'world', 'life'];
const prepositions = ['in', 'on', 'at', 'by', 'for', 'with', 'about', 'against', 'between', 'into'];
const verbs = ['be', 'have', 'do', 'say', 'get', 'make', 'go', 'know', 'take', 'see'];
const timezones = [
    'America/New_York',
    'America/Los_Angeles',
    'Europe/London',
    'Europe/Paris',
    'Asia/Tokyo',
    'Asia/Shanghai',
    'Australia/Sydney',
    'Pacific/Auckland',
];
const directions = ['North', 'South', 'East', 'West', 'Northeast', 'Northwest', 'Southeast', 'Southwest'];
const cardinalDirections = ['North', 'South', 'East', 'West'];
const ordinalDirections = ['Northeast', 'Northwest', 'Southeast', 'Southwest'];
const protocols = ['http', 'https'];
const httpMethods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'];
const domainSuffixes = ['com', 'org', 'net', 'io', 'co', 'dev', 'app', 'info', 'biz'];
const userAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15',
];
const prefixes = ['Mr.', 'Mrs.', 'Ms.', 'Dr.', 'Prof.'];
const suffixes = ['Jr.', 'Sr.', 'I', 'II', 'III', 'IV', 'V', 'MD', 'PhD', 'DDS'];
const sexes = ['male', 'female'];

// Helper functions
const uuid = (): string =>
    'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = (Math.random() * 16) | 0;
        return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
    });

const pastDate = (): Date => {
    const now = Date.now();
    return new Date(now - randInt(86400000, 31536000000)); // 1 day to 1 year ago
};

const futureDate = (): Date => {
    const now = Date.now();
    return new Date(now + randInt(86400000, 31536000000)); // 1 day to 1 year ahead
};

const recentDate = (): Date => {
    const now = Date.now();
    return new Date(now - randInt(0, 86400000 * 7)); // up to 1 week ago
};

const soonDate = (): Date => {
    const now = Date.now();
    return new Date(now + randInt(0, 86400000 * 7)); // up to 1 week ahead
};

const iban = (): string => `${pick(countryCodes)}${randInt(10, 99)}${randAlphaNum(20).toUpperCase()}`;
const bic = (): string => `${randAlpha(4).toUpperCase()}${pick(countryCodes)}${randAlphaNum(2).toUpperCase()}`;
const creditCard = (): string =>
    `${randInt(4000, 4999)}-${randInt(1000, 9999)}-${randInt(1000, 9999)}-${randInt(1000, 9999)}`;
const cvv = (): string => `${randInt(100, 999)}`;
const btcAddress = (): string => `1${randAlphaNum(33)}`;
const ethAddress = (): string => `0x${randHex(40)}`;
const ltcAddress = (): string => `L${randAlphaNum(33)}`;
const mac = (): string => Array.from({ length: 6 }, () => randHex(2)).join(':');
const ip = (): string => `${randInt(1, 255)}.${randInt(0, 255)}.${randInt(0, 255)}.${randInt(1, 255)}`;
const ipv6 = (): string => Array.from({ length: 8 }, () => randHex(4)).join(':');
const semver = (): string => `${randInt(0, 9)}.${randInt(0, 99)}.${randInt(0, 99)}`;
const vin = (): string => randAlphaNum(17).toUpperCase();
const vrm = (): string => `${randAlpha(2).toUpperCase()}${randInt(10, 99)} ${randAlpha(3).toUpperCase()}`;
const imei = (): string => Array.from({ length: 15 }, () => randInt(0, 9)).join('');

const loremSentence = (): string => {
    const words = Array.from({ length: randInt(5, 15) }, () => pick(loremWords));
    words[0] = words[0].charAt(0).toUpperCase() + words[0].slice(1);
    return words.join(' ') + '.';
};

const loremParagraph = (): string => Array.from({ length: randInt(3, 7) }, loremSentence).join(' ');

// The lightweight faker object
export const faker = {
    location: {
        zipCode: () => `${randInt(10000, 99999)}`,
        city: () => pick(cities),
        streetAddress: () => `${randInt(1, 9999)} ${pick(streets)} ${pick(streetSuffixes)}`,
        secondaryAddress: () => `Apt. ${randInt(1, 999)}`,
        county: () => `${pick(cities)} County`,
        country: () => pick(countries),
        countryCode: () => pick(countryCodes),
        state: () => pick(states),
        latitude: () => randFloat(-90, 90, 6),
        longitude: () => randFloat(-180, 180, 6),
        direction: () => pick(directions),
        cardinalDirection: () => pick(cardinalDirections),
        ordinalDirection: () => pick(ordinalDirections),
        timeZone: () => pick(timezones),
    },
    color: {
        human: () => pick(colors),
    },
    commerce: {
        department: () => pick(departments),
        productName: () => `${pick(productAdjectives)} ${pick(productMaterials)} ${pick(products)}`,
        price: () => randFloat(1, 1000, 2).toString(),
        productAdjective: () => pick(productAdjectives),
        productMaterial: () => pick(productMaterials),
        product: () => pick(products),
        productDescription: () => loremSentence(),
    },
    company: {
        name: () => `${pick(lastNames)} ${pick(companySuffixes)}`,
        catchPhrase: () => `${pick(buzzAdjectives)} ${pick(buzzVerbs)} ${pick(buzzNouns)}`,
        buzzPhrase: () => `${pick(buzzVerbs)} ${pick(buzzAdjectives)} ${pick(buzzNouns)}`,
        buzzAdjective: () => pick(buzzAdjectives),
        buzzNoun: () => pick(buzzNouns),
        buzzVerb: () => pick(buzzVerbs),
    },
    database: {
        column: () => pick(dbColumns),
        type: () => pick(dbTypes),
        collation: () => pick(dbCollations),
        engine: () => pick(dbEngines),
    },
    date: {
        past: pastDate,
        future: futureDate,
        recent: recentDate,
        soon: soonDate,
        month: () => pick(months),
        weekday: () => pick(weekdays),
    },
    finance: {
        accountNumber: () => `${randInt(10000000, 99999999)}`,
        accountName: () => `${pick(['Savings', 'Checking', 'Investment', 'Money Market'])} Account`,
        routingNumber: () => `${randInt(100000000, 999999999)}`,
        maskedNumber: () => `****${randInt(1000, 9999)}`,
        amount: () => randFloat(1, 10000, 2).toString(),
        transactionType: () => pick(transactionTypes),
        currencyCode: () => pick(currencyCodes),
        currencyName: () => pick(currencyNames),
        currencySymbol: () => pick(currencySymbols),
        bitcoinAddress: btcAddress,
        litecoinAddress: ltcAddress,
        creditCardNumber: creditCard,
        creditCardCVV: cvv,
        ethereumAddress: ethAddress,
        iban,
        bic,
        transactionDescription: () => `${pick(transactionTypes)} - ${loremSentence()}`,
    },
    git: {
        branch: () => `${pick(['feature', 'bugfix', 'hotfix', 'release'])}/${randAlpha(8)}`,
        commitEntry: () =>
            `commit ${randHex(40)}\nAuthor: ${pick(firstNames)} ${pick(lastNames)}\nDate: ${new Date().toISOString()}\n\n    ${loremSentence()}`,
        commitMessage: loremSentence,
        commitSha: () => randHex(40),
    },
    hacker: {
        abbreviation: () => pick(hackerAbbreviations),
        adjective: () => pick(hackerAdjectives),
        noun: () => pick(hackerNouns),
        verb: () => pick(hackerVerbs),
        ingverb: () => pick(hackerIngverbs),
        phrase: () => `${pick(hackerVerbs)} ${pick(hackerAdjectives)} ${pick(hackerNouns)}`,
    },
    image: {
        url: () => `https://picsum.photos/seed/${randAlphaNum(8)}/640/480`,
        urlLoremFlickr: () => `https://loremflickr.com/640/480?lock=${randInt(1, 99999)}`,
        urlPicsumPhotos: () => `https://picsum.photos/seed/${randAlphaNum(8)}/640/480`,
        dataUri: () =>
            `data:image/svg+xml;charset=UTF-8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect fill="${pick(colors)}" width="100" height="100"/></svg>`,
        avatar: () => `https://avatars.githubusercontent.com/u/${randInt(1, 99999999)}`,
    },
    internet: {
        email: () =>
            `${pick(firstNames).toLowerCase()}.${pick(lastNames).toLowerCase()}@${randAlpha(8)}.${pick(domainSuffixes)}`,
        exampleEmail: () => `${pick(firstNames).toLowerCase()}@example.${pick(['com', 'org', 'net'])}`,
        username: () => `${pick(firstNames).toLowerCase()}${randInt(1, 999)}`,
        displayName: () => `${pick(firstNames)} ${pick(lastNames)}`,
        protocol: () => pick(protocols),
        httpMethod: () => pick(httpMethods),
        url: () => `https://${randAlpha(8)}.${pick(domainSuffixes)}/${randAlpha(5)}`,
        domainName: () => `${randAlpha(8)}.${pick(domainSuffixes)}`,
        domainSuffix: () => pick(domainSuffixes),
        domainWord: () => randAlpha(8),
        ip,
        ipv4: ip,
        ipv6,
        port: () => randInt(1024, 65535),
        userAgent: () => pick(userAgents),
        color: () => `#${randHex(6)}`,
        mac,
        password: () => randAlphaNum(12),
    },
    lorem: {
        word: () => pick(loremWords),
        words: () => Array.from({ length: randInt(3, 8) }, () => pick(loremWords)).join(' '),
        sentence: loremSentence,
        slug: () => Array.from({ length: randInt(2, 5) }, () => pick(loremWords)).join('-'),
        sentences: () => Array.from({ length: randInt(2, 5) }, loremSentence).join(' '),
        paragraph: loremParagraph,
        paragraphs: () => Array.from({ length: randInt(2, 5) }, loremParagraph).join('\n\n'),
        text: loremParagraph,
        lines: () => Array.from({ length: randInt(2, 5) }, loremSentence).join('\n'),
    },
    music: {
        genre: () => pick(musicGenres),
        songName: () => `${pick(adjectives)} ${pick(nouns)}`.replace(/^\w/, c => c.toUpperCase()),
    },
    person: {
        firstName: () => pick(firstNames),
        lastName: () => pick(lastNames),
        middleName: () => pick(firstNames),
        fullName: () => `${pick(firstNames)} ${pick(lastNames)}`,
        jobTitle: () => `${pick(jobDescriptors)} ${pick(jobAreas)} ${pick(jobTypes)}`,
        sex: () => pick(sexes),
        prefix: () => pick(prefixes),
        suffix: () => pick(suffixes),
        jobDescriptor: () => pick(jobDescriptors),
        jobArea: () => pick(jobAreas),
        jobType: () => pick(jobTypes),
    },
    phone: {
        number: () => `+1-${randInt(200, 999)}-${randInt(200, 999)}-${randInt(1000, 9999)}`,
        imei,
    },
    number: {
        int: () => randInt(1, 99999),
        float: () => randFloat(0, 1000, 2),
    },
    string: {
        uuid,
        alpha: () => randAlpha(10),
        alphanumeric: () => randAlphaNum(10),
        hexadecimal: () => `0x${randHex(8)}`,
        numeric: () => `${randInt(0, 999999999)}`,
        sample: () => randAlphaNum(10),
    },
    datatype: {
        boolean: () => Math.random() > 0.5,
    },
    helpers: {
        arrayElement: () => pick(loremWords),
        arrayElements: () => Array.from({ length: randInt(1, 5) }, () => pick(loremWords)),
    },
    system: {
        fileName: () => `${randAlpha(8)}.${pick(fileExtensions)}`,
        commonFileName: () => `${randAlpha(8)}.${pick(commonFileExts)}`,
        mimeType: () => pick(mimeTypes),
        commonFileType: () => pick(commonFileTypes),
        commonFileExt: () => pick(commonFileExts),
        fileType: () => pick(fileTypes),
        fileExt: () => pick(fileExtensions),
        directoryPath: () => `/home/${randAlpha(5)}/${randAlpha(8)}`,
        filePath: () => `/home/${randAlpha(5)}/${randAlpha(8)}/${randAlpha(6)}.${pick(fileExtensions)}`,
        semver,
    },
    vehicle: {
        vehicle: () => `${pick(vehicleManufacturers)} ${pick(vehicleModels)}`,
        manufacturer: () => pick(vehicleManufacturers),
        model: () => pick(vehicleModels),
        type: () => pick(vehicleTypes),
        fuel: () => pick(vehicleFuels),
        vin,
        color: () => pick(colors),
        vrm,
    },
    word: {
        adjective: () => pick(adjectives),
        adverb: () => pick(adverbs),
        conjunction: () => pick(conjunctions),
        interjection: () => pick(interjections),
        noun: () => pick(nouns),
        preposition: () => pick(prepositions),
        verb: () => pick(verbs),
        sample: () => pick([...adjectives, ...nouns, ...verbs]),
        words: () => Array.from({ length: randInt(3, 8) }, () => pick([...adjectives, ...nouns, ...verbs])).join(' '),
    },
};

// List of all available faker functions
export const fakerFunctions: string[] = Object.entries(faker).flatMap(([namespace, methods]) =>
    Object.keys(methods as object).map(method => `${namespace}.${method}`),
);
