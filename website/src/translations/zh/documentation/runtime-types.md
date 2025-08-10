# 运行时类型

TypeScript 中的运行时类型信息解锁了此前不可用或需要变通实现的新工作流与功能。现代开发过程高度依赖为 GraphQL、验证器、ORM，以及诸如 ProtoBuf 之类的编码器声明类型和模式。这些工具可能要求开发者学习与其用例相关的专用语言，例如 ProtoBuf 和 GraphQL 拥有各自的声明语言，或验证器使用自己的模式 API 或 JSON‑Schema。

TypeScript 已经足够强大，可以描述复杂结构，甚至完全替代像 GraphQL、ProtoBuf 和 JSON‑Schema 这样的声明格式。借助运行时类型系统，可以在不使用任何代码生成器或诸如“Zod”这类运行时 JavaScript 类型声明库的情况下覆盖这些工具的用例。Deepkit 库旨在提供运行时类型信息，帮助更轻松地开发高效且兼容的解决方案。

Deepkit 构建在运行时读取类型信息的能力之上，并尽可能利用 TypeScript 的类型信息以提高效率。该运行时类型系统允许读取和计算动态类型，例如类属性、函数参数和返回类型。Deepkit 挂接到 TypeScript 的编译过程，通过使用[自定义字节码和虚拟机](https://github.com/microsoft/TypeScript/issues/47658)确保所有类型信息被嵌入到生成的 JavaScript 中，使开发者能够以编程方式访问类型信息。

借助 Deepkit，开发者可以在运行时使用现有的 TypeScript 类型进行验证、序列化等，从而简化开发流程并提升工作效率。