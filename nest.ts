import {PipeTransform, ValidationPipeOptions, ArgumentMetadata, BadRequestException} from '@nestjs/common';
import {plainToClass, applyDefaultValues} from "./src/mapper";
import {validate} from "./src/validation";
import * as clone from 'clone';

export class ValidationPipe implements PipeTransform<any> {
    constructor(private options?: {transform?: boolean, disableErrorMessages?: boolean}) {
    }

    async transform(value: any, metadata: ArgumentMetadata): Promise<any> {
        const valueWithDefaults = applyDefaultValues(metadata.metatype, value);
        const errors = await validate(metadata.metatype, valueWithDefaults);

        if (errors.length > 0) {
            throw new BadRequestException(this.options && this.options.disableErrorMessages ? undefined : errors);
        }

        if (this.options && this.options.transform) {
            return plainToClass(metadata.metatype, value);
        }

        return valueWithDefaults;
    }
}