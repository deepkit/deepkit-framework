import {ArgumentMetadata, BadRequestException, PipeTransform} from '@nestjs/common';
import {plainToClass, validate} from "@super-hornet/marshal";

export class ValidationPipe implements PipeTransform<any> {
    constructor(private options?: { transform?: boolean, disableErrorMessages?: boolean }) {
    }

    async transform(value: any, metadata: ArgumentMetadata): Promise<any> {
        if (!metadata.metatype) {
            return;
        }

        const item = plainToClass(metadata.metatype, value);
        const errors = validate(metadata.metatype, item);

        if (errors.length > 0) {
            throw new BadRequestException(this.options && this.options.disableErrorMessages ? undefined : errors);
        }

        if (this.options && this.options.transform) {
            return plainToClass(metadata.metatype, value);
        }

        return item;
    }
}
