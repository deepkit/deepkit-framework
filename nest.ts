import {PipeTransform, ValidationPipeOptions, ArgumentMetadata, BadRequestException} from '@nestjs/common';
import {classToPlain, plainToClass} from "./src/mapper";
import {validate} from "./src/validation";

export class ValidationPipe implements PipeTransform<any> {
    constructor(private options?: ValidationPipeOptions) {
    }

    async transform(value: any, metadata: ArgumentMetadata): Promise<any> {
        const instance = plainToClass(metadata.metatype, value);

        //todo, add validation
        const errors = await validate(metadata.metatype, instance);

        if (errors.length > 0) {
            throw new BadRequestException(this.options.disableErrorMessages ? undefined : errors);
        }

        if (this.options.transform) {
            return instance;
        }

        return classToPlain(metadata.metatype, instance);
    }
}