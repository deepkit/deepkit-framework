import {
  PipeTransform,
  ArgumentMetadata,
  BadRequestException,
} from '@nestjs/common';
import { validate, plainToClass, applyDefaultValues } from '@marcj/marshal';

export class ValidationPipe implements PipeTransform<any> {
  constructor(
    private options?: { transform?: boolean; disableErrorMessages?: boolean }
  ) {}

  async transform(value: any, metadata: ArgumentMetadata): Promise<any> {
    if (!metadata.metatype) {
      return;
    }

    const valueWithDefaults = applyDefaultValues(metadata.metatype, value);
    const errors = await validate(metadata.metatype, valueWithDefaults);

    if (errors.length > 0) {
      throw new BadRequestException(
        this.options && this.options.disableErrorMessages ? undefined : errors
      );
    }

    if (this.options && this.options.transform) {
      return plainToClass(metadata.metatype, value);
    }

    return valueWithDefaults;
  }
}
