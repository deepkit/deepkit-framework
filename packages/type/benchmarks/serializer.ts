/**
 * Deepkit Type Serialization Benchmarks
 *
 * Run with: cd packages/type && node --import @deepkit/run benchmarks/serializer.ts
 */
import { BenchSuite } from '@deepkit/bench';

import { Excluded, deserialize, serialize } from '../index.js';

// ============================================================================
// Small Model - Basic serialization test
// ============================================================================

class SmallModel {
    ready?: boolean;
    tags: string[] = [];
    priority: number = 0;

    constructor(
        public id: number,
        public name: string,
    ) {}
}

const smallPlainData = {
    name: 'name',
    id: 2,
    tags: ['a', 'b', 'c'],
    priority: 5,
    ready: true,
};

// ============================================================================
// Medium Model - Complex serialization test with nested types
// ============================================================================

class SubModel {
    age?: number;
    constructorUsed = false;

    constructor(public label: string) {
        this.constructorUsed = true;
    }
}

enum Plan {
    DEFAULT,
    PRO,
    ENTERPRISE,
}

class MediumModel {
    type: number = 0;
    yesNo: boolean = false;
    plan: Plan = Plan.DEFAULT;
    created: Date = new Date();
    types: string[] = [];
    children: SubModel[] = [];
    childrenMap: { [key: string]: SubModel } = {};
    notMapped: { [key: string]: any } = {};
    excluded: string & Excluded = 'default';
    excludedForPlain: string & Excluded<'json'> = 'excludedForPlain';

    constructor(public name: string) {}
}

const mediumPlainData = {
    name: 'name',
    type: 2,
    plan: Plan.ENTERPRISE,
    children: [{ label: 'label' }],
    childrenMap: { sub: { label: 'label' } },
    types: ['a', 'b', 'c'],
};

// ============================================================================
// Large Model - 50+ properties
// ============================================================================

enum UserStatus {
    PENDING,
    ACTIVE,
    SUSPENDED,
    DELETED,
}
enum Role {
    USER,
    MODERATOR,
    ADMIN,
    SUPER_ADMIN,
}

class Address {
    constructor(
        public street: string = '',
        public city: string = '',
        public state: string = '',
        public zipCode: string = '',
        public country: string = '',
        public isDefault: boolean = false,
    ) {}
}

class PaymentMethod {
    constructor(
        public type: string = '',
        public lastFour: string = '',
        public expiryMonth: number = 0,
        public expiryYear: number = 0,
        public isDefault: boolean = false,
    ) {}
}

class Preferences {
    theme: string = 'light';
    language: string = 'en';
    timezone: string = 'UTC';
    emailNotifications: boolean = true;
    pushNotifications: boolean = true;
    smsNotifications: boolean = false;
    newsletter: boolean = false;
    marketingEmails: boolean = false;
}

class LargeModel {
    id: number = 0;
    uuid: string = '';
    username: string = '';
    email: string = '';
    emailVerified: boolean = false;
    phone: string = '';
    phoneVerified: boolean = false;
    firstName: string = '';
    lastName: string = '';
    displayName: string = '';
    avatar: string = '';
    bio: string = '';
    website: string = '';
    birthDate: Date = new Date();
    gender: string = '';
    status: UserStatus = UserStatus.PENDING;
    role: Role = Role.USER;
    isActive: boolean = true;
    isVerified: boolean = false;
    isPremium: boolean = false;
    isBanned: boolean = false;
    createdAt: Date = new Date();
    updatedAt: Date = new Date();
    lastLoginAt: Date = new Date();
    lastActivityAt: Date = new Date();
    passwordChangedAt: Date = new Date();
    loginCount: number = 0;
    failedLoginCount: number = 0;
    postCount: number = 0;
    commentCount: number = 0;
    likeCount: number = 0;
    followerCount: number = 0;
    followingCount: number = 0;
    reputationScore: number = 0;
    twoFactorEnabled: boolean = false;
    twoFactorMethod: string = '';
    sessionTimeout: number = 3600;
    maxSessions: number = 5;
    addresses: Address[] = [];
    paymentMethods: PaymentMethod[] = [];
    preferences: Preferences = new Preferences();
    tags: string[] = [];
    roles: string[] = [];
    permissions: string[] = [];
    metadata: { [key: string]: string } = {};

    constructor(public primaryKey: string = '') {}
}

const largePlainData = {
    primaryKey: 'user_123456',
    id: 123456,
    uuid: '550e8400-e29b-41d4-a716-446655440000',
    username: 'johndoe',
    email: 'john.doe@example.com',
    emailVerified: true,
    phone: '+1234567890',
    phoneVerified: true,
    firstName: 'John',
    lastName: 'Doe',
    displayName: 'John D.',
    avatar: 'https://example.com/avatars/johndoe.jpg',
    bio: 'Software developer passionate about TypeScript and open source.',
    website: 'https://johndoe.dev',
    birthDate: '1990-05-15T00:00:00.000Z',
    gender: 'male',
    status: UserStatus.ACTIVE,
    role: Role.ADMIN,
    isActive: true,
    isVerified: true,
    isPremium: true,
    isBanned: false,
    createdAt: '2020-01-15T10:30:00.000Z',
    updatedAt: '2024-01-20T15:45:00.000Z',
    lastLoginAt: '2024-01-20T14:00:00.000Z',
    lastActivityAt: '2024-01-20T15:30:00.000Z',
    passwordChangedAt: '2023-06-01T00:00:00.000Z',
    loginCount: 1543,
    failedLoginCount: 3,
    postCount: 234,
    commentCount: 1876,
    likeCount: 5432,
    followerCount: 12500,
    followingCount: 850,
    reputationScore: 45678,
    twoFactorEnabled: true,
    twoFactorMethod: 'authenticator',
    sessionTimeout: 7200,
    maxSessions: 10,
    addresses: [
        {
            street: '123 Main St',
            city: 'San Francisco',
            state: 'CA',
            zipCode: '94105',
            country: 'USA',
            isDefault: true,
        },
        { street: '456 Oak Ave', city: 'Los Angeles', state: 'CA', zipCode: '90001', country: 'USA', isDefault: false },
    ],
    paymentMethods: [
        { type: 'credit_card', lastFour: '4242', expiryMonth: 12, expiryYear: 2025, isDefault: true },
        { type: 'paypal', lastFour: '', expiryMonth: 0, expiryYear: 0, isDefault: false },
    ],
    preferences: {
        theme: 'dark',
        language: 'en-US',
        timezone: 'America/Los_Angeles',
        emailNotifications: true,
        pushNotifications: true,
        smsNotifications: false,
        newsletter: true,
        marketingEmails: false,
    },
    tags: ['developer', 'typescript', 'nodejs', 'react', 'graphql'],
    roles: ['user', 'moderator', 'content-creator'],
    permissions: ['read', 'write', 'delete', 'admin:users', 'admin:posts'],
    metadata: { referralCode: 'ABC123', signupSource: 'organic', experimentGroup: 'beta-features' },
};

