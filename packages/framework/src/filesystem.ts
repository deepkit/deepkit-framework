import { Filesystem, FilesystemLocalAdapter } from '@deepkit/filesystem';
import { AppModule } from '@deepkit/app';
import { ClassType } from '@deepkit/core';
import { InjectorContext } from '@deepkit/injector';

export class FilesystemRegistry {
    protected filesystems: { classType: ClassType, module: AppModule<any> }[] = [];

    constructor(protected injectorContext: InjectorContext) {
    }

    addFilesystem(classType: ClassType, module: AppModule<any>) {
        this.filesystems.push({ classType, module });
    }

    getFilesystems(): Filesystem[] {
        return this.filesystems.map(v => {
            return this.injectorContext.get(v.classType, v.module);
        });
    }
}

export class PublicFilesystem extends Filesystem {
    constructor(publicDir: string, publicBaseUrl: string) {
        super(new FilesystemLocalAdapter({ root: publicDir }), {
            baseUrl: publicBaseUrl,
        });
    }
}
