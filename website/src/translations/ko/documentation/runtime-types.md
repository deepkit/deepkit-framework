# 런타임 타입

TypeScript의 런타임 타입 정보는 이전에는 불가능하거나 우회가 필요했던 새로운 워크플로와 기능을 가능하게 합니다. 현대 개발 프로세스는 GraphQL, validators, ORMs, ProtoBuf 같은 인코더 등의 도구를 위해 타입과 스키마 선언에 크게 의존합니다. 이러한 도구는 ProtoBuf와 GraphQL이 고유한 선언 언어를 갖거나, validators가 자체 schema API 또는 JSON-Schema를 사용하는 것처럼, 사용 사례에 특화된 새로운 언어를 학습하도록 개발자에게 요구할 수 있습니다.

TypeScript는 복잡한 구조를 설명하고 심지어 GraphQL, ProtoBuf, JSON-Schema와 같은 선언 형식을 완전히 대체할 만큼 강력해졌습니다. 런타임 타입 시스템을 사용하면 코드 생성기나 "Zod" 같은 runtime JavaScript type declaration 라이브러리 없이도 이러한 도구의 사용 사례를 포괄할 수 있습니다. Deepkit 라이브러리는 런타임 타입 정보를 제공하고, 효율적이고 호환 가능한 솔루션을 더 쉽게 개발할 수 있도록 하는 것을 목표로 합니다.

Deepkit은 가능한 한 많은 TypeScript 타입 정보를 활용하여 효율성을 높이고, 런타임에 타입 정보를 읽는 능력 위에 구축되었습니다. 런타임 타입 시스템은 Class Property, Function Parameter, Return Type과 같은 동적 타입을 읽고 계산할 수 있게 합니다. Deepkit은 TypeScript의 컴파일 과정에 훅을 걸어, [커스텀 바이트코드와 가상 머신](https://github.com/microsoft/TypeScript/issues/47658)을 사용해 모든 타입 정보가 생성된 JavaScript에 포함되도록 보장하여, 개발자가 프로그래밍적으로 타입 정보에 접근할 수 있게 합니다.

Deepkit을 사용하면 개발자는 기존 TypeScript 타입을 런타임에서 validation, serialisation 등에 활용할 수 있어, 개발 과정을 단순화하고 효율성을 높일 수 있습니다.