// ============================================================================
// Union Types
// ============================================================================

interface TextMessage {
    type: 'text';
    content: string;
    formatting?: 'plain' | 'markdown' | 'html';
}
interface ImageMessage {
    type: 'image';
    url: string;
    width: number;
    height: number;
    alt?: string;
}
interface VideoMessage {
    type: 'video';
    url: string;
    duration: number;
    thumbnail: string;
}
interface FileMessage {
    type: 'file';
    url: string;
    filename: string;
    size: number;
    mimeType: string;
}

type Message = TextMessage | ImageMessage | VideoMessage | FileMessage;

interface Conversation {
    id: string;
    participants: string[];
    messages: Message[];
}

const unionPlainData: Conversation = {
    id: 'conv_123',
    participants: ['user1', 'user2', 'user3'],
    messages: [
        { type: 'text', content: 'Hello everyone!', formatting: 'plain' },
        { type: 'image', url: 'https://example.com/photo.jpg', width: 800, height: 600, alt: 'A photo' },
        { type: 'text', content: 'Check out this video:', formatting: 'markdown' },
        {
            type: 'video',
            url: 'https://example.com/video.mp4',
            duration: 120,
            thumbnail: 'https://example.com/thumb.jpg',
        },
        {
            type: 'file',
            url: 'https://example.com/doc.pdf',
            filename: 'document.pdf',
            size: 1024000,
            mimeType: 'application/pdf',
        },
        { type: 'text', content: 'Thanks for sharing!', formatting: 'plain' },
    ],
};

// ============================================================================
// Array Data
// ============================================================================

interface ArrayItem {
    id: number;
    name: string;
    value: number;
    active: boolean;
    tags: string[];
}

function generateArrayData(size: number): ArrayItem[] {
    const items: ArrayItem[] = [];
    for (let i = 0; i < size; i++) {
        items.push({
            id: i,
            name: `Item ${i}`,
            value: Math.random() * 1000,
            active: i % 2 === 0,
            tags: ['tag1', 'tag2', 'tag3'],
        });
    }
    return items;
}

const array100Data = generateArrayData(100);
const array1000Data = generateArrayData(1000);

// ============================================================================
// Run Benchmarks
// ============================================================================

async function main() {
    const suite = new BenchSuite('type/serialization', 1, true);

    // Warm up and sanity check
    const smallInstance = deserialize<SmallModel>(smallPlainData);
    if (!(smallInstance instanceof SmallModel)) {
        throw new Error('Small model deserialization should return SmallModel instance');
    }

    const mediumInstance = deserialize<MediumModel>(mediumPlainData);
    if (!(mediumInstance instanceof MediumModel)) {
        throw new Error('Medium model deserialization should return MediumModel instance');
    }

    const largeInstance = deserialize<LargeModel>(largePlainData);
    if (!(largeInstance instanceof LargeModel)) {
        throw new Error('Large model deserialization should return LargeModel instance');
    }

    const unionInstance = deserialize<Conversation>(unionPlainData);
    const array100Instance = deserialize<ArrayItem[]>(array100Data);
    const array1000Instance = deserialize<ArrayItem[]>(array1000Data);

    // Small model
    suite.add('small deserialize', () => {
        deserialize<SmallModel>(smallPlainData);
    });
    suite.add('small serialize', () => {
        serialize<SmallModel>(smallInstance);
    });

    // Medium model
    suite.add('medium deserialize', () => {
        deserialize<MediumModel>(mediumPlainData);
    });
    suite.add('medium serialize', () => {
        serialize<MediumModel>(mediumInstance);
    });

    // Large model (50+ props)
    suite.add('large deserialize', () => {
        deserialize<LargeModel>(largePlainData);
    });
    suite.add('large serialize', () => {
        serialize<LargeModel>(largeInstance);
    });

    // Union types
    suite.add('union deserialize', () => {
        deserialize<Conversation>(unionPlainData);
    });
    suite.add('union serialize', () => {
        serialize<Conversation>(unionInstance);
    });

    // Arrays
    suite.add('array[100] deserialize', () => {
        deserialize<ArrayItem[]>(array100Data);
    });
    suite.add('array[100] serialize', () => {
        serialize<ArrayItem[]>(array100Instance);
    });
    suite.add('array[1000] deserialize', () => {
        deserialize<ArrayItem[]>(array1000Data);
    });
    suite.add('array[1000] serialize', () => {
        serialize<ArrayItem[]>(array1000Instance);
    });

    await suite.runAsync();
}

main().catch(console.error);